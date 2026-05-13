import { deleteAsset, findAssetByOriginalUrl, getAsset, putAsset, type StoredAssetRecord } from './browserDb';
import { getOrCreate, peek, revoke } from './objectUrlRegistry';
import { createUploadedAssetRef, isUploadedAssetRef, parseUploadedAssetRef } from './persistentAssetRef';

const remoteAssetInflightRequests = new Map<string, Promise<string>>();
const modelInputCache = new Map<string, Promise<string | null>>();
const MODEL_INPUT_CACHE_MAX = 48;

function createAssetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ua_${crypto.randomUUID()}`;
  }
  return `ua_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isDirectDisplayValue(value: string): boolean {
  if (/^data:/i.test(value)) {
    return /^data:(?:image|audio)\/[a-zA-Z0-9.+-]+(?:;[^,]+)?,.+$/i.test(value);
  }

  return /^(https?:)/i.test(value);
}

export type ImagePreviewOptions = {
  maxWidth?: number;
  maxHeight?: number;
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
  backgroundColor?: string;
};

function clampPreviewDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
) {
  if (width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }

  const safeMaxWidth = Math.max(1, maxWidth);
  const safeMaxHeight = Math.max(1, maxHeight);
  const scale = Math.min(1, safeMaxWidth / width, safeMaxHeight / height);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function saveUploadedBlob(
  blob: Blob,
  options?: {
    fileName?: string;
    mimeType?: string;
    source?: StoredAssetRecord['source'];
    originalUrl?: string;
  },
): Promise<string> {
  const id = createAssetId();
  const now = Date.now();
  const mimeType = options?.mimeType || blob.type || 'application/octet-stream';
  const record: StoredAssetRecord = {
    id,
    kind: mimeType.startsWith('image/') ? 'image' : 'file',
    mimeType,
    blob,
    fileName: options?.fileName,
    createdAt: now,
    updatedAt: now,
    source: options?.source || 'upload',
    ...(options?.originalUrl ? { originalUrl: options.originalUrl.trim() } : {}),
  };

  await putAsset(record);
  return createUploadedAssetRef(id, options?.fileName);
}

export async function saveUploadedFile(file: File): Promise<string> {
  return saveUploadedBlob(file, {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
  });
}

export async function saveUploadedDataUrl(dataUrl: string, fileName = 'uploaded-image.png'): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return saveUploadedBlob(blob, {
    fileName,
    mimeType: blob.type || 'image/png',
  });
}

function isRemoteHttpValue(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isLikelyImageUrl(value: string): boolean {
  return /\.(?:png|jpe?g|gif|webp|bmp|svg|avif|apng)(?:$|[?#])/i.test(value);
}

function guessMimeTypeFromUrl(value: string): string {
  const lowerValue = value.toLowerCase();
  if (lowerValue.includes('.png')) return 'image/png';
  if (lowerValue.includes('.jpg') || lowerValue.includes('.jpeg')) return 'image/jpeg';
  if (lowerValue.includes('.webp')) return 'image/webp';
  if (lowerValue.includes('.gif')) return 'image/gif';
  if (lowerValue.includes('.bmp')) return 'image/bmp';
  if (lowerValue.includes('.svg')) return 'image/svg+xml';
  if (lowerValue.includes('.avif')) return 'image/avif';
  if (lowerValue.includes('.apng')) return 'image/apng';
  return 'application/octet-stream';
}

function buildRemoteAssetFileName(value: string): string {
  try {
    const pathname = new URL(value).pathname;
    const candidate = pathname.split('/').pop()?.trim();
    if (candidate) {
      return candidate;
    }
  } catch {
    // Fall back to a generated name when URL parsing fails.
  }

  const mimeType = guessMimeTypeFromUrl(value);
  const extension = mimeType.startsWith('image/') ? mimeType.split('/')[1]?.replace('svg+xml', 'svg') || 'png' : 'bin';
  return `remote-asset.${extension}`;
}

function createAssetRefFromRecord(record: StoredAssetRecord): string {
  return createUploadedAssetRef(record.id, record.fileName);
}

function buildModelInputCacheKey(value: string, assetType: 'image' | 'audio') {
  return `${assetType}:${value}`;
}

function getCachedModelInput(
  key: string,
  loader: () => Promise<string | null>,
): Promise<string | null> {
  const existing = modelInputCache.get(key);
  if (existing) {
    return existing;
  }

  const requestPromise = loader().catch((error) => {
    if (modelInputCache.get(key) === requestPromise) {
      modelInputCache.delete(key);
    }
    throw error;
  });

  modelInputCache.set(key, requestPromise);
  if (modelInputCache.size > MODEL_INPUT_CACHE_MAX) {
    const oldestKey = modelInputCache.keys().next().value;
    if (typeof oldestKey === 'string' && oldestKey !== key) {
      modelInputCache.delete(oldestKey);
    }
  }

  return requestPromise;
}

function clearCachedModelInputs(pattern: string) {
  for (const key of [...modelInputCache.keys()]) {
    if (key.includes(pattern)) {
      modelInputCache.delete(key);
    }
  }
}

export async function cacheRemoteAsset(url: string, fileName?: string): Promise<string> {
  const trimmed = url.trim();
  if (!isRemoteHttpValue(trimmed)) {
    return trimmed;
  }

  const inflightRequest = remoteAssetInflightRequests.get(trimmed);
  if (inflightRequest) {
    return inflightRequest;
  }

  const requestPromise = (async () => {
    const existingRecord = await findAssetByOriginalUrl(trimmed);
    if (existingRecord) {
      return createAssetRefFromRecord(existingRecord);
    }

    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`Remote asset fetch failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const mimeType = blob.type || guessMimeTypeFromUrl(trimmed);
    const isLikelyImage = mimeType.startsWith('image/') || isLikelyImageUrl(trimmed);
    if (!isLikelyImage) {
      throw new Error('Remote asset is not an image.');
    }

    return saveUploadedBlob(blob, {
      fileName: fileName?.trim() || buildRemoteAssetFileName(trimmed),
      mimeType,
      source: 'remote-cache',
      originalUrl: trimmed,
    });
  })();

  remoteAssetInflightRequests.set(trimmed, requestPromise);

  try {
    return await requestPromise;
  } finally {
    remoteAssetInflightRequests.delete(trimmed);
  }
}

export async function createImagePreviewDataUrl(
  blob: Blob,
  options: ImagePreviewOptions = {},
): Promise<string> {
  const image = await blobToImage(blob);
  const naturalWidth = image.naturalWidth || image.width || 1;
  const naturalHeight = image.naturalHeight || image.height || 1;
  const { width, height } = clampPreviewDimensions(
    naturalWidth,
    naturalHeight,
    options.maxWidth ?? naturalWidth,
    options.maxHeight ?? naturalHeight,
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to build image preview canvas.');
  }

  if (options.backgroundColor) {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, width, height);
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL(options.mimeType || 'image/png', options.quality);
}

export async function createImagePreviewDataUrlFromFile(
  file: File,
  options?: ImagePreviewOptions,
): Promise<string> {
  return createImagePreviewDataUrl(file, options);
}

export async function resolveValueToDisplayUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // blob: URLs are session-scoped temporary object URLs.
  // They should never be treated as durable persisted asset values because
  // they become invalid after refresh / import / cross-session reuse.
  if (/^blob:/i.test(trimmed)) {
    return null;
  }

  if (isDirectDisplayValue(trimmed)) {
    if (isRemoteHttpValue(trimmed)) {
      const cachedRecord = await findAssetByOriginalUrl(trimmed);
      if (cachedRecord) {
        return getOrCreate(cachedRecord.id, cachedRecord.blob);
      }
    }

    return trimmed;
  }

  const parsedRef = parseUploadedAssetRef(trimmed);
  if (!parsedRef) {
    return null;
  }

  const record = await getAsset(parsedRef.id);
  if (!record) {
    return null;
  }

  return getOrCreate(parsedRef.id, record.blob);
}

export function resolveValueToImmediateDisplayUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || /^blob:/i.test(trimmed)) {
    return null;
  }

  if (isDirectDisplayValue(trimmed)) {
    return trimmed;
  }

  const parsedRef = parseUploadedAssetRef(trimmed);
  if (!parsedRef) {
    return null;
  }

  return peek(parsedRef.id);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('无法把资源转换成 data URL'));
    };
    reader.onerror = () => reject(reader.error || new Error('读取资源失败'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;,]+)(?:;[^,]+)?,(.+)$/i);
  if (!match?.[1] || !match?.[2]) {
    throw new Error('无效的 data URL');
  }

  const mimeType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片解码失败'));
    };
    image.src = objectUrl;
  });
}

async function convertBlobToPngDataUrl(blob: Blob): Promise<string> {
  const image = await blobToImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法创建画布上下文');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

function isGeminiFriendlyImageMimeType(mimeType: string): boolean {
  return mimeType === 'image/png' || mimeType === 'image/jpeg';
}

async function normalizeModelImageDataUrl(dataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  if (isGeminiFriendlyImageMimeType(blob.type)) {
    return dataUrl;
  }

  return convertBlobToPngDataUrl(blob);
}

export async function resolveValueToModelInput(
  value: string | null | undefined,
  options?: {
    assetType?: 'image' | 'audio';
  },
): Promise<string | null> {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const assetType = options?.assetType || 'image';
  const cacheKey = buildModelInputCacheKey(trimmed, assetType);

  return getCachedModelInput(cacheKey, async () => {
    if (isDirectDisplayValue(trimmed)) {
      if (assetType === 'audio') {
        if (/^data:/i.test(trimmed)) {
          return trimmed;
        }

        if (isRemoteHttpValue(trimmed)) {
          const cachedRecord = await findAssetByOriginalUrl(trimmed);
          if (cachedRecord) {
            return blobToDataUrl(cachedRecord.blob);
          }
        }

        const response = await fetch(trimmed);
        const blob = await response.blob();
        return blobToDataUrl(blob);
      }

      if (/^data:/i.test(trimmed)) {
        return normalizeModelImageDataUrl(trimmed);
      }

      if (isRemoteHttpValue(trimmed)) {
        const cachedRecord = await findAssetByOriginalUrl(trimmed);
        if (cachedRecord) {
          if (isGeminiFriendlyImageMimeType(cachedRecord.blob.type)) {
            return blobToDataUrl(cachedRecord.blob);
          }

          return convertBlobToPngDataUrl(cachedRecord.blob);
        }
      }

      const response = await fetch(trimmed);
      const blob = await response.blob();
      if (isGeminiFriendlyImageMimeType(blob.type)) {
        return blobToDataUrl(blob);
      }

      return convertBlobToPngDataUrl(blob);
    }

    const parsedRef = parseUploadedAssetRef(trimmed);
    if (!parsedRef) {
      return null;
    }

    const record = await getAsset(parsedRef.id);
    if (!record) {
      return null;
    }

    if (assetType === 'audio') {
      return blobToDataUrl(record.blob);
    }

    if (isGeminiFriendlyImageMimeType(record.blob.type)) {
      return blobToDataUrl(record.blob);
    }

    return convertBlobToPngDataUrl(record.blob);
  });
}

export async function removeAssetByRef(ref: string): Promise<void> {
  if (!isUploadedAssetRef(ref)) return;

  const parsedRef = parseUploadedAssetRef(ref);
  if (!parsedRef) return;

  revoke(parsedRef.id);
  clearCachedModelInputs(parsedRef.id);
  clearCachedModelInputs(ref);
  await deleteAsset(parsedRef.id);
}

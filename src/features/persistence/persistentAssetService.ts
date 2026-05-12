import { deleteAsset, getAsset, putAsset, type StoredAssetRecord } from './browserDb';
import { getOrCreate, peek, revoke } from './objectUrlRegistry';
import { createUploadedAssetRef, isUploadedAssetRef, parseUploadedAssetRef } from './persistentAssetRef';

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
    source: 'upload',
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

  if (isDirectDisplayValue(trimmed)) {
    if (assetType === 'audio') {
      if (/^data:/i.test(trimmed)) {
        return trimmed;
      }

      const response = await fetch(trimmed);
      const blob = await response.blob();
      return blobToDataUrl(blob);
    }

    if (/^data:/i.test(trimmed)) {
      return normalizeModelImageDataUrl(trimmed);
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
}

export async function removeAssetByRef(ref: string): Promise<void> {
  if (!isUploadedAssetRef(ref)) return;

  const parsedRef = parseUploadedAssetRef(ref);
  if (!parsedRef) return;

  revoke(parsedRef.id);
  await deleteAsset(parsedRef.id);
}

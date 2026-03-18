import { deleteAsset, getAsset, putAsset, type StoredAssetRecord } from './browserDb';
import { getOrCreate, revoke } from './objectUrlRegistry';
import { createUploadedAssetRef, isUploadedAssetRef, parseUploadedAssetRef } from './persistentAssetRef';

function createAssetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ua_${crypto.randomUUID()}`;
  }
  return `ua_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isDirectDisplayValue(value: string): boolean {
  return /^(https?:|data:|blob:)/i.test(value);
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
  return createUploadedAssetRef(id);
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

export async function resolveValueToDisplayUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

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

export async function removeAssetByRef(ref: string): Promise<void> {
  if (!isUploadedAssetRef(ref)) return;

  const parsedRef = parseUploadedAssetRef(ref);
  if (!parsedRef) return;

  revoke(parsedRef.id);
  await deleteAsset(parsedRef.id);
}

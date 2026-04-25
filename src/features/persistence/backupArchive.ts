import { listAssets, putAsset, type StoredAssetRecord } from './browserDb';
import { removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { createUploadedAssetRef } from './persistentAssetRef';
import { STORAGE_KEYS } from './storageKeys';

export const FULL_BACKUP_ARCHIVE_FORMAT = 'bloom-full-backup';
export const FULL_BACKUP_ARCHIVE_VERSION = 1;

export type SerializedAssetRecord = Omit<StoredAssetRecord, 'blob'> & {
  dataUrl: string;
};

export type FullBackupArchive = {
  format: typeof FULL_BACKUP_ARCHIVE_FORMAT;
  version: typeof FULL_BACKUP_ARCHIVE_VERSION;
  exportedAt: string;
  storage: Record<string, unknown | null>;
  assets: SerializedAssetRecord[];
};

type FullBackupOverrides = {
  appData?: unknown;
  settings?: unknown;
  visualSettings?: unknown;
  characters?: unknown;
  userProfile?: unknown;
};

const INDEXED_DB_RESTORE_KEYS = new Set<string>(
  Object.values(STORAGE_KEYS).filter((key) => key !== STORAGE_KEYS.appData),
);

function createArchiveAssetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ua_${crypto.randomUUID()}`;
  }

  return `ua_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('无法将资源转换为 data URL'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取资源失败'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;,]+)(?:;[^,]+)?,(.+)$/i);
  if (!match?.[1] || !match?.[2]) {
    throw new Error('备份中的资源 data URL 无效');
  }

  const mimeType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function readStoredJson(key: string): unknown | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    console.error(`[backupArchive] Failed to parse localStorage key "${key}"`, error);
    return null;
  }
}

function collectStorageSnapshot(overrides?: FullBackupOverrides): Record<string, unknown | null> {
  const storage = Object.values(STORAGE_KEYS).reduce<Record<string, unknown | null>>((acc, key) => {
    acc[key] = readStoredJson(key);
    return acc;
  }, {});

  if (overrides?.settings !== undefined) {
    storage[STORAGE_KEYS.settings] = overrides.settings;
  }
  if (overrides?.appData !== undefined) {
    storage[STORAGE_KEYS.appData] = overrides.appData;
  }
  if (overrides?.visualSettings !== undefined) {
    storage[STORAGE_KEYS.visualSettings] = overrides.visualSettings;
  }
  if (overrides?.characters !== undefined) {
    storage[STORAGE_KEYS.characters] = overrides.characters;
  }
  if (overrides?.userProfile !== undefined) {
    storage[STORAGE_KEYS.userProfile] = overrides.userProfile;
  }

  return storage;
}

async function collectSerializedAssets(): Promise<SerializedAssetRecord[]> {
  const assets = await listAssets();
  return Promise.all(
    assets.map(async (asset) => ({
      id: asset.id,
      kind: asset.kind,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      source: asset.source,
      originalUrl: asset.originalUrl,
      dataUrl: await blobToDataUrl(asset.blob),
    })),
  );
}

async function normalizeBlobUrlsInValue(
  value: unknown,
  remappedAssets: SerializedAssetRecord[],
  blobUrlMap: Map<string, string>,
): Promise<unknown> {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^blob:/i.test(trimmed)) {
      return value;
    }

    const existingRef = blobUrlMap.get(trimmed);
    if (existingRef) {
      return existingRef;
    }

    try {
      const response = await fetch(trimmed);
      const blob = await response.blob();
      const id = createArchiveAssetId();
      const assetRef = createUploadedAssetRef(id);
      remappedAssets.push({
        id,
        kind: blob.type.startsWith('image/') ? 'image' : 'file',
        mimeType: blob.type || 'application/octet-stream',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'upload',
        dataUrl: await blobToDataUrl(blob),
      });
      blobUrlMap.set(trimmed, assetRef);
      return assetRef;
    } catch (error) {
      console.warn('[backupArchive] Failed to normalize blob URL during export', trimmed, error);
      return value;
    }
  }

  if (Array.isArray(value)) {
    const nextItems = await Promise.all(
      value.map((item) => normalizeBlobUrlsInValue(item, remappedAssets, blobUrlMap)),
    );
    return nextItems;
  }

  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, entryValue]) => [
        key,
        await normalizeBlobUrlsInValue(entryValue, remappedAssets, blobUrlMap),
      ] as const),
    );
    return Object.fromEntries(entries);
  }

  return value;
}

async function normalizeBlobUrlsInStorage(
  storage: Record<string, unknown | null>,
): Promise<{ storage: Record<string, unknown | null>; assets: SerializedAssetRecord[] }> {
  const remappedAssets: SerializedAssetRecord[] = [];
  const blobUrlMap = new Map<string, string>();
  const entries = await Promise.all(
    Object.entries(storage).map(async ([key, value]) => [
      key,
      await normalizeBlobUrlsInValue(value, remappedAssets, blobUrlMap),
    ] as const),
  );

  return {
    storage: Object.fromEntries(entries),
    assets: remappedAssets,
  };
}

export async function buildFullBackupArchive(overrides?: FullBackupOverrides): Promise<FullBackupArchive> {
  const baseStorage = collectStorageSnapshot(overrides);
  const existingAssets = await collectSerializedAssets();
  const normalized = await normalizeBlobUrlsInStorage(baseStorage);

  return {
    format: FULL_BACKUP_ARCHIVE_FORMAT,
    version: FULL_BACKUP_ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    storage: normalized.storage,
    assets: [...existingAssets, ...normalized.assets],
  };
}

export function isFullBackupArchive(value: unknown): value is FullBackupArchive {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<FullBackupArchive>;
  return candidate.format === FULL_BACKUP_ARCHIVE_FORMAT
    && typeof candidate.version === 'number'
    && !!candidate.storage
    && typeof candidate.storage === 'object'
    && !Array.isArray(candidate.storage)
    && Array.isArray(candidate.assets);
}

export async function restoreFullBackupArchive(archive: FullBackupArchive): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持恢复本地备份');
  }

  const indexedDbWrites: Promise<void>[] = [];

  Object.entries(archive.storage).forEach(([key, value]) => {
    if (value == null) {
      window.localStorage.removeItem(key);
      if (INDEXED_DB_RESTORE_KEYS.has(key)) {
        indexedDbWrites.push(
          removeJsonRecord(key).catch((error) => {
            console.error(`[backupArchive] Failed to clear IndexedDB key "${key}" during restore`, error);
          }),
        );
      }
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
    if (INDEXED_DB_RESTORE_KEYS.has(key)) {
      indexedDbWrites.push(
        saveJsonRecord(key, value).catch((error) => {
          console.error(`[backupArchive] Failed to restore IndexedDB key "${key}"`, error);
        }),
      );
    }
  });

  await Promise.all(
    archive.assets.map((asset) =>
      putAsset({
        id: asset.id,
        kind: asset.kind,
        mimeType: asset.mimeType,
        blob: dataUrlToBlob(asset.dataUrl),
        fileName: asset.fileName,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
        source: asset.source,
        originalUrl: asset.originalUrl,
      }),
    ),
  );

  await Promise.all(indexedDbWrites);
}

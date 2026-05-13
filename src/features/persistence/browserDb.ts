import {
  PERSISTENCE_ASSETS_STORE,
} from './storageKeys';
import { openPersistenceDb } from './persistenceDb';

const ASSET_ORIGINAL_URL_INDEX = 'originalUrl';

export type StoredAssetRecord = {
  id: string;
  kind: 'image' | 'file';
  mimeType: string;
  blob: Blob;
  fileName?: string;
  createdAt: number;
  updatedAt: number;
  source?: 'upload' | 'remote-cache';
  originalUrl?: string;
};

function runTransaction<T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  return openPersistenceDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(PERSISTENCE_ASSETS_STORE, mode);
        const store = tx.objectStore(PERSISTENCE_ASSETS_STORE);

        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
        executor(store, resolve, reject);
      }),
  );
}

export function putAsset(record: StoredAssetRecord): Promise<void> {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to write asset'));
  });
}

export function getAsset(id: string): Promise<StoredAssetRecord | null> {
  return runTransaction<StoredAssetRecord | null>('readonly', (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as StoredAssetRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Failed to read asset'));
  });
}

export function findAssetByOriginalUrl(originalUrl: string): Promise<StoredAssetRecord | null> {
  const normalizedOriginalUrl = originalUrl.trim();
  if (!normalizedOriginalUrl) {
    return Promise.resolve(null);
  }

  return openPersistenceDb().then(
    (db) =>
      new Promise<StoredAssetRecord | null>((resolve, reject) => {
        const tx = db.transaction(PERSISTENCE_ASSETS_STORE, 'readonly');
        const store = tx.objectStore(PERSISTENCE_ASSETS_STORE);

        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));

        if (!store.indexNames.contains(ASSET_ORIGINAL_URL_INDEX)) {
          resolve(null);
          return;
        }

        const request = store.index(ASSET_ORIGINAL_URL_INDEX).get(normalizedOriginalUrl);
        request.onsuccess = () => resolve((request.result as StoredAssetRecord | undefined) ?? null);
        request.onerror = () => reject(request.error ?? new Error('Failed to read asset by original URL'));
      }),
  );
}

export function deleteAsset(id: string): Promise<void> {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete asset'));
  });
}

export function listAssets(): Promise<StoredAssetRecord[]> {
  return runTransaction<StoredAssetRecord[]>('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as StoredAssetRecord[] | undefined) ?? []);
    request.onerror = () => reject(request.error ?? new Error('Failed to list assets'));
  });
}

export function clearAssets(): Promise<void> {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to clear assets'));
  });
}

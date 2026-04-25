import {
  PERSISTENCE_ASSETS_STORE,
  PERSISTENCE_DB_NAME,
  PERSISTENCE_DB_VERSION,
  PERSISTENCE_JSON_STORE,
} from './storageKeys';

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

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Current browser does not support IndexedDB'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(PERSISTENCE_DB_NAME, PERSISTENCE_DB_VERSION);

      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PERSISTENCE_ASSETS_STORE)) {
          const store = db.createObjectStore(PERSISTENCE_ASSETS_STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('source', 'source', { unique: false });
        }
        if (!db.objectStoreNames.contains(PERSISTENCE_JSON_STORE)) {
          const jsonStore = db.createObjectStore(PERSISTENCE_JSON_STORE, { keyPath: 'key' });
          jsonStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
  }

  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  return openDb().then(
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

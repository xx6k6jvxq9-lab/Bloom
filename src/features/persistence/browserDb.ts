import { PERSISTENCE_ASSETS_STORE, PERSISTENCE_DB_NAME, PERSISTENCE_DB_VERSION } from './storageKeys';

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
    return Promise.reject(new Error('当前浏览器不支持 IndexedDB'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(PERSISTENCE_DB_NAME, PERSISTENCE_DB_VERSION);

      request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'));
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PERSISTENCE_ASSETS_STORE)) {
          const store = db.createObjectStore(PERSISTENCE_ASSETS_STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('source', 'source', { unique: false });
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

        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 事务失败'));
        executor(store, resolve, reject);
      }),
  );
}

export function putAsset(record: StoredAssetRecord): Promise<void> {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('资源写入失败'));
  });
}

export function getAsset(id: string): Promise<StoredAssetRecord | null> {
  return runTransaction<StoredAssetRecord | null>('readonly', (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as StoredAssetRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('资源读取失败'));
  });
}

export function deleteAsset(id: string): Promise<void> {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('资源删除失败'));
  });
}

export function listAssets(): Promise<StoredAssetRecord[]> {
  return runTransaction<StoredAssetRecord[]>('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as StoredAssetRecord[] | undefined) ?? []);
    request.onerror = () => reject(request.error ?? new Error('资源列表读取失败'));
  });
}

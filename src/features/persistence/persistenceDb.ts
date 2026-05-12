import {
  PERSISTENCE_ASSETS_STORE,
  PERSISTENCE_DB_NAME,
  PERSISTENCE_DB_VERSION,
  PERSISTENCE_JSON_STORE,
} from './storageKeys';

let dbPromise: Promise<IDBDatabase> | null = null;
const INDEXED_DB_OPEN_TIMEOUT_MS = 8000;
let persistenceDbUnavailableError: Error | null = null;

export function resetPersistenceDbState(): void {
  dbPromise = null;
  persistenceDbUnavailableError = null;
}

function ensurePersistenceStores(db: IDBDatabase, upgradeTransaction?: IDBTransaction | null) {
  const assetStore = db.objectStoreNames.contains(PERSISTENCE_ASSETS_STORE)
    ? upgradeTransaction?.objectStore(PERSISTENCE_ASSETS_STORE) ?? null
    : db.createObjectStore(PERSISTENCE_ASSETS_STORE, { keyPath: 'id' });

  if (assetStore && !assetStore.indexNames.contains('updatedAt')) {
    assetStore.createIndex('updatedAt', 'updatedAt', { unique: false });
  }

  if (assetStore && !assetStore.indexNames.contains('source')) {
    assetStore.createIndex('source', 'source', { unique: false });
  }

  if (assetStore && !assetStore.indexNames.contains('originalUrl')) {
    assetStore.createIndex('originalUrl', 'originalUrl', { unique: false });
  }

  const jsonStore = db.objectStoreNames.contains(PERSISTENCE_JSON_STORE)
    ? upgradeTransaction?.objectStore(PERSISTENCE_JSON_STORE) ?? null
    : db.createObjectStore(PERSISTENCE_JSON_STORE, { keyPath: 'key' });

  if (jsonStore && !jsonStore.indexNames.contains('updatedAt')) {
    jsonStore.createIndex('updatedAt', 'updatedAt', { unique: false });
  }
}

function hasRequiredStores(db: IDBDatabase): boolean {
  return db.objectStoreNames.contains(PERSISTENCE_ASSETS_STORE)
    && db.objectStoreNames.contains(PERSISTENCE_JSON_STORE);
}

function openDbAtVersion(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PERSISTENCE_DB_NAME, version);
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error('Opening IndexedDB timed out'));
    }, INDEXED_DB_OPEN_TIMEOUT_MS);

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      callback();
    };

    request.onerror = () => settle(() => reject(request.error ?? new Error('Failed to open IndexedDB')));
    request.onblocked = () => settle(() => reject(new Error('IndexedDB upgrade was blocked by another open tab')));
    request.onupgradeneeded = () => {
      ensurePersistenceStores(request.result, request.transaction);
    };
    request.onsuccess = () => settle(() => resolve(request.result));
  });
}

async function openPersistenceDbWithRecovery(): Promise<IDBDatabase> {
  const db = await openDbAtVersion(PERSISTENCE_DB_VERSION);

  if (hasRequiredStores(db)) {
    db.onversionchange = () => {
      db.close();
      dbPromise = null;
    };
    return db;
  }

  const recoveryVersion = db.version + 1;
  db.close();

  const recoveredDb = await openDbAtVersion(recoveryVersion);
  recoveredDb.onversionchange = () => {
    recoveredDb.close();
    dbPromise = null;
  };
  return recoveredDb;
}

export function openPersistenceDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Current browser does not support IndexedDB'));
  }

  if (persistenceDbUnavailableError) {
    return Promise.reject(persistenceDbUnavailableError);
  }

  if (!dbPromise) {
    dbPromise = openPersistenceDbWithRecovery().catch((error) => {
      persistenceDbUnavailableError = error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : 'IndexedDB is unavailable');
      dbPromise = null;
      throw persistenceDbUnavailableError;
    });
  }

  return dbPromise;
}

import {
  PERSISTENCE_ASSETS_STORE,
  PERSISTENCE_DB_NAME,
  PERSISTENCE_DB_VERSION,
  PERSISTENCE_JSON_STORE,
} from './storageKeys';

let dbPromise: Promise<IDBDatabase> | null = null;
const INDEXED_DB_OPEN_TIMEOUT_MS = 8000;
let persistenceDbUnavailableError: Error | null = null;

function ensurePersistenceStores(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(PERSISTENCE_ASSETS_STORE)) {
    const assetStore = db.createObjectStore(PERSISTENCE_ASSETS_STORE, { keyPath: 'id' });
    assetStore.createIndex('updatedAt', 'updatedAt', { unique: false });
    assetStore.createIndex('source', 'source', { unique: false });
  }

  if (!db.objectStoreNames.contains(PERSISTENCE_JSON_STORE)) {
    const jsonStore = db.createObjectStore(PERSISTENCE_JSON_STORE, { keyPath: 'key' });
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
      ensurePersistenceStores(request.result);
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

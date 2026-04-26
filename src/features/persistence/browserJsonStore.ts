import { PERSISTENCE_JSON_STORE } from './storageKeys';
import { openPersistenceDb } from './persistenceDb';

type JsonRecord = {
  key: string;
  value: unknown;
  updatedAt: number;
};

function runTransaction<T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  return openPersistenceDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(PERSISTENCE_JSON_STORE, mode);
        const store = tx.objectStore(PERSISTENCE_JSON_STORE);

        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
        executor(store, resolve, reject);
      }),
  );
}

export async function loadJsonRecord<T>(key: string): Promise<T | null> {
  return runTransaction<T | null>('readonly', (store, resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve((request.result as JsonRecord | undefined)?.value as T ?? null);
    request.onerror = () => reject(request.error ?? new Error(`Failed to read JSON record "${key}"`));
  });
}

export async function saveJsonRecord<T>(key: string, value: T): Promise<void> {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put({
      key,
      value,
      updatedAt: Date.now(),
    } satisfies JsonRecord);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed to write JSON record "${key}"`));
  });
}

export async function removeJsonRecord(key: string): Promise<void> {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete JSON record "${key}"`));
  });
}

export async function clearJsonRecords(): Promise<void> {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to clear IndexedDB JSON records'));
  });
}

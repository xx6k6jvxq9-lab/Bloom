import { listJsonRecordKeys, removeJsonRecord } from './browserJsonStore';
import { resetPersistenceDbState } from './persistenceDb';
import { STORAGE_KEYS } from './storageKeys';

type FakeRequest<T> = {
  result: T;
  error: Error | null;
  onsuccess: null | (() => void);
  onerror: null | (() => void);
  onblocked?: null | (() => void);
  onupgradeneeded?: null | (() => void);
};

type FakeStoreData = {
  records: Map<string, unknown>;
  indexes: Set<string>;
};

export class MemoryLocalStorage {
  private readonly store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

class FakeObjectStore {
  readonly indexNames = {
    contains: (name: string) => this.store.indexes.has(name),
  };

  constructor(private readonly store: FakeStoreData) {}

  createIndex(name: string) {
    this.store.indexes.add(name);
  }

  get(key: string) {
    const request: FakeRequest<unknown> = {
      result: undefined,
      error: null,
      onsuccess: null,
      onerror: null,
    };

    queueMicrotask(() => {
      request.result = this.store.records.get(key);
      request.onsuccess?.();
    });

    return request;
  }

  getAllKeys() {
    const request: FakeRequest<Array<string>> = {
      result: [],
      error: null,
      onsuccess: null,
      onerror: null,
    };

    queueMicrotask(() => {
      request.result = Array.from(this.store.records.keys());
      request.onsuccess?.();
    });

    return request;
  }

  getAll() {
    const request: FakeRequest<Array<unknown>> = {
      result: [],
      error: null,
      onsuccess: null,
      onerror: null,
    };

    queueMicrotask(() => {
      request.result = Array.from(this.store.records.values());
      request.onsuccess?.();
    });

    return request;
  }

  index(name: string) {
    return {
      get: (query: unknown) => {
        const request: FakeRequest<unknown> = {
          result: undefined,
          error: null,
          onsuccess: null,
          onerror: null,
        };

        queueMicrotask(() => {
          request.result = Array.from(this.store.records.values()).find((value) => (
            !!value
            && typeof value === 'object'
            && (value as Record<string, unknown>)[name] === query
          ));
          request.onsuccess?.();
        });

        return request;
      },
    };
  }

  put(record: Record<string, unknown>) {
    const request: FakeRequest<string> = {
      result: '',
      error: null,
      onsuccess: null,
      onerror: null,
    };

    queueMicrotask(() => {
      const recordKey = String(record.key ?? record.id ?? '');
      const storedRecord = typeof structuredClone === 'function'
        ? structuredClone(record)
        : JSON.parse(JSON.stringify(record));
      this.store.records.set(recordKey, storedRecord);
      request.result = recordKey;
      request.onsuccess?.();
    });

    return request;
  }

  delete(key: string) {
    const request: FakeRequest<undefined> = {
      result: undefined,
      error: null,
      onsuccess: null,
      onerror: null,
    };

    queueMicrotask(() => {
      this.store.records.delete(key);
      request.onsuccess?.();
    });

    return request;
  }

  clear() {
    const request: FakeRequest<undefined> = {
      result: undefined,
      error: null,
      onsuccess: null,
      onerror: null,
    };

    queueMicrotask(() => {
      this.store.records.clear();
      request.onsuccess?.();
    });

    return request;
  }
}

class FakeTransaction {
  error: Error | null = null;
  onerror: null | (() => void) = null;

  constructor(private readonly stores: Map<string, FakeStoreData>) {}

  objectStore(name: string) {
    const targetStore = this.stores.get(name);
    if (!targetStore) {
      throw new Error(`Missing fake object store: ${name}`);
    }

    return new FakeObjectStore(targetStore);
  }
}

class FakeDb {
  readonly stores = new Map<string, FakeStoreData>();
  readonly objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };
  onversionchange: null | (() => void) = null;

  constructor(public version: number) {}

  createObjectStore(name: string) {
    const storeData: FakeStoreData = {
      records: new Map<string, unknown>(),
      indexes: new Set<string>(),
    };
    this.stores.set(name, storeData);
    return new FakeObjectStore(storeData);
  }

  transaction(_name: string, _mode: IDBTransactionMode) {
    return new FakeTransaction(this.stores);
  }

  close() {}
}

class FakeIndexedDbFactory {
  private db: FakeDb | null = null;

  reset() {
    this.db = null;
  }

  open(_name: string, version: number) {
    const request: FakeRequest<FakeDb> = {
      result: undefined as unknown as FakeDb,
      error: null,
      onsuccess: null,
      onerror: null,
      onblocked: null,
      onupgradeneeded: null,
    };

    queueMicrotask(() => {
      const needsUpgrade = !this.db || version > this.db.version;
      if (!this.db) {
        this.db = new FakeDb(version);
      } else if (version > this.db.version) {
        this.db.version = version;
      }

      request.result = this.db;
      if (needsUpgrade) {
        request.onupgradeneeded?.();
      }
      request.onsuccess?.();
    });

    return request;
  }
}

export const fakeLocalStorage = new MemoryLocalStorage();
let fakeIndexedDb = new FakeIndexedDbFactory();

export function installPersistenceTestEnvironment() {
  fakeIndexedDb.reset();
  fakeIndexedDb = new FakeIndexedDbFactory();
  resetPersistenceDbState();
  Object.assign(globalThis, {
    indexedDB: fakeIndexedDb,
    window: {
      localStorage: fakeLocalStorage,
      setTimeout,
      clearTimeout,
    },
  });
}

export async function clearPersistenceKeys(keys: string[]) {
  fakeLocalStorage.clear();
  const expandedKeys = new Set(keys);

  if (keys.includes(STORAGE_KEYS.chatHistory)) {
    const [directShardKeys, groupShardKeys] = await Promise.all([
      listJsonRecordKeys(`${STORAGE_KEYS.chatHistory}:direct:`).catch(() => [] as string[]),
      listJsonRecordKeys(`${STORAGE_KEYS.chatHistory}:group:`).catch(() => [] as string[]),
    ]);

    for (const key of [...directShardKeys, ...groupShardKeys]) {
      expandedKeys.add(key);
    }
  }

  await Promise.all([...expandedKeys].map((key) => removeJsonRecord(key).catch(() => undefined)));
}

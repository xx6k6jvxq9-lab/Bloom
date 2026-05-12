import { removeJsonRecord } from './browserJsonStore';

type FakeRequest<T> = {
  result: T;
  error: Error | null;
  onsuccess: null | (() => void);
  onerror: null | (() => void);
  onblocked?: null | (() => void);
  onupgradeneeded?: null | (() => void);
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
  constructor(private readonly records: Map<string, unknown>) {}

  createIndex() {}

  get(key: string) {
    const request: FakeRequest<unknown> = {
      result: undefined,
      error: null,
      onsuccess: null,
      onerror: null,
    };

    queueMicrotask(() => {
      request.result = this.records.get(key);
      request.onsuccess?.();
    });

    return request;
  }

  put(record: { key: string; value: unknown; updatedAt: number }) {
    const request: FakeRequest<string> = {
      result: '',
      error: null,
      onsuccess: null,
      onerror: null,
    };

    queueMicrotask(() => {
      this.records.set(record.key, JSON.parse(JSON.stringify(record)));
      request.result = record.key;
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
      this.records.delete(key);
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
      this.records.clear();
      request.onsuccess?.();
    });

    return request;
  }
}

class FakeTransaction {
  error: Error | null = null;
  onerror: null | (() => void) = null;

  constructor(private readonly stores: Map<string, Map<string, unknown>>) {}

  objectStore(name: string) {
    const targetStore = this.stores.get(name);
    if (!targetStore) {
      throw new Error(`Missing fake object store: ${name}`);
    }

    return new FakeObjectStore(targetStore);
  }
}

class FakeDb {
  readonly stores = new Map<string, Map<string, unknown>>();
  readonly objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };
  onversionchange: null | (() => void) = null;

  constructor(public version: number) {}

  createObjectStore(name: string) {
    const records = new Map<string, unknown>();
    this.stores.set(name, records);
    return new FakeObjectStore(records);
  }

  transaction(_name: string, _mode: IDBTransactionMode) {
    return new FakeTransaction(this.stores);
  }

  close() {}
}

class FakeIndexedDbFactory {
  private db: FakeDb | null = null;

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
const fakeIndexedDb = new FakeIndexedDbFactory();

export function installPersistenceTestEnvironment() {
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
  await Promise.all(keys.map((key) => removeJsonRecord(key).catch(() => undefined)));
}

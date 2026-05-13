import assert from 'node:assert/strict';
import test from 'node:test';
import { openPersistenceDb, resetPersistenceDbState } from './persistenceDb';
import {
  PERSISTENCE_ASSETS_STORE,
  PERSISTENCE_DB_VERSION,
  PERSISTENCE_JSON_STORE,
} from './storageKeys';

class MockObjectStore {
  readonly indexNames = {
    contains: (_name: string) => false,
  };

  createIndex(): void {}
}

class MockDatabase {
  version: number;
  onversionchange: ((this: IDBDatabase, ev: Event) => unknown) | null = null;
  private readonly stores = new Set<string>();

  constructor(version: number, storeNames: string[] = []) {
    this.version = version;
    for (const storeName of storeNames) {
      this.stores.add(storeName);
    }
  }

  get objectStoreNames(): DOMStringList {
    const storeNames = this.stores;
    return {
      contains: (name: string) => storeNames.has(name),
      item: (index: number) => Array.from(storeNames)[index] ?? null,
      get length() {
        return storeNames.size;
      },
      [Symbol.iterator]: function* iterateStoreNames() {
        yield* storeNames;
      },
    } as DOMStringList;
  }

  close(): void {}

  createObjectStore(name: string): IDBObjectStore {
    this.stores.add(name);
    return new MockObjectStore() as unknown as IDBObjectStore;
  }

  get storeNames(): string[] {
    return Array.from(this.stores).sort();
  }
}

class MockOpenDbRequest {
  error: (Error & { name?: string }) | null = null;
  onsuccess: ((this: IDBOpenDBRequest, ev: Event) => unknown) | null = null;
  onerror: ((this: IDBOpenDBRequest, ev: Event) => unknown) | null = null;
  onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null = null;
  onblocked: ((this: IDBOpenDBRequest, ev: Event) => unknown) | null = null;
  result!: IDBDatabase;
  transaction: IDBTransaction | null = null;
}

class MockIndexedDbFactory {
  readonly openCalls: Array<number | undefined> = [];
  private db: MockDatabase | null;

  constructor(initialDb: { version: number; stores: string[] } | null) {
    this.db = initialDb ? new MockDatabase(initialDb.version, initialDb.stores) : null;
  }

  open(_name: string, version?: number): IDBOpenDBRequest {
    this.openCalls.push(version);
    const request = new MockOpenDbRequest();

    queueMicrotask(() => {
      if (this.db && typeof version === 'number' && version < this.db.version) {
        const error = new Error(
          `The requested version (${version}) is less than the existing version (${this.db.version}).`,
        ) as Error & { name?: string };
        error.name = 'VersionError';
        request.error = error;
        request.onerror?.call(request as unknown as IDBOpenDBRequest, {} as Event);
        return;
      }

      const didExist = this.db !== null;
      const previousVersion = this.db?.version ?? 0;
      const nextVersion = typeof version === 'number'
        ? version
        : this.db?.version ?? 1;

      if (!this.db) {
        this.db = new MockDatabase(nextVersion);
      } else if (nextVersion > this.db.version) {
        this.db.version = nextVersion;
      }

      request.result = this.db as unknown as IDBDatabase;

      const needsUpgrade = !didExist || nextVersion > previousVersion;
      if (needsUpgrade) {
        request.onupgradeneeded?.call(request as unknown as IDBOpenDBRequest, {} as IDBVersionChangeEvent);
      }

      request.onsuccess?.call(request as unknown as IDBOpenDBRequest, {} as Event);
    });

    return request as unknown as IDBOpenDBRequest;
  }

  get currentDb(): MockDatabase | null {
    return this.db;
  }
}

function installMockBrowserEnvironment(indexedDb: MockIndexedDbFactory) {
  const globalWithWindow = globalThis as typeof globalThis & {
    indexedDB?: IDBFactory;
    window?: Window & typeof globalThis;
  };

  const previousIndexedDb = globalWithWindow.indexedDB;
  const previousWindow = globalWithWindow.window;

  globalWithWindow.indexedDB = indexedDb as unknown as IDBFactory;
  globalWithWindow.window = {
    ...(previousWindow ?? globalThis),
    setTimeout,
    clearTimeout,
  } as Window & typeof globalThis;

  return () => {
    resetPersistenceDbState();

    if (previousIndexedDb) {
      globalWithWindow.indexedDB = previousIndexedDb;
    } else {
      delete globalWithWindow.indexedDB;
    }

    if (previousWindow) {
      globalWithWindow.window = previousWindow;
    } else {
      delete globalWithWindow.window;
    }
  };
}

test('openPersistenceDb reuses a newer existing IndexedDB version instead of failing with VersionError', async () => {
  resetPersistenceDbState();
  const indexedDb = new MockIndexedDbFactory({
    version: PERSISTENCE_DB_VERSION + 2,
    stores: [PERSISTENCE_ASSETS_STORE, PERSISTENCE_JSON_STORE],
  });
  const restoreEnvironment = installMockBrowserEnvironment(indexedDb);

  try {
    const db = await openPersistenceDb();

    assert.equal(db.version, PERSISTENCE_DB_VERSION + 2);
    assert.deepEqual(indexedDb.openCalls, [PERSISTENCE_DB_VERSION, undefined]);
    assert.deepEqual(indexedDb.currentDb?.storeNames, [PERSISTENCE_ASSETS_STORE, PERSISTENCE_JSON_STORE]);
  } finally {
    restoreEnvironment();
  }
});

test('openPersistenceDb upgrades the database when the current version is missing required stores', async () => {
  resetPersistenceDbState();
  const indexedDb = new MockIndexedDbFactory({
    version: PERSISTENCE_DB_VERSION,
    stores: [PERSISTENCE_ASSETS_STORE],
  });
  const restoreEnvironment = installMockBrowserEnvironment(indexedDb);

  try {
    const db = await openPersistenceDb();

    assert.equal(db.version, PERSISTENCE_DB_VERSION + 1);
    assert.deepEqual(indexedDb.openCalls, [PERSISTENCE_DB_VERSION, PERSISTENCE_DB_VERSION + 1]);
    assert.deepEqual(indexedDb.currentDb?.storeNames, [PERSISTENCE_ASSETS_STORE, PERSISTENCE_JSON_STORE]);
  } finally {
    restoreEnvironment();
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadJsonRecord, saveJsonRecord } from './browserJsonStore';
import {
  loadPreferredChatHistoryRecords,
  resetChatHistoryRecords,
  saveChatHistoryRecords,
  type PersistedChatHistoryData,
} from './chatHistoryStore';
import { STORAGE_KEYS } from './storageKeys';
import {
  clearPersistenceKeys,
  fakeLocalStorage,
  installPersistenceTestEnvironment,
} from './testPersistenceHarness';

function buildHistoryValue(text: string, timestamp: number): PersistedChatHistoryData {
  return {
    directHistory: {
      'char-a': [
        {
          role: 'model',
          text,
          timestamp,
        },
      ],
    },
    directRelationshipWaves: {},
    directFactTraces: {},
    groupSessions: {},
  };
}

async function clearChatHistoryState() {
  resetChatHistoryRecords();
  await clearPersistenceKeys([STORAGE_KEYS.chatHistory]);
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  await clearChatHistoryState();
});

test('loadPreferredChatHistoryRecords migrates legacy localStorage chat history into IndexedDB', async () => {
  const legacyHistory = buildHistoryValue('legacy hello', 101);
  fakeLocalStorage.setItem(STORAGE_KEYS.chatHistory, JSON.stringify(legacyHistory));

  const hydrated = await loadPreferredChatHistoryRecords();
  const persisted = await loadJsonRecord<PersistedChatHistoryData>(STORAGE_KEYS.chatHistory);

  assert.equal(hydrated.directHistory['char-a']?.[0]?.text, 'legacy hello');
  assert.equal(persisted?.directHistory['char-a']?.[0]?.text, 'legacy hello');
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.chatHistory), null);
});

test('saveChatHistoryRecords only writes chatHistory into IndexedDB', async () => {
  const nextHistory = buildHistoryValue('idb only', 202);

  await saveChatHistoryRecords(nextHistory);

  const persisted = await loadJsonRecord<PersistedChatHistoryData>(STORAGE_KEYS.chatHistory);

  assert.equal(persisted?.directHistory['char-a']?.[0]?.text, 'idb only');
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.chatHistory), null);
});

test('loadPreferredChatHistoryRecords prefers IndexedDB and clears stale localStorage copies', async () => {
  const indexedDbHistory = buildHistoryValue('fresh from idb', 303);
  const staleLocalHistory = buildHistoryValue('stale local', 99);

  await saveChatHistoryRecords(indexedDbHistory);
  fakeLocalStorage.setItem(STORAGE_KEYS.chatHistory, JSON.stringify(staleLocalHistory));

  const hydrated = await loadPreferredChatHistoryRecords();

  assert.equal(hydrated.directHistory['char-a']?.[0]?.text, 'fresh from idb');
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.chatHistory), null);
});

test('loadPreferredChatHistoryRecords prefers newer local snapshots over stale IndexedDB data', async () => {
  const futureTimestamp = Date.now() + 10_000;
  const indexedDbHistory = {
    ...buildHistoryValue('older idb', 111),
    updatedAt: 111,
  };
  const newerLocalHistory = {
    ...buildHistoryValue('newer local', 222),
    updatedAt: futureTimestamp,
  };

  await saveJsonRecord(STORAGE_KEYS.chatHistory, indexedDbHistory);
  fakeLocalStorage.setItem(STORAGE_KEYS.chatHistory, JSON.stringify(newerLocalHistory));

  const hydrated = await loadPreferredChatHistoryRecords();
  const persisted = await loadJsonRecord<PersistedChatHistoryData>(STORAGE_KEYS.chatHistory);

  assert.equal(hydrated.directHistory['char-a']?.[0]?.text, 'newer local');
  assert.equal(persisted?.directHistory['char-a']?.[0]?.text, 'newer local');
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.chatHistory), null);
});

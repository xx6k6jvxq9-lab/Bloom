import assert from 'node:assert/strict';
import test from 'node:test';
import { listJsonRecordKeys, loadJsonRecord, saveJsonRecord } from './browserJsonStore';
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
import { appendSnapshotMemoryRecord } from '../../services/memory/memoryRecordSnapshots';

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
    directSessionMetadata: {},
    directRelationshipWaves: {},
    directFactTraces: {},
    groupSessions: {},
  };
}

async function clearChatHistoryState() {
  resetChatHistoryRecords();
  await clearPersistenceKeys([STORAGE_KEYS.chatHistory, STORAGE_KEYS.memoryRecords]);
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  await clearChatHistoryState();
});

test('loadPreferredChatHistoryRecords migrates legacy localStorage chat history into IndexedDB', async () => {
  const legacyHistory = buildHistoryValue('legacy hello', 101);
  fakeLocalStorage.setItem(STORAGE_KEYS.chatHistory, JSON.stringify(legacyHistory));

  const hydrated = await loadPreferredChatHistoryRecords();
  const persistedIndex = await loadJsonRecord<Record<string, unknown>>(STORAGE_KEYS.chatHistory);
  const persistedDirectSession = await loadJsonRecord<{ history?: Array<{ text?: string }> }>(
    `${STORAGE_KEYS.chatHistory}:direct:char-a`,
  );
  const memoryRecordShardKeys = await listJsonRecordKeys(`${STORAGE_KEYS.memoryRecords}:character:`);

  assert.equal(hydrated.directHistory['char-a']?.[0]?.text, 'legacy hello');
  assert.equal(persistedDirectSession?.history?.[0]?.text, 'legacy hello');
  assert.equal(Array.isArray(persistedIndex?.directSessionIds), true);
  assert.deepEqual(memoryRecordShardKeys, []);
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.chatHistory), null);
});

test('saveChatHistoryRecords writes sharded chat sessions into IndexedDB', async () => {
  const nextHistory = buildHistoryValue('idb only', 202);

  await saveChatHistoryRecords(nextHistory);

  const persistedIndex = await loadJsonRecord<Record<string, unknown>>(STORAGE_KEYS.chatHistory);
  const persistedDirectSession = await loadJsonRecord<{ history?: Array<{ text?: string }> }>(
    `${STORAGE_KEYS.chatHistory}:direct:char-a`,
  );
  const persistedMemoryRecordIndex = await loadJsonRecord<{ characterIds?: string[] }>(STORAGE_KEYS.memoryRecords);
  const memoryRecordShardKeys = await listJsonRecordKeys(`${STORAGE_KEYS.memoryRecords}:character:`);
  const shardKeys = await listJsonRecordKeys(`${STORAGE_KEYS.chatHistory}:direct:`);

  assert.equal(Array.isArray(persistedIndex?.directSessionIds), true);
  assert.equal(persistedDirectSession?.history?.[0]?.text, 'idb only');
  assert.equal(Array.isArray(persistedMemoryRecordIndex?.characterIds), true);
  assert.deepEqual(memoryRecordShardKeys, []);
  assert.deepEqual(shardKeys, [`${STORAGE_KEYS.chatHistory}:direct:char-a`]);
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.chatHistory), null);
});

test('saveChatHistoryRecords keeps direct-session lastViewed metadata inside chat shards', async () => {
  const nextHistory = {
    ...buildHistoryValue('remember view state', 404),
    directSessionMetadata: {
      'char-a': {
        lastViewedMessageTimestamp: 401,
      },
    },
  } satisfies PersistedChatHistoryData;

  await saveChatHistoryRecords(nextHistory);

  const persistedDirectSession = await loadJsonRecord<{
    history?: Array<{ text?: string }>;
    lastViewedMessageTimestamp?: number;
  }>(`${STORAGE_KEYS.chatHistory}:direct:char-a`);

  assert.equal(persistedDirectSession?.history?.[0]?.text, 'remember view state');
  assert.equal(persistedDirectSession?.lastViewedMessageTimestamp, 401);
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
  const persistedDirectSession = await loadJsonRecord<{ history?: Array<{ text?: string }> }>(
    `${STORAGE_KEYS.chatHistory}:direct:char-a`,
  );

  assert.equal(hydrated.directHistory['char-a']?.[0]?.text, 'newer local');
  assert.equal(persistedDirectSession?.history?.[0]?.text, 'newer local');
  assert.equal(fakeLocalStorage.getItem(STORAGE_KEYS.chatHistory), null);
});

test('saveChatHistoryRecords also writes derived memory records from fact traces', async () => {
  const nextHistory: PersistedChatHistoryData = {
    updatedAt: 999,
    directHistory: {
      'char-a': [
        {
          role: 'model',
          text: '我最近总想喝热可可',
          timestamp: 999,
        },
      ],
    },
    directSessionMetadata: {},
    directRelationshipWaves: {},
    directFactTraces: {
      'char-a': [
        {
          sourceScene: 'direct_chat',
          factType: 'preference',
          subjectType: 'character',
          subjectId: 'char-a',
          relatedCharacterIds: ['char-a'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          confidence: 'explicit',
          summary: '最近喜欢热可可',
          timestamp: 999,
          decayHint: 'medium',
        },
      ],
    },
    groupSessions: {},
  };

  await saveChatHistoryRecords(nextHistory);

  const persistedMemoryRecordIndex = await loadJsonRecord<{ characterIds?: string[] }>(STORAGE_KEYS.memoryRecords);
  const persistedMemoryRecordShard = await loadJsonRecord<
    Array<{ kind?: string; factType?: string; summary?: string }>
  >(`${STORAGE_KEYS.memoryRecords}:character:char-a`);

  assert.deepEqual(persistedMemoryRecordIndex?.characterIds, ['char-a']);
  assert.equal(persistedMemoryRecordShard?.[0]?.kind, 'fact');
  assert.equal(persistedMemoryRecordShard?.[0]?.factType, 'preference');
  assert.equal(persistedMemoryRecordShard?.[0]?.summary, '最近喜欢热可可');
});

test('saveChatHistoryRecords preserves snapshot records while refreshing derived evidence', async () => {
  await appendSnapshotMemoryRecord({
    characterId: 'char-a',
    snapshotType: 'short_term_summary',
    text: '刚总结过一版短期状态',
    sourceScene: 'direct_chat',
    timestamp: 777,
  });

  await saveChatHistoryRecords({
    updatedAt: 999,
    directHistory: {
      'char-a': [
        {
          role: 'model',
          text: '最近喜欢热可可',
          timestamp: 999,
        },
      ],
    },
    directSessionMetadata: {},
    directRelationshipWaves: {},
    directFactTraces: {
      'char-a': [
        {
          sourceScene: 'direct_chat',
          factType: 'preference',
          subjectType: 'character',
          subjectId: 'char-a',
          relatedCharacterIds: ['char-a'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          confidence: 'explicit',
          summary: '最近喜欢热可可',
          timestamp: 999,
          decayHint: 'medium',
        },
      ],
    },
    groupSessions: {},
  });

  const persistedMemoryRecordShard = await loadJsonRecord<
    Array<{ kind?: string; snapshotType?: string; summary?: string }>
  >(`${STORAGE_KEYS.memoryRecords}:character:char-a`);

  assert.equal(
    persistedMemoryRecordShard?.some((record) => (
      record.kind === 'snapshot' && record.snapshotType === 'short_term_summary'
    )),
    true,
  );
  assert.equal(
    persistedMemoryRecordShard?.some((record) => (
      record.kind === 'fact' && record.summary === '最近喜欢热可可'
    )),
    true,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMemoryRecordData, resetMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import {
  appendLibraryMemoryEntriesAsRecords,
  appendSnapshotMemoryRecord,
  appendWorkingMemorySnapshots,
  projectMemoryLibraryEntriesFromRecords,
  removeMemoryRecordById,
} from './memoryRecordSnapshots';

async function clearSnapshotMemoryState() {
  resetMemoryRecordData();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  await clearSnapshotMemoryState();
});

test('appendSnapshotMemoryRecord projects snapshot records into library entries', async () => {
  await appendSnapshotMemoryRecord({
    characterId: 'char-snapshot',
    snapshotType: 'long_term_profile',
    text: '会记住你怕冷，也会在意你嘴硬时的真实情绪。',
    sourceScene: 'direct_chat',
    timestamp: 1_700_000_000_000,
  });

  const records = loadMemoryRecordData({
    recordsByCharacterId: {},
  }).recordsByCharacterId['char-snapshot'] || [];
  const projectedEntries = projectMemoryLibraryEntriesFromRecords({
    characterId: 'char-snapshot',
    kind: 'long-term',
    records,
  });

  assert.equal(records[0]?.kind, 'snapshot');
  assert.equal(projectedEntries[0]?.kind, 'long-term');
  assert.equal(projectedEntries[0]?.content, '会记住你怕冷，也会在意你嘴硬时的真实情绪。');
});

test('appendSnapshotMemoryRecord dedupes identical snapshots for the same character', async () => {
  await appendSnapshotMemoryRecord({
    characterId: 'char-snapshot',
    snapshotType: 'short_term_summary',
    text: '刚聊完还有点顶着，语气需要收一下。',
    sourceScene: 'direct_chat',
    timestamp: 101,
  });
  await appendSnapshotMemoryRecord({
    characterId: 'char-snapshot',
    snapshotType: 'short_term_summary',
    text: '刚聊完还有点顶着，语气需要收一下。',
    sourceScene: 'direct_chat',
    timestamp: 202,
  });

  const records = loadMemoryRecordData({
    recordsByCharacterId: {},
  }).recordsByCharacterId['char-snapshot'] || [];

  assert.equal(records.length, 1);
  assert.equal(records[0]?.kind, 'snapshot');
});

test('removeMemoryRecordById deletes projected snapshot entries', async () => {
  await appendSnapshotMemoryRecord({
    characterId: 'char-snapshot',
    snapshotType: 'short_term_summary',
    text: '还有一条待继续的话题挂着。',
    sourceScene: 'direct_chat',
    timestamp: 303,
  });

  const recordId = loadMemoryRecordData({
    recordsByCharacterId: {},
  }).recordsByCharacterId['char-snapshot']?.[0]?.id;

  assert.ok(recordId);

  await removeMemoryRecordById({
    characterId: 'char-snapshot',
    recordId: recordId!,
  });

  const records = loadMemoryRecordData({
    recordsByCharacterId: {},
  }).recordsByCharacterId['char-snapshot'] || [];

  assert.equal(records.length, 0);
});

test('appendLibraryMemoryEntriesAsRecords stores imported notes in memoryRecords and projects them into the library view', async () => {
  await appendLibraryMemoryEntriesAsRecords({
    characterId: 'char-snapshot',
    entries: [
      {
        id: 'legacy-entry-1',
        kind: 'short-term',
        source: 'manual',
        content: '这段是导入进来的短期记忆。',
        createdAt: 1_700_000_000_111,
        year: 2023,
        month: 11,
        day: 14,
        hour: 8,
        minute: 20,
        charCount: '这段是导入进来的短期记忆。'.length,
      },
      {
        id: 'legacy-entry-2',
        kind: 'long-term',
        source: 'manual',
        content: '这段是导入进来的长期画像。',
        createdAt: 1_700_000_000_222,
        year: 2023,
        month: 11,
        day: 14,
        hour: 8,
        minute: 21,
        charCount: '这段是导入进来的长期画像。'.length,
      },
    ],
  });

  const records = loadMemoryRecordData({
    recordsByCharacterId: {},
  }).recordsByCharacterId['char-snapshot'] || [];
  const shortTermEntries = projectMemoryLibraryEntriesFromRecords({
    characterId: 'char-snapshot',
    kind: 'short-term',
    records,
  });
  const longTermEntries = projectMemoryLibraryEntriesFromRecords({
    characterId: 'char-snapshot',
    kind: 'long-term',
    records,
  });

  assert.equal(records.some((record) => record.kind === 'note'), true);
  assert.equal(shortTermEntries[0]?.content, '这段是导入进来的短期记忆。');
  assert.equal(longTermEntries[0]?.content, '这段是导入进来的长期画像。');
});

test('appendWorkingMemorySnapshots stores both short-term and shared-state snapshots for a settlement', async () => {
  await appendWorkingMemorySnapshots({
    characterId: 'char-snapshot',
    sourceScene: 'forum',
    shortTermSummary: '刚在论坛里留下一点关系余波。',
    sharedState: {
      updatedAt: 1_700_000_000_333,
      sourceScene: 'forum',
      availability: 'recent',
      resumeTone: 'soft_return',
      currentActivity: '刚从论坛切回私聊视角',
      attentionNote: '说话会先试探一下气氛',
      publicCarryover: '论坛里的互动刚让气氛近了一点',
    },
    timestamp: 1_700_000_000_333,
  });

  const records = loadMemoryRecordData({
    recordsByCharacterId: {},
  }).recordsByCharacterId['char-snapshot'] || [];

  assert.equal(
    records.some((record) => record.kind === 'snapshot' && record.snapshotType === 'short_term_summary'),
    true,
  );
  assert.equal(
    records.some((record) => record.kind === 'snapshot' && record.snapshotType === 'shared_state'),
    true,
  );
});

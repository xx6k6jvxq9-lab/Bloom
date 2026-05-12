import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAutoLongTermRefreshPlan } from './autoLongTermRefreshPlan';
import type { MemoryRecord } from './memoryRecordTypes';

test('buildAutoLongTermRefreshPlan can read projected entries from memoryRecords', () => {
  const records: MemoryRecord[] = [
    {
      id: 'short-note-1',
      kind: 'snapshot',
      snapshotType: 'short_term_summary',
      text: '最近气氛有点绷着，需要慢一点接。',
      sourceScene: 'direct_chat',
      sourceSessionType: 'direct',
      sourceSessionId: 'char-auto',
      sourceEventIds: [],
      characterIds: ['char-auto'],
      visibility: 'cross_scene_readable',
      stability: 'temporary',
      decayHint: 'short',
      summary: '最近气氛有点绷着，需要慢一点接。',
      timestamp: new Date('2026-05-10T08:00:00+08:00').getTime(),
    },
    {
      id: 'short-note-2',
      kind: 'snapshot',
      snapshotType: 'short_term_summary',
      text: '边界还在，开口前会先试探一下气氛。',
      sourceScene: 'direct_chat',
      sourceSessionType: 'direct',
      sourceSessionId: 'char-auto',
      sourceEventIds: [],
      characterIds: ['char-auto'],
      visibility: 'cross_scene_readable',
      stability: 'temporary',
      decayHint: 'short',
      summary: '边界还在，开口前会先试探一下气氛。',
      timestamp: new Date('2026-05-11T08:00:00+08:00').getTime(),
    },
    {
      id: 'short-note-3',
      kind: 'snapshot',
      snapshotType: 'short_term_summary',
      text: '短期余波：最近会反复想起你那句关心。',
      sourceScene: 'direct_chat',
      sourceSessionType: 'direct',
      sourceSessionId: 'char-auto',
      sourceEventIds: [],
      characterIds: ['char-auto'],
      visibility: 'cross_scene_readable',
      stability: 'temporary',
      decayHint: 'short',
      summary: '短期余波：最近会反复想起你那句关心。',
      timestamp: new Date('2026-05-12T08:00:00+08:00').getTime(),
    },
  ];

  const plan = buildAutoLongTermRefreshPlan({
    characterId: 'char-auto',
    memoryRecords: records,
    latestShortTermSummary: '最近几轮的关系余波还在，开口前会先试探气氛，也会反复想起你那句关心。',
    autoLongTermMinShortTermEntries: 2,
    autoLongTermMinDaySpan: 2,
  });

  assert.equal(plan.shouldRefresh, true);
  assert.equal(plan.pendingShortTermEntryCount, 3);
  assert.equal(plan.pendingShortTermDaySpan, 3);
});

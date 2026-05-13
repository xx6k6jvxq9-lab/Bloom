import assert from 'node:assert/strict';
import test from 'node:test';
import { resetMemoryRecordData, saveMemoryRecordData } from '../persistence/memoryRecordStore';
import { STORAGE_KEYS } from '../persistence/storageKeys';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../persistence/testPersistenceHarness';
import { applyRelationshipRecoveryContext } from './relationshipRecoveryContext';

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  resetMemoryRecordData();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
});

test('applyRelationshipRecoveryContext appends a reconnect recovery fact without duplicating previous recovery lines', () => {
  const summary = applyRelationshipRecoveryContext({
    shortTermSummary: [
      '当前气氛：最近聊天重新热起来了。',
      '短期余波：你们刚从拉黑状态里重新开了口，关系门刚重新打开。',
    ].join('\n'),
  }, 'reconnect_accepted');

  assert.equal(summary?.includes('当前气氛：最近聊天重新热起来了。'), true);
  assert.equal(summary?.includes('短期余波：你们刚重新恢复联系，这次恢复前经历过一轮关系波动。'), true);
  assert.equal(summary?.includes('短期余波：你们刚从拉黑状态里重新开了口，关系门刚重新打开。'), false);
});

test('applyRelationshipRecoveryContext can write an unblock background fact onto an empty summary', () => {
  const summary = applyRelationshipRecoveryContext({
    shortTermSummary: '',
  }, 'unblocked');

  assert.equal(summary, '短期余波：你们刚从拉黑状态里重新开了口，关系门刚重新打开。');
});

test('applyRelationshipRecoveryContext prefers record-derived short-term summary when character id is available', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      alpha: [
        {
          id: 'scene-progress-alpha',
          kind: 'scene_progress',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'alpha',
          sourceEventIds: [],
          characterIds: ['alpha'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'record-derived scene progress summary',
          timestamp: now - 200,
          stageLabel: 'close distance stage',
          repeatedSignature: false,
          completedActions: ['close distance'],
          bannedRepeatActions: [],
          nextStepOptions: [],
        },
      ],
    },
  });

  const summary = applyRelationshipRecoveryContext({
    id: 'alpha',
    shortTermSummary: 'legacy short term summary',
  }, 'reconnect_accepted');

  assert.equal(summary?.includes('record-derived scene progress summary'), true);
  assert.equal(summary?.includes('legacy short term summary'), false);
});

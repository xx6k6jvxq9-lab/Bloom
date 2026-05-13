import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRelationshipRecoveryContext } from './relationshipRecoveryContext';

test('applyRelationshipRecoveryContext appends a reconnect recovery fact without duplicating previous recovery lines', () => {
  const summary = applyRelationshipRecoveryContext({
    shortTermSummary: [
      '当前气氛：最近聊天重新热起来了。',
      '短期余波：你们刚从拉黑状态里重新开了口，关系门刚重新打开。',
    ].join('\n'),
  }, 'reconnect_accepted');

  assert.equal(summary?.includes('当前气氛：最近聊天重新热起来了。'), true);
  assert.equal(summary?.includes('你们刚重新恢复联系，这次恢复前经历过一轮关系波动。'), true);
  assert.equal(summary?.includes('你们刚从拉黑状态里重新开了口，关系门刚重新打开。'), false);
});

test('applyRelationshipRecoveryContext can write an unblock background fact onto an empty summary', () => {
  const summary = applyRelationshipRecoveryContext({
    shortTermSummary: '',
  }, 'unblocked');

  assert.equal(summary, '短期余波：你们刚从拉黑状态里重新开了口，关系门刚重新打开。');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyDirectTransferBridge,
  type DirectCharacterDecision,
} from './directCharacterDecision';
import type { DirectUserIntentAnalysis } from './intentAnalysis';

function createIntentAnalysis(
  overrides: Partial<DirectUserIntentAnalysis> = {},
): DirectUserIntentAnalysis {
  return {
    primaryIntent: 'resource_request',
    secondaryIntent: null,
    actionIntent: 'request_transfer',
    emotionTone: 'testing',
    confidence: 'high',
    cues: ['用户在索要转账。'],
    ...overrides,
  };
}

function createDecision(
  overrides: Partial<DirectCharacterDecision> = {},
): DirectCharacterDecision {
  return {
    relationshipCloseness: 'high',
    closenessScore: 84,
    actionStyle: 'indulgent',
    actionBiasScore: 22,
    transferDisposition: 'lean_grant',
    transferReadiness: 86,
    suggestedApproach: '先按自己的方式回应，再把动作落地。',
    cues: ['角色更可能真的给。'],
    requestedAmount: 88,
    ...overrides,
  };
}

test('applyDirectTransferBridge appends transfer protocol for an explicit grant reply', () => {
  const replyText = applyDirectTransferBridge({
    replyText: '行，发过去了，收着。',
    intentAnalysis: createIntentAnalysis(),
    decision: createDecision(),
  });

  assert.equal(replyText, '行，发过去了，收着。\n[transfer]88.00[/transfer]');
});

test('applyDirectTransferBridge does not append transfer protocol when the reply clearly refuses', () => {
  const replyText = applyDirectTransferBridge({
    replyText: '这次不行，别想了。',
    intentAnalysis: createIntentAnalysis(),
    decision: createDecision(),
  });

  assert.equal(replyText, '这次不行，别想了。');
});

test('applyDirectTransferBridge does not append transfer protocol when the reply tells the user to keep the money', () => {
  const replyText = applyDirectTransferBridge({
    replyText: '钱你自己留着，下午来公司把小饼干带好就行。',
    intentAnalysis: createIntentAnalysis(),
    decision: createDecision(),
  });

  assert.equal(replyText, '钱你自己留着，下午来公司把小饼干带好就行。');
});

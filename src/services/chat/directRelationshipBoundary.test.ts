import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, ChatMessage } from '../../types';
import type { DirectCharacterDecision } from './directCharacterDecision';
import { analyzeDirectRelationshipBoundary } from './directRelationshipBoundary';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: '',
    ...overrides,
  } as Character;
}

function createDecision(overrides: Partial<DirectCharacterDecision> = {}): DirectCharacterDecision {
  return {
    relationshipCloseness: 'medium',
    closenessScore: 52,
    actionStyle: 'steady',
    actionBiasScore: 0,
    transferDisposition: 'ignore',
    transferReadiness: 0,
    suggestedApproach: '',
    cues: [],
    requestedAmount: null,
    ...overrides,
  };
}

function createMessage(role: 'user' | 'model', text: string): ChatMessage {
  return {
    role,
    text,
    timestamp: Date.now(),
  };
}

test('direct relationship boundary escalates to block when a guarded character is repeatedly abused', () => {
  const character = createCharacter({
    openingRemark: '边界感强，不会惯着人，克制但记仇。',
  });
  const result = analyzeDirectRelationshipBoundary({
    character,
    messages: [
      createMessage('model', '别再用这种语气跟我说话。'),
      createMessage('user', '你少管我。'),
      createMessage('user', '滚远点，闭嘴，别来恶心我。'),
    ],
    intentAnalysis: null,
    directCharacterDecision: createDecision({
      relationshipCloseness: 'low',
      closenessScore: 24,
      actionStyle: 'guarded',
      actionBiasScore: -12,
    }),
  });

  assert.equal(result.suggestedDecision, 'block');
  assert.deepEqual(result.allowedDecisions, ['warn', 'block']);
  assert.equal(result.risk, 'critical');
});

test('direct relationship boundary prefers warn before block for a tsundere character in a live argument', () => {
  const character = createCharacter({
    openingRemark: '嘴硬，别扭，容易先炸毛，但不是真的轻易翻脸。',
  });
  const result = analyzeDirectRelationshipBoundary({
    character,
    messages: [
      createMessage('model', '你先冷静一点。'),
      createMessage('user', '你少管我，别再这么跟我说话。'),
    ],
    intentAnalysis: null,
    directCharacterDecision: createDecision({
      relationshipCloseness: 'medium',
      closenessScore: 58,
      actionStyle: 'tsundere',
      actionBiasScore: 8,
    }),
  });

  assert.equal(result.suggestedDecision, 'warn');
  assert.deepEqual(result.allowedDecisions, ['none', 'warn']);
  assert.equal(result.risk, 'high');
});

test('direct relationship boundary stays below relationship escalation for a warm character when the user softens', () => {
  const character = createCharacter({
    openingRemark: '温柔，心软，很在乎对方，舍不得轻易断掉。',
  });
  const result = analyzeDirectRelationshipBoundary({
    character,
    messages: [
      createMessage('user', '我刚才有点上头了，对不起，你别逼我了。'),
    ],
    intentAnalysis: null,
    directCharacterDecision: createDecision({
      relationshipCloseness: 'high',
      closenessScore: 82,
      actionStyle: 'indulgent',
      actionBiasScore: 18,
    }),
  });

  assert.equal(result.suggestedDecision, 'none');
  assert.deepEqual(result.allowedDecisions, ['none']);
});

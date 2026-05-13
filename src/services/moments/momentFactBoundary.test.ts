import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import {
  buildMomentFactBoundary,
  softlyCorrectMomentFactBoundaryDelta,
  validateMomentFactBoundaryDelta,
} from './momentFactBoundary';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: '',
    postFrequency: 'medium',
    ...overrides,
  } as Character;
}

test('fact boundary exposes source priority and controlled expansion rules', () => {
  const boundary = buildMomentFactBoundary({
    character: createCharacter({
      sharedState: {
        updatedAt: Date.now(),
        sourceScene: 'direct_chat',
        availability: 'recent',
        currentActivity: '刚聊完，正在擦镜子。',
        publicCarryover: '情绪还没完全落下去。',
      },
    }),
    mode: 'relationship_carryover',
  });

  assert.equal(
    boundary.promptLines.some((line) => line.includes('事实来源优先级')),
    true,
  );
  assert.equal(
    boundary.promptLines.some((line) => line.includes('模糊的“朋友/熟人/有人”')),
    true,
  );
});

test('unsupported structural workline is flagged but generic friend mention can pass', () => {
  const boundary = buildMomentFactBoundary({
    character: createCharacter({
      sharedState: {
        updatedAt: Date.now(),
        sourceScene: 'moments',
        availability: 'recent',
        currentActivity: '今晚只是有点累。',
      },
    }),
    mode: 'self_life',
  });

  const blocked = validateMomentFactBoundaryDelta({
    content: '下班刚到公司楼下，同事还在群里催我回消息。',
    boundary,
  });
  const allowed = validateMomentFactBoundaryDelta({
    content: '跟一个朋友吃了顿饭，没展开聊太多。',
    boundary,
  });

  assert.equal(Boolean(blocked), true);
  assert.equal(blocked?.blockedCategories.includes('workline'), true);
  assert.equal(blocked?.blockedCategories.includes('stable_supporting_cast'), true);
  assert.equal(allowed, null);
});

test('supported workline from persona is allowed to continue naturally', () => {
  const boundary = buildMomentFactBoundary({
    character: createCharacter({
      corePersona: '大四学生，最近在律所实习，回消息总是慢半拍。',
    }),
    mode: 'self_life',
  });

  const result = validateMomentFactBoundaryDelta({
    content: '下班路上风有点大，工位上的消息先不看了。',
    boundary,
  });

  assert.equal(result, null);
});

test('soft correction weakens unsupported stable facts before asking for a full rewrite', () => {
  const boundary = buildMomentFactBoundary({
    character: createCharacter({
      sharedState: {
        updatedAt: Date.now(),
        sourceScene: 'moments',
        availability: 'recent',
        currentActivity: '今天风有点大。',
      },
    }),
    mode: 'self_life',
  });

  const softened = softlyCorrectMomentFactBoundaryDelta({
    content: '下班刚到公司楼下，同事还在群里催我回消息。',
    boundary,
  });

  assert.equal(softened.strategy === 'softened' || softened.strategy === 'trimmed', true);
  assert.equal(softened.content.includes('有人'), true);
  assert.equal(softened.content.includes('公司'), false);
  assert.equal(validateMomentFactBoundaryDelta({
    content: softened.content,
    boundary,
  }), null);
});

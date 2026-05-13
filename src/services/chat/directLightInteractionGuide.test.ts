import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, ChatMessage } from '../../types';
import { buildDirectPokeBehaviorGuide } from './directLightInteractionGuide';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: '小悟',
    occupation: '学生',
    avatar: '',
    ...overrides,
  } as Character;
}

function createMessage(role: ChatMessage['role'], text: string, timestamp: number): ChatMessage {
  return {
    role,
    text,
    timestamp,
  };
}

test('buildDirectPokeBehaviorGuide keeps counter poke available in serious direct contexts while changing the tone', () => {
  const guide = buildDirectPokeBehaviorGuide({
    responderCharacter: createCharacter({
      signature: '慢热，边界感强。',
    }),
    actorRole: 'user',
    recentMessages: [
      createMessage('user', '我今天有点发烧。', 1),
      createMessage('model', '先休息。', 2),
    ],
    recentContext: {
      shortTermSummary: '最近气氛偏低落，正在说身体不舒服。',
    },
    upcomingStreak: 1,
  });

  assert.equal(guide.tone, 'serious');
  assert.equal(guide.allowCounterPoke, true);
  assert.deepEqual(guide.defaultAssistantBubbles, ['？', '有事？']);
});

test('buildDirectPokeBehaviorGuide allows light counter poke when the recent vibe is playful and familiar', () => {
  const guide = buildDirectPokeBehaviorGuide({
    responderCharacter: createCharacter({
      signature: '嘴硬，熟了会逗人。',
    }),
    actorRole: 'user',
    recentMessages: [
      createMessage('user', '你刚才是不是故意装没看见。', 1),
      createMessage('model', '我哪有。', 2),
      createMessage('user', '你就是嘴硬。', 3),
      createMessage('model', '随你说。', 4),
      createMessage('user', '行，那我记住了。', 5),
      createMessage('model', '你记性最好了。', 6),
      createMessage('user', '别闹。', 7),
      createMessage('model', '明明是你先逗我。', 8),
    ],
    recentContext: {
      shortTermSummary: '最近气氛偏轻松，已经有一点嘴硬和试探。',
      sharedRecentRelationshipSummary: '两个人最近说话明显熟了。',
    },
    upcomingStreak: 1,
  });

  assert.equal(guide.tone, 'light');
  assert.equal(guide.familiarity, 'high');
  assert.equal(guide.allowCounterPoke, true);
});

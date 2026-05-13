import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, ChatMessage } from '../../types';
import {
  buildDirectProactivePokeProtocolPrompt,
  DIRECT_PROACTIVE_LIGHT_INTERACTION_PROTOCOL_PREFIX,
  evaluateDirectProactivePokeGate,
  extractDirectProactiveLightInteractionPayload,
} from './directProactiveLightInteraction';

function createCharacter(): Character {
  return {
    id: 'char-1',
    name: '小悟',
    gender: 'other',
    occupation: '学生',
    setting: '有点嘴硬，熟了会逗人',
    personality: '有点嘴硬，熟了会逗人',
    avatar: '',
    openingRemark: '嗯？',
  } as Character;
}

function createMessage(role: ChatMessage['role'], text: string, timestamp: number): ChatMessage {
  return {
    role,
    text,
    timestamp,
  };
}

test('evaluateDirectProactivePokeGate allows poke only when the recent vibe is light enough', () => {
  const result = evaluateDirectProactivePokeGate({
    character: createCharacter(),
    messages: [
      createMessage('user', '你刚才还装没看见我。', 1),
      createMessage('model', '我哪有。', 2),
      createMessage('user', '你嘴硬。', 3),
      createMessage('model', '随你说。', 4),
      createMessage('user', '行，那我记住了。', 5),
      createMessage('model', '你记性最好了。', 6),
    ],
    recentContext: {
      shortTermSummary: '两个人刚聊过一轮轻微嘴硬和试探。',
    },
    recentPokeState: {
      recentSystemLines: [],
      recentDescriptors: [],
      upcomingStreak: 1,
    },
  });

  assert.equal(result.shouldOffer, true);
  assert.equal(result.blockers.length, 0);
});

test('evaluateDirectProactivePokeGate blocks poke when there was a recent poke streak', () => {
  const result = evaluateDirectProactivePokeGate({
    character: createCharacter(),
    messages: [
      createMessage('user', '你别闹。', 1),
      createMessage('model', '哦。', 2),
      createMessage('user', '……', 3),
      createMessage('model', '看你。', 4),
      createMessage('user', '你又来。', 5),
    ],
    recentContext: {
      shortTermSummary: '刚有过一轮拍一拍。',
    },
    recentPokeState: {
      recentSystemLines: ['你拍了拍小悟'],
      recentDescriptors: ['装镇定'],
      upcomingStreak: 2,
    },
  });

  assert.equal(result.shouldOffer, false);
  assert.match(result.blockers.join('\n'), /刚发生过/);
});

test('extractDirectProactiveLightInteractionPayload returns the JSON payload behind the protocol prefix', () => {
  const payload = extractDirectProactiveLightInteractionPayload(`${DIRECT_PROACTIVE_LIGHT_INTERACTION_PROTOCOL_PREFIX}
{"systemLine":"小悟拍了拍你"}`);

  assert.equal(payload, '{"systemLine":"小悟拍了拍你"}');
});

test('buildDirectProactivePokeProtocolPrompt explains that poke is optional and contextual', () => {
  const prompt = buildDirectProactivePokeProtocolPrompt({
    characterLabel: '小悟',
    gate: {
      shouldOffer: true,
      score: 4,
      cues: ['最近气氛里已经有一点逗弄或试探感。'],
      blockers: [],
    },
  });

  assert.match(prompt, /不是默认选项/);
  assert.match(prompt, /\[LIGHT_INTERACTION\]/);
  assert.match(prompt, /不要为了使用功能而硬拍/);
});

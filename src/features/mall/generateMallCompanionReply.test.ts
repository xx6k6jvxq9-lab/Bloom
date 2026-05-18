import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppSettings, Character, MallCatalogItem } from '../../types';
import { buildMallCompanionReplyPrompt } from './generateMallCompanionReply';

function createSettings(): AppSettings {
  return {
    activeConfigId: 'cfg',
    configs: [
      {
        id: 'cfg',
        name: 'Test',
        apiKey: 'key',
        model: 'test-model',
        provider: 'openai',
        baseUrl: 'https://example.com/v1',
        temperature: 0.7,
      },
    ],
  };
}

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-a',
    name: '小回',
    gender: 'other',
    avatar: '',
    setting: '安静，慢热，偏爱低噪一点的生活感。',
    openingRemark: '你先说。',
    friendshipStatus: 'friends',
    blockedByUser: false,
    blockedByCharacter: false,
    ...overrides,
  } as Character;
}

function createMallItem(overrides: Partial<MallCatalogItem> = {}): MallCatalogItem {
  return {
    id: 'mall-item-candle',
    title: '白茶香氛蜡烛',
    subtitle: '柔和香调',
    category: '家居',
    subCategory: '香氛',
    price: 89,
    tags: ['香氛', '房间'],
    sceneTags: ['睡前', '房间'],
    styleTags: ['温柔', '安静'],
    sensitivity: 'normal',
    destinationKinds: ['self'],
    media: {
      fallbackEmoji: '🕯',
      fallbackIcon: 'package',
    },
    copy: {
      cardBlurb: '更适合慢慢把房间氛围收拢起来的小东西。',
      detailDescription: '适合睡前和房间场景。',
      recommendationReason: '如果你最近更在意房间氛围，这类小东西比大型家居更容易马上带来变化。',
    },
    ...overrides,
  };
}

test('buildMallCompanionReplyPrompt keeps the floating mall ask constraints explicit', () => {
  const prompt = buildMallCompanionReplyPrompt({
    settings: createSettings(),
    character: createCharacter(),
    item: createMallItem(),
    userName: 'User',
  });

  assert.match(prompt, /悬浮问答窗/);
  assert.match(prompt, /只输出 1 到 3 句短消息/);
  assert.match(prompt, /喜不喜欢/);
  assert.match(prompt, /适不适合用户/);
  assert.match(prompt, /适不适合现在买/);
  assert.match(prompt, /白茶香氛蜡烛/);
});

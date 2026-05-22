import assert from 'node:assert/strict';
import test from 'node:test';
import type { MallCatalogItem } from '../../types';
import {
  buildMallSearchIntentPrompt,
  buildMallShelfPlanPrompt,
} from './generateMallShelfPlan';

function createMallItem(overrides: Partial<MallCatalogItem> = {}): MallCatalogItem {
  return {
    id: 'mall-item-candle',
    title: '白茶香氛蜡烛',
    subtitle: '柔和香调',
    category: '家居',
    subCategory: '香薰',
    price: 89,
    tags: ['香氛', '房间'],
    sceneTags: ['睡前'],
    styleTags: ['温柔'],
    sensitivity: 'normal',
    destinationKinds: ['self', 'gift', 'shared_space'],
    media: {
      fallbackEmoji: '🕯️',
      fallbackIcon: 'package',
    },
    copy: {
      cardBlurb: '适合房间和共同空间的小东西。',
      detailDescription: '测试描述。',
      recommendationReason: '测试推荐。',
    },
    ...overrides,
  };
}

test('buildMallShelfPlanPrompt keeps catalog ids and strict json instruction visible', () => {
  const prompt = buildMallShelfPlanPrompt({
    mode: 'gift',
    userName: '用户',
    companionName: '阿澈',
    catalog: [createMallItem()],
    wishlistTitles: ['白茶香氛蜡烛'],
    recentSearches: ['香薰'],
    recentViewedTitles: ['白茶香氛蜡烛'],
  });

  assert.match(prompt, /JSON/);
  assert.match(prompt, /mall-item-candle/);
  assert.match(prompt, /当前模式：送给TA/);
  assert.match(prompt, /相关角色：阿澈/);
});

test('buildMallSearchIntentPrompt lists categories and normalized structure', () => {
  const prompt = buildMallSearchIntentPrompt({
    query: '想买适合送人的香薰',
    categories: ['家居', '礼物', '共同空间'],
  });

  assert.match(prompt, /normalizedQuery/);
  assert.match(prompt, /modeHint/);
  assert.match(prompt, /家居 \/ 礼物 \/ 共同空间/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { MallCatalogItem } from '../../types';
import { buildMallGiftFeedback, supportsMallGift } from './mallGift';

function createMallItem(overrides: Partial<MallCatalogItem> = {}): MallCatalogItem {
  return {
    id: 'mall-item-photo-frame',
    title: '测试相框摆件',
    subtitle: '桌面纪念',
    category: '共同空间',
    subCategory: '摆件',
    price: 119,
    tags: ['纪念', '礼物'],
    sceneTags: ['共同空间'],
    styleTags: ['木质'],
    sensitivity: 'normal',
    destinationKinds: ['self', 'gift', 'shared_space'],
    isDisplayable: true,
    media: {
      fallbackEmoji: '🖼️',
      fallbackIcon: 'package',
    },
    copy: {
      cardBlurb: '适合慢慢留下来的纪念摆件。',
      detailDescription: '测试描述。',
    },
    ...overrides,
  };
}

test('supportsMallGift matches the item destination kinds', () => {
  assert.equal(supportsMallGift(createMallItem()), true);
  assert.equal(
    supportsMallGift(createMallItem({ destinationKinds: ['self'] })),
    false,
  );
});

test('buildMallGiftFeedback is deterministic and keeps the core gift fields', () => {
  const item = createMallItem();
  const first = buildMallGiftFeedback({
    item,
    character: {
      id: 'char-lin',
      name: '林澈',
      remarkName: '阿澈',
    },
    timestamp: 123,
  });
  const second = buildMallGiftFeedback({
    item,
    character: {
      id: 'char-lin',
      name: '林澈',
      remarkName: '阿澈',
    },
    timestamp: 123,
  });

  assert.deepEqual(first, second);
  assert.match(first.summary, /阿澈/);
  assert.match(first.summary, /测试相框摆件/);
  assert.equal(first.generatedAt, 123);
  assert.equal(typeof first.accepted, 'boolean');
  assert.equal(typeof first.liked, 'boolean');
  assert.equal(typeof first.willMentionAgain, 'boolean');
  assert.equal(typeof first.placeIntoSharedSpace, 'boolean');
});

test('shared-space gift feedback only marks shared placement when the gift was accepted and liked', () => {
  const feedback = buildMallGiftFeedback({
    item: createMallItem(),
    character: {
      id: 'char-wen',
      name: '闻夏',
    },
    timestamp: 456,
  });

  if (feedback.placeIntoSharedSpace) {
    assert.equal(feedback.accepted, true);
    assert.equal(feedback.liked, true);
  }
});

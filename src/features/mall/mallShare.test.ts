import assert from 'node:assert/strict';
import test from 'node:test';
import type { MallCatalogItem } from '../../types';
import {
  buildMallShareDraftText,
  createMallShareChatMessage,
  createSharedMallItemSnapshot,
} from './mallShare';

function createMallItem(overrides: Partial<MallCatalogItem> = {}): MallCatalogItem {
  return {
    id: 'mall-item-soft-tee',
    title: '柔软落肩短袖',
    category: '男装',
    price: 129,
    tags: ['日常'],
    sensitivity: 'normal',
    destinationKinds: ['self'],
    media: {
      fallbackEmoji: '👕',
      fallbackIcon: 'package',
      backgroundPreset: 'mist-blue',
      accentColor: '#8aa0b7',
    },
    copy: {
      cardBlurb: '更适合高频日常穿的那类基础款。',
      detailDescription: '买完会进入衣柜。',
    },
    ...overrides,
  };
}

test('createSharedMallItemSnapshot keeps the chat-card fields needed for mall sharing', () => {
  const item = createMallItem({
    subtitle: '宽松日常',
  });

  assert.deepEqual(createSharedMallItemSnapshot(item), {
    id: 'mall-item-soft-tee',
    title: '柔软落肩短袖',
    subtitle: '宽松日常',
    category: '男装',
    price: 129,
    blurb: '更适合高频日常穿的那类基础款。',
    detailDescription: '买完会进入衣柜。',
    fallbackEmoji: '👕',
    fallbackIcon: 'package',
    accentColor: '#8aa0b7',
    backgroundPreset: 'mist-blue',
  });
});

test('createMallShareChatMessage builds a mall share message that can jump into chat', () => {
  const item = createMallItem();
  const message = createMallShareChatMessage(item, 'share', 123456789);

  assert.equal(message.role, 'user');
  assert.equal(message.timestamp, 123456789);
  assert.equal(message.needsReply, true);
  assert.equal(message.source, 'app');
  assert.equal(message.channel, 'app');
  assert.equal(message.text, '');
  assert.equal(message.sharedMallItem?.title, item.title);
});

test('buildMallShareDraftText returns the ask question for ask mode', () => {
  const item = createMallItem();

  assert.equal(
    buildMallShareDraftText(item, 'ask'),
    '我刚看到「柔软落肩短袖」，你觉得适合我吗？现在买合适吗？',
  );
});

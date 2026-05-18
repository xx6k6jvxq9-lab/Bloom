import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatMessage } from '../../types';
import { getMessageActionText } from './messageActions';

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    role: 'user',
    text: '',
    timestamp: 1,
    ...overrides,
  };
}

test('getMessageActionText keeps the mall card summary even when the user typed extra text', () => {
  const message = createMessage({
    text: '给你看看这个。',
    sharedMallItem: {
      id: 'mall-item-soft-tee',
      title: '柔软落肩短袖',
      category: '男装',
      price: 129,
      blurb: '更适合高频日常穿的那类基础款。',
      subtitle: '宽松日常',
      fallbackEmoji: '🧥',
      backgroundPreset: 'mist-blue',
    },
  });

  const actionText = getMessageActionText(message);

  assert.match(actionText, /给你看看这个/);
  assert.match(actionText, /\[分享商品]/);
  assert.match(actionText, /柔软落肩短袖/);
  assert.match(actionText, /价格：¥129\.00/);
});

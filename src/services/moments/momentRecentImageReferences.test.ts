import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatMessage } from '../../types';
import {
  extractRecentMomentImageReferences,
  parseRecentMomentImageAttachmentMarker,
  stripRecentMomentImageAttachmentMarker,
} from './momentRecentImageReferences';

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    role: 'user',
    text: '',
    timestamp: Date.now(),
    ...overrides,
  } as ChatMessage;
}

test('extractRecentMomentImageReferences keeps the latest real user images and skips stickers', () => {
  const messages: ChatMessage[] = [
    createMessage({
      role: 'user',
      text: '第一张图，今天说喜欢吃这个',
      imageUrl: 'asset://img-1',
      timestamp: 1,
    }),
    createMessage({
      role: 'user',
      text: '[sticker] 猫猫',
      imageUrl: 'asset://sticker',
      timestamp: 2,
    }),
    createMessage({
      role: 'model',
      text: '我看到了',
      imageUrl: 'asset://assistant-image',
      timestamp: 3,
    }),
    createMessage({
      role: 'user',
      text: '第二张图，刚刚拍的',
      imageUrl: 'asset://img-2',
      timestamp: 4,
    }),
  ];

  const references = extractRecentMomentImageReferences(messages, 2);

  assert.deepEqual(references, [
    {
      imageUrl: 'asset://img-2',
      characterId: undefined,
      relatedText: '第二张图，刚刚拍的',
      messageText: '第二张图，刚刚拍的',
      timestamp: 4,
    },
    {
      imageUrl: 'asset://img-1',
      characterId: undefined,
      relatedText: '第一张图，今天说喜欢吃这个',
      messageText: '第一张图，今天说喜欢吃这个',
      timestamp: 1,
    },
  ]);
});

test('recent moment image attachment markers can be parsed and stripped', () => {
  assert.equal(parseRecentMomentImageAttachmentMarker('[attach_recent_image:2]\n今天这张该发出去。'), 1);
  assert.equal(stripRecentMomentImageAttachmentMarker('[attach_recent_image:2]\n今天这张该发出去。'), '今天这张该发出去。');
  assert.equal(parseRecentMomentImageAttachmentMarker('今天还是纯文字。'), null);
});

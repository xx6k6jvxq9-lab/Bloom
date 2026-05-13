import assert from 'node:assert/strict';
import test from 'node:test';
import { buildForumTempReplyPrompt } from './generateForumTempReply';

test('buildForumTempReplyPrompt includes lightweight direct persona anchors for temporary private chat', () => {
  const prompt = buildForumTempReplyPrompt({
    activeConfig: {} as any,
    authorName: 'Alpha',
    authorPersona: [
      '他说话短，嘴硬，常说“别装没看见我”。',
      '被冷落会立刻烦躁，不会一下子过熟。',
    ].join('\n'),
    history: [],
    userMessage: '你找我干嘛',
  });

  assert.match(prompt, /## 原文防漏锚点/);
  assert.match(prompt, /别装没看见我/);
});

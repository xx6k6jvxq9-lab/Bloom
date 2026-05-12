import assert from 'node:assert/strict';
import test from 'node:test';
import { splitStreamingModelResponseIntoMessages } from './useDirectChatRuntime';

test('splitStreamingModelResponseIntoMessages keeps multi-bubble assistant replies even when translation stays in one block', () => {
  const messages = splitStreamingModelResponseIntoMessages(
    '第一句。\n第二句。\n\n---TRANSLATION---\n这是合并成一整段的翻译。',
    1000,
    {
      maxDirectReplyBubbles: 4,
    },
  );

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.text.includes('第一句'), true);
  assert.equal(messages[0]?.translation, undefined);
  assert.equal(messages[1]?.text.includes('第二句'), true);
  assert.equal(messages[1]?.translation, '这是合并成一整段的翻译。');
});

test('splitStreamingModelResponseIntoMessages keeps aligned translation segments when counts already match', () => {
  const messages = splitStreamingModelResponseIntoMessages(
    '第一句。\n第二句。\n\n---TRANSLATION---\n翻译一。 ||| 翻译二。',
    2000,
    {
      maxDirectReplyBubbles: 4,
    },
  );

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.translation, '翻译一。');
  assert.equal(messages[1]?.translation, '翻译二。');
});

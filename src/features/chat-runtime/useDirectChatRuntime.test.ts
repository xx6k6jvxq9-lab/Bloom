import assert from 'node:assert/strict';
import test from 'node:test';
import { splitStreamingModelResponseIntoMessages } from './useDirectChatRuntime';

test('splitStreamingModelResponseIntoMessages keeps multi-bubble assistant replies even when translation stays in one block', () => {
  const messages = splitStreamingModelResponseIntoMessages(
    'First line.\nSecond line.\n\n---TRANSLATION---\nThis is a merged translation block.',
    1000,
    {
      maxDirectReplyBubbles: 4,
    },
  );

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.text.includes('First line.'), true);
  assert.equal(messages[0]?.translation, undefined);
  assert.equal(messages[1]?.text.includes('Second line.'), true);
  assert.equal(messages[1]?.translation, 'This is a merged translation block.');
});

test('splitStreamingModelResponseIntoMessages keeps aligned translation segments when counts already match', () => {
  const messages = splitStreamingModelResponseIntoMessages(
    'First line.\nSecond line.\n\n---TRANSLATION---\nTranslation one. ||| Translation two.',
    2000,
    {
      maxDirectReplyBubbles: 4,
    },
  );

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.translation, 'Translation one.');
  assert.equal(messages[1]?.translation, 'Translation two.');
});

test('splitStreamingModelResponseIntoMessages converts trailing sticker cues into a real imported sticker message', () => {
  const importedSticker = 'sleepy-cat.png';
  const messages = splitStreamingModelResponseIntoMessages(
    "You're really pushing it for someone who's supposed to be sleeping.\nIf I hit that button, it won't be for a 'test'. [sticker] sticker\n\n---TRANSLATION---\nYou are really testing the limits of someone who's supposed to be asleep. ||| If I hit that button, it won't be for a 'test'. [sticker] sticker",
    3000,
    {
      maxDirectReplyBubbles: 4,
      availableStickers: [importedSticker],
    },
  );

  assert.equal(messages.length, 3);
  assert.equal(messages[0]?.translation, "You are really testing the limits of someone who's supposed to be asleep.");
  assert.equal(messages[1]?.text.includes('[sticker]'), false);
  assert.equal(messages[1]?.translation, "If I hit that button, it won't be for a 'test'.");
  assert.equal(messages[2]?.text, '[sticker]');
  assert.equal(messages[2]?.imageUrl, importedSticker);
  assert.ok(messages[2]?.stickerLabel);
});

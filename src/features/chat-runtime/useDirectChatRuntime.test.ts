import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectDirectReplyBubbleCount,
  resolveCharacterReplyBubbleRange,
  splitStreamingModelResponseIntoMessages,
  splitStructuredAssistantReplyEnvelopeIntoMessages,
} from './useDirectChatRuntime';

test('resolveCharacterReplyBubbleRange keeps minimum and maximum aligned', () => {
  assert.deepEqual(
    resolveCharacterReplyBubbleRange({ minReplies: 3, maxReplies: 10 }),
    { minReplies: 3, maxReplies: 10 },
  );
  assert.deepEqual(
    resolveCharacterReplyBubbleRange({ minReplies: 6, maxReplies: 2 }),
    { minReplies: 6, maxReplies: 6 },
  );
});

test('inspectDirectReplyBubbleCount counts visible chat bubbles from structured replies', () => {
  const inspection = inspectDirectReplyBubbleCount(
    '[ASSISTANT_REPLY] {"items":[{"kind":"text","text":"Come here first.","translation":"先过来。"},{"kind":"text","text":"Look at me.","translation":"看着我。"},{"kind":"text","text":"Then talk.","translation":"再说。"}]}',
  );

  assert.equal(inspection.bubbleCount, 3);
  assert.equal(inspection.hasSpecialContent, false);
});

test('inspectDirectReplyBubbleCount flags protocol-only replies as special content', () => {
  const inspection = inspectDirectReplyBubbleCount(
    '[ASSISTANT_REPLY] {"items":[{"kind":"game_card","payload":{"game":"qna","type":"answer","content":"Then listen carefully."},"translation":"Listen carefully."}]}',
  );

  assert.equal(inspection.bubbleCount, 0);
  assert.equal(inspection.hasSpecialContent, true);
});

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

test('splitStructuredAssistantReplyEnvelopeIntoMessages maps structured text, transfer, and token items directly', () => {
  const messages = splitStructuredAssistantReplyEnvelopeIntoMessages(
    '[ASSISTANT_REPLY] {"items":[{"kind":"text","text":"Come here first.","translation":"先过来。"},{"kind":"transfer","amount":"88.00"},{"kind":"token","name":"COUPLE_SPACE_INVITE_ACCEPTED"}]}',
    4000,
    {
      transferTargetLabel: '你',
    },
  );

  assert.equal(messages?.length, 3);
  assert.equal(messages?.[0]?.text, 'Come here first.');
  assert.equal(messages?.[0]?.translation, '先过来。');
  assert.equal(messages?.[1]?.contentType, 'transfer');
  assert.equal(messages?.[1]?.transferStatus, 'pending');
  assert.equal(messages?.[2]?.contentType, 'couple-space-invite-accepted');
});

test('splitStructuredAssistantReplyEnvelopeIntoMessages keeps game card translation off the legacy text body', () => {
  const messages = splitStructuredAssistantReplyEnvelopeIntoMessages(
    '[ASSISTANT_REPLY] {"items":[{"kind":"game_card","payload":{"game":"qna","type":"answer","content":"Then listen carefully."},"translation":"那你听好了。"}]}',
    5000,
  );

  assert.equal(messages?.length, 1);
  assert.equal(messages?.[0]?.contentType, 'game-card');
  assert.equal(messages?.[0]?.text, '[GAME_CARD] {"game":"qna","type":"answer","content":"Then listen carefully."}');
  assert.equal(messages?.[0]?.translation, '那你听好了。');
});

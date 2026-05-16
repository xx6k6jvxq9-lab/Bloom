import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STRUCTURED_ASSISTANT_REPLY_TOKEN,
  extractStructuredAssistantReplyPreviewText,
  normalizeStructuredAssistantReplyToLegacyFormat,
  parseStructuredAssistantReplyEnvelope,
} from './assistantReplyEnvelope';

test('normalizeStructuredAssistantReplyToLegacyFormat converts text items into legacy bilingual bubbles', () => {
  const reply = `${STRUCTURED_ASSISTANT_REPLY_TOKEN} {"items":[{"kind":"text","text":"Bonjour.","translation":"你好。"},{"kind":"text","text":"[reply: 你] Attends.","translation":"等等。"}]}`;

  assert.equal(
    normalizeStructuredAssistantReplyToLegacyFormat(reply),
    'Bonjour.\n[reply: 你] Attends.\n\n---TRANSLATION---\n你好。 ||| 等等。',
  );
});

test('normalizeStructuredAssistantReplyToLegacyFormat keeps transfer and token items alongside text', () => {
  const reply = `${STRUCTURED_ASSISTANT_REPLY_TOKEN} {"items":[{"kind":"text","text":"Come here first.","translation":"先过来。"},{"kind":"transfer","amount":"88"},{"kind":"token","name":"COUPLE_SPACE_INVITE_ACCEPTED"}]}`;

  assert.equal(
    normalizeStructuredAssistantReplyToLegacyFormat(reply),
    'Come here first.\n[transfer]88.00[/transfer]\n[COUPLE_SPACE_INVITE_ACCEPTED]\n\n---TRANSLATION---\n先过来。',
  );
});

test('normalizeStructuredAssistantReplyToLegacyFormat keeps game card items as exclusive structured cards', () => {
  const payload = {
    game: 'qna',
    type: 'answer',
    question: 'Tell me the truth.',
    content: 'Then listen carefully.',
  };
  const reply = `${STRUCTURED_ASSISTANT_REPLY_TOKEN} ${JSON.stringify({
    items: [
      {
        kind: 'game_card',
        payload,
        translation: '那你听好了。',
      },
    ],
  })}`;

  assert.equal(
    normalizeStructuredAssistantReplyToLegacyFormat(reply),
    `[GAME_CARD] ${JSON.stringify(payload)}\n\n---TRANSLATION---\n那你听好了。`,
  );
});

test('parseStructuredAssistantReplyEnvelope keeps legacy bilingual protocol compatible', () => {
  const legacyReply = '[BILINGUAL_REPLY] {"segments":[{"text":"Hello there.","translation":"你好呀。"}]}';
  const parsed = parseStructuredAssistantReplyEnvelope(legacyReply);

  assert.deepEqual(parsed, {
    items: [
      {
        kind: 'text',
        text: 'Hello there.',
        translation: '你好呀。',
      },
    ],
  });
});

test('extractStructuredAssistantReplyPreviewText prefers visible text content', () => {
  const reply = `${STRUCTURED_ASSISTANT_REPLY_TOKEN} {"items":[{"kind":"game_card","payload":{"game":"qna","type":"answer","content":"Look at me first."},"translation":"先看着我。"}]}`;

  assert.equal(
    extractStructuredAssistantReplyPreviewText(reply),
    'Look at me first.',
  );
});

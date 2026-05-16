import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAvatarOfferReplyPromptSection,
  deriveFallbackAvatarOfferDecision,
} from './avatarOfferDecision';

test('fallback treats image-only turns conservatively when there is no visual input', () => {
  const review = deriveFallbackAvatarOfferDecision({
    candidate: {
      image: 'asset://candidate-1',
      source: 'chat-image',
      messageTimestamp: 1,
    },
    latestUserText: '[image]',
    usedImageInput: false,
  });

  assert.equal(review.intent, 'unclear');
  assert.equal(review.decision, 'ignore');
  assert.equal(review.action, null);
});

test('fallback turns explicit avatar requests into ask-confirm instead of direct change', () => {
  const review = deriveFallbackAvatarOfferDecision({
    candidate: {
      image: 'asset://candidate-2',
      source: 'chat-image',
      messageTimestamp: 2,
    },
    latestUserText: '把这张换成你的头像',
    usedImageInput: false,
  });

  assert.equal(review.intent, 'avatar_offer');
  assert.equal(review.decision, 'ask_confirm');
  assert.equal(review.action?.type, 'ask_confirm');
});

test('fallback keeps appearance-reference turns out of direct avatar change', () => {
  const review = deriveFallbackAvatarOfferDecision({
    candidate: {
      image: 'asset://candidate-3',
      source: 'chat-image',
      messageTimestamp: 3,
    },
    latestUserText: '这张好像你',
    usedImageInput: false,
  });

  assert.equal(review.intent, 'appearance_reference');
  assert.equal(review.decision, 'ask_confirm');
});

test('reply prompt section tells the main chat to treat life-sharing images normally', () => {
  const section = buildAvatarOfferReplyPromptSection({
    intent: 'share_life',
    decision: 'ignore',
    confidence: 'medium',
    reason: '这轮更像普通生活分享，不应该主动上升到换头像。',
    replyHint: '把这张当普通生活分享回复，不要主动提头像。',
    candidate: {
      image: 'asset://candidate-4',
      source: 'chat-image',
      messageTimestamp: 4,
    },
    action: null,
    origin: 'fallback',
    usedImageInput: false,
  });

  assert.match(section, /普通生活分享/);
  assert.match(section, /不要主动提头像/);
});

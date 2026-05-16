import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, ChatMessage } from '../../types';
import {
  buildAvatarActionPromptSection,
  latestUserMessageHasAvatarIntent,
  resolveLatestAvatarCandidateForUserTurn,
  shouldOfferAvatarActionForCharacter,
} from './avatarActions';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: 'current-avatar.png',
    setting: '',
    openingRemark: '',
    friendshipStatus: 'friends',
    blockedByUser: false,
    blockedByCharacter: false,
    ...overrides,
  } as Character;
}

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    role: 'user',
    text: '',
    timestamp: 1,
    ...overrides,
  } as ChatMessage;
}

test('image-only user messages can trigger avatar consideration', () => {
  const character = createCharacter();
  const messages = [
    createMessage({
      text: '[image]',
      imageUrl: 'asset://avatar-offer-1',
    }),
  ];

  assert.equal(shouldOfferAvatarActionForCharacter(character, messages), true);
  assert.equal(latestUserMessageHasAvatarIntent(messages), true);
  assert.match(buildAvatarActionPromptSection(character, messages), /only sent the image itself/i);
});

test('short follow-up messages can point back to the latest image avatar candidate', () => {
  const character = createCharacter();
  const messages = [
    createMessage({
      text: '[image]',
      imageUrl: 'asset://avatar-offer-2',
      timestamp: 1,
    }),
    createMessage({
      text: '就这个',
      timestamp: 2,
    }),
  ];

  assert.equal(shouldOfferAvatarActionForCharacter(character, messages), true);
  assert.equal(latestUserMessageHasAvatarIntent(messages), true);
});

test('unrelated follow-up text after an image does not trigger avatar consideration by itself', () => {
  const character = createCharacter();
  const messages = [
    createMessage({
      text: '[image]',
      imageUrl: 'asset://avatar-offer-3',
      timestamp: 1,
    }),
    createMessage({
      text: '晚安',
      timestamp: 2,
    }),
  ];

  assert.equal(shouldOfferAvatarActionForCharacter(character, messages), false);
  assert.equal(latestUserMessageHasAvatarIntent(messages), false);
});

test('explicit avatar requests can still choose from the avatar library without a new image', () => {
  const character = createCharacter({
    avatarLibrary: {
      entries: [
        {
          id: 'avatar-1',
          image: 'asset://saved-avatar',
          source: 'upload',
          status: 'saved',
          addedAt: 1,
          updatedAt: 1,
        },
      ],
      updatedAt: 1,
    },
  });
  const messages = [
    createMessage({
      text: '再换个头像',
    }),
  ];

  assert.equal(shouldOfferAvatarActionForCharacter(character, messages), true);
});

test('previous-image references can point to the earlier recent image candidate', () => {
  const messages = [
    createMessage({
      text: '[image]',
      imageUrl: 'asset://avatar-offer-old',
      timestamp: 1,
    }),
    createMessage({
      text: '[image]',
      imageUrl: 'asset://avatar-offer-new',
      timestamp: 2,
    }),
    createMessage({
      text: '上一张',
      timestamp: 3,
    }),
  ];

  assert.equal(resolveLatestAvatarCandidateForUserTurn(messages)?.image, 'asset://avatar-offer-old');
});

test('ordinal image references can target the matching candidate in chronological order', () => {
  const messages = [
    createMessage({
      text: '[image]',
      imageUrl: 'asset://avatar-offer-first',
      timestamp: 1,
    }),
    createMessage({
      text: '[image]',
      imageUrl: 'asset://avatar-offer-second',
      timestamp: 2,
    }),
    createMessage({
      text: '[image]',
      imageUrl: 'asset://avatar-offer-third',
      timestamp: 3,
    }),
    createMessage({
      text: '第二张更像你',
      timestamp: 4,
    }),
  ];

  assert.equal(resolveLatestAvatarCandidateForUserTurn(messages)?.image, 'asset://avatar-offer-second');
});

test('last and reverse-order image references can target the newest recent candidates', () => {
  const messages = [
    createMessage({
      text: '[image]',
      imageUrl: 'asset://avatar-offer-first',
      timestamp: 1,
    }),
    createMessage({
      text: '[image]',
      imageUrl: 'asset://avatar-offer-second',
      timestamp: 2,
    }),
    createMessage({
      text: '[image]',
      imageUrl: 'asset://avatar-offer-third',
      timestamp: 3,
    }),
    createMessage({
      text: '最后一张',
      timestamp: 4,
    }),
  ];

  assert.equal(resolveLatestAvatarCandidateForUserTurn(messages)?.image, 'asset://avatar-offer-third');

  const reverseMessages = [
    ...messages.slice(0, 3),
    createMessage({
      text: '倒数第二张',
      timestamp: 5,
    }),
  ];

  assert.equal(resolveLatestAvatarCandidateForUserTurn(reverseMessages)?.image, 'asset://avatar-offer-second');
});

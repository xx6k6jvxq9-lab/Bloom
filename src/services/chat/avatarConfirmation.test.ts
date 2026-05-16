import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyAvatarConfirmationReply,
  isPendingAvatarConfirmationExpired,
  resolveAvatarConfirmationFromMessages,
} from './avatarConfirmation';

test('classifyAvatarConfirmationReply can distinguish confirm and decline', () => {
  assert.equal(classifyAvatarConfirmationReply('换吧'), 'confirm');
  assert.equal(classifyAvatarConfirmationReply('别换'), 'decline');
  assert.equal(classifyAvatarConfirmationReply('今天天气不错'), 'unknown');
});

test('resolveAvatarConfirmationFromMessages turns a confirmed image offer into a change action', () => {
  const character = {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: 'current.png',
    setting: '',
    openingRemark: '',
    pendingAvatarConfirmation: {
      kind: 'image-offer',
      source: 'pending_avatar_image',
      createdAt: Date.now() - 1000,
      candidateImage: 'asset://candidate-image',
      reason: 'Ta 想先确认一下你是不是要把这张给他当头像。',
      trigger: 'user_request',
    },
  };
  const messages = [
    {
      role: 'user',
      text: '换吧',
      timestamp: 1,
    },
  ];

  const resolution = resolveAvatarConfirmationFromMessages(character as any, messages as any);
  assert.equal(resolution?.reply, 'confirm');
  assert.equal(resolution?.action?.type, 'change');
  assert.equal(resolution?.action?.source, 'pending_avatar_image');
  assert.equal(resolution?.clearPending, true);
});

test('resolveAvatarConfirmationFromMessages clears pending state on decline', () => {
  const character = {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: 'current.png',
    setting: '',
    openingRemark: '',
    pendingAvatarConfirmation: {
      kind: 'library-switch',
      source: 'avatar_library:fav',
      entryId: 'fav',
      createdAt: Date.now() - 1000,
      reason: 'Ta 想先确认一下要不要换成头像库那张。',
      trigger: 'user_request',
    },
  };
  const messages = [
    {
      role: 'user',
      text: '先别换',
      timestamp: 1,
    },
  ];

  const resolution = resolveAvatarConfirmationFromMessages(character as any, messages as any);
  assert.equal(resolution?.reply, 'decline');
  assert.equal(resolution?.action, null);
  assert.equal(resolution?.clearPending, true);
});

test('isPendingAvatarConfirmationExpired can detect expired requests', () => {
  assert.equal(isPendingAvatarConfirmationExpired({
    kind: 'image-offer',
    source: 'pending_avatar_image',
    createdAt: 1,
    expiresAt: 2,
  } as any, 3), true);
  assert.equal(isPendingAvatarConfirmationExpired({
    kind: 'image-offer',
    source: 'pending_avatar_image',
    createdAt: 1,
    expiresAt: 5,
  } as any, 3), false);
});

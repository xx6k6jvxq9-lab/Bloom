import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import {
  getDirectChatBlockedComposerError,
  getDirectChatBlockedManualReplyError,
  getDirectChatRelationshipBlockNotice,
  shouldPauseDirectChatComposerForCharacter,
} from './directChatDelivery';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: '',
    friendshipStatus: 'friends',
    blockedByUser: false,
    blockedByCharacter: false,
    ...overrides,
  } as Character;
}

test('composer pauses when relationship has not been restored even after unblock', () => {
  const character = createCharacter({
    friendshipStatus: 'none',
    blockedByUser: false,
    blockedByCharacter: false,
  });

  assert.equal(shouldPauseDirectChatComposerForCharacter(character), true);
  assert.match(getDirectChatBlockedComposerError(character) || '', /还不是好友|关系页/);
  assert.match(getDirectChatRelationshipBlockNotice(character), /没有恢复好友关系|关系页/);
});

test('blocked-by-character still allows local send semantics instead of composer pause', () => {
  const character = createCharacter({
    friendshipStatus: 'none',
    blockedByCharacter: true,
  });

  assert.equal(shouldPauseDirectChatComposerForCharacter(character), false);
  assert.equal(getDirectChatBlockedComposerError(character), null);
  assert.match(getDirectChatBlockedManualReplyError(character) || '', /拒收/);
});

test('user-blocked state still hard-pauses the composer', () => {
  const character = createCharacter({
    blockedByUser: true,
  });

  assert.equal(shouldPauseDirectChatComposerForCharacter(character), true);
  assert.match(getDirectChatBlockedComposerError(character) || '', /拉黑/);
});

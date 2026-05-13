import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, ForumRuntimeAuthorProfile } from '../../types';
import {
  isStableNumericId,
  normalizeCharactersWithNumericIds,
  normalizeForumRuntimeAuthorProfiles,
} from './stableNumericId';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-a',
    name: '角色A',
    gender: 'other',
    avatar: '',
    setting: '测试设定',
    openingRemark: '你好',
    ...overrides,
  };
}

function createForumProfile(overrides: Partial<ForumRuntimeAuthorProfile> = {}): ForumRuntimeAuthorProfile {
  return {
    id: 'forum-author-a',
    name: '网友A',
    handle: '网友A的handle',
    avatar: '',
    bio: '测试简介',
    ...overrides,
  };
}

test('normalizeCharactersWithNumericIds backfills stable 8-digit ids and preserves valid existing ids', () => {
  const characters = normalizeCharactersWithNumericIds([
    createCharacter({ id: 'char-a' }),
    createCharacter({ id: 'char-b', numericId: '23456789' }),
  ]);

  assert.equal(isStableNumericId(characters[0].numericId), true);
  assert.equal(characters[1].numericId, '23456789');
  assert.notEqual(characters[0].numericId, characters[1].numericId);
});

test('normalizeForumRuntimeAuthorProfiles reuses linked character ids and resolves collisions for other authors', () => {
  const characters = normalizeCharactersWithNumericIds([
    createCharacter({ id: 'char-a' }),
    createCharacter({ id: 'char-b' }),
  ]);

  const profiles = normalizeForumRuntimeAuthorProfiles({
    'char-a': createForumProfile({
      id: 'char-a',
      numericId: '87654321',
      name: '论坛里的角色A',
    }),
    'forum-author-a': createForumProfile({
      id: 'forum-author-a',
      numericId: characters[1].numericId,
    }),
  }, characters);

  assert.equal(profiles['char-a'].numericId, characters[0].numericId);
  assert.equal(isStableNumericId(profiles['forum-author-a'].numericId), true);
  assert.notEqual(profiles['forum-author-a'].numericId, characters[1].numericId);
});

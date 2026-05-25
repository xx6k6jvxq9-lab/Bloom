import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { tokenizeGroupTextMentions } from './groupMentionText';

function createMember(id: string, name: string, remarkName?: string): Character {
  return {
    id,
    name,
    remarkName,
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: '',
    friendshipStatus: 'friends',
    blockedByUser: false,
    blockedByCharacter: false,
  } as Character;
}

test('tokenizeGroupTextMentions only highlights explicit member mentions', () => {
  const parts = tokenizeGroupTextMentions(
    '@小回，这句是给你的',
    [createMember('c1', '小回')],
  );

  assert.deepEqual(parts, [
    { kind: 'mention', text: '@小回', memberId: 'c1' },
    { kind: 'text', text: '，这句是给你的' },
  ]);
});

test('tokenizeGroupTextMentions leaves plain @ text untouched when it is not a real mention', () => {
  const parts = tokenizeGroupTextMentions(
    '@这个掉格式了',
    [createMember('c1', '小回')],
  );

  assert.deepEqual(parts, [
    { kind: 'text', text: '@这个掉格式了' },
  ]);
});

test('tokenizeGroupTextMentions prefers the longest alias match', () => {
  const parts = tokenizeGroupTextMentions(
    '@小回 来一下',
    [
      createMember('short', '小'),
      createMember('long', '小回'),
    ],
  );

  assert.deepEqual(parts, [
    { kind: 'mention', text: '@小回', memberId: 'long' },
    { kind: 'text', text: ' 来一下' },
  ]);
});

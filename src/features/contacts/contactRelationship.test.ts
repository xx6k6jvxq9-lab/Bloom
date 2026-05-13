import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { resolveCharacterBlockedFollowupDelayMs } from './contactRelationship';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: '',
    ...overrides,
  } as Character;
}

test('blocked follow-up delays stay within one minute even for high-resistance personas', () => {
  const profiles = [
    createCharacter({
      id: 'guarded',
      openingRemark: '高冷，戒备，自尊强，不肯低头。',
    }),
    createCharacter({
      id: 'warm',
      openingRemark: '温柔，心软，在乎对方，会忍不住回头。',
    }),
    createCharacter({
      id: 'volatile',
      openingRemark: '暴躁，直接，容易上头，也容易忍不住追一句。',
    }),
  ];

  profiles.forEach((character, index) => {
    const delay = resolveCharacterBlockedFollowupDelayMs(character, [], index + 6);
    assert.ok(delay > 0);
    assert.ok(delay <= 60_000);
  });
});

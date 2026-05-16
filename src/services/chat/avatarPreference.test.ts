import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUpdateAvatarEntryPreferencePatch } from './avatarPreference';

function createCharacter() {
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
    avatarLibrary: {
      entries: [
        {
          id: 'current',
          image: 'current-avatar.png',
          source: 'upload',
          status: 'current',
          addedAt: 1,
          updatedAt: 1,
        },
        {
          id: 'favorite',
          image: 'favorite-avatar.png',
          source: 'upload',
          status: 'saved',
          addedAt: 2,
          updatedAt: 2,
        },
      ],
      updatedAt: 2,
    },
  } as const;
}

test('buildUpdateAvatarEntryPreferencePatch updates only the targeted avatar entry', () => {
  const character = createCharacter();
  const patch = buildUpdateAvatarEntryPreferencePatch({
    character: character as any,
    entryId: 'favorite',
    updates: {
      affinity: 'love',
      selfFit: 'high',
      learnedFrom: 'manual',
    },
  });

  const currentEntry = patch.avatarLibrary?.entries.find((entry) => entry.id === 'current');
  const favoriteEntry = patch.avatarLibrary?.entries.find((entry) => entry.id === 'favorite');

  assert.equal(currentEntry?.preference, undefined);
  assert.equal(favoriteEntry?.preference?.affinity, 'love');
  assert.equal(favoriteEntry?.preference?.selfFit, 'high');
  assert.equal(favoriteEntry?.preference?.learnedFrom, 'manual');
});

test('buildUpdateAvatarEntryPreferencePatch can clear a preference field by writing null', () => {
  const character = createCharacter() as any;
  character.avatarLibrary.entries[1].preference = {
    affinity: 'like',
    selfFit: 'medium',
    learnedFrom: 'manual',
    updatedAt: 2,
  };

  const patch = buildUpdateAvatarEntryPreferencePatch({
    character,
    entryId: 'favorite',
    updates: {
      affinity: null,
      learnedFrom: 'manual',
    },
  });

  const favoriteEntry = patch.avatarLibrary?.entries.find((entry) => entry.id === 'favorite');
  assert.equal(favoriteEntry?.preference?.affinity, undefined);
  assert.equal(favoriteEntry?.preference?.selfFit, 'medium');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pruneRelationshipAvatarBindings,
  resolveUserAvatarForScene,
  updateUserAvatarLibraryEntry,
  upsertRelationshipAvatarBinding,
  upsertUserAvatarLibraryEntry,
} from './userAvatarState';

function createUserProfile() {
  return {
    name: 'User',
    avatar: 'default-avatar.png',
    id: 'user-id',
    bio: '',
    mood: '',
  };
}

test('resolveUserAvatarForScene prefers the bound avatar for direct chat', () => {
  const userProfile = createUserProfile();
  const library = upsertUserAvatarLibraryEntry({
    library: {
      entries: [],
      updatedAt: 0,
    },
    entry: {
      id: 'entry-1',
      image: 'bound-avatar.png',
      source: 'upload',
      addedAt: 10,
      updatedAt: 10,
    },
  });
  const bindings = upsertRelationshipAvatarBinding({
    bindings: [],
    binding: {
      characterId: 'character-a',
      userAvatarEntryId: 'entry-1',
      sceneIds: ['direct_chat'],
      updatedAt: 20,
    },
  });

  const resolved = resolveUserAvatarForScene({
    userProfile,
    userAvatarLibrary: library,
    relationshipAvatarBindings: bindings,
    characterId: 'character-a',
    scene: 'direct_chat',
  });

  assert.equal(resolved.avatar, 'bound-avatar.png');
  assert.equal(resolved.source, 'relationship_binding');
  assert.equal(resolved.binding?.characterId, 'character-a');
});

test('resolveUserAvatarForScene reuses a legacy direct-chat binding in newer relationship scenes', () => {
  const userProfile = createUserProfile();
  const bindings = upsertRelationshipAvatarBinding({
    bindings: [],
    binding: {
      characterId: 'character-a',
      userAvatarEntryId: 'entry-1',
      sceneIds: ['direct_chat'],
      updatedAt: 20,
    },
  });

  const resolved = resolveUserAvatarForScene({
    userProfile,
    userAvatarLibrary: {
      entries: [
        {
          id: 'entry-1',
          image: 'bound-avatar.png',
          source: 'upload',
          addedAt: 10,
          updatedAt: 10,
        },
      ],
      updatedAt: 10,
    },
    relationshipAvatarBindings: bindings,
    characterId: 'character-a',
    scene: 'dating',
  });

  assert.equal(resolved.avatar, 'bound-avatar.png');
  assert.equal(resolved.source, 'relationship_binding');
});

test('resolveUserAvatarForScene treats bindings without sceneIds as relationship-wide avatars', () => {
  const userProfile = createUserProfile();
  const bindings = upsertRelationshipAvatarBinding({
    bindings: [],
    binding: {
      characterId: 'character-a',
      userAvatarEntryId: 'entry-1',
      updatedAt: 20,
    },
  });

  const resolved = resolveUserAvatarForScene({
    userProfile,
    userAvatarLibrary: {
      entries: [
        {
          id: 'entry-1',
          image: 'bound-avatar.png',
          source: 'upload',
          addedAt: 10,
          updatedAt: 10,
        },
      ],
      updatedAt: 10,
    },
    relationshipAvatarBindings: bindings,
    characterId: 'character-a',
    scene: 'music_together',
  });

  assert.equal(resolved.avatar, 'bound-avatar.png');
  assert.equal(resolved.source, 'relationship_binding');
});

test('pruneRelationshipAvatarBindings removes bindings whose library entry no longer exists', () => {
  const bindings = [
    {
      characterId: 'character-a',
      userAvatarEntryId: 'entry-1',
      updatedAt: 10,
    },
    {
      characterId: 'character-b',
      userAvatarEntryId: 'entry-2',
      updatedAt: 20,
    },
  ];

  const pruned = pruneRelationshipAvatarBindings({
    bindings: bindings as any,
    library: {
      entries: [
        {
          id: 'entry-2',
          image: 'kept-avatar.png',
          source: 'upload',
          addedAt: 1,
          updatedAt: 1,
        },
      ],
      updatedAt: 1,
    },
  });

  assert.equal(pruned.length, 1);
  assert.equal(pruned[0]?.characterId, 'character-b');
});

test('updateUserAvatarLibraryEntry updates label and tags for an existing avatar', () => {
  const updated = updateUserAvatarLibraryEntry({
    library: {
      entries: [
        {
          id: 'entry-1',
          image: 'bound-avatar.png',
          source: 'upload',
          addedAt: 10,
          updatedAt: 10,
        },
      ],
      updatedAt: 10,
    },
    entryId: 'entry-1',
    updates: {
      label: '雨天头像',
      tags: ['温柔', '灰调'],
    },
  });

  assert.equal(updated.entries[0]?.label, '雨天头像');
  assert.deepEqual(updated.entries[0]?.tags, ['温柔', '灰调']);
});

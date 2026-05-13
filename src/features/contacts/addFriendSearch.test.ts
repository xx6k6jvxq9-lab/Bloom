import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, ForumData, ForumRuntimeAuthorProfile } from '../../types';
import { getForumSeedAuthorProfile } from '../forum-domain/seedThreadsCatalog';
import {
  findAddFriendTargetByHandle,
  findAddFriendTargetByNumericId,
} from './addFriendSearch';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-a',
    numericId: '12345678',
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
    id: 'forum-user-a',
    numericId: '23456789',
    name: '网友A',
    handle: '网友A',
    avatar: '',
    bio: '测试简介',
    ...overrides,
  };
}

function createForumData(overrides: Partial<ForumData> = {}): ForumData {
  return {
    posts: [],
    notifications: [],
    runtimeAuthorProfiles: {},
    tempChats: {},
    ...overrides,
  };
}

test('findAddFriendTargetByNumericId matches character ids first', () => {
  const character = createCharacter();
  const forumData = createForumData({
    runtimeAuthorProfiles: {
      [character.id]: createForumProfile({
        id: character.id,
        numericId: character.numericId,
      }),
    },
  });

  const matched = findAddFriendTargetByNumericId({
    numericId: character.numericId!,
    characters: [character],
    forumData,
    currentUserId: 'user-self',
  });

  assert.equal(matched?.kind, 'character');
  assert.equal(matched?.kind === 'character' ? matched.character.id : '', character.id);
});

test('findAddFriendTargetByNumericId matches generated forum users by stable numeric id', () => {
  const seedProfile = getForumSeedAuthorProfile('forum_npc_momo');
  assert.ok(seedProfile);

  const matched = findAddFriendTargetByNumericId({
    numericId: seedProfile!.numericId,
    characters: [],
    forumData: createForumData({
      posts: [{
        id: 'post-1',
        authorId: 'forum_npc_momo',
        title: '测试帖子',
        content: '测试内容',
        category: '综合',
        timestamp: 100,
        viewCount: 10,
        likes: [],
        collections: [],
        comments: [],
      }],
    }),
    currentUserId: 'user-self',
  });

  assert.equal(matched?.kind, 'forum_author');
  assert.equal(matched?.kind === 'forum_author' ? matched.author.id : '', 'forum_npc_momo');
});

test('findAddFriendTargetByNumericId also accepts an @-prefixed numeric id', () => {
  const seedProfile = getForumSeedAuthorProfile('forum_npc_momo');
  assert.ok(seedProfile);

  const matched = findAddFriendTargetByNumericId({
    numericId: `@${seedProfile!.numericId}`,
    characters: [],
    forumData: createForumData({
      posts: [{
        id: 'post-1',
        authorId: 'forum_npc_momo',
        title: '测试帖子',
        content: '测试内容',
        category: '综合',
        timestamp: 100,
        viewCount: 10,
        likes: [],
        collections: [],
        comments: [],
      }],
    }),
    currentUserId: 'user-self',
  });

  assert.equal(matched?.kind, 'forum_author');
  assert.equal(matched?.kind === 'forum_author' ? matched.author.id : '', 'forum_npc_momo');
});

test('findAddFriendTargetByNumericId skips anonymous forum ids', () => {
  const matched = findAddFriendTargetByNumericId({
    numericId: '34567890',
    characters: [],
    forumData: createForumData({
      runtimeAuthorProfiles: {
        'seed-anon-test': createForumProfile({
          id: 'seed-anon-test',
          numericId: '34567890',
        }),
      },
    }),
    currentUserId: 'user-self',
  });

  assert.equal(matched, null);
});

test('findAddFriendTargetByHandle matches searchable forum handles exactly', () => {
  const matched = findAddFriendTargetByHandle({
    handle: '@网友A',
    characters: [],
    forumData: createForumData({
      runtimeAuthorProfiles: {
        'forum-user-a': createForumProfile({
          id: 'forum-user-a',
          handle: '网友A',
        }),
      },
    }),
    currentUserId: 'user-self',
  });

  assert.equal(matched?.kind, 'forum_author');
  assert.equal(matched?.kind === 'forum_author' ? matched.author.id : '', 'forum-user-a');
});

test('findAddFriendTargetByHandle prefers character targets when the handle belongs to a role forum profile', () => {
  const character = createCharacter({
    id: 'char-role-a',
    numericId: '45678901',
    name: '角色论坛号',
  });
  const matched = findAddFriendTargetByHandle({
    handle: '@论坛角色A',
    characters: [character],
    forumData: createForumData({
      runtimeAuthorProfiles: {
        [character.id]: createForumProfile({
          id: character.id,
          handle: '论坛角色A',
        }),
      },
    }),
    currentUserId: 'user-self',
  });

  assert.equal(matched?.kind, 'character');
  assert.equal(matched?.kind === 'character' ? matched.character.id : '', character.id);
});

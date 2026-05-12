import assert from 'node:assert/strict';
import test from 'node:test';
import type { ForumTempChatSession } from '../../types';
import { resolveOutgoingForumFriendRequest } from './forumOutgoingFriendRequestResolution';

function createSession(overrides: Partial<ForumTempChatSession> = {}): ForumTempChatSession {
  return {
    authorId: 'forum-user-a',
    createdAt: 1,
    updatedAt: 1,
    messages: [],
    sessionOrigin: 'user_opened',
    canAddFriend: false,
    addedAsFriend: false,
    completedExchangeRounds: 0,
    meaningfulReplyCount: 0,
    proactiveNpcTurnCount: 0,
    friendRequestState: 'none',
    ...overrides,
  };
}

test('resolveOutgoingForumFriendRequest accepts familiar forum users with enough interaction', () => {
  const resolution = resolveOutgoingForumFriendRequest({
    author: {
      id: 'forum-user-a',
      name: '网友A',
      handle: '回帖很快',
      bio: '常驻交界，爱看热闹，嘴比脑子快。',
    },
    session: createSession({
      completedExchangeRounds: 7,
      meaningfulReplyCount: 8,
      proactiveNpcTurnCount: 2,
    }),
    relatedPost: {
      id: 'post-1',
      authorId: 'forum-user-a',
      title: '测试帖子',
      content: '测试内容',
      category: '综合',
      timestamp: 100,
      viewCount: 10,
      likes: [],
      collections: [],
      comments: [],
    },
    currentUserId: 'user-self',
    followedUsers: ['forum-user-a'],
    followerMap: {
      'user-self': ['forum-user-a'],
      'forum-user-a': ['user-self'],
    },
    now: 500,
  });

  assert.equal(resolution.accepted, true);
  assert.equal(resolution.resolutionMessage, '对方通过了你的申请');
  assert.equal(resolution.responseText.length > 0, true);
});

test('resolveOutgoingForumFriendRequest rejects cold forum users with no prior interaction', () => {
  const resolution = resolveOutgoingForumFriendRequest({
    author: {
      id: 'forum-user-b',
      name: '网友B',
      handle: '潜水看看',
      bio: '慢热旁听型，不太想公开太多。',
    },
    session: createSession({
      authorId: 'forum-user-b',
      completedExchangeRounds: 0,
      meaningfulReplyCount: 0,
      proactiveNpcTurnCount: 0,
    }),
    currentUserId: 'user-self',
    followedUsers: [],
    followerMap: {},
    now: 500,
  });

  assert.equal(resolution.accepted, false);
  assert.equal(resolution.resolutionMessage, '对方暂时没有通过你的申请');
  assert.equal(resolution.responseText.length > 0, true);
});

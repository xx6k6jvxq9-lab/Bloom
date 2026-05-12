import assert from 'node:assert/strict';
import test from 'node:test';
import type { ForumTempChatSession } from '../../types';
import {
  createOutgoingForumFriendRequest,
  getPendingForumFriendRequest,
} from './forumFriendRequests';

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

test('createOutgoingForumFriendRequest creates a real outgoing forum request payload', () => {
  const request = createOutgoingForumFriendRequest({
    author: {
      id: 'forum-user-a',
      name: '网友A',
      avatar: '',
      handle: '网友A',
    },
    session: createSession(),
    now: 123,
  });

  assert.equal(request.sourceScene, 'forum');
  assert.equal(request.direction, 'outgoing');
  assert.equal(request.initiator, 'user');
  assert.equal(request.requestKind, 'friend');
  assert.equal(request.status, 'pending');
  assert.equal(request.sourceTempChatAuthorId, 'forum-user-a');
  assert.equal(request.lastUpdatedAt, 123);
  assert.equal(request.autoResolveKind, 'forum_outgoing_request');
  assert.equal(typeof request.autoResolveAt, 'number');
  assert.equal((request.autoResolveAt || 0) > 123, true);
});

test('getPendingForumFriendRequest returns the newest pending forum request for the author', () => {
  const matched = getPendingForumFriendRequest([
    {
      id: 'old',
      fromUserId: 'forum-user-a',
      fromUserName: '网友A',
      fromUserAvatar: '',
      status: 'pending',
      timestamp: 100,
      sourceScene: 'forum',
    },
    {
      id: 'new',
      fromUserId: 'forum-user-a',
      fromUserName: '网友A',
      fromUserAvatar: '',
      status: 'pending',
      timestamp: 200,
      sourceScene: 'forum',
      direction: 'outgoing',
    },
  ], 'forum-user-a');

  assert.equal(matched?.id, 'new');
});

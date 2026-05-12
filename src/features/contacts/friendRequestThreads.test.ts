import assert from 'node:assert/strict';
import test from 'node:test';
import type { FriendRequest } from '../../types';
import {
  countUnreadIncomingFriendRequestPages,
  getLatestCharacterRelationshipRound,
  getLatestUnreadRelationshipEventForCharacter,
  markRelationshipRoundAbandoned,
  resolveRelationshipRoundForWrite,
} from './friendRequestThreads';

function createRequest(overrides: Partial<FriendRequest> = {}): FriendRequest {
  return {
    id: 'request',
    fromUserId: 'char-a',
    fromUserName: '角色A',
    fromUserAvatar: '',
    status: 'pending',
    timestamp: 1,
    direction: 'incoming',
    initiator: 'character',
    characterId: 'char-a',
    threadId: 'relationship-thread:char-a',
    ...overrides,
  };
}

test('countUnreadIncomingFriendRequestPages includes unread relationship-event pages', () => {
  const requests: FriendRequest[] = [
    createRequest({
      id: 'request-1',
      timestamp: 100,
      relationshipRoundId: 'relationship-round:char-a:1:100',
      relationshipRoundNo: 1,
    }),
    createRequest({
      id: 'event-1',
      status: 'superseded',
      timestamp: 200,
      lastUpdatedAt: 200,
      characterId: 'char-b',
      fromUserId: 'char-b',
      fromUserName: '角色B',
      threadId: 'relationship-thread:char-b',
      relationshipRoundId: 'relationship-round:char-b:1:200',
      relationshipRoundNo: 1,
      isRelationshipEvent: true,
      eventKind: 'character_warned_user_from_chat',
      isUnread: true,
    }),
  ];

  assert.equal(countUnreadIncomingFriendRequestPages(requests), 2);
});

test('getLatestUnreadRelationshipEventForCharacter returns the newest unread event for that character', () => {
  const requests: FriendRequest[] = [
    createRequest({
      id: 'event-old',
      status: 'superseded',
      timestamp: 100,
      lastUpdatedAt: 100,
      isRelationshipEvent: true,
      eventKind: 'character_warned_user_from_chat',
      isUnread: true,
      relationshipRoundId: 'relationship-round:char-a:1:100',
      relationshipRoundNo: 1,
    }),
    createRequest({
      id: 'event-new',
      status: 'superseded',
      timestamp: 220,
      lastUpdatedAt: 240,
      isRelationshipEvent: true,
      eventKind: 'character_blocked_user_from_chat',
      isUnread: true,
      relationshipRoundId: 'relationship-round:char-a:2:220',
      relationshipRoundNo: 2,
    }),
    createRequest({
      id: 'event-other',
      status: 'superseded',
      timestamp: 260,
      lastUpdatedAt: 260,
      characterId: 'char-b',
      fromUserId: 'char-b',
      fromUserName: '角色B',
      threadId: 'relationship-thread:char-b',
      isRelationshipEvent: true,
      eventKind: 'character_blocked_user_from_chat',
      isUnread: true,
      relationshipRoundId: 'relationship-round:char-b:1:260',
      relationshipRoundNo: 1,
    }),
  ];

  const latest = getLatestUnreadRelationshipEventForCharacter(requests, 'char-a');

  assert.equal(latest?.id, 'event-new');
  assert.equal(latest?.eventKind, 'character_blocked_user_from_chat');
});

test('markRelationshipRoundAbandoned closes the current round and the next write opens a new one', () => {
  const roundId = 'relationship-round:char-a:1:100';
  const requests: FriendRequest[] = [
    createRequest({
      id: 'request-1',
      status: 'rejected',
      timestamp: 100,
      lastUpdatedAt: 100,
      relationshipRoundId: roundId,
      relationshipRoundNo: 1,
      relationshipRoundStatus: 'active',
    }),
    createRequest({
      id: 'event-1',
      status: 'superseded',
      timestamp: 120,
      lastUpdatedAt: 120,
      relationshipRoundId: roundId,
      relationshipRoundNo: 1,
      isRelationshipEvent: true,
      eventKind: 'user_unblocked_character',
    }),
  ];

  const abandoned = markRelationshipRoundAbandoned(requests, roundId, 300);
  const latestRound = getLatestCharacterRelationshipRound(abandoned, 'char-a');
  const nextRound = resolveRelationshipRoundForWrite(abandoned, 'char-a', 400);

  assert.equal(latestRound?.status, 'abandoned');
  assert.equal(abandoned.every((request) => request.relationshipRoundStatus === 'abandoned'), true);
  assert.notEqual(nextRound.roundId, roundId);
  assert.equal(nextRound.roundNo, 2);
});

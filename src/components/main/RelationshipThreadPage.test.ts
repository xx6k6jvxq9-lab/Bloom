import assert from 'node:assert/strict';
import test from 'node:test';
import type { FriendRequest } from '../../types';
import { shouldSuppressDuplicateRelationshipResponse } from './RelationshipThreadPage';

function createRequest(overrides: Partial<FriendRequest> = {}): FriendRequest {
  return {
    id: 'request',
    fromUserId: 'char-a',
    fromUserName: '坏哥哥',
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

test('shouldSuppressDuplicateRelationshipResponse hides a repeated response right after an event record', () => {
  const previousEvent = createRequest({
    id: 'event-1',
    status: 'superseded',
    isRelationshipEvent: true,
    eventKind: 'user_blocked_character',
    responseText: '林然，你真有出息了。\n跟我玩拉黑这一套是吧？',
  });
  const followupRequest = createRequest({
    id: 'request-2',
    attemptNo: 1,
    responseText: '  林然，你真有出息了。 跟我玩拉黑这一套是吧？  ',
  });

  assert.equal(shouldSuppressDuplicateRelationshipResponse(followupRequest, previousEvent), true);
});

test('shouldSuppressDuplicateRelationshipResponse keeps distinct request responses visible', () => {
  const previousRequest = createRequest({
    id: 'request-1',
    responseText: '这次算了。',
  });
  const currentRequest = createRequest({
    id: 'request-2',
    responseText: '最后一遍，赶紧把我拉回来。',
  });

  assert.equal(shouldSuppressDuplicateRelationshipResponse(currentRequest, previousRequest), false);
});

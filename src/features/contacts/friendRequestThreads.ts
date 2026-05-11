import type { FriendRequest, FriendRequestInitiator } from '../../types';

export const MAX_RELATIONSHIP_REQUEST_ATTEMPTS = 10;

function getFriendRequestCharacterIdForThread(request: FriendRequest) {
  return request.characterId
    || (request.sourceScene !== 'forum' && request.fromUserId ? request.fromUserId : undefined);
}

export function getCharacterFriendRequestThreadId(characterId: string) {
  return `relationship-thread:${characterId}`;
}

export function getFriendRequestThreadKey(request: FriendRequest) {
  if (request.threadId?.trim()) {
    return request.threadId.trim();
  }

  const characterId = getFriendRequestCharacterIdForThread(request);
  if (characterId) {
    return getCharacterFriendRequestThreadId(characterId);
  }

  return `request:${request.id}`;
}

export function getNextCharacterRequestAttemptNo(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
  initiator?: FriendRequestInitiator,
) {
  const requestList = Array.isArray(requests) ? requests : [];
  const threadId = getCharacterFriendRequestThreadId(characterId);
  const matchedRequests = requestList.filter((request) => (
    getFriendRequestThreadKey(request) === threadId
    && (!initiator || request.initiator === initiator)
  ));

  const maxAttemptNo = matchedRequests.reduce((currentMax, request) => (
    typeof request.attemptNo === 'number' && Number.isFinite(request.attemptNo)
      ? Math.max(currentMax, request.attemptNo)
      : currentMax
  ), 0);

  return Math.max(maxAttemptNo, matchedRequests.length) + 1;
}

export function canCreateCharacterRequestAttempt(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
  initiator?: FriendRequestInitiator,
) {
  return getNextCharacterRequestAttemptNo(requests, characterId, initiator) <= MAX_RELATIONSHIP_REQUEST_ATTEMPTS;
}

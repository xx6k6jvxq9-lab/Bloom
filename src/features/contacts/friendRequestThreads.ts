import type { FriendRequest, FriendRequestInitiator, RelationshipRoundStatus } from '../../types';

export const MAX_RELATIONSHIP_REQUEST_ATTEMPTS = 10;
const RELATIONSHIP_ROUND_PAGE_PREFIX = 'relationship-round-page:';

export type RelationshipRoundMeta = {
  roundId: string;
  roundNo: number;
  status: RelationshipRoundStatus;
  latestTimestamp: number;
  requests: FriendRequest[];
};

function getFriendRequestCharacterIdForThread(request: FriendRequest) {
  return request.characterId
    || (request.sourceScene !== 'forum' && request.fromUserId ? request.fromUserId : undefined);
}

export function getCharacterFriendRequestThreadId(characterId: string) {
  return `relationship-thread:${characterId}`;
}

function getLegacyRelationshipRoundId(characterId: string) {
  return `relationship-round:${characterId}:legacy-1`;
}

function isRelationshipRoundRequest(request: FriendRequest) {
  return request.sourceScene === 'relationship' || request.requestKind === 'reconnect' || request.isRelationshipEvent;
}

export function isFriendRequestReleased(request: FriendRequest, now = Date.now()) {
  return !request.releaseAt || request.releaseAt <= now;
}

export function releaseDueFriendRequests(
  requests: FriendRequest[] | null | undefined,
  now = Date.now(),
) {
  const requestList = Array.isArray(requests) ? requests : [];
  let changed = false;

  const nextRequests = requestList.map((request) => {
    if (!request.releaseAt || request.releaseAt > now) {
      return request;
    }

    changed = true;
    return {
      ...request,
      releaseAt: undefined,
      unreadAt: request.unreadAt || request.releaseAt,
      lastUpdatedAt: Math.max(request.lastUpdatedAt || 0, request.releaseAt),
    };
  });

  return changed ? nextRequests : requestList;
}

export function getNextFriendRequestReleaseAt(
  requests: FriendRequest[] | null | undefined,
  now = Date.now(),
) {
  const requestList = Array.isArray(requests) ? requests : [];
  const scheduledTimes = requestList
    .map((request) => request.releaseAt)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > now)
    .sort((left, right) => left - right);

  return scheduledTimes[0] || null;
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

export function getRelationshipRoundPageKey(roundId: string) {
  return `${RELATIONSHIP_ROUND_PAGE_PREFIX}${roundId}`;
}

export function parseRelationshipRoundPageKey(pageKey: string | null | undefined) {
  const normalized = pageKey?.trim() || '';
  if (!normalized.startsWith(RELATIONSHIP_ROUND_PAGE_PREFIX)) {
    return null;
  }

  return normalized.slice(RELATIONSHIP_ROUND_PAGE_PREFIX.length) || null;
}

export function getFriendRequestRelationshipRoundId(request: FriendRequest) {
  if (request.relationshipRoundId?.trim()) {
    return request.relationshipRoundId.trim();
  }

  const characterId = getFriendRequestCharacterIdForThread(request);
  if (characterId && isRelationshipRoundRequest(request)) {
    return getLegacyRelationshipRoundId(characterId);
  }

  return '';
}

export function getFriendRequestRelationshipRoundNo(request: FriendRequest) {
  if (typeof request.relationshipRoundNo === 'number' && Number.isFinite(request.relationshipRoundNo)) {
    return Math.max(1, Math.floor(request.relationshipRoundNo));
  }

  return getFriendRequestRelationshipRoundId(request) ? 1 : 0;
}

function resolveRoundStatus(requests: FriendRequest[]): RelationshipRoundStatus {
  const explicitResolved = requests.some((request) => request.relationshipRoundStatus === 'resolved');
  if (explicitResolved) {
    return 'resolved';
  }

  const explicitAbandoned = requests.some((request) => request.relationshipRoundStatus === 'abandoned');
  if (explicitAbandoned) {
    return 'abandoned';
  }

  const hasAcceptedRequest = requests.some((request) => !request.isRelationshipEvent && request.status === 'accepted');
  if (hasAcceptedRequest) {
    return 'resolved';
  }

  return 'active';
}

export function getCharacterRelationshipRounds(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
): RelationshipRoundMeta[] {
  const requestList = Array.isArray(requests) ? requests : [];
  const threadId = getCharacterFriendRequestThreadId(characterId);
  const roundMap = new Map<string, FriendRequest[]>();

  requestList
    .filter((request) => isFriendRequestReleased(request))
    .filter((request) => getFriendRequestThreadKey(request) === threadId)
    .filter((request) => isRelationshipRoundRequest(request))
    .forEach((request) => {
      const roundId = getFriendRequestRelationshipRoundId(request) || getLegacyRelationshipRoundId(characterId);
      const current = roundMap.get(roundId) || [];
      current.push(request);
      roundMap.set(roundId, current);
    });

  return [...roundMap.entries()]
    .map(([roundId, roundRequests]) => {
      const roundNo = roundRequests.reduce((currentMax, request) => (
        Math.max(currentMax, getFriendRequestRelationshipRoundNo(request))
      ), 1);
      const latestTimestamp = roundRequests.reduce((currentMax, request) => (
        Math.max(currentMax, request.lastUpdatedAt || request.timestamp)
      ), 0);

      return {
        roundId,
        roundNo,
        status: resolveRoundStatus(roundRequests),
        latestTimestamp,
        requests: [...roundRequests].sort((left, right) => {
          const leftAttempt = left.attemptNo ?? 0;
          const rightAttempt = right.attemptNo ?? 0;
          if (leftAttempt !== rightAttempt) {
            return leftAttempt - rightAttempt;
          }
          return left.timestamp - right.timestamp;
        }),
      };
    })
    .sort((left, right) => {
      if (left.roundNo !== right.roundNo) {
        return left.roundNo - right.roundNo;
      }
      return left.latestTimestamp - right.latestTimestamp;
    });
}

export function getLatestCharacterRelationshipRound(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
) {
  const rounds = getCharacterRelationshipRounds(requests, characterId);
  return rounds[rounds.length - 1] || null;
}

export function getLatestCharacterRelationshipPageKey(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
) {
  const latestRound = getLatestCharacterRelationshipRound(requests, characterId);
  if (latestRound) {
    return getRelationshipRoundPageKey(latestRound.roundId);
  }

  return getCharacterFriendRequestThreadId(characterId);
}

export function getActiveCharacterRelationshipRound(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
) {
  const latestRound = getLatestCharacterRelationshipRound(requests, characterId);
  if (!latestRound || latestRound.status !== 'active') {
    return null;
  }

  return latestRound;
}

export function createNextCharacterRelationshipRound(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
  timestamp = Date.now(),
) {
  const latestRound = getLatestCharacterRelationshipRound(requests, characterId);
  const roundNo = latestRound ? latestRound.roundNo + 1 : 1;

  return {
    roundId: `relationship-round:${characterId}:${roundNo}:${timestamp}`,
    roundNo,
  };
}

export function resolveRelationshipRoundForWrite(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
  timestamp = Date.now(),
) {
  const activeRound = getActiveCharacterRelationshipRound(requests, characterId);
  if (activeRound) {
    return {
      roundId: activeRound.roundId,
      roundNo: activeRound.roundNo,
    };
  }

  return createNextCharacterRelationshipRound(requests, characterId, timestamp);
}

export function getFriendRequestPageKey(request: FriendRequest) {
  const roundId = getFriendRequestRelationshipRoundId(request);
  if (roundId) {
    return getRelationshipRoundPageKey(roundId);
  }

  return getFriendRequestThreadKey(request);
}

export function matchFriendRequestToPageKey(request: FriendRequest, pageKey: string) {
  const roundId = parseRelationshipRoundPageKey(pageKey);
  if (roundId) {
    return getFriendRequestRelationshipRoundId(request) === roundId;
  }

  return getFriendRequestThreadKey(request) === pageKey;
}

export function isFriendRequestUnread(request: FriendRequest) {
  if (!isFriendRequestReleased(request)) {
    return false;
  }

  if (typeof request.isUnread === 'boolean') {
    return request.isUnread;
  }

  return request.status === 'pending' && request.direction === 'incoming';
}

export function isUnreadRelationshipEvent(request: FriendRequest) {
  return !!request.isRelationshipEvent && isFriendRequestUnread(request);
}

export function markFriendRequestPageRead(
  requests: FriendRequest[] | null | undefined,
  pageKey: string,
  readAt = Date.now(),
) {
  const requestList = Array.isArray(requests) ? requests : [];

  return requestList.map((request) => (
    matchFriendRequestToPageKey(request, pageKey) && isFriendRequestUnread(request)
      ? {
          ...request,
          isUnread: false,
          unreadAt: undefined,
          lastUpdatedAt: Math.max(request.lastUpdatedAt || 0, readAt),
        }
      : request
  ));
}

export function countUnreadIncomingFriendRequestPages(
  requests: FriendRequest[] | null | undefined,
) {
  const requestList = Array.isArray(requests) ? requests : [];
  const unreadPageKeys = new Set<string>();

  requestList.forEach((request) => {
    if (!isFriendRequestUnread(request)) {
      return;
    }
    if (
      request.status !== 'pending'
      && !request.isRelationshipEvent
    ) {
      return;
    }
    if (
      request.status === 'pending'
      && request.direction !== 'incoming'
      && !request.isRelationshipEvent
    ) {
      return;
    }

    unreadPageKeys.add(getFriendRequestPageKey(request));
  });

  return unreadPageKeys.size;
}

export function getLatestUnreadRelationshipEventForCharacter(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
) {
  const requestList = Array.isArray(requests) ? requests : [];

  return [...requestList]
    .filter((request) => getFriendRequestCharacterIdForThread(request) === characterId)
    .filter((request) => isUnreadRelationshipEvent(request))
    .sort((left, right) => {
      const leftUpdatedAt = left.lastUpdatedAt || left.timestamp;
      const rightUpdatedAt = right.lastUpdatedAt || right.timestamp;
      return rightUpdatedAt - leftUpdatedAt;
    })[0] || null;
}

export function markRelationshipRoundResolved(
  requests: FriendRequest[] | null | undefined,
  roundId: string,
  resolvedAt = Date.now(),
) {
  const requestList = Array.isArray(requests) ? requests : [];

  return requestList.map((request) => (
    getFriendRequestRelationshipRoundId(request) === roundId
      ? {
          ...request,
          relationshipRoundStatus: 'resolved' as const,
          relationshipRoundResolvedAt: resolvedAt,
        }
      : request
  ));
}

export function markRelationshipRoundAbandoned(
  requests: FriendRequest[] | null | undefined,
  roundId: string,
  abandonedAt = Date.now(),
) {
  const requestList = Array.isArray(requests) ? requests : [];

  return requestList.map((request) => (
    getFriendRequestRelationshipRoundId(request) === roundId
      && request.relationshipRoundStatus !== 'resolved'
      && request.status !== 'accepted'
      ? {
          ...request,
          relationshipRoundStatus: 'abandoned' as const,
          relationshipRoundResolvedAt: undefined,
          lastUpdatedAt: Math.max(request.lastUpdatedAt || 0, abandonedAt),
        }
      : request
  ));
}

export function getNextCharacterRequestAttemptNo(
  requests: FriendRequest[] | null | undefined,
  characterId: string,
  initiator?: FriendRequestInitiator,
  relationshipRoundId?: string | null,
) {
  const requestList = Array.isArray(requests) ? requests : [];
  const threadId = getCharacterFriendRequestThreadId(characterId);
  const matchedRequests = requestList.filter((request) => (
    getFriendRequestThreadKey(request) === threadId
    && (!initiator || request.initiator === initiator)
    && (!relationshipRoundId || getFriendRequestRelationshipRoundId(request) === relationshipRoundId)
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
  relationshipRoundId?: string | null,
) {
  return getNextCharacterRequestAttemptNo(requests, characterId, initiator, relationshipRoundId) <= MAX_RELATIONSHIP_REQUEST_ATTEMPTS;
}

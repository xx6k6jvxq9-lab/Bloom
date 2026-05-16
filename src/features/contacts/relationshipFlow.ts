import type {
  AppData,
  AppSettings,
  Character,
  ChatMessage,
  CoupleSpaceData,
  FriendRequest,
} from '../../types';
import {
  createCharacterRelationshipMessages,
  createRelationshipSystemMessage,
  decideCharacterFriendRequestResponse,
  decideCharacterUnblockGesture,
  getCharacterBlockState,
  getFriendRequestCharacterId,
  getRelationshipReactionBubbleCap,
  supersedePendingCharacterRequests,
} from './contactRelationship';
import { applyRelationshipRecoveryContext } from './relationshipRecoveryContext';
import {
  canCreateCharacterRequestAttempt,
  getCharacterFriendRequestThreadId,
  getFriendRequestRelationshipRoundId,
  getFriendRequestRelationshipRoundNo,
  getNextCharacterRequestAttemptNo,
  markRelationshipRoundAbandoned,
  markRelationshipRoundResolved,
  resolveRelationshipRoundForWrite,
} from './friendRequestThreads';
import { generateRelationshipEventReply } from './generateRelationshipEventReply';

export type AppDataStateUpdater = (updater: (prev: AppData) => AppData) => void;
type PersistCharacters = (characters: Character[]) => void | Promise<void>;

export type RelationshipFlowRuntime = {
  appData: AppData;
  settings: AppSettings;
  setAppData: AppDataStateUpdater;
  coupleSpace?: CoupleSpaceData;
  persistCharacters?: PersistCharacters;
};

function getRelationshipDisplayName(character: Pick<Character, 'name' | 'remarkName'>) {
  return character.remarkName?.trim() || character.name;
}

function persistCharactersIfChanged(
  previousCharacters: Character[],
  nextCharacters: Character[],
  persistCharacters?: PersistCharacters,
) {
  if (!persistCharacters || previousCharacters === nextCharacters) {
    return;
  }

  void persistCharacters(nextCharacters);
}

function getRuntimeCoupleSpace(runtime: RelationshipFlowRuntime) {
  return runtime.coupleSpace ?? runtime.appData.coupleSpace;
}

function buildRelationshipReactionNoticeLabel(
  displayName: string,
  options: {
    kind: 'blocked' | 'unblocked';
  },
) {
  return options.kind === 'blocked'
    ? `${displayName} 的拉黑反应`
    : `${displayName} 的反应`;
}

function createRelationshipFriendRequestNoticeMessage(displayName: string, timestamp: number) {
  return createRelationshipSystemMessage(
    `${displayName} 想正式加你为好友，已经进“新的朋友”了。`,
    timestamp,
  );
}

export function resolveBlockedRelationshipFollowupPlan(params: {
  canCreateRequest: boolean;
  decision?: string | null;
}) {
  const shouldCounterBlock = params.decision === 'counter_block';
  return {
    shouldCounterBlock,
    shouldSendRequest: params.canCreateRequest && params.decision === 'send_request',
  };
}

function buildRelationshipReactionMessages(
  character: Pick<Character, 'id' | 'corePersona' | 'expressionStyle' | 'signature' | 'openingRemark'>,
  reactionText: string,
  timestamp: number,
  options: {
    intensity?: 'normal' | 'high';
  },
) {
  return createCharacterRelationshipMessages(
    character.id,
    reactionText,
    timestamp,
    {
      maxBubbles: getRelationshipReactionBubbleCap(character, reactionText, {
        intensity: options.intensity,
      }),
    },
  );
}

export function appendRelationshipMessages(
  currentHistory: AppData['chatHistory'],
  characterId: string,
  messages: ChatMessage[],
) {
  return {
    ...currentHistory,
    [characterId]: [...(currentHistory[characterId] || []), ...messages],
  };
}

export function createRelationshipEventThreadEntry(params: {
  characterId: string;
  characterName: string;
  characterAvatar?: string | null;
  relationshipRoundId: string;
  relationshipRoundNo: number;
  timestamp: number;
  reactionText: string;
  resolutionMessage: string;
  eventKind: FriendRequest['eventKind'];
  isUnread?: boolean;
}): FriendRequest {
  return {
    id: `relationship-event-${params.characterId}-${params.timestamp}`,
    fromUserId: params.characterId,
    fromUserName: params.characterName,
    fromUserAvatar: params.characterAvatar || '',
    status: 'superseded',
    timestamp: params.timestamp,
    direction: 'incoming',
    initiator: 'character',
    requestKind: 'relationship_event',
    characterId: params.characterId,
    threadId: getCharacterFriendRequestThreadId(params.characterId),
    relationshipRoundId: params.relationshipRoundId,
    relationshipRoundNo: params.relationshipRoundNo,
    relationshipRoundStatus: 'active',
    isRelationshipEvent: true,
    eventKind: params.eventKind,
    resolutionMessage: params.resolutionMessage,
    responseText: params.reactionText,
    ...(params.isUnread ? { isUnread: true, unreadAt: params.timestamp } : {}),
    sourceScene: 'relationship',
    lastUpdatedAt: params.timestamp,
  };
}

export function applyNonForumFriendRequestResolution(
  prev: AppData,
  params: {
    requestId: string;
    accepted: boolean;
    note?: string;
  },
): {
  nextAppData: AppData;
  nextCharacters?: Character[];
  characterId?: string;
} {
  const request = (prev.friendRequests || []).find((entry) => entry.id === params.requestId);
  if (!request) {
    return { nextAppData: prev };
  }

  const characterId = getFriendRequestCharacterId(request);
  const timestamp = Date.now();
  const relationshipRoundId = getFriendRequestRelationshipRoundId(request);

  if (!characterId) {
    return {
      nextAppData: {
        ...prev,
        friendRequests: (prev.friendRequests || []).map((entry) => (
          entry.id === params.requestId
            ? {
                ...entry,
                status: params.accepted ? 'accepted' : 'rejected',
                isUnread: false,
                unreadAt: undefined,
                resolutionMessage: params.accepted ? '你已通过这条好友申请' : '你拒绝了这条好友申请',
                ...(params.accepted ? {} : params.note?.trim() ? { userDecisionNote: params.note.trim() } : {}),
                lastUpdatedAt: timestamp,
              }
            : entry
        )),
      },
    };
  }

  const targetCharacter = prev.characters.find((character) => character.id === characterId);
  const nextCharacters = params.accepted
    ? prev.characters.map((character) => (
      character.id === characterId
        ? {
            ...character,
            friendshipStatus: 'friends' as const,
            blockedByUser: false,
            blockedByCharacter: false,
            relationshipStatusUpdatedAt: timestamp,
            ...(request.requestKind === 'reconnect'
              ? {
                  shortTermSummary: applyRelationshipRecoveryContext(character, 'reconnect_accepted'),
                }
              : {}),
          }
        : character
    ))
    : prev.characters;

  let nextFriendRequests = params.accepted
    ? (prev.friendRequests || []).map((entry) => {
      if (getFriendRequestCharacterId(entry) !== characterId || entry.status !== 'pending') {
        return entry;
      }
      if (entry.id === params.requestId) {
        return {
          ...entry,
          status: 'accepted' as const,
          isUnread: false,
          unreadAt: undefined,
          resolutionMessage: '你已通过这条好友申请',
          lastUpdatedAt: timestamp,
        };
      }
      return {
        ...entry,
        status: 'superseded' as const,
        isUnread: false,
        unreadAt: undefined,
        resolutionMessage: '关系已恢复，旧申请自动归档',
        lastUpdatedAt: timestamp,
      };
    })
    : (prev.friendRequests || []).map((entry) => (
      entry.id === params.requestId
        ? {
            ...entry,
            status: 'rejected' as const,
            isUnread: false,
            unreadAt: undefined,
            resolutionMessage: '你拒绝了这条好友申请',
            ...(params.note?.trim() ? { userDecisionNote: params.note.trim() } : {}),
            lastUpdatedAt: timestamp,
          }
        : entry
    ));

  if (params.accepted && relationshipRoundId) {
    nextFriendRequests = markRelationshipRoundResolved(nextFriendRequests, relationshipRoundId, timestamp);
  }

  const nextHistory = appendRelationshipMessages(prev.chatHistory, characterId, [
    createRelationshipSystemMessage(
      params.accepted
        ? `你通过了 ${targetCharacter ? getRelationshipDisplayName(targetCharacter) : '对方'} 的好友申请。`
        : `你拒绝了 ${targetCharacter ? getRelationshipDisplayName(targetCharacter) : '对方'} 的好友申请。`,
      timestamp,
    ),
  ]);

  return {
    nextAppData: {
      ...prev,
      characters: nextCharacters,
      chatHistory: nextHistory,
      friendRequests: nextFriendRequests,
    },
    nextCharacters,
    characterId,
  };
}

export function runHandledRelationshipRequestReactionFlow(params: {
  runtime: RelationshipFlowRuntime;
  requestId: string;
  characterId: string;
  accepted: boolean;
  note?: string;
}) {
  const { runtime, requestId, characterId, accepted } = params;
  const targetCharacter = runtime.appData.characters.find((character) => character.id === characterId);
  if (!targetCharacter) {
    return;
  }

  const historySnapshot = runtime.appData.chatHistory[characterId] || [];

  void (async () => {
    let generated = null;
    try {
      generated = await generateRelationshipEventReply({
        settings: runtime.settings,
        character: targetCharacter,
        allCharacters: runtime.appData.characters,
        userName: runtime.appData.userProfile.name,
        history: historySnapshot,
        directChatHistory: runtime.appData.chatHistory,
        chatGroups: runtime.appData.chatGroups || [],
        masks: runtime.appData.masks,
        worldBook: runtime.appData.worldBooks || [],
        perception: runtime.appData.perception,
        coupleSpace: getRuntimeCoupleSpace(runtime),
        event: {
          kind: accepted ? 'user_accepted_character_request' : 'user_rejected_character_request',
          note: accepted ? undefined : params.note?.trim(),
        },
      });
    } catch {
      generated = null;
    }

    runtime.setAppData((prev) => {
      const currentCharacter = prev.characters.find((character) => character.id === characterId);
      const currentRequest = (prev.friendRequests || []).find((request) => request.id === requestId);
      const expectedStatus = accepted ? 'accepted' : 'rejected';
      if (!currentCharacter || !currentRequest || currentRequest.status !== expectedStatus) {
        return prev;
      }

      const relationshipRoundId = getFriendRequestRelationshipRoundId(currentRequest);
      const relationshipRoundNo = Math.max(1, getFriendRequestRelationshipRoundNo(currentRequest));
      const nextAttemptNo = getNextCharacterRequestAttemptNo(
        prev.friendRequests || [],
        characterId,
        'character',
        relationshipRoundId,
      );
      const canRetry = !accepted && canCreateCharacterRequestAttempt(
        prev.friendRequests || [],
        characterId,
        'character',
        relationshipRoundId,
      );
      const reactionText = generated?.reactionText?.trim() || '';
      const followupRequestMessage = generated?.requestMessage?.trim() || undefined;
      const shouldSendFollowupRequest = canRetry && (
        generated?.decision === 'send_request'
          ? !!followupRequestMessage
          : generated?.decision === 'none'
            ? false
            : !!followupRequestMessage
      );
      const reactionTimestamp = Date.now();
      const followupRequestId = shouldSendFollowupRequest
        ? `friend-request-${characterId}-${reactionTimestamp}`
        : null;
      const followupThreadId = followupRequestId ? getCharacterFriendRequestThreadId(characterId) : null;

      return {
        ...prev,
        ...((
          !accepted
          && relationshipRoundId
          && !shouldSendFollowupRequest
        )
          ? {
              friendRequests: markRelationshipRoundAbandoned([
                ...(shouldSendFollowupRequest && followupRequestId && followupThreadId
                  ? [{
                      id: followupRequestId,
                      fromUserId: characterId,
                      fromUserName: getRelationshipDisplayName(currentCharacter),
                      fromUserAvatar: currentCharacter.avatar,
                      status: 'pending' as const,
                      timestamp: reactionTimestamp,
                      direction: 'incoming' as const,
                      initiator: 'character' as const,
                      requestKind: currentRequest.requestKind || 'reconnect',
                      characterId,
                      threadId: followupThreadId,
                      relationshipRoundId,
                      relationshipRoundNo,
                      relationshipRoundStatus: 'active' as const,
                      attemptNo: nextAttemptNo,
                      isUnread: true,
                      unreadAt: reactionTimestamp,
                      sourceScene: 'relationship' as const,
                      lastUpdatedAt: reactionTimestamp,
                      ...(followupRequestMessage ? { message: followupRequestMessage } : {}),
                    }]
                  : []),
                ...(prev.friendRequests || []).map((request) => (
                  request.id === requestId
                    ? {
                        ...request,
                        ...(accepted ? {} : params.note?.trim() ? { userDecisionNote: params.note.trim() } : {}),
                        ...(reactionText ? { responseText: reactionText } : {}),
                        lastUpdatedAt: reactionTimestamp,
                      }
                    : request
                )),
              ], relationshipRoundId, reactionTimestamp),
            }
          : {
              friendRequests: [
                ...(shouldSendFollowupRequest && followupRequestId && followupThreadId
                  ? [{
                      id: followupRequestId,
                      fromUserId: characterId,
                      fromUserName: getRelationshipDisplayName(currentCharacter),
                      fromUserAvatar: currentCharacter.avatar,
                      status: 'pending' as const,
                      timestamp: reactionTimestamp,
                      direction: 'incoming' as const,
                      initiator: 'character' as const,
                      requestKind: currentRequest.requestKind || 'reconnect',
                      characterId,
                      threadId: followupThreadId,
                      relationshipRoundId,
                      relationshipRoundNo,
                      relationshipRoundStatus: 'active' as const,
                      attemptNo: nextAttemptNo,
                      isUnread: true,
                      unreadAt: reactionTimestamp,
                      sourceScene: 'relationship' as const,
                      lastUpdatedAt: reactionTimestamp,
                      ...(followupRequestMessage ? { message: followupRequestMessage } : {}),
                    }]
                  : []),
                ...(prev.friendRequests || []).map((request) => (
                  request.id === requestId
                    ? {
                        ...request,
                        ...(accepted ? {} : params.note?.trim() ? { userDecisionNote: params.note.trim() } : {}),
                        ...(reactionText ? { responseText: reactionText } : {}),
                        lastUpdatedAt: reactionTimestamp,
                      }
                    : request
                )),
              ],
            }),
      };
    });
  })();
}

export function runRelationshipRequestSubmissionFlow(params: {
  runtime: RelationshipFlowRuntime;
  characterId: string;
  targetCharacter?: Character | null;
  message: string;
}) {
  const { runtime, characterId, message } = params;
  const targetCharacter = params.targetCharacter || runtime.appData.characters.find((character) => character.id === characterId) || null;
  if (!targetCharacter) {
    return false;
  }

  const timestamp = Date.now();
  const relationshipRound = resolveRelationshipRoundForWrite(
    runtime.appData.friendRequests || [],
    characterId,
    timestamp,
  );

  if (!canCreateCharacterRequestAttempt(runtime.appData.friendRequests || [], characterId, 'user', relationshipRound.roundId)) {
    return false;
  }

  const historySnapshot = runtime.appData.chatHistory[characterId] || [];
  const trimmedMessage = message.trim() || '想把你加回来，之后继续好好聊。';
  const currentBlockState = getCharacterBlockState(targetCharacter);
  const requestKind = currentBlockState === 'none' ? 'friend' as const : 'reconnect' as const;
  const requestId = `friend-request-${characterId}-${timestamp}`;

  runtime.setAppData((prev) => {
    const nextCharacters = prev.characters.map((character) => (
      character.id === characterId
        ? {
            ...character,
            relationshipStatusUpdatedAt: timestamp,
          }
        : character
    ));
    const threadId = getCharacterFriendRequestThreadId(characterId);
    const nextAttemptNo = getNextCharacterRequestAttemptNo(
      prev.friendRequests || [],
      characterId,
      'user',
      relationshipRound.roundId,
    );
    const nextFriendRequests = [
      {
        id: requestId,
        fromUserId: characterId,
        fromUserName: getRelationshipDisplayName(targetCharacter),
        fromUserAvatar: targetCharacter.avatar,
        status: 'pending' as const,
        timestamp,
        message: trimmedMessage,
        direction: 'outgoing' as const,
        initiator: 'user' as const,
        requestKind,
        characterId,
        threadId,
        relationshipRoundId: relationshipRound.roundId,
        relationshipRoundNo: relationshipRound.roundNo,
        relationshipRoundStatus: 'active' as const,
        attemptNo: nextAttemptNo,
        sourceScene: 'relationship' as const,
        lastUpdatedAt: timestamp,
      },
      ...supersedePendingCharacterRequests(prev.friendRequests || [], characterId, timestamp, requestId),
    ];
    const nextHistory = appendRelationshipMessages(prev.chatHistory, characterId, [
      createRelationshipSystemMessage(`你向 ${getRelationshipDisplayName(targetCharacter)} 发出了一条新的好友申请。`, timestamp),
    ]);

    persistCharactersIfChanged(prev.characters, nextCharacters, runtime.persistCharacters);
    return {
      ...prev,
      characters: nextCharacters,
      chatHistory: nextHistory,
      friendRequests: nextFriendRequests,
    };
  });

  void (async () => {
    let generated = null;
    try {
      generated = await generateRelationshipEventReply({
        settings: runtime.settings,
        character: targetCharacter,
        allCharacters: runtime.appData.characters,
        userName: runtime.appData.userProfile.name,
        history: historySnapshot,
        directChatHistory: runtime.appData.chatHistory,
        chatGroups: runtime.appData.chatGroups || [],
        masks: runtime.appData.masks,
        worldBook: runtime.appData.worldBooks || [],
        perception: runtime.appData.perception,
        coupleSpace: getRuntimeCoupleSpace(runtime),
        event: {
          kind: 'user_sent_friend_request',
          note: trimmedMessage,
        },
      });
    } catch {
      generated = null;
    }

    runtime.setAppData((prev) => {
      const currentCharacter = prev.characters.find((character) => character.id === characterId);
      const pendingRequest = (prev.friendRequests || []).find((request) => request.id === requestId);
      if (!currentCharacter || !pendingRequest || pendingRequest.status !== 'pending') {
        return prev;
      }

      const currentHistory = prev.chatHistory[characterId] || [];
      const relationshipRoundId = getFriendRequestRelationshipRoundId(pendingRequest) || relationshipRound.roundId;
      const relationshipRoundNo = Math.max(
        1,
        getFriendRequestRelationshipRoundNo(pendingRequest) || relationshipRound.roundNo,
      );
      const fallback = decideCharacterFriendRequestResponse(currentCharacter, currentHistory, trimmedMessage);
      const decision = generated?.decision;
      const reactionText = generated?.reactionText?.trim() || '';
      const generatedRequestMessage = generated?.requestMessage?.trim() || undefined;
      let nextCharacters = prev.characters;
      let nextFriendRequests = prev.friendRequests || [];
      let statusMessageText = `${getRelationshipDisplayName(currentCharacter)} 回复了你的好友申请。`;

      if (decision === 'accept' || (!decision && fallback.outcome === 'accept')) {
        nextCharacters = prev.characters.map((character) => (
          character.id === characterId
            ? {
                ...character,
                friendshipStatus: 'friends' as const,
                blockedByUser: false,
                blockedByCharacter: false,
                relationshipStatusUpdatedAt: timestamp,
                ...(pendingRequest.requestKind === 'reconnect'
                  ? {
                      shortTermSummary: applyRelationshipRecoveryContext(character, 'reconnect_accepted'),
                    }
                  : {}),
              }
            : character
        ));
        nextFriendRequests = nextFriendRequests.map((request) => (
          request.id === requestId
              ? {
                  ...request,
                  status: 'accepted' as const,
                  relationshipRoundStatus: 'resolved' as const,
                  relationshipRoundResolvedAt: timestamp,
                  resolutionMessage: fallback.resolutionMessage,
                  ...(reactionText ? { responseText: reactionText } : {}),
                  lastUpdatedAt: timestamp,
                }
            : request
        ));
        nextFriendRequests = markRelationshipRoundResolved(nextFriendRequests, relationshipRoundId, timestamp);
        statusMessageText = `${getRelationshipDisplayName(currentCharacter)} 通过了你的好友申请。`;
      } else if (generatedRequestMessage && (decision === 'counter_request' || (!decision && fallback.outcome === 'counter_request'))) {
        const counterRequestId = `friend-request-counter-${characterId}-${timestamp + 1}`;
        const threadId = getCharacterFriendRequestThreadId(characterId);
        const attemptNo = getNextCharacterRequestAttemptNo(
          prev.friendRequests || [],
          characterId,
          'character',
          relationshipRoundId,
        );
        nextFriendRequests = [
          {
            id: counterRequestId,
            fromUserId: characterId,
            fromUserName: getRelationshipDisplayName(currentCharacter),
            fromUserAvatar: currentCharacter.avatar,
            status: 'pending' as const,
            timestamp: timestamp + 1,
            direction: 'incoming' as const,
            initiator: 'character' as const,
            requestKind: 'reconnect' as const,
            characterId,
            threadId,
            relationshipRoundId,
            relationshipRoundNo,
            relationshipRoundStatus: 'active' as const,
            attemptNo,
            isUnread: true,
            unreadAt: timestamp + 1,
            sourceScene: 'relationship' as const,
            lastUpdatedAt: timestamp + 1,
            ...(generatedRequestMessage ? { message: generatedRequestMessage } : {}),
          },
          ...nextFriendRequests.map((request) => (
            request.id === requestId
              ? {
                  ...request,
                  status: 'superseded' as const,
                  supersededById: counterRequestId,
                  resolutionMessage: '对方没有直接通过，而是回了一条新的好友申请',
                  ...(reactionText ? { responseText: reactionText } : {}),
                  lastUpdatedAt: timestamp,
                }
              : request
          )),
        ];
        statusMessageText = `${getRelationshipDisplayName(currentCharacter)} 没有直接通过，而是回了一条新的好友申请。`;
      } else {
        const shouldBlock = decision === 'reject_and_block'
          ? true
          : decision === 'reject'
            ? false
            : fallback.outcome === 'reject'
              ? fallback.counterBlock
              : false;
        nextCharacters = prev.characters.map((character) => (
          character.id === characterId
            ? {
                ...character,
                friendshipStatus: 'none' as const,
                blockedByCharacter: shouldBlock,
                relationshipStatusUpdatedAt: timestamp,
              }
            : character
        ));
        nextFriendRequests = nextFriendRequests.map((request) => (
          request.id === requestId
              ? {
                  ...request,
                  status: 'rejected' as const,
                  resolutionMessage: shouldBlock ? '对方拒绝了申请，并把你拉黑了' : '对方拒绝了你的申请',
                  ...(reactionText ? { responseText: reactionText } : {}),
                  lastUpdatedAt: timestamp,
              }
            : request
        ));
        nextFriendRequests = markRelationshipRoundAbandoned(nextFriendRequests, relationshipRoundId, timestamp);
        statusMessageText = shouldBlock
          ? `${getRelationshipDisplayName(currentCharacter)} 拒绝了你的申请，并把你拉黑了。`
          : `${getRelationshipDisplayName(currentCharacter)} 拒绝了你的好友申请。`;
      }

      const nextHistory = appendRelationshipMessages(prev.chatHistory, characterId, [
        createRelationshipSystemMessage(statusMessageText, timestamp + 1),
      ]);

      persistCharactersIfChanged(prev.characters, nextCharacters, runtime.persistCharacters);
      return {
        ...prev,
        characters: nextCharacters,
        chatHistory: nextHistory,
        friendRequests: nextFriendRequests,
      };
    });
  })();

  return true;
}

export function runRelationshipBlockToggleFlow(params: {
  runtime: RelationshipFlowRuntime;
  characterId: string;
  targetCharacter?: Character | null;
}) {
  const { runtime, characterId } = params;
  const targetCharacter = params.targetCharacter || runtime.appData.characters.find((character) => character.id === characterId) || null;
  if (!targetCharacter) {
    return false;
  }

  const historySnapshot = runtime.appData.chatHistory[characterId] || [];
  const timestamp = Date.now();
  const isUnblocking = targetCharacter.blockedByUser === true;
  const displayName = getRelationshipDisplayName(targetCharacter);
  const relationshipRound = resolveRelationshipRoundForWrite(
    runtime.appData.friendRequests || [],
    characterId,
    timestamp,
  );
  const canCreateBlockedFollowupRequest = !isUnblocking && canCreateCharacterRequestAttempt(
    runtime.appData.friendRequests || [],
    characterId,
    'character',
    relationshipRound.roundId,
  );
  const relationshipBlockRollbackSnapshot = !isUnblocking
    ? {
        friendshipStatus: targetCharacter.friendshipStatus === 'none' ? 'none' as const : 'friends' as const,
        blockedByUser: targetCharacter.blockedByUser === true,
        blockedByCharacter: targetCharacter.blockedByCharacter === true,
        capturedAt: timestamp,
      }
    : undefined;

  runtime.setAppData((prev) => {
    const nextCharacters = prev.characters.map((character) => (
      character.id === characterId
        ? {
            ...character,
            friendshipStatus: isUnblocking ? character.friendshipStatus : 'none' as const,
            blockedByUser: !isUnblocking,
            ...(isUnblocking
              ? { relationshipBlockRollbackSnapshot: undefined }
              : { relationshipBlockRollbackSnapshot }),
            relationshipStatusUpdatedAt: timestamp,
          }
        : character
    ));
    const nextFriendRequests = supersedePendingCharacterRequests(
      prev.friendRequests || [],
      characterId,
      timestamp,
    );
    const nextChatHistory = appendRelationshipMessages(prev.chatHistory, characterId, [
      createRelationshipSystemMessage(
        isUnblocking
          ? `你把 ${displayName} 从黑名单里放了出来。`
          : `你把 ${displayName} 拉黑了。`,
        timestamp,
      ),
    ]);

    persistCharactersIfChanged(prev.characters, nextCharacters, runtime.persistCharacters);
    return {
      ...prev,
      characters: nextCharacters,
      chatHistory: nextChatHistory,
      friendRequests: nextFriendRequests,
    };
  });

  void (async () => {
    let generated = null;
    try {
      generated = await generateRelationshipEventReply({
        settings: runtime.settings,
        character: targetCharacter,
        allCharacters: runtime.appData.characters,
        userName: runtime.appData.userProfile.name,
        history: historySnapshot,
        directChatHistory: runtime.appData.chatHistory,
        chatGroups: runtime.appData.chatGroups || [],
        masks: runtime.appData.masks,
        worldBook: runtime.appData.worldBooks || [],
        perception: runtime.appData.perception,
        coupleSpace: getRuntimeCoupleSpace(runtime),
        event: {
          kind: isUnblocking ? 'user_unblocked_character' : 'user_blocked_character',
        },
      });
    } catch {
      generated = null;
    }

    runtime.setAppData((prev) => {
      const currentCharacter = prev.characters.find((character) => character.id === characterId);
      if (!currentCharacter || currentCharacter.relationshipStatusUpdatedAt !== timestamp) {
        return prev;
      }

      const currentHistory = prev.chatHistory[characterId] || [];
      let nextCharacters = prev.characters;
      let nextFriendRequests = prev.friendRequests || [];

      if (isUnblocking) {
        const fallback = decideCharacterUnblockGesture(currentCharacter, currentHistory);
        const reactionText = generated?.reactionText?.trim() || '';
        const followupRequestMessage = generated?.requestMessage?.trim() || undefined;
        const shouldSendRequest = generated?.decision === 'send_request'
          ? !!followupRequestMessage
          : generated?.decision === 'wait_for_user'
            ? false
            : fallback.sendRequest;
        nextCharacters = prev.characters.map((character) => (
          character.id === characterId
            ? {
                ...character,
                blockedByUser: false,
                relationshipStatusUpdatedAt: timestamp,
                shortTermSummary: applyRelationshipRecoveryContext(character, 'unblocked'),
              }
            : character
        ));

        if (shouldSendRequest) {
          const requestId = `friend-request-${characterId}-${timestamp}`;
          const threadId = getCharacterFriendRequestThreadId(characterId);
          const attemptNo = getNextCharacterRequestAttemptNo(
            prev.friendRequests || [],
            characterId,
            'character',
            relationshipRound.roundId,
          );
          nextFriendRequests = [
            {
              id: requestId,
              fromUserId: characterId,
              fromUserName: getRelationshipDisplayName(currentCharacter),
              fromUserAvatar: currentCharacter.avatar,
              status: 'pending' as const,
              timestamp,
              direction: 'incoming' as const,
              initiator: 'character' as const,
              requestKind: 'reconnect' as const,
              characterId,
              threadId,
              relationshipRoundId: relationshipRound.roundId,
              relationshipRoundNo: relationshipRound.roundNo,
              relationshipRoundStatus: 'active' as const,
              attemptNo,
              isUnread: true,
              unreadAt: timestamp,
              sourceScene: 'relationship' as const,
              lastUpdatedAt: timestamp,
              ...(followupRequestMessage ? { message: followupRequestMessage } : {}),
              ...(reactionText ? { responseText: reactionText } : {}),
            },
            ...supersedePendingCharacterRequests(nextFriendRequests, characterId, timestamp, requestId),
          ];
        } else {
          nextFriendRequests = [
            createRelationshipEventThreadEntry({
              characterId,
              characterName: getRelationshipDisplayName(currentCharacter),
              characterAvatar: currentCharacter.avatar,
              relationshipRoundId: relationshipRound.roundId,
              relationshipRoundNo: relationshipRound.roundNo,
              timestamp,
              reactionText: reactionText || '',
              resolutionMessage: `你把 ${getRelationshipDisplayName(currentCharacter)} 从黑名单里放了出来。`,
              eventKind: 'user_unblocked_character',
            }),
            ...nextFriendRequests,
          ];
          nextFriendRequests = markRelationshipRoundAbandoned(
            nextFriendRequests,
            relationshipRound.roundId,
            timestamp,
          );
        }

        const displayName = getRelationshipDisplayName(currentCharacter);
        const reactionMessageStartAt = timestamp + (shouldSendRequest ? 3 : 2);
        const reactionMessages = buildRelationshipReactionMessages(
          currentCharacter,
          reactionText,
          reactionMessageStartAt,
          {
            intensity: shouldSendRequest ? 'high' : 'normal',
          },
        );
        const nextChatHistory = appendRelationshipMessages(prev.chatHistory, characterId, [
          ...(shouldSendRequest
            ? [createRelationshipSystemMessage(`${displayName} 没有直接加回你，而是回了一条新的好友申请。`, timestamp + 1)]
            : []),
          createRelationshipSystemMessage(
            buildRelationshipReactionNoticeLabel(displayName, { kind: 'unblocked' }),
            timestamp + (shouldSendRequest ? 2 : 1),
            { tone: 'danger' },
          ),
          ...reactionMessages,
          ...(shouldSendRequest
            ? [createRelationshipFriendRequestNoticeMessage(displayName, reactionMessageStartAt + reactionMessages.length)]
            : []),
        ]);

        persistCharactersIfChanged(prev.characters, nextCharacters, runtime.persistCharacters);
        return {
          ...prev,
          characters: nextCharacters,
          chatHistory: nextChatHistory,
          friendRequests: nextFriendRequests,
        };
      }

      if (!generated) {
        return prev;
      }

      const reactionText = generated.reactionText?.trim() || '';
      const followupRequestMessage = generated.requestMessage?.trim() || undefined;
      const { shouldCounterBlock, shouldSendRequest } = resolveBlockedRelationshipFollowupPlan({
        canCreateRequest: canCreateBlockedFollowupRequest && !!followupRequestMessage,
        decision: generated.decision,
      });
      nextCharacters = prev.characters.map((character) => (
        character.id === characterId
          ? {
              ...character,
              friendshipStatus: 'none' as const,
              blockedByUser: true,
              blockedByCharacter: shouldCounterBlock,
              relationshipBlockRollbackSnapshot: undefined,
              relationshipStatusUpdatedAt: timestamp,
            }
          : character
      ));

      if (shouldSendRequest) {
        const displayName = getRelationshipDisplayName(currentCharacter);
        const followupRequestId = `friend-request-${characterId}-${timestamp}`;
        const followupThreadId = getCharacterFriendRequestThreadId(characterId);
        const followupAttemptNo = getNextCharacterRequestAttemptNo(
          prev.friendRequests || [],
          characterId,
          'character',
          relationshipRound.roundId,
        );
        const followupRequest = {
          id: followupRequestId,
          fromUserId: characterId,
          fromUserName: displayName,
          fromUserAvatar: currentCharacter.avatar,
          status: 'pending' as const,
          timestamp,
          direction: 'incoming' as const,
          initiator: 'character' as const,
          requestKind: 'reconnect' as const,
          characterId,
          threadId: followupThreadId,
          relationshipRoundId: relationshipRound.roundId,
          relationshipRoundNo: relationshipRound.roundNo,
          relationshipRoundStatus: 'active' as const,
          attemptNo: followupAttemptNo,
          isUnread: true,
          unreadAt: timestamp,
          sourceScene: 'relationship' as const,
          lastUpdatedAt: timestamp,
          message: followupRequestMessage,
          ...(reactionText ? { responseText: reactionText } : {}),
        };
        nextFriendRequests = [
          createRelationshipEventThreadEntry({
            characterId,
            characterName: displayName,
            characterAvatar: currentCharacter.avatar,
            relationshipRoundId: relationshipRound.roundId,
            relationshipRoundNo: relationshipRound.roundNo,
            timestamp,
            reactionText,
            resolutionMessage: shouldCounterBlock
              ? `${displayName} 也把你拉黑了。`
              : `你把 ${displayName} 拉黑了。`,
            eventKind: shouldCounterBlock ? 'character_counter_blocked' : 'user_blocked_character',
            ...(shouldCounterBlock ? { isUnread: true } : {}),
          }),
          followupRequest,
          ...supersedePendingCharacterRequests(
            nextFriendRequests,
            characterId,
            timestamp,
            followupRequestId,
          ),
        ];
      } else {
        nextFriendRequests = [
          createRelationshipEventThreadEntry({
            characterId,
            characterName: getRelationshipDisplayName(currentCharacter),
            characterAvatar: currentCharacter.avatar,
            relationshipRoundId: relationshipRound.roundId,
            relationshipRoundNo: relationshipRound.roundNo,
            timestamp,
            reactionText: reactionText || '',
            resolutionMessage: shouldCounterBlock
              ? `${getRelationshipDisplayName(currentCharacter)} 也把你拉黑了。`
              : `你把 ${getRelationshipDisplayName(currentCharacter)} 拉黑了。`,
            eventKind: shouldCounterBlock ? 'character_counter_blocked' : 'user_blocked_character',
            ...(shouldCounterBlock ? { isUnread: true } : {}),
          }),
          ...supersedePendingCharacterRequests(
            nextFriendRequests,
            characterId,
            timestamp,
          ),
        ];
        nextFriendRequests = markRelationshipRoundAbandoned(
          nextFriendRequests,
          relationshipRound.roundId,
          timestamp,
        );
      }

        const displayName = getRelationshipDisplayName(currentCharacter);
        const reactionMessageStartAt = timestamp + (shouldSendRequest ? 4 : shouldCounterBlock ? 3 : 2);
        const reactionMessages = buildRelationshipReactionMessages(
          currentCharacter,
          reactionText,
          reactionMessageStartAt,
          {
            intensity: shouldSendRequest || shouldCounterBlock ? 'high' : 'normal',
          },
        );
        const nextChatHistory = appendRelationshipMessages(prev.chatHistory, characterId, [
          ...(shouldSendRequest
            ? [createRelationshipSystemMessage(`${displayName} 看起来还没打算就这样算了。`, timestamp + 1)]
            : []),
          ...(shouldCounterBlock
            ? [createRelationshipSystemMessage(`${displayName} 也把你拉黑了。`, timestamp + (shouldSendRequest ? 2 : 1))]
            : []),
          createRelationshipSystemMessage(
            buildRelationshipReactionNoticeLabel(displayName, { kind: 'blocked' }),
            timestamp + (shouldSendRequest ? 3 : shouldCounterBlock ? 2 : 1),
            { tone: 'danger' },
          ),
          ...reactionMessages,
          ...(shouldSendRequest
            ? [createRelationshipFriendRequestNoticeMessage(displayName, reactionMessageStartAt + reactionMessages.length)]
            : []),
        ]);

        persistCharactersIfChanged(prev.characters, nextCharacters, runtime.persistCharacters);
        return {
          ...prev,
          characters: nextCharacters,
          chatHistory: nextChatHistory,
          friendRequests: nextFriendRequests,
        };
    });
  })();

  return true;
}

export function runRelationshipBlockRepairFlow(params: {
  runtime: RelationshipFlowRuntime;
  characterId: string;
  targetCharacter?: Character | null;
}) {
  const { runtime, characterId } = params;
  const targetCharacter = params.targetCharacter || runtime.appData.characters.find((character) => character.id === characterId) || null;
  const rollbackSnapshot = targetCharacter?.relationshipBlockRollbackSnapshot;
  if (!targetCharacter || !rollbackSnapshot) {
    return false;
  }

  const timestamp = Date.now();
  const displayName = getRelationshipDisplayName(targetCharacter);

  runtime.setAppData((prev) => {
    const currentCharacter = prev.characters.find((character) => character.id === characterId);
    const currentSnapshot = currentCharacter?.relationshipBlockRollbackSnapshot;
    if (!currentCharacter || !currentSnapshot) {
      return prev;
    }

    const nextCharacters = prev.characters.map((character) => (
      character.id === characterId
        ? {
            ...character,
            friendshipStatus: currentSnapshot.friendshipStatus,
            blockedByUser: currentSnapshot.blockedByUser,
            blockedByCharacter: currentSnapshot.blockedByCharacter,
            relationshipBlockRollbackSnapshot: undefined,
            relationshipStatusUpdatedAt: timestamp,
          }
        : character
    ));
    const nextFriendRequests = (prev.friendRequests || []).filter((request) => {
      if (getFriendRequestCharacterId(request) !== characterId) {
        return true;
      }

      const requestUpdatedAt = Math.max(request.lastUpdatedAt || 0, request.timestamp || 0);
      if (requestUpdatedAt < currentSnapshot.capturedAt) {
        return true;
      }

      return request.sourceScene !== 'relationship'
        && request.requestKind !== 'reconnect'
        && !request.isRelationshipEvent;
    });
    const nextChatHistory = appendRelationshipMessages(prev.chatHistory, characterId, [
      createRelationshipSystemMessage(`已修复 ${displayName} 的关系状态，并回到拉黑前。`, timestamp),
    ]);

    persistCharactersIfChanged(prev.characters, nextCharacters, runtime.persistCharacters);
    return {
      ...prev,
      characters: nextCharacters,
      chatHistory: nextChatHistory,
      friendRequests: nextFriendRequests,
    };
  });

  return true;
}

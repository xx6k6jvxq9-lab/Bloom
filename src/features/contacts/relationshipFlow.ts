import type {
  AppData,
  AppSettings,
  Character,
  ChatMessage,
  CoupleSpaceData,
  FriendRequest,
} from '../../types';
import {
  buildCharacterIncomingRequestResolution,
  createRelationshipSystemMessage,
  decideCharacterBlockReaction,
  decideCharacterFriendRequestResponse,
  decideCharacterRequestAfterBeingBlocked,
  decideCharacterRetryAfterRejectedRequest,
  decideCharacterUnblockGesture,
  getCharacterBlockState,
  getFriendRequestCharacterId,
  supersedePendingCharacterRequests,
} from './contactRelationship';
import {
  canCreateCharacterRequestAttempt,
  getCharacterFriendRequestThreadId,
  getNextCharacterRequestAttemptNo,
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
  timestamp: number;
  reactionText: string;
  resolutionMessage: string;
  eventKind: FriendRequest['eventKind'];
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
    isRelationshipEvent: true,
    eventKind: params.eventKind,
    resolutionMessage: params.resolutionMessage,
    responseText: params.reactionText,
    sourceScene: 'relationship',
    lastUpdatedAt: params.timestamp,
  };
}

export function applyNonForumFriendRequestResolution(
  prev: AppData,
  params: {
    requestId: string;
    accepted: boolean;
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

  if (!characterId) {
    return {
      nextAppData: {
        ...prev,
        friendRequests: (prev.friendRequests || []).map((entry) => (
          entry.id === params.requestId
            ? {
                ...entry,
                status: params.accepted ? 'accepted' : 'rejected',
                resolutionMessage: params.accepted ? '你已通过这条好友申请' : '你拒绝了这条好友申请',
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
          }
        : character
    ))
    : prev.characters;
  const nextFriendRequests = params.accepted
    ? (prev.friendRequests || []).map((entry) => {
      if (getFriendRequestCharacterId(entry) !== characterId || entry.status !== 'pending') {
        return entry;
      }
      if (entry.id === params.requestId) {
        return {
          ...entry,
          status: 'accepted' as const,
          resolutionMessage: '你已通过这条好友申请',
          lastUpdatedAt: timestamp,
        };
      }
      return {
        ...entry,
        status: 'superseded' as const,
        resolutionMessage: '关系已恢复，旧申请自动归档',
        lastUpdatedAt: timestamp,
      };
    })
    : (prev.friendRequests || []).map((entry) => (
      entry.id === params.requestId
        ? {
            ...entry,
            status: 'rejected' as const,
            resolutionMessage: '你拒绝了这条好友申请',
            lastUpdatedAt: timestamp,
          }
        : entry
    ));
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
}) {
  const { runtime, requestId, characterId, accepted } = params;
  const targetCharacter = runtime.appData.characters.find((character) => character.id === characterId);
  if (!targetCharacter) {
    return;
  }

  const historySnapshot = runtime.appData.chatHistory[characterId] || [];

  void (async () => {
    const generated = await generateRelationshipEventReply({
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
      },
    });

    runtime.setAppData((prev) => {
      const currentCharacter = prev.characters.find((character) => character.id === characterId);
      const currentRequest = (prev.friendRequests || []).find((request) => request.id === requestId);
      const expectedStatus = accepted ? 'accepted' : 'rejected';
      if (!currentCharacter || !currentRequest || currentRequest.status !== expectedStatus) {
        return prev;
      }

      const nextAttemptNo = getNextCharacterRequestAttemptNo(prev.friendRequests || [], characterId, 'character');
      const retryFallback = decideCharacterRetryAfterRejectedRequest(
        currentCharacter,
        prev.chatHistory[characterId] || [],
        nextAttemptNo,
      );
      const canRetry = !accepted && canCreateCharacterRequestAttempt(prev.friendRequests || [], characterId, 'character');
      const shouldSendFollowupRequest = canRetry && (
        generated?.decision === 'send_request'
          ? true
          : generated?.decision === 'none'
            ? false
            : !!retryFallback.sendRequest
      );
      const reactionText = generated?.reactionText?.trim()
        || (!accepted && shouldSendFollowupRequest
          ? retryFallback.reactionText
          : buildCharacterIncomingRequestResolution(currentCharacter, accepted));
      const reactionTimestamp = Date.now();
      const followupRequestId = shouldSendFollowupRequest
        ? `friend-request-${characterId}-${reactionTimestamp}`
        : null;
      const followupThreadId = followupRequestId ? getCharacterFriendRequestThreadId(characterId) : null;

      return {
        ...prev,
        friendRequests: [
          ...(shouldSendFollowupRequest && followupRequestId && followupThreadId
            ? [{
                id: followupRequestId,
                fromUserId: characterId,
                fromUserName: getRelationshipDisplayName(currentCharacter),
                fromUserAvatar: currentCharacter.avatar,
                status: 'pending' as const,
                timestamp: reactionTimestamp,
                message: generated?.requestMessage || retryFallback.requestMessage || '我还是想把这次关系再认真问一次。',
                direction: 'incoming' as const,
                initiator: 'character' as const,
                requestKind: currentRequest.requestKind || 'reconnect',
                characterId,
                threadId: followupThreadId,
                attemptNo: nextAttemptNo,
                sourceScene: 'relationship' as const,
                lastUpdatedAt: reactionTimestamp,
              }]
            : []),
          ...(prev.friendRequests || []).map((request) => (
            request.id === requestId
              ? {
                  ...request,
                  responseText: reactionText,
                  lastUpdatedAt: reactionTimestamp,
                }
              : request
          )),
        ],
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

  if (!canCreateCharacterRequestAttempt(runtime.appData.friendRequests || [], characterId, 'user')) {
    return false;
  }

  const historySnapshot = runtime.appData.chatHistory[characterId] || [];
  const trimmedMessage = message.trim() || '想把你加回来，之后继续好好聊。';
  const currentBlockState = getCharacterBlockState(targetCharacter);
  const requestKind = currentBlockState === 'none' ? 'friend' as const : 'reconnect' as const;
  const timestamp = Date.now();
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
    const attemptNo = getNextCharacterRequestAttemptNo(prev.friendRequests || [], characterId, 'user');
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
        attemptNo,
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
    const generated = await generateRelationshipEventReply({
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

    runtime.setAppData((prev) => {
      const currentCharacter = prev.characters.find((character) => character.id === characterId);
      const pendingRequest = (prev.friendRequests || []).find((request) => request.id === requestId);
      if (!currentCharacter || !pendingRequest || pendingRequest.status !== 'pending') {
        return prev;
      }

      const currentHistory = prev.chatHistory[characterId] || [];
      const fallback = decideCharacterFriendRequestResponse(currentCharacter, currentHistory, trimmedMessage);
      const decision = generated?.decision;
      const reactionText = generated?.reactionText?.trim() || fallback.reactionText;
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
              }
            : character
        ));
        nextFriendRequests = nextFriendRequests.map((request) => (
          request.id === requestId
            ? {
                ...request,
                status: 'accepted' as const,
                resolutionMessage: generated?.reactionText ? '对方通过了你的申请' : fallback.resolutionMessage,
                responseText: reactionText,
                lastUpdatedAt: timestamp,
              }
            : request
        ));
        statusMessageText = `${getRelationshipDisplayName(currentCharacter)} 通过了你的好友申请。`;
      } else if (decision === 'counter_request' || (!decision && fallback.outcome === 'counter_request')) {
        const counterRequestId = `friend-request-counter-${characterId}-${timestamp + 1}`;
        const threadId = getCharacterFriendRequestThreadId(characterId);
        const attemptNo = getNextCharacterRequestAttemptNo(prev.friendRequests || [], characterId, 'character');
        nextFriendRequests = [
          {
            id: counterRequestId,
            fromUserId: characterId,
            fromUserName: getRelationshipDisplayName(currentCharacter),
            fromUserAvatar: currentCharacter.avatar,
            status: 'pending' as const,
            timestamp: timestamp + 1,
            message: generated?.requestMessage || (fallback.outcome === 'counter_request' ? fallback.requestMessage : '这次换我来递申请。'),
            direction: 'incoming' as const,
            initiator: 'character' as const,
            requestKind: 'reconnect' as const,
            characterId,
            threadId,
            attemptNo,
            sourceScene: 'relationship' as const,
            lastUpdatedAt: timestamp + 1,
          },
          ...nextFriendRequests.map((request) => (
            request.id === requestId
              ? {
                  ...request,
                  status: 'superseded' as const,
                  supersededById: counterRequestId,
                  resolutionMessage: '对方没有直接通过，而是回了一条新的好友申请',
                  responseText: reactionText,
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
                responseText: reactionText,
                lastUpdatedAt: timestamp,
              }
            : request
        ));
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

  runtime.setAppData((prev) => {
    const nextCharacters = prev.characters.map((character) => (
      character.id === characterId
        ? {
            ...character,
            friendshipStatus: isUnblocking ? character.friendshipStatus : 'none' as const,
            blockedByUser: !isUnblocking,
            relationshipStatusUpdatedAt: timestamp,
          }
        : character
    ));
    const nextFriendRequests = supersedePendingCharacterRequests(prev.friendRequests || [], characterId, timestamp);
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
    const generated = await generateRelationshipEventReply({
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
        const reactionText = generated?.reactionText?.trim() || fallback.reactionText;
        const shouldSendRequest = generated?.decision === 'send_request'
          ? true
          : generated?.decision === 'wait_for_user'
            ? false
            : fallback.sendRequest;
        nextCharacters = prev.characters.map((character) => (
          character.id === characterId
            ? {
                ...character,
                blockedByUser: false,
                relationshipStatusUpdatedAt: timestamp,
              }
            : character
        ));
        if (shouldSendRequest) {
          const requestId = `friend-request-${characterId}-${timestamp}`;
          const threadId = getCharacterFriendRequestThreadId(characterId);
          const attemptNo = getNextCharacterRequestAttemptNo(prev.friendRequests || [], characterId, 'character');
          nextFriendRequests = [
            {
              id: requestId,
              fromUserId: characterId,
              fromUserName: getRelationshipDisplayName(currentCharacter),
              fromUserAvatar: currentCharacter.avatar,
              status: 'pending' as const,
              timestamp,
              message: generated?.requestMessage || fallback.requestMessage,
              responseText: reactionText,
              direction: 'incoming' as const,
              initiator: 'character' as const,
              requestKind: 'reconnect' as const,
              characterId,
              threadId,
              attemptNo,
              sourceScene: 'relationship' as const,
              lastUpdatedAt: timestamp,
            },
            ...supersedePendingCharacterRequests(nextFriendRequests, characterId, timestamp, requestId),
          ];
        } else {
          nextFriendRequests = [
            createRelationshipEventThreadEntry({
              characterId,
              characterName: getRelationshipDisplayName(currentCharacter),
              characterAvatar: currentCharacter.avatar,
              timestamp,
              reactionText,
              resolutionMessage: `你把 ${getRelationshipDisplayName(currentCharacter)} 从黑名单里放了出来。`,
              eventKind: 'user_unblocked_character',
            }),
            ...nextFriendRequests,
          ];
        }
        const nextChatHistory = appendRelationshipMessages(prev.chatHistory, characterId, [
          ...(shouldSendRequest
            ? [createRelationshipSystemMessage(`${getRelationshipDisplayName(currentCharacter)} 没有直接加回你，而是回了一条新的好友申请。`, timestamp + 1)]
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

      const blockFallback = decideCharacterBlockReaction(currentCharacter, currentHistory);
      const nextAttemptNo = getNextCharacterRequestAttemptNo(prev.friendRequests || [], characterId, 'character');
      const requestFallback = decideCharacterRequestAfterBeingBlocked(currentCharacter, currentHistory, nextAttemptNo);
      const canRetry = canCreateCharacterRequestAttempt(prev.friendRequests || [], characterId, 'character');
      const shouldSendRequest = canRetry && (
        generated?.decision === 'send_request'
          ? true
          : generated?.decision === 'counter_block' || generated?.decision === 'no_counter_block'
            ? false
            : !!requestFallback.sendRequest
      );
      const reactionText = generated?.reactionText?.trim()
        || (shouldSendRequest ? requestFallback.reactionText : blockFallback.reactionText);
      const shouldCounterBlock = shouldSendRequest
        ? false
        : generated?.decision === 'counter_block'
          ? true
          : generated?.decision === 'no_counter_block'
            ? false
            : blockFallback.counterBlock;
      nextCharacters = prev.characters.map((character) => (
        character.id === characterId
          ? {
              ...character,
              friendshipStatus: 'none' as const,
              blockedByUser: true,
              blockedByCharacter: shouldCounterBlock,
              relationshipStatusUpdatedAt: timestamp,
            }
          : character
      ));
      if (shouldSendRequest) {
        const requestId = `friend-request-${characterId}-${timestamp}`;
        const threadId = getCharacterFriendRequestThreadId(characterId);
        nextFriendRequests = [
          {
            id: requestId,
            fromUserId: characterId,
            fromUserName: getRelationshipDisplayName(currentCharacter),
            fromUserAvatar: currentCharacter.avatar,
            status: 'pending' as const,
            timestamp,
            message: generated?.requestMessage || requestFallback.requestMessage || '我还是想把这次关系认真问清楚。',
            responseText: reactionText,
            direction: 'incoming' as const,
            initiator: 'character' as const,
            requestKind: 'reconnect' as const,
            characterId,
            threadId,
            attemptNo: nextAttemptNo,
            sourceScene: 'relationship' as const,
            lastUpdatedAt: timestamp,
          },
          ...supersedePendingCharacterRequests(nextFriendRequests, characterId, timestamp, requestId),
        ];
      } else {
        nextFriendRequests = [
          createRelationshipEventThreadEntry({
            characterId,
            characterName: getRelationshipDisplayName(currentCharacter),
            characterAvatar: currentCharacter.avatar,
            timestamp,
            reactionText,
            resolutionMessage: shouldCounterBlock
              ? `${getRelationshipDisplayName(currentCharacter)} 也把你拉黑了。`
              : `你把 ${getRelationshipDisplayName(currentCharacter)} 拉黑了。`,
            eventKind: shouldCounterBlock ? 'character_counter_blocked' : 'user_blocked_character',
          }),
          ...nextFriendRequests,
        ];
      }
      const nextChatHistory = appendRelationshipMessages(prev.chatHistory, characterId, [
        ...(shouldSendRequest
          ? [createRelationshipSystemMessage(`${getRelationshipDisplayName(currentCharacter)} 气头上还是递来了一条新的好友申请。`, timestamp + 1)]
          : []),
        ...(shouldCounterBlock
          ? [createRelationshipSystemMessage(`${getRelationshipDisplayName(currentCharacter)} 也把你拉黑了。`, timestamp + (shouldSendRequest ? 2 : 1))]
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

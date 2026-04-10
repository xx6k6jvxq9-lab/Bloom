import type { ChatHistory, ChatMessage, CoupleSpaceData } from '../../types';

export type InteractionGapState = {
  minutesSinceLastDirectChat: number | null;
  minutesSinceLastGroupChat: number | null;
  minutesSinceLastUserMessage: number | null;
  minutesSinceLastCharacterReply: number | null;
  minutesSinceLastCoupleSpaceActivity: number | null;
  recentInteractionDensity: 'high' | 'medium' | 'low';
};

type BuildInteractionGapStateInput = {
  nowTimestamp: number;
  characterId: string;
  directChatHistory?: ChatHistory;
  groupMessages?: ChatMessage[];
  coupleSpace?: CoupleSpaceData;
};

function getMinutesSince(nowTimestamp: number, timestamp: number | null): number | null {
  if (timestamp == null) {
    return null;
  }

  return Math.max(0, Math.floor((nowTimestamp - timestamp) / 60000));
}

function getLatestTimestamp(values: Array<number | null | undefined>): number | null {
  const normalized = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (normalized.length === 0) {
    return null;
  }

  return Math.max(...normalized);
}

function getLatestCoupleSpaceTimestamp(coupleSpace?: CoupleSpaceData): number | null {
  if (!coupleSpace) {
    return null;
  }

  return getLatestTimestamp([
    coupleSpace.anniversaryDate,
    ...coupleSpace.coNotes.map((item) => item.timestamp),
    ...coupleSpace.ledger.map((item) => item.timestamp),
    ...coupleSpace.loveLetters.flatMap((item) => [item.timestamp, ...item.comments.map((comment) => comment.timestamp)]),
    ...(coupleSpace.moodStamps || []).map((item) => item.createdAt),
    ...(coupleSpace.heartCapsuleMachine?.history || []).map((item) => item.drawnAt),
    ...(coupleSpace.posts || []).map((item) => item.timestamp),
    ...(coupleSpace.messageBoard || []).map((item) => item.timestamp),
  ]);
}

export function buildInteractionGapState(input: BuildInteractionGapStateInput): InteractionGapState {
  const directMessages = input.directChatHistory?.[input.characterId] || [];
  const latestDirectChatTimestamp = getLatestTimestamp(directMessages.map((message) => message.timestamp));
  const latestUserMessageTimestamp = getLatestTimestamp(directMessages.filter((message) => message.role === 'user').map((message) => message.timestamp));
  const latestCharacterReplyTimestamp = getLatestTimestamp(directMessages.filter((message) => message.role === 'model' && !message.isSystem).map((message) => message.timestamp));
  const latestGroupChatTimestamp = getLatestTimestamp(input.groupMessages?.map((message) => message.timestamp) || []);
  const latestCoupleSpaceTimestamp = getLatestCoupleSpaceTimestamp(input.coupleSpace);

  const interactionWindowStart = input.nowTimestamp - (6 * 60 * 60 * 1000);
  const recentInteractionCount = [
    ...directMessages,
    ...(input.groupMessages || []),
  ].filter((message) => message.timestamp >= interactionWindowStart).length;

  let recentInteractionDensity: InteractionGapState['recentInteractionDensity'] = 'low';
  if (recentInteractionCount >= 10) {
    recentInteractionDensity = 'high';
  } else if (recentInteractionCount >= 4) {
    recentInteractionDensity = 'medium';
  }

  return {
    minutesSinceLastDirectChat: getMinutesSince(input.nowTimestamp, latestDirectChatTimestamp),
    minutesSinceLastGroupChat: getMinutesSince(input.nowTimestamp, latestGroupChatTimestamp),
    minutesSinceLastUserMessage: getMinutesSince(input.nowTimestamp, latestUserMessageTimestamp),
    minutesSinceLastCharacterReply: getMinutesSince(input.nowTimestamp, latestCharacterReplyTimestamp),
    minutesSinceLastCoupleSpaceActivity: getMinutesSince(input.nowTimestamp, latestCoupleSpaceTimestamp),
    recentInteractionDensity,
  };
}

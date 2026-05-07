import type { ChatMessage } from '../../types';

export type TopicHeatState = {
  currentTopicHeat: 'hot' | 'warm' | 'fading' | 'cold';
  topicDecayStage: 'fresh' | 'continuing' | 'overextended' | 'expired';
  topicFollowPressure: 'high' | 'medium' | 'low';
  suggestedTopicAction: 'continue' | 'soften' | 'shift' | 'close';
  lastTopicAnchor?: string;
  hasPendingEmotionalThread: boolean;
};

type BuildTopicHeatStateInput = {
  nowTimestamp: number;
  messages?: ChatMessage[];
  directMessages?: ChatMessage[];
};

function getMessageBody(message: ChatMessage): string {
  return (message.text || '')
    .replace(/^\[(?:sticker|image|audio|表情包|图片|语音)\]\s*/i, '')
    .trim();
}

function getLastTopicAnchor(messages: ChatMessage[]): string | undefined {
  const latestMeaningful = [...messages]
    .reverse()
    .find((message) => !message.isSystem && getMessageBody(message));

  if (!latestMeaningful) {
    return undefined;
  }

  return getMessageBody(latestMeaningful).replace(/\s+/g, ' ').slice(0, 28);
}

function hasPendingEmotion(messages: ChatMessage[]): boolean {
  return messages
    .slice(-6)
    .some((message) => /[?？!！]|想你|难受|哭|别走|不要|生气|委屈|讨厌|喜欢|想见|抱抱|亲亲|想抱|舍不得/.test(getMessageBody(message)));
}

function countRecentTurns(messages: ChatMessage[]): number {
  let turns = 0;
  let previousRole: ChatMessage['role'] | null = null;

  for (const message of messages) {
    if (message.role !== previousRole) {
      turns += 1;
      previousRole = message.role;
    }
  }

  return turns;
}

export function buildTopicHeatState(input: BuildTopicHeatStateInput): TopicHeatState {
  const messages = (input.messages || input.directMessages || []).filter((message) => !message.isSystem);
  const latestMessage = messages[messages.length - 1];
  const latestTimestamp = latestMessage?.timestamp ?? null;
  const minutesSinceLatest = latestTimestamp == null
    ? null
    : Math.max(0, Math.floor((input.nowTimestamp - latestTimestamp) / 60000));
  const recentWindowMessages = latestTimestamp == null
    ? []
    : messages.filter((message) => message.timestamp >= latestTimestamp - (30 * 60 * 1000));
  const recentMessageCount = recentWindowMessages.length;
  const recentTurnSwitches = countRecentTurns(recentWindowMessages.slice(-10));
  const hasPendingEmotionalThread = hasPendingEmotion(messages);

  let currentTopicHeat: TopicHeatState['currentTopicHeat'] = 'cold';
  let topicDecayStage: TopicHeatState['topicDecayStage'] = 'expired';
  let topicFollowPressure: TopicHeatState['topicFollowPressure'] = 'low';
  let suggestedTopicAction: TopicHeatState['suggestedTopicAction'] = 'close';

  if (minutesSinceLatest !== null && minutesSinceLatest <= 10) {
    const isOverextended = recentMessageCount >= 6 || recentTurnSwitches >= 5;
    currentTopicHeat = isOverextended ? 'hot' : 'warm';
    topicDecayStage = isOverextended ? 'overextended' : 'fresh';
    topicFollowPressure = hasPendingEmotionalThread ? 'high' : 'medium';
    suggestedTopicAction = isOverextended
      ? (hasPendingEmotionalThread ? 'soften' : 'shift')
      : 'continue';
  } else if (minutesSinceLatest !== null && minutesSinceLatest <= 60) {
    currentTopicHeat = 'fading';
    topicDecayStage = 'continuing';
    topicFollowPressure = hasPendingEmotionalThread ? 'medium' : 'low';
    suggestedTopicAction = hasPendingEmotionalThread ? 'soften' : 'shift';
  } else if (minutesSinceLatest !== null && minutesSinceLatest <= 12 * 60) {
    currentTopicHeat = 'cold';
    topicDecayStage = 'expired';
    topicFollowPressure = 'low';
    suggestedTopicAction = hasPendingEmotionalThread ? 'shift' : 'close';
  }

  return {
    currentTopicHeat,
    topicDecayStage,
    topicFollowPressure,
    suggestedTopicAction,
    lastTopicAnchor: getLastTopicAnchor(messages),
    hasPendingEmotionalThread,
  };
}

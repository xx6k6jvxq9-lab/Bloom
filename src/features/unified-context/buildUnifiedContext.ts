import type { ChatMessage } from '../../types';
import type { UnifiedContextInput, UnifiedContextResult } from './types';

function normalizeMessageForChannel(message: ChatMessage, input: UnifiedContextInput): ChatMessage {
  return {
    ...message,
    source: message.source || 'app',
    channel: message.channel || input.channel,
    channelConversationId: message.channelConversationId || input.conversationId,
  };
}

export function buildUnifiedContext(input: UnifiedContextInput): UnifiedContextResult {
  const history = input.chatHistory[input.character.id] || [];
  const recentMessageLimit = input.recentMessageLimit ?? 24;
  const normalizedHistory = history.map((message) => normalizeMessageForChannel(message, input));
  const channelRecentHistory = normalizedHistory.filter(
    (message) =>
      message.channelConversationId === input.conversationId
      || (input.channel === 'app' && !message.channelConversationId),
  );
  const activeWorldBookEntries = (input.worldBook || []).filter((entry) => {
    if (!entry.isActive) return false;
    if (entry.isGlobal) return true;
    return (entry.characterIds || []).includes(input.character.id);
  });

  const promptMessages = [
    ...normalizedHistory.slice(-recentMessageLimit),
    ...(input.incomingMessage ? [normalizeMessageForChannel(input.incomingMessage, input)] : []),
  ];

  return {
    characterId: input.character.id,
    channel: input.channel,
    conversationId: input.conversationId,
    longTermHistory: normalizedHistory,
    channelRecentHistory: channelRecentHistory.slice(-recentMessageLimit),
    activeWorldBookEntries,
    promptMessages,
  };
}

import type { ChatHistory, ChatMessage } from '../../types';
import type { UnifiedMemoryWritebackInput } from './types';

function normalizeMessage(message: ChatMessage, input: UnifiedMemoryWritebackInput): ChatMessage {
  return {
    ...message,
    source: message.source || (input.channel === 'app' ? 'app' : 'wechat'),
    channel: message.channel || input.channel,
    channelConversationId: message.channelConversationId || input.conversationId,
  };
}

function isDuplicateMessage(left: ChatMessage, right: ChatMessage): boolean {
  return (
    left.role === right.role
    && left.text === right.text
    && left.timestamp === right.timestamp
    && left.channelConversationId === right.channelConversationId
  );
}

export function applyUnifiedMemoryWriteback(input: UnifiedMemoryWritebackInput): ChatHistory {
  const currentHistory = input.chatHistory[input.characterId] || [];
  const nextMessages = [input.incomingMessage, input.replyMessage]
    .filter((message): message is ChatMessage => !!message)
    .map((message) => normalizeMessage(message, input));

  if (!nextMessages.length) {
    return input.chatHistory;
  }

  const dedupedMessages = nextMessages.filter((candidate) => !currentHistory.some((existing) => isDuplicateMessage(existing, candidate)));
  if (!dedupedMessages.length) {
    return input.chatHistory;
  }

  return {
    ...input.chatHistory,
    [input.characterId]: [...currentHistory, ...dedupedMessages],
  };
}

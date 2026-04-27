import type { Character, ChatHistory, ChatMessage, WorldBookEntry } from '../../types';

export type UnifiedChannel = 'app';

export type UnifiedContextInput = {
  channel: UnifiedChannel;
  character: Character;
  conversationId: string;
  incomingMessage?: ChatMessage | null;
  chatHistory: ChatHistory;
  worldBook?: WorldBookEntry[];
  recentMessageLimit?: number;
};

export type UnifiedContextResult = {
  characterId: string;
  channel: UnifiedChannel;
  conversationId: string;
  longTermHistory: ChatMessage[];
  channelRecentHistory: ChatMessage[];
  activeWorldBookEntries: WorldBookEntry[];
  promptMessages: ChatMessage[];
};

export type UnifiedMemoryWritebackInput = {
  characterId: string;
  conversationId: string;
  channel: UnifiedChannel;
  chatHistory: ChatHistory;
  incomingMessage?: ChatMessage | null;
  replyMessage?: ChatMessage | null;
};

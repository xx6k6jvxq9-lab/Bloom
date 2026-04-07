import type { ChatMessage } from '../../types';

export type GroupMessageSearchResult = {
  key: string;
  index: number;
  message: ChatMessage;
  preview: string;
  senderLabel: string;
};

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function buildPreview(text: string, query: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '(空消息)';
  }

  const normalizedText = trimmed.toLocaleLowerCase();
  const normalizedQuery = normalizeText(query);
  const matchIndex = normalizedText.indexOf(normalizedQuery);

  if (matchIndex < 0) {
    return trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed;
  }

  const start = Math.max(0, matchIndex - 20);
  const end = Math.min(trimmed.length, matchIndex + query.trim().length + 40);
  const snippet = trimmed.slice(start, end);

  return `${start > 0 ? '...' : ''}${snippet}${end < trimmed.length ? '...' : ''}`;
}

export function searchGroupMessages(
  messages: ChatMessage[],
  query: string,
  resolveSenderLabel: (message: ChatMessage) => string,
): GroupMessageSearchResult[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return [];
  }

  return messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => normalizeText(message.text).includes(normalizedQuery))
    .map(({ message, index }) => ({
      key: `${message.timestamp}-${index}`,
      index,
      message,
      preview: buildPreview(message.text, query),
      senderLabel: resolveSenderLabel(message),
    }))
    .reverse();
}

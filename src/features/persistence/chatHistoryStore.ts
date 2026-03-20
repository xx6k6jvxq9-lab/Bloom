import type { ChatGroup, ChatHistory, ChatMessage } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export type PersistedChatHistoryData = {
  directHistory: ChatHistory;
  groupHistories: Record<string, ChatMessage[]>;
};

function isChatMessageArray(value: unknown): value is ChatMessage[] {
  return Array.isArray(value);
}

function sanitizeDirectHistory(value: unknown, fallback: ChatHistory): ChatHistory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const result: ChatHistory = {};
  for (const [key, history] of Object.entries(value as Record<string, unknown>)) {
    if (isChatMessageArray(history)) {
      result[key] = history;
    }
  }
  return Object.keys(result).length > 0 ? result : fallback;
}

function sanitizeGroupHistories(
  value: unknown,
  fallback: Record<string, ChatMessage[]>,
): Record<string, ChatMessage[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const result: Record<string, ChatMessage[]> = {};
  for (const [key, history] of Object.entries(value as Record<string, unknown>)) {
    if (isChatMessageArray(history)) {
      result[key] = history;
    }
  }
  return Object.keys(result).length > 0 ? result : fallback;
}

export function hydrateChatHistoryRecords(
  source: Partial<PersistedChatHistoryData> | null | undefined,
  fallback: PersistedChatHistoryData,
): PersistedChatHistoryData {
  return {
    directHistory: sanitizeDirectHistory(source?.directHistory, fallback.directHistory),
    groupHistories: sanitizeGroupHistories(source?.groupHistories, fallback.groupHistories),
  };
}

export function loadChatHistoryRecords(
  fallback: PersistedChatHistoryData = { directHistory: {}, groupHistories: {} },
): PersistedChatHistoryData {
  const persisted = loadJson<Partial<PersistedChatHistoryData> | null>(STORAGE_KEYS.chatHistory, null);
  return hydrateChatHistoryRecords(persisted, fallback);
}

export function saveChatHistoryRecords(value: PersistedChatHistoryData): void {
  saveJson(STORAGE_KEYS.chatHistory, value);
}

export function patchChatHistoryRecords(
  updater: (current: PersistedChatHistoryData) => PersistedChatHistoryData,
  fallback: PersistedChatHistoryData = { directHistory: {}, groupHistories: {} },
): PersistedChatHistoryData {
  const nextValue = updater(loadChatHistoryRecords(fallback));
  saveChatHistoryRecords(nextValue);
  return nextValue;
}

export function resetChatHistoryRecords(): void {
  removeStoredJson(STORAGE_KEYS.chatHistory);
}

export function extractGroupHistories(chatGroups: ChatGroup[]): Record<string, ChatMessage[]> {
  return chatGroups.reduce<Record<string, ChatMessage[]>>((acc, group) => {
    acc[group.id] = group.history || [];
    return acc;
  }, {});
}

export function mergeGroupHistoriesIntoChatGroups(
  chatGroups: ChatGroup[],
  groupHistories: Record<string, ChatMessage[]>,
): ChatGroup[] {
  return chatGroups.map((group) => {
    if (!Object.prototype.hasOwnProperty.call(groupHistories, group.id)) {
      return group;
    }

    return {
      ...group,
      history: groupHistories[group.id],
    };
  });
}

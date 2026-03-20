import type { ChatGroup } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export type ChatOrganizationData = {
  groups: string[];
  chatGroups: ChatGroup[];
};

export function hydrateChatOrganization(
  source: Partial<ChatOrganizationData> | null | undefined,
  fallback: ChatOrganizationData,
): ChatOrganizationData {
  return {
    groups: Array.isArray(source?.groups) ? source!.groups : fallback.groups,
    chatGroups: Array.isArray(source?.chatGroups) ? source!.chatGroups : fallback.chatGroups,
  };
}

export function loadPersistedChatOrganization(fallback: ChatOrganizationData): ChatOrganizationData {
  const persisted = loadJson<Partial<ChatOrganizationData> | null>(STORAGE_KEYS.chatOrganization, null);
  return hydrateChatOrganization(persisted ? { ...fallback, ...persisted } : fallback, fallback);
}

export function persistChatOrganization(data: ChatOrganizationData): void {
  saveJson(STORAGE_KEYS.chatOrganization, data);
}

export function clearPersistedChatOrganization(): void {
  removeStoredJson(STORAGE_KEYS.chatOrganization);
}

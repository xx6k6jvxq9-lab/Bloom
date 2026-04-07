import type { ChatGroup } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export type ChatOrganizationData = {
  groups: string[];
  chatGroups: ChatGroup[];
};

function projectGroupOrganization(group: ChatGroup): ChatGroup {
  const { history: _history, lastMessage: _lastMessage, lastTime: _lastTime, ...organization } = group;
  return organization;
}

export function hydrateChatOrganization(
  source: Partial<ChatOrganizationData> | null | undefined,
  fallback: ChatOrganizationData,
): ChatOrganizationData {
  return {
    groups: Array.isArray(source?.groups) ? source!.groups : fallback.groups,
    chatGroups: Array.isArray(source?.chatGroups)
      ? source!.chatGroups.map(projectGroupOrganization)
      : fallback.chatGroups.map(projectGroupOrganization),
  };
}

export function loadPersistedChatOrganization(fallback: ChatOrganizationData): ChatOrganizationData {
  const persisted = loadJson<Partial<ChatOrganizationData> | null>(STORAGE_KEYS.chatOrganization, null);
  return hydrateChatOrganization(persisted ? { ...fallback, ...persisted } : fallback, fallback);
}

export function persistChatOrganization(data: ChatOrganizationData): void {
  saveJson(STORAGE_KEYS.chatOrganization, {
    groups: data.groups,
    chatGroups: data.chatGroups.map(projectGroupOrganization),
  });
}

export function mergeChatGroupOrganization(
  currentGroups: ChatGroup[],
  organizationGroups: ChatGroup[],
): ChatGroup[] {
  const currentGroupById = new Map(currentGroups.map((group) => [group.id, group]));
  const mergedGroups = organizationGroups.map((group) => {
    const currentGroup = currentGroupById.get(group.id);
    if (!currentGroup) {
      return group;
    }

    return {
      ...group,
      ...currentGroup,
    };
  });

  const organizationGroupIds = new Set(organizationGroups.map((group) => group.id));
  const currentOnlyGroups = currentGroups.filter((group) => !organizationGroupIds.has(group.id));

  return [...mergedGroups, ...currentOnlyGroups];
}

export function clearPersistedChatOrganization(): void {
  removeStoredJson(STORAGE_KEYS.chatOrganization);
}

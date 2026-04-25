import type { ChatGroup } from '../../types';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
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

function mergeGroups(primary: string[] | undefined, fallback: string[]): string[] {
  if (!Array.isArray(primary)) {
    return fallback;
  }

  return Array.from(new Set([...primary, ...fallback].filter(Boolean)));
}

export function hydrateChatOrganization(
  source: Partial<ChatOrganizationData> | null | undefined,
  fallback: ChatOrganizationData,
): ChatOrganizationData {
  const fallbackChatGroups = fallback.chatGroups.map(projectGroupOrganization);
  const sourceChatGroups = Array.isArray(source?.chatGroups)
    ? source!.chatGroups.map(projectGroupOrganization)
    : undefined;

  return {
    groups: mergeGroups(source?.groups, fallback.groups),
    chatGroups: sourceChatGroups
      ? mergeChatGroupOrganization(sourceChatGroups, fallbackChatGroups)
      : fallbackChatGroups,
  };
}

export function loadPersistedChatOrganization(fallback: ChatOrganizationData): ChatOrganizationData {
  const persisted = loadJson<Partial<ChatOrganizationData> | null>(STORAGE_KEYS.chatOrganization, null);
  const hydrated = hydrateChatOrganization(persisted ?? fallback, fallback);

  if (persisted && JSON.stringify(hydrated) !== JSON.stringify(hydrateChatOrganization(persisted, { groups: [], chatGroups: [] }))) {
    persistChatOrganizationSync(hydrated);
  }

  return hydrated;
}

export async function loadPreferredChatOrganization(fallback: ChatOrganizationData): Promise<ChatOrganizationData> {
  try {
    const persisted = await loadJsonRecord<Partial<ChatOrganizationData>>(STORAGE_KEYS.chatOrganization);
    if (persisted) {
      return hydrateChatOrganization(persisted, fallback);
    }
  } catch (error) {
    console.error('[chatOrganizationStore] Failed to load chat organization from IndexedDB', error);
  }

  return loadPersistedChatOrganization(fallback);
}

export function persistChatOrganization(data: ChatOrganizationData): Promise<void> {
  const projectedData = {
    groups: data.groups,
    chatGroups: data.chatGroups.map(projectGroupOrganization),
  };

  saveJson(STORAGE_KEYS.chatOrganization, projectedData);

  return saveJsonRecord(STORAGE_KEYS.chatOrganization, projectedData).catch((error) => {
    console.error('[chatOrganizationStore] Failed to persist chat organization into IndexedDB', error);
  });
}

export function persistChatOrganizationSync(data: ChatOrganizationData): void {
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
  void removeJsonRecord(STORAGE_KEYS.chatOrganization).catch((error) => {
    console.error('[chatOrganizationStore] Failed to remove chat organization from IndexedDB', error);
  });
}

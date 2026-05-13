import type { ChatGroup } from '../../types';
import { loadJsonRecordEnvelope, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { DEFAULT_CONTACT_GROUPS, normalizeContactGroups } from './contactGroupNames';
import { loadJson, remove as removeStoredJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export type ChatOrganizationData = {
  updatedAt?: number;
  groups: string[];
  chatGroups: ChatGroup[];
};

function projectChatOrganizationData(data: Partial<ChatOrganizationData> | ChatOrganizationData): ChatOrganizationData {
  return {
    ...(typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt)
      ? { updatedAt: data.updatedAt }
      : {}),
    groups: mergeGroups(data.groups, []),
    chatGroups: Array.isArray(data.chatGroups)
      ? data.chatGroups.map(projectGroupOrganization)
      : [],
  };
}

function projectGroupOrganization(group: ChatGroup): ChatGroup {
  const { history: _history, lastMessage: _lastMessage, lastTime: _lastTime, ...organization } = group;
  return organization;
}

function mergeGroups(primary: string[] | undefined, fallback: string[]): string[] {
  const mergedGroups = Array.from(
    new Set([
      ...normalizeContactGroups(primary),
      ...normalizeContactGroups(fallback),
    ]),
  );

  return mergedGroups.length > 0 ? mergedGroups : [...DEFAULT_CONTACT_GROUPS];
}

function resolveChatOrganizationUpdatedAt(
  source: Partial<ChatOrganizationData> | null | undefined,
  fallbackUpdatedAt = 0,
): number {
  if (typeof source?.updatedAt === 'number' && Number.isFinite(source.updatedAt)) {
    return source.updatedAt;
  }

  return Number.isFinite(fallbackUpdatedAt) ? fallbackUpdatedAt : 0;
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
  return hydrateChatOrganization(persisted ?? fallback, fallback);
}

export async function loadPreferredChatOrganization(fallback: ChatOrganizationData): Promise<ChatOrganizationData> {
  const legacyLocalOrganization = loadJson<Partial<ChatOrganizationData> | null>(STORAGE_KEYS.chatOrganization, null);

  try {
    const persistedEnvelope = await loadJsonRecordEnvelope<Partial<ChatOrganizationData>>(STORAGE_KEYS.chatOrganization);
    const indexedDbUpdatedAt = resolveChatOrganizationUpdatedAt(
      persistedEnvelope.value,
      persistedEnvelope.updatedAt ?? 0,
    );
    const localUpdatedAt = resolveChatOrganizationUpdatedAt(legacyLocalOrganization, 0);
    const shouldPreferIndexedDb = !!persistedEnvelope.value && (
      !legacyLocalOrganization || indexedDbUpdatedAt >= localUpdatedAt
    );

    if (shouldPreferIndexedDb && persistedEnvelope.value) {
      const indexedDbOrganization = hydrateChatOrganization({
        ...persistedEnvelope.value,
        ...(indexedDbUpdatedAt > 0 ? { updatedAt: indexedDbUpdatedAt } : {}),
      }, fallback);
      removeStoredJson(STORAGE_KEYS.chatOrganization);
      return indexedDbOrganization;
    }
  } catch (error) {
    console.error('[chatOrganizationStore] Failed to load chat organization from IndexedDB', error);
  }

  if (legacyLocalOrganization) {
    const migratedOrganization = hydrateChatOrganization(legacyLocalOrganization, fallback);

    try {
      await saveJsonRecord(STORAGE_KEYS.chatOrganization, projectChatOrganizationData(migratedOrganization));
      removeStoredJson(STORAGE_KEYS.chatOrganization);
    } catch (error) {
      console.error('[chatOrganizationStore] Failed to migrate legacy local chat organization into IndexedDB', error);
    }

    return migratedOrganization;
  }

  return fallback;
}

export function persistChatOrganization(data: ChatOrganizationData): Promise<void> {
  const projectedData = projectChatOrganizationData({
    ...data,
    updatedAt: Date.now(),
  });
  removeStoredJson(STORAGE_KEYS.chatOrganization);

  return saveJsonRecord(STORAGE_KEYS.chatOrganization, projectedData).catch((error) => {
    console.error('[chatOrganizationStore] Failed to persist chat organization into IndexedDB', error);
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

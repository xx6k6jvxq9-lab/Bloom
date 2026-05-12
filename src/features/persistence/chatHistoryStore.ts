import type { Character, ChatGroup, ChatHistory, ChatMessage, GroupTopicState } from '../../types';
import { buildGroupFactTraceRecords } from '../../services/relationship-context/buildGroupFactTraceRecords';
import { buildDirectFactTraceRecords } from '../../services/relationship-context/buildDirectFactTraceRecords';
import { buildDirectRelationshipWaveRecords } from '../../services/relationship-context/buildDirectRelationshipWaveRecords';
import { buildGroupRelationshipWaveRecords } from '../../services/relationship-context/buildGroupRelationshipWaveRecords';
import { sanitizeGroupMemberPerspectiveSummaries } from '../../services/group-chat/groupShortTermMemory';
import { sanitizeGroupLongTermMemory } from '../../services/group-chat/groupLongTermMemory';
import type { FactTraceRecord } from '../../services/relationship-context/factTypes';
import type { RelationshipWaveRecord } from '../../services/relationship-context/types';
import { formatChatMessagePreview } from '../app-shell/formatMessagePreview';
import { listJsonRecordKeys, loadJsonRecord, loadJsonRecordEnvelope, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson } from './localConfigStore';
import { buildMemoryRecordDataFromChatHistory } from '../../services/memory/buildMemoryRecordData';
import { areMemoryRecordDataEqual, loadMemoryRecordData, resetMemoryRecordData, saveMemoryRecordData } from './memoryRecordStore';
import { STORAGE_KEYS } from './storageKeys';

const CHAT_HISTORY_SHARD_INDEX_FORMAT = 'chat-history-shard-index';
const CHAT_HISTORY_SHARD_VERSION = 1;
const CHAT_HISTORY_DIRECT_SESSION_PREFIX = `${STORAGE_KEYS.chatHistory}:direct:`;
const CHAT_HISTORY_GROUP_SESSION_PREFIX = `${STORAGE_KEYS.chatHistory}:group:`;

export type PersistedDirectSession = {
  history: ChatMessage[];
  lastViewedMessageTimestamp?: number;
};

export type PersistedDirectSessionMetadata = {
  lastViewedMessageTimestamp?: number;
};

export type PersistedGroupSession = {
  history: ChatMessage[];
  lastMessage?: string;
  lastTime?: number;
  relationshipWaves?: RelationshipWaveRecord[];
  factTraces?: FactTraceRecord[];
  topicState?: GroupTopicState;
  groupShortTermSummary?: string;
  groupMemberPerspectiveSummaries?: Record<string, string>;
  groupLongTermMemory?: ChatGroup['groupLongTermMemory'];
};

export type PersistedChatHistoryData = {
  updatedAt?: number;
  directHistory: ChatHistory;
  directSessionMetadata: Record<string, PersistedDirectSessionMetadata>;
  directRelationshipWaves: Record<string, RelationshipWaveRecord[]>;
  directFactTraces: Record<string, FactTraceRecord[]>;
  groupSessions: Record<string, PersistedGroupSession>;
};

type PersistedChatHistoryShardIndex = {
  format: typeof CHAT_HISTORY_SHARD_INDEX_FORMAT;
  version: typeof CHAT_HISTORY_SHARD_VERSION;
  updatedAt: number;
  directSessionIds: string[];
  groupSessionIds: string[];
};

let chatHistoryCache: PersistedChatHistoryData | null = null;
let chatHistoryShardIndexCache: PersistedChatHistoryShardIndex | null = null;

function isChatMessageArray(value: unknown): value is ChatMessage[] {
  return Array.isArray(value);
}

function isPersistedDirectSession(value: unknown): value is PersistedDirectSession {
  return !!value && typeof value === 'object' && isChatMessageArray((value as PersistedDirectSession).history);
}

function sanitizeDirectSessionMetadata(
  value: unknown,
  fallback: Record<string, PersistedDirectSessionMetadata>,
): Record<string, PersistedDirectSessionMetadata> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const result: Record<string, PersistedDirectSessionMetadata> = {};
  for (const [key, metadata] of Object.entries(value as Record<string, unknown>)) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      continue;
    }

    const lastViewedMessageTimestamp =
      typeof (metadata as PersistedDirectSessionMetadata).lastViewedMessageTimestamp === 'number'
      && Number.isFinite((metadata as PersistedDirectSessionMetadata).lastViewedMessageTimestamp)
        ? (metadata as PersistedDirectSessionMetadata).lastViewedMessageTimestamp
        : undefined;

    if (typeof lastViewedMessageTimestamp === 'number') {
      result[key] = { lastViewedMessageTimestamp };
    }
  }

  return Object.keys(result).length > 0 ? result : fallback;
}

function isPersistedChatHistoryShardIndex(value: unknown): value is PersistedChatHistoryShardIndex {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<PersistedChatHistoryShardIndex>;
  return candidate.format === CHAT_HISTORY_SHARD_INDEX_FORMAT
    && candidate.version === CHAT_HISTORY_SHARD_VERSION
    && typeof candidate.updatedAt === 'number'
    && Array.isArray(candidate.directSessionIds)
    && Array.isArray(candidate.groupSessionIds);
}

function buildDirectSessionStorageKey(characterId: string): string {
  return `${CHAT_HISTORY_DIRECT_SESSION_PREFIX}${characterId}`;
}

function buildGroupSessionStorageKey(groupId: string): string {
  return `${CHAT_HISTORY_GROUP_SESSION_PREFIX}${groupId}`;
}

function buildShardIndex(
  data: PersistedChatHistoryData,
): PersistedChatHistoryShardIndex {
  return {
    format: CHAT_HISTORY_SHARD_INDEX_FORMAT,
    version: CHAT_HISTORY_SHARD_VERSION,
    updatedAt: data.updatedAt ?? Date.now(),
    directSessionIds: Object.keys(data.directHistory).sort(),
    groupSessionIds: Object.keys(data.groupSessions).sort(),
  };
}

function sanitizeDirectSession(value: unknown): PersistedDirectSession | null {
  if (isChatMessageArray(value)) {
    return {
      history: value,
    };
  }

  if (isPersistedDirectSession(value)) {
    const lastViewedMessageTimestamp =
      typeof value.lastViewedMessageTimestamp === 'number' && Number.isFinite(value.lastViewedMessageTimestamp)
        ? value.lastViewedMessageTimestamp
        : undefined;
    return {
      history: value.history,
      ...(typeof lastViewedMessageTimestamp === 'number' ? { lastViewedMessageTimestamp } : {}),
    };
  }

  return null;
}

function serializeDirectSession(session: PersistedDirectSession | null | undefined): string {
  return JSON.stringify(session ?? { history: [] });
}

function serializeGroupSession(session: PersistedGroupSession | null | undefined): string {
  return JSON.stringify(session ?? null);
}

function sanitizeShardIndexIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
    .sort();
}

async function loadPersistedShardIndex(): Promise<PersistedChatHistoryShardIndex | null> {
  try {
    const persisted = await loadJsonRecord<unknown>(STORAGE_KEYS.chatHistory);
    if (!isPersistedChatHistoryShardIndex(persisted)) {
      return null;
    }

    return {
      ...persisted,
      directSessionIds: sanitizeShardIndexIds(persisted.directSessionIds),
      groupSessionIds: sanitizeShardIndexIds(persisted.groupSessionIds),
    };
  } catch (error) {
    console.error('[chatHistoryStore] Failed to inspect sharded chat history index', error);
    return null;
  }
}

async function listStoredChatHistoryShardKeys(): Promise<string[]> {
  const [directKeys, groupKeys] = await Promise.all([
    listJsonRecordKeys(CHAT_HISTORY_DIRECT_SESSION_PREFIX),
    listJsonRecordKeys(CHAT_HISTORY_GROUP_SESSION_PREFIX),
  ]);

  return [...directKeys, ...groupKeys];
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

function isPersistedGroupSession(value: unknown): value is PersistedGroupSession {
  return !!value && typeof value === 'object' && isChatMessageArray((value as PersistedGroupSession).history);
}

function isRelationshipWaveArray(value: unknown): value is RelationshipWaveRecord[] {
  return Array.isArray(value);
}

function isFactTraceArray(value: unknown): value is FactTraceRecord[] {
  return Array.isArray(value);
}

function findLatestPreviewableMessage(messages: ChatMessage[]): ChatMessage | null {
  return [...messages].reverse().find((message) => !message.isSystem && !message.isRecalled) || null;
}

function getLatestMessageTimestamp(messages: ChatMessage[]): number {
  return messages.reduce((latestTimestamp, message) => (
    typeof message.timestamp === 'number' && Number.isFinite(message.timestamp)
      ? Math.max(latestTimestamp, message.timestamp)
      : latestTimestamp
  ), 0);
}

function resolveChatHistoryUpdatedAt(
  source: Partial<PersistedChatHistoryData> | null | undefined,
  fallbackUpdatedAt = 0,
): number {
  const explicitUpdatedAt = typeof source?.updatedAt === 'number' && Number.isFinite(source.updatedAt)
    ? source.updatedAt
    : 0;

  const latestDirectTimestamp = Object.values(source?.directHistory || {}).reduce((latestTimestamp, history) => (
    Array.isArray(history)
      ? Math.max(latestTimestamp, getLatestMessageTimestamp(history))
      : latestTimestamp
  ), 0);

  const latestGroupTimestamp = Object.values(source?.groupSessions || {}).reduce((latestTimestamp, session) => {
    if (Array.isArray(session)) {
      return Math.max(latestTimestamp, getLatestMessageTimestamp(session));
    }

    if (!session || typeof session !== 'object') {
      return latestTimestamp;
    }

    const latestHistoryTimestamp = Array.isArray(session.history)
      ? getLatestMessageTimestamp(session.history)
      : 0;
    const latestSessionTimestamp = typeof session.lastTime === 'number' && Number.isFinite(session.lastTime)
      ? session.lastTime
      : 0;

    return Math.max(latestTimestamp, latestHistoryTimestamp, latestSessionTimestamp);
  }, 0);

  return Math.max(
    explicitUpdatedAt,
    latestDirectTimestamp,
    latestGroupTimestamp,
    Number.isFinite(fallbackUpdatedAt) ? fallbackUpdatedAt : 0,
  );
}

function sanitizeDirectRelationshipWaves(
  value: unknown,
  fallback: Record<string, RelationshipWaveRecord[]>,
): Record<string, RelationshipWaveRecord[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const result: Record<string, RelationshipWaveRecord[]> = {};
  for (const [key, waves] of Object.entries(value as Record<string, unknown>)) {
    if (isRelationshipWaveArray(waves)) {
      result[key] = waves;
    }
  }

  return Object.keys(result).length > 0 ? result : fallback;
}

function sanitizeDirectFactTraces(
  value: unknown,
  fallback: Record<string, FactTraceRecord[]>,
): Record<string, FactTraceRecord[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const result: Record<string, FactTraceRecord[]> = {};
  for (const [key, factTraces] of Object.entries(value as Record<string, unknown>)) {
    if (isFactTraceArray(factTraces)) {
      result[key] = factTraces;
    }
  }

  return Object.keys(result).length > 0 ? result : fallback;
}

function sanitizeGroupSessions(
  value: unknown,
  fallback: Record<string, PersistedGroupSession>,
): Record<string, PersistedGroupSession> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const result: Record<string, PersistedGroupSession> = {};
  for (const [key, session] of Object.entries(value as Record<string, unknown>)) {
    if (isChatMessageArray(session)) {
      const history = session;
      const latestPreviewableMessage = findLatestPreviewableMessage(history);
      result[key] = {
        history,
        lastMessage: latestPreviewableMessage ? formatChatMessagePreview(latestPreviewableMessage) : undefined,
        lastTime: latestPreviewableMessage?.timestamp,
        relationshipWaves: [],
        factTraces: [],
      };
      continue;
    }

    if (isPersistedGroupSession(session)) {
      const latestPreviewableMessage = findLatestPreviewableMessage(session.history);
      result[key] = {
        history: session.history,
        lastMessage: typeof session.lastMessage === 'string'
          ? session.lastMessage
          : latestPreviewableMessage
            ? formatChatMessagePreview(latestPreviewableMessage)
            : undefined,
        lastTime: typeof session.lastTime === 'number'
          ? session.lastTime
          : latestPreviewableMessage?.timestamp,
        relationshipWaves: isRelationshipWaveArray(session.relationshipWaves) ? session.relationshipWaves : [],
        factTraces: isFactTraceArray(session.factTraces) ? session.factTraces : [],
        topicState: session.topicState,
        groupShortTermSummary: typeof session.groupShortTermSummary === 'string'
          ? session.groupShortTermSummary.trim() || undefined
          : undefined,
        groupMemberPerspectiveSummaries: sanitizeGroupMemberPerspectiveSummaries(
          session.groupMemberPerspectiveSummaries,
        ),
        groupLongTermMemory: sanitizeGroupLongTermMemory(session.groupLongTermMemory),
      };
    }
  }
  return Object.keys(result).length > 0 ? result : fallback;
}

export function hydrateChatHistoryRecords(
  source: Partial<PersistedChatHistoryData> | null | undefined,
  fallback: PersistedChatHistoryData,
): PersistedChatHistoryData {
  const updatedAt = resolveChatHistoryUpdatedAt(source, fallback.updatedAt ?? 0);
  const directHistory = sanitizeDirectHistory(source?.directHistory, fallback.directHistory);
  const directSessionMetadata = sanitizeDirectSessionMetadata(
    source?.directSessionMetadata,
    fallback.directSessionMetadata,
  );
  const directRelationshipWaves = sanitizeDirectRelationshipWaves(
    source?.directRelationshipWaves,
    {},
  );
  const directFactTraces = sanitizeDirectFactTraces(
    source?.directFactTraces,
    {},
  );

  return {
    ...(updatedAt > 0 ? { updatedAt } : {}),
    directHistory,
    directSessionMetadata,
    directRelationshipWaves: Object.keys(directRelationshipWaves).length > 0
      ? directRelationshipWaves
      : extractDirectRelationshipWaves(directHistory),
    directFactTraces: Object.keys(directFactTraces).length > 0
      ? directFactTraces
      : extractDirectFactTraces(directHistory),
    groupSessions: sanitizeGroupSessions(
      source?.groupSessions ?? (source as { groupHistories?: unknown } | null | undefined)?.groupHistories,
      fallback.groupSessions,
    ),
  };
}

export function loadChatHistoryRecords(
  fallback: PersistedChatHistoryData = {
    directHistory: {},
    directSessionMetadata: {},
    directRelationshipWaves: {},
    directFactTraces: {},
    groupSessions: {},
  },
): PersistedChatHistoryData {
  return chatHistoryCache ?? fallback;
}

async function loadShardedChatHistoryRecords(
  shardIndex: PersistedChatHistoryShardIndex,
  fallback: PersistedChatHistoryData,
): Promise<PersistedChatHistoryData> {
  const [directSessions, groupSessions] = await Promise.all([
    Promise.all(
      shardIndex.directSessionIds.map(async (characterId) => {
        const session = sanitizeDirectSession(
          await loadJsonRecord<unknown>(buildDirectSessionStorageKey(characterId)),
        );
        return session ? [characterId, session] as const : null;
      }),
    ),
    Promise.all(
      shardIndex.groupSessionIds.map(async (groupId) => {
        const session = sanitizeGroupSessions(
          { [groupId]: await loadJsonRecord<unknown>(buildGroupSessionStorageKey(groupId)) },
          {},
        )[groupId];
        return session ? [groupId, session] as const : null;
      }),
    ),
  ]);

  return hydrateChatHistoryRecords({
    updatedAt: shardIndex.updatedAt,
    directHistory: Object.fromEntries(
      directSessions
        .filter((entry): entry is readonly [string, PersistedDirectSession] => entry !== null)
        .map(([characterId, session]) => [characterId, session.history] as const),
    ),
    directSessionMetadata: Object.fromEntries(
      directSessions
        .filter((entry): entry is readonly [string, PersistedDirectSession] => entry !== null)
        .flatMap(([characterId, session]) => (
          typeof session.lastViewedMessageTimestamp === 'number'
            ? [[characterId, { lastViewedMessageTimestamp: session.lastViewedMessageTimestamp }] as const]
            : []
        )),
    ),
    groupSessions: Object.fromEntries(
      groupSessions.filter((entry): entry is readonly [string, PersistedGroupSession] => entry !== null),
    ),
  }, fallback);
}

function buildPersistedValue(
  value: PersistedChatHistoryData,
): PersistedChatHistoryData {
  return hydrateChatHistoryRecords({
    ...value,
    updatedAt: Date.now(),
  }, {
    directHistory: {},
    directSessionMetadata: {},
    directRelationshipWaves: {},
    directFactTraces: {},
    groupSessions: {},
  });
}

async function persistShardedChatHistoryRecords(
  value: PersistedChatHistoryData,
  options: {
    clearExistingShards?: boolean;
  } = {},
): Promise<void> {
  const persistedValue = buildPersistedValue(value);
  const shardIndex = buildShardIndex(persistedValue);
  const previousCache = chatHistoryCache;
  const previousShardIndex = chatHistoryShardIndexCache ?? await loadPersistedShardIndex();
  const writes: Promise<void>[] = [];

  for (const characterId of shardIndex.directSessionIds) {
    const nextSession: PersistedDirectSession = {
      history: persistedValue.directHistory[characterId] || [],
      ...(
        typeof persistedValue.directSessionMetadata[characterId]?.lastViewedMessageTimestamp === 'number'
          ? { lastViewedMessageTimestamp: persistedValue.directSessionMetadata[characterId]?.lastViewedMessageTimestamp }
          : {}
      ),
    };
    const previousSession: PersistedDirectSession | undefined = previousCache?.directHistory[characterId]
      ? {
          history: previousCache.directHistory[characterId] || [],
          ...(
            typeof previousCache.directSessionMetadata[characterId]?.lastViewedMessageTimestamp === 'number'
              ? { lastViewedMessageTimestamp: previousCache.directSessionMetadata[characterId]?.lastViewedMessageTimestamp }
              : {}
          ),
        }
      : undefined;
    const shouldWrite =
      options.clearExistingShards
      || previousSession === undefined
      || serializeDirectSession(previousSession) !== serializeDirectSession(nextSession);

    if (shouldWrite) {
      writes.push(saveJsonRecord(buildDirectSessionStorageKey(characterId), nextSession));
    }
  }

  for (const groupId of shardIndex.groupSessionIds) {
    const nextSession = persistedValue.groupSessions[groupId];
    const previousSession = previousCache?.groupSessions[groupId];
    const shouldWrite =
      options.clearExistingShards
      || !previousSession
      || serializeGroupSession(previousSession) !== serializeGroupSession(nextSession);

    if (shouldWrite) {
      writes.push(saveJsonRecord(buildGroupSessionStorageKey(groupId), nextSession));
    }
  }

  const staleShardKeys = options.clearExistingShards
    ? (await listStoredChatHistoryShardKeys()).filter((key) => {
        if (key.startsWith(CHAT_HISTORY_DIRECT_SESSION_PREFIX)) {
          const characterId = key.slice(CHAT_HISTORY_DIRECT_SESSION_PREFIX.length);
          return !shardIndex.directSessionIds.includes(characterId);
        }

        if (key.startsWith(CHAT_HISTORY_GROUP_SESSION_PREFIX)) {
          const groupId = key.slice(CHAT_HISTORY_GROUP_SESSION_PREFIX.length);
          return !shardIndex.groupSessionIds.includes(groupId);
        }

        return false;
      })
    : [
        ...(previousShardIndex?.directSessionIds || [])
          .filter((characterId) => !shardIndex.directSessionIds.includes(characterId))
          .map((characterId) => buildDirectSessionStorageKey(characterId)),
        ...(previousShardIndex?.groupSessionIds || [])
          .filter((groupId) => !shardIndex.groupSessionIds.includes(groupId))
          .map((groupId) => buildGroupSessionStorageKey(groupId)),
      ];

  await Promise.all([
    ...writes,
    ...staleShardKeys.map((key) => removeJsonRecord(key).catch((error) => {
      console.error(`[chatHistoryStore] Failed to remove stale chat history shard "${key}"`, error);
    })),
    saveJsonRecord(STORAGE_KEYS.chatHistory, shardIndex),
  ]);

  chatHistoryCache = persistedValue;
  chatHistoryShardIndexCache = shardIndex;
  removeStoredJson(STORAGE_KEYS.chatHistory);

  await syncDerivedMemoryRecordData(persistedValue);
}

async function syncDerivedMemoryRecordData(
  persistedValue: PersistedChatHistoryData,
): Promise<void> {
  const nextMemoryRecordData = buildMemoryRecordDataFromChatHistory(persistedValue);
  const currentMemoryRecordData = loadMemoryRecordData({
    recordsByCharacterId: {},
  });
  if (!areMemoryRecordDataEqual(currentMemoryRecordData, nextMemoryRecordData)) {
    try {
      await saveMemoryRecordData(nextMemoryRecordData);
    } catch (error) {
      console.error('[chatHistoryStore] Failed to persist derived memory records', error);
    }
  }
}

export async function loadPreferredChatHistoryRecords(
  fallback: PersistedChatHistoryData = {
    directHistory: {},
    directSessionMetadata: {},
    directRelationshipWaves: {},
    directFactTraces: {},
    groupSessions: {},
  },
): Promise<PersistedChatHistoryData> {
  const legacyLocalHistory = loadJson<Partial<PersistedChatHistoryData> | null>(STORAGE_KEYS.chatHistory, null);

  try {
    const persistedEnvelope = await loadJsonRecordEnvelope<unknown>(STORAGE_KEYS.chatHistory);
    const localUpdatedAt = resolveChatHistoryUpdatedAt(legacyLocalHistory, 0);

    if (isPersistedChatHistoryShardIndex(persistedEnvelope.value)) {
      const shardIndex: PersistedChatHistoryShardIndex = {
        ...persistedEnvelope.value,
        directSessionIds: sanitizeShardIndexIds(persistedEnvelope.value.directSessionIds),
        groupSessionIds: sanitizeShardIndexIds(persistedEnvelope.value.groupSessionIds),
      };
      const indexedDbHistory = await loadShardedChatHistoryRecords(shardIndex, fallback);
      const shouldPreferIndexedDb = !legacyLocalHistory || shardIndex.updatedAt >= localUpdatedAt;

      if (shouldPreferIndexedDb) {
        chatHistoryCache = indexedDbHistory;
        chatHistoryShardIndexCache = shardIndex;
        removeStoredJson(STORAGE_KEYS.chatHistory);
        await syncDerivedMemoryRecordData(indexedDbHistory);
        return indexedDbHistory;
      }
    } else if (persistedEnvelope.value) {
      const indexedDbUpdatedAt = resolveChatHistoryUpdatedAt(
        persistedEnvelope.value as Partial<PersistedChatHistoryData>,
        persistedEnvelope.updatedAt ?? 0,
      );
      const shouldPreferIndexedDb = !legacyLocalHistory || indexedDbUpdatedAt >= localUpdatedAt;

      if (shouldPreferIndexedDb) {
        const indexedDbHistory = hydrateChatHistoryRecords({
          ...(persistedEnvelope.value as Partial<PersistedChatHistoryData>),
          ...(indexedDbUpdatedAt > 0 ? { updatedAt: indexedDbUpdatedAt } : {}),
        }, fallback);
        await persistShardedChatHistoryRecords(indexedDbHistory, { clearExistingShards: true });
        return indexedDbHistory;
      }
    }
  } catch (error) {
    console.error('[chatHistoryStore] Failed to load chat history from IndexedDB', error);
  }

  if (legacyLocalHistory) {
    const migratedHistory = hydrateChatHistoryRecords(legacyLocalHistory, fallback);
    try {
      await persistShardedChatHistoryRecords(migratedHistory, { clearExistingShards: true });
    } catch (error) {
      console.error('[chatHistoryStore] Failed to migrate legacy local chat history into IndexedDB', error);
    }

    return migratedHistory;
  }

  chatHistoryCache = fallback;
  chatHistoryShardIndexCache = null;
  return fallback;
}

export function saveChatHistoryRecords(value: PersistedChatHistoryData): Promise<void> {
  return persistShardedChatHistoryRecords(value).catch((error) => {
    console.error('[chatHistoryStore] Failed to persist chat history into IndexedDB', error);
  });
}

export function patchChatHistoryRecords(
  updater: (current: PersistedChatHistoryData) => PersistedChatHistoryData,
  fallback: PersistedChatHistoryData = {
    directHistory: {},
    directSessionMetadata: {},
    directRelationshipWaves: {},
    directFactTraces: {},
    groupSessions: {},
  },
): Promise<PersistedChatHistoryData> {
  const nextValue = updater(loadChatHistoryRecords(fallback));
  return saveChatHistoryRecords(nextValue).then(() => nextValue);
}

export function resetChatHistoryRecords(): void {
  chatHistoryCache = null;
  chatHistoryShardIndexCache = null;
  resetMemoryRecordData();
  removeStoredJson(STORAGE_KEYS.chatHistory);
  void (async () => {
    const shardKeys = await listStoredChatHistoryShardKeys().catch((error) => {
      console.error('[chatHistoryStore] Failed to list chat history shards for reset', error);
      return [] as string[];
    });

    await Promise.all([
      removeJsonRecord(STORAGE_KEYS.chatHistory),
      ...shardKeys.map((key) => removeJsonRecord(key)),
    ]).catch((error) => {
      console.error('[chatHistoryStore] Failed to remove chat history from IndexedDB', error);
    });
  })();
}

export function extractGroupSessions(chatGroups: ChatGroup[]): Record<string, PersistedGroupSession> {
  return chatGroups.reduce<Record<string, PersistedGroupSession>>((acc, group) => {
    const history = group.history || [];
    acc[group.id] = {
      history,
      lastMessage: group.lastMessage,
      lastTime: group.lastTime,
      topicState: group.topicState,
      groupShortTermSummary: group.groupShortTermSummary,
      groupMemberPerspectiveSummaries: group.groupMemberPerspectiveSummaries,
      groupLongTermMemory: group.groupLongTermMemory,
      relationshipWaves: buildGroupRelationshipWaveRecords({
        groupId: group.id,
        messages: history,
        memberIds: group.memberIds,
      }),
      factTraces: buildGroupFactTraceRecords({
        groupId: group.id,
        messages: history,
        memberIds: group.memberIds,
      }),
    };
    return acc;
  }, {});
}

export function extractDirectSessionMetadata(
  characters: Character[],
  directHistory: ChatHistory,
): Record<string, PersistedDirectSessionMetadata> {
  const characterById = new Map(characters.map((character) => [character.id, character]));
  const sessionIds = new Set([
    ...Object.keys(directHistory),
    ...characters
      .filter((character) => typeof character.lastViewedMessageTimestamp === 'number')
      .map((character) => character.id),
  ]);

  return Array.from(sessionIds).reduce<Record<string, PersistedDirectSessionMetadata>>((acc, characterId) => {
    const character = characterById.get(characterId);
    if (
      !character
      || typeof character.lastViewedMessageTimestamp !== 'number'
      || !Number.isFinite(character.lastViewedMessageTimestamp)
    ) {
      return acc;
    }

    acc[characterId] = {
      lastViewedMessageTimestamp: character.lastViewedMessageTimestamp,
    };
    return acc;
  }, {});
}

export function mergeDirectSessionMetadataIntoCharacters(
  characters: Character[],
  persistedChatHistory: PersistedChatHistoryData,
): Character[] {
  return characters.map((character) => {
    const history = persistedChatHistory.directHistory[character.id] || [];
    const latestPreviewableMessage = findLatestPreviewableMessage(history);
    const sessionMetadata = persistedChatHistory.directSessionMetadata[character.id];
    const nextCharacter: Character = { ...character };

    if (latestPreviewableMessage) {
      nextCharacter.lastMessage = formatChatMessagePreview(latestPreviewableMessage);
      nextCharacter.lastTime = latestPreviewableMessage.timestamp;
    }

    if (typeof sessionMetadata?.lastViewedMessageTimestamp === 'number') {
      nextCharacter.lastViewedMessageTimestamp = sessionMetadata.lastViewedMessageTimestamp;
    }

    return nextCharacter;
  });
}

export function extractDirectRelationshipWaves(
  directHistory: ChatHistory,
): Record<string, RelationshipWaveRecord[]> {
  return Object.entries(directHistory).reduce<Record<string, RelationshipWaveRecord[]>>((acc, [characterId, history]) => {
    acc[characterId] = buildDirectRelationshipWaveRecords({
      characterId,
      messages: Array.isArray(history) ? history : [],
    });
    return acc;
  }, {});
}

export function extractDirectFactTraces(
  directHistory: ChatHistory,
): Record<string, FactTraceRecord[]> {
  return Object.entries(directHistory).reduce<Record<string, FactTraceRecord[]>>((acc, [characterId, history]) => {
    acc[characterId] = buildDirectFactTraceRecords({
      characterId,
      messages: Array.isArray(history) ? history : [],
    });
    return acc;
  }, {});
}

export function extractGroupSessionsWithFallback(
  chatGroups: ChatGroup[],
  fallbackSessions: Record<string, PersistedGroupSession>,
): Record<string, PersistedGroupSession> {
  return chatGroups.reduce<Record<string, PersistedGroupSession>>((acc, group) => {
    const hasSessionFields =
      group.history !== undefined
      || group.lastMessage !== undefined
      || group.lastTime !== undefined;

    if (hasSessionFields) {
      const history = group.history || [];
      acc[group.id] = {
        history,
        lastMessage: group.lastMessage,
        lastTime: group.lastTime,
        topicState: group.topicState,
        groupShortTermSummary: group.groupShortTermSummary,
        groupMemberPerspectiveSummaries: group.groupMemberPerspectiveSummaries,
        groupLongTermMemory: group.groupLongTermMemory,
        relationshipWaves: buildGroupRelationshipWaveRecords({
          groupId: group.id,
          messages: history,
          memberIds: group.memberIds,
        }),
        factTraces: buildGroupFactTraceRecords({
          groupId: group.id,
          messages: history,
          memberIds: group.memberIds,
        }),
      };
      return acc;
    }

    if (fallbackSessions[group.id]) {
      acc[group.id] = fallbackSessions[group.id];
    }

    return acc;
  }, {});
}

export function mergeGroupSessionsIntoChatGroups(
  chatGroups: ChatGroup[],
  groupSessions: Record<string, PersistedGroupSession>,
): ChatGroup[] {
  return chatGroups.map((group) => {
    if (!Object.prototype.hasOwnProperty.call(groupSessions, group.id)) {
      return group;
    }

    const session = groupSessions[group.id];
    return {
      ...group,
      history: session.history,
      lastMessage: session.lastMessage,
      lastTime: session.lastTime,
      relationshipWaves: session.relationshipWaves || [],
      factTraces: session.factTraces || [],
      topicState: session.topicState,
      groupShortTermSummary: session.groupShortTermSummary,
      groupMemberPerspectiveSummaries: session.groupMemberPerspectiveSummaries,
      groupLongTermMemory: session.groupLongTermMemory,
    };
  });
}

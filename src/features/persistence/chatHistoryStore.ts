import type { ChatGroup, ChatHistory, ChatMessage } from '../../types';
import { buildGroupFactTraceRecords } from '../../services/relationship-context/buildGroupFactTraceRecords';
import { buildDirectFactTraceRecords } from '../../services/relationship-context/buildDirectFactTraceRecords';
import { buildDirectRelationshipWaveRecords } from '../../services/relationship-context/buildDirectRelationshipWaveRecords';
import { buildGroupRelationshipWaveRecords } from '../../services/relationship-context/buildGroupRelationshipWaveRecords';
import type { FactTraceRecord } from '../../services/relationship-context/factTypes';
import type { RelationshipWaveRecord } from '../../services/relationship-context/types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export type PersistedGroupSession = {
  history: ChatMessage[];
  lastMessage?: string;
  lastTime?: number;
  relationshipWaves?: RelationshipWaveRecord[];
  factTraces?: FactTraceRecord[];
};

export type PersistedChatHistoryData = {
  directHistory: ChatHistory;
  directRelationshipWaves: Record<string, RelationshipWaveRecord[]>;
  directFactTraces: Record<string, FactTraceRecord[]>;
  groupSessions: Record<string, PersistedGroupSession>;
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

function isPersistedGroupSession(value: unknown): value is PersistedGroupSession {
  return !!value && typeof value === 'object' && isChatMessageArray((value as PersistedGroupSession).history);
}

function isRelationshipWaveArray(value: unknown): value is RelationshipWaveRecord[] {
  return Array.isArray(value);
}

function isFactTraceArray(value: unknown): value is FactTraceRecord[] {
  return Array.isArray(value);
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
      result[key] = {
        history,
        lastMessage: history[history.length - 1]?.text,
        lastTime: history[history.length - 1]?.timestamp,
        relationshipWaves: [],
        factTraces: [],
      };
      continue;
    }

    if (isPersistedGroupSession(session)) {
      result[key] = {
        history: session.history,
        lastMessage: typeof session.lastMessage === 'string' ? session.lastMessage : undefined,
        lastTime: typeof session.lastTime === 'number' ? session.lastTime : undefined,
        relationshipWaves: isRelationshipWaveArray(session.relationshipWaves) ? session.relationshipWaves : [],
        factTraces: isFactTraceArray(session.factTraces) ? session.factTraces : [],
      };
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
    directRelationshipWaves: sanitizeDirectRelationshipWaves(
      source?.directRelationshipWaves,
      fallback.directRelationshipWaves,
    ),
    directFactTraces: sanitizeDirectFactTraces(
      source?.directFactTraces,
      fallback.directFactTraces,
    ),
    groupSessions: sanitizeGroupSessions(
      source?.groupSessions ?? (source as { groupHistories?: unknown } | null | undefined)?.groupHistories,
      fallback.groupSessions,
    ),
  };
}

export function loadChatHistoryRecords(
  fallback: PersistedChatHistoryData = {
    directHistory: {},
    directRelationshipWaves: {},
    directFactTraces: {},
    groupSessions: {},
  },
): PersistedChatHistoryData {
  const persisted = loadJson<Partial<PersistedChatHistoryData> | null>(STORAGE_KEYS.chatHistory, null);
  return hydrateChatHistoryRecords(persisted, fallback);
}

export function saveChatHistoryRecords(value: PersistedChatHistoryData): void {
  saveJson(STORAGE_KEYS.chatHistory, value);
}

export function patchChatHistoryRecords(
  updater: (current: PersistedChatHistoryData) => PersistedChatHistoryData,
  fallback: PersistedChatHistoryData = {
    directHistory: {},
    directRelationshipWaves: {},
    directFactTraces: {},
    groupSessions: {},
  },
): PersistedChatHistoryData {
  const nextValue = updater(loadChatHistoryRecords(fallback));
  saveChatHistoryRecords(nextValue);
  return nextValue;
}

export function resetChatHistoryRecords(): void {
  removeStoredJson(STORAGE_KEYS.chatHistory);
}

export function extractGroupSessions(chatGroups: ChatGroup[]): Record<string, PersistedGroupSession> {
  return chatGroups.reduce<Record<string, PersistedGroupSession>>((acc, group) => {
    const history = group.history || [];
    acc[group.id] = {
      history,
      lastMessage: group.lastMessage,
      lastTime: group.lastTime,
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

export function extractDirectRelationshipWaves(
  directHistory: ChatHistory,
): Record<string, RelationshipWaveRecord[]> {
  return Object.entries(directHistory).reduce<Record<string, RelationshipWaveRecord[]>>((acc, [characterId, history]) => {
    acc[characterId] = buildDirectRelationshipWaveRecords({
      characterId,
      messages: history || [],
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
      messages: history || [],
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
    };
  });
}

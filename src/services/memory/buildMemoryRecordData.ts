import type { PersistedChatHistoryData, PersistedGroupSession } from '../../features/persistence/chatHistoryStore';
import type { ChatMessage } from '../../types';
import type { FactTraceRecord } from '../relationship-context/factTypes';
import type { RelationshipWaveRecord } from '../relationship-context/types';
import { formatTransferMessageForContext, resolveTransferContextMessage } from '../chat/transferContextText';
import type { MemoryRecord, MemoryRecordDecayHint, MemoryRecordStability } from './memoryRecordTypes';

export type PersistedMemoryRecordData = {
  updatedAt?: number;
  recordsByCharacterId: Record<string, MemoryRecord[]>;
};

export function normalizeSummaryKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function buildMemoryRecordId(parts: Array<string | number | boolean | undefined>): string {
  return parts
    .filter((part): part is string | number | boolean => part !== undefined && part !== null && `${part}`.trim().length > 0)
    .map((part) => String(part).replace(/\s+/g, ' ').trim())
    .join('|');
}

function normalizeCharacterIds(characterIds: string[]): string[] {
  return [...new Set(
    characterIds
      .filter((characterId) => typeof characterId === 'string')
      .map((characterId) => characterId.trim())
      .filter(Boolean),
  )].sort();
}

function normalizeMemoryRecordStability(decayHint: MemoryRecordDecayHint): MemoryRecordStability {
  if (decayHint === 'stable') {
    return 'stable';
  }

  return decayHint === 'medium' ? 'situational' : 'temporary';
}

function buildDirectSourceEventId(sessionId: string, timestamp: number): string {
  return `direct:${sessionId}:${timestamp}`;
}

function buildGroupSourceEventId(sessionId: string, timestamp: number): string {
  return `group:${sessionId}:${timestamp}`;
}

export function dedupeMemoryRecords(records: MemoryRecord[]): MemoryRecord[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();

  return [...records]
    .sort((left, right) => right.timestamp - left.timestamp)
    .filter((record) => {
      const normalizedId = record.id.trim().toLowerCase();
      const structuralKey = buildMemoryRecordId([
        record.kind,
        record.sourceScene,
        record.sourceSessionType,
        record.sourceSessionId,
        record.timestamp,
        normalizeSummaryKey(record.summary),
      ]).toLowerCase();

      if (seenIds.has(normalizedId) || seenKeys.has(structuralKey)) {
        return false;
      }

      seenIds.add(normalizedId);
      seenKeys.add(structuralKey);
      return true;
    });
}

function pushRecord(
  bucket: Record<string, MemoryRecord[]>,
  record: MemoryRecord,
): void {
  for (const characterId of normalizeCharacterIds(record.characterIds)) {
    bucket[characterId] = bucket[characterId] || [];
    bucket[characterId].push(record);
  }
}

export function mapFactTraceToMemoryRecord(params: {
  record: FactTraceRecord;
  sourceSessionType: 'direct' | 'group';
  sourceSessionId: string;
  fallbackCharacterId?: string;
}): MemoryRecord | null {
  const characterIds = normalizeCharacterIds([
    ...(params.record.relatedCharacterIds || []),
    ...(params.record.subjectType === 'character' ? [params.record.subjectId] : []),
    ...(params.fallbackCharacterId ? [params.fallbackCharacterId] : []),
  ]);

  if (characterIds.length === 0) {
    return null;
  }

  const sourceEventId = params.sourceSessionType === 'direct'
    ? buildDirectSourceEventId(params.sourceSessionId, params.record.timestamp)
    : buildGroupSourceEventId(params.sourceSessionId, params.record.timestamp);

  return {
    id: buildMemoryRecordId([
      'fact',
      params.record.sourceScene,
      params.sourceSessionType,
      params.sourceSessionId,
      params.record.factType,
      params.record.subjectType,
      params.record.subjectId,
      params.record.timestamp,
      normalizeSummaryKey(params.record.summary),
    ]),
    kind: 'fact',
    sourceScene: params.record.sourceScene,
    sourceSessionType: params.sourceSessionType,
    sourceSessionId: params.sourceSessionId,
    sourceEventIds: [sourceEventId],
    characterIds,
    ...(params.record.groupId ? { groupId: params.record.groupId } : {}),
    visibility: params.record.visibility,
    stability: params.record.stability,
    decayHint: params.record.decayHint,
    summary: params.record.summary,
    timestamp: params.record.timestamp,
    factType: params.record.factType,
    subjectType: params.record.subjectType,
    subjectId: params.record.subjectId,
    confidence: params.record.confidence,
    ...(params.record.relatedCharacterIds?.length ? { relatedCharacterIds: normalizeCharacterIds(params.record.relatedCharacterIds) } : {}),
  };
}

export function mapRelationshipWaveToMemoryRecord(params: {
  record: RelationshipWaveRecord;
  sourceSessionType: 'direct' | 'group';
  sourceSessionId: string;
  fallbackCharacterId?: string;
}): MemoryRecord | null {
  const characterIds = normalizeCharacterIds([
    params.record.sourceCharacterId,
    ...(params.record.targetCharacterId ? [params.record.targetCharacterId] : []),
    ...(params.fallbackCharacterId ? [params.fallbackCharacterId] : []),
  ]);

  if (characterIds.length === 0) {
    return null;
  }

  const sourceEventId = params.sourceSessionType === 'direct'
    ? buildDirectSourceEventId(params.sourceSessionId, params.record.timestamp)
    : buildGroupSourceEventId(params.sourceSessionId, params.record.timestamp);

  return {
    id: buildMemoryRecordId([
      'relationship_wave',
      params.record.sourceScene,
      params.sourceSessionType,
      params.sourceSessionId,
      params.record.relationType,
      params.record.eventKind,
      params.record.sourceCharacterId,
      params.record.targetCharacterId,
      params.record.targetUser,
      params.record.timestamp,
      normalizeSummaryKey(params.record.summary),
    ]),
    kind: 'relationship_wave',
    sourceScene: params.record.sourceScene,
    sourceSessionType: params.sourceSessionType,
    sourceSessionId: params.sourceSessionId,
    sourceEventIds: [sourceEventId],
    characterIds,
    ...(params.record.groupId ? { groupId: params.record.groupId } : {}),
    visibility: params.record.scope,
    stability: normalizeMemoryRecordStability(params.record.decayHint),
    decayHint: params.record.decayHint,
    summary: params.record.summary,
    timestamp: params.record.timestamp,
    relationType: params.record.relationType,
    eventKind: params.record.eventKind,
    valence: params.record.valence,
    intensity: params.record.intensity,
    sourceCharacterId: params.record.sourceCharacterId,
    ...(params.record.targetCharacterId ? { targetCharacterId: params.record.targetCharacterId } : {}),
    ...(params.record.targetUser ? { targetUser: true } : {}),
  };
}

function mapTransferSettlementToMemoryRecord(params: {
  message: ChatMessage;
  sourceSessionId: string;
  fallbackCharacterId: string;
}): MemoryRecord | null {
  if (!params.message.transferId) {
    return null;
  }

  const transferContext = resolveTransferContextMessage(params.message);
  if (!transferContext || transferContext.status === 'pending') {
    return null;
  }

  const summary = formatTransferMessageForContext(params.message);
  if (!summary) {
    return null;
  }

  const timestamp = transferContext.transferSettledAt ?? params.message.timestamp;
  const sourceEventId = buildDirectSourceEventId(params.sourceSessionId, timestamp);

  return {
    id: buildMemoryRecordId([
      'fact',
      'direct_chat',
      'direct',
      params.sourceSessionId,
      'transfer_settlement',
      params.message.transferId,
      transferContext.status,
      normalizeSummaryKey(summary),
    ]),
    kind: 'fact',
    sourceScene: 'direct_chat',
    sourceSessionType: 'direct',
    sourceSessionId: params.sourceSessionId,
    sourceEventIds: [sourceEventId],
    characterIds: [params.fallbackCharacterId],
    visibility: 'cross_scene_readable',
    stability: 'situational',
    decayHint: 'medium',
    summary,
    timestamp,
    factType: 'experience',
    subjectType: transferContext.direction === 'user_to_character' ? 'character' : 'user',
    subjectId: transferContext.direction === 'user_to_character' ? params.fallbackCharacterId : 'user',
    confidence: 'explicit',
    relatedCharacterIds: [params.fallbackCharacterId],
  };
}

function collectSessionMemoryRecords(
  bucket: Record<string, MemoryRecord[]>,
  params: {
    sourceSessionType: 'direct' | 'group';
    sourceSessionId: string;
    factTraces?: FactTraceRecord[];
    relationshipWaves?: RelationshipWaveRecord[];
    fallbackCharacterId?: string;
  },
): void {
  for (const factTrace of params.factTraces || []) {
    const record = mapFactTraceToMemoryRecord({
      record: factTrace,
      sourceSessionType: params.sourceSessionType,
      sourceSessionId: params.sourceSessionId,
      fallbackCharacterId: params.fallbackCharacterId,
    });
    if (record) {
      pushRecord(bucket, record);
    }
  }

  for (const relationshipWave of params.relationshipWaves || []) {
    const record = mapRelationshipWaveToMemoryRecord({
      record: relationshipWave,
      sourceSessionType: params.sourceSessionType,
      sourceSessionId: params.sourceSessionId,
      fallbackCharacterId: params.fallbackCharacterId,
    });
    if (record) {
      pushRecord(bucket, record);
    }
  }
}

export function buildMemoryRecordDataFromChatHistory(
  input: PersistedChatHistoryData,
): PersistedMemoryRecordData {
  const recordsByCharacterId: Record<string, MemoryRecord[]> = {};

  for (const [characterId, factTraces] of Object.entries(input.directFactTraces || {})) {
    collectSessionMemoryRecords(recordsByCharacterId, {
      sourceSessionType: 'direct',
      sourceSessionId: characterId,
      factTraces,
      fallbackCharacterId: characterId,
    });
  }

  for (const [characterId, relationshipWaves] of Object.entries(input.directRelationshipWaves || {})) {
    collectSessionMemoryRecords(recordsByCharacterId, {
      sourceSessionType: 'direct',
      sourceSessionId: characterId,
      relationshipWaves,
      fallbackCharacterId: characterId,
    });
  }

  for (const [characterId, history] of Object.entries(input.directHistory || {})) {
    for (const message of history || []) {
      const transferRecord = mapTransferSettlementToMemoryRecord({
        message,
        sourceSessionId: characterId,
        fallbackCharacterId: characterId,
      });
      if (transferRecord) {
        pushRecord(recordsByCharacterId, transferRecord);
      }
    }
  }

  for (const [groupId, session] of Object.entries(input.groupSessions || {})) {
    const typedSession = session as PersistedGroupSession;
    collectSessionMemoryRecords(recordsByCharacterId, {
      sourceSessionType: 'group',
      sourceSessionId: groupId,
      factTraces: typedSession.factTraces,
      relationshipWaves: typedSession.relationshipWaves,
    });
  }

  return {
    ...(typeof input.updatedAt === 'number' ? { updatedAt: input.updatedAt } : {}),
    recordsByCharacterId: Object.fromEntries(
      Object.entries(recordsByCharacterId).map(([characterId, records]) => [
        characterId,
        dedupeMemoryRecords(records),
      ]),
    ),
  };
}

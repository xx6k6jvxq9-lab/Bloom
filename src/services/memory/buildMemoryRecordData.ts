import type { PersistedChatHistoryData, PersistedGroupSession } from '../../features/persistence/chatHistoryStore';
import type { ChatMessage } from '../../types';
import type { FactTraceRecord } from '../relationship-context/factTypes';
import type { RelationshipWaveEventKind, RelationshipWaveRecord } from '../relationship-context/types';
import { formatTransferMessageForContext, resolveTransferContextMessage } from '../chat/transferContextText';
import type {
  MemoryRecord,
  MemoryRecordDecayHint,
  MemoryRecordSourceScene,
  MemoryRecordStability,
} from './memoryRecordTypes';

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

function normalizeHintText(value: string | undefined | null): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : undefined;
}

export function dedupeHintTexts(values: Array<string | undefined | null>): string[] | undefined {
  const seen = new Set<string>();
  const deduped = values
    .map((value) => normalizeHintText(value))
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return deduped.length > 0 ? deduped : undefined;
}

const SOURCE_SCENE_HINTS: Record<MemoryRecordSourceScene, string[]> = {
  direct_chat: ['direct_chat', 'direct chat', '单聊', '私聊'],
  group_chat: ['group_chat', 'group chat', '群聊', '公开互动'],
  group_offline: ['group_offline', 'group offline', '群线下', '线下场景', '线下互动'],
  dating: ['dating', 'date', '约会', '暧昧推进'],
  music_together: ['music_together', 'music together', '一起听歌', '音乐互动'],
  couple_space: ['couple_space', 'couple space', '情侣空间', '共同生活'],
  forum: ['forum', '论坛', '公开场景'],
  moments: ['moments', '动态', '公开动态'],
  manual: ['manual', '手动'],
};

const FACT_TYPE_HINTS: Record<FactTraceRecord['factType'], string[]> = {
  preference: ['偏好', '喜欢', '习惯'],
  plan: ['计划', '约定', '待办', '下次'],
  status: ['状态', '近况', '当前情况'],
  experience: ['经历', '回忆', '一起发生'],
  background: ['背景', '设定', '长期信息'],
};

const RELATIONSHIP_EVENT_HINTS: Record<RelationshipWaveEventKind, string[]> = {
  support: ['支持', '接住情绪', '站你这边'],
  tease: ['打趣', '逗你', '嘴硬'],
  conflict: ['别扭', '争执', '冲突'],
  reconcile: ['和好', '缓和', '重新接上'],
  protect: ['护着', '照顾', '替你挡一下'],
  jealousy: ['吃醋', '在意', '占有欲'],
  bonding: ['靠近', '升温', '暧昧推进'],
  public_stance: ['公开态度', '公开站位', '公开互动'],
  shared_experience: ['共同经历', '一起发生', '同一段经历'],
};

export function buildSourceSceneTags(sourceScene: MemoryRecordSourceScene): string[] {
  return SOURCE_SCENE_HINTS[sourceScene] || [sourceScene];
}

export function buildFactRecordHints(record: FactTraceRecord): string[] | undefined {
  return dedupeHintTexts([
    record.summary,
    record.factType,
    record.subjectType,
    ...FACT_TYPE_HINTS[record.factType],
    ...buildSourceSceneTags(record.sourceScene),
  ]);
}

export function buildRelationshipWaveHints(record: RelationshipWaveRecord): string[] | undefined {
  return dedupeHintTexts([
    record.summary,
    record.eventKind,
    record.relationType,
    record.valence,
    ...RELATIONSHIP_EVENT_HINTS[record.eventKind],
    ...buildSourceSceneTags(record.sourceScene),
  ]);
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
    ...(buildFactRecordHints(params.record)
      ? { retrievalHints: buildFactRecordHints(params.record) }
      : {}),
    ...(buildSourceSceneTags(params.record.sourceScene).length > 0
      ? { sceneTags: buildSourceSceneTags(params.record.sourceScene) }
      : {}),
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
    ...(buildRelationshipWaveHints(params.record)
      ? { retrievalHints: buildRelationshipWaveHints(params.record) }
      : {}),
    ...(buildSourceSceneTags(params.record.sourceScene).length > 0
      ? { sceneTags: buildSourceSceneTags(params.record.sourceScene) }
      : {}),
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
    retrievalHints: dedupeHintTexts([
      summary,
      '转账',
      '收款',
      ...FACT_TYPE_HINTS.experience,
      ...buildSourceSceneTags('direct_chat'),
    ]),
    sceneTags: buildSourceSceneTags('direct_chat'),
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

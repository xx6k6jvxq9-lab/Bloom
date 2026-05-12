import type { FactMemoryRecord, MemoryRecord, RelationshipWaveMemoryRecord } from '../../services/memory/memoryRecordTypes';
import type { PersistedMemoryRecordData } from '../../services/memory/buildMemoryRecordData';
import { loadJsonRecordEnvelope, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

let memoryRecordCache: PersistedMemoryRecordData | null = null;

function normalizeSummaryKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeCharacterIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
      .map((candidate) => candidate.trim()),
  )].sort();
}

function normalizeMemoryRecord(value: unknown): MemoryRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const kind = candidate.kind === 'fact' || candidate.kind === 'relationship_wave'
    ? candidate.kind
    : null;
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  const sourceScene = typeof candidate.sourceScene === 'string' ? candidate.sourceScene : '';
  const sourceSessionType = candidate.sourceSessionType === 'direct' || candidate.sourceSessionType === 'group'
    ? candidate.sourceSessionType
    : null;
  const sourceSessionId = typeof candidate.sourceSessionId === 'string' ? candidate.sourceSessionId.trim() : '';
  const sourceEventIds = Array.isArray(candidate.sourceEventIds)
    ? candidate.sourceEventIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const characterIds = normalizeCharacterIdList(candidate.characterIds);
  const visibility = candidate.visibility === 'private'
    || candidate.visibility === 'group_public'
    || candidate.visibility === 'cross_scene_readable'
      ? candidate.visibility
      : null;
  const stability = candidate.stability === 'temporary'
    || candidate.stability === 'situational'
    || candidate.stability === 'stable'
      ? candidate.stability
      : null;
  const decayHint = candidate.decayHint === 'short'
    || candidate.decayHint === 'medium'
    || candidate.decayHint === 'stable'
      ? candidate.decayHint
      : null;
  const summary = typeof candidate.summary === 'string' ? candidate.summary.trim() : '';
  const timestamp = typeof candidate.timestamp === 'number' && Number.isFinite(candidate.timestamp)
    ? Math.max(0, Math.floor(candidate.timestamp))
    : null;

  if (!kind || !id || !sourceScene || !sourceSessionType || !sourceSessionId || !visibility || !stability || !decayHint || !summary || timestamp === null || characterIds.length === 0) {
    return null;
  }

  if (kind === 'fact') {
    if (
      typeof candidate.factType !== 'string'
      || typeof candidate.subjectType !== 'string'
      || typeof candidate.subjectId !== 'string'
      || !candidate.subjectId.trim()
      || typeof candidate.confidence !== 'string'
    ) {
      return null;
    }

    return {
      id,
      kind,
      sourceScene: sourceScene as MemoryRecord['sourceScene'],
      sourceSessionType,
      sourceSessionId,
      sourceEventIds,
      characterIds,
      ...(typeof candidate.groupId === 'string' && candidate.groupId.trim() ? { groupId: candidate.groupId.trim() } : {}),
      visibility,
      stability,
      decayHint,
      summary,
      timestamp,
      factType: candidate.factType as FactMemoryRecord['factType'],
      subjectType: candidate.subjectType as FactMemoryRecord['subjectType'],
      subjectId: candidate.subjectId.trim(),
      confidence: candidate.confidence as FactMemoryRecord['confidence'],
      ...(normalizeCharacterIdList(candidate.relatedCharacterIds).length > 0
        ? { relatedCharacterIds: normalizeCharacterIdList(candidate.relatedCharacterIds) }
        : {}),
    };
  }

  if (
    typeof candidate.relationType !== 'string'
    || typeof candidate.eventKind !== 'string'
    || typeof candidate.valence !== 'string'
    || typeof candidate.intensity !== 'string'
    || typeof candidate.sourceCharacterId !== 'string'
    || !candidate.sourceCharacterId.trim()
  ) {
    return null;
  }

  return {
    id,
    kind,
    sourceScene: sourceScene as MemoryRecord['sourceScene'],
    sourceSessionType,
    sourceSessionId,
    sourceEventIds,
    characterIds,
    ...(typeof candidate.groupId === 'string' && candidate.groupId.trim() ? { groupId: candidate.groupId.trim() } : {}),
    visibility,
    stability,
    decayHint,
    summary,
    timestamp,
    relationType: candidate.relationType as RelationshipWaveMemoryRecord['relationType'],
    eventKind: candidate.eventKind as RelationshipWaveMemoryRecord['eventKind'],
    valence: candidate.valence as RelationshipWaveMemoryRecord['valence'],
    intensity: candidate.intensity as RelationshipWaveMemoryRecord['intensity'],
    sourceCharacterId: candidate.sourceCharacterId.trim(),
    ...(typeof candidate.targetCharacterId === 'string' && candidate.targetCharacterId.trim()
      ? { targetCharacterId: candidate.targetCharacterId.trim() }
      : {}),
    ...(candidate.targetUser ? { targetUser: true } : {}),
  };
}

function dedupeMemoryRecords(records: MemoryRecord[]): MemoryRecord[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();

  return [...records]
    .sort((left, right) => right.timestamp - left.timestamp)
    .filter((record) => {
      const normalizedId = record.id.trim().toLowerCase();
      const structuralKey = [
        record.kind,
        record.sourceScene,
        record.sourceSessionType,
        record.sourceSessionId,
        record.timestamp,
        normalizeSummaryKey(record.summary),
      ].join('|').toLowerCase();

      if (seenIds.has(normalizedId) || seenKeys.has(structuralKey)) {
        return false;
      }

      seenIds.add(normalizedId);
      seenKeys.add(structuralKey);
      return true;
    });
}

function normalizePersistedMemoryRecordData(value: unknown): PersistedMemoryRecordData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      recordsByCharacterId: {},
    };
  }

  const candidate = value as Partial<PersistedMemoryRecordData>;
  const recordsByCharacterIdInput =
    candidate.recordsByCharacterId && typeof candidate.recordsByCharacterId === 'object' && !Array.isArray(candidate.recordsByCharacterId)
      ? candidate.recordsByCharacterId
      : {};

  const recordsByCharacterId = Object.fromEntries(
    Object.entries(recordsByCharacterIdInput).flatMap(([characterId, records]) => {
      const normalizedRecords = Array.isArray(records)
        ? dedupeMemoryRecords(records.map((record) => normalizeMemoryRecord(record)).filter((record): record is MemoryRecord => record !== null))
        : [];

      return normalizedRecords.length > 0
        ? [[characterId, normalizedRecords] as const]
        : [];
    }),
  );

  return {
    ...(typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt)
      ? { updatedAt: Math.max(0, Math.floor(candidate.updatedAt)) }
      : {}),
    recordsByCharacterId,
  };
}

function serializeMemoryRecordData(value: PersistedMemoryRecordData): string {
  return JSON.stringify(normalizePersistedMemoryRecordData(value));
}

function getLatestTimestamp(value: PersistedMemoryRecordData): number {
  return Object.values(value.recordsByCharacterId || {}).reduce((latestTimestamp, records) => (
    Math.max(
      latestTimestamp,
      ...records.map((record) => record.timestamp),
    )
  ), value.updatedAt ?? 0);
}

export function loadMemoryRecordData(
  fallback: PersistedMemoryRecordData = {
    recordsByCharacterId: {},
  },
): PersistedMemoryRecordData {
  if (memoryRecordCache) {
    return memoryRecordCache;
  }

  memoryRecordCache = normalizePersistedMemoryRecordData(
    loadJson<PersistedMemoryRecordData | null>(STORAGE_KEYS.memoryRecords, fallback),
  );
  return memoryRecordCache;
}

export async function loadPreferredMemoryRecordData(
  fallback: PersistedMemoryRecordData = {
    recordsByCharacterId: {},
  },
): Promise<PersistedMemoryRecordData> {
  const localValue = normalizePersistedMemoryRecordData(
    loadJson<PersistedMemoryRecordData | null>(STORAGE_KEYS.memoryRecords, fallback),
  );

  try {
    const persistedEnvelope = await loadJsonRecordEnvelope<PersistedMemoryRecordData>(STORAGE_KEYS.memoryRecords);
    const indexedDbValue = normalizePersistedMemoryRecordData(persistedEnvelope.value);
    const indexedDbTimestamp = Math.max(persistedEnvelope.updatedAt ?? 0, getLatestTimestamp(indexedDbValue));
    const localTimestamp = getLatestTimestamp(localValue);
    const shouldPreferIndexedDb = Object.keys(indexedDbValue.recordsByCharacterId).length > 0 && indexedDbTimestamp >= localTimestamp;

    if (shouldPreferIndexedDb) {
      memoryRecordCache = indexedDbValue;
      saveJson(STORAGE_KEYS.memoryRecords, indexedDbValue);
      return indexedDbValue;
    }
  } catch (error) {
    console.error('[memoryRecordStore] Failed to load memory records from IndexedDB', error);
  }

  memoryRecordCache = localValue;
  return localValue;
}

export async function saveMemoryRecordData(value: PersistedMemoryRecordData): Promise<void> {
  const normalizedValue = normalizePersistedMemoryRecordData(value);
  memoryRecordCache = normalizedValue;
  saveJson(STORAGE_KEYS.memoryRecords, normalizedValue);
  await saveJsonRecord(STORAGE_KEYS.memoryRecords, normalizedValue);
}

export function resetMemoryRecordData(): void {
  memoryRecordCache = null;
  removeStoredJson(STORAGE_KEYS.memoryRecords);
  void removeJsonRecord(STORAGE_KEYS.memoryRecords).catch((error) => {
    console.error('[memoryRecordStore] Failed to remove memory records from IndexedDB', error);
  });
}

export function areMemoryRecordDataEqual(left: PersistedMemoryRecordData, right: PersistedMemoryRecordData): boolean {
  return serializeMemoryRecordData(left) === serializeMemoryRecordData(right);
}

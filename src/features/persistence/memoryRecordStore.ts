import type {
  FactMemoryRecord,
  MemoryRecord,
  NoteMemoryRecord,
  RelationshipWaveMemoryRecord,
  SceneProgressMemoryRecord,
  SnapshotMemoryRecord,
} from '../../services/memory/memoryRecordTypes';
import type { PersistedMemoryRecordData } from '../../services/memory/buildMemoryRecordData';
import { listJsonRecordKeys, loadJsonRecord, loadJsonRecordEnvelope, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

const MEMORY_RECORD_SHARD_INDEX_FORMAT = 'memory-record-shard-index';
const MEMORY_RECORD_SHARD_VERSION = 1;
const MEMORY_RECORD_CHARACTER_PREFIX = `${STORAGE_KEYS.memoryRecords}:character:`;

type PersistedMemoryRecordShardIndex = {
  format: typeof MEMORY_RECORD_SHARD_INDEX_FORMAT;
  version: typeof MEMORY_RECORD_SHARD_VERSION;
  updatedAt: number;
  characterIds: string[];
};

let memoryRecordCache: PersistedMemoryRecordData | null = null;
let memoryRecordShardIndexCache: PersistedMemoryRecordShardIndex | null = null;

function normalizeSummaryKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeOptionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

function sanitizeCharacterIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
      .map((candidate) => candidate.trim()),
  )].sort();
}

function sanitizeOptionalStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
      .map((candidate) => candidate.replace(/\s+/g, ' ').trim()),
  )];
}

function normalizeMemoryRecord(value: unknown): MemoryRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const kind = candidate.kind === 'fact'
    || candidate.kind === 'relationship_wave'
    || candidate.kind === 'scene_progress'
    || candidate.kind === 'snapshot'
    || candidate.kind === 'note'
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
  const retrievalHints = sanitizeOptionalStringList(candidate.retrievalHints);
  const sceneTags = sanitizeOptionalStringList(candidate.sceneTags);
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
      ...(retrievalHints.length > 0 ? { retrievalHints } : {}),
      ...(sceneTags.length > 0 ? { sceneTags } : {}),
      factType: candidate.factType as FactMemoryRecord['factType'],
      subjectType: candidate.subjectType as FactMemoryRecord['subjectType'],
      subjectId: candidate.subjectId.trim(),
      confidence: candidate.confidence as FactMemoryRecord['confidence'],
      ...(normalizeCharacterIdList(candidate.relatedCharacterIds).length > 0
        ? { relatedCharacterIds: normalizeCharacterIdList(candidate.relatedCharacterIds) }
        : {}),
    };
  }

  if (kind === 'snapshot') {
    if (typeof candidate.snapshotType !== 'string') {
      return null;
    }

    const text = normalizeOptionalText(candidate.text);
    if (!text) {
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
      ...(retrievalHints.length > 0 ? { retrievalHints } : {}),
      ...(sceneTags.length > 0 ? { sceneTags } : {}),
      snapshotType: candidate.snapshotType as SnapshotMemoryRecord['snapshotType'],
      text,
    };
  }

  if (kind === 'note') {
    if (
      (candidate.noteType !== 'manual' && candidate.noteType !== 'imported')
      || (candidate.libraryKind !== 'short-term' && candidate.libraryKind !== 'long-term')
      || (candidate.librarySource !== 'auto' && candidate.librarySource !== 'manual')
    ) {
      return null;
    }

    const text = normalizeOptionalText(candidate.text);
    if (!text) {
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
      ...(retrievalHints.length > 0 ? { retrievalHints } : {}),
      ...(sceneTags.length > 0 ? { sceneTags } : {}),
      noteType: candidate.noteType as NoteMemoryRecord['noteType'],
      libraryKind: candidate.libraryKind as NoteMemoryRecord['libraryKind'],
      librarySource: candidate.librarySource as NoteMemoryRecord['librarySource'],
      text,
    };
  }

  if (kind === 'scene_progress') {
    if (typeof candidate.stageLabel !== 'string') {
      return null;
    }

    const completedActions = Array.isArray(candidate.completedActions)
      ? candidate.completedActions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
      : [];
    const bannedRepeatActions = Array.isArray(candidate.bannedRepeatActions)
      ? candidate.bannedRepeatActions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
      : [];
    const nextStepOptions = Array.isArray(candidate.nextStepOptions)
      ? candidate.nextStepOptions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
      : [];

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
      ...(retrievalHints.length > 0 ? { retrievalHints } : {}),
      ...(sceneTags.length > 0 ? { sceneTags } : {}),
      stageLabel: candidate.stageLabel.trim(),
      ...(typeof candidate.currentBeat === 'string' && candidate.currentBeat.trim()
        ? { currentBeat: candidate.currentBeat.trim() }
        : {}),
      ...(typeof candidate.currentSignature === 'string' && candidate.currentSignature.trim()
        ? { currentSignature: candidate.currentSignature.trim() }
        : {}),
      ...(typeof candidate.previousSignature === 'string' && candidate.previousSignature.trim()
        ? { previousSignature: candidate.previousSignature.trim() }
        : {}),
      repeatedSignature: Boolean(candidate.repeatedSignature),
      completedActions,
      bannedRepeatActions,
      ...(typeof candidate.unresolvedTension === 'string' && candidate.unresolvedTension.trim()
        ? { unresolvedTension: candidate.unresolvedTension.trim() }
        : {}),
      nextStepOptions,
    } satisfies SceneProgressMemoryRecord;
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
    ...(retrievalHints.length > 0 ? { retrievalHints } : {}),
    ...(sceneTags.length > 0 ? { sceneTags } : {}),
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

function buildMemoryRecordStructuralKey(record: MemoryRecord): string {
  if (record.kind === 'snapshot') {
    return [
      record.kind,
      record.snapshotType,
      record.sourceScene,
      record.sourceSessionType,
      record.sourceSessionId,
      normalizeSummaryKey(record.text),
    ].join('|').toLowerCase();
  }

  if (record.kind === 'note') {
    return [
      record.kind,
      record.noteType,
      record.libraryKind,
      record.librarySource,
      record.sourceScene,
      record.sourceSessionType,
      record.sourceSessionId,
      normalizeSummaryKey(record.text),
    ].join('|').toLowerCase();
  }

  return [
    record.kind,
    record.sourceScene,
    record.sourceSessionType,
    record.sourceSessionId,
    record.timestamp,
    normalizeSummaryKey(record.summary),
  ].join('|').toLowerCase();
}

function dedupeMemoryRecords(records: MemoryRecord[]): MemoryRecord[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();

  return [...records]
    .sort((left, right) => right.timestamp - left.timestamp)
    .filter((record) => {
      const normalizedId = record.id.trim().toLowerCase();
      const structuralKey = buildMemoryRecordStructuralKey(record);

      if (seenIds.has(normalizedId) || seenKeys.has(structuralKey)) {
        return false;
      }

      seenIds.add(normalizedId);
      seenKeys.add(structuralKey);
      return true;
    });
}

function isPersistedMemoryRecordShardIndex(value: unknown): value is PersistedMemoryRecordShardIndex {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<PersistedMemoryRecordShardIndex>;
  return candidate.format === MEMORY_RECORD_SHARD_INDEX_FORMAT
    && candidate.version === MEMORY_RECORD_SHARD_VERSION
    && typeof candidate.updatedAt === 'number'
    && Array.isArray(candidate.characterIds);
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

function serializeMemoryRecordList(value: MemoryRecord[] | undefined): string {
  return JSON.stringify(dedupeMemoryRecords(value ?? []));
}

function getLatestTimestamp(value: PersistedMemoryRecordData): number {
  return Object.values(value.recordsByCharacterId || {}).reduce((latestTimestamp, records) => (
    Math.max(
      latestTimestamp,
      ...records.map((record) => record.timestamp),
    )
  ), value.updatedAt ?? 0);
}

function buildMemoryRecordStorageKey(characterId: string): string {
  return `${MEMORY_RECORD_CHARACTER_PREFIX}${characterId}`;
}

function buildShardIndex(value: PersistedMemoryRecordData): PersistedMemoryRecordShardIndex {
  return {
    format: MEMORY_RECORD_SHARD_INDEX_FORMAT,
    version: MEMORY_RECORD_SHARD_VERSION,
    updatedAt: value.updatedAt ?? Date.now(),
    characterIds: Object.keys(value.recordsByCharacterId || {}).sort(),
  };
}

function buildPersistedValue(value: PersistedMemoryRecordData): PersistedMemoryRecordData {
  return normalizePersistedMemoryRecordData({
    ...value,
    updatedAt: Date.now(),
  });
}

async function loadPersistedMemoryRecordShardIndex(): Promise<PersistedMemoryRecordShardIndex | null> {
  try {
    const persisted = await loadJsonRecord<unknown>(STORAGE_KEYS.memoryRecords);
    if (!isPersistedMemoryRecordShardIndex(persisted)) {
      return null;
    }

    return {
      ...persisted,
      characterIds: sanitizeCharacterIds(persisted.characterIds),
    };
  } catch (error) {
    console.error('[memoryRecordStore] Failed to inspect sharded memory record index', error);
    return null;
  }
}

async function listStoredMemoryRecordShardKeys(): Promise<string[]> {
  return listJsonRecordKeys(MEMORY_RECORD_CHARACTER_PREFIX);
}

async function loadShardedMemoryRecordData(
  shardIndex: PersistedMemoryRecordShardIndex,
  fallback: PersistedMemoryRecordData,
): Promise<PersistedMemoryRecordData> {
  const recordEntries = await Promise.all(
    shardIndex.characterIds.map(async (characterId) => {
      const records = await loadJsonRecord<unknown>(buildMemoryRecordStorageKey(characterId));
      const normalizedRecords = Array.isArray(records)
        ? dedupeMemoryRecords(records.map((record) => normalizeMemoryRecord(record)).filter((record): record is MemoryRecord => record !== null))
        : [];

      return normalizedRecords.length > 0
        ? [characterId, normalizedRecords] as const
        : null;
    }),
  );

  return normalizePersistedMemoryRecordData({
    ...fallback,
    updatedAt: shardIndex.updatedAt,
    recordsByCharacterId: Object.fromEntries(
      recordEntries.filter((entry): entry is readonly [string, MemoryRecord[]] => entry !== null),
    ),
  });
}

async function persistShardedMemoryRecordData(
  value: PersistedMemoryRecordData,
  options: {
    clearExistingShards?: boolean;
  } = {},
): Promise<void> {
  const persistedValue = buildPersistedValue(value);
  const shardIndex = buildShardIndex(persistedValue);
  const previousCache = memoryRecordCache;
  const previousShardIndex = memoryRecordShardIndexCache ?? await loadPersistedMemoryRecordShardIndex();
  const writes: Promise<void>[] = [];

  for (const characterId of shardIndex.characterIds) {
    const nextRecords = persistedValue.recordsByCharacterId[characterId] || [];
    const previousRecords = previousCache?.recordsByCharacterId[characterId];
    const shouldWrite =
      options.clearExistingShards
      || !previousRecords
      || serializeMemoryRecordList(previousRecords) !== serializeMemoryRecordList(nextRecords);

    if (shouldWrite) {
      writes.push(saveJsonRecord(buildMemoryRecordStorageKey(characterId), nextRecords));
    }
  }

  const staleShardKeys = options.clearExistingShards
    ? (await listStoredMemoryRecordShardKeys()).filter((key) => {
        if (!key.startsWith(MEMORY_RECORD_CHARACTER_PREFIX)) {
          return false;
        }

        const characterId = key.slice(MEMORY_RECORD_CHARACTER_PREFIX.length);
        return !shardIndex.characterIds.includes(characterId);
      })
    : (previousShardIndex?.characterIds || [])
      .filter((characterId) => !shardIndex.characterIds.includes(characterId))
      .map((characterId) => buildMemoryRecordStorageKey(characterId));

  await Promise.all([
    ...writes,
    ...staleShardKeys.map((key) => removeJsonRecord(key).catch((error) => {
      console.error(`[memoryRecordStore] Failed to remove stale memory record shard "${key}"`, error);
    })),
    saveJsonRecord(STORAGE_KEYS.memoryRecords, shardIndex),
  ]);

  memoryRecordCache = persistedValue;
  memoryRecordShardIndexCache = shardIndex;
  removeStoredJson(STORAGE_KEYS.memoryRecords);
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
  const legacyLocalValue = normalizePersistedMemoryRecordData(
    loadJson<PersistedMemoryRecordData | null>(STORAGE_KEYS.memoryRecords, fallback),
  );

  try {
    const persistedEnvelope = await loadJsonRecordEnvelope<unknown>(STORAGE_KEYS.memoryRecords);
    const localTimestamp = getLatestTimestamp(legacyLocalValue);

    if (isPersistedMemoryRecordShardIndex(persistedEnvelope.value)) {
      const shardIndex: PersistedMemoryRecordShardIndex = {
        ...persistedEnvelope.value,
        characterIds: sanitizeCharacterIds(persistedEnvelope.value.characterIds),
      };
      const indexedDbValue = await loadShardedMemoryRecordData(shardIndex, fallback);
      const shouldPreferIndexedDb =
        Object.keys(indexedDbValue.recordsByCharacterId).length > 0
        && shardIndex.updatedAt >= localTimestamp;

      if (shouldPreferIndexedDb) {
        memoryRecordCache = indexedDbValue;
        memoryRecordShardIndexCache = shardIndex;
        removeStoredJson(STORAGE_KEYS.memoryRecords);
        return indexedDbValue;
      }
    } else if (persistedEnvelope.value) {
      const legacyIndexedDbValue = normalizePersistedMemoryRecordData(persistedEnvelope.value);
      const indexedDbTimestamp = Math.max(
        persistedEnvelope.updatedAt ?? 0,
        getLatestTimestamp(legacyIndexedDbValue),
      );
      const shouldPreferIndexedDb =
        Object.keys(legacyIndexedDbValue.recordsByCharacterId).length > 0
        && indexedDbTimestamp >= localTimestamp;

      if (shouldPreferIndexedDb) {
        await persistShardedMemoryRecordData(legacyIndexedDbValue, { clearExistingShards: true });
        return memoryRecordCache ?? legacyIndexedDbValue;
      }
    }
  } catch (error) {
    console.error('[memoryRecordStore] Failed to load memory records from IndexedDB', error);
  }

  if (Object.keys(legacyLocalValue.recordsByCharacterId).length > 0) {
    try {
      await persistShardedMemoryRecordData(legacyLocalValue, { clearExistingShards: true });
    } catch (error) {
      console.error('[memoryRecordStore] Failed to migrate legacy local memory records into IndexedDB', error);
    }

    return memoryRecordCache ?? legacyLocalValue;
  }

  const normalizedFallback = normalizePersistedMemoryRecordData(fallback);
  memoryRecordCache = normalizedFallback;
  memoryRecordShardIndexCache = null;
  return normalizedFallback;
}

export async function saveMemoryRecordData(value: PersistedMemoryRecordData): Promise<void> {
  await persistShardedMemoryRecordData(value);
}

export function patchMemoryRecordData(
  updater: (current: PersistedMemoryRecordData) => PersistedMemoryRecordData,
  fallback: PersistedMemoryRecordData = {
    recordsByCharacterId: {},
  },
): Promise<PersistedMemoryRecordData> {
  const nextValue = updater(loadMemoryRecordData(fallback));
  return saveMemoryRecordData(nextValue).then(() => nextValue);
}

export function resetMemoryRecordData(): void {
  memoryRecordCache = null;
  memoryRecordShardIndexCache = null;
  removeStoredJson(STORAGE_KEYS.memoryRecords);
  void (async () => {
    const shardKeys = await listStoredMemoryRecordShardKeys().catch((error) => {
      console.error('[memoryRecordStore] Failed to list memory record shards for reset', error);
      return [] as string[];
    });

    await Promise.all([
      removeJsonRecord(STORAGE_KEYS.memoryRecords),
      ...shardKeys.map((key) => removeJsonRecord(key)),
    ]).catch((error) => {
      console.error('[memoryRecordStore] Failed to remove memory records from IndexedDB', error);
    });
  })();
}

export function areMemoryRecordDataEqual(left: PersistedMemoryRecordData, right: PersistedMemoryRecordData): boolean {
  return serializeMemoryRecordData(left) === serializeMemoryRecordData(right);
}

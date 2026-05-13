import type {
  CharacterSharedState,
  MemoryLibraryEntry,
  MemoryLibraryKind,
} from '../../types';
import { patchMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import type { PersistedMemoryRecordData } from './buildMemoryRecordData';
import type {
  MemoryRecord,
  MemoryRecordDecayHint,
  MemoryRecordLibrarySource,
  MemoryNoteType,
  MemoryRecordSourceScene,
  MemoryRecordSourceSessionType,
  MemoryRecordStability,
  MemoryRecordVisibility,
  NoteMemoryRecord,
  MemoryRecordLibraryKind,
  MemorySnapshotType,
  SnapshotMemoryRecord,
} from './memoryRecordTypes';

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildSnapshotSummary(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 160) {
    return normalized;
  }

  return `${normalized.slice(0, 157)}...`;
}

function buildSnapshotRecordDefaults(snapshotType: MemorySnapshotType): {
  visibility: MemoryRecordVisibility;
  stability: MemoryRecordStability;
  decayHint: MemoryRecordDecayHint;
} {
  if (snapshotType === 'long_term_profile') {
    return {
      visibility: 'cross_scene_readable',
      stability: 'stable',
      decayHint: 'stable',
    };
  }

  if (snapshotType === 'shared_state') {
    return {
      visibility: 'cross_scene_readable',
      stability: 'situational',
      decayHint: 'medium',
    };
  }

  return {
    visibility: 'private',
    stability: 'temporary',
    decayHint: 'short',
  };
}

function buildLibraryNoteDefaults(libraryKind: MemoryRecordLibraryKind): {
  visibility: MemoryRecordVisibility;
  stability: MemoryRecordStability;
  decayHint: MemoryRecordDecayHint;
} {
  if (libraryKind === 'long-term') {
    return {
      visibility: 'cross_scene_readable',
      stability: 'stable',
      decayHint: 'stable',
    };
  }

  return {
    visibility: 'private',
    stability: 'temporary',
    decayHint: 'short',
  };
}

export function buildSharedStateSnapshotText(sharedState: CharacterSharedState | undefined): string {
  if (!sharedState) {
    return '';
  }

  return [
    sharedState.sourceScene ? `来源场景：${sharedState.sourceScene}` : '',
    sharedState.availability ? `在线状态：${sharedState.availability}` : '',
    sharedState.resumeTone ? `回线语气：${sharedState.resumeTone}` : '',
    sharedState.currentActivity ? `当前生活底色：${sharedState.currentActivity}` : '',
    sharedState.attentionNote ? `开口方式：${sharedState.attentionNote}` : '',
    sharedState.publicCarryover ? `公开可见余波：${sharedState.publicCarryover}` : '',
    sharedState.privateCarryover ? `私下余波：${sharedState.privateCarryover}` : '',
  ].filter(Boolean).join('\n\n');
}

export function createSnapshotMemoryRecord(input: {
  characterId: string;
  snapshotType: MemorySnapshotType;
  text: string;
  sourceScene: MemoryRecordSourceScene;
  sourceSessionType?: MemoryRecordSourceSessionType;
  sourceSessionId?: string;
  timestamp?: number;
}): SnapshotMemoryRecord | null {
  const text = normalizeOptionalText(input.text);
  if (!text) {
    return null;
  }

  const timestamp = typeof input.timestamp === 'number' && Number.isFinite(input.timestamp)
    ? Math.max(0, Math.floor(input.timestamp))
    : Date.now();
  const defaults = buildSnapshotRecordDefaults(input.snapshotType);

  return {
    id: [
      'snapshot',
      input.snapshotType,
      input.characterId,
      timestamp,
      Math.random().toString(36).slice(2, 8),
    ].join('|'),
    kind: 'snapshot',
    sourceScene: input.sourceScene,
    sourceSessionType: input.sourceSessionType ?? (input.sourceScene === 'group_chat' ? 'group' : 'direct'),
    sourceSessionId: input.sourceSessionId ?? input.characterId,
    sourceEventIds: [],
    characterIds: [input.characterId],
    visibility: defaults.visibility,
    stability: defaults.stability,
    decayHint: defaults.decayHint,
    summary: buildSnapshotSummary(text),
    timestamp,
    snapshotType: input.snapshotType,
    text,
  };
}

export function createLibraryNoteMemoryRecord(input: {
  characterId: string;
  noteType: MemoryNoteType;
  libraryKind: MemoryLibraryKind;
  librarySource?: MemoryRecordLibrarySource;
  text: string;
  sourceScene?: MemoryRecordSourceScene;
  sourceSessionType?: MemoryRecordSourceSessionType;
  sourceSessionId?: string;
  timestamp?: number;
}): NoteMemoryRecord | null {
  const text = normalizeOptionalText(input.text);
  if (!text) {
    return null;
  }

  const timestamp = typeof input.timestamp === 'number' && Number.isFinite(input.timestamp)
    ? Math.max(0, Math.floor(input.timestamp))
    : Date.now();
  const defaults = buildLibraryNoteDefaults(input.libraryKind);
  const sourceScene = input.sourceScene ?? 'manual';

  return {
    id: [
      'note',
      input.noteType,
      input.libraryKind,
      input.characterId,
      timestamp,
      Math.random().toString(36).slice(2, 8),
    ].join('|'),
    kind: 'note',
    sourceScene,
    sourceSessionType: input.sourceSessionType ?? (sourceScene === 'group_chat' ? 'group' : 'direct'),
    sourceSessionId: input.sourceSessionId ?? input.characterId,
    sourceEventIds: [],
    characterIds: [input.characterId],
    visibility: defaults.visibility,
    stability: defaults.stability,
    decayHint: defaults.decayHint,
    summary: buildSnapshotSummary(text),
    timestamp,
    noteType: input.noteType,
    libraryKind: input.libraryKind,
    librarySource: input.librarySource ?? 'manual',
    text,
  };
}

function mergeCharacterRecords(
  current: PersistedMemoryRecordData,
  characterId: string,
  nextRecord: MemoryRecord,
): PersistedMemoryRecordData {
  const existingRecords = current.recordsByCharacterId[characterId] || [];

  return {
    ...current,
    updatedAt: Math.max(current.updatedAt ?? 0, nextRecord.timestamp),
    recordsByCharacterId: {
      ...current.recordsByCharacterId,
      [characterId]: [nextRecord, ...existingRecords],
    },
  };
}

export async function appendSnapshotMemoryRecord(input: {
  characterId: string;
  snapshotType: MemorySnapshotType;
  text: string;
  sourceScene: MemoryRecordSourceScene;
  sourceSessionType?: MemoryRecordSourceSessionType;
  sourceSessionId?: string;
  timestamp?: number;
}): Promise<void> {
  const record = createSnapshotMemoryRecord(input);
  if (!record) {
    return;
  }

  await patchMemoryRecordData((current) => mergeCharacterRecords(current, input.characterId, record));
}

export async function appendWorkingMemorySnapshots(input: {
  characterId: string;
  sourceScene: MemoryRecordSourceScene;
  shortTermSummary?: string;
  sharedState?: CharacterSharedState;
  sourceSessionType?: MemoryRecordSourceSessionType;
  sourceSessionId?: string;
  timestamp?: number;
}): Promise<void> {
  const records: MemoryRecord[] = [];
  const normalizedShortTermSummary = normalizeOptionalText(input.shortTermSummary);
  const sharedStateText = buildSharedStateSnapshotText(input.sharedState);

  if (normalizedShortTermSummary) {
    const shortTermRecord = createSnapshotMemoryRecord({
      characterId: input.characterId,
      snapshotType: 'short_term_summary',
      text: normalizedShortTermSummary,
      sourceScene: input.sourceScene,
      sourceSessionType: input.sourceSessionType,
      sourceSessionId: input.sourceSessionId,
      timestamp: input.timestamp,
    });
    if (shortTermRecord) {
      records.push(shortTermRecord);
    }
  }

  if (sharedStateText.trim()) {
    const sharedStateRecord = createSnapshotMemoryRecord({
      characterId: input.characterId,
      snapshotType: 'shared_state',
      text: sharedStateText,
      sourceScene: input.sharedState?.sourceScene || input.sourceScene,
      sourceSessionType: input.sourceSessionType,
      sourceSessionId: input.sourceSessionId,
      timestamp: input.timestamp ?? input.sharedState?.updatedAt,
    });
    if (sharedStateRecord) {
      records.push(sharedStateRecord);
    }
  }

  if (records.length === 0) {
    return;
  }

  await patchMemoryRecordData((current) => {
    const existingRecords = current.recordsByCharacterId[input.characterId] || [];
    const latestTimestamp = records.reduce((latest, record) => Math.max(latest, record.timestamp), current.updatedAt ?? 0);

    return {
      ...current,
      updatedAt: latestTimestamp,
      recordsByCharacterId: {
        ...current.recordsByCharacterId,
        [input.characterId]: [...records, ...existingRecords],
      },
    };
  });
}

export async function appendLibraryMemoryEntriesAsRecords(input: {
  characterId: string;
  entries: MemoryLibraryEntry[];
  noteType?: MemoryNoteType;
  sourceScene?: MemoryRecordSourceScene;
  sourceSessionType?: MemoryRecordSourceSessionType;
  sourceSessionId?: string;
}): Promise<void> {
  const records = input.entries
    .map((entry) => createLibraryNoteMemoryRecord({
      characterId: input.characterId,
      noteType: input.noteType ?? 'imported',
      libraryKind: entry.kind,
      librarySource: entry.source,
      text: entry.content,
      sourceScene: input.sourceScene,
      sourceSessionType: input.sourceSessionType,
      sourceSessionId: input.sourceSessionId,
      timestamp: entry.createdAt,
    }))
    .filter((record): record is NoteMemoryRecord => record !== null);

  if (records.length === 0) {
    return;
  }

  await patchMemoryRecordData((current) => {
    const existingRecords = current.recordsByCharacterId[input.characterId] || [];
    const latestTimestamp = records.reduce((latest, record) => Math.max(latest, record.timestamp), current.updatedAt ?? 0);

    return {
      ...current,
      updatedAt: latestTimestamp,
      recordsByCharacterId: {
        ...current.recordsByCharacterId,
        [input.characterId]: [...records, ...existingRecords],
      },
    };
  });
}

export async function removeMemoryRecordById(input: {
  characterId: string;
  recordId: string;
}): Promise<void> {
  await patchMemoryRecordData((current) => ({
    ...current,
    recordsByCharacterId: {
      ...current.recordsByCharacterId,
      [input.characterId]: (current.recordsByCharacterId[input.characterId] || [])
        .filter((record) => record.id !== input.recordId),
    },
  }));
}

export function buildLegacyCharacterMemoryNoteRecords(
  record: Record<string, MemoryLibraryEntry[]>,
): NoteMemoryRecord[] {
  return Object.entries(record)
    .flatMap(([characterId, entries]) => (
      (entries || []).map((entry) => createLibraryNoteMemoryRecord({
        characterId,
        noteType: 'manual',
        libraryKind: entry.kind,
        librarySource: entry.source,
        text: entry.content,
        sourceScene: 'manual',
        timestamp: entry.createdAt,
      }))
    ))
    .filter((item): item is NoteMemoryRecord => item !== null);
}

export function mergeLegacyCharacterMemoryRecordIntoMemoryRecordData(
  current: PersistedMemoryRecordData,
  record: Record<string, MemoryLibraryEntry[]>,
): PersistedMemoryRecordData {
  const records = buildLegacyCharacterMemoryNoteRecords(record);

  if (records.length === 0) {
    return current;
  }

  const nextRecordsByCharacterId = { ...current.recordsByCharacterId };
  let latestTimestamp = current.updatedAt ?? 0;

  for (const recordItem of records) {
    latestTimestamp = Math.max(latestTimestamp, recordItem.timestamp);
    const characterId = recordItem.characterIds[0];
    if (!characterId) {
      continue;
    }

    nextRecordsByCharacterId[characterId] = [
      recordItem,
      ...(nextRecordsByCharacterId[characterId] || []),
    ];
  }

  return {
    ...current,
    updatedAt: latestTimestamp,
    recordsByCharacterId: nextRecordsByCharacterId,
  };
}

export async function appendLegacyCharacterMemoryRecordAsNotes(
  record: Record<string, MemoryLibraryEntry[]>,
): Promise<void> {
  await patchMemoryRecordData((current) => (
    mergeLegacyCharacterMemoryRecordIntoMemoryRecordData(current, record)
  ));
}

function createProjectedMemoryLibraryEntry(record: SnapshotMemoryRecord | NoteMemoryRecord): MemoryLibraryEntry {
  const date = new Date(record.timestamp);
  const kind: MemoryLibraryKind = record.kind === 'snapshot'
    ? (record.snapshotType === 'long_term_profile' ? 'long-term' : 'short-term')
    : record.libraryKind;
  const source = record.kind === 'snapshot' && record.sourceScene !== 'manual'
    ? 'auto'
    : record.kind === 'note'
      ? record.librarySource
      : 'manual';

  return {
    id: `record:${record.id}`,
    kind,
    source,
    content: record.text,
    createdAt: record.timestamp,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    charCount: record.text.length,
  };
}

export function projectMemoryLibraryEntriesFromRecords(input: {
  characterId: string;
  kind: MemoryLibraryKind;
  records?: MemoryRecord[];
}): MemoryLibraryEntry[] {
  const expectedSnapshotType: MemorySnapshotType = input.kind === 'long-term'
    ? 'long_term_profile'
    : 'short_term_summary';

  return (input.records || [])
    .filter((record): record is SnapshotMemoryRecord | NoteMemoryRecord => {
      if (!record.characterIds.includes(input.characterId)) {
        return false;
      }

      if (record.kind === 'snapshot') {
        return record.snapshotType === expectedSnapshotType;
      }

      return record.kind === 'note' && record.libraryKind === input.kind;
    })
    .sort((left, right) => right.timestamp - left.timestamp)
    .map(createProjectedMemoryLibraryEntry);
}

import type { Character, CharacterOpenLoopEntry } from '../../types';
import { loadMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import type { MemoryRecord, MemorySnapshotType } from './memoryRecordTypes';
import type { PersistedMemoryRecordData } from './buildMemoryRecordData';
import type { ResolvedMemoryLayerDiagnostics } from './types';

export type DerivedMemoryLayers = {
  shortTermSummary?: string;
  longTermMemoryProfile?: string;
  openLoopRegistry?: CharacterOpenLoopEntry[];
  diagnostics: ResolvedMemoryLayerDiagnostics;
};

type RelationshipWaveRecord = Extract<MemoryRecord, { kind: 'relationship_wave' }>;
type FactMemoryRecord = Extract<MemoryRecord, { kind: 'fact' }>;
type SceneProgressMemoryRecord = Extract<MemoryRecord, { kind: 'scene_progress' }>;
type SnapshotRecord = Extract<MemoryRecord, { kind: 'snapshot' }>;

const MAX_SHORT_TERM_RECORDS = 6;
const MAX_LONG_TERM_LINES = 4;
const RECENT_SHORT_TERM_MS = 14 * 24 * 60 * 60 * 1000;

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function getCharacterRecords(
  characterId: string | undefined,
  data?: PersistedMemoryRecordData,
): MemoryRecord[] {
  if (!characterId) {
    return [];
  }

  const source = data ?? loadMemoryRecordData({
    recordsByCharacterId: {},
  });
  return [...(source.recordsByCharacterId[characterId] || [])]
    .sort((left, right) => right.timestamp - left.timestamp);
}

function formatRelationshipAtmosphere(record: RelationshipWaveRecord): string {
  if (record.eventKind === 'conflict') {
    return '最近有点顶着，语气需要收一收。';
  }
  if (record.eventKind === 'reconcile') {
    return '最近刚缓和过一次，气氛在往回拉。';
  }
  if (record.eventKind === 'jealousy') {
    return '最近带着一点在意和别扭。';
  }
  if (record.eventKind === 'support' || record.eventKind === 'protect') {
    return '最近明显更护着你，也更愿意接住情绪。';
  }
  if (record.eventKind === 'bonding' || record.eventKind === 'shared_experience') {
    return '最近靠近感更明显，互动里带着熟稔和延续感。';
  }
  if (record.eventKind === 'tease') {
    return '最近互动里带着一点互逗和回刺。';
  }

  if (record.valence === 'negative') {
    return '最近气氛偏紧，容易碰到边。';
  }
  if (record.valence === 'mixed') {
    return '最近这段关系余波还没完全落下去。';
  }
  return '最近气氛偏近，互动里还带着余温。';
}

function formatFactResidual(record: FactMemoryRecord): string {
  if (record.factType === 'plan') {
    return `最近提到过「${record.summary}」，还算一个待继续点。`;
  }
  if (record.factType === 'status') {
    return `最近状态相关的是「${record.summary}」。`;
  }
  if (record.factType === 'experience') {
    return `最近共同经历还挂着「${record.summary}」。`;
  }
  return record.summary;
}

function formatFactLongTerm(record: FactMemoryRecord): string {
  if (record.factType === 'preference') {
    return `偏好与习惯：${record.summary}`;
  }
  if (record.factType === 'background') {
    return `背景与长期线索：${record.summary}`;
  }
  if (record.factType === 'experience') {
    return `长期可参考的经历锚点：${record.summary}`;
  }
  return record.summary;
}

function formatSceneProgressResidual(record: SceneProgressMemoryRecord): string {
  return `场景推进：${record.summary}`;
}

function formatWaveLongTerm(record: RelationshipWaveRecord): string {
  if (record.eventKind === 'bonding' || record.eventKind === 'shared_experience') {
    return `关系底色：${record.summary}`;
  }
  if (record.eventKind === 'support' || record.eventKind === 'protect') {
    return `关系倾向：${record.summary}`;
  }
  if (record.eventKind === 'reconcile') {
    return `相处模式：${record.summary}`;
  }
  return `关系印象：${record.summary}`;
}

function buildDerivedOpenLoopEntry(
  record: MemoryRecord,
): CharacterOpenLoopEntry | null {
  if (record.kind === 'scene_progress') {
    const status = record.repeatedSignature || record.unresolvedTension
      ? 'waiting_user'
      : 'dormant';
    return {
      id: `memory-open-loop-${record.id}`,
      kind: 'scene',
      status,
      content: `当前场景推进停在：${record.summary}`,
      source: 'recent_history',
      createdAt: record.timestamp,
      lastTouchedAt: record.timestamp,
      updatedAt: record.timestamp,
      resumeHint: record.repeatedSignature
        ? '当前场景最近已经出现重复推进，只有用户重新触发或明确换方向时才恢复，不要自动沿用旧动作。'
        : '把这条推进当成场景停留点，只有当前语境重新触发时才恢复，不要直接续写旧动作。',
    };
  }

  if (record.kind === 'fact') {
    if (record.factType !== 'plan') {
      return null;
    }

    const status = record.stability === 'temporary' ? 'waiting_user' : 'dormant';
    return {
      id: `memory-open-loop-${record.id}`,
      kind: 'task',
      status,
      content: `最近提到过：${record.summary}`,
      source: 'recent_history',
      createdAt: record.timestamp,
      lastTouchedAt: record.timestamp,
      updatedAt: record.timestamp,
      resumeHint: '除非用户当前继续提这个待办或计划，否则先回应眼前，再决定要不要接回去。',
    };
  }

  if (record.kind !== 'relationship_wave') {
    return null;
  }

  if (
    record.eventKind !== 'conflict'
    && record.eventKind !== 'reconcile'
    && record.eventKind !== 'jealousy'
    && record.eventKind !== 'shared_experience'
  ) {
    return null;
  }

  return {
    id: `memory-open-loop-${record.id}`,
    kind: record.eventKind === 'shared_experience' ? 'topic' : 'relationship',
    status: record.decayHint === 'short' ? 'waiting_user' : 'dormant',
    content: `最近这段余波还在：${record.summary}`,
    source: 'recent_history',
    createdAt: record.timestamp,
    lastTouchedAt: record.timestamp,
    updatedAt: record.timestamp,
    resumeHint: '默认先把它当关系余波留在语气里，等用户当前重新碰到时再接回去。',
  };
}

function dedupeTextLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const normalized = line.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function dedupeOpenLoopEntries(entries: CharacterOpenLoopEntry[]): CharacterOpenLoopEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.kind}:${entry.content.replace(/\s+/g, ' ').trim().toLowerCase()}`;
    if (!entry.content.trim() || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getLatestSnapshotRecord(
  records: SnapshotRecord[],
  snapshotType: MemorySnapshotType,
): SnapshotRecord | undefined {
  return records.find((record) => record.snapshotType === snapshotType);
}

function resolveShortTermSnapshotFallback(
  snapshotRecords: SnapshotRecord[],
): {
  text?: string;
  snapshotTypeUsed?: MemorySnapshotType;
} {
  const shortTermSnapshot = getLatestSnapshotRecord(snapshotRecords, 'short_term_summary');
  if (shortTermSnapshot?.text.trim()) {
    return {
      text: normalizeOptionalText(shortTermSnapshot.text),
      snapshotTypeUsed: 'short_term_summary',
    };
  }

  const sharedStateSnapshot = getLatestSnapshotRecord(snapshotRecords, 'shared_state');
  if (sharedStateSnapshot?.text.trim()) {
    return {
      text: normalizeOptionalText(sharedStateSnapshot.text),
      snapshotTypeUsed: 'shared_state',
    };
  }

  return {};
}

function resolveLongTermSnapshotFallback(
  snapshotRecords: SnapshotRecord[],
): {
  text?: string;
  snapshotTypeUsed?: MemorySnapshotType;
} {
  const longTermSnapshot = getLatestSnapshotRecord(snapshotRecords, 'long_term_profile');
  if (!longTermSnapshot?.text.trim()) {
    return {};
  }

  return {
    text: normalizeOptionalText(longTermSnapshot.text),
    snapshotTypeUsed: 'long_term_profile',
  };
}

export function buildDerivedMemoryLayersFromRecords(
  input: Pick<Character, 'id'>,
  options: {
    nowTimestamp?: number;
    recordsData?: PersistedMemoryRecordData;
  } = {},
): DerivedMemoryLayers {
  const nowTimestamp = options.nowTimestamp ?? Date.now();
  const records = getCharacterRecords(input.id, options.recordsData);
  const snapshotRecords = records.filter((record): record is SnapshotRecord => record.kind === 'snapshot');
  const diagnostics: ResolvedMemoryLayerDiagnostics = {
    shortTermSummarySource: 'empty',
    longTermMemoryProfileSource: 'empty',
    recordCounts: {
      facts: records.filter((record) => record.kind === 'fact').length,
      relationshipWaves: records.filter((record) => record.kind === 'relationship_wave').length,
      sceneProgress: records.filter((record) => record.kind === 'scene_progress').length,
      snapshots: snapshotRecords.length,
      notes: records.filter((record) => record.kind === 'note').length,
    },
  };
  if (records.length === 0) {
    return {
      diagnostics,
    };
  }

  const recentRecords = records
    .filter((record) => nowTimestamp - record.timestamp <= RECENT_SHORT_TERM_MS)
    .slice(0, MAX_SHORT_TERM_RECORDS);
  const shortTermRecords = recentRecords.filter((record) => record.decayHint !== 'stable' || record.stability !== 'stable');
  const relationshipRecords = shortTermRecords.filter((record): record is RelationshipWaveRecord => record.kind === 'relationship_wave');
  const factRecords = shortTermRecords.filter((record): record is FactMemoryRecord => record.kind === 'fact');
  const sceneProgressRecords = shortTermRecords.filter((record): record is SceneProgressMemoryRecord => record.kind === 'scene_progress');

  const currentAtmosphereLine = relationshipRecords[0]
    ? `当前氛围：${formatRelationshipAtmosphere(relationshipRecords[0])}`
    : undefined;
  const temporaryConstraintLine = factRecords.find((record) => (
    record.factType === 'status' && record.stability === 'temporary'
  ))
    ? `临时限制：${formatFactResidual(
      factRecords.find((record) => record.factType === 'status' && record.stability === 'temporary')!,
    )}`
    : undefined;
  const residualLines = dedupeTextLines([
    ...sceneProgressRecords.slice(0, 2).map((record) => `短期余波：${formatSceneProgressResidual(record)}`),
    ...relationshipRecords.slice(0, 2).map((record) => `短期余波：${record.summary}`),
    ...factRecords
      .filter((record) => record.factType === 'experience' || record.factType === 'status')
      .slice(0, 2)
      .map((record) => `短期余波：${formatFactResidual(record)}`),
  ]);
  const openLoopEntries = dedupeOpenLoopEntries(
    shortTermRecords
      .map((record) => buildDerivedOpenLoopEntry(record))
      .filter((entry): entry is CharacterOpenLoopEntry => entry !== null),
  ).slice(0, 4);
  const openLoopLines = openLoopEntries.map((entry) => (
    `开放回路（${entry.status}）：${entry.content}`
  ));

  const derivedShortTermSummary = dedupeTextLines([
    ...(currentAtmosphereLine ? [currentAtmosphereLine] : []),
    ...(temporaryConstraintLine ? [temporaryConstraintLine] : []),
    ...residualLines,
    ...openLoopLines,
  ]).join('\n');
  const shortTermSnapshotFallback = resolveShortTermSnapshotFallback(snapshotRecords);
  const shortTermSummary = normalizeOptionalText(derivedShortTermSummary)
    || shortTermSnapshotFallback.text;

  const longTermFactLines = records
    .filter((record): record is FactMemoryRecord => record.kind === 'fact')
    .filter((record) => (
      record.factType === 'preference'
      || record.factType === 'background'
      || record.stability === 'stable'
      || record.decayHint === 'stable'
    ))
    .slice(0, 4)
    .map(formatFactLongTerm);
  const longTermWaveLines = records
    .filter((record): record is RelationshipWaveRecord => record.kind === 'relationship_wave')
    .filter((record) => (
      record.decayHint === 'stable'
      || record.eventKind === 'bonding'
      || record.eventKind === 'shared_experience'
      || record.eventKind === 'support'
      || record.eventKind === 'protect'
    ))
    .slice(0, 3)
    .map(formatWaveLongTerm);
  const derivedLongTermMemoryProfile = dedupeTextLines([
    ...longTermFactLines,
    ...longTermWaveLines,
  ]).slice(0, MAX_LONG_TERM_LINES).join('\n');
  const longTermSnapshotFallback = resolveLongTermSnapshotFallback(snapshotRecords);
  const longTermMemoryProfile = normalizeOptionalText(derivedLongTermMemoryProfile)
    || longTermSnapshotFallback.text;

  return {
    ...(shortTermSummary ? { shortTermSummary } : {}),
    ...(longTermMemoryProfile ? { longTermMemoryProfile } : {}),
    ...(openLoopEntries.length > 0 ? { openLoopRegistry: openLoopEntries } : {}),
    diagnostics: {
      ...diagnostics,
      shortTermSummarySource: normalizeOptionalText(derivedShortTermSummary)
        ? 'derived_records'
        : shortTermSnapshotFallback.text
          ? 'snapshot_records'
          : 'empty',
      longTermMemoryProfileSource: normalizeOptionalText(derivedLongTermMemoryProfile)
        ? 'derived_records'
        : longTermSnapshotFallback.text
          ? 'snapshot_records'
          : 'empty',
      ...(shortTermSnapshotFallback.snapshotTypeUsed
        ? { shortTermSnapshotTypeUsed: shortTermSnapshotFallback.snapshotTypeUsed }
        : {}),
      ...(longTermSnapshotFallback.snapshotTypeUsed
        ? { longTermSnapshotTypeUsed: longTermSnapshotFallback.snapshotTypeUsed }
        : {}),
    },
  };
}

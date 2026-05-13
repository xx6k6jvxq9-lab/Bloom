import { loadMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import type {
  RelationshipResidueItem,
  RelationshipWaveSourceScene,
  SceneResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
  TypedContextDecay,
  TypedContextVisibility,
} from '../relationship-context/types';
import type { MemoryRecord } from './memoryRecordTypes';

type ProjectedSceneSignals = {
  relationshipResidue: RelationshipResidueItem[];
  sceneResidue: SceneResidueItem[];
  topicAnchors: TopicAnchorItem[];
  taskResidue: TaskResidueItem[];
  summaryLines: string[];
};

const RECENT_SIGNAL_MS = 45 * 24 * 60 * 60 * 1000;

function toTypedDecay(value: string | undefined): TypedContextDecay {
  return value === 'stable' || value === 'medium' ? value : 'short';
}

function normalizeSummary(summary: string): string {
  return summary.replace(/\s+/g, ' ').trim().toLowerCase();
}

function dedupeBySummary<T extends { summary: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeSummary(item.summary);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getCharacterRecords(characterId: string | undefined, records?: MemoryRecord[]): MemoryRecord[] {
  if (!characterId) {
    return [];
  }

  const source = records
    ?? loadMemoryRecordData({
      recordsByCharacterId: {},
    }).recordsByCharacterId[characterId]
    ?? [];

  return [...source].sort((left, right) => right.timestamp - left.timestamp);
}

function asVisibility(value: string): TypedContextVisibility {
  return value === 'group_public' || value === 'cross_scene_readable' ? value : 'private';
}

function asSourceScene(value: string): RelationshipWaveSourceScene | null {
  return value === 'direct_chat'
    || value === 'group_chat'
    || value === 'dating'
    || value === 'music_together'
    || value === 'couple_space'
    || value === 'forum'
    || value === 'moments'
    ? value
    : null;
}

function isTopicAnchorSummary(summary: string): boolean {
  return /(话题|旧梗|后续话头|余温)/.test(summary);
}

function isSceneResidueSummary(summary: string): boolean {
  return /(推进到的阶段|当前阶段|最近推进)/.test(summary);
}

export function buildSceneSignalsFromRecords(input: {
  characterId?: string;
  records?: MemoryRecord[];
  nowTimestamp?: number;
}): ProjectedSceneSignals {
  const nowTimestamp = input.nowTimestamp ?? Date.now();
  const recentRecords = getCharacterRecords(input.characterId, input.records)
    .filter((record) => nowTimestamp - record.timestamp <= RECENT_SIGNAL_MS)
    .filter((record) => asSourceScene(record.sourceScene) !== null);

  const relationshipResidue = dedupeBySummary(
    recentRecords
      .filter((record): record is Extract<MemoryRecord, { kind: 'relationship_wave' }> => record.kind === 'relationship_wave')
      .map((record) => ({
        type: 'relationship_residue' as const,
        summary: record.summary,
        sourceScene: asSourceScene(record.sourceScene)!,
        timestamp: record.timestamp,
        decay: toTypedDecay(record.decayHint),
        visibility: asVisibility(record.visibility),
      })),
  ).slice(0, 4);

  const taskResidue = dedupeBySummary(
    recentRecords
      .filter((record): record is Extract<MemoryRecord, { kind: 'fact' }> => record.kind === 'fact' && record.factType === 'plan')
      .map((record) => ({
        type: 'task_residue' as const,
        summary: record.summary,
        sourceScene: asSourceScene(record.sourceScene)!,
        timestamp: record.timestamp,
        decay: toTypedDecay(record.decayHint),
        visibility: asVisibility(record.visibility),
      })),
  ).slice(0, 3);

  const topicAnchors = dedupeBySummary(
    recentRecords
      .filter((record): record is Extract<MemoryRecord, { kind: 'fact' }> => (
        record.kind === 'fact'
        && record.factType === 'experience'
        && isTopicAnchorSummary(record.summary)
      ))
      .map((record) => ({
        type: 'topic_anchor' as const,
        summary: record.summary,
        sourceScene: asSourceScene(record.sourceScene)!,
        timestamp: record.timestamp,
        decay: toTypedDecay(record.decayHint),
        visibility: asVisibility(record.visibility),
      })),
  ).slice(0, 3);

  const sceneProgressResidue = dedupeBySummary(
    recentRecords
      .filter((record): record is Extract<MemoryRecord, { kind: 'scene_progress' }> => record.kind === 'scene_progress')
      .map((record) => ({
        type: 'scene_residue' as const,
        summary: record.summary,
        sourceScene: asSourceScene(record.sourceScene)!,
        timestamp: record.timestamp,
        decay: toTypedDecay(record.decayHint),
        visibility: asVisibility(record.visibility),
      })),
  ).slice(0, 2);

  const sceneResidue = dedupeBySummary(
    [
      ...sceneProgressResidue,
      ...recentRecords
        .filter((record): record is Extract<MemoryRecord, { kind: 'fact' }> => (
          record.kind === 'fact'
          && (
            (record.factType === 'experience' && isSceneResidueSummary(record.summary))
            || record.factType === 'status'
          )
        ))
        .map((record) => ({
          type: 'scene_residue' as const,
          summary: record.summary,
          sourceScene: asSourceScene(record.sourceScene)!,
          timestamp: record.timestamp,
          decay: toTypedDecay(record.decayHint),
          visibility: asVisibility(record.visibility),
        })),
    ],
  ).slice(0, 3);

  const summaryLines = [
    ...relationshipResidue.map((item) => item.summary),
    ...sceneResidue.map((item) => item.summary),
    ...topicAnchors.map((item) => item.summary),
    ...taskResidue.map((item) => item.summary),
  ];

  return {
    relationshipResidue,
    sceneResidue,
    topicAnchors,
    taskResidue,
    summaryLines,
  };
}

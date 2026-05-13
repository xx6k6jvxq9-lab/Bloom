import type { Character, CharacterOpenLoopEntry } from '../../types';
import type {
  CharacterSharedContextSnapshot,
  RelationshipResidueItem,
  SceneResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
} from '../relationship-context/types';
import type {
  MemoryRecordKind,
  MemoryRecordSourceScene,
  MemoryRecordSourceSessionType,
  SceneProgressMemoryRecordDraft,
} from './memoryRecordTypes';
import { buildSharedStateWritePatch } from '../relationship-context/buildSharedCharacterState';
import { appendSceneSettlementMemory } from './memoryRecordSnapshots';
import { recordMemoryWriteDiagnostic } from './memoryDiagnostics';
import { buildStructuredRecordsFromSceneSettlement } from './sceneSettlementRecords';

type SettlementSummaryItem = { summary: string };
type SettlementTimedSummaryItem = SettlementSummaryItem & { timestamp: number };

type SettlementSourceScene = CharacterSharedContextSnapshot['sourceScene'];

type SceneSettlementCharacter = Pick<Character, 'sharedContextSnapshots' | 'shortTermSummary' | 'openLoopRegistry'>
  & Partial<Pick<Character, 'presenceState' | 'sharedState'>>;

type SceneSettlementItems = {
  relationshipResidue?: RelationshipResidueItem[];
  sceneResidue?: SceneResidueItem[];
  topicAnchors?: TopicAnchorItem[];
  taskResidue?: TaskResidueItem[];
};

type SceneSettlementOpenLoopConfig = {
  idPrefix: string;
  taskResumeHint: string;
  topicResumeHint: string;
  limit?: number;
};

type SceneSettlementSharedStateConfig = {
  publicSummaries?: string[];
  privateSummaries?: string[];
};

export type SceneSettlementResult = {
  sharedContextSnapshots: CharacterSharedContextSnapshot[];
  shortTermSummary?: string;
  openLoopRegistry?: CharacterOpenLoopEntry[];
  sharedState?: Character['sharedState'];
  sceneProgressRecords?: SceneProgressMemoryRecordDraft[];
};

export type SceneSettlementCharacterPatch = Pick<
  Character,
  'sharedContextSnapshots' | 'shortTermSummary' | 'openLoopRegistry' | 'sharedState'
>;

export function buildSceneSettlementCharacterPatch(
  settlement: SceneSettlementResult,
): SceneSettlementCharacterPatch {
  return {
    sharedContextSnapshots: settlement.sharedContextSnapshots,
    shortTermSummary: settlement.shortTermSummary,
    openLoopRegistry: settlement.openLoopRegistry,
    sharedState: settlement.sharedState,
  };
}

export type PersistSceneSettlementInput = {
  characterId: string;
  sourceScene: MemoryRecordSourceScene;
  settlement: SceneSettlementResult;
  sourceSessionType?: MemoryRecordSourceSessionType;
  sourceSessionId?: string;
  timestamp?: number;
};

export type PersistSceneSettlementResult = {
  characterPatch: SceneSettlementCharacterPatch;
  timestamp: number;
};

function incrementRecordCount(
  counts: Partial<Record<MemoryRecordKind | 'snapshot_short_term_summary' | 'snapshot_shared_state', number>>,
  key: MemoryRecordKind | 'snapshot_short_term_summary' | 'snapshot_shared_state',
): void {
  counts[key] = (counts[key] || 0) + 1;
}

function buildPlannedSettlementRecordCounts(input: PersistSceneSettlementInput & { timestamp: number }) {
  const counts: Partial<Record<MemoryRecordKind | 'snapshot_short_term_summary' | 'snapshot_shared_state', number>> = {};

  if (input.settlement.shortTermSummary?.trim()) {
    incrementRecordCount(counts, 'snapshot_short_term_summary');
  }
  if (input.settlement.sharedState) {
    incrementRecordCount(counts, 'snapshot_shared_state');
  }

  buildStructuredRecordsFromSceneSettlement({
    characterId: input.characterId,
    sourceScene: input.sourceScene,
    settlement: input.settlement,
    sourceSessionType: input.sourceSessionType,
    sourceSessionId: input.sourceSessionId,
    timestamp: input.timestamp,
  }).forEach((record) => incrementRecordCount(counts, record.kind));

  return counts;
}

export async function persistSceneSettlement(
  input: PersistSceneSettlementInput,
): Promise<PersistSceneSettlementResult> {
  // This is the primary structured memory write entry for runtime scene settlement.
  // Business code should prefer this shared path over ad-hoc writes so that
  // snapshot mirroring, structured records, and diagnostics stay in sync.
  const timestamp = input.timestamp
    ?? input.settlement.sharedContextSnapshots[0]?.settledAt
    ?? Date.now();
  const characterPatch = buildSceneSettlementCharacterPatch(input.settlement);
  const plannedRecordCounts = buildPlannedSettlementRecordCounts({
    ...input,
    timestamp,
  });

  try {
    await appendSceneSettlementMemory({
      characterId: input.characterId,
      sourceScene: input.sourceScene,
      settlement: input.settlement,
      sourceSessionType: input.sourceSessionType,
      sourceSessionId: input.sourceSessionId,
      timestamp,
    });
    recordMemoryWriteDiagnostic({
      characterId: input.characterId,
      sourceScene: input.sourceScene,
      timestamp,
      status: 'success',
      plannedRecordCounts,
      snapshotCount: input.settlement.sharedContextSnapshots.length,
      sharedStateIncluded: Boolean(input.settlement.sharedState),
      sceneProgressRecordCount: input.settlement.sceneProgressRecords?.length || 0,
    });

    return {
      characterPatch,
      timestamp,
    };
  } catch (error) {
    recordMemoryWriteDiagnostic({
      characterId: input.characterId,
      sourceScene: input.sourceScene,
      timestamp,
      status: 'failed',
      plannedRecordCounts,
      snapshotCount: input.settlement.sharedContextSnapshots.length,
      sharedStateIncluded: Boolean(input.settlement.sharedState),
      sceneProgressRecordCount: input.settlement.sceneProgressRecords?.length || 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function persistSceneSettlementBatch(
  inputs: PersistSceneSettlementInput[],
): Promise<PersistSceneSettlementResult[]> {
  const results: PersistSceneSettlementResult[] = [];

  for (const input of inputs) {
    results.push(await persistSceneSettlement(input));
  }

  return results;
}

export function mergeSettlementSummaryLines(...blocks: Array<string | undefined>): string | undefined {
  const lines = blocks
    .flatMap((block) => (block || '').split(/\r?\n+/))
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  return [...new Set(lines)].join('\n');
}

export function dedupeSettlementItemsBySummary<T extends SettlementSummaryItem>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.summary.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function collectSummaryText(items: SettlementSummaryItem[] | undefined): string | undefined {
  const summaries = (items || []).map((item) => item.summary).filter(Boolean);
  return summaries.length > 0 ? summaries.join('\n') : undefined;
}

function appendSettlementSnapshot(
  existing: CharacterSharedContextSnapshot[] | undefined,
  nextSnapshot: CharacterSharedContextSnapshot | null,
  limit: number,
): CharacterSharedContextSnapshot[] {
  const snapshots = Array.isArray(existing) ? existing : [];
  if (!nextSnapshot) {
    return snapshots;
  }

  return [nextSnapshot, ...snapshots]
    .sort((left, right) => right.settledAt - left.settledAt)
    .slice(0, limit);
}

function buildSettlementSnapshot(input: {
  sourceScene: SettlementSourceScene;
  timestamp: number;
  items: SceneSettlementItems;
}): CharacterSharedContextSnapshot | null {
  const relationshipResidue = input.items.relationshipResidue || [];
  const sceneResidue = input.items.sceneResidue || [];
  const topicAnchors = input.items.topicAnchors || [];
  const taskResidue = input.items.taskResidue || [];

  if (
    relationshipResidue.length === 0
    && sceneResidue.length === 0
    && topicAnchors.length === 0
    && taskResidue.length === 0
  ) {
    return null;
  }

  return {
    sourceScene: input.sourceScene,
    settledAt: input.timestamp,
    ...(relationshipResidue.length > 0 ? { relationshipResidue } : {}),
    ...(sceneResidue.length > 0 ? { sceneResidue } : {}),
    ...(topicAnchors.length > 0 ? { topicAnchors } : {}),
    ...(taskResidue.length > 0 ? { taskResidue } : {}),
  };
}

function appendSettlementOpenLoopEntries(
  existing: CharacterOpenLoopEntry[] | undefined,
  taskResidue: TaskResidueItem[] | undefined,
  topicAnchors: TopicAnchorItem[] | undefined,
  now: number,
  config: SceneSettlementOpenLoopConfig,
): CharacterOpenLoopEntry[] | undefined {
  const existingEntries = Array.isArray(existing) ? existing : [];
  const nextEntries: CharacterOpenLoopEntry[] = [
    ...((taskResidue || []).map((item, index) => ({
      id: `${config.idPrefix}-task-${now}-${index + 1}`,
      kind: 'task' as const,
      status: 'waiting_user' as const,
      content: item.summary,
      source: 'manual' as const,
      createdAt: now,
      lastTouchedAt: item.timestamp,
      updatedAt: now,
      resumeHint: config.taskResumeHint,
    }))),
    ...((topicAnchors || []).map((item, index) => ({
      id: `${config.idPrefix}-topic-${now}-${index + 1}`,
      kind: 'topic' as const,
      status: 'dormant' as const,
      content: item.summary,
      source: 'manual' as const,
      createdAt: now,
      lastTouchedAt: item.timestamp,
      updatedAt: now,
      resumeHint: config.topicResumeHint,
    }))),
    ...existingEntries,
  ];

  const deduped = nextEntries.filter((entry, index, array) => (
    array.findIndex((candidate) => (
      candidate.kind === entry.kind
      && candidate.content.trim().toLowerCase() === entry.content.trim().toLowerCase()
    )) === index
  )).slice(0, config.limit ?? 8);

  return deduped.length > 0 ? deduped : undefined;
}

export function buildSceneSettlementResult(input: {
  character: SceneSettlementCharacter;
  sourceScene: SettlementSourceScene;
  timestamp: number;
  items: SceneSettlementItems;
  snapshotLimit?: number;
  openLoop: SceneSettlementOpenLoopConfig;
  sharedState?: SceneSettlementSharedStateConfig;
  sceneProgressRecords?: SceneProgressMemoryRecordDraft[];
}): SceneSettlementResult {
  const snapshot = buildSettlementSnapshot({
    sourceScene: input.sourceScene,
    timestamp: input.timestamp,
    items: input.items,
  });

  return {
    sharedContextSnapshots: appendSettlementSnapshot(
      input.character.sharedContextSnapshots,
      snapshot,
      input.snapshotLimit ?? 8,
    ),
    shortTermSummary: mergeSettlementSummaryLines(
      input.character.shortTermSummary,
      collectSummaryText(input.items.relationshipResidue),
      collectSummaryText(input.items.sceneResidue),
      collectSummaryText(input.items.topicAnchors),
      collectSummaryText(input.items.taskResidue),
    ),
    openLoopRegistry: appendSettlementOpenLoopEntries(
      input.character.openLoopRegistry,
      input.items.taskResidue,
      input.items.topicAnchors,
      input.timestamp,
      input.openLoop,
    ),
    ...(input.sharedState
      ? {
          sharedState: buildSharedStateWritePatch({
            character: input.character,
            sourceScene: input.sourceScene,
            updatedAt: input.timestamp,
            publicSummaries: input.sharedState.publicSummaries,
            privateSummaries: input.sharedState.privateSummaries,
          }),
        }
      : {}),
    ...(input.sceneProgressRecords?.length
      ? {
          sceneProgressRecords: input.sceneProgressRecords,
        }
      : {}),
  };
}

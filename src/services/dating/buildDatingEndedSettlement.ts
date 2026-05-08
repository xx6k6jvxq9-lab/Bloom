import type { Character, CharacterOpenLoopEntry, DateSession } from '../../types';
import type {
  CharacterSharedContextSnapshot,
  RelationshipResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
} from '../relationship-context/types';
import { buildSharedStateWritePatch } from '../relationship-context/buildSharedCharacterState';
import { looksLikeTopicText } from '../chat/topicRecall';

type DatingEndedSettlementResult = {
  sharedContextSnapshots: CharacterSharedContextSnapshot[];
  shortTermSummary?: string;
  openLoopRegistry?: CharacterOpenLoopEntry[];
  sharedState?: Character['sharedState'];
};

const TASK_MARKERS = /(答应|约定|确认|回复|处理|完成|安排|计划|改天|下次|补上|兑现|去做|办完)/;

function normalizeText(text: string | null | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function dedupeBySummary<T extends { summary: string }>(items: T[]): T[] {
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

function mergeSummaryLines(...blocks: Array<string | undefined>): string | undefined {
  const lines = blocks
    .flatMap((block) => (block || '').split(/\r?\n+/))
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return undefined;
  }

  return [...new Set(lines)].join('\n');
}

function getLatestNarrativeSnippet(session: DateSession): string {
  const segments = session.generatedContent?.narrative?.segments || [];
  const text = segments.map((segment) => segment.text).join(' ');
  return normalizeText(text).slice(0, 96);
}

function getRecentSessionTexts(session: DateSession): string[] {
  return (session.messages || [])
    .slice(-10)
    .map((message) => normalizeText(message.text))
    .filter(Boolean);
}

function buildRelationshipResidue(session: DateSession): RelationshipResidueItem[] {
  const narrativeSnippet = getLatestNarrativeSnippet(session);
  const mood = normalizeText(session.generatedContent?.status?.mood || session.mood);
  const baseSummary = narrativeSnippet
    ? `刚结束的约会留下了一点关系余波：${narrativeSnippet}`
    : mood
      ? `刚结束的约会还带着一点关系余波，整体氛围偏向：${mood}`
      : '';

  if (!baseSummary) {
    return [];
  }

  const timestamp = session.endedAt || Date.now();
  return [{
    type: 'relationship_residue',
    summary: baseSummary,
    sourceScene: 'dating',
    timestamp,
    decay: 'medium',
    visibility: 'cross_scene_readable',
  }];
}

function buildTopicAnchors(session: DateSession): TopicAnchorItem[] {
  const timestamp = session.endedAt || Date.now();
  return dedupeBySummary(
    getRecentSessionTexts(session)
      .filter((text) => looksLikeTopicText(text))
      .slice(-2)
      .map((summary) => ({
        type: 'topic_anchor' as const,
        summary: `这场约会里刚碰过的话题或旧梗：${summary}`,
        sourceScene: 'dating' as const,
        timestamp,
        decay: 'short' as const,
        visibility: 'cross_scene_readable' as const,
      })),
  );
}

function buildTaskResidue(session: DateSession): TaskResidueItem[] {
  const timestamp = session.endedAt || Date.now();
  return dedupeBySummary(
    getRecentSessionTexts(session)
      .filter((text) => TASK_MARKERS.test(text))
      .slice(-2)
      .map((summary) => ({
        type: 'task_residue' as const,
        summary: `这场约会里还可能算数的约定或待办：${summary}`,
        sourceScene: 'dating' as const,
        timestamp,
        decay: 'medium' as const,
        visibility: 'cross_scene_readable' as const,
      })),
  );
}

function appendSnapshot(
  existing: CharacterSharedContextSnapshot[] | undefined,
  nextSnapshot: CharacterSharedContextSnapshot | null,
): CharacterSharedContextSnapshot[] {
  const snapshots = Array.isArray(existing) ? existing : [];
  if (!nextSnapshot) {
    return snapshots;
  }
  const nextSnapshots = [nextSnapshot, ...snapshots]
    .sort((left, right) => right.settledAt - left.settledAt)
    .slice(0, 8);
  return nextSnapshots;
}

function appendOpenLoopEntries(
  existing: CharacterOpenLoopEntry[] | undefined,
  taskResidue: TaskResidueItem[],
  topicAnchors: TopicAnchorItem[],
  now: number,
): CharacterOpenLoopEntry[] | undefined {
  const existingEntries = Array.isArray(existing) ? existing : [];
  const nextEntries: CharacterOpenLoopEntry[] = [
    ...taskResidue.map((item, index) => ({
      id: `dating-task-${now}-${index + 1}`,
      kind: 'task' as const,
      status: 'waiting_user' as const,
      content: item.summary,
      source: 'manual' as const,
      createdAt: now,
      lastTouchedAt: item.timestamp,
      updatedAt: now,
      resumeHint: '这是约会结束后仍可能算数的约定或待办，只有当前相关时再恢复。',
    })),
    ...topicAnchors.map((item, index) => ({
      id: `dating-topic-${now}-${index + 1}`,
      kind: 'topic' as const,
      status: 'dormant' as const,
      content: item.summary,
      source: 'manual' as const,
      createdAt: now,
      lastTouchedAt: item.timestamp,
      updatedAt: now,
      resumeHint: '这是约会里刚碰过的话题锚点，只有当前真的碰到时再带回。',
    })),
    ...existingEntries,
  ];

  const deduped = nextEntries.filter((entry, index, array) => (
    array.findIndex((candidate) => (
      candidate.kind === entry.kind
      && candidate.content.trim().toLowerCase() === entry.content.trim().toLowerCase()
    )) === index
  )).slice(0, 8);

  return deduped.length > 0 ? deduped : undefined;
}

export function buildDatingEndedSettlement(
  character: Pick<Character, 'sharedContextSnapshots' | 'shortTermSummary' | 'openLoopRegistry' | 'presenceState' | 'sharedState'>,
  session: DateSession,
): DatingEndedSettlementResult {
  const now = session.endedAt || Date.now();
  const relationshipResidue = buildRelationshipResidue(session);
  const topicAnchors = buildTopicAnchors(session);
  const taskResidue = buildTaskResidue(session);

  const snapshot: CharacterSharedContextSnapshot | null = (
    relationshipResidue.length > 0
    || topicAnchors.length > 0
    || taskResidue.length > 0
  )
    ? {
        sourceScene: 'dating',
        settledAt: now,
        ...(relationshipResidue.length > 0 ? { relationshipResidue } : {}),
        ...(topicAnchors.length > 0 ? { topicAnchors } : {}),
        ...(taskResidue.length > 0 ? { taskResidue } : {}),
      }
    : null;

  const compatibilitySummary = mergeSummaryLines(
    character.shortTermSummary,
    relationshipResidue.map((item) => item.summary).join('\n'),
    topicAnchors.map((item) => item.summary).join('\n'),
    taskResidue.map((item) => item.summary).join('\n'),
  );

  return {
    sharedContextSnapshots: appendSnapshot(character.sharedContextSnapshots, snapshot),
    shortTermSummary: compatibilitySummary,
    openLoopRegistry: appendOpenLoopEntries(character.openLoopRegistry, taskResidue, topicAnchors, now),
    sharedState: buildSharedStateWritePatch({
      character,
      sourceScene: 'dating',
      updatedAt: now,
      publicSummaries: relationshipResidue.map((item) => item.summary),
      privateSummaries: [
        ...relationshipResidue.map((item) => item.summary),
        ...topicAnchors.map((item) => item.summary),
        ...taskResidue.map((item) => item.summary),
      ],
    }),
  };
}

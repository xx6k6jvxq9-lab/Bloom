import type { Character, CharacterOpenLoopEntry } from '../../types';
import type {
  CharacterSharedContextSnapshot,
  RelationshipResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
} from '../relationship-context/types';
import { buildSharedStateWritePatch } from '../relationship-context/buildSharedCharacterState';
import { looksLikeTopicText } from '../chat/topicRecall';

type CoupleSpaceSettlementEventType =
  | 'post'
  | 'message_board'
  | 'love_letter'
  | 'co_note'
  | 'ledger'
  | 'comment_reply';

type CoupleSpaceSettlementEvent = {
  type: CoupleSpaceSettlementEventType;
  content: string;
  timestamp: number;
  authorRole: 'user' | 'partner';
};

type CoupleSpaceSharedSettlementResult = {
  sharedContextSnapshots: CharacterSharedContextSnapshot[];
  shortTermSummary?: string;
  openLoopRegistry?: CharacterOpenLoopEntry[];
  sharedState?: Character['sharedState'];
};

const TASK_MARKERS = /(答应|约定|确认|回复|处理|完成|安排|计划|改天|下次|补上|兑现|去做|办完|一起|记得|要去|要做)/;

function normalizeText(text: string | null | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim();
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

function buildRelationshipResidue(event: CoupleSpaceSettlementEvent): RelationshipResidueItem[] {
  const content = normalizeText(event.content);
  if (!content) {
    return [];
  }

  const prefixMap: Record<CoupleSpaceSettlementEventType, string> = {
    post: '情侣空间里刚留下了一点共同生活余波',
    message_board: '情侣空间留言里留下了一点关系余波',
    love_letter: '情侣空间里刚留下了一点更亲密的关系余波',
    co_note: '情侣空间里刚留下了一点一起规划生活的关系余波',
    ledger: '情侣空间里刚留下了一点共同生活推进的关系余波',
    comment_reply: '情侣空间互动里刚留下了一点关系余波',
  };

  return [{
    type: 'relationship_residue',
    summary: `${prefixMap[event.type]}：${content.slice(0, 96)}`,
    sourceScene: 'couple_space',
    timestamp: event.timestamp,
    decay: event.type === 'love_letter' ? 'stable' : 'medium',
    visibility: 'cross_scene_readable',
  }];
}

function buildTopicAnchors(event: CoupleSpaceSettlementEvent): TopicAnchorItem[] {
  const content = normalizeText(event.content);
  if (!content || !looksLikeTopicText(content)) {
    return [];
  }

  return [{
    type: 'topic_anchor',
    summary: `情侣空间里刚碰到的话题或旧梗：${content.slice(0, 80)}`,
    sourceScene: 'couple_space',
    timestamp: event.timestamp,
    decay: 'short',
    visibility: 'cross_scene_readable',
  }];
}

function buildTaskResidue(event: CoupleSpaceSettlementEvent): TaskResidueItem[] {
  const content = normalizeText(event.content);
  if (!content) {
    return [];
  }

  const shouldTreatAsTask = event.type === 'co_note' || event.type === 'ledger' || TASK_MARKERS.test(content);
  if (!shouldTreatAsTask) {
    return [];
  }

  return [{
    type: 'task_residue',
    summary: `情侣空间里还可能算数的约定或共同事项：${content.slice(0, 80)}`,
    sourceScene: 'couple_space',
    timestamp: event.timestamp,
    decay: event.type === 'ledger' ? 'stable' : 'medium',
    visibility: 'cross_scene_readable',
  }];
}

function appendSnapshot(
  existing: CharacterSharedContextSnapshot[] | undefined,
  nextSnapshot: CharacterSharedContextSnapshot | null,
): CharacterSharedContextSnapshot[] {
  const snapshots = Array.isArray(existing) ? existing : [];
  if (!nextSnapshot) {
    return snapshots;
  }

  return [nextSnapshot, ...snapshots]
    .sort((left, right) => right.settledAt - left.settledAt)
    .slice(0, 10);
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
      id: `couple-task-${now}-${index + 1}`,
      kind: 'task' as const,
      status: 'waiting_user' as const,
      content: item.summary,
      source: 'manual' as const,
      createdAt: now,
      lastTouchedAt: item.timestamp,
      updatedAt: now,
      resumeHint: '这是情侣空间里留下的共同事项或待办，只有当前相关时再恢复。',
    })),
    ...topicAnchors.map((item, index) => ({
      id: `couple-topic-${now}-${index + 1}`,
      kind: 'topic' as const,
      status: 'dormant' as const,
      content: item.summary,
      source: 'manual' as const,
      createdAt: now,
      lastTouchedAt: item.timestamp,
      updatedAt: now,
      resumeHint: '这是情侣空间里刚碰过的话题锚点，只有当前真的碰到时再带回。',
    })),
    ...existingEntries,
  ];

  const deduped = nextEntries.filter((entry, index, array) => (
    array.findIndex((candidate) => (
      candidate.kind === entry.kind
      && candidate.content.trim().toLowerCase() === entry.content.trim().toLowerCase()
    )) === index
  )).slice(0, 10);

  return deduped.length > 0 ? deduped : undefined;
}

export function buildCoupleSpaceSharedSettlement(
  character: Pick<Character, 'sharedContextSnapshots' | 'shortTermSummary' | 'openLoopRegistry' | 'presenceState' | 'sharedState'>,
  event: CoupleSpaceSettlementEvent,
): CoupleSpaceSharedSettlementResult {
  const relationshipResidue = dedupeBySummary(buildRelationshipResidue(event));
  const topicAnchors = dedupeBySummary(buildTopicAnchors(event));
  const taskResidue = dedupeBySummary(buildTaskResidue(event));

  const snapshot: CharacterSharedContextSnapshot | null = (
    relationshipResidue.length > 0
    || topicAnchors.length > 0
    || taskResidue.length > 0
  )
    ? {
        sourceScene: 'couple_space',
        settledAt: event.timestamp,
        ...(relationshipResidue.length > 0 ? { relationshipResidue } : {}),
        ...(topicAnchors.length > 0 ? { topicAnchors } : {}),
        ...(taskResidue.length > 0 ? { taskResidue } : {}),
      }
    : null;

  return {
    sharedContextSnapshots: appendSnapshot(character.sharedContextSnapshots, snapshot),
    shortTermSummary: mergeSummaryLines(
      character.shortTermSummary,
      relationshipResidue.map((item) => item.summary).join('\n'),
      topicAnchors.map((item) => item.summary).join('\n'),
      taskResidue.map((item) => item.summary).join('\n'),
    ),
    openLoopRegistry: appendOpenLoopEntries(character.openLoopRegistry, taskResidue, topicAnchors, event.timestamp),
    sharedState: buildSharedStateWritePatch({
      character,
      sourceScene: 'couple_space',
      updatedAt: event.timestamp,
      publicSummaries: relationshipResidue.map((item) => item.summary),
      privateSummaries: [
        ...relationshipResidue.map((item) => item.summary),
        ...topicAnchors.map((item) => item.summary),
        ...taskResidue.map((item) => item.summary),
      ],
    }),
  };
}

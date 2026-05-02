import type { Character, CharacterOpenLoopEntry } from '../../types';
import type {
  CharacterSharedContextSnapshot,
  RelationshipResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
} from '../relationship-context/types';
import { looksLikeTopicText } from '../chat/topicRecall';

type GroupChatSettlementEvent = {
  speakerName: string;
  content: string;
  timestamp: number;
};

type GroupChatSharedSettlementResult = {
  sharedContextSnapshots: CharacterSharedContextSnapshot[];
  shortTermSummary?: string;
  openLoopRegistry?: CharacterOpenLoopEntry[];
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

function buildRelationshipResidue(event: GroupChatSettlementEvent): RelationshipResidueItem[] {
  const content = normalizeText(event.content);
  if (!content) {
    return [];
  }

  return [{
    type: 'relationship_residue',
    summary: `群聊里${event.speakerName}刚留下了一点公开关系余波：${content.slice(0, 96)}`,
    sourceScene: 'group_chat',
    timestamp: event.timestamp,
    decay: 'short',
    visibility: 'cross_scene_readable',
  }];
}

function buildTopicAnchors(event: GroupChatSettlementEvent): TopicAnchorItem[] {
  const content = normalizeText(event.content);
  if (!content || !looksLikeTopicText(content)) {
    return [];
  }

  return [{
    type: 'topic_anchor',
    summary: `群聊里刚碰到的话题或旧梗：${content.slice(0, 80)}`,
    sourceScene: 'group_chat',
    timestamp: event.timestamp,
    decay: 'short',
    visibility: 'cross_scene_readable',
  }];
}

function buildTaskResidue(event: GroupChatSettlementEvent): TaskResidueItem[] {
  const content = normalizeText(event.content);
  if (!content || !TASK_MARKERS.test(content)) {
    return [];
  }

  return [{
    type: 'task_residue',
    summary: `群聊里还可能算数的约定或待办：${content.slice(0, 80)}`,
    sourceScene: 'group_chat',
    timestamp: event.timestamp,
    decay: 'medium',
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
      id: `group-task-${now}-${index + 1}`,
      kind: 'task' as const,
      status: 'waiting_user' as const,
      content: item.summary,
      source: 'manual' as const,
      createdAt: now,
      lastTouchedAt: item.timestamp,
      updatedAt: now,
      resumeHint: '这是群聊里留下的待办或约定，只有当前相关时再恢复。',
    })),
    ...topicAnchors.map((item, index) => ({
      id: `group-topic-${now}-${index + 1}`,
      kind: 'topic' as const,
      status: 'dormant' as const,
      content: item.summary,
      source: 'manual' as const,
      createdAt: now,
      lastTouchedAt: item.timestamp,
      updatedAt: now,
      resumeHint: '这是群聊里刚碰过的话题锚点，只有当前真的碰到时再带回。',
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

export function buildGroupChatSharedSettlement(
  character: Pick<Character, 'sharedContextSnapshots' | 'shortTermSummary' | 'openLoopRegistry'>,
  event: GroupChatSettlementEvent,
): GroupChatSharedSettlementResult {
  const relationshipResidue = buildRelationshipResidue(event);
  const topicAnchors = buildTopicAnchors(event);
  const taskResidue = buildTaskResidue(event);

  const snapshot: CharacterSharedContextSnapshot | null = (
    relationshipResidue.length > 0
    || topicAnchors.length > 0
    || taskResidue.length > 0
  )
    ? {
        sourceScene: 'group_chat',
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
  };
}

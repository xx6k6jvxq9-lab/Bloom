import type { Character, CharacterOpenLoopEntry } from '../../types';
import type {
  CharacterSharedContextSnapshot,
  RelationshipResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
} from '../relationship-context/types';
import { buildSharedStateWritePatch } from '../relationship-context/buildSharedCharacterState';
import { looksLikeTopicText } from '../chat/topicRecall';

type ForumSharedSettlementEvent = {
  kind?:
    | 'public_reply'
    | 'public_loop'
    | 'temp_chat_familiar'
    | 'friend_request_sent'
    | 'friend_request_accepted'
    | 'friend_bridge';
  actorName: string;
  content: string;
  timestamp: number;
  postTitle?: string;
  userComment?: string;
  userIdentity?: 'self' | 'anonymous';
  repeatedCount?: number;
};

type ForumSharedSettlementResult = {
  sharedContextSnapshots: CharacterSharedContextSnapshot[];
  shortTermSummary?: string;
  openLoopRegistry?: CharacterOpenLoopEntry[];
  sharedState?: Character['sharedState'];
};

const FORUM_FOLLOWUP_MARKERS = /(回头|之后|下次|再说|细说|补你|补上|继续聊|私聊|展开说|晚点|回去再)/u;

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

function buildRelationshipResidue(event: ForumSharedSettlementEvent): RelationshipResidueItem[] {
  const content = normalizeText(event.content);
  if (!content) {
    return [];
  }

  const kind = event.kind || 'public_reply';
  const userAnchor = event.userIdentity === 'anonymous' ? '在匿名楼里' : '在论坛里';

  let summary = `${event.actorName}${userAnchor}公开接了你一句：${content.slice(0, 88)}`;

  if (kind === 'public_loop' && (event.repeatedCount || 0) >= 2) {
    summary = `${event.actorName}${userAnchor}已经连续几次公开接住你：${content.slice(0, 80)}`;
  } else if (kind === 'temp_chat_familiar') {
    summary = `${event.actorName}在论坛临时私聊里已经和你聊得比较自然：${content.slice(0, 84)}`;
  } else if (kind === 'friend_request_sent') {
    summary = `${event.actorName}在论坛这条线里明确把关系往前放了一步。`;
  } else if (kind === 'friend_request_accepted' || kind === 'friend_bridge') {
    summary = `${event.actorName}和你的论坛互动已经从路人线继续往正式关系过渡了。`;
  }

  return [{
    type: 'relationship_residue',
    summary,
    sourceScene: 'forum',
    timestamp: event.timestamp,
    decay: kind === 'friend_request_accepted' || kind === 'friend_bridge' ? 'medium' : 'short',
    visibility: 'cross_scene_readable',
  }];
}

function buildTopicAnchors(event: ForumSharedSettlementEvent): TopicAnchorItem[] {
  const postTitle = normalizeText(event.postTitle);
  const userComment = normalizeText(event.userComment);
  const fallback = userComment || normalizeText(event.content);

  if (postTitle && looksLikeTopicText(postTitle)) {
    return [{
      type: 'topic_anchor',
      summary: `论坛里《${postTitle.slice(0, 40)}》这件事还留着一点后续话头。`,
      sourceScene: 'forum',
      timestamp: event.timestamp,
      decay: 'short',
      visibility: 'cross_scene_readable',
    }];
  }

  if (!fallback || !looksLikeTopicText(fallback)) {
    return [];
  }

  return [{
    type: 'topic_anchor',
    summary: `论坛里刚碰到的话题还留着一点余温：${fallback.slice(0, 72)}`,
    sourceScene: 'forum',
    timestamp: event.timestamp,
    decay: 'short',
    visibility: 'cross_scene_readable',
  }];
}

function buildTaskResidue(event: ForumSharedSettlementEvent): TaskResidueItem[] {
  const content = normalizeText(event.content);
  if (!content) {
    return [];
  }

  const kind = event.kind || 'public_reply';
  if (kind === 'friend_request_sent') {
    return [{
      type: 'task_residue',
      summary: `${event.actorName}在论坛线里给你留了一个可以继续接住的关系开口。`,
      sourceScene: 'forum',
      timestamp: event.timestamp,
      decay: 'medium',
      visibility: 'cross_scene_readable',
    }];
  }

  if (!FORUM_FOLLOWUP_MARKERS.test(content)) {
    return [];
  }

  return [{
    type: 'task_residue',
    summary: `论坛里这条线还留着一点后续牵引：${content.slice(0, 72)}`,
    sourceScene: 'forum',
    timestamp: event.timestamp,
    decay: kind === 'temp_chat_familiar' ? 'medium' : 'short',
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
    .slice(0, 8);
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
      id: `forum-task-${now}-${index + 1}`,
      kind: 'task' as const,
      status: 'waiting_user' as const,
      content: item.summary,
      source: 'manual' as const,
      createdAt: now,
      lastTouchedAt: item.timestamp,
      updatedAt: now,
      resumeHint: '这是论坛里留下来的后续牵引，只有当前相关时再恢复。',
    })),
    ...topicAnchors.map((item, index) => ({
      id: `forum-topic-${now}-${index + 1}`,
      kind: 'topic' as const,
      status: 'dormant' as const,
      content: item.summary,
      source: 'manual' as const,
      createdAt: now,
      lastTouchedAt: item.timestamp,
      updatedAt: now,
      resumeHint: '这是论坛里刚碰过的话题锚点，只有真的再碰到时再带回。',
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

export function buildForumSharedSettlement(
  character: Pick<Character, 'sharedContextSnapshots' | 'shortTermSummary' | 'openLoopRegistry' | 'presenceState' | 'sharedState'>,
  event: ForumSharedSettlementEvent,
): ForumSharedSettlementResult {
  const relationshipResidue = dedupeBySummary(buildRelationshipResidue(event));
  const topicAnchors = dedupeBySummary(buildTopicAnchors(event));
  const taskResidue = dedupeBySummary(buildTaskResidue(event));

  const snapshot: CharacterSharedContextSnapshot | null = (
    relationshipResidue.length > 0
    || topicAnchors.length > 0
    || taskResidue.length > 0
  )
    ? {
        sourceScene: 'forum',
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
      sourceScene: 'forum',
      updatedAt: event.timestamp,
      publicSummaries: [
        ...relationshipResidue.map((item) => item.summary),
        ...taskResidue.map((item) => item.summary),
      ],
      privateSummaries: [
        ...relationshipResidue.map((item) => item.summary),
        ...topicAnchors.map((item) => item.summary),
        ...taskResidue.map((item) => item.summary),
      ],
    }),
  };
}

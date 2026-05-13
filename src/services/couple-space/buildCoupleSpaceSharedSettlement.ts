import type { Character, CharacterOpenLoopEntry } from '../../types';
import type {
  RelationshipResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
} from '../relationship-context/types';
import {
  buildSceneSettlementResult,
  dedupeSettlementItemsBySummary,
  type SceneSettlementResult,
} from '../memory/sceneSettlement';
import {
  createRelationshipResidueItem,
  createTaskResidueItemFromText,
  createTopicAnchorItemFromText,
  normalizeSettlementText,
  summarizeSettlementText,
} from '../memory/sceneSettlementItems';

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

type CoupleSpaceSharedSettlementResult = SceneSettlementResult;

const TASK_MARKERS = /(答应|约定|确认|回复|处理|完成|安排|计划|改天|下次|补上|兑现|去做|办完|一起|记得|要去|要做)/;

function buildRelationshipResidue(event: CoupleSpaceSettlementEvent): RelationshipResidueItem[] {
  const content = normalizeSettlementText(event.content);
  if (!content) {
    return [];
  }

  const prefixMap: Record<CoupleSpaceSettlementEventType, string> = {
    post: '情侣空间里刚留下一点共同生活余波：',
    message_board: '情侣空间留言里留下一点关系余波：',
    love_letter: '情侣空间里刚留下一点更亲密的关系余波：',
    co_note: '情侣空间里刚留下一点一起规划生活的关系余波：',
    ledger: '情侣空间里刚留下一点共同生活推进的关系余波：',
    comment_reply: '情侣空间互动里刚留下一点关系余波：',
  };

  const item = createRelationshipResidueItem({
    summary: `${prefixMap[event.type]}${summarizeSettlementText(content, 96)}`,
    sourceScene: 'couple_space',
    timestamp: event.timestamp,
    decay: event.type === 'love_letter' ? 'stable' : 'medium',
  });

  return item ? [item] : [];
}

function buildTopicAnchors(event: CoupleSpaceSettlementEvent): TopicAnchorItem[] {
  const item = createTopicAnchorItemFromText({
    content: event.content,
    summaryPrefix: '情侣空间里刚碰到的话题或旧梗：',
    maxChars: 80,
    sourceScene: 'couple_space',
    timestamp: event.timestamp,
  });

  return item ? [item] : [];
}

function buildTaskResidue(event: CoupleSpaceSettlementEvent): TaskResidueItem[] {
  const content = normalizeSettlementText(event.content);
  if (!content) {
    return [];
  }

  const shouldTreatAsTask = event.type === 'co_note' || event.type === 'ledger' || TASK_MARKERS.test(content);
  if (!shouldTreatAsTask) {
    return [];
  }

  const item = createTaskResidueItemFromText({
    content,
    summaryPrefix: '情侣空间里还可能算数的约定或共同事项：',
    maxChars: 80,
    sourceScene: 'couple_space',
    timestamp: event.timestamp,
    decay: event.type === 'ledger' ? 'stable' : 'medium',
  });

  return item ? [item] : [];
}

export function buildCoupleSpaceSharedSettlement(
  character: Pick<Character, 'sharedContextSnapshots' | 'shortTermSummary' | 'openLoopRegistry' | 'presenceState' | 'sharedState'>,
  event: CoupleSpaceSettlementEvent,
): CoupleSpaceSharedSettlementResult {
  const relationshipResidue = dedupeSettlementItemsBySummary(buildRelationshipResidue(event));
  const topicAnchors = dedupeSettlementItemsBySummary(buildTopicAnchors(event));
  const taskResidue = dedupeSettlementItemsBySummary(buildTaskResidue(event));

  return buildSceneSettlementResult({
    character,
    sourceScene: 'couple_space',
    timestamp: event.timestamp,
    snapshotLimit: 10,
    items: {
      relationshipResidue,
      topicAnchors,
      taskResidue,
    },
    openLoop: {
      idPrefix: 'couple',
      taskResumeHint: '这是情侣空间里留下的共同事项或待办，只有当前相关时再恢复。',
      topicResumeHint: '这是情侣空间里刚碰过的话题锚点，只有当前真的碰到时再带回。',
      limit: 10,
    },
    sharedState: {
      publicSummaries: relationshipResidue.map((item) => item.summary),
      privateSummaries: [
        ...relationshipResidue.map((item) => item.summary),
        ...topicAnchors.map((item) => item.summary),
        ...taskResidue.map((item) => item.summary),
      ],
    },
  });
}

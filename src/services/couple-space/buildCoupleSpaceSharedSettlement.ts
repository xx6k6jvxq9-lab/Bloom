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
import type { SceneProgressMemoryRecordDraft } from '../memory/memoryRecordTypes';
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

function buildSceneProgressRecords(event: CoupleSpaceSettlementEvent): SceneProgressMemoryRecordDraft[] {
  const content = normalizeSettlementText(event.content);
  if (!content) {
    return [];
  }

  let stageLabel = '空间互动阶段';
  let currentSignature = '空间互动';
  let completedActions = ['空间里留下新互动'];
  let bannedRepeatActions: string[] = [];
  let unresolvedTension = '情侣空间里已经留下新的互动，但还没有继续落到下一步。';
  let nextStepOptions = [
    '把空间里的互动推进成新的关系变化',
    '让当前互动在后续场景里继续落地',
  ];

  if (event.type === 'love_letter') {
    stageLabel = '亲密表达阶段';
    currentSignature = '情书表达 / 亲密确认';
    completedActions = ['更亲密地表达心意'];
    bannedRepeatActions = ['重复停留在只表达不推进'];
    unresolvedTension = '情感表达已经更明确，但还没有落到新的互动动作。';
    nextStepOptions = [
      '让亲密表达之后出现新的回应',
      '把情感确认推进到更具体的关系动作',
    ];
  } else if (event.type === 'co_note') {
    stageLabel = '共同生活协作阶段';
    currentSignature = '共笔安排 / 共同事项';
    completedActions = ['共同事项被写下来'];
    unresolvedTension = '共同生活事项已经被提出来，还需要后续落实。';
    nextStepOptions = [
      '把共笔事项推进到实际回应',
      '让共同安排在后续场景里继续落实',
    ];
  } else if (event.type === 'ledger') {
    stageLabel = '共同生活落地阶段';
    currentSignature = '生活落地 / 账本协作';
    completedActions = ['共同生活事项落到实际记录'];
    unresolvedTension = '生活层面的推进已经落地，但还需要后续互动接住。';
    nextStepOptions = [
      '让生活落地继续影响后续相处',
      '不要重复停在同一种记账或登记动作',
    ];
  } else if (event.type === 'message_board' || event.type === 'comment_reply') {
    stageLabel = '空间留言互动阶段';
    currentSignature = '留言互动 / 空间回应';
    completedActions = ['空间留言被接住'];
    unresolvedTension = '留言互动已经形成余温，但还没有转到新的推进层。';
  } else if (event.type === 'post') {
    stageLabel = '共同生活分享阶段';
    currentSignature = '空间分享 / 共同生活';
    completedActions = ['共同生活内容被公开分享'];
    unresolvedTension = '共同生活感被强化了，但还没有继续推到新的关系动作。';
  }

  return [{
    summary: `情侣空间推进到${stageLabel}：${summarizeSettlementText(content, 88)}`,
    stageLabel,
    currentBeat: `${event.authorRole === 'partner' ? '对方' : '你'}在情侣空间里把这条互动又往前推了一点。`,
    currentSignature,
    completedActions,
    bannedRepeatActions,
    unresolvedTension,
    nextStepOptions,
    visibility: 'cross_scene_readable',
    stability: event.type === 'love_letter' || event.type === 'ledger' ? 'stable' : 'situational',
    decayHint: event.type === 'love_letter' || event.type === 'ledger' ? 'stable' : 'medium',
  }];
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
    sceneProgressRecords: buildSceneProgressRecords(event),
  });
}

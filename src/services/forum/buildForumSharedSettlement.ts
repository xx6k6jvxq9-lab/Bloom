import type { Character, CharacterOpenLoopEntry } from '../../types';
import type {
  RelationshipResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
} from '../relationship-context/types';
import { looksLikeTopicText } from '../chat/topicRecall';
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

type ForumSharedSettlementResult = SceneSettlementResult;

const FORUM_FOLLOWUP_MARKERS = /(回头|之后|下次|再说|细说|补你|补上|继续聊|私聊|展开说|晚点|回去再)/u;

function buildRelationshipResidue(event: ForumSharedSettlementEvent): RelationshipResidueItem[] {
  const content = normalizeSettlementText(event.content);
  if (!content) {
    return [];
  }

  const kind = event.kind || 'public_reply';
  const userAnchor = event.userIdentity === 'anonymous' ? '在匿名楼里' : '在论坛里';

  let summary = `${event.actorName}${userAnchor}公开接了你一句：${summarizeSettlementText(content, 88)}`;
  if (kind === 'public_loop' && (event.repeatedCount || 0) >= 2) {
    summary = `${event.actorName}${userAnchor}已经连续几次公开接住你：${summarizeSettlementText(content, 80)}`;
  } else if (kind === 'temp_chat_familiar') {
    summary = `${event.actorName}在论坛临时私聊里已经和你聊得比较自然：${summarizeSettlementText(content, 84)}`;
  } else if (kind === 'friend_request_sent') {
    summary = `${event.actorName}在论坛这条线里明确把关系往前放了一步。`;
  } else if (kind === 'friend_request_accepted' || kind === 'friend_bridge') {
    summary = `${event.actorName}和你的论坛互动已经从路人线继续往正式关系过渡了。`;
  }

  const item = createRelationshipResidueItem({
    summary,
    sourceScene: 'forum',
    timestamp: event.timestamp,
    decay: kind === 'friend_request_accepted' || kind === 'friend_bridge' ? 'medium' : 'short',
  });

  return item ? [item] : [];
}

function buildTopicAnchors(event: ForumSharedSettlementEvent): TopicAnchorItem[] {
  const postTitle = normalizeSettlementText(event.postTitle);
  if (postTitle && looksLikeTopicText(postTitle)) {
    return [{
      type: 'topic_anchor',
      summary: `论坛里《${summarizeSettlementText(postTitle, 40)}》这件事还留着一点后续话头。`,
      sourceScene: 'forum',
      timestamp: event.timestamp,
      decay: 'short',
      visibility: 'cross_scene_readable',
    }];
  }

  const fallback = normalizeSettlementText(event.userComment) || normalizeSettlementText(event.content);
  const item = createTopicAnchorItemFromText({
    content: fallback,
    summaryPrefix: '论坛里刚碰到的话题还留着一点余温：',
    maxChars: 72,
    sourceScene: 'forum',
    timestamp: event.timestamp,
  });

  return item ? [item] : [];
}

function buildTaskResidue(event: ForumSharedSettlementEvent): TaskResidueItem[] {
  const content = normalizeSettlementText(event.content);
  if (!content) {
    return [];
  }

  const kind = event.kind || 'public_reply';
  if (kind === 'friend_request_sent') {
    const item = createTaskResidueItemFromText({
      content: `${event.actorName}在论坛线里给你留了一个可以继续接住的关系开口。`,
      summaryPrefix: '',
      sourceScene: 'forum',
      timestamp: event.timestamp,
      maxChars: 120,
    });
    return item ? [item] : [];
  }

  if (!FORUM_FOLLOWUP_MARKERS.test(content)) {
    return [];
  }

  const item = createTaskResidueItemFromText({
    content,
    summaryPrefix: '论坛里这条线还留着一点后续牵引：',
    maxChars: 72,
    sourceScene: 'forum',
    timestamp: event.timestamp,
    decay: kind === 'temp_chat_familiar' ? 'medium' : 'short',
  });

  return item ? [item] : [];
}

function buildSceneProgressRecords(event: ForumSharedSettlementEvent): SceneProgressMemoryRecordDraft[] {
  const content = normalizeSettlementText(event.content);
  const kind = event.kind || 'public_reply';
  const repeatedPublicLoop = kind === 'public_loop' && (event.repeatedCount || 0) >= 2;
  const topicSeed = normalizeSettlementText(event.postTitle) || normalizeSettlementText(event.userComment) || content;

  let stageLabel = '公开接话阶段';
  let currentSignature = '公开接话';
  let completedActions = ['公开接话'];
  let bannedRepeatActions: string[] = [];
  let unresolvedTension = '论坛里的互动已经接上了，但还没有自然转到新的推进层。';
  let nextStepOptions = [
    '让公开接话继续推进到新的态度变化',
    '把当前互动转成更明确的后续回应',
  ];

  if (repeatedPublicLoop) {
    stageLabel = '公开连续互动阶段';
    currentSignature = '公开连续接话';
    completedActions = ['公开接话', '连续回钩'];
    bannedRepeatActions = ['重复停在同一种公开接话'];
    unresolvedTension = '公开互动已经形成连续性，但还没有切到新的推进方向。';
    nextStepOptions = [
      '把连续公开接话推进成新的关系判断',
      '转到不同于上一轮的后续回应方式',
    ];
  } else if (kind === 'temp_chat_familiar') {
    stageLabel = '临时私聊熟络阶段';
    currentSignature = '临时私聊 / 熟络';
    completedActions = ['临时私聊接上', '关系变熟'];
    unresolvedTension = '已经脱离纯路人互动，但还没有正式落到更稳定的联系。';
    nextStepOptions = [
      '让熟络感继续推进成新的联系节点',
      '把当前轻熟状态落成更明确的后续动作',
    ];
  } else if (kind === 'friend_request_sent') {
    stageLabel = '关系转场阶段';
    currentSignature = '好友申请 / 关系前推';
    completedActions = ['明确发出好友申请', '关系前推一步'];
    bannedRepeatActions = ['重复停留在只发出好友申请'];
    unresolvedTension = '关系已经往正式联系方向推了一步，还在等你接住。';
    nextStepOptions = [
      '把关系转场推进到正式联系',
      '给这条互动一个不同于上一轮的新接点',
    ];
  } else if (kind === 'friend_request_accepted' || kind === 'friend_bridge') {
    stageLabel = '正式联系建立阶段';
    currentSignature = '转正式联系 / 关系落地';
    completedActions = ['从论坛转到正式联系'];
    unresolvedTension = '已经建立正式联系，但后续还需要在新场景里继续推进。';
    nextStepOptions = [
      '把论坛互动自然转进正式单聊',
      '不要继续停留在“刚建立联系”这一步',
    ];
  }

  const summarySeed = content || topicSeed || `${event.actorName}在论坛里又接住了这条互动。`;
  return [{
    summary: `论坛互动推进到${stageLabel}：${summarizeSettlementText(summarySeed, 88)}`,
    stageLabel,
    currentBeat: `${event.actorName}在论坛里把这条互动又往前接了一步。`,
    currentSignature,
    ...(repeatedPublicLoop ? { previousSignature: '公开接话' } : {}),
    repeatedSignature: repeatedPublicLoop,
    completedActions,
    bannedRepeatActions,
    unresolvedTension,
    nextStepOptions,
    visibility: 'cross_scene_readable',
    stability: kind === 'friend_request_accepted' || kind === 'friend_bridge' ? 'stable' : 'situational',
    decayHint: kind === 'friend_request_accepted' || kind === 'friend_bridge' ? 'stable' : 'medium',
  }];
}

export function buildForumSharedSettlement(
  character: Pick<Character, 'sharedContextSnapshots' | 'shortTermSummary' | 'openLoopRegistry' | 'presenceState' | 'sharedState'>,
  event: ForumSharedSettlementEvent,
): ForumSharedSettlementResult {
  const relationshipResidue = dedupeSettlementItemsBySummary(buildRelationshipResidue(event));
  const topicAnchors = dedupeSettlementItemsBySummary(buildTopicAnchors(event));
  const taskResidue = dedupeSettlementItemsBySummary(buildTaskResidue(event));

  return buildSceneSettlementResult({
    character,
    sourceScene: 'forum',
    timestamp: event.timestamp,
    snapshotLimit: 8,
    items: {
      relationshipResidue,
      topicAnchors,
      taskResidue,
    },
    openLoop: {
      idPrefix: 'forum',
      taskResumeHint: '这是论坛里留下来的后续牵引，只有当前相关时再恢复。',
      topicResumeHint: '这是论坛里刚碰过的话题锚点，只有真的再次碰到时再带回。',
      limit: 8,
    },
    sharedState: {
      publicSummaries: [
        ...relationshipResidue.map((item) => item.summary),
        ...taskResidue.map((item) => item.summary),
      ],
      privateSummaries: [
        ...relationshipResidue.map((item) => item.summary),
        ...topicAnchors.map((item) => item.summary),
        ...taskResidue.map((item) => item.summary),
      ],
    },
    sceneProgressRecords: buildSceneProgressRecords(event),
  });
}

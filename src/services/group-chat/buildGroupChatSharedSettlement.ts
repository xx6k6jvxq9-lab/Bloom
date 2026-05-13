import type { Character, CharacterOpenLoopEntry } from '../../types';
import type {
  RelationshipResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
} from '../relationship-context/types';
import {
  buildSceneSettlementResult,
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

type GroupChatSettlementEvent = {
  speakerName: string;
  content: string;
  timestamp: number;
};

type GroupChatSharedSettlementResult = SceneSettlementResult;

const TASK_MARKERS = /(答应|约定|确认|回复|处理|完成|安排|计划|改天|下次|补上|兑现|去做|办完|一起|记得|要去|要做)/;

function buildRelationshipResidue(event: GroupChatSettlementEvent): RelationshipResidueItem[] {
  const content = normalizeSettlementText(event.content);
  if (!content) {
    return [];
  }

  const item = createRelationshipResidueItem({
    summary: `群聊里${event.speakerName}刚留下一点公开关系余波：${summarizeSettlementText(content, 96)}`,
    sourceScene: 'group_chat',
    timestamp: event.timestamp,
    decay: 'short',
  });

  return item ? [item] : [];
}

function buildTopicAnchors(event: GroupChatSettlementEvent): TopicAnchorItem[] {
  const item = createTopicAnchorItemFromText({
    content: event.content,
    summaryPrefix: '群聊里刚碰到的话题或旧梗：',
    maxChars: 80,
    sourceScene: 'group_chat',
    timestamp: event.timestamp,
  });

  return item ? [item] : [];
}

function buildTaskResidue(event: GroupChatSettlementEvent): TaskResidueItem[] {
  const content = normalizeSettlementText(event.content);
  if (!content || !TASK_MARKERS.test(content)) {
    return [];
  }

  const item = createTaskResidueItemFromText({
    content,
    summaryPrefix: '群聊里还可能算数的约定或待办：',
    maxChars: 80,
    sourceScene: 'group_chat',
    timestamp: event.timestamp,
    decay: 'medium',
  });

  return item ? [item] : [];
}

function buildSceneProgressRecords(event: GroupChatSettlementEvent): SceneProgressMemoryRecordDraft[] {
  const content = normalizeSettlementText(event.content);
  if (!content) {
    return [];
  }

  let stageLabel = '群内接话阶段';
  let currentSignature = '群内接话 / 公开互动';
  let completedActions = ['群里有人把话接上了'];
  let bannedRepeatActions: string[] = [];
  let unresolvedTension = '群里的互动已经接上，但还没有转到新的推进层。';
  let nextStepOptions = [
    '让群内接话继续推进成新的话题变化',
    '把当前公开互动推成更具体的后续动作',
  ];

  if (TASK_MARKERS.test(content)) {
    stageLabel = '群内协作推进阶段';
    currentSignature = '群内协作 / 待办确认';
    completedActions = ['群里抛出了可继续的安排'];
    unresolvedTension = '群里已经出现待办或安排，还需要后续有人接住。';
    nextStepOptions = [
      '让群内协作继续落实',
      '把待办推进到新的响应或分工',
    ];
  } else if (/(支持|帮你|替你|护着|站你|照顾)/.test(content)) {
    stageLabel = '群内关系升温阶段';
    currentSignature = '公开支持 / 关系升温';
    completedActions = ['公开支持被说出来'];
    unresolvedTension = '公开互动已经升温，但还没有形成新的关系动作。';
    nextStepOptions = [
      '让公开支持继续影响后续互动',
      '不要重复停留在同一种公开表态',
    ];
  } else if (/(调侃|逗|开玩笑|嘴硬)/.test(content)) {
    stageLabel = '群内熟络互动阶段';
    currentSignature = '群内打趣 / 熟络';
    completedActions = ['群里熟络感被拉高了一点'];
    unresolvedTension = '熟络互动已经形成，但还没有转到新的推进方向。';
    nextStepOptions = [
      '把打趣推进成新的群内关系变化',
      '让群内熟络感落到新的具体反应上',
    ];
  }

  return [{
    summary: `群聊推进到${stageLabel}：${summarizeSettlementText(content, 88)}`,
    stageLabel,
    currentBeat: `${event.speakerName}在群里把这段互动又往前推了一点。`,
    currentSignature,
    completedActions,
    bannedRepeatActions,
    unresolvedTension,
    nextStepOptions,
    visibility: 'group_public',
    stability: 'situational',
    decayHint: 'medium',
  }];
}

export function buildGroupChatSharedSettlement(
  character: Pick<Character, 'sharedContextSnapshots' | 'shortTermSummary' | 'openLoopRegistry'>,
  event: GroupChatSettlementEvent,
): GroupChatSharedSettlementResult {
  const relationshipResidue = buildRelationshipResidue(event);
  const topicAnchors = buildTopicAnchors(event);
  const taskResidue = buildTaskResidue(event);

  return buildSceneSettlementResult({
    character,
    sourceScene: 'group_chat',
    timestamp: event.timestamp,
    snapshotLimit: 10,
    items: {
      relationshipResidue,
      topicAnchors,
      taskResidue,
    },
    openLoop: {
      idPrefix: 'group',
      taskResumeHint: '这是群聊里留下的待办或约定，只有当前相关时再恢复。',
      topicResumeHint: '这是群聊里刚碰过的话题锚点，只有当前真的碰到时再带回。',
      limit: 10,
    },
    sceneProgressRecords: buildSceneProgressRecords(event),
  });
}

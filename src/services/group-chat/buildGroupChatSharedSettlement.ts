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
  });
}

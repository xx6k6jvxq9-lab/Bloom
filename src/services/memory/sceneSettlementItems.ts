import { looksLikeTopicText } from '../chat/topicRecall';
import type {
  RelationshipResidueItem,
  RelationshipWaveSourceScene,
  TaskResidueItem,
  TopicAnchorItem,
  TypedContextDecay,
  TypedContextVisibility,
} from '../relationship-context/types';

type SettlementItemSourceScene = RelationshipWaveSourceScene;

type SettlementItemParams = {
  sourceScene: SettlementItemSourceScene;
  timestamp: number;
  summary: string;
  decay?: TypedContextDecay;
  visibility?: TypedContextVisibility;
};

type SettlementTextItemParams = {
  sourceScene: SettlementItemSourceScene;
  timestamp: number;
  content: string | null | undefined;
  summaryPrefix: string;
  maxChars?: number;
  decay?: TypedContextDecay;
  visibility?: TypedContextVisibility;
};

export function normalizeSettlementText(text: string | null | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

export function summarizeSettlementText(text: string | null | undefined, maxChars: number): string {
  return normalizeSettlementText(text).slice(0, maxChars);
}

export function createRelationshipResidueItem(
  params: SettlementItemParams,
): RelationshipResidueItem | null {
  const summary = normalizeSettlementText(params.summary);
  if (!summary) {
    return null;
  }

  return {
    type: 'relationship_residue',
    summary,
    sourceScene: params.sourceScene,
    timestamp: params.timestamp,
    decay: params.decay ?? 'medium',
    visibility: params.visibility ?? 'cross_scene_readable',
  };
}

export function createTopicAnchorItemFromText(
  params: SettlementTextItemParams,
): TopicAnchorItem | null {
  const content = summarizeSettlementText(params.content, params.maxChars ?? 80);
  if (!content || !looksLikeTopicText(content)) {
    return null;
  }

  return {
    type: 'topic_anchor',
    summary: `${params.summaryPrefix}${content}`,
    sourceScene: params.sourceScene,
    timestamp: params.timestamp,
    decay: params.decay ?? 'short',
    visibility: params.visibility ?? 'cross_scene_readable',
  };
}

export function createTaskResidueItemFromText(
  params: SettlementTextItemParams,
): TaskResidueItem | null {
  const content = summarizeSettlementText(params.content, params.maxChars ?? 80);
  if (!content) {
    return null;
  }

  return {
    type: 'task_residue',
    summary: `${params.summaryPrefix}${content}`,
    sourceScene: params.sourceScene,
    timestamp: params.timestamp,
    decay: params.decay ?? 'medium',
    visibility: params.visibility ?? 'cross_scene_readable',
  };
}

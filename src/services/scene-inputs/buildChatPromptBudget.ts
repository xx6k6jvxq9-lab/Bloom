import type {
  RelationshipResidueItem,
  SceneResidueItem,
  TaskResidueItem,
  TopicAnchorItem,
} from '../relationship-context/types';

type ChatPromptBudgetInput = {
  recentContext?: {
    shortTermSummary?: string;
    relationshipResidue?: RelationshipResidueItem[];
    sceneResidue?: SceneResidueItem[];
    topicAnchors?: TopicAnchorItem[];
    taskResidue?: TaskResidueItem[];
    recentCoupleSpaceSummary?: string;
    sharedRecentRelationshipSummary?: string;
    publicAcquaintanceSummary?: string;
  };
  sections?: string[];
};

export type ChatPromptBudgetPolicy = {
  maxRecentContextItems: number;
  maxExtraSections: number;
};

export const DEFAULT_CHAT_PROMPT_BUDGET_POLICY: ChatPromptBudgetPolicy = {
  maxRecentContextItems: 3,
  maxExtraSections: 6,
};

export function applyChatPromptBudget(
  input: ChatPromptBudgetInput,
  policy: ChatPromptBudgetPolicy = DEFAULT_CHAT_PROMPT_BUDGET_POLICY,
): ChatPromptBudgetInput {
  const baseRecentContext = input.recentContext ?? {};
  const preservedRecentContext = {
    relationshipResidue: baseRecentContext.relationshipResidue,
    sceneResidue: baseRecentContext.sceneResidue,
    topicAnchors: baseRecentContext.topicAnchors,
    taskResidue: baseRecentContext.taskResidue,
  };
  const recentItems = [
    baseRecentContext.shortTermSummary?.trim()
      ? ['shortTermSummary', baseRecentContext.shortTermSummary.trim()] as const
      : null,
    baseRecentContext.sharedRecentRelationshipSummary?.trim()
      ? ['sharedRecentRelationshipSummary', baseRecentContext.sharedRecentRelationshipSummary.trim()] as const
      : null,
    baseRecentContext.recentCoupleSpaceSummary?.trim()
      ? ['recentCoupleSpaceSummary', baseRecentContext.recentCoupleSpaceSummary.trim()] as const
      : null,
    baseRecentContext.publicAcquaintanceSummary?.trim()
      ? ['publicAcquaintanceSummary', baseRecentContext.publicAcquaintanceSummary.trim()] as const
      : null,
  ].filter(
    (
      item,
    ): item is
      | readonly ['shortTermSummary', string]
      | readonly ['sharedRecentRelationshipSummary', string]
      | readonly ['recentCoupleSpaceSummary', string]
      | readonly ['publicAcquaintanceSummary', string] => item !== null,
  );

  const limitedRecentEntries = recentItems.slice(0, Math.max(0, policy.maxRecentContextItems));

  return {
    recentContext: {
      ...preservedRecentContext,
      ...Object.fromEntries(limitedRecentEntries),
    },
    sections: (input.sections ?? []).filter(Boolean).slice(0, Math.max(0, policy.maxExtraSections)),
  };
}

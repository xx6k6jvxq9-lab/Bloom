type ChatPromptBudgetInput = {
  recentContext?: {
    shortTermSummary?: string;
    recentCoupleSpaceSummary?: string;
  };
  sections?: string[];
};

export type ChatPromptBudgetPolicy = {
  maxRecentContextItems: number;
  maxExtraSections: number;
};

export const DEFAULT_CHAT_PROMPT_BUDGET_POLICY: ChatPromptBudgetPolicy = {
  maxRecentContextItems: 1,
  maxExtraSections: 1,
};

export function applyChatPromptBudget(
  input: ChatPromptBudgetInput,
  policy: ChatPromptBudgetPolicy = DEFAULT_CHAT_PROMPT_BUDGET_POLICY,
): ChatPromptBudgetInput {
  const recentItems = [
    input.recentContext?.shortTermSummary?.trim()
      ? ['shortTermSummary', input.recentContext.shortTermSummary.trim()] as const
      : null,
    input.recentContext?.recentCoupleSpaceSummary?.trim()
      ? ['recentCoupleSpaceSummary', input.recentContext.recentCoupleSpaceSummary.trim()] as const
      : null,
  ].filter(Boolean);

  const limitedRecentEntries = recentItems.slice(0, Math.max(0, policy.maxRecentContextItems));

  return {
    recentContext: Object.fromEntries(limitedRecentEntries),
    sections: (input.sections ?? []).filter(Boolean).slice(0, Math.max(0, policy.maxExtraSections)),
  };
}

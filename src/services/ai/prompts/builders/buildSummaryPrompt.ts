import { EXISTENCE_PROMPT } from '../base/existence';
import { OUTPUT_RULES_PROMPT } from '../base/outputRules';
import { CHARACTER_CORE_PROMPT } from '../character/characterCore';
import { MEMORY_CONTEXT_PROMPT } from '../character/memoryContext';
import { SUMMARY_SMALL_SCENARIO_PROMPT } from '../scenarios/summarySmall';
import { SUMMARY_LARGE_SCENARIO_PROMPT } from '../scenarios/summaryLarge';

export type BuildSummaryPromptOptions = {
  mode?: 'small' | 'large';
  sections?: string[];
};

/**
 * Draft prompt composer for summary scenarios.
 * Keep this builder independent from current App.tsx logic for now.
 */
export function buildSummaryPrompt(options: BuildSummaryPromptOptions = {}): string {
  const scenario = options.mode === 'large'
    ? SUMMARY_LARGE_SCENARIO_PROMPT
    : SUMMARY_SMALL_SCENARIO_PROMPT;

  const sections = [
    EXISTENCE_PROMPT,
    CHARACTER_CORE_PROMPT,
    MEMORY_CONTEXT_PROMPT,
    scenario,
    OUTPUT_RULES_PROMPT,
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}

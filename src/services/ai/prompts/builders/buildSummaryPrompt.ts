import { EXISTENCE_PROMPT } from '../base/existence';
import { OUTPUT_RULES_PROMPT } from '../base/outputRules';
import { buildCharacterCoreSection, CharacterCoreSectionsInput } from '../character/characterCore';
import { buildMemoryContextSection, MemoryContextInput } from '../character/memoryContext';
import { SUMMARY_SMALL_SCENARIO_PROMPT } from '../scenarios/summarySmall';
import { SUMMARY_LARGE_SCENARIO_PROMPT } from '../scenarios/summaryLarge';

export type BuildSummaryPromptOptions = {
  mode?: 'small' | 'large';
  characterCore?: CharacterCoreSectionsInput;
  memoryContext?: MemoryContextInput;
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
    buildCharacterCoreSection(options.characterCore ?? {}),
    buildMemoryContextSection(options.memoryContext ?? {}),
    scenario,
    OUTPUT_RULES_PROMPT,
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}

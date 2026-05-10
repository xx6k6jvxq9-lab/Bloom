import { EXISTENCE_PROMPT } from '../base/existence';
import {
  COMMON_OUTPUT_RULES,
  LONG_TERM_PROFILE_RULES,
  SHORT_TERM_SUMMARY_RULES,
} from '../base/outputRules';
import { buildCharacterCoreSection, CharacterCoreSectionsInput } from '../character/characterCore';
import {
  buildLongTermMemoryContextSection,
  buildShortTermMemoryContextSection,
  MemoryContextInput,
} from '../character/memoryContext';
import { SUMMARY_SMALL_SCENARIO_PROMPT } from '../scenarios/summarySmall';
import { SUMMARY_LARGE_SCENARIO_PROMPT } from '../scenarios/summaryLarge';

export type BuildSummaryPromptOptions = {
  mode?: 'small' | 'large';
  characterCore?: CharacterCoreSectionsInput;
  memoryContext?: MemoryContextInput;
  sections?: string[];
};

/**
 * Shared prompt composer for summary scenarios.
 * It is used by both short-term refreshes and long-term profile generation.
 */
export function buildSummaryPrompt(options: BuildSummaryPromptOptions = {}): string {
  const isLargeSummary = options.mode === 'large';
  const scenario = isLargeSummary
    ? SUMMARY_LARGE_SCENARIO_PROMPT
    : SUMMARY_SMALL_SCENARIO_PROMPT;
  const memoryContextSection = isLargeSummary
    ? buildLongTermMemoryContextSection(options.memoryContext ?? {})
    : buildShortTermMemoryContextSection(options.memoryContext ?? {});
  const outputRules = isLargeSummary
    ? LONG_TERM_PROFILE_RULES
    : SHORT_TERM_SUMMARY_RULES;

  const sections = [
    EXISTENCE_PROMPT,
    buildCharacterCoreSection(options.characterCore ?? {}),
    memoryContextSection,
    scenario,
    COMMON_OUTPUT_RULES,
    outputRules,
    ...(options.sections ?? []),
  ].filter(Boolean);

  return sections.join('\n\n');
}

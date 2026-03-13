/**
 * Memory and situation layer.
 *
 * This layer is intentionally separate from characterCore:
 * it describes current context and remembered continuity,
 * not static personality.
 */

export type MemoryContextInput = {
  memorySummary?: string;
  perceptionPrompt?: string;
};

export const MEMORY_CONTEXT_HEADER = [
  '以下内容属于当前处境与关系连续性。',
  '它用于帮助你承接现实感、时间感和长期记忆，不替代核心人格。',
].join('\n');

export function buildMemoryContextSection(input: MemoryContextInput): string {
  const sections = [
    MEMORY_CONTEXT_HEADER,
    input.memorySummary?.trim()
      ? ['[长期记忆总结]', input.memorySummary.trim()].join('\n')
      : '',
    input.perceptionPrompt?.trim()
      ? ['[当前处境 / 感知信息]', input.perceptionPrompt.trim()].join('\n')
      : '',
  ].filter(Boolean);

  return sections.join('\n\n');
}

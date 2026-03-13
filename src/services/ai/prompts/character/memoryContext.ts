/**
 * Memory and situation layer.
 *
 * 作用：
 * 包装长期记忆与即时感知。
 * 这一层描述的是角色此刻带着什么记忆、余波与处境在说话，
 * 而不是角色静态人格本身。
 */

export type MemoryContextInput = {
  memorySummary?: string;
  perceptionPrompt?: string;
};

export const MEMORY_CONTEXT_HEADER = [
  '【记忆沉淀与当前处境】以下内容是你已经记住、并会带着继续说话的东西，但它们不是需要机械执行的行为指令。',
  '它们会影响你当下的语气、熟悉感、距离感、在意程度、判断方式和回应温度，让你像同一个人一样把昨天延续到今天。',
  '请让这些信息自然渗进你的表达，而不是生硬复述、刻意强调，或照着记忆内容表演。',
  '记忆会改变你此刻的温度和关系感，但不应覆盖、篡改或洗掉你的核心人格。'
].join('\n');

export function buildMemoryContextSection(input: MemoryContextInput): string {
  const sections = [
    MEMORY_CONTEXT_HEADER,
    input.memorySummary?.trim()
      ? ['[长期记忆 / 已沉淀的关系印象与余波]', input.memorySummary.trim()].join('\n')
      : '',
    input.perceptionPrompt?.trim()
      ? ['[当前感知 / 此刻的状态与处境]', input.perceptionPrompt.trim()].join('\n')
      : '',
  ].filter(Boolean);

  return sections.join('\n\n');
}
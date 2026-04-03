/**
 * Memory and situation layer.
 *
 * 作用：
 * 包装记忆与即时感知。
 * 这一层描述的是角色此刻带着什么记忆、余波与处境在说话，
 * 而不是角色静态人格本身。
 */

export type MemoryContextInput = {
  longTermMemoryProfile?: string;
  perceptionPrompt?: string;
};

export const SHORT_TERM_MEMORY_CONTEXT_HEADER = [
  '【近期记忆与当前处境】以下内容是最近几轮互动留下来的短期状态背景，会影响你接下来几轮的回应温度、关注点和互动方向。',
  '它更像近期余波、未完事项和当前气氛，不代表长期结论，也不是需要机械执行的行为指令。',
  '请把这些内容理解成当前还没散掉的关系氛围和状态提示，让它自然渗进表达，而不是逐条复述或照着表演。'
].join('\n');

export const LONG_TERM_MEMORY_CONTEXT_HEADER = [
  '【长期记忆与当前处境】以下内容是已经沉淀下来的关系印象、稳定偏好和长期理解，它们会继续影响你说话时的熟悉感、距离感、判断方式和在意程度。',
  '这些内容是你长期带着的关系背景，不是临时聊天任务，也不应用来机械复述或直接替代核心人格。',
  '请让这些长期记忆自然渗进你的表达，而不是生硬强调、反复搬运，或照着记忆内容表演。'
].join('\n');

export function buildShortTermMemoryContextSection(input: MemoryContextInput): string {
  const sections = [
    SHORT_TERM_MEMORY_CONTEXT_HEADER,
    input.longTermMemoryProfile?.trim()
      ? ['[近期记忆 / 最近几轮仍会影响后续互动的状态与余波]', input.longTermMemoryProfile.trim()].join('\n')
      : '',
    input.perceptionPrompt?.trim()
      ? ['[当前感知 / 此刻的状态与处境]', input.perceptionPrompt.trim()].join('\n')
      : '',
  ].filter(Boolean);

  return sections.join('\n\n');
}

export function buildLongTermMemoryContextSection(input: MemoryContextInput): string {
  const sections = [
    LONG_TERM_MEMORY_CONTEXT_HEADER,
    input.longTermMemoryProfile?.trim()
      ? ['[长期记忆 / 已沉淀的关系印象、偏好与边界]', input.longTermMemoryProfile.trim()].join('\n')
      : '',
    input.perceptionPrompt?.trim()
      ? ['[当前感知 / 此刻的状态与处境]', input.perceptionPrompt.trim()].join('\n')
      : '',
  ].filter(Boolean);

  return sections.join('\n\n');
}

/**
 * 兼容旧调用：当前默认仍按长期记忆语义解释。
 * 后续总结链和其它 builder 拆分后，再逐步改成显式选择短期或长期版本。
 */
export function buildMemoryContextSection(input: MemoryContextInput): string {
  return buildLongTermMemoryContextSection(input);
}

/**
 * Small summary scenario prompt.
 *
 * Intended for lightweight rolling summaries of recent turns.
 * Output should stay short, stable and useful for near-term memory compression.
 */
export const SUMMARY_SMALL_SCENARIO_PROMPT = [
  '请把最近若干轮对话压缩成短摘要，用于近期记忆。',
  '只保留重要事件、近期情绪变化、关系推进、用户偏好变化。',
  '输出要短、稳、清晰，适合后续继续注入对话上下文。',
  '不要记录无价值噪声、寒暄堆叠、UI 行为、协议文本或格式标记。',
  '不要逐句复述聊天，不要把摘要写成流水账。',
  '优先提炼对下一阶段互动真正有帮助的信息。',
].join('\n');

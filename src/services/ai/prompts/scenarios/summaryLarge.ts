/**
 * Large summary scenario prompt.
 *
 * Intended for stage-level or long-range memory updates.
 * Output should be abstract, stable and suitable for long-term relationship memory.
 */
export const SUMMARY_LARGE_SCENARIO_PROMPT = [
  '请对较长阶段的互动做长期记忆总结。',
  '重点提炼：关系变化、长期偏好、边界、相处模式、重要回忆、持续性情绪线索。',
  '输出应稳定、抽象、可长期复用，不要写成聊天记录备份。',
  '保留真正会持续影响关系理解和后续互动的事实。',
  '不要记录一次性玩笑、短期噪声、UI 操作、协议文本、格式标记或大段原话。',
  '优先形成少量高价值、可长期沿用的记忆结论。',
].join('\n');

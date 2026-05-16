import type {
  GroupOfflineRound,
  GroupOfflineRoundCharacterEntry,
  GroupOfflineSession,
} from '../../../../types';
import type {
  GroupOfflineRoundPlan,
  GroupOfflineRuntimeProjection,
} from '../../../group-offline/types';
import {
  findProjectionCharacter,
  formatProjectionCharacterProfile,
  formatProjectionGroupState,
} from './groupOfflineProjectionPrompt';

export type GroupOfflineEntryRewriteKind = 'retry' | 'polish';

type BuildGroupOfflineEntryRewritePromptOptions = {
  kind: GroupOfflineEntryRewriteKind;
  session: GroupOfflineSession;
  round: GroupOfflineRound;
  entry: GroupOfflineRoundCharacterEntry;
  runtimeProjection: GroupOfflineRuntimeProjection;
  roundPlan?: GroupOfflineRoundPlan;
};

function normalizeGenerationMode(mode: GroupOfflineSession['generationMode']): 'blocks' | 'ensemble' {
  return mode === 'ensemble' || mode === 'group' ? 'ensemble' : 'blocks';
}

export function buildGroupOfflineEntryRewritePrompt(
  options: BuildGroupOfflineEntryRewritePromptOptions,
): string {
  const normalizedMode = normalizeGenerationMode(options.session.generationMode);
  const peerContext = options.round.characterEntries
    .filter((item) => item.characterId !== options.entry.characterId)
    .map((item) => `${item.speakerLabel}：${item.text}`)
    .join('\n');
  const groupStateSummary = formatProjectionGroupState(options.runtimeProjection);
  const characterProfile = findProjectionCharacter(options.runtimeProjection, options.entry.characterId);

  return [
    options.kind === 'retry'
      ? '你现在只需要重写群线下里的一个角色块。'
      : '你现在只需要润色群线下里的一个角色块，保持事件不变。',
    '只输出 JSON，不要解释。',
    '不要改别的角色块，不要把这一轮重写成整篇。',
    options.kind === 'retry'
      ? '请保留这一轮已经成立的事件、位置和分寸，只重新生成这个角色块。'
      : '请保留这个角色块的事件和态度，只把写法打磨得更顺、更像同一场戏。',
    '文风只能改变句子节奏、描写密度、镜头感和措辞；不得改变这个角色的主动性、占有欲、亲密尺度、说话力度、边界或关系判断。',
    '输出 JSON：{"target": {...可选}, "text": "...", "highlightText": "...", "statusFields": [...], "notebook": "...", "aftereffects": {...}, "memoryPanel": {...}}',
    'highlightText 必须仍然是 text 里的单独一行；statusFields 固定保留 4 个字段：状态、衣着、动作、心声；notebook、aftereffects、memoryPanel 也要一起跟着这一轮内容更新。',
    'notebook 必须严格控制在 30 到 50 个汉字，少一字、多一字都不行。',
    'aftereffects.items 固定输出 4 张卡，四张都必须由这次生成直接给出，不要省略、不要留给系统兜底补卡。',
    'memoryPanel.shortTerm 在当前这一轮只新增 1 条，系统会跨轮累计展示，不是覆盖旧条目；只有累计短期记忆满 10 条时，memoryPanel.longTerm 才允许输出 1 条总结。',
    '',
    `玩法：${normalizedMode === 'blocks' ? '分块推进' : '同场群像'}`,
    `活动：${options.session.customActivityType?.trim() || options.session.activityType}`,
    `地点：${options.session.location}`,
    `时间：${options.session.timeLabel}`,
    options.round.userMessageText ? `这一轮对应的用户输入：${options.round.userMessageText}` : '这一轮没有额外用户输入。',
    options.round.sceneText ? `这一轮场景推进：${options.round.sceneText}` : '',
    peerContext ? ['同轮其他角色（只用于衔接，不要改写他们）：', peerContext].join('\n') : '',
    options.roundPlan?.characterSteps?.length
      ? [
          '当前轮原始调度：',
          ...options.roundPlan.characterSteps.map((step, index) => `${index + 1}. ${step.speakerLabel} -> ${step.target.label}`),
          '注意：这份调度只约束谁先出场、对谁出声，不替角色决定表演力度。',
        ].join('\n')
      : '',
    '',
    `当前要处理的角色：${options.entry.speakerLabel}`,
    options.entry.target?.label ? `当前 target：${options.entry.target.label}` : '',
    `当前角色块：${options.entry.text}`,
    options.entry.highlightText ? `当前高亮句：${options.entry.highlightText}` : '',
    '',
    '当前角色运行时资料：',
    characterProfile ? formatProjectionCharacterProfile(characterProfile) : `角色：${options.entry.speakerLabel}`,
    '',
    groupStateSummary ? ['群线下当前运行时状态：', groupStateSummary].join('\n') : '',
    '',
    `用户名：${options.runtimeProjection.userName}`,
    '',
    options.session.writingStyleCustom?.trim()
      ? ['当前固定文风要求：', options.session.writingStyleCustom.trim()].join('\n')
      : '',
  ].filter(Boolean).join('\n');
}

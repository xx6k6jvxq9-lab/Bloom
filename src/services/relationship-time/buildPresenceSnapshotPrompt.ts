import type { CharacterOpenLoopEntry } from '../../types';
import { buildRuntimeOpenLoopRegistry } from '../chat/buildOpenLoopRegistry';
import type { CharacterTemporalState } from './buildCharacterTemporalState';
import { isTopicRelevantToUserText } from '../chat/topicRecall';

type BuildPresenceSnapshotPromptInput = {
  state: CharacterTemporalState;
  shortTermSummary?: string;
  existingEntries?: CharacterOpenLoopEntry[];
  latestUserText?: string;
};

function deriveAvailabilityLabel(state: CharacterTemporalState): string {
  if (state.continuityMode === 'continuous_scene') {
    return '正在在线，能直接接住当前这轮聊天。';
  }

  if (state.continuityMode === 'same_day_resume') {
    return state.attentionState === 'focused'
      ? '刚回到这边，能接话，但不一定还停在上一幕现场。'
      : '这会儿是重新看见消息，适合先轻轻接住当前这句。';
  }

  if (state.attentionState === 'resting' || state.energyState === 'sleepy') {
    return '更像过了一段自己的生活后重新冒头，能回，但不适合强行续写旧现场。';
  }

  if (state.socialState === 'reserved') {
    return '更像隔了一阵后重新上线，先回到现在的状态，再决定要不要碰旧话题。';
  }

  return '像过了一段自己的生活后重新上线，先回应眼前，再按需要轻量带出旧余波。';
}

function deriveLifeBeatLabel(state: CharacterTemporalState): string {
  if (state.continuityMode === 'continuous_scene') {
    return '此刻仍在同一段聊天节奏里，不需要额外表演“这段时间做了什么”。';
  }

  if (state.continuityMode === 'same_day_resume') {
    return '默认理解为这段时间角色回到了自己的生活节奏，现在只是重新看回聊天。';
  }

  return '默认理解为角色这段时间有自己的生活流逝和状态变化，不是一直停在上一幕。';
}

function buildOpenLoopGuidance(
  shortTermSummary: string | undefined,
  continuityMode: CharacterTemporalState['continuityMode'],
  existingEntries?: CharacterOpenLoopEntry[],
  latestUserText?: string,
): string[] {
  const registry = buildRuntimeOpenLoopRegistry({
    existingEntries,
    shortTermSummary,
    latestUserText,
  });
  const primaryOpenLoop = registry[0];

  if (!primaryOpenLoop) {
    return [
      '[未完事项处理] 当前没有必须立刻续写的未完节点，优先按现在的在线状态接话。',
    ];
  }

  if (primaryOpenLoop.kind === 'scene') {
    return [
      `[未完事项主类型] 场景型开放回路（${primaryOpenLoop.status}）`,
      `[处理要求] ${primaryOpenLoop.content}`,
      continuityMode === 'continuous_scene'
        ? '[续写规则] 只有在当前仍是同一段现场连续聊天时，才允许自然接着写这个场景。'
        : '[续写规则] 这类场景型未完默认只算背景，不主动续写成“现在还在原地继续发生”。',
    ];
  }

  if (primaryOpenLoop.kind === 'relationship') {
    return [
      `[未完事项主类型] 关系型开放回路（${primaryOpenLoop.status}）`,
      `[处理要求] ${primaryOpenLoop.content}`,
      '[续写规则] 可以把它当作关系余波轻量带进语气和距离感，但不要一上来就把旧冲突或旧暧昧整段硬拉回来。',
    ];
  }

  if (primaryOpenLoop.kind === 'task') {
    return [
      `[未完事项主类型] 事务型开放回路（${primaryOpenLoop.status}）`,
      `[处理要求] ${primaryOpenLoop.content}`,
      '[续写规则] 除非用户当前明确提这个待办，否则先回应眼前，再决定要不要补一句进度或确认。',
    ];
  }

  if (primaryOpenLoop.kind === 'topic') {
    if (!isTopicRelevantToUserText(primaryOpenLoop.content, latestUserText)) {
      return [
        '[未完事项处理] 当前没有值得主动重提的旧梗或旧话题，优先回应眼前这句。',
      ];
    }

    return [
      `[未完事项主类型] 旧话题锚点（${primaryOpenLoop.status}）`,
      `[处理要求] ${primaryOpenLoop.content}`,
      '[续写规则] 只有当用户当前也碰到这个梗或高度相关时，才允许轻轻接住；不要让旧梗抢走主话题。',
    ];
  }

  return [
    `[未完事项主类型] 一般开放回路（${primaryOpenLoop.status}）`,
    `[处理要求] ${primaryOpenLoop.content}`,
    '[续写规则] 先把它当背景条件，不要机械把旧节点继续演成当前现场。',
  ];
}

export function buildPresenceSnapshotPrompt(
  input: BuildPresenceSnapshotPromptInput,
): string {
  const { state, shortTermSummary, existingEntries, latestUserText } = input;

  return [
    '## 在线存在感快照',
    `[此刻在线感] ${deriveAvailabilityLabel(state)}`,
    `[生活流逝感] ${deriveLifeBeatLabel(state)}`,
    `[当前生活切片] ${state.presenceCue.currentActivity}`,
    `[开口手感] ${state.presenceCue.attentionNote}`,
    `[背景余波处理] ${state.presenceCue.lifeResidue}`,
    ...buildOpenLoopGuidance(shortTermSummary, state.continuityMode, existingEntries, latestUserText),
  ].join('\n');
}

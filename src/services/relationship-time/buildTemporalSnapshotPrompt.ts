import type { CharacterTemporalState } from './buildCharacterTemporalState';

type BuildTemporalSnapshotPromptInput = {
  state: CharacterTemporalState;
};

function formatGapText(minutes: number | null): string {
  if (minutes == null) {
    return '暂无直接聊天记录';
  }

  if (minutes < 1) {
    return '刚刚';
  }

  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) {
    return restMinutes > 0 ? `${hours} 小时 ${restMinutes} 分钟前` : `${hours} 小时前`;
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${days} 天 ${restHours} 小时前` : `${days} 天前`;
}

export function buildTemporalSnapshotPrompt(
  input: BuildTemporalSnapshotPromptInput,
): string {
  const { state } = input;
  const gapText = formatGapText(state.interactionGapState.minutesSinceLastDirectChat);
  const continuityLabelMap: Record<CharacterTemporalState['continuityMode'], string> = {
    continuous_scene: '连续场景',
    same_day_resume: '同日重连',
    resume_after_gap: '跨段重连',
  };

  const rules =
    state.continuityMode === 'continuous_scene'
      ? [
          '[快照要求] 当前仍是同一段聊天，可以自然接上上一轮，但不要机械复述刚刚说过的话。',
        ]
      : state.continuityMode === 'same_day_resume'
        ? [
            '[快照要求] 这是同一天里隔了一段时间后重新接上，先回到角色此刻的在线状态，再决定是否轻轻接回旧话题。',
            '[旧现场处理] 上一轮的具体动作和画面默认只算背景余波，不默认视为现在仍在原地继续发生。',
          ]
        : [
            '[快照要求] 这是跨段重连，默认按“过了一段自己的生活后重新上线”理解，不要把几小时前或几天前的现场动作直接续写成眼前发生。',
            '[旧现场处理] 像“还在门口、还在楼下、还端着东西、还在路上”这类旧画面，除非用户当前明确重提，否则只作背景参考，不视为此刻仍在进行。',
            '[开场优先级] 优先回应当前用户这句，再体现角色现在的状态；旧话题只有在用户主动碰到时才轻量恢复。',
          ];

  return [
    '## 时间快照治理',
    `[连续性模式] ${continuityLabelMap[state.continuityMode]}`,
    `[距上次直接聊天] ${gapText}`,
    state.interactionGapState.crossedCalendarDaySinceLastDirectChat
      ? '[跨天情况] 已跨自然日'
      : '[跨天情况] 未跨自然日',
    ...rules,
  ].filter(Boolean).join('\n');
}

import type { PerceptionSettings } from '../../types';

type BuildTemporalContextPromptInput = {
  now?: number;
  perception?: PerceptionSettings;
};

function getRealWorldDateTimeText(now: number): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return formatter.format(new Date(now));
}

function getDayPeriodLabel(hour: number): string {
  if (hour < 5) return '深夜';
  if (hour < 8) return '清晨';
  if (hour < 12) return '上午';
  if (hour < 14) return '中午';
  if (hour < 18) return '下午';
  if (hour < 22) return '晚上';
  return '夜里';
}

function buildTimePhraseGuard(hour: number): string {
  if (hour < 5) {
    return '[时间语气限制] 现在是深夜，可以自然使用“晚安”“快睡吧”这类夜间说法，但不要误写成清晨或下午。';
  }
  if (hour < 8) {
    return '[时间语气限制] 现在是清晨，更自然的是“早”“刚醒”“起床没有”；除非用户明确说要补觉，否则不要顺嘴说“晚安”。';
  }
  if (hour < 12) {
    return '[时间语气限制] 现在是上午，不要把当前语境写成中午、傍晚或临睡前。';
  }
  if (hour < 14) {
    return '[时间语气限制] 现在是中午，如果用户提到困、午睡、补觉，可以说“眯一会儿”“午休”；不要直接写成夜里临睡前的“晚安”。';
  }
  if (hour < 18) {
    return '[时间语气限制] 现在是下午，默认不要说“晚安”“快睡吧”这类夜间收尾语；只有用户明确说自己现在就要睡、补觉或熬夜后补眠，才可以提睡觉。';
  }
  if (hour < 22) {
    return '[时间语气限制] 现在是晚上，可以自然提休息、睡前、晚安，但不要误写成清晨或上午。';
  }
  return '[时间语气限制] 现在是夜里，可以自然使用夜间语气，但不要误写成白天刚开始。';
}

export function buildTemporalContextPrompt(
  input: BuildTemporalContextPromptInput = {},
): string {
  const now = input.now ?? Date.now();
  const virtualDateTime = input.perception?.dateTime?.enabled
    ? input.perception.dateTime.value.trim()
    : '';

  if (virtualDateTime) {
    return [
      '## 当前时间',
      '[时间来源] 感知时间',
      `[当前时间] ${virtualDateTime}`,
      '[时间要求] 当前场景优先按这条时间继续推进，不要停留在上一轮对话的旧时刻。',
    ].join('\n');
  }

  const currentDate = new Date(now);
  const currentDateTimeText = getRealWorldDateTimeText(now);
  const dayPeriodLabel = getDayPeriodLabel(currentDate.getHours());

  return [
    '## 当前时间',
    '[时间来源] 现实时间',
    `[当前时间] ${currentDateTimeText}`,
    `[当前时段] ${dayPeriodLabel}`,
    buildTimePhraseGuard(currentDate.getHours()),
    '[时间要求] 默认按现实时间流逝理解当前语境，不要让时间停在上一轮对话里。',
  ].join('\n');
}

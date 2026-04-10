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
    '[时间要求] 默认按现实时间流逝理解当前语境，不要让时间停在上一轮对话里。',
  ].join('\n');
}

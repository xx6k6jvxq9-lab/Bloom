import type { PerceptionSettings } from '../../types';

export type TemporalFacts = {
  timeSource: 'real' | 'perceived';
  nowTimestamp: number;
  dateText: string;
  weekDay: string;
  hour: number;
  timePeriod: 'late_night' | 'early_morning' | 'morning' | 'noon' | 'afternoon' | 'evening';
  isLateNight: boolean;
  isWeekend: boolean;
};

type BuildTemporalFactsInput = {
  now?: number;
  perception?: PerceptionSettings;
};

function formatDateText(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function getTimePeriod(hour: number): TemporalFacts['timePeriod'] {
  if (hour < 5) return 'late_night';
  if (hour < 8) return 'early_morning';
  if (hour < 12) return 'morning';
  if (hour < 14) return 'noon';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function getPerceivedDate(perception?: PerceptionSettings): Date | null {
  const value = perception?.dateTime?.enabled ? perception.dateTime.value.trim() : '';
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function buildTemporalFacts(input: BuildTemporalFactsInput = {}): TemporalFacts {
  const fallbackNow = input.now ?? Date.now();
  const perceivedDate = getPerceivedDate(input.perception);
  const resolvedDate = perceivedDate ?? new Date(fallbackNow);
  const hour = resolvedDate.getHours();

  return {
    timeSource: perceivedDate ? 'perceived' : 'real',
    nowTimestamp: resolvedDate.getTime(),
    dateText: formatDateText(resolvedDate),
    weekDay: new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(resolvedDate),
    hour,
    timePeriod: getTimePeriod(hour),
    isLateNight: hour < 5 || hour >= 23,
    isWeekend: resolvedDate.getDay() === 0 || resolvedDate.getDay() === 6,
  };
}

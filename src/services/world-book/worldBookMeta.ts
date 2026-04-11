import type { WorldBookEntry } from '../../types';

export const WORLD_BOOK_CATEGORY_PRESETS = [
  '世界设定',
  '角色设定',
  '自己设定',
  '热梗知识',
  '地点设定',
  '关系设定',
  '规则禁忌',
  '其他',
] as const;

export const WORLD_BOOK_PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'normal', label: '普通' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '强制' },
] as const;

export type WorldBookPriorityLevel = NonNullable<WorldBookEntry['priorityLevel']>;

const PRIORITY_WEIGHT: Record<WorldBookPriorityLevel, number> = {
  low: 10,
  normal: 20,
  high: 30,
  critical: 40,
};

export function normalizeWorldBookCategory(category: string | null | undefined): string {
  const value = category?.trim();
  return value || '其他';
}

export function normalizeWorldBookPriorityLevel(
  level: WorldBookEntry['priorityLevel'],
): WorldBookPriorityLevel {
  if (level === 'low' || level === 'high' || level === 'critical') {
    return level;
  }

  return 'normal';
}

export function getWorldBookPriorityLabel(level: WorldBookEntry['priorityLevel']): string {
  const normalized = normalizeWorldBookPriorityLevel(level);
  return WORLD_BOOK_PRIORITY_OPTIONS.find((item) => item.value === normalized)?.label || '普通';
}

export function getWorldBookPriorityWeight(level: WorldBookEntry['priorityLevel']): number {
  return PRIORITY_WEIGHT[normalizeWorldBookPriorityLevel(level)];
}

export function sortWorldBooksByPriority(worldBooks: WorldBookEntry[]): WorldBookEntry[] {
  return [...worldBooks].sort((left, right) => {
    const priorityDiff =
      getWorldBookPriorityWeight(right.priorityLevel) - getWorldBookPriorityWeight(left.priorityLevel);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const categoryDiff = normalizeWorldBookCategory(left.category).localeCompare(
      normalizeWorldBookCategory(right.category),
      'zh-CN',
    );

    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    return (left.title || '').localeCompare(right.title || '', 'zh-CN');
  });
}

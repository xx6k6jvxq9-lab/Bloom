import { dreamTagGroups } from '../../components/dream/dreamContent';
import type { DreamTagCategory } from '../../components/dream/types';
import type { DreamSelection } from './dreamRuntimeTypes';

function pickBySeed<T>(items: T[], seed: string, count: number) {
  if (items.length === 0 || count <= 0) return [];
  const pool = [...items];
  const picked: T[] = [];
  let rolling = Array.from(seed).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);

  while (pool.length > 0 && picked.length < count) {
    const index = Math.abs(rolling) % pool.length;
    picked.push(pool[index]);
    pool.splice(index, 1);
    rolling = rolling * 31 + 17;
  }

  return picked;
}

function hasAnyDetailedSelection(selectedTags: Partial<Record<DreamTagCategory, string[]>>) {
  return dreamTagGroups
    .filter((group) => group.detailed)
    .some((group) => (selectedTags[group.category] ?? []).length > 0);
}

export function resolveDreamSelection(selection: DreamSelection, seed: string): DreamSelection {
  if (hasAnyDetailedSelection(selection.selectedTags)) {
    return selection;
  }

  const nextTags: Record<DreamTagCategory, string[]> = { ...selection.selectedTags };

  dreamTagGroups
    .filter((group) => group.detailed)
    .forEach((group, groupIndex) => {
      const desiredCount = Math.max(1, Math.min(group.max || 1, group.options.length, group.category === 'faction' || group.category === 'identity' ? 2 : 1));
      const picked = pickBySeed(group.options, `${seed}-${group.category}-${groupIndex}`, desiredCount).map((option) => option.id);
      nextTags[group.category] = picked;
    });

  return {
    ...selection,
    selectedTags: nextTags,
  };
}

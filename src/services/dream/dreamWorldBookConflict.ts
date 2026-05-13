import { dreamTagGroups } from '../../components/dream/dreamContent';
import type { DreamTagCategory } from '../../components/dream/types';
import type { WorldBookEntry } from '../../types';
import { buildWorldBookChunkCache } from '../world-book/worldBookBudget';
import { applyDerivedWorldBookMetadata } from '../world-book/worldBookDerived';
import type { DreamCustomTag } from './dreamRuntimeTypes';

type DreamWorldBookProtectedGroup = {
  id: 'genre' | 'identity' | 'relationship' | 'camp' | 'ending';
  label: string;
  categories: DreamTagCategory[];
};

type DreamWorldBookConflictRule = DreamWorldBookProtectedGroup & {
  selectedLabels: string[];
  conflictingLabels: string[];
  conflictingTokens: string[];
};

export type DreamWorldBookConflictResolution = {
  worldBooks: WorldBookEntry[];
  summary: string;
  removedEntryCount: number;
  removedSegmentCount: number;
  affectedWorldBookTitles: string[];
};

const DREAM_WORLD_BOOK_PROTECTED_GROUPS: DreamWorldBookProtectedGroup[] = [
  { id: 'genre', label: '题材', categories: ['genre'] },
  { id: 'identity', label: '身份', categories: ['identity', 'participants'] },
  { id: 'relationship', label: '关系', categories: ['tension', 'lead'] },
  { id: 'camp', label: '阵营', categories: ['camp', 'faction'] },
  { id: 'ending', label: '结局倾向', categories: ['ending'] },
];

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() || '';
}

function normalizeForTokenMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·•・]/g, '')
    .replace(/[《》〈〉「」『』【】\[\]()（）]/g, '')
    .replace(/[，,。！？!?；;：:、/\\'"“”‘’\-_—]/g, '');
}

function buildLabelTokens(label: string): string[] {
  const raw = normalizeOptionalText(label);
  if (!raw) return [];

  const normalized = normalizeForTokenMatch(raw);
  return Array.from(new Set([raw, normalized].filter((token) => token.length >= 2)));
}

function textContainsAnyToken(text: string, tokens: string[]): boolean {
  const raw = normalizeOptionalText(text);
  if (!raw || tokens.length === 0) return false;

  const normalized = normalizeForTokenMatch(raw);
  return tokens.some((token) => {
    const direct = normalizeOptionalText(token);
    if (!direct) return false;
    return raw.includes(direct) || normalized.includes(normalizeForTokenMatch(direct));
  });
}

function resolveLabelsByCategory(category: DreamTagCategory, ids: string[]) {
  const group = dreamTagGroups.find((item) => item.category === category);
  if (!group) return [];

  return group.options
    .filter((option) => ids.includes(option.id))
    .map((option) => option.label)
    .filter(Boolean);
}

function resolveCustomLabelsByCategory(category: DreamTagCategory, customTags: DreamCustomTag[] | undefined) {
  return (customTags || [])
    .filter((tag) => tag.category === category)
    .map((tag) => tag.label)
    .filter(Boolean);
}

function buildConflictRules(
  selectedTags: Record<DreamTagCategory, string[]>,
  customTags: DreamCustomTag[] | undefined,
): DreamWorldBookConflictRule[] {
  return DREAM_WORLD_BOOK_PROTECTED_GROUPS
    .map((group) => {
      const selectedLabels = group.categories.flatMap((category) => [
        ...resolveLabelsByCategory(category, selectedTags[category] ?? []),
        ...resolveCustomLabelsByCategory(category, customTags),
      ]);
      if (selectedLabels.length === 0) {
        return null;
      }

      const conflictingLabels = group.categories.flatMap((category) => {
        const selectedIds = new Set(selectedTags[category] ?? []);
        const tagGroup = dreamTagGroups.find((item) => item.category === category);
        if (!tagGroup) return [];

        return tagGroup.options
          .filter((option) => !selectedIds.has(option.id))
          .map((option) => option.label);
      });

      return {
        ...group,
        selectedLabels,
        conflictingLabels,
        conflictingTokens: Array.from(new Set(conflictingLabels.flatMap((label) => buildLabelTokens(label)))),
      } satisfies DreamWorldBookConflictRule;
    })
    .filter((rule): rule is DreamWorldBookConflictRule => Boolean(rule && rule.conflictingTokens.length > 0));
}

function splitWorldBookContentIntoSegments(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const paragraphSegments = normalized
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (paragraphSegments.length > 1) {
    return paragraphSegments;
  }

  return normalized
    .split(/\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function rebuildWorldBookEntry(entry: WorldBookEntry, content: string): WorldBookEntry {
  const nextContent = content.trim();
  if (nextContent === entry.content.trim()) {
    return entry;
  }

  return applyDerivedWorldBookMetadata({
    ...entry,
    content: nextContent,
    chunkCache: buildWorldBookChunkCache({
      id: entry.id,
      title: entry.title,
      content: nextContent,
      category: entry.category,
      keywords: entry.keywords,
    }),
  });
}

export function resolveDreamWorldBookConflicts(input: {
  worldBooks: WorldBookEntry[];
  selectedTags: Record<DreamTagCategory, string[]>;
  customTags?: DreamCustomTag[];
}): DreamWorldBookConflictResolution {
  const rules = buildConflictRules(input.selectedTags, input.customTags);
  if (rules.length === 0) {
    return {
      worldBooks: input.worldBooks,
      summary: '',
      removedEntryCount: 0,
      removedSegmentCount: 0,
      affectedWorldBookTitles: [],
    };
  }

  let removedEntryCount = 0;
  let removedSegmentCount = 0;
  const affectedWorldBookTitles = new Set<string>();

  const worldBooks = input.worldBooks.flatMap((entry) => {
    const title = normalizeOptionalText(entry.title);
    const titleConflicts = rules.filter((rule) => textContainsAnyToken(title, rule.conflictingTokens));
    if (titleConflicts.length > 0) {
      removedEntryCount += 1;
      if (title) affectedWorldBookTitles.add(title);
      return [];
    }

    const segments = splitWorldBookContentIntoSegments(entry.content);
    if (segments.length === 0) {
      return [entry];
    }

    const keptSegments = segments.filter((segment) => {
      const hasConflict = rules.some((rule) => textContainsAnyToken(segment, rule.conflictingTokens));
      if (hasConflict) {
        removedSegmentCount += 1;
        if (title) affectedWorldBookTitles.add(title);
        return false;
      }
      return true;
    });

    if (keptSegments.length === 0) {
      removedEntryCount += 1;
      if (title) affectedWorldBookTitles.add(title);
      return [];
    }

    return [rebuildWorldBookEntry(entry, keptSegments.join('\n\n'))];
  });

  const summary = removedEntryCount > 0 || removedSegmentCount > 0
    ? `已按本局标签裁掉 ${removedEntryCount} 条整本世界书和 ${removedSegmentCount} 段冲突内容。保护维度：${rules.map((rule) => `${rule.label}=${rule.selectedLabels.join(' / ')}`).join('；')}`
    : '';

  return {
    worldBooks,
    summary,
    removedEntryCount,
    removedSegmentCount,
    affectedWorldBookTitles: Array.from(affectedWorldBookTitles),
  };
}

import type { Character, MemoryLibraryEntry } from '../../types';

const MIN_AUTO_SHORT_TERM_ENTRIES_BEFORE_LONG_TERM = 3;
const MIN_SHORT_TERM_SUMMARY_CHARS = 24;

export type AutoLongTermRefreshPlan = {
  shouldRefresh: boolean;
  pendingShortTermEntryCount: number;
};

type BuildAutoLongTermRefreshPlanInput = Pick<Character, 'memoryLibraryEntries'> & {
  latestShortTermSummary?: string;
  pendingEntries?: MemoryLibraryEntry[];
};

function getLatestLongTermAnchorTimestamp(entries: MemoryLibraryEntry[]): number {
  return entries
    .filter((entry) => entry.kind === 'long-term')
    .reduce((latest, entry) => Math.max(latest, entry.createdAt), 0);
}

export function buildAutoLongTermRefreshPlan(
  input: BuildAutoLongTermRefreshPlanInput,
): AutoLongTermRefreshPlan {
  const latestShortTermSummary = input.latestShortTermSummary?.trim() || '';
  if (latestShortTermSummary.length < MIN_SHORT_TERM_SUMMARY_CHARS) {
    return {
      shouldRefresh: false,
      pendingShortTermEntryCount: 0,
    };
  }

  const entries = [...(input.pendingEntries || input.memoryLibraryEntries || [])]
    .sort((left, right) => right.createdAt - left.createdAt);
  const latestLongTermAnchorTimestamp = getLatestLongTermAnchorTimestamp(entries);
  const pendingShortTermEntryCount = entries.filter((entry) => (
    entry.kind === 'short-term'
    && entry.source === 'auto'
    && entry.createdAt > latestLongTermAnchorTimestamp
  )).length;

  return {
    shouldRefresh: pendingShortTermEntryCount >= MIN_AUTO_SHORT_TERM_ENTRIES_BEFORE_LONG_TERM,
    pendingShortTermEntryCount,
  };
}

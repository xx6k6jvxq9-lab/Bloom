import type { Character, MemoryLibraryEntry } from '../../types';
import type { MemoryRecord } from './memoryRecordTypes';
import { projectMemoryLibraryEntriesFromRecords } from './memoryRecordSnapshots';

const DEFAULT_MIN_AUTO_SHORT_TERM_ENTRIES_BEFORE_LONG_TERM = 5;
const DEFAULT_MIN_AUTO_SHORT_TERM_DAY_SPAN = 2;
const DEFAULT_MIN_STABLE_SIGNAL_ENTRIES = 2;
const MIN_SHORT_TERM_SUMMARY_CHARS = 24;

export type AutoLongTermRefreshPlan = {
  shouldRefresh: boolean;
  pendingShortTermEntryCount: number;
  pendingShortTermDaySpan: number;
  stableSignalEntryCount: number;
};

type BuildAutoLongTermRefreshPlanInput = Pick<
  Character,
  'memoryLibraryEntries' | 'autoLongTermMinShortTermEntries' | 'autoLongTermMinDaySpan'
> & {
  characterId?: string;
  latestShortTermSummary?: string;
  memoryRecords?: MemoryRecord[];
  pendingEntries?: MemoryLibraryEntry[];
};

function getLatestLongTermAnchorTimestamp(entries: MemoryLibraryEntry[]): number {
  return entries
    .filter((entry) => entry.kind === 'long-term')
    .reduce((latest, entry) => Math.max(latest, entry.createdAt), 0);
}

const STABLE_SIGNAL_PATTERNS = [
  /稳定|一贯|长期|边界|偏好|模式|关系定位|相处逻辑|经常|总是|反复/u,
  /开放回路（(?:waiting_user|dormant)）/u,
];

function countStableSignalEntries(entries: MemoryLibraryEntry[]): number {
  return entries.filter((entry) => (
    STABLE_SIGNAL_PATTERNS.some((pattern) => pattern.test(entry.content))
  )).length;
}

export function buildAutoLongTermRefreshPlan(
  input: BuildAutoLongTermRefreshPlanInput,
): AutoLongTermRefreshPlan {
  const latestShortTermSummary = input.latestShortTermSummary?.trim() || '';
  if (latestShortTermSummary.length < MIN_SHORT_TERM_SUMMARY_CHARS) {
    return {
      shouldRefresh: false,
      pendingShortTermEntryCount: 0,
      pendingShortTermDaySpan: 0,
      stableSignalEntryCount: 0,
    };
  }

  const minShortTermEntries = Number.isFinite(input.autoLongTermMinShortTermEntries)
    ? Math.max(1, Math.floor(input.autoLongTermMinShortTermEntries as number))
    : DEFAULT_MIN_AUTO_SHORT_TERM_ENTRIES_BEFORE_LONG_TERM;
  const minDaySpan = Number.isFinite(input.autoLongTermMinDaySpan)
    ? Math.max(1, Math.floor(input.autoLongTermMinDaySpan as number))
    : DEFAULT_MIN_AUTO_SHORT_TERM_DAY_SPAN;

  const projectedEntries = input.characterId
    ? [
        ...projectMemoryLibraryEntriesFromRecords({
          characterId: input.characterId,
          kind: 'short-term',
          records: input.memoryRecords,
        }),
        ...projectMemoryLibraryEntriesFromRecords({
          characterId: input.characterId,
          kind: 'long-term',
          records: input.memoryRecords,
        }),
      ]
    : [];
  const sourceEntries = input.pendingEntries
    ?? (projectedEntries.length > 0 ? projectedEntries : input.memoryLibraryEntries)
    ?? [];
  const entries = [...sourceEntries]
    .sort((left, right) => right.createdAt - left.createdAt);
  const latestLongTermAnchorTimestamp = getLatestLongTermAnchorTimestamp(entries);
  const pendingShortTermEntries = entries.filter((entry) => (
    entry.kind === 'short-term'
    && entry.source === 'auto'
    && entry.createdAt > latestLongTermAnchorTimestamp
  ));
  const pendingShortTermEntryCount = pendingShortTermEntries.length;
  const pendingShortTermDayKeys = new Set(
    pendingShortTermEntries.map((entry) => `${entry.year}-${entry.month}-${entry.day}`),
  );
  const pendingShortTermDaySpan = pendingShortTermDayKeys.size;
  const stableSignalEntryCount = countStableSignalEntries(pendingShortTermEntries);

  return {
    shouldRefresh: (
      pendingShortTermEntryCount >= minShortTermEntries
      && pendingShortTermDaySpan >= minDaySpan
      && (
        stableSignalEntryCount >= DEFAULT_MIN_STABLE_SIGNAL_ENTRIES
        || pendingShortTermEntryCount >= (minShortTermEntries + 2)
      )
    ),
    pendingShortTermEntryCount,
    pendingShortTermDaySpan,
    stableSignalEntryCount,
  };
}

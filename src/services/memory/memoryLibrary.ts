import type { Character, MemoryLibraryEntry, MemoryLibraryKind, MemoryLibrarySource } from '../../types';

type CreateMemoryLibraryEntryInput = {
  kind: MemoryLibraryKind;
  source: MemoryLibrarySource;
  content: string;
  createdAt?: number;
};

type MemoryLibraryStats = {
  totalEntries: number;
  totalChars: number;
  latestCreatedAt: number | null;
  earliestCreatedAt: number | null;
  currentMonthEntries: number;
  autoEntries: number;
  manualEntries: number;
};

function toPositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function normalizeEntryContent(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function createMemoryLibraryEntry({
  kind,
  source,
  content,
  createdAt = Date.now(),
}: CreateMemoryLibraryEntryInput): MemoryLibraryEntry {
  const safeCreatedAt = Number.isFinite(createdAt) ? Math.max(0, Math.floor(createdAt)) : Date.now();
  const date = new Date(safeCreatedAt);
  const normalizedContent = content.trim();

  return {
    id: `memory-${kind}-${safeCreatedAt}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    source,
    content: normalizedContent,
    createdAt: safeCreatedAt,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    charCount: normalizedContent.length,
  };
}

export function normalizeMemoryLibraryEntries(value: unknown): MemoryLibraryEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedEntries = value.flatMap((entry): MemoryLibraryEntry[] => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const candidate = entry as Partial<MemoryLibraryEntry>;
    const kind = candidate.kind === 'long-term' ? 'long-term' : candidate.kind === 'short-term' ? 'short-term' : null;
    const source = candidate.source === 'auto' ? 'auto' : candidate.source === 'manual' ? 'manual' : null;
    const content = normalizeEntryContent(candidate.content);
    const createdAt = toPositiveInteger(candidate.createdAt);

    if (!kind || !source || !content || createdAt === null) {
      return [];
    }

    const date = new Date(createdAt);
    return [{
      id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : `memory-${kind}-${createdAt}`,
      kind,
      source,
      content,
      createdAt,
      year: toPositiveInteger(candidate.year) ?? date.getFullYear(),
      month: toPositiveInteger(candidate.month) ?? (date.getMonth() + 1),
      day: toPositiveInteger(candidate.day) ?? date.getDate(),
      hour: toPositiveInteger(candidate.hour) ?? date.getHours(),
      minute: toPositiveInteger(candidate.minute) ?? date.getMinutes(),
      charCount: toPositiveInteger(candidate.charCount) ?? content.length,
    }];
  });

  return normalizedEntries.length > 0 ? normalizedEntries.sort((a, b) => b.createdAt - a.createdAt) : undefined;
}

export function appendMemoryLibraryEntry(
  character: Pick<Character, 'memoryLibraryEntries'>,
  entry: MemoryLibraryEntry,
): MemoryLibraryEntry[] {
  return [entry, ...(character.memoryLibraryEntries ?? [])].sort((a, b) => b.createdAt - a.createdAt);
}

export function buildMemoryLibraryPatch(
  character: Pick<Character, 'memoryLibraryEntries'>,
  input: CreateMemoryLibraryEntryInput,
): Pick<Character, 'memoryLibraryEntries'> {
  const entry = createMemoryLibraryEntry(input);
  return {
    memoryLibraryEntries: appendMemoryLibraryEntry(character, entry),
  };
}

export function getMemoryLibraryEntries(
  character: Pick<Character, 'memoryLibraryEntries'>,
  kind?: MemoryLibraryKind,
): MemoryLibraryEntry[] {
  const entries = character.memoryLibraryEntries ?? [];
  return kind ? entries.filter((entry) => entry.kind === kind) : entries;
}

export function getMemoryLibraryStats(
  entries: MemoryLibraryEntry[],
  now: number = Date.now(),
): MemoryLibraryStats {
  const nowDate = new Date(now);
  const currentYear = nowDate.getFullYear();
  const currentMonth = nowDate.getMonth() + 1;

  return entries.reduce<MemoryLibraryStats>((stats, entry) => {
    stats.totalEntries += 1;
    stats.totalChars += entry.charCount;
    stats.latestCreatedAt = stats.latestCreatedAt == null ? entry.createdAt : Math.max(stats.latestCreatedAt, entry.createdAt);
    stats.earliestCreatedAt = stats.earliestCreatedAt == null ? entry.createdAt : Math.min(stats.earliestCreatedAt, entry.createdAt);

    if (entry.year === currentYear && entry.month === currentMonth) {
      stats.currentMonthEntries += 1;
    }

    if (entry.source === 'auto') {
      stats.autoEntries += 1;
    } else {
      stats.manualEntries += 1;
    }

    return stats;
  }, {
    totalEntries: 0,
    totalChars: 0,
    latestCreatedAt: null,
    earliestCreatedAt: null,
    currentMonthEntries: 0,
    autoEntries: 0,
    manualEntries: 0,
  });
}

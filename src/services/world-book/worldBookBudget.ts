import type { WorldBookEntry } from '../../types';
import { getWorldBookPriorityWeight, normalizeWorldBookCategory, sortWorldBooksByPriority } from './worldBookMeta';
import { buildWorldBookChunkKeywords, tokenizeWorldBookRecallText } from './worldBookDerived';

export type WorldBookBudgetMode = 'direct' | 'group';

type WorldBookBudget = {
  maxSelections: number;
  softCharBudget: number;
  hardCharBudget: number;
  maxCharsPerSelection: number;
  targetChunkChars: number;
  maxChunksPerBook: number;
};

export type WorldBookRetrievalOptions = {
  query?: string;
  recentText?: string[];
};

export type WorldBookChunkCacheEntry = NonNullable<WorldBookEntry['chunkCache']>[number];

export type WorldBookDiscardReason =
  | 'per_book_limit'
  | 'max_selections'
  | 'hard_budget'
  | 'soft_budget_stop'
  | 'empty_content';

type WorldBookChunk = {
  worldBook: WorldBookEntry;
  chunkIndex: number;
  label: string;
  content: string;
  keywords?: string[];
  score: number;
  pinned: boolean;
};

export type WorldBookSelectionDiagnostic = {
  worldBookId: string;
  title: string;
  category: string;
  label: string;
  score: number;
  pinned: boolean;
  selected: boolean;
  charCount: number;
  preview: string;
  discardReason?: WorldBookDiscardReason;
};

export type WorldBookPromptSelectionResult = {
  entries: WorldBookEntry[];
  diagnostics: {
    mode: WorldBookBudgetMode;
    query?: string;
    usedChars: number;
    softCharBudget: number;
    hardCharBudget: number;
    maxSelections: number;
    totalCandidates: number;
    selectedCount: number;
    selected: WorldBookSelectionDiagnostic[];
    discarded: WorldBookSelectionDiagnostic[];
  };
};

export type WorldBookPromptDiagnostics = {
  mode: WorldBookBudgetMode;
  query?: string;
  totalChars: number;
  overviewChars: number;
  overviewCount: number;
  mustReadChars: number;
  mustReadBookCount: number;
  mustReadFactCount: number;
  detailChars: number;
  detailCount: number;
  usedChars: number;
  softCharBudget: number;
  hardCharBudget: number;
  maxSelections: number;
  totalCandidates: number;
  selectedCount: number;
  selected: WorldBookSelectionDiagnostic[];
  discarded: WorldBookSelectionDiagnostic[];
};

const WORLD_BOOK_OVERVIEW_MAX_CHARS = 96;
const WORLD_BOOK_FACT_MAX_CHARS = 68;

const BUDGET_BY_MODE: Record<WorldBookBudgetMode, WorldBookBudget> = {
  direct: {
    maxSelections: 10,
    softCharBudget: 8000,
    hardCharBudget: 12000,
    maxCharsPerSelection: 1400,
    targetChunkChars: 900,
    maxChunksPerBook: 3,
  },
  group: {
    maxSelections: 12,
    softCharBudget: 10000,
    hardCharBudget: 15000,
    maxCharsPerSelection: 1500,
    targetChunkChars: 950,
    maxChunksPerBook: 3,
  },
};

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function getEntryPromptOverhead(entry: WorldBookEntry): number {
  const title = normalizeOptionalText(entry.title) || '';
  const category = normalizeWorldBookCategory(entry.category);
  return `[${category}] ${title}:\n`.length + 2;
}

function limitText(text: string, maxChars: number): string {
  const normalized = text.trim();
  return normalized.length <= maxChars ? normalized : normalized.slice(0, maxChars).trim();
}

function buildChunkId(entry: WorldBookEntry, chunkIndex: number) {
  return `${entry.id}::chunk-${chunkIndex}`;
}

function splitLargeBlock(block: string, maxChars: number): string[] {
  const lines = block
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    const chunks: string[] = [];
    let cursor = 0;
    while (cursor < block.length) {
      chunks.push(block.slice(cursor, cursor + maxChars).trim());
      cursor += maxChars;
    }
    return chunks.filter(Boolean);
  }

  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxChars && current) {
      chunks.push(current.trim());
      current = line;
    } else if (next.length > maxChars) {
      chunks.push(...splitLargeBlock(line, maxChars));
      current = '';
    } else {
      current = next;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

export function buildWorldBookChunkCache(
  entry: Pick<WorldBookEntry, 'id' | 'content'> & Partial<Pick<WorldBookEntry, 'title' | 'category' | 'keywords'>>,
  targetChunkChars: number = BUDGET_BY_MODE.direct.targetChunkChars,
): WorldBookChunkCacheEntry[] {
  const content = normalizeOptionalText(entry.content);
  if (!content) return [];

  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const preparedBlocks = blocks.length > 0 ? blocks : [content];
  const segments: string[] = [];
  let current = '';

  for (const block of preparedBlocks) {
    if (block.length > targetChunkChars * 1.4) {
      if (current.trim()) {
        segments.push(current.trim());
        current = '';
      }
      segments.push(...splitLargeBlock(block, targetChunkChars));
      continue;
    }

    const next = current ? `${current}\n\n${block}` : block;
    if (next.length > targetChunkChars && current) {
      segments.push(current.trim());
      current = block;
    } else {
      current = next;
    }
  }

  if (current.trim()) {
    segments.push(current.trim());
  }

  return segments.map((segment, index) => ({
    id: buildChunkId(entry as WorldBookEntry, index),
    label: segments.length > 1 ? `片段 ${index + 1}` : '核心片段',
    content: segment,
    keywords: buildWorldBookChunkKeywords({
      title: entry.title,
      category: entry.category,
      content: segment,
      baseKeywords: entry.keywords,
    }),
  }));
}

function scoreChunkMatch(chunk: WorldBookChunk, options: WorldBookRetrievalOptions): number {
  const haystack = [
    chunk.worldBook.title,
    chunk.worldBook.category,
    chunk.content,
    ...(chunk.keywords || []),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  const queryTokens = tokenizeWorldBookRecallText(options.query || '');
  const recentTokens = tokenizeWorldBookRecallText((options.recentText || []).join('\n'));
  const priorityScore = getWorldBookPriorityWeight(chunk.worldBook.priorityLevel) * 10;
  const earlyChunkBonus = Math.max(0, 18 - chunk.chunkIndex * 4);
  const exactTitleHit = options.query && chunk.worldBook.title.toLowerCase().includes(options.query.toLowerCase()) ? 30 : 0;
  const queryHitScore = queryTokens.reduce((score, token) => score + (haystack.includes(token) ? Math.min(18, token.length * 2) : 0), 0);
  const recentHitScore = recentTokens.reduce((score, token) => score + (haystack.includes(token) ? Math.min(8, token.length) : 0), 0);
  const pinBonus = chunk.pinned ? 500 : 0;

  return pinBonus + priorityScore + earlyChunkBonus + exactTitleHit + queryHitScore + recentHitScore;
}

function getEntryChunkCache(entry: WorldBookEntry, targetChunkChars: number): WorldBookChunkCacheEntry[] {
  if (Array.isArray(entry.chunkCache) && entry.chunkCache.length > 0) {
    return entry.chunkCache
      .map((chunk, index) => ({
        id: normalizeOptionalText(chunk.id) || buildChunkId(entry, index),
        label: normalizeOptionalText(chunk.label) || `片段 ${index + 1}`,
        content: normalizeOptionalText(chunk.content) || '',
        keywords: Array.isArray(chunk.keywords) ? chunk.keywords.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
      }))
      .filter((chunk) => chunk.content);
  }

  return buildWorldBookChunkCache(entry, targetChunkChars);
}

function formatWorldBookOverviewLine(entry: WorldBookEntry): string {
  const title = normalizeOptionalText(entry.title) || 'Untitled World Book';
  const category = normalizeWorldBookCategory(entry.category);
  const summarySource = normalizeOptionalText(entry.summary)
    || normalizeOptionalText((entry.keywords || []).slice(0, 4).join(', '))
    || normalizeOptionalText(entry.content);
  const summary = summarySource ? limitText(summarySource, WORLD_BOOK_OVERVIEW_MAX_CHARS) : '';

  return summary
    ? `- [${category}] ${title}: ${summary}`
    : `- [${category}] ${title}`;
}

function buildWorldBookOverviewSection(worldBooks: WorldBookEntry[]): string {
  if (worldBooks.length === 0) {
    return '';
  }

  return [
    '[World Book Overview / Full Map]',
    ...sortWorldBooksByPriority(worldBooks).map(formatWorldBookOverviewLine),
  ].join('\n');
}

function formatWorldBookMustReadLine(entry: WorldBookEntry): string {
  const title = normalizeOptionalText(entry.title) || 'Untitled World Book';
  const facts = (entry.mustReadFacts || [])
    .map((fact) => limitText(fact, WORLD_BOOK_FACT_MAX_CHARS))
    .filter(Boolean)
    .slice(0, 2);

  if (facts.length === 0) {
    return '';
  }

  return `- ${title}: ${facts.join(' | ')}`;
}

function buildWorldBookMustReadSection(worldBooks: WorldBookEntry[]): string {
  const lines = sortWorldBooksByPriority(worldBooks)
    .map(formatWorldBookMustReadLine)
    .filter(Boolean);

  if (lines.length === 0) {
    return '';
  }

  return [
    '[World Book Must Read / Stable Rules]',
    ...lines,
  ].join('\n');
}

function buildWorldBookDetailEntriesSection(
  entries: WorldBookEntry[],
): string {
  const sections = entries
    .map((entry) => {
      const title = normalizeOptionalText(entry.title);
      const content = normalizeOptionalText(entry.content);

      if (!title || !content) {
        return '';
      }

      return `[${normalizeWorldBookCategory(entry.category)}] ${title}:\n${content}`;
    })
    .filter(Boolean);

  if (sections.length === 0) {
    return '';
  }

  return [
    '[World Book Details / Current Relevant Excerpts]',
    ...sections,
  ].join('\n\n');
}

function buildWorldBookDetailSection(
  worldBooks: WorldBookEntry[] | undefined,
  mode: WorldBookBudgetMode,
  options: WorldBookRetrievalOptions = {},
): string {
  return buildWorldBookDetailEntriesSection(selectWorldBooksForPrompt(worldBooks, mode, options).entries);
}

function buildChunkCandidates(
  worldBooks: WorldBookEntry[],
  mode: WorldBookBudgetMode,
  options: WorldBookRetrievalOptions,
): WorldBookChunk[] {
  const budget = BUDGET_BY_MODE[mode];

  return sortWorldBooksByPriority(worldBooks).flatMap((worldBook) => {
    const pinned = worldBook.pinMode === 'always';
    return getEntryChunkCache(worldBook, budget.targetChunkChars)
      .map((chunk, index) => {
        const candidate: WorldBookChunk = {
          worldBook,
          chunkIndex: index,
          label: chunk.label,
          content: chunk.content,
          keywords: chunk.keywords,
          score: 0,
          pinned,
        };

        return {
          ...candidate,
          score: scoreChunkMatch(candidate, options),
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, pinned ? budget.maxChunksPerBook + 1 : budget.maxChunksPerBook);
  });
}

function getChunkDiagnosticKey(chunk: Pick<WorldBookChunk, 'worldBook' | 'chunkIndex'>): string {
  return `${chunk.worldBook.id}::${chunk.chunkIndex}`;
}

function toDiagnostic(
  chunk: WorldBookChunk,
  selected: boolean,
  discardReason?: WorldBookDiscardReason,
): WorldBookSelectionDiagnostic {
  return {
    worldBookId: chunk.worldBook.id,
    title: chunk.worldBook.title,
    category: normalizeWorldBookCategory(chunk.worldBook.category),
    label: chunk.label,
    score: chunk.score,
    pinned: chunk.pinned,
    selected,
    charCount: chunk.content.length,
    preview: limitText(chunk.content.replace(/\n+/g, ' '), 140),
    discardReason,
  };
}

export function selectWorldBooksForPrompt(
  worldBooks: WorldBookEntry[] | undefined,
  mode: WorldBookBudgetMode,
  options: WorldBookRetrievalOptions = {},
): WorldBookPromptSelectionResult {
  if (!worldBooks || worldBooks.length === 0) {
    return {
      entries: [],
      diagnostics: {
        mode,
        query: options.query,
        usedChars: 0,
        softCharBudget: BUDGET_BY_MODE[mode].softCharBudget,
        hardCharBudget: BUDGET_BY_MODE[mode].hardCharBudget,
        maxSelections: BUDGET_BY_MODE[mode].maxSelections,
        totalCandidates: 0,
        selectedCount: 0,
        selected: [],
        discarded: [],
      },
    };
  }

  const budget = BUDGET_BY_MODE[mode];
  const candidates = buildChunkCandidates(worldBooks, mode, options)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.worldBook.priorityLevel !== left.worldBook.priorityLevel) {
        return getWorldBookPriorityWeight(right.worldBook.priorityLevel) - getWorldBookPriorityWeight(left.worldBook.priorityLevel);
      }
      return left.chunkIndex - right.chunkIndex;
    });

  const selectedEntries: WorldBookEntry[] = [];
  const selectedChunks = new Set<string>();
  const selectedPerBook = new Map<string, number>();
  const discardedReasons = new Map<string, WorldBookDiscardReason>();
  let usedChars = 0;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (selectedEntries.length >= budget.maxSelections) {
      for (let restIndex = index; restIndex < candidates.length; restIndex += 1) {
        const restCandidate = candidates[restIndex];
        const key = getChunkDiagnosticKey(restCandidate);
        if (!selectedChunks.has(key) && !discardedReasons.has(key)) {
          discardedReasons.set(key, 'max_selections');
        }
      }
      break;
    }

    const entry = candidate.worldBook;
    const currentCount = selectedPerBook.get(entry.id) || 0;
    const allowedPerBook = candidate.pinned ? budget.maxChunksPerBook + 1 : budget.maxChunksPerBook;
    if (currentCount >= allowedPerBook) {
      discardedReasons.set(getChunkDiagnosticKey(candidate), 'per_book_limit');
      continue;
    }

    const overhead = getEntryPromptOverhead(entry);
    const remainingHardBudget = budget.hardCharBudget - usedChars - overhead;
    if (remainingHardBudget <= 0) {
      for (let restIndex = index; restIndex < candidates.length; restIndex += 1) {
        const restCandidate = candidates[restIndex];
        const key = getChunkDiagnosticKey(restCandidate);
        if (!selectedChunks.has(key) && !discardedReasons.has(key)) {
          discardedReasons.set(key, 'hard_budget');
        }
      }
      break;
    }

    const contentBudget = Math.min(budget.maxCharsPerSelection, remainingHardBudget);
    const limitedContent = limitText(candidate.content, contentBudget);
    if (!limitedContent) {
      discardedReasons.set(getChunkDiagnosticKey(candidate), 'empty_content');
      continue;
    }

    selectedEntries.push({
      ...entry,
      title: currentCount > 0 || candidate.chunkIndex > 0 ? `${entry.title} · ${candidate.label}` : entry.title,
      content: limitedContent,
    });
    selectedPerBook.set(entry.id, currentCount + 1);
    selectedChunks.add(`${entry.id}::${candidate.chunkIndex}`);
    usedChars += overhead + limitedContent.length;

    if (usedChars >= budget.softCharBudget && selectedEntries.length >= Math.min(4, budget.maxSelections)) {
      const hasQuery = !!options.query?.trim();
      const shouldContinueForPinned = candidates.slice(selectedEntries.length).some((item) => item.pinned);
      if (!hasQuery && !shouldContinueForPinned) {
        for (let restIndex = index + 1; restIndex < candidates.length; restIndex += 1) {
          const restCandidate = candidates[restIndex];
          const key = getChunkDiagnosticKey(restCandidate);
          if (!selectedChunks.has(key) && !discardedReasons.has(key)) {
            discardedReasons.set(key, 'soft_budget_stop');
          }
        }
        break;
      }
    }
  }

  const diagnostics = candidates.map((candidate) => {
    const key = getChunkDiagnosticKey(candidate);
    const selected = selectedChunks.has(key);
    return toDiagnostic(candidate, selected, selected ? undefined : discardedReasons.get(key));
  });

  return {
    entries: selectedEntries,
    diagnostics: {
      mode,
      query: options.query,
      usedChars,
      softCharBudget: budget.softCharBudget,
      hardCharBudget: budget.hardCharBudget,
      maxSelections: budget.maxSelections,
      totalCandidates: diagnostics.length,
      selectedCount: selectedEntries.length,
      selected: diagnostics.filter((item) => item.selected),
      discarded: diagnostics.filter((item) => !item.selected),
    },
  };
}

export function limitWorldBooksForPrompt(
  worldBooks: WorldBookEntry[] | undefined,
  mode: WorldBookBudgetMode,
  options: WorldBookRetrievalOptions = {},
): WorldBookEntry[] {
  return selectWorldBooksForPrompt(worldBooks, mode, options).entries;
}

export function buildBudgetedWorldBookPrompt(
  worldBooks: WorldBookEntry[] | undefined,
  mode: WorldBookBudgetMode,
  options: WorldBookRetrievalOptions = {},
): string | undefined {
  const orderedWorldBooks = sortWorldBooksByPriority(
    (worldBooks || []).filter((entry) => !!normalizeOptionalText(entry.content)),
  );
  const sections = [
    buildWorldBookOverviewSection(orderedWorldBooks),
    buildWorldBookMustReadSection(orderedWorldBooks),
    buildWorldBookDetailSection(orderedWorldBooks, mode, options),
  ].filter(Boolean);

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}

export function buildWorldBookPromptDiagnostics(
  worldBooks: WorldBookEntry[] | undefined,
  mode: WorldBookBudgetMode,
  options: WorldBookRetrievalOptions = {},
): WorldBookPromptDiagnostics {
  const orderedWorldBooks = sortWorldBooksByPriority(
    (worldBooks || []).filter((entry) => !!normalizeOptionalText(entry.content)),
  );
  const selectionResult = selectWorldBooksForPrompt(orderedWorldBooks, mode, options);
  const overviewSection = buildWorldBookOverviewSection(orderedWorldBooks);
  const mustReadSection = buildWorldBookMustReadSection(orderedWorldBooks);
  const detailSection = buildWorldBookDetailEntriesSection(selectionResult.entries);
  const sections = [overviewSection, mustReadSection, detailSection].filter(Boolean);
  const mustReadBooks = orderedWorldBooks.filter((entry) => (entry.mustReadFacts || []).length > 0);

  return {
    mode,
    query: options.query,
    totalChars: sections.join('\n\n').length,
    overviewChars: overviewSection.length,
    overviewCount: orderedWorldBooks.length,
    mustReadChars: mustReadSection.length,
    mustReadBookCount: mustReadBooks.length,
    mustReadFactCount: mustReadBooks.reduce((count, entry) => count + ((entry.mustReadFacts || []).slice(0, 2).length), 0),
    detailChars: detailSection.length,
    detailCount: selectionResult.diagnostics.selectedCount,
    usedChars: selectionResult.diagnostics.usedChars,
    softCharBudget: selectionResult.diagnostics.softCharBudget,
    hardCharBudget: selectionResult.diagnostics.hardCharBudget,
    maxSelections: selectionResult.diagnostics.maxSelections,
    totalCandidates: selectionResult.diagnostics.totalCandidates,
    selectedCount: selectionResult.diagnostics.selectedCount,
    selected: selectionResult.diagnostics.selected,
    discarded: selectionResult.diagnostics.discarded,
  };
}

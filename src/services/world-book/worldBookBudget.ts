import type { WorldBookEntry } from '../../types';
import { normalizeWorldBookCategory, sortWorldBooksByPriority } from './worldBookMeta';

export type WorldBookBudgetMode = 'direct' | 'group';

type WorldBookBudget = {
  maxEntries: number;
  softCharBudget: number;
  hardCharBudget: number;
  maxCharsPerEntry: number;
};

const BUDGET_BY_MODE: Record<WorldBookBudgetMode, WorldBookBudget> = {
  direct: {
    maxEntries: 6,
    softCharBudget: 4000,
    hardCharBudget: 6000,
    maxCharsPerEntry: 1800,
  },
  group: {
    maxEntries: 8,
    softCharBudget: 5000,
    hardCharBudget: 8000,
    maxCharsPerEntry: 2000,
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

function trimContentToBudget(content: string, budget: number): string {
  const normalized = content.trim();
  if (normalized.length <= budget) {
    return normalized;
  }

  return normalized.slice(0, Math.max(0, budget)).trim();
}

export function limitWorldBooksForPrompt(
  worldBooks: WorldBookEntry[] | undefined,
  mode: WorldBookBudgetMode,
): WorldBookEntry[] {
  if (!worldBooks || worldBooks.length === 0) {
    return [];
  }

  const budget = BUDGET_BY_MODE[mode];
  let usedChars = 0;
  const selected: WorldBookEntry[] = [];

  for (const entry of sortWorldBooksByPriority(worldBooks)) {
    if (selected.length >= budget.maxEntries) {
      break;
    }

    const title = normalizeOptionalText(entry.title);
    const content = normalizeOptionalText(entry.content);
    if (!title || !content) {
      continue;
    }

    const overhead = getEntryPromptOverhead(entry);
    const remainingHardBudget = budget.hardCharBudget - usedChars - overhead;
    if (remainingHardBudget <= 0) {
      break;
    }

    const entryContentBudget = Math.min(
      budget.maxCharsPerEntry,
      remainingHardBudget,
      selected.length === 0 ? budget.hardCharBudget : Math.max(0, budget.softCharBudget - usedChars - overhead),
    );

    if (entryContentBudget <= 0 && usedChars >= budget.softCharBudget) {
      continue;
    }

    const limitedContent = trimContentToBudget(content, Math.max(0, entryContentBudget || remainingHardBudget));
    if (!limitedContent) {
      continue;
    }

    selected.push({
      ...entry,
      content: limitedContent,
    });
    usedChars += overhead + limitedContent.length;

    if (usedChars >= budget.hardCharBudget) {
      break;
    }
  }

  return selected;
}

export function buildBudgetedWorldBookPrompt(
  worldBooks: WorldBookEntry[] | undefined,
  mode: WorldBookBudgetMode,
): string | undefined {
  const sections = limitWorldBooksForPrompt(worldBooks, mode)
    .map((entry) => {
      const title = normalizeOptionalText(entry.title);
      const content = normalizeOptionalText(entry.content);

      if (!title || !content) {
        return '';
      }

      return `[${normalizeWorldBookCategory(entry.category)}] ${title}:\n${content}`;
    })
    .filter(Boolean);

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}

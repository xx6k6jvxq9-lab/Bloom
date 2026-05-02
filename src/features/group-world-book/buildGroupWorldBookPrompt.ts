import type { WorldBookEntry } from '../../types';
import { buildBudgetedWorldBookPrompt, type WorldBookRetrievalOptions } from '../../services/world-book/worldBookBudget';

export function buildGroupWorldBookPrompt(
  worldBooks: WorldBookEntry[] | undefined,
  options: WorldBookRetrievalOptions = {},
): string | undefined {
  return buildBudgetedWorldBookPrompt(worldBooks, 'group', options);
}

import type { WorldBookEntry } from '../../types';
import { buildBudgetedWorldBookPrompt } from '../../services/world-book/worldBookBudget';

export function buildGroupWorldBookPrompt(worldBooks: WorldBookEntry[] | undefined): string | undefined {
  return buildBudgetedWorldBookPrompt(worldBooks, 'group');
}

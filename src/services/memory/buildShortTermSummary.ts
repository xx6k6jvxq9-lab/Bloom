import type { Character } from '../../types';

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function buildShortTermSummary(character: Pick<Character, 'shortTermSummary'>): string | undefined {
  return normalizeOptionalText(character.shortTermSummary);
}

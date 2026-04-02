import type { Character } from '../../types';

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function buildLongTermMemoryProfile(
  character: Pick<Character, 'longTermMemoryProfile' | 'memorySummary'>,
): string | undefined {
  return normalizeOptionalText(character.longTermMemoryProfile)
    ?? normalizeOptionalText(character.memorySummary);
}

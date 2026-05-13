import type { Character } from '../../types';
import { buildDerivedMemoryLayersFromRecords } from './deriveMemoryLayersFromRecords';

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function buildLongTermMemoryProfile(
  character: Pick<Character, 'id' | 'longTermMemoryProfile'>,
): string | undefined {
  const derived = buildDerivedMemoryLayersFromRecords(character).longTermMemoryProfile;
  if (derived) {
    return derived;
  }

  return normalizeOptionalText(character.longTermMemoryProfile);
}

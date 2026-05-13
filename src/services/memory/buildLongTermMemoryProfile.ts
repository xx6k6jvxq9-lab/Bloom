import type { Character } from '../../types';
import {
  buildDerivedMemoryLayersFromRecords,
  type DerivedMemoryLayers,
} from './deriveMemoryLayersFromRecords';

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function buildLongTermMemoryProfile(
  character: Pick<Character, 'id' | 'longTermMemoryProfile'>,
  options: {
    derivedLayers?: DerivedMemoryLayers;
  } = {},
): string | undefined {
  const derived = (options.derivedLayers ?? buildDerivedMemoryLayersFromRecords(character)).longTermMemoryProfile;
  if (derived) {
    return derived;
  }

  return normalizeOptionalText(character.longTermMemoryProfile);
}

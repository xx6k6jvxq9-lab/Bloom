import type { Character } from '../../types';
import { buildLongTermMemoryProfile } from './buildLongTermMemoryProfile';
import { buildShortTermSummary } from './buildShortTermSummary';
import type { ResolvedMemoryLayers } from './types';

export function buildResolvedMemoryLayers(
  character: Pick<Character, 'id' | 'shortTermSummary' | 'longTermMemoryProfile'>,
): ResolvedMemoryLayers {
  return {
    shortTermSummary: buildShortTermSummary(character),
    longTermMemoryProfile: buildLongTermMemoryProfile(character),
  };
}

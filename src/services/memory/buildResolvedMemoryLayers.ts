import type { Character } from '../../types';
import { buildLongTermMemoryProfile } from './buildLongTermMemoryProfile';
import { buildShortTermSummary } from './buildShortTermSummary';
import type { ResolvedMemoryLayers } from './types';

export function buildResolvedMemoryLayers(
  character: Pick<Character, 'shortTermSummary' | 'longTermMemoryProfile' | 'memorySummary'>,
): ResolvedMemoryLayers {
  return {
    shortTermSummary: buildShortTermSummary(character),
    longTermMemoryProfile: buildLongTermMemoryProfile(character),
  };
}

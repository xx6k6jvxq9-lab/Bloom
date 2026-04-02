import type { Character, CoupleSpaceData } from '../../types';
import { buildRecentCoupleSpaceSummary } from '../ai/couple-space/context/buildRecentCoupleSpaceSummary';
import { buildResolvedMemoryLayers } from '../memory/buildResolvedMemoryLayers';
import type { RelationshipProjection } from './types';

type BuildRelationshipProjectionInput = {
  character: Character;
  coupleSpace?: CoupleSpaceData;
  userName: string;
};

function shouldUseCoupleSpaceForCharacter(
  character: Character,
  coupleSpace?: CoupleSpaceData,
) {
  if (!coupleSpace?.partnerId) {
    return false;
  }

  return coupleSpace.partnerId === character.id;
}

export function buildRelationshipProjection(
  input: BuildRelationshipProjectionInput,
): RelationshipProjection {
  const memoryLayers = buildResolvedMemoryLayers(input.character);
  const recentCoupleSpaceSummary = shouldUseCoupleSpaceForCharacter(input.character, input.coupleSpace)
    ? buildRecentCoupleSpaceSummary({
        coupleSpace: input.coupleSpace!,
        user: { name: input.userName } as any,
        partner: input.character,
      }).recentCoupleSpaceSummary
    : undefined;

  return {
    characterScopedMemory: {
      shortTermSummary: memoryLayers.shortTermSummary,
      longTermMemoryProfile: memoryLayers.longTermMemoryProfile,
    },
    sceneScopedSignals: {
      recentCoupleSpaceSummary,
    },
  };
}

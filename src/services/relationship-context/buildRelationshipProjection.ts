import type { Character, CoupleSpaceData } from '../../types';
import { buildRecentCoupleSpaceSummary } from '../ai/couple-space/context/buildRecentCoupleSpaceSummary';
import { buildResolvedMemoryLayers } from '../memory/buildResolvedMemoryLayers';

export type RelationshipProjection = {
  shortTermSummary?: string;
  longTermMemoryProfile?: string;
  recentCoupleSpaceSummary?: string;
};

type BuildRelationshipProjectionInput = {
  character: Character;
  coupleSpace?: CoupleSpaceData;
  userName: string;
};

export function buildRelationshipProjection(
  input: BuildRelationshipProjectionInput,
): RelationshipProjection {
  const memoryLayers = buildResolvedMemoryLayers(input.character);
  const recentCoupleSpaceSummary = input.coupleSpace
    ? buildRecentCoupleSpaceSummary({
        coupleSpace: input.coupleSpace,
        user: { name: input.userName } as any,
        partner: input.character,
      }).recentCoupleSpaceSummary
    : undefined;

  return {
    shortTermSummary: memoryLayers.shortTermSummary,
    longTermMemoryProfile: memoryLayers.longTermMemoryProfile,
    recentCoupleSpaceSummary,
  };
}

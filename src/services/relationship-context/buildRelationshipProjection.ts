import type { Character, ChatMessage, ChatGroup, CoupleSpaceData } from '../../types';
import { buildRecentCoupleSpaceSummary } from '../ai/couple-space/context/buildRecentCoupleSpaceSummary';
import { buildResolvedMemoryLayers } from '../memory/buildResolvedMemoryLayers';
import { buildPublicAcquaintanceSummary, buildSharedRelationshipMemory } from './buildSharedRelationshipMemory';
import type { RelationshipProjection } from './types';

type BuildRelationshipProjectionInput = {
  character: Character;
  coupleSpace?: CoupleSpaceData;
  userName: string;
  directMessages?: ChatMessage[];
  groupMessages?: ChatMessage[];
  groupRelationshipWaves?: ChatGroup['relationshipWaves'];
  factTraces?: import('./factTypes').FactTraceRecord[];
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
  const sharedRecentRelationshipSummary = buildSharedRelationshipMemory({
    characterId: input.character.id,
    characterName: input.character.name,
    directMessages: input.directMessages,
    groupMessages: input.groupMessages,
    relationshipWaves: input.groupRelationshipWaves,
    factTraces: input.factTraces,
  });
  const publicAcquaintanceSummary = buildPublicAcquaintanceSummary({
    characterId: input.character.id,
    characterName: input.character.name,
    relationshipWaves: input.groupRelationshipWaves,
    factTraces: input.factTraces,
  });

  return {
    characterScopedMemory: {
      shortTermSummary: memoryLayers.shortTermSummary,
      longTermMemoryProfile: memoryLayers.longTermMemoryProfile,
    },
    sceneScopedSignals: {
      recentCoupleSpaceSummary,
      sharedRecentRelationshipSummary,
      publicAcquaintanceSummary,
    },
  };
}

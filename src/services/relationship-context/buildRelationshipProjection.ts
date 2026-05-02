import type { Character, ChatMessage, ChatGroup, CoupleSpaceData } from '../../types';
import { buildRecentCoupleSpaceSummary } from '../ai/couple-space/context/buildRecentCoupleSpaceSummary';
import { buildResolvedMemoryLayers } from '../memory/buildResolvedMemoryLayers';
import {
  buildPublicAcquaintanceSummary,
  buildRelationshipResidueItems,
  buildSceneResidueItems,
  buildSharedRelationshipMemory,
  buildTaskResidueItems,
  buildTopicAnchorItems,
} from './buildSharedRelationshipMemory';
import type { RelationshipProjection } from './types';

function mergeTypedItems<T extends { summary: string; timestamp: number }>(
  ...groups: Array<T[] | undefined>
): T[] | undefined {
  const merged = groups
    .flatMap((group) => group || [])
    .filter(Boolean)
    .filter((item, index, array) => (
      array.findIndex((candidate) => (
        candidate.summary.trim().toLowerCase() === item.summary.trim().toLowerCase()
      )) === index
    ))
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 6);

  return merged.length > 0 ? merged : undefined;
}

function mergeSummaryText(...values: Array<string | undefined>): string | undefined {
  const lines = values
    .flatMap((value) => (value || '').split(/\r?\n+/))
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return undefined;
  }

  return [...new Set(lines)].join('\n');
}

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
  const latestSharedSnapshots = (input.character.sharedContextSnapshots || []).slice(0, 4);
  const typedProjectionInput = {
    characterId: input.character.id,
    characterName: input.character.name,
    directMessages: input.directMessages,
    groupMessages: input.groupMessages,
    relationshipWaves: input.groupRelationshipWaves,
    factTraces: input.factTraces,
  };
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
      relationshipResidue: mergeTypedItems(
        buildRelationshipResidueItems(typedProjectionInput),
        ...latestSharedSnapshots.map((snapshot) => snapshot.relationshipResidue),
      ),
      sceneResidue: mergeTypedItems(
        buildSceneResidueItems(typedProjectionInput),
        ...latestSharedSnapshots.map((snapshot) => snapshot.sceneResidue),
      ),
      topicAnchors: mergeTypedItems(
        buildTopicAnchorItems(typedProjectionInput),
        ...latestSharedSnapshots.map((snapshot) => snapshot.topicAnchors),
      ),
      taskResidue: mergeTypedItems(
        buildTaskResidueItems(typedProjectionInput),
        ...latestSharedSnapshots.map((snapshot) => snapshot.taskResidue),
      ),
      recentCoupleSpaceSummary,
      sharedRecentRelationshipSummary: mergeSummaryText(
        sharedRecentRelationshipSummary,
        ...latestSharedSnapshots.map((snapshot) => (
          snapshot.relationshipResidue?.map((item) => item.summary).join('\n')
        )),
        ...latestSharedSnapshots.map((snapshot) => (
          snapshot.taskResidue?.map((item) => item.summary).join('\n')
        )),
        ...latestSharedSnapshots.map((snapshot) => (
          snapshot.topicAnchors?.map((item) => item.summary).join('\n')
        )),
      ),
      publicAcquaintanceSummary,
    },
  };
}

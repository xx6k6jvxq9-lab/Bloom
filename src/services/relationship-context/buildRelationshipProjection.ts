import type {
  Character,
  CharacterPublicThreadPeerHint,
  ChatMessage,
  ChatGroup,
  CoupleSpaceData,
} from '../../types';
import { buildRecentCoupleSpaceSummary } from '../ai/couple-space/context/buildRecentCoupleSpaceSummary';
import { buildResolvedMemoryLayers } from '../memory/buildResolvedMemoryLayers';
import { buildSceneSignalsFromRecords } from '../memory/sceneSignalRecords';
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

function resolvePrimaryTypedItems<T extends { summary: string; timestamp: number }>(
  primaryGroups: Array<T[] | undefined>,
  fallbackGroups: Array<T[] | undefined>,
): T[] | undefined {
  return mergeTypedItems(...primaryGroups) || mergeTypedItems(...fallbackGroups);
}

function resolvePrimarySummaryText(
  primaryValues: Array<string | undefined>,
  fallbackValues: Array<string | undefined>,
): string | undefined {
  return mergeSummaryText(...primaryValues) || mergeSummaryText(...fallbackValues);
}

type BuildRelationshipProjectionInput = {
  character: Character;
  characters?: Character[];
  chatGroups?: ChatGroup[];
  coupleSpace?: CoupleSpaceData;
  userName: string;
  directMessages?: ChatMessage[];
  groupMessages?: ChatMessage[];
  groupRelationshipWaves?: ChatGroup['relationshipWaves'];
  factTraces?: import('./factTypes').FactTraceRecord[];
};

const PUBLIC_THREAD_FAMILIARITY_LABELS = {
  stranger: 'not close in public',
  aware: 'aware of each other in public',
  familiar: 'fairly familiar in public',
} as const;

const PUBLIC_THREAD_STYLE_LABELS = {
  guarded: 'guarded',
  neutral: 'neutral',
  banter: 'banter-friendly',
  warm: 'warm',
} as const;

const PUBLIC_THREAD_MOMENT_POLICY_LABELS = {
  observe_only: 'moment observe only',
  allow_interaction: 'moment interaction allowed',
  block: 'moment interaction blocked',
} as const;

function compactPromptLine(value: string | undefined, maxLength = 72): string | undefined {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function getLatestPublicThreadHintUpdateAt(left: Character, right: Character): number {
  const leftUpdatedAt = left.publicThreadPeerHints
    ?.find((hint) => hint.targetCharacterId === right.id)
    ?.updatedAt || 0;
  const rightUpdatedAt = right.publicThreadPeerHints
    ?.find((hint) => hint.targetCharacterId === left.id)
    ?.updatedAt || 0;

  return Math.max(leftUpdatedAt, rightUpdatedAt);
}

function mergeExplicitPublicThreadHint(
  leftHint: CharacterPublicThreadPeerHint | null,
  rightHint: CharacterPublicThreadPeerHint | null,
) {
  if (!leftHint && !rightHint) {
    return null;
  }

  const familiarityOrder: Record<CharacterPublicThreadPeerHint['familiarity'], number> = {
    stranger: 0,
    aware: 1,
    familiar: 2,
  };
  const leftFamiliarity = leftHint?.familiarity || 'stranger';
  const rightFamiliarity = rightHint?.familiarity || 'stranger';
  const familiarity = familiarityOrder[leftFamiliarity] <= familiarityOrder[rightFamiliarity]
    ? leftFamiliarity
    : rightFamiliarity;

  const interactionStyleOrder: Record<NonNullable<CharacterPublicThreadPeerHint['interactionStyle']>, number> = {
    guarded: 0,
    neutral: 1,
    banter: 2,
    warm: 3,
  };
  const leftInteractionStyle = leftHint?.interactionStyle;
  const rightInteractionStyle = rightHint?.interactionStyle;
  const interactionStyle = leftInteractionStyle && rightInteractionStyle
    ? (interactionStyleOrder[leftInteractionStyle] <= interactionStyleOrder[rightInteractionStyle]
      ? leftInteractionStyle
      : rightInteractionStyle)
    : leftInteractionStyle
      || rightInteractionStyle;

  const mergeBoolean = (
    leftValue: boolean | undefined,
    rightValue: boolean | undefined,
  ) => {
    if (leftValue === false || rightValue === false) return false;
    if (leftValue === true || rightValue === true) return true;
    return undefined;
  };

  const interactionPolicyOrder: Record<NonNullable<CharacterPublicThreadPeerHint['momentInteractionPolicy']>, number> = {
    block: 0,
    observe_only: 1,
    allow_interaction: 2,
  };
  const leftMomentInteractionPolicy = leftHint?.momentInteractionPolicy;
  const rightMomentInteractionPolicy = rightHint?.momentInteractionPolicy;
  const momentInteractionPolicy = leftMomentInteractionPolicy && rightMomentInteractionPolicy
    ? (interactionPolicyOrder[leftMomentInteractionPolicy] <= interactionPolicyOrder[rightMomentInteractionPolicy]
      ? leftMomentInteractionPolicy
      : rightMomentInteractionPolicy)
    : leftMomentInteractionPolicy
      || rightMomentInteractionPolicy;
  const source = leftHint?.source === 'manual' || rightHint?.source === 'manual'
    ? 'manual' as const
    : leftHint?.source === 'moment_growth' || rightHint?.source === 'moment_growth'
      ? 'moment_growth' as const
      : 'manual' as const;

  return {
    familiarity,
    interactionStyle,
    allowBanter: mergeBoolean(leftHint?.allowBanter, rightHint?.allowBanter),
    allowIntimateTone: mergeBoolean(leftHint?.allowIntimateTone, rightHint?.allowIntimateTone),
    allowOwnershipTone: mergeBoolean(leftHint?.allowOwnershipTone, rightHint?.allowOwnershipTone),
    momentInteractionPolicy,
    source,
    note: Array.from(new Set([
      compactPromptLine(leftHint?.note, 72),
      compactPromptLine(rightHint?.note, 72),
    ].filter(Boolean))).join(' / ') || undefined,
  };
}

function buildExplicitPublicAcquaintanceSummary(input: {
  character: Character;
  characters?: Character[];
}): string | undefined {
  const { character, characters = [] } = input;
  if (characters.length === 0) {
    return undefined;
  }

  const peerCandidates = characters.filter((peer) => {
    if (peer.id === character.id) {
      return false;
    }

    const currentCharacterHasHint = character.publicThreadPeerHints
      ?.some((hint) => hint.targetCharacterId === peer.id);
    const peerHasHint = peer.publicThreadPeerHints
      ?.some((hint) => hint.targetCharacterId === character.id);

    return !!(currentCharacterHasHint || peerHasHint);
  });

  const explicitLines = peerCandidates
    .map((peer) => {
      const explicitHint = mergeExplicitPublicThreadHint(
        character.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === peer.id) || null,
        peer.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === character.id) || null,
      );
      if (!explicitHint) {
        return null;
      }

      const parts = [
        PUBLIC_THREAD_FAMILIARITY_LABELS[explicitHint.familiarity],
        explicitHint.interactionStyle ? `style ${PUBLIC_THREAD_STYLE_LABELS[explicitHint.interactionStyle]}` : '',
        explicitHint.allowBanter === true ? 'banter ok' : explicitHint.allowBanter === false ? 'banter no' : '',
        explicitHint.allowIntimateTone === true ? 'intimate ok' : explicitHint.allowIntimateTone === false ? 'intimate no' : '',
        explicitHint.allowOwnershipTone === true ? 'ownership ok' : explicitHint.allowOwnershipTone === false ? 'ownership no' : '',
        explicitHint.momentInteractionPolicy
          ? PUBLIC_THREAD_MOMENT_POLICY_LABELS[explicitHint.momentInteractionPolicy]
          : '',
      ].filter(Boolean);
      const note = explicitHint.note;
      const specificityScore =
        (explicitHint.familiarity === 'familiar' ? 2 : explicitHint.familiarity === 'aware' ? 1 : 0)
        + (explicitHint.interactionStyle ? 1 : 0)
        + (explicitHint.allowBanter !== undefined ? 1 : 0)
        + (explicitHint.allowIntimateTone !== undefined ? 1 : 0)
        + (explicitHint.allowOwnershipTone !== undefined ? 1 : 0)
        + (explicitHint.momentInteractionPolicy ? 1 : 0)
        + (note ? 2 : 0);

      return {
        specificityScore,
        updatedAt: getLatestPublicThreadHintUpdateAt(character, peer),
        line: `${
          explicitHint.source === 'moment_growth'
            ? `Moment-grown public relation with ${peer.name}:`
            : `Manual public relation override with ${peer.name}:`
        } ${parts.join('; ')}${note ? `; note ${note}` : ''}.`,
      };
    })
    .filter((item): item is { specificityScore: number; updatedAt: number; line: string } => item !== null)
    .sort((left, right) => (
      right.specificityScore - left.specificityScore
      || right.updatedAt - left.updatedAt
      || left.line.localeCompare(right.line)
    ))
    .slice(0, 6)
    .map((item) => item.line);

  return explicitLines.length > 0 ? explicitLines.join('\n') : undefined;
}

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
  const recordSignals = buildSceneSignalsFromRecords({
    characterId: input.character.id,
  });
  const typedProjectionInput = {
    characterId: input.character.id,
    characterName: input.character.name,
    directMessages: input.directMessages,
    groupMessages: input.groupMessages,
    relationshipWaves: input.groupRelationshipWaves,
    factTraces: input.factTraces,
  };
  const derivedRelationshipResidue = buildRelationshipResidueItems(typedProjectionInput);
  const compatibilityRelationshipResidue = latestSharedSnapshots.map((snapshot) => snapshot.relationshipResidue);
  const derivedSceneResidue = buildSceneResidueItems(typedProjectionInput);
  const compatibilitySceneResidue = latestSharedSnapshots.map((snapshot) => snapshot.sceneResidue);
  const derivedTopicAnchors = buildTopicAnchorItems(typedProjectionInput);
  const compatibilityTopicAnchors = latestSharedSnapshots.map((snapshot) => snapshot.topicAnchors);
  const derivedTaskResidue = buildTaskResidueItems(typedProjectionInput);
  const compatibilityTaskResidue = latestSharedSnapshots.map((snapshot) => snapshot.taskResidue);
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
  const publicAcquaintanceSummary = mergeSummaryText(
    buildExplicitPublicAcquaintanceSummary({
      character: input.character,
      characters: input.characters,
    }),
    buildPublicAcquaintanceSummary({
      characterId: input.character.id,
      characterName: input.character.name,
      relationshipWaves: input.groupRelationshipWaves,
      factTraces: input.factTraces,
    }),
  );

  return {
    characterScopedMemory: {
      shortTermSummary: memoryLayers.shortTermSummary,
      longTermMemoryProfile: memoryLayers.longTermMemoryProfile,
      diagnostics: memoryLayers.diagnostics,
    },
    sceneScopedSignals: {
      relationshipResidue: resolvePrimaryTypedItems(
        [derivedRelationshipResidue, recordSignals.relationshipResidue],
        compatibilityRelationshipResidue,
      ),
      sceneResidue: resolvePrimaryTypedItems(
        [derivedSceneResidue, recordSignals.sceneResidue],
        compatibilitySceneResidue,
      ),
      topicAnchors: resolvePrimaryTypedItems(
        [derivedTopicAnchors, recordSignals.topicAnchors],
        compatibilityTopicAnchors,
      ),
      taskResidue: resolvePrimaryTypedItems(
        [derivedTaskResidue, recordSignals.taskResidue],
        compatibilityTaskResidue,
      ),
      compatibilitySnapshotCount: latestSharedSnapshots.length,
      recentCoupleSpaceSummary,
      sharedRecentRelationshipSummary: resolvePrimarySummaryText(
        [sharedRecentRelationshipSummary, ...recordSignals.summaryLines],
        [
          ...latestSharedSnapshots.map((snapshot) => (
            snapshot.relationshipResidue?.map((item) => item.summary).join('\n')
          )),
          ...latestSharedSnapshots.map((snapshot) => (
            snapshot.taskResidue?.map((item) => item.summary).join('\n')
          )),
          ...latestSharedSnapshots.map((snapshot) => (
            snapshot.topicAnchors?.map((item) => item.summary).join('\n')
          )),
        ],
      ),
      publicAcquaintanceSummary,
    },
  };
}

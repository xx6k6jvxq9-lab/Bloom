import type {
  GroupOfflineRoundDispatchMode,
  GroupOfflineSession,
  GroupOfflineTargetRef,
} from '../../types';
import type {
  GroupOfflineCharacterRuntimeProjection,
  GroupOfflineRoundPlan,
  GroupOfflineRoundPlanCharacterStep,
  GroupOfflineRuntimeProjection,
} from './types';

type BuildGroupOfflineRoundPlanInput = {
  session: GroupOfflineSession;
  projection: GroupOfflineRuntimeProjection;
  selectedCharacterIds?: string[];
  dispatchMode?: GroupOfflineRoundDispatchMode;
  latestUserMessage?: string;
  userMessageText?: string;
};

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function scorePeerRelation(summary: string, familiarityLabel?: string, interactionStyleLabel?: string) {
  let score = 0;
  if (familiarityLabel?.includes('偏熟') || familiarityLabel?.includes('已经熟')) score += 3;
  else if (familiarityLabel?.includes('知道')) score += 2;
  if (interactionStyleLabel?.includes('热') || interactionStyleLabel?.includes('打趣')) score += 2;
  else if (interactionStyleLabel?.includes('中性')) score += 1;
  if (/最近|同场|来回|接话/.test(summary)) score += 1;
  return score;
}

function extractMentionedCharacterIds(text: string | undefined, projection: GroupOfflineRuntimeProjection): string[] {
  const normalized = normalizeOptionalText(text);
  if (!normalized) return [];
  return projection.characters
    .filter((character) => (
      [character.identity.name, character.identity.displayName, character.identity.remarkName]
        .filter(Boolean)
        .some((alias) => normalized.includes(alias!))
    ))
    .map((character) => character.identity.characterId);
}

function resolveTarget(input: {
  index: number;
  selectedCharacterIds: string[];
  character: GroupOfflineCharacterRuntimeProjection;
  userName: string;
  latestUserMessage?: string;
  userMessageText?: string;
  projection: GroupOfflineRuntimeProjection;
}): GroupOfflineTargetRef {
  const mentionedIds = extractMentionedCharacterIds(input.latestUserMessage || input.userMessageText, input.projection)
    .filter((characterId) => characterId !== input.character.identity.characterId);
  if (mentionedIds.length > 0) {
    const mentioned = input.projection.characters.find((character) => character.identity.characterId === mentionedIds[0]);
    if (mentioned) {
      return {
        type: 'character',
        label: mentioned.identity.displayName,
        characterId: mentioned.identity.characterId,
      };
    }
  }

  if (normalizeOptionalText(input.userMessageText) && input.index === 0) {
    return {
      type: 'user',
      label: input.userName,
    };
  }

  const strongestPeer = [...input.character.peerRelations]
    .sort((left, right) => (
      scorePeerRelation(right.summary, right.familiarityLabel, right.interactionStyleLabel)
      - scorePeerRelation(left.summary, left.familiarityLabel, left.interactionStyleLabel)
    ))[0];
  if (strongestPeer) {
    return {
      type: 'character',
      label: strongestPeer.peerName,
      characterId: strongestPeer.peerCharacterId,
    };
  }

  const previousSelected = input.index > 0
    ? input.projection.characters.find((character) => character.identity.characterId === input.selectedCharacterIds[input.index - 1])
    : null;
  if (previousSelected) {
    return {
      type: 'character',
      label: previousSelected.identity.displayName,
      characterId: previousSelected.identity.characterId,
    };
  }

  if (input.selectedCharacterIds.length > 1) {
    const nextSelected = input.projection.characters.find((character) => character.identity.characterId === input.selectedCharacterIds[(input.index + 1) % input.selectedCharacterIds.length]);
    if (nextSelected && nextSelected.identity.characterId !== input.character.identity.characterId) {
      return {
        type: 'character',
        label: nextSelected.identity.displayName,
        characterId: nextSelected.identity.characterId,
      };
    }
  }

  return {
    type: 'group',
    label: '全场',
  };
}

function normalizeGenerationMode(mode: GroupOfflineSession['generationMode']): 'blocks' | 'ensemble' {
  return mode === 'ensemble' || mode === 'group' ? 'ensemble' : 'blocks';
}

function resolvePlanSummary(input: {
  dispatchMode?: GroupOfflineRoundDispatchMode;
  generationMode: 'blocks' | 'ensemble';
  selectedCharacters: GroupOfflineCharacterRuntimeProjection[];
}): string {
  const orderedNames = input.selectedCharacters.map((character) => character.identity.displayName).join(' -> ');
  if (!orderedNames) {
    return input.generationMode === 'ensemble'
      ? '本轮继续同场，但暂时还没有明确的在场角色顺序。'
      : '本轮暂时还没有可用的出场顺序。';
  }
  if (input.generationMode === 'ensemble') {
    return `本轮继续同场，当前在场角色是：${input.selectedCharacters.map((character) => character.identity.displayName).join('、')}。`;
  }
  if (input.dispatchMode === 'manual') {
    return `本轮按手动顺序出场：${orderedNames}。`;
  }
  if (input.dispatchMode === 'random') {
    return `本轮按随机结果出场：${orderedNames}。`;
  }
  return `本轮按系统调度出场：${orderedNames}。`;
}

export function buildGroupOfflineRoundPlan(
  input: BuildGroupOfflineRoundPlanInput,
): GroupOfflineRoundPlan {
  const generationMode = normalizeGenerationMode(input.session.generationMode);
  const selectedCharacterIds = (input.selectedCharacterIds?.length
    ? input.selectedCharacterIds
    : input.projection.characters.map((character) => character.identity.characterId))
    .filter((characterId, index, array) => array.indexOf(characterId) === index);
  const selectedCharacters = selectedCharacterIds
    .map((characterId) => input.projection.characters.find((character) => character.identity.characterId === characterId))
    .filter((character): character is GroupOfflineCharacterRuntimeProjection => !!character);

  const characterSteps: GroupOfflineRoundPlanCharacterStep[] = selectedCharacters.map((character, index) => {
    return {
      characterId: character.identity.characterId,
      speakerLabel: character.identity.displayName,
      target: resolveTarget({
        index,
        selectedCharacterIds,
        character,
        userName: input.projection.userName,
        latestUserMessage: input.latestUserMessage,
        userMessageText: input.userMessageText,
        projection: input.projection,
      }),
    };
  });

  return {
    generationMode,
    dispatchMode: input.dispatchMode,
    selectedCharacterIds,
    summary: resolvePlanSummary({
      dispatchMode: input.dispatchMode,
      generationMode,
      selectedCharacters,
    }),
    characterSteps,
  };
}

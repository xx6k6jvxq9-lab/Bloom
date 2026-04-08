import type { Character, ChatGroup, ChatHistory, CoupleSpaceData, Mask, WorldBookEntry } from '../../types';
import type { BuildChatPromptOptions } from '../ai/prompts/builders/buildChatPrompt';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildRelationshipProjection } from '../relationship-context/buildRelationshipProjection';
import type { ChatRecentContext, UserGlobalContext } from '../relationship-context/types';
import { applyChatPromptBudget } from './buildChatPromptBudget';

type BuildChatSceneInputParams = {
  character: Character;
  userName: string;
  coupleSpace?: CoupleSpaceData;
  activeMask?: Mask | null;
  activeWorldBooks?: WorldBookEntry[];
  perceptionPrompt?: string;
  mode?: BuildChatPromptOptions['mode'];
  includeProtocolRules?: boolean;
  directChatHistory?: ChatHistory;
  chatGroups?: ChatGroup[];
};

function getDirectMemoryReadableGroups(
  chatGroups: ChatGroup[] | undefined,
  characterId: string,
): ChatGroup[] {
  return (chatGroups || []).filter((group) => (
    group.allowDirectMemoryInterop !== false
    && Array.isArray(group.memberIds)
    && group.memberIds.includes(characterId)
  ));
}

function buildExtraSections(input: {
  expressionStyle?: string;
  boundaryPack?: string;
  extendedLore?: string;
  chatSceneHint?: string;
}): string[] {
  return [
    input.expressionStyle
      ? ['## 表达风格与互动手感', input.expressionStyle].join('\n')
      : '',
    input.boundaryPack
      ? ['## 边界与禁区', input.boundaryPack].join('\n')
      : '',
    input.extendedLore
      ? ['## 扩展背景与长期补充', input.extendedLore].join('\n')
      : '',
    input.chatSceneHint
      ? ['## 当前聊天场景补充', input.chatSceneHint].join('\n')
      : '',
  ].filter(Boolean);
}

export function buildChatSceneInput(
  params: BuildChatSceneInputParams,
): BuildChatPromptOptions {
  const directMemoryReadableGroups = getDirectMemoryReadableGroups(
    params.chatGroups,
    params.character.id,
  );
  const characterContext = buildCharacterContext({
    character: params.character,
    activeMask: params.activeMask,
    activeWorldBooks: params.activeWorldBooks,
  });
  const relationshipProjection = buildRelationshipProjection({
    character: params.character,
    coupleSpace: params.coupleSpace,
    userName: params.userName,
    directMessages: params.directChatHistory?.[params.character.id] || [],
    groupMessages: directMemoryReadableGroups
      .flatMap((group) => group.history || [])
      .filter((message) => message.role === 'user' || message.senderCharacterId === params.character.id),
    groupRelationshipWaves: directMemoryReadableGroups
      .flatMap((group) => group.relationshipWaves || [])
      .filter((wave) => wave.scope === 'cross_scene_readable'),
    factTraces: directMemoryReadableGroups
      .flatMap((group) => group.factTraces || [])
      .filter((factTrace) => factTrace.visibility === 'cross_scene_readable'),
  });
  const { characterScopedMemory, sceneScopedSignals } = relationshipProjection;
  const userContext: UserGlobalContext = {
    userName: params.userName,
  };
  const recentContext: ChatRecentContext = {
    shortTermSummary: characterScopedMemory.shortTermSummary,
    recentCoupleSpaceSummary: sceneScopedSignals.recentCoupleSpaceSummary,
    sharedRecentRelationshipSummary: sceneScopedSignals.sharedRecentRelationshipSummary,
    publicAcquaintanceSummary: sceneScopedSignals.publicAcquaintanceSummary,
  };
  const budgetedContext = applyChatPromptBudget({
    recentContext,
    sections: buildExtraSections({
      expressionStyle: characterContext.expressionStyle,
      boundaryPack: characterContext.boundaryPack,
      extendedLore: characterContext.extendedLore,
      chatSceneHint: characterContext.sceneHints?.chat,
    }),
  });

  return {
    mode: params.mode,
    includeProtocolRules: params.includeProtocolRules,
    characterCore: {
      characterSetting: characterContext.corePersona ?? '',
      maskPrompt: characterContext.maskPrompt,
      worldBookPrompt: characterContext.worldBookPrompt,
    },
    userContext,
    memoryContext: {
      longTermMemoryProfile: characterScopedMemory.longTermMemoryProfile ?? '',
      perceptionPrompt: params.perceptionPrompt,
    },
    recentContext: budgetedContext.recentContext,
    sections: budgetedContext.sections,
  };
}

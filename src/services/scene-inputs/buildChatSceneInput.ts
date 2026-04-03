import type { Character, CoupleSpaceData, Mask, WorldBookEntry } from '../../types';
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
};

function buildExtraSections(input: {
  expressionStyle?: string;
  extendedLore?: string;
  chatSceneHint?: string;
}): string[] {
  const sections = [
    input.expressionStyle
      ? ['## 表达风格与互动手感', input.expressionStyle].join('\n')
      : '',
    input.extendedLore
      ? ['## 扩展背景与长期补充', input.extendedLore].join('\n')
      : '',
    input.chatSceneHint
      ? ['## 当前聊天场景补充', input.chatSceneHint].join('\n')
      : '',
  ].filter(Boolean);

  return sections;
}

export function buildChatSceneInput(
  params: BuildChatSceneInputParams,
): BuildChatPromptOptions {
  const characterContext = buildCharacterContext({
    character: params.character,
    activeMask: params.activeMask,
    activeWorldBooks: params.activeWorldBooks,
  });
  const relationshipProjection = buildRelationshipProjection({
    character: params.character,
    coupleSpace: params.coupleSpace,
    userName: params.userName,
  });
  const { characterScopedMemory, sceneScopedSignals } = relationshipProjection;
  const userContext: UserGlobalContext = {
    userName: params.userName,
  };
  const recentContext: ChatRecentContext = {
    shortTermSummary: characterScopedMemory.shortTermSummary,
    recentCoupleSpaceSummary: sceneScopedSignals.recentCoupleSpaceSummary,
  };
  const budgetedContext = applyChatPromptBudget({
    recentContext,
    sections: buildExtraSections({
      expressionStyle: characterContext.expressionStyle,
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

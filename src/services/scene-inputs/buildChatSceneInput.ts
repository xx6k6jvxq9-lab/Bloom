import type { Character, CoupleSpaceData, Mask, WorldBookEntry } from '../../types';
import type { BuildChatPromptOptions } from '../ai/prompts/builders/buildChatPrompt';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { buildRelationshipProjection } from '../relationship-context/buildRelationshipProjection';

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
  extendedLore?: string;
  chatSceneHint?: string;
  shortTermSummary?: string;
}): string[] {
  const sections = [
    input.extendedLore
      ? ['## 扩展背景与长期补充', input.extendedLore].join('\n')
      : '',
    input.chatSceneHint
      ? ['## 当前聊天场景补充', input.chatSceneHint].join('\n')
      : '',
    input.shortTermSummary
      ? ['## 近期关系余波', input.shortTermSummary].join('\n')
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

  return {
    mode: params.mode,
    includeProtocolRules: params.includeProtocolRules,
    characterCore: {
      characterSetting: characterContext.corePersona ?? '',
      maskPrompt: characterContext.maskPrompt,
      worldBookPrompt: characterContext.worldBookPrompt,
    },
    userContext: {
      userName: params.userName,
    },
    memoryContext: {
      memorySummary: characterScopedMemory.longTermMemoryProfile ?? '',
      perceptionPrompt: params.perceptionPrompt,
    },
    recentCoupleSpaceSummary: sceneScopedSignals.recentCoupleSpaceSummary,
    sections: buildExtraSections({
      extendedLore: characterContext.extendedLore,
      chatSceneHint: characterContext.sceneHints?.chat,
      shortTermSummary: characterScopedMemory.shortTermSummary,
    }),
  };
}

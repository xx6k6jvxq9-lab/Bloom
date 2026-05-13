import type { Character } from '../../types';
import { buildPublicPersonaGuide } from '../../services/ai/prompts/character/buildPublicPersonaGuide';
import { buildResolvedMemoryLayers } from '../../services/memory/buildResolvedMemoryLayers';
import { buildCharacterContext } from '../../services/relationship-context/buildCharacterContext';

export type ForumCharacterContext = {
  corePersona: string;
  expressionStyle: string;
  forumSceneHint: string;
  signature: string;
  openingRemark: string;
  publicPersonaGuide: string;
  longTermMemoryProfile: string;
  globalMemory: string;
  fingerprint: string;
};

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() || '';
}

export function buildForumCharacterContext(character: Character): ForumCharacterContext {
  const characterContext = buildCharacterContext({ character });
  const memoryLayers = buildResolvedMemoryLayers(character);

  const corePersona = normalizeOptionalText(characterContext.corePersona);
  const expressionStyle = normalizeOptionalText(characterContext.expressionStyle);
  const forumSceneHint = normalizeOptionalText(character.sceneHints?.forum);
  const signature = normalizeOptionalText(character.signature);
  const openingRemark = normalizeOptionalText(character.openingRemark);
  const publicPersonaGuide = buildPublicPersonaGuide({
    corePersona,
    expressionStyle,
    boundaryPack: characterContext.boundaryPack,
    extendedLore: characterContext.extendedLore,
    signature,
    openingRemark,
  });
  const longTermMemoryProfile = normalizeOptionalText(memoryLayers.longTermMemoryProfile);
  const globalMemory = normalizeOptionalText(character.globalMemory);

  return {
    corePersona,
    expressionStyle,
    forumSceneHint,
    signature,
    openingRemark,
    publicPersonaGuide,
    longTermMemoryProfile,
    globalMemory,
    fingerprint: [
      character.name,
      normalizeOptionalText(character.remarkName),
      signature,
      corePersona,
      expressionStyle,
      forumSceneHint,
      longTermMemoryProfile,
      globalMemory,
    ].filter(Boolean).join(' '),
  };
}

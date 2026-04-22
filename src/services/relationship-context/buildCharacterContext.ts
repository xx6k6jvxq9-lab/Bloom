import type { Character, Mask, WorldBookEntry } from '../../types';
import type { CharacterContext } from './types';
import { buildBudgetedWorldBookPrompt } from '../world-book/worldBookBudget';

type BuildCharacterContextInput = {
  character: Character;
  activeMask?: Mask | null;
  activeWorldBooks?: WorldBookEntry[];
};

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildMaskPrompt(mask?: Mask | null): string | undefined {
  if (!mask) return undefined;

  const parts = [
    mask.name ? `Name: ${mask.name}` : '',
    mask.personality ? `Personality: ${mask.personality}` : '',
    mask.occupation ? `Occupation: ${mask.occupation}` : '',
    mask.relationship ? `Relationship with you: ${mask.relationship}` : '',
    mask.worldBackground ? `World Background: ${mask.worldBackground}` : '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join('\n') : undefined;
}

function buildWorldBookPrompt(worldBooks: WorldBookEntry[] | undefined): string | undefined {
  return buildBudgetedWorldBookPrompt(worldBooks, 'direct');
}

function normalizeSceneHints(value: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!value) return undefined;

  const entries = Object.entries(value)
    .map(([key, hint]) => [key, normalizeOptionalText(hint)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function buildCharacterContext(input: BuildCharacterContextInput): CharacterContext {
  const corePersona = normalizeOptionalText(input.character.corePersona)
    ?? normalizeOptionalText(input.character.setting);

  return {
    corePersona,
    expressionStyle: normalizeOptionalText(input.character.expressionStyle),
    boundaryPack: normalizeOptionalText(input.character.boundaryPack),
    extendedLore: normalizeOptionalText(input.character.extendedLore),
    sceneHints: normalizeSceneHints(input.character.sceneHints),
    maskPrompt: buildMaskPrompt(input.activeMask),
    worldBookPrompt: buildWorldBookPrompt(input.activeWorldBooks),
  };
}

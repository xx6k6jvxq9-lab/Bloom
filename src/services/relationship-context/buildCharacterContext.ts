import type { Character, Mask, WorldBookEntry } from '../../types';
import type { CharacterContext } from './types';

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
  if (!worldBooks || worldBooks.length === 0) return undefined;

  const sections = worldBooks
    .map((entry) => {
      const title = normalizeOptionalText(entry.title);
      const content = normalizeOptionalText(entry.content);

      if (!title || !content) return '';
      return `[${entry.category}] ${title}:\n${content}`;
    })
    .filter(Boolean);

  return sections.length > 0 ? sections.join('\n\n') : undefined;
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
    extendedLore: normalizeOptionalText(input.character.extendedLore),
    sceneHints: normalizeSceneHints(input.character.sceneHints),
    maskPrompt: buildMaskPrompt(input.activeMask),
    worldBookPrompt: buildWorldBookPrompt(input.activeWorldBooks),
  };
}

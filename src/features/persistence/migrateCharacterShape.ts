import type { Character } from '../../types';
import { CHARACTER_SCHEMA_VERSION } from './schemaVersions';

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeSceneHints(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, hint]) => [key, normalizeOptionalText(hint)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function migrateZhouJibaiBoundaryPack(input: {
  characterId: string;
  expressionStyle?: string;
  boundaryPack?: string;
}): {
  expressionStyle?: string;
  boundaryPack?: string;
} {
  const expressionStyle = normalizeOptionalText(input.expressionStyle);
  const boundaryPack = normalizeOptionalText(input.boundaryPack);

  if (input.characterId !== 'char-zhou-jibai' || !expressionStyle) {
    return { expressionStyle, boundaryPack };
  }

  const rulePattern = /(?:^|\n)\s*注意[:：]?\s*不会说脏话\s*(?=\n|$)/;
  const matchedRule = expressionStyle.match(rulePattern)?.[0];

  if (!matchedRule) {
    return { expressionStyle, boundaryPack };
  }

  const cleanedExpressionStyle = normalizeOptionalText(
    expressionStyle
      .replace(rulePattern, '\n')
      .replace(/\n{3,}/g, '\n\n'),
  );
  const normalizedRule = '不会说脏话';
  const mergedBoundaryPack = normalizeOptionalText(
    [boundaryPack, normalizedRule].filter(Boolean).join('\n'),
  );

  return {
    expressionStyle: cleanedExpressionStyle,
    boundaryPack: mergedBoundaryPack,
  };
}

export function migrateCharacterShape(character: Character): Character {
  const corePersona = normalizeOptionalText(character.corePersona)
    ?? normalizeOptionalText(character.setting);
  const zhouJibaiSections = migrateZhouJibaiBoundaryPack({
    characterId: character.id,
    expressionStyle: character.expressionStyle,
    boundaryPack: character.boundaryPack,
  });
  const expressionStyle = zhouJibaiSections.expressionStyle;
  const boundaryPack = zhouJibaiSections.boundaryPack;
  const extendedLore = normalizeOptionalText(character.extendedLore);
  const longTermMemoryProfile = normalizeOptionalText(character.longTermMemoryProfile)
    ?? normalizeOptionalText(character.memorySummary);
  const shortTermSummary = normalizeOptionalText(character.shortTermSummary);
  const sceneHints = normalizeSceneHints(character.sceneHints);

  return {
    ...character,
    corePersona,
    expressionStyle,
    boundaryPack,
    extendedLore,
    sceneHints,
    shortTermSummary,
    longTermMemoryProfile,
  };
}

export function migrateCharacterShapes(characters: Character[] | null | undefined): Character[] {
  if (!Array.isArray(characters)) return [];
  return characters.map(migrateCharacterShape);
}

export function getCharacterSchemaVersion(): number {
  return CHARACTER_SCHEMA_VERSION;
}

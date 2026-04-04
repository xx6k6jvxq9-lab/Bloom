import type { Character } from '../../types';
import { CHARACTER_SCHEMA_VERSION } from './schemaVersions';

const EXPRESSION_TO_BOUNDARY_PATTERNS = [
  /(?:^|\n)\s*注意[:：]?\s*不会说脏话\s*(?=\n|$)/g,
] as const;

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

function moveBoundaryRulesOutOfExpressionStyle(input: {
  expressionStyle?: string;
  boundaryPack?: string;
}): {
  expressionStyle?: string;
  boundaryPack?: string;
} {
  const expressionStyle = normalizeOptionalText(input.expressionStyle);
  const boundaryPack = normalizeOptionalText(input.boundaryPack);

  if (!expressionStyle) {
    return { expressionStyle, boundaryPack };
  }

  const movedRules = EXPRESSION_TO_BOUNDARY_PATTERNS
    .flatMap((pattern) => expressionStyle.match(pattern) ?? [])
    .map((value) => normalizeOptionalText(value.replace(/^注意[:：]?\s*/, '')))
    .filter((value): value is string => Boolean(value));

  if (movedRules.length === 0) {
    return { expressionStyle, boundaryPack };
  }

  const cleanedExpressionStyle = normalizeOptionalText(
    EXPRESSION_TO_BOUNDARY_PATTERNS.reduce(
      (current, pattern) => current.replace(pattern, '\n'),
      expressionStyle,
    ).replace(/\n{3,}/g, '\n\n'),
  );

  const mergedBoundaryPack = normalizeOptionalText(
    [boundaryPack, ...movedRules]
      .filter(Boolean)
      .join('\n'),
  );

  return {
    expressionStyle: cleanedExpressionStyle,
    boundaryPack: mergedBoundaryPack,
  };
}

export function migrateCharacterShape(character: Character): Character {
  const corePersona = normalizeOptionalText(character.corePersona)
    ?? normalizeOptionalText(character.setting);
  const normalizedSections = moveBoundaryRulesOutOfExpressionStyle({
    expressionStyle: character.expressionStyle,
    boundaryPack: character.boundaryPack,
  });
  const expressionStyle = normalizedSections.expressionStyle;
  const boundaryPack = normalizedSections.boundaryPack;
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

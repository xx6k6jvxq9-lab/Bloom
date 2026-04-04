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

const EXPRESSION_STYLE_SECTION_HEADERS = [
  '活人感细节：',
  '相处模式：',
  '经典状态关键词：',
  '核心感觉：',
] as const;

const BOUNDARY_PACK_SECTION_HEADERS = [
  '边界与禁忌：',
  '边界：',
  '禁忌：',
  '不能越线的内容：',
  '不可违背点：',
] as const;

function extractSectionBlock(source: string, header: string): string | undefined {
  const startIndex = source.indexOf(header);
  if (startIndex < 0) return undefined;

  const allHeaders = [...EXPRESSION_STYLE_SECTION_HEADERS, ...BOUNDARY_PACK_SECTION_HEADERS];
  const nextIndex = allHeaders
    .map((candidate) => source.indexOf(candidate, startIndex + header.length))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  const block = source.slice(startIndex, nextIndex ?? source.length).trim();
  return block || undefined;
}

function extractExpressionStyleSections(source: string | undefined): string | undefined {
  if (!source) return undefined;

  const sections = EXPRESSION_STYLE_SECTION_HEADERS
    .map((header) => extractSectionBlock(source, header))
    .filter((value): value is string => Boolean(value));

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}

function extractBoundaryPackSections(source: string | undefined): string | undefined {
  if (!source) return undefined;

  const sections = BOUNDARY_PACK_SECTION_HEADERS
    .map((header) => extractSectionBlock(source, header))
    .filter((value): value is string => Boolean(value));

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}

function stripExpressionStyleSections(source: string | undefined): string | undefined {
  if (!source) return undefined;

  const stripped = EXPRESSION_STYLE_SECTION_HEADERS.reduce((current, header) => {
    const block = extractSectionBlock(current, header);
    return block ? current.replace(block, '').trim() : current;
  }, source);

  const normalized = stripped
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return normalized || undefined;
}

function stripBoundaryPackSections(source: string | undefined): string | undefined {
  if (!source) return undefined;

  const stripped = BOUNDARY_PACK_SECTION_HEADERS.reduce((current, header) => {
    const block = extractSectionBlock(current, header);
    return block ? current.replace(block, '').trim() : current;
  }, source);

  const normalized = stripped
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return normalized || undefined;
}

export function migrateCharacterShape(character: Character): Character {
  const basePersonaSource = normalizeOptionalText(character.corePersona)
    ?? normalizeOptionalText(character.setting);
  const expressionStyle = normalizeOptionalText(character.expressionStyle)
    ?? extractExpressionStyleSections(basePersonaSource);
  const boundaryPack = normalizeOptionalText(character.boundaryPack)
    ?? extractBoundaryPackSections(basePersonaSource);
  const corePersona = stripBoundaryPackSections(stripExpressionStyleSections(basePersonaSource));
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

import type { Character, MemoryLibraryEntry } from '../../types';
import { normalizeMemoryLibraryEntries } from '../../services/memory/memoryLibrary';
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

function createLegacyShortTermMemoryEntry(character: Character, content: string): MemoryLibraryEntry {
  const createdAt = Number.isFinite(character.lastTime) ? Math.max(0, Math.floor(character.lastTime as number)) : Date.now();
  const date = new Date(createdAt);

  return {
    id: `memory-short-term-legacy-${character.id}`,
    kind: 'short-term',
    source: 'auto',
    content,
    createdAt,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    charCount: content.length,
  };
}

export function migrateCharacterShape(character: Character): Character {
  const corePersona = normalizeOptionalText(character.corePersona)
    ?? normalizeOptionalText(character.setting);
  const expressionStyle = normalizeOptionalText(character.expressionStyle);
  const boundaryPack = normalizeOptionalText(character.boundaryPack);
  const extendedLore = normalizeOptionalText(character.extendedLore);
  const longTermMemoryProfile = normalizeOptionalText(character.longTermMemoryProfile)
    ?? normalizeOptionalText(character.memorySummary);
  const shortTermSummary = normalizeOptionalText(character.shortTermSummary);
  const sceneHints = normalizeSceneHints(character.sceneHints);
  let memoryLibraryEntries = normalizeMemoryLibraryEntries(character.memoryLibraryEntries);
  if (
    shortTermSummary &&
    !(memoryLibraryEntries ?? []).some((entry) => entry.kind === 'short-term')
  ) {
    memoryLibraryEntries = [
      createLegacyShortTermMemoryEntry(character, shortTermSummary),
      ...(memoryLibraryEntries ?? []),
    ].sort((left, right) => right.createdAt - left.createdAt);
  }

  return {
    ...character,
    corePersona,
    expressionStyle,
    boundaryPack,
    extendedLore,
    sceneHints,
    shortTermSummary,
    longTermMemoryProfile,
    memoryLibraryEntries,
  };
}

export function migrateCharacterShapes(characters: Character[] | null | undefined): Character[] {
  if (!Array.isArray(characters)) return [];
  return characters.map(migrateCharacterShape);
}

export function getCharacterSchemaVersion(): number {
  return CHARACTER_SCHEMA_VERSION;
}

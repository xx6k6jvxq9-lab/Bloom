import type { Character, CharacterAvatarLibraryEntry, MemoryLibraryEntry } from '../../types';
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

function normalizeAvatarLibraryEntries(value: unknown): CharacterAvatarLibraryEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const entries = value
    .map((entry): CharacterAvatarLibraryEntry | null => {
      if (!entry || typeof entry !== 'object') return null;

      const record = entry as Record<string, unknown>;
      const image = normalizeOptionalText(record.image);
      if (!image) return null;

      const source = record.source === 'upload'
        || record.source === 'url'
        || record.source === 'chat-image'
        || record.source === 'manual'
        || record.source === 'character-choice'
        ? record.source
        : 'manual';
      const status = record.status === 'current'
        || record.status === 'candidate'
        || record.status === 'saved'
        || record.status === 'rejected'
        || record.status === 'used'
        ? record.status
        : 'candidate';
      const addedAt = Number.isFinite(record.addedAt) ? Math.max(0, Math.floor(record.addedAt as number)) : Date.now();
      const updatedAt = Number.isFinite(record.updatedAt) ? Math.max(0, Math.floor(record.updatedAt as number)) : addedAt;

      return {
        id: normalizeOptionalText(record.id) || `avatar-library-${addedAt}-${Math.random().toString(16).slice(2)}`,
        image,
        source,
        status,
        addedAt,
        updatedAt,
        ...(Number.isFinite(record.firstMessageTimestamp)
          ? { firstMessageTimestamp: Math.max(0, Math.floor(record.firstMessageTimestamp as number)) }
          : {}),
        ...(Number.isFinite(record.lastUsedAt)
          ? { lastUsedAt: Math.max(0, Math.floor(record.lastUsedAt as number)) }
          : {}),
        ...(normalizeOptionalText(record.reaction) ? { reaction: normalizeOptionalText(record.reaction) } : {}),
        ...(normalizeOptionalText(record.reason) ? { reason: normalizeOptionalText(record.reason) } : {}),
        ...(normalizeOptionalText(record.label) ? { label: normalizeOptionalText(record.label) } : {}),
        ...(Array.isArray(record.tags)
          ? { tags: record.tags.map(normalizeOptionalText).filter((tag): tag is string => Boolean(tag)) }
          : {}),
      };
    })
    .filter((entry): entry is CharacterAvatarLibraryEntry => Boolean(entry));

  return entries.length > 0 ? entries : undefined;
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
  const avatarLibraryEntries = normalizeAvatarLibraryEntries(character.avatarLibrary?.entries);
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
    avatarLibrary: avatarLibraryEntries
      ? {
          entries: avatarLibraryEntries,
          updatedAt: Number.isFinite(character.avatarLibrary?.updatedAt)
            ? Math.max(0, Math.floor(character.avatarLibrary!.updatedAt as number))
            : Math.max(...avatarLibraryEntries.map((entry) => entry.updatedAt)),
        }
      : undefined,
  };
}

export function migrateCharacterShapes(characters: Character[] | null | undefined): Character[] {
  if (!Array.isArray(characters)) return [];
  return characters.map(migrateCharacterShape);
}

export function getCharacterSchemaVersion(): number {
  return CHARACTER_SCHEMA_VERSION;
}

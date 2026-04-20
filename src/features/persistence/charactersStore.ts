import type { Character } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { migrateCharacterShapes } from './migrateCharacterShape';
import { sanitizeTransientAssetValue } from './sanitizeTransientAssetValue';
import { STORAGE_KEYS } from './storageKeys';

const HIDDEN_CHARACTER_IDS = new Set(['char-2', 'char-zhou-jibai']);
const HIDDEN_CHARACTER_NAMES = new Set(['林策', '周既白']);

function sanitizeCharacterList(value: Character[]): Character[] {
  return migrateCharacterShapes(value)
    .filter((character) => (
      !HIDDEN_CHARACTER_IDS.has(character.id)
      && !HIDDEN_CHARACTER_NAMES.has(character.name)
    ))
    .map((character) => ({
      ...character,
      avatar: sanitizeTransientAssetValue(character.avatar),
    }));
}

export function sanitizeCharacters(value: unknown, fallback: Character[]): Character[] {
  if (!Array.isArray(value)) return sanitizeCharacterList(fallback);
  return sanitizeCharacterList(value as Character[]);
}

export function hydrateCharacters(
  source: Character[] | null | undefined,
  fallback: Character[],
): Character[] {
  return sanitizeCharacters(source, fallback);
}

export function loadCharacters(fallback: Character[] = []): Character[] {
  const persisted = loadJson<Character[] | null>(STORAGE_KEYS.characters, null);
  return hydrateCharacters(persisted, fallback);
}

export function saveCharacters(value: Character[]): void {
  saveJson(STORAGE_KEYS.characters, value);
}

export function patchCharacters(
  updater: (current: Character[]) => Character[],
  fallback: Character[] = [],
): Character[] {
  const nextValue = updater(loadCharacters(fallback));
  saveCharacters(nextValue);
  return nextValue;
}

export function resetCharacters(): void {
  removeStoredJson(STORAGE_KEYS.characters);
}

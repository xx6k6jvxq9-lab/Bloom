import type { Character } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export function sanitizeCharacters(value: unknown, fallback: Character[]): Character[] {
  return Array.isArray(value) ? (value as Character[]) : fallback;
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

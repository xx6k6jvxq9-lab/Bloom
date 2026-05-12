import type { Character } from '../../types';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import {
  buildCharacterMemoryRecord,
  clearPersistedCharacterMemoryRecord,
  loadPersistedCharacterMemoryRecord,
  loadPreferredCharacterMemoryRecord,
  mergeCharacterMemoryIntoCharacters,
  saveCharacterMemoryRecord,
  stripCharacterMemoryFromCharacters,
} from './characterMemoryStore';
import { migrateCharacterShapes } from './migrateCharacterShape';
import {
  stripCharacterChatPreviewFields,
  stripCharacterChatPreviewFieldsFromList,
} from './characterChatPreview';
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
  const characters = hydrateCharacters(persisted, fallback);
  return mergeCharacterMemoryIntoCharacters(
    characters,
    loadPersistedCharacterMemoryRecord(buildCharacterMemoryRecord(characters)),
  );
}

export async function loadPreferredCharacters(fallback: Character[] = []): Promise<Character[]> {
  const localCharacters = loadCharacters(fallback);
  const localMemoryRecord = buildCharacterMemoryRecord(localCharacters);
  const preferredMemoryRecord = await loadPreferredCharacterMemoryRecord(localMemoryRecord);
  const strippedLocalCharacters = stripCharacterChatPreviewFieldsFromList(
    stripCharacterMemoryFromCharacters(localCharacters),
  );

  try {
    const persisted = await loadJsonRecord<Character[]>(STORAGE_KEYS.characters);
    if (Array.isArray(persisted)) {
      const indexedDbCharacters = mergeCharacterMemoryIntoCharacters(
        hydrateCharacters(persisted, fallback),
        preferredMemoryRecord,
      );
      const strippedIndexedDbCharacters = stripCharacterChatPreviewFieldsFromList(
        stripCharacterMemoryFromCharacters(indexedDbCharacters),
      );
      const nextMemoryRecord = buildCharacterMemoryRecord(indexedDbCharacters);

      saveJson(STORAGE_KEYS.characters, strippedIndexedDbCharacters);
      if (JSON.stringify(persisted) !== JSON.stringify(strippedIndexedDbCharacters)) {
        void saveJsonRecord(STORAGE_KEYS.characters, strippedIndexedDbCharacters).catch((error) => {
          console.error('[charactersStore] Failed to migrate IndexedDB characters into stripped payload', error);
        });
      }

      if (JSON.stringify(preferredMemoryRecord) !== JSON.stringify(nextMemoryRecord)) {
        try {
          await saveCharacterMemoryRecord(nextMemoryRecord);
        } catch (error) {
          console.error('[charactersStore] Failed to migrate character memory into dedicated store', error);
        }
      }

      return indexedDbCharacters;
    }
  } catch (error) {
    console.error('[charactersStore] Failed to load characters from IndexedDB', error);
  }

  saveJson(STORAGE_KEYS.characters, strippedLocalCharacters);
  void saveJsonRecord(STORAGE_KEYS.characters, strippedLocalCharacters).catch((error) => {
    console.error('[charactersStore] Failed to migrate local-only characters into IndexedDB', error);
  });

  return localCharacters;
}

export async function saveCharacters(value: Character[]): Promise<void> {
  const characterMemoryRecord = buildCharacterMemoryRecord(value);
  const strippedCharacters = stripCharacterChatPreviewFieldsFromList(
    stripCharacterMemoryFromCharacters(value),
  );
  const persistableFallbackCharacters = value.map(stripCharacterChatPreviewFields);

  try {
    await saveCharacterMemoryRecord(characterMemoryRecord);
  } catch (error) {
    console.error('[charactersStore] Failed to persist dedicated character memory store, falling back to embedded character save', error);
    saveJson(STORAGE_KEYS.characters, persistableFallbackCharacters);
    return saveJsonRecord(STORAGE_KEYS.characters, persistableFallbackCharacters).catch((saveError) => {
      console.error('[charactersStore] Failed to persist fallback embedded characters into IndexedDB', saveError);
    });
  }

  saveJson(STORAGE_KEYS.characters, strippedCharacters);

  return saveJsonRecord(STORAGE_KEYS.characters, strippedCharacters).catch((error) => {
    console.error('[charactersStore] Failed to persist characters into IndexedDB', error);
  });
}

export function patchCharacters(
  updater: (current: Character[]) => Character[],
  fallback: Character[] = [],
): Promise<Character[]> {
  const nextValue = updater(loadCharacters(fallback));
  return saveCharacters(nextValue).then(() => nextValue);
}

export function resetCharacters(): void {
  removeStoredJson(STORAGE_KEYS.characters);
  clearPersistedCharacterMemoryRecord();
  void removeJsonRecord(STORAGE_KEYS.characters).catch((error) => {
    console.error('[charactersStore] Failed to remove characters from IndexedDB', error);
  });
}

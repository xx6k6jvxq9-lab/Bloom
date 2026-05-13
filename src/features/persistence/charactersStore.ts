import type { Character } from '../../types';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import {
  buildCharacterMemoryRecord,
  clearPersistedCharacterMemoryRecord,
  loadPreferredCharacterMemoryRecord,
  mergeCharacterMemoryIntoCharacters,
  saveCharacterMemoryRecord,
  stripCharacterMemoryFromCharacters,
} from './characterMemoryStore';
import type { CharacterMemoryRecord } from './characterMemoryStore';
import { appendLegacyCharacterMemoryRecordAsNotes } from '../../services/memory/memoryRecordSnapshots';
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
  return hydrateCharacters(persisted, fallback);
}

export async function loadPreferredCharacters(fallback: Character[] = []): Promise<Character[]> {
  const localCharacters = loadCharacters(fallback);
  const localMemoryRecord = buildCharacterMemoryRecord(localCharacters);
  const preferredMemoryRecord = await loadPreferredCharacterMemoryRecord(localMemoryRecord);
  let effectiveMemoryRecord: CharacterMemoryRecord = preferredMemoryRecord;
  let didMigrateLegacyCharacterMemory = false;
  const strippedLocalCharacters = stripCharacterChatPreviewFieldsFromList(
    stripCharacterMemoryFromCharacters(localCharacters),
  );

  if (Object.keys(preferredMemoryRecord).length > 0) {
    try {
      await appendLegacyCharacterMemoryRecordAsNotes(preferredMemoryRecord);
      await saveCharacterMemoryRecord({});
      effectiveMemoryRecord = {};
      didMigrateLegacyCharacterMemory = true;
    } catch (error) {
      console.error('[charactersStore] Failed to migrate legacy character memory into memoryRecords', error);
    }
  }

  try {
    const persisted = await loadJsonRecord<Character[]>(STORAGE_KEYS.characters);
    if (Array.isArray(persisted)) {
      const indexedDbCharacters = mergeCharacterMemoryIntoCharacters(
        hydrateCharacters(persisted, fallback),
        effectiveMemoryRecord,
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

      if (!didMigrateLegacyCharacterMemory && JSON.stringify(effectiveMemoryRecord) !== JSON.stringify(nextMemoryRecord)) {
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

  return didMigrateLegacyCharacterMemory
    ? stripCharacterMemoryFromCharacters(localCharacters)
    : localCharacters;
}

export async function saveCharacters(value: Character[]): Promise<void> {
  const normalizedCharacters = migrateCharacterShapes(value);
  const legacyCharacterMemoryRecord = buildCharacterMemoryRecord(normalizedCharacters);
  const strippedCharacters = stripCharacterChatPreviewFieldsFromList(
    stripCharacterMemoryFromCharacters(normalizedCharacters),
  );
  const persistableFallbackCharacters = normalizedCharacters.map(stripCharacterChatPreviewFields);

  try {
    if (Object.keys(legacyCharacterMemoryRecord).length > 0) {
      await appendLegacyCharacterMemoryRecordAsNotes(legacyCharacterMemoryRecord);
    }
    await saveCharacterMemoryRecord({});
  } catch (error) {
    console.error('[charactersStore] Failed to migrate character memory into memoryRecords, falling back to legacy character memory store', error);
    try {
      await saveCharacterMemoryRecord(legacyCharacterMemoryRecord);
    } catch (memoryError) {
      console.error('[charactersStore] Failed to persist fallback character memory store, falling back to embedded character save', memoryError);
      saveJson(STORAGE_KEYS.characters, persistableFallbackCharacters);
      return saveJsonRecord(STORAGE_KEYS.characters, persistableFallbackCharacters).catch((saveError) => {
        console.error('[charactersStore] Failed to persist fallback embedded characters into IndexedDB', saveError);
      });
    }

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

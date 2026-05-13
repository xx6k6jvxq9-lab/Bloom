import type { Character, MemoryLibraryEntry } from '../../types';
import { normalizeMemoryLibraryEntries } from '../../services/memory/memoryLibrary';
import { loadJsonRecordEnvelope, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export type CharacterMemoryRecord = Record<string, MemoryLibraryEntry[]>;

function normalizeMemorySignatureText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function dedupeMemoryEntries(entries: MemoryLibraryEntry[]): MemoryLibraryEntry[] {
  const seenIds = new Set<string>();
  const seenContentKeys = new Set<string>();

  return [...entries]
    .sort((left, right) => right.createdAt - left.createdAt)
    .filter((entry) => {
      const trimmedId = entry.id.trim().toLowerCase();
      const contentKey = [
        entry.kind,
        entry.source,
        entry.createdAt,
        normalizeMemorySignatureText(entry.content),
      ].join('|');

      if ((trimmedId && seenIds.has(trimmedId)) || seenContentKeys.has(contentKey)) {
        return false;
      }

      if (trimmedId) {
        seenIds.add(trimmedId);
      }
      seenContentKeys.add(contentKey);
      return true;
    });
}

function normalizeRecordValue(value: unknown): CharacterMemoryRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: CharacterMemoryRecord = {};
  for (const [characterId, entries] of Object.entries(value as Record<string, unknown>)) {
    if (!characterId.trim()) {
      continue;
    }

    const normalizedEntries = normalizeMemoryLibraryEntries(entries);
    if (!normalizedEntries?.length) {
      continue;
    }

    result[characterId] = dedupeMemoryEntries(normalizedEntries);
  }

  return result;
}

function mergeEntryLists(...entryLists: Array<MemoryLibraryEntry[] | undefined>): MemoryLibraryEntry[] | undefined {
  const merged = dedupeMemoryEntries(
    entryLists.flatMap((entries) => entries ?? []),
  );
  return merged.length > 0 ? merged : undefined;
}

export function mergeCharacterMemoryRecords(...records: Array<CharacterMemoryRecord | null | undefined>): CharacterMemoryRecord {
  const merged: CharacterMemoryRecord = {};

  for (const record of records) {
    const normalizedRecord = normalizeRecordValue(record);
    for (const [characterId, entries] of Object.entries(normalizedRecord)) {
      const nextEntries = mergeEntryLists(merged[characterId], entries);
      if (nextEntries?.length) {
        merged[characterId] = nextEntries;
      }
    }
  }

  return merged;
}

function serializeRecord(record: CharacterMemoryRecord): string {
  return JSON.stringify(normalizeRecordValue(record));
}

function getLatestRecordTimestamp(record: CharacterMemoryRecord): number {
  return Object.values(record).reduce((latest, entries) => (
    Math.max(
      latest,
      ...(entries ?? []).map((entry) => entry.createdAt),
    )
  ), 0);
}

function getRecordEntryCount(record: CharacterMemoryRecord): number {
  return Object.values(record).reduce((total, entries) => total + entries.length, 0);
}

function shouldPreferIndexedDbRecord(params: {
  indexedDbRecord: CharacterMemoryRecord;
  indexedDbUpdatedAt: number;
  localRecord: CharacterMemoryRecord;
}): boolean {
  const indexedDbScore = Math.max(params.indexedDbUpdatedAt, getLatestRecordTimestamp(params.indexedDbRecord));
  const localScore = getLatestRecordTimestamp(params.localRecord);

  if (indexedDbScore !== localScore) {
    return indexedDbScore > localScore;
  }

  return getRecordEntryCount(params.indexedDbRecord) >= getRecordEntryCount(params.localRecord);
}

function loadStoredCharacterMemoryRecord(): CharacterMemoryRecord {
  return normalizeRecordValue(
    loadJson<Record<string, unknown> | null>(STORAGE_KEYS.characterMemory, null),
  );
}

export function buildCharacterMemoryRecord(
  characters: Array<Pick<Character, 'id' | 'memoryLibraryEntries'>>,
): CharacterMemoryRecord {
  return characters.reduce<CharacterMemoryRecord>((record, character) => {
    const mergedEntries = mergeEntryLists(character.memoryLibraryEntries);
    if (mergedEntries?.length) {
      record[character.id] = mergedEntries;
    }
    return record;
  }, {});
}

export function stripCharacterMemoryFromCharacters(
  characters: Character[],
): Character[] {
  return characters.map((character) => {
    const { memoryLibraryEntries: _memoryLibraryEntries, ...rest } = character;
    return rest as Character;
  });
}

export function mergeCharacterMemoryIntoCharacters(
  characters: Character[],
  memoryRecord: CharacterMemoryRecord,
): Character[] {
  return characters.map((character) => {
    const mergedEntries = mergeEntryLists(
      memoryRecord[character.id],
      character.memoryLibraryEntries,
    );

    if (!mergedEntries?.length) {
      if (character.memoryLibraryEntries === undefined) {
        return character;
      }

      const { memoryLibraryEntries: _memoryLibraryEntries, ...rest } = character;
      return rest as Character;
    }

    const currentEntries = mergeEntryLists(character.memoryLibraryEntries);
    if (serializeRecord({ [character.id]: currentEntries ?? [] }) === serializeRecord({ [character.id]: mergedEntries })) {
      return character;
    }

    return {
      ...character,
      memoryLibraryEntries: mergedEntries,
    };
  });
}

export function loadPersistedCharacterMemoryRecord(
  fallback: CharacterMemoryRecord = {},
): CharacterMemoryRecord {
  return mergeCharacterMemoryRecords(fallback, loadStoredCharacterMemoryRecord());
}

export async function loadPreferredCharacterMemoryRecord(
  fallback: CharacterMemoryRecord = {},
): Promise<CharacterMemoryRecord> {
  const localRecord = mergeCharacterMemoryRecords(loadStoredCharacterMemoryRecord(), fallback);

  try {
    const persistedEnvelope = await loadJsonRecordEnvelope<Record<string, unknown>>(STORAGE_KEYS.characterMemory);
    const indexedDbRecord = normalizeRecordValue(persistedEnvelope.value);

    if (Object.keys(indexedDbRecord).length === 0) {
      return localRecord;
    }

    return shouldPreferIndexedDbRecord({
      indexedDbRecord,
      indexedDbUpdatedAt: persistedEnvelope.updatedAt ?? 0,
      localRecord,
    })
      ? mergeCharacterMemoryRecords(indexedDbRecord, fallback)
      : localRecord;
  } catch (error) {
    console.error('[characterMemoryStore] Failed to load character memory from IndexedDB', error);
    return localRecord;
  }
}

export async function saveCharacterMemoryRecord(record: CharacterMemoryRecord): Promise<void> {
  const normalizedRecord = normalizeRecordValue(record);
  saveJson(STORAGE_KEYS.characterMemory, normalizedRecord);
  await saveJsonRecord(STORAGE_KEYS.characterMemory, normalizedRecord);
}

export function clearPersistedCharacterMemoryRecord(): void {
  removeStoredJson(STORAGE_KEYS.characterMemory);
  void removeJsonRecord(STORAGE_KEYS.characterMemory).catch((error) => {
    console.error('[characterMemoryStore] Failed to remove character memory from IndexedDB', error);
  });
}

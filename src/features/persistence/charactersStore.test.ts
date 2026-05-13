import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, MemoryLibraryEntry } from '../../types';
import { loadJsonRecord, saveJsonRecord } from './browserJsonStore';
import type { CharacterMemoryRecord } from './characterMemoryStore';
import { loadCharacters, loadPreferredCharacters, resetCharacters, saveCharacters } from './charactersStore';
import { STORAGE_KEYS } from './storageKeys';
import {
  clearPersistenceKeys,
  fakeLocalStorage,
  installPersistenceTestEnvironment,
} from './testPersistenceHarness';

function buildMemoryEntry(overrides: Partial<MemoryLibraryEntry> = {}): MemoryLibraryEntry {
  return {
    id: overrides.id ?? 'memory-short-term-1',
    kind: overrides.kind ?? 'short-term',
    source: overrides.source ?? 'manual',
    content: overrides.content ?? '记得她昨晚说过这件事',
    createdAt: overrides.createdAt ?? 1_700_000_000_000,
    year: overrides.year ?? 2023,
    month: overrides.month ?? 11,
    day: overrides.day ?? 14,
    hour: overrides.hour ?? 8,
    minute: overrides.minute ?? 20,
    charCount: overrides.charCount ?? (overrides.content ?? '记得她昨晚说过这件事').length,
  };
}

function buildCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'char-memory-test',
    name: overrides.name ?? '测试角色',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? 'avatar.png',
    setting: overrides.setting ?? '安静，但会记事。',
    openingRemark: overrides.openingRemark ?? '在吗？',
    ...overrides,
  };
}

async function clearCharacterPersistenceState() {
  resetCharacters();
  await clearPersistenceKeys([STORAGE_KEYS.characters, STORAGE_KEYS.characterMemory, STORAGE_KEYS.memoryRecords]);
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  await clearCharacterPersistenceState();
});

test('saveCharacters stores memory library in dedicated characterMemory store', async () => {
  const memoryEntry = buildMemoryEntry();
  const character = buildCharacter({
    memoryLibraryEntries: [memoryEntry],
    lastMessage: '这条预览应该留在聊天域',
    lastTime: 1_700_000_000_500,
    lastViewedMessageTimestamp: 1_700_000_000_400,
  });

  await saveCharacters([character]);

  const persistedCharacters = await loadJsonRecord<Character[]>(STORAGE_KEYS.characters);
  const persistedCharacterMemory = await loadJsonRecord<CharacterMemoryRecord>(STORAGE_KEYS.characterMemory);
  const persistedMemoryRecordIndex = await loadJsonRecord<{ characterIds?: string[] }>(STORAGE_KEYS.memoryRecords);
  const persistedMemoryRecordShard = await loadJsonRecord<
    Array<{ kind?: string; libraryKind?: string; librarySource?: string; text?: string }>
  >(`${STORAGE_KEYS.memoryRecords}:character:${character.id}`);
  const localCharacters = JSON.parse(fakeLocalStorage.getItem(STORAGE_KEYS.characters) || '[]') as Character[];
  const localCharacterMemory = JSON.parse(fakeLocalStorage.getItem(STORAGE_KEYS.characterMemory) || '{}') as CharacterMemoryRecord;

  assert.equal(persistedCharacters?.[0]?.memoryLibraryEntries, undefined);
  assert.equal(persistedCharacters?.[0]?.lastMessage, undefined);
  assert.equal(persistedCharacters?.[0]?.lastTime, undefined);
  assert.equal(persistedCharacters?.[0]?.lastViewedMessageTimestamp, undefined);
  assert.equal(localCharacters[0]?.memoryLibraryEntries, undefined);
  assert.equal(localCharacters[0]?.lastMessage, undefined);
  assert.equal(localCharacters[0]?.lastTime, undefined);
  assert.equal(localCharacters[0]?.lastViewedMessageTimestamp, undefined);
  assert.deepEqual(persistedCharacterMemory, {});
  assert.deepEqual(localCharacterMemory, {});
  assert.deepEqual(persistedMemoryRecordIndex?.characterIds, [character.id]);
  assert.equal(persistedMemoryRecordShard?.[0]?.kind, 'note');
  assert.equal(persistedMemoryRecordShard?.[0]?.libraryKind, 'short-term');
  assert.equal(persistedMemoryRecordShard?.[0]?.librarySource, 'manual');
  assert.equal(persistedMemoryRecordShard?.[0]?.text, memoryEntry.content);
});

test('loadPreferredCharacters rebuilds characters from dedicated characterMemory store', async () => {
  const memoryEntry = buildMemoryEntry();
  const strippedCharacter = buildCharacter();

  await saveJsonRecord(STORAGE_KEYS.characters, [strippedCharacter]);
  await saveJsonRecord(STORAGE_KEYS.characterMemory, {
    [strippedCharacter.id]: [memoryEntry],
  } satisfies CharacterMemoryRecord);

  const hydrated = await loadPreferredCharacters();
  const migratedCharacterMemory = await loadJsonRecord<CharacterMemoryRecord>(STORAGE_KEYS.characterMemory);
  const migratedMemoryRecordIndex = await loadJsonRecord<{ characterIds?: string[] }>(STORAGE_KEYS.memoryRecords);
  const migratedMemoryRecordShard = await loadJsonRecord<
    Array<{ kind?: string; libraryKind?: string; text?: string }>
  >(`${STORAGE_KEYS.memoryRecords}:character:${strippedCharacter.id}`);

  assert.equal(hydrated[0]?.memoryLibraryEntries, undefined);
  assert.deepEqual(migratedCharacterMemory, {});
  assert.deepEqual(migratedMemoryRecordIndex?.characterIds, [strippedCharacter.id]);
  assert.equal(migratedMemoryRecordShard?.[0]?.kind, 'note');
  assert.equal(migratedMemoryRecordShard?.[0]?.libraryKind, 'short-term');
  assert.equal(migratedMemoryRecordShard?.[0]?.text, memoryEntry.content);
});

test('loadCharacters does not eagerly merge dedicated characterMemory store into runtime characters', async () => {
  const memoryEntry = buildMemoryEntry();
  const strippedCharacter = buildCharacter();

  await saveJsonRecord(STORAGE_KEYS.characters, [strippedCharacter]);
  await saveJsonRecord(STORAGE_KEYS.characterMemory, {
    [strippedCharacter.id]: [memoryEntry],
  } satisfies CharacterMemoryRecord);

  const loaded = loadCharacters();

  assert.equal(loaded[0]?.memoryLibraryEntries, undefined);
});

test('loadPreferredCharacters migrates legacy embedded memory entries into dedicated store', async () => {
  const memoryEntry = buildMemoryEntry({
    id: 'legacy-memory-entry',
    content: '这是旧角色对象里直接带着的记忆',
  });
  const legacyCharacter = buildCharacter({
    id: 'char-legacy-memory',
    memoryLibraryEntries: [memoryEntry],
  });

  fakeLocalStorage.setItem(STORAGE_KEYS.characters, JSON.stringify([legacyCharacter]));

  const hydrated = await loadPreferredCharacters();
  const persistedCharacters = await loadJsonRecord<Character[]>(STORAGE_KEYS.characters);
  const persistedCharacterMemory = await loadJsonRecord<CharacterMemoryRecord>(STORAGE_KEYS.characterMemory);
  const migratedMemoryRecordIndex = await loadJsonRecord<{ characterIds?: string[] }>(STORAGE_KEYS.memoryRecords);
  const migratedMemoryRecordShard = await loadJsonRecord<
    Array<{ kind?: string; libraryKind?: string; text?: string }>
  >(`${STORAGE_KEYS.memoryRecords}:character:char-legacy-memory`);

  assert.equal(hydrated[0]?.memoryLibraryEntries, undefined);
  assert.equal(persistedCharacters?.[0]?.memoryLibraryEntries, undefined);
  assert.deepEqual(persistedCharacterMemory, {});
  assert.deepEqual(migratedMemoryRecordIndex?.characterIds, ['char-legacy-memory']);
  assert.equal(migratedMemoryRecordShard?.[0]?.kind, 'note');
  assert.equal(migratedMemoryRecordShard?.[0]?.libraryKind, 'short-term');
  assert.equal(migratedMemoryRecordShard?.[0]?.text, memoryEntry.content);
});

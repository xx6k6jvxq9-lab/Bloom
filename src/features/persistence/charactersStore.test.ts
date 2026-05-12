import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, MemoryLibraryEntry } from '../../types';
import { loadJsonRecord, saveJsonRecord } from './browserJsonStore';
import type { CharacterMemoryRecord } from './characterMemoryStore';
import { loadPreferredCharacters, resetCharacters, saveCharacters } from './charactersStore';
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
  await clearPersistenceKeys([STORAGE_KEYS.characters, STORAGE_KEYS.characterMemory]);
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
  assert.equal(persistedCharacterMemory?.['char-memory-test']?.[0]?.content, memoryEntry.content);
  assert.equal(localCharacterMemory['char-memory-test']?.[0]?.content, memoryEntry.content);
});

test('loadPreferredCharacters rebuilds characters from dedicated characterMemory store', async () => {
  const memoryEntry = buildMemoryEntry();
  const strippedCharacter = buildCharacter();

  await saveJsonRecord(STORAGE_KEYS.characters, [strippedCharacter]);
  await saveJsonRecord(STORAGE_KEYS.characterMemory, {
    [strippedCharacter.id]: [memoryEntry],
  } satisfies CharacterMemoryRecord);

  const hydrated = await loadPreferredCharacters();

  assert.equal(hydrated[0]?.memoryLibraryEntries?.[0]?.content, memoryEntry.content);
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

  assert.equal(hydrated[0]?.memoryLibraryEntries?.[0]?.content, memoryEntry.content);
  assert.equal(persistedCharacters?.[0]?.memoryLibraryEntries, undefined);
  assert.equal(
    persistedCharacterMemory?.['char-legacy-memory']?.[0]?.content,
    memoryEntry.content,
  );
});

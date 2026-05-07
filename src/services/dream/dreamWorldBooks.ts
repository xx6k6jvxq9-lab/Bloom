import {
  extractCompatibleWorldBookEntries,
  extractCompatibleWorldBookEntriesFromFile,
} from '../../features/import/importCompat';
import type { Character, WorldBookEntry } from '../../types';
import type { DreamWorldBookConfig } from './dreamRuntimeTypes';
import { buildWorldBookChunkCache } from '../world-book/worldBookBudget';
import {
  normalizeWorldBookCategory,
  normalizeWorldBookPriorityLevel,
  sortWorldBooksByPriority,
} from '../world-book/worldBookMeta';

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() || '';
}

function uniqueStringList(values: string[] | undefined): string[] {
  return Array.from(new Set((values || []).map((value) => value.trim()).filter(Boolean)));
}

function buildWorldBookFingerprint(entry: Pick<WorldBookEntry, 'title' | 'content'>): string {
  return [
    normalizeOptionalText(entry.title).toLowerCase(),
    normalizeOptionalText(entry.content).replace(/\s+/g, ' ').toLowerCase(),
  ].join('::');
}

function buildDreamLocalWorldBookId(characterId: string, index: number): string {
  return `dream-local-${characterId}-${Date.now()}-${index}`;
}

function createDreamScopedWorldBookEntry(
  source: Partial<WorldBookEntry>,
  characterId: string,
  fallbackId: string,
): WorldBookEntry | null {
  const title = normalizeOptionalText(source.title);
  const content = normalizeOptionalText(source.content);

  if (!title || !content) {
    return null;
  }

  const id = normalizeOptionalText(source.id) || fallbackId;

  return {
    id,
    title,
    content,
    category: normalizeWorldBookCategory(source.category),
    priorityLevel: normalizeWorldBookPriorityLevel(source.priorityLevel),
    isActive: true,
    isGlobal: false,
    characterIds: [characterId],
    pinMode: source.pinMode === 'always' ? 'always' : 'none',
    chunkCache: buildWorldBookChunkCache({ id, content }),
  };
}

export function normalizeDreamWorldBookConfig(config?: DreamWorldBookConfig | null): DreamWorldBookConfig {
  return {
    excludedInheritedIds: uniqueStringList(config?.excludedInheritedIds),
    localEntries: Array.isArray(config?.localEntries)
      ? config.localEntries.filter((entry): entry is WorldBookEntry => Boolean(entry?.title && entry?.content))
      : [],
  };
}

export function resolveDreamInheritedWorldBooks(
  character: Pick<Character, 'id' | 'activeWorldBookIds'>,
  worldBooks: WorldBookEntry[],
): WorldBookEntry[] {
  return sortWorldBooksByPriority(
    worldBooks.filter((entry) => (
      (entry.isActive && (entry.isGlobal || entry.characterIds?.includes(character.id)))
      || character.activeWorldBookIds?.includes(entry.id)
    )),
  );
}

export function createDreamLocalWorldBooksFromRaw(raw: string, characterId: string): WorldBookEntry[] {
  const compatibleEntries = extractCompatibleWorldBookEntries(raw);
  if (compatibleEntries.length > 0) {
    return compatibleEntries
      .map((entry, index) => createDreamScopedWorldBookEntry(entry, characterId, buildDreamLocalWorldBookId(characterId, index)))
      .filter((entry): entry is WorldBookEntry => Boolean(entry));
  }

  const parsed = JSON.parse(raw) as unknown;
  const sourceList = Array.isArray(parsed) ? parsed : [parsed];

  return sourceList
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      return createDreamScopedWorldBookEntry(
        item as Partial<WorldBookEntry>,
        characterId,
        buildDreamLocalWorldBookId(characterId, index),
      );
    })
    .filter((entry): entry is WorldBookEntry => Boolean(entry));
}

export async function createDreamLocalWorldBooksFromFile(file: File, characterId: string): Promise<WorldBookEntry[]> {
  const compatibleEntries = await extractCompatibleWorldBookEntriesFromFile(file);
  return compatibleEntries
    .map((entry, index) => createDreamScopedWorldBookEntry(entry, characterId, buildDreamLocalWorldBookId(characterId, index)))
    .filter((entry): entry is WorldBookEntry => Boolean(entry));
}

export function mergeDreamLocalWorldBooks(
  existingEntries: WorldBookEntry[],
  incomingEntries: WorldBookEntry[],
  characterId: string,
): WorldBookEntry[] {
  const normalizedIncoming = incomingEntries
    .map((entry, index) => createDreamScopedWorldBookEntry(entry, characterId, buildDreamLocalWorldBookId(characterId, index)))
    .filter((entry): entry is WorldBookEntry => Boolean(entry));
  const normalizedExisting = existingEntries
    .map((entry, index) => createDreamScopedWorldBookEntry(entry, characterId, entry.id || buildDreamLocalWorldBookId(characterId, index + normalizedIncoming.length)))
    .filter((entry): entry is WorldBookEntry => Boolean(entry));

  const seen = new Set<string>();
  const merged: WorldBookEntry[] = [];

  [...normalizedIncoming, ...normalizedExisting].forEach((entry) => {
    const fingerprint = buildWorldBookFingerprint(entry);
    if (!fingerprint || seen.has(fingerprint)) {
      return;
    }
    seen.add(fingerprint);
    merged.push(entry);
  });

  return sortWorldBooksByPriority(merged);
}

export function buildDreamPromptWorldBooks(input: {
  character: Pick<Character, 'id' | 'activeWorldBookIds'>;
  inheritedWorldBooks: WorldBookEntry[];
  config?: DreamWorldBookConfig | null;
}): WorldBookEntry[] {
  const normalizedConfig = normalizeDreamWorldBookConfig(input.config);
  const excludedIds = new Set(normalizedConfig.excludedInheritedIds || []);
  const selectedInherited = input.inheritedWorldBooks.filter((entry) => !excludedIds.has(entry.id));
  const localEntries = (normalizedConfig.localEntries || [])
    .map((entry, index) => createDreamScopedWorldBookEntry(entry, input.character.id, entry.id || buildDreamLocalWorldBookId(input.character.id, index)))
    .filter((entry): entry is WorldBookEntry => Boolean(entry));

  const seen = new Set<string>();
  const merged: WorldBookEntry[] = [];

  [...localEntries, ...selectedInherited].forEach((entry) => {
    const fingerprint = buildWorldBookFingerprint(entry);
    if (!fingerprint || seen.has(fingerprint)) {
      return;
    }
    seen.add(fingerprint);
    merged.push(entry);
  });

  return sortWorldBooksByPriority(merged);
}

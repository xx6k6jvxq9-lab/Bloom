import type { GroupOfflineRecruitDraft, GroupOfflineSession, WorldBookEntry } from '../../types';

function cloneChunkCache(value: WorldBookEntry['chunkCache']): WorldBookEntry['chunkCache'] {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.map((chunk) => ({
    id: chunk.id,
    label: chunk.label,
    content: chunk.content,
    ...(Array.isArray(chunk.keywords) ? { keywords: [...chunk.keywords] } : {}),
  }));
}

function cloneWorldBook(entry: WorldBookEntry): WorldBookEntry {
  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    category: entry.category,
    ...(entry.priorityLevel ? { priorityLevel: entry.priorityLevel } : {}),
    isActive: entry.isActive,
    isGlobal: entry.isGlobal,
    ...(Array.isArray(entry.characterIds) ? { characterIds: [...entry.characterIds] } : {}),
    ...(entry.pinMode ? { pinMode: entry.pinMode } : {}),
    ...(entry.summary ? { summary: entry.summary } : {}),
    ...(Array.isArray(entry.mustReadFacts) ? { mustReadFacts: [...entry.mustReadFacts] } : {}),
    ...(Array.isArray(entry.keywords) ? { keywords: [...entry.keywords] } : {}),
    ...(entry.fingerprint ? { fingerprint: entry.fingerprint } : {}),
    ...(cloneChunkCache(entry.chunkCache) ? { chunkCache: cloneChunkCache(entry.chunkCache) } : {}),
  };
}

export function buildGroupOfflineWorldBookSnapshot(entries: WorldBookEntry[] = []): WorldBookEntry[] {
  return entries.map((entry) => cloneWorldBook(entry));
}

export function resolveGroupOfflineWorldBookSnapshot(
  source: Pick<GroupOfflineSession, 'worldBookSnapshot' | 'selectedWorldBookIds'>
    | Pick<GroupOfflineRecruitDraft, 'worldBookSnapshot' | 'selectedWorldBookIds'>,
  activeWorldBooks: WorldBookEntry[] = [],
): WorldBookEntry[] {
  if (Array.isArray(source.worldBookSnapshot) && source.worldBookSnapshot.length > 0) {
    return buildGroupOfflineWorldBookSnapshot(source.worldBookSnapshot);
  }

  const selectedIds = new Set(source.selectedWorldBookIds || []);
  const fallbackEntries = selectedIds.size > 0
    ? activeWorldBooks.filter((entry) => selectedIds.has(entry.id))
    : activeWorldBooks;

  return buildGroupOfflineWorldBookSnapshot(fallbackEntries);
}

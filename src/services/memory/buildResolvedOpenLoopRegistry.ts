import type { Character, CharacterOpenLoopEntry } from '../../types';
import { buildDerivedMemoryLayersFromRecords } from './deriveMemoryLayersFromRecords';

function normalizeEntryKey(entry: Pick<CharacterOpenLoopEntry, 'kind' | 'content'>): string {
  return `${entry.kind}:${entry.content.replace(/\s+/g, ' ').trim().toLowerCase()}`;
}

export function buildResolvedOpenLoopRegistry(
  character: Pick<Character, 'id' | 'openLoopRegistry'>,
): CharacterOpenLoopEntry[] {
  const derivedEntries = buildDerivedMemoryLayersFromRecords(character).openLoopRegistry || [];
  const existingEntries = (character.openLoopRegistry || []).filter((entry) => entry.status !== 'resolved');
  const merged = [...derivedEntries, ...existingEntries];
  const seen = new Set<string>();

  return merged.filter((entry) => {
    const key = normalizeEntryKey(entry);
    if (!entry.content.trim() || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, 8);
}

import type { Character, CharacterOpenLoopEntry } from '../../types';
import { buildDerivedMemoryLayersFromRecords } from './deriveMemoryLayersFromRecords';

function normalizeEntryKey(entry: Pick<CharacterOpenLoopEntry, 'kind' | 'content'>): string {
  return `${entry.kind}:${entry.content.replace(/\s+/g, ' ').trim().toLowerCase()}`;
}

export function buildResolvedOpenLoopRegistry(
  character: Pick<Character, 'id' | 'openLoopRegistry'>,
): CharacterOpenLoopEntry[] {
  const derivedEntries = buildDerivedMemoryLayersFromRecords(character).openLoopRegistry || [];
  const seen = new Set<string>();
  const resolvedFromRecords = derivedEntries.filter((entry) => {
    const key = normalizeEntryKey(entry);
    if (!entry.content.trim() || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  if (resolvedFromRecords.length >= 8) {
    return resolvedFromRecords.slice(0, 8);
  }

  const fallbackLegacyEntries = (character.openLoopRegistry || [])
    .filter((entry) => entry.status !== 'resolved')
    .filter((entry) => {
      const key = normalizeEntryKey(entry);
      if (!entry.content.trim() || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return [...resolvedFromRecords, ...fallbackLegacyEntries].slice(0, 8);
}

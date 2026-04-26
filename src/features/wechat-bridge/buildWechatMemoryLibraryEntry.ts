import type { Character } from '../../types';
import { createMemoryLibraryEntry } from '../../services/memory/memoryLibrary';
import { extractWechatMemorySnapshot } from '../unified-context/applyWechatMemorySummaryWriteback';

const WECHAT_MEMORY_ENTRY_COOLDOWN_MS = 1000 * 60 * 60 * 12;

function normalizeSnapshot(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function buildWechatMemoryLibraryEntry(
  character: Pick<Character, 'memoryLibraryEntries'>,
  nextShortTermSummary: string | undefined,
  createdAt: number,
) {
  const snapshot = extractWechatMemorySnapshot(nextShortTermSummary);
  if (!snapshot) {
    return null;
  }

  const normalizedSnapshot = normalizeSnapshot(snapshot);
  const latestWechatAutoEntry = (character.memoryLibraryEntries ?? [])
    .filter((entry) => entry.kind === 'short-term' && entry.source === 'auto')
    .find((entry) => entry.content.includes('最近主题：') && entry.content.includes('相处倾向：'));

  if (latestWechatAutoEntry) {
    const normalizedExisting = normalizeSnapshot(latestWechatAutoEntry.content);
    if (normalizedExisting === normalizedSnapshot) {
      return null;
    }

    if (createdAt - latestWechatAutoEntry.createdAt < WECHAT_MEMORY_ENTRY_COOLDOWN_MS) {
      return null;
    }
  }

  return createMemoryLibraryEntry({
    kind: 'short-term',
    source: 'auto',
    content: snapshot,
    createdAt,
  });
}

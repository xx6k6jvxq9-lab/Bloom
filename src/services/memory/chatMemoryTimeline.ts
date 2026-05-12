import type { Character, ChatMemorySnapshot, ChatMessage, MemoryLibraryEntry } from '../../types';

function normalizeOptionalText(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function cloneMemoryLibraryEntries(entries?: MemoryLibraryEntry[]): MemoryLibraryEntry[] {
  return (entries ?? []).map((entry) => ({ ...entry }));
}

export function createChatMemorySnapshot(
  character: Pick<Character, 'shortTermSummary' | 'longTermMemoryProfile'>,
): ChatMemorySnapshot {
  // Message-level snapshots stay intentionally small so long chats do not keep
  // duplicating the entire memory library into every saved message.
  return {
    shortTermSummary: normalizeOptionalText(character.shortTermSummary),
    longTermMemoryProfile: normalizeOptionalText(character.longTermMemoryProfile),
  };
}

export function areChatMemorySnapshotsEqual(
  left?: ChatMemorySnapshot | null,
  right?: ChatMemorySnapshot | null,
): boolean {
  return normalizeOptionalText(left?.shortTermSummary) === normalizeOptionalText(right?.shortTermSummary)
    && normalizeOptionalText(left?.longTermMemoryProfile) === normalizeOptionalText(right?.longTermMemoryProfile);
}

export function findNearestChatMemorySnapshot(
  history: ChatMessage[],
  index: number,
): ChatMemorySnapshot | null {
  for (let cursor = Math.min(index, history.length - 1); cursor >= 0; cursor -= 1) {
    const snapshot = history[cursor]?.memorySnapshot;
    if (snapshot) {
      return {
        shortTermSummary: normalizeOptionalText(snapshot.shortTermSummary),
        longTermMemoryProfile: normalizeOptionalText(snapshot.longTermMemoryProfile),
        ...(Array.isArray(snapshot.memoryLibraryEntries)
          ? { memoryLibraryEntries: cloneMemoryLibraryEntries(snapshot.memoryLibraryEntries) }
          : {}),
      };
    }
  }

  return {
    shortTermSummary: undefined,
    longTermMemoryProfile: undefined,
  };
}

import type { Character, ChatMemorySnapshot, ChatMessage, MemoryLibraryEntry } from '../../types';

function normalizeOptionalText(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function cloneMemoryLibraryEntries(entries?: MemoryLibraryEntry[]): MemoryLibraryEntry[] {
  return (entries ?? []).map((entry) => ({ ...entry }));
}

export function createChatMemorySnapshot(
  character: Pick<Character, 'shortTermSummary' | 'longTermMemoryProfile' | 'memoryLibraryEntries'>,
): ChatMemorySnapshot {
  return {
    shortTermSummary: normalizeOptionalText(character.shortTermSummary),
    longTermMemoryProfile: normalizeOptionalText(character.longTermMemoryProfile),
    memoryLibraryEntries: cloneMemoryLibraryEntries(character.memoryLibraryEntries),
  };
}

export function areChatMemorySnapshotsEqual(
  left?: ChatMemorySnapshot | null,
  right?: ChatMemorySnapshot | null,
): boolean {
  return JSON.stringify({
    shortTermSummary: normalizeOptionalText(left?.shortTermSummary),
    longTermMemoryProfile: normalizeOptionalText(left?.longTermMemoryProfile),
    memoryLibraryEntries: cloneMemoryLibraryEntries(left?.memoryLibraryEntries),
  }) === JSON.stringify({
    shortTermSummary: normalizeOptionalText(right?.shortTermSummary),
    longTermMemoryProfile: normalizeOptionalText(right?.longTermMemoryProfile),
    memoryLibraryEntries: cloneMemoryLibraryEntries(right?.memoryLibraryEntries),
  });
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
        memoryLibraryEntries: cloneMemoryLibraryEntries(snapshot.memoryLibraryEntries),
      };
    }
  }

  return {
    shortTermSummary: undefined,
    longTermMemoryProfile: undefined,
    memoryLibraryEntries: [],
  };
}

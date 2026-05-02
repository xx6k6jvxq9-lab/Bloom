import type { ChatGroup, Character, WorldBookEntry } from '../../types';
import { sortWorldBooksByPriority } from '../../services/world-book/worldBookMeta';

type SelectActiveGroupWorldBooksParams = {
  speaker: Character;
  group: Pick<ChatGroup, 'activeWorldBookIds'> | undefined;
  worldBooks: WorldBookEntry[];
};

export function selectActiveGroupWorldBooks(
  params: SelectActiveGroupWorldBooksParams,
): WorldBookEntry[] {
  const activeIds = new Set(params.group?.activeWorldBookIds || []);

  if (activeIds.size === 0) {
    return [];
  }

  return sortWorldBooksByPriority(params.worldBooks.filter((worldBook) => {
    if (!worldBook) {
      return false;
    }

    return activeIds.has(worldBook.id);
  }));
}

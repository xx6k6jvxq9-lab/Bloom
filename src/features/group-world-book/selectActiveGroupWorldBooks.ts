import type { ChatGroup, Character, WorldBookEntry } from '../../types';

type SelectActiveGroupWorldBooksParams = {
  speaker: Character;
  group: Pick<ChatGroup, 'activeWorldBookIds'> | undefined;
  worldBooks: WorldBookEntry[];
};

export function selectActiveGroupWorldBooks(
  params: SelectActiveGroupWorldBooksParams,
): WorldBookEntry[] {
  const activeIds = new Set(params.group?.activeWorldBookIds || []);

  return params.worldBooks.filter((worldBook) => {
    if (!worldBook) {
      return false;
    }

    if (activeIds.has(worldBook.id)) {
      return true;
    }

    return !!worldBook.isActive;
  });
}

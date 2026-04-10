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
    if (!worldBook?.isActive) {
      return false;
    }

    return activeIds.has(worldBook.id);
  });
}

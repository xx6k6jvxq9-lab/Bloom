import type { Character, WorldBookEntry } from '../../types';
import { sortWorldBooksByPriority } from './worldBookMeta';

export function selectActiveCharacterWorldBooks(
  character: Pick<Character, 'id' | 'activeWorldBookIds'>,
  worldBooks: WorldBookEntry[] | undefined,
): WorldBookEntry[] {
  return sortWorldBooksByPriority(
    (worldBooks || []).filter((entry) => (
      (entry.isActive && (entry.isGlobal || entry.characterIds?.includes(character.id)))
      || character.activeWorldBookIds?.includes(entry.id)
    )),
  );
}

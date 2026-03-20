import type { Character, ChatGroup } from '../../types';

type UseCharacterDirectoryArgs = {
  characters: Character[];
};

export function createCharacterDirectory({ characters }: UseCharacterDirectoryArgs) {
  const characterById = new Map<string, Character>();
  const characterByName = new Map<string, Character>();

  characters.forEach((character) => {
    characterById.set(character.id, character);
    characterByName.set(character.name, character);
  });

  const getCharacterById = (id: string | null | undefined) => {
    if (!id) return null;
    return characterById.get(id) || null;
  };

  const getCharactersByIds = (ids: Array<string | null | undefined>) => {
    return ids
      .map((id) => getCharacterById(id))
      .filter((character): character is Character => !!character);
  };

  const getGroupMembers = (group: Pick<ChatGroup, 'memberIds'> | null | undefined) => {
    if (!group) return [];
    return getCharactersByIds(group.memberIds);
  };

  const getCharacterByName = (name: string | null | undefined) => {
    if (!name) return null;
    return characterByName.get(name) || null;
  };

  const getMomentAuthor = (authorId: string) => {
    if (authorId === 'user') return null;
    return getCharacterById(authorId);
  };

  const getCharacterDisplayName = (id: string | null | undefined) => {
    return getCharacterById(id)?.name || null;
  };

  const getCharacterAvatar = (id: string | null | undefined) => {
    return getCharacterById(id)?.avatar || null;
  };

  return {
    getCharacterById,
    getCharacterByName,
    getCharactersByIds,
    getGroupMembers,
    getMomentAuthor,
    getCharacterDisplayName,
    getCharacterAvatar,
  };
}

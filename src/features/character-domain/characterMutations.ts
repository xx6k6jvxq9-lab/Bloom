import type { Character } from '../../types';

export function replaceCharacters(_current: Character[], next: Character[]): Character[] {
  return next;
}

export function updateCharacterById(
  current: Character[],
  characterId: string,
  updater: (character: Character) => Character,
): Character[] {
  let hasChanged = false;

  const nextCharacters = current.map((character) => {
    if (character.id !== characterId) {
      return character;
    }

    hasChanged = true;
    return updater(character);
  });

  return hasChanged ? nextCharacters : current;
}

export function patchCharacterById(
  current: Character[],
  characterId: string,
  patch: Partial<Character>,
): Character[] {
  return updateCharacterById(current, characterId, (character) => ({
    ...character,
    ...patch,
  }));
}

export function removeCharacterById(current: Character[], characterId: string): Character[] {
  const nextCharacters = current.filter((character) => character.id !== characterId);
  return nextCharacters.length === current.length ? current : nextCharacters;
}

export function upsertCharacter(current: Character[], nextCharacter: Character): Character[] {
  const existingIndex = current.findIndex((character) => character.id === nextCharacter.id);
  if (existingIndex === -1) {
    return [nextCharacter, ...current];
  }

  return current.map((character) =>
    character.id === nextCharacter.id ? nextCharacter : character,
  );
}

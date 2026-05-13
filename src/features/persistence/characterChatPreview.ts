import type { Character } from '../../types';

const CHARACTER_CHAT_PREVIEW_KEYS = new Set<keyof Character>([
  'lastMessage',
  'lastTime',
  'lastViewedMessageTimestamp',
]);

export function stripCharacterChatPreviewFields(character: Character): Character {
  const {
    lastMessage: _lastMessage,
    lastTime: _lastTime,
    lastViewedMessageTimestamp: _lastViewedMessageTimestamp,
    ...persistableCharacter
  } = character;

  return persistableCharacter as Character;
}

export function stripCharacterChatPreviewFieldsFromList(characters: Character[]): Character[] {
  return characters.map(stripCharacterChatPreviewFields);
}

export function isCharacterChatPreviewPatch(patch: Partial<Character>): boolean {
  const patchKeys = Object.keys(patch) as Array<keyof Character>;
  return patchKeys.length > 0 && patchKeys.every((key) => CHARACTER_CHAT_PREVIEW_KEYS.has(key));
}

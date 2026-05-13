import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';

export const DIRECT_CHAT_BACKGROUND_DISABLED = '__direct-chat-background-disabled__';

export function isDirectChatBackgroundDisabled(value: string | null | undefined): boolean {
  return value?.trim() === DIRECT_CHAT_BACKGROUND_DISABLED;
}

export function resolveDirectChatBackground(options: {
  characterBackground?: string | null;
  resolvedCharacterBackgroundUrl?: string | null;
  globalBackground?: string | null;
  resolvedGlobalBackgroundUrl?: string | null;
}): string {
  const characterBackground = options.characterBackground?.trim() || '';

  if (characterBackground) {
    if (isDirectChatBackgroundDisabled(characterBackground)) {
      return '';
    }

    return getDisplayableAssetValue(characterBackground, options.resolvedCharacterBackgroundUrl) || '';
  }

  return getDisplayableAssetValue(options.globalBackground, options.resolvedGlobalBackgroundUrl) || '';
}

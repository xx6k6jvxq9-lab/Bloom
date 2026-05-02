import type { ForumGlobalSettings } from '../../types';

export const DEFAULT_FORUM_GLOBAL_SETTINGS: ForumGlobalSettings = {
  worldBook: {
    enabled: false,
    strength: 'light',
    selectedIds: [],
    selectedCategories: [],
    scopes: {
      public_open: false,
      spectator_open: false,
      hot_followup: false,
      detail_refresh: false,
      ai_reply: false,
      character_post: false,
    },
  },
  mask: {
    enabled: false,
    useActiveMaskOnly: true,
    selectedIds: [],
    scopes: {
      spectator_open: false,
      detail_refresh: false,
      ai_reply: false,
      character_post: false,
    },
  },
  social: {
    allowNpcTempChat: false,
    allowNpcFriendRequest: false,
  },
};

export function normalizeForumGlobalSettings(
  settings?: ForumGlobalSettings | null,
): ForumGlobalSettings {
  return {
    worldBook: {
      ...DEFAULT_FORUM_GLOBAL_SETTINGS.worldBook,
      ...settings?.worldBook,
      selectedIds: settings?.worldBook?.selectedIds || [],
      selectedCategories: settings?.worldBook?.selectedCategories || [],
      scopes: {
        ...DEFAULT_FORUM_GLOBAL_SETTINGS.worldBook.scopes,
        ...(settings?.worldBook?.scopes || {}),
      },
    },
    mask: {
      ...DEFAULT_FORUM_GLOBAL_SETTINGS.mask,
      ...settings?.mask,
      selectedIds: settings?.mask?.selectedIds || [],
      scopes: {
        ...DEFAULT_FORUM_GLOBAL_SETTINGS.mask.scopes,
        ...(settings?.mask?.scopes || {}),
      },
    },
    social: {
      ...DEFAULT_FORUM_GLOBAL_SETTINGS.social,
      ...settings?.social,
    },
  };
}

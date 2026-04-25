import type { AppData, AppSettings } from '../../types';
import { STORAGE_KEYS } from './storageKeys';
import { loadCharacters } from './charactersStore';
import { loadChatHistoryRecords, mergeGroupSessionsIntoChatGroups } from './chatHistoryStore';
import {
  sanitizeChatGroupsWithCharacters as sanitizeChatGroupsWithCharactersFromStore,
  sanitizePersistedCharacters as sanitizePersistedCharactersFromStore,
  sanitizePersistedMoments as sanitizePersistedMomentsFromStore,
} from './appDataSanitizers';
import { loadPersistedVisualSettings } from './visualSettingsStore';
import { sanitizeTransientAssetValue } from './sanitizeTransientAssetValue';
import { hydratePersistedCoupleSpacePayload } from './coupleSpaceStore';
import type { UserProfile } from '../app-shell/appShellTypes';

type BootstrapLocalAppStateParams = {
  createDefaultAppData: () => AppData;
  defaultCharacters: AppData['characters'];
  defaultConfig: AppSettings['configs'][number];
  defaultDesktopWallpaper: string;
  defaultSettings: AppSettings;
  defaultUser: UserProfile;
  defaultZhouJibaiAvatar: string;
};

type BootstrapLocalAppStateResult = {
  appData: AppData;
  migratedSettings?: AppSettings;
  settings: AppSettings;
};

export function bootstrapLocalAppState({
  createDefaultAppData,
  defaultCharacters,
  defaultConfig,
  defaultDesktopWallpaper,
  defaultSettings,
  defaultUser,
  defaultZhouJibaiAvatar,
}: BootstrapLocalAppStateParams): BootstrapLocalAppStateResult {
  let nextSettings = defaultSettings;
  let migratedSettings: AppSettings | undefined;
  let nextAppData = createDefaultAppData();

  const savedSettings = localStorage.getItem('ai_phone_settings');
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      if (parsed.configs && Array.isArray(parsed.configs)) {
        nextSettings = {
          ...defaultSettings,
          ...parsed,
          sharedStickers: Array.isArray(parsed.sharedStickers)
            ? parsed.sharedStickers.filter((item: unknown): item is string => typeof item === 'string')
            : [],
        };
      } else {
        migratedSettings = {
          activeConfigId: 'default',
          configs: [
            {
              ...defaultConfig,
              apiKey: parsed.apiKey || '',
              baseUrl: parsed.baseUrl || '',
              model: parsed.model || 'gemini-3-flash-preview',
              provider: parsed.provider || '自定义 (Custom)',
            },
          ],
        };
        nextSettings = migratedSettings;
      }
    } catch (error) {
      console.error('Failed to parse settings', error);
    }
  }

  const savedAppData = localStorage.getItem(STORAGE_KEYS.appData);
  if (savedAppData) {
    try {
      const parsed = JSON.parse(savedAppData);
      const characters = sanitizePersistedCharactersFromStore(
        loadCharacters(parsed.characters || defaultCharacters),
        defaultCharacters,
        defaultZhouJibaiAvatar,
      );
      const persistedChatHistory = loadChatHistoryRecords();
      const { coupleSpaceState, coupleSpace } = hydratePersistedCoupleSpacePayload(
        parsed.coupleSpaceState ?? parsed.coupleSpace ?? null,
      );
      const chatGroups = mergeGroupSessionsIntoChatGroups(
        sanitizeChatGroupsWithCharactersFromStore(parsed.chatGroups || [], characters),
        persistedChatHistory.groupSessions,
      );

      nextAppData = {
        ...parsed,
        characters,
        chatHistory: parsed.chatHistory || {},
        userProfile: parsed.userProfile
          ? {
              ...parsed.userProfile,
              avatar: sanitizeTransientAssetValue(parsed.userProfile.avatar),
            }
          : defaultUser,
        worldBooks: parsed.worldBooks || [],
        moments: sanitizePersistedMomentsFromStore(parsed.moments),
        groups: parsed.groups || ['家人', '朋友', '同事', '星标'],
        chatGroups,
        savedDates: parsed.savedDates || [],
        collectedDates: parsed.collectedDates || [],
        coupleSpaceState,
        coupleSpace,
        visualSettings: loadPersistedVisualSettings(parsed.visualSettings, defaultDesktopWallpaper),
      };
    } catch (error) {
      console.error('Failed to parse app data', error);
    }
  } else {
    nextAppData = {
      ...nextAppData,
      visualSettings: loadPersistedVisualSettings(nextAppData.visualSettings, defaultDesktopWallpaper),
    };
  }

  return {
    appData: nextAppData,
    migratedSettings,
    settings: nextSettings,
  };
}

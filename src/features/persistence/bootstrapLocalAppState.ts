import type { AppData, AppSettings } from '../../types';
import type { UserProfile } from '../app-shell/appShellTypes';
import {
  sanitizeChatGroupsWithCharacters as sanitizeChatGroupsWithCharactersFromStore,
  sanitizePersistedCharacters as sanitizePersistedCharactersFromStore,
  sanitizePersistedMoments as sanitizePersistedMomentsFromStore,
} from './appDataSanitizers';
import { loadJsonRecord } from './browserJsonStore';
import { loadCallHistory } from './callHistoryStore';
import {
  hydrateChatHistoryRecords,
  loadChatHistoryRecords,
  mergeGroupSessionsIntoChatGroups,
} from './chatHistoryStore';
import {
  hydrateChatOrganization,
  loadPersistedChatOrganization,
} from './chatOrganizationStore';
import { loadCharacters } from './charactersStore';
import { hydratePersistedCoupleSpacePayload } from './coupleSpaceStore';
import { loadDatingRecords } from './datingRecordsStore';
import {
  hydrateForumData,
  loadPersistedForumData,
} from './forumDataStore';
import {
  hydrateFriendRequests,
  loadPersistedFriendRequests,
} from './friendRequestsStore';
import { loadJson } from './localConfigStore';
import {
  hydrateMeData,
  loadPersistedMeData,
} from './meDataStore';
import { evaluateMigrationStatus, migrateCriticalRecordsIfNeeded } from './migrationStatusStore';
import {
  hydrateMoments,
  loadPersistedMoments,
} from './momentsStore';
import { loadPersistedMusicData } from './musicDataStore';
import { STORAGE_KEYS } from './storageKeys';
import { sanitizeTransientAssetValue } from './sanitizeTransientAssetValue';
import {
  hydrateUserProfile,
  loadPersistedUserProfile,
} from './userProfileStore';
import { loadPreferredVisualSettings } from './visualSettingsStore';
import {
  hydrateWalletData,
  loadPersistedWalletData,
} from './walletDataStore';

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

function readStoredJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[bootstrapLocalAppState] Failed to parse key "${key}"`, error);
    return null;
  }
}

function hasStoredJson(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) != null;
}

async function loadIndexedDbRecordSafe<T>(key: string): Promise<T | null> {
  try {
    return await loadJsonRecord<T>(key);
  } catch (error) {
    console.warn(`[bootstrapLocalAppState] Failed to read IndexedDB key "${key}"`, error);
    return null;
  }
}

function resolveSettingsState(
  parsed: unknown,
  defaultConfig: AppSettings['configs'][number],
  defaultSettings: AppSettings,
): { migratedSettings?: AppSettings; settings: AppSettings } {
  if (!parsed || typeof parsed !== 'object') {
    return { settings: defaultSettings };
  }

  if ('configs' in parsed && Array.isArray((parsed as { configs?: unknown[] }).configs)) {
    const normalized = parsed as Partial<AppSettings> & { sharedStickers?: unknown };
    return {
      settings: {
        ...defaultSettings,
        ...normalized,
        sharedStickers: Array.isArray(normalized.sharedStickers)
          ? normalized.sharedStickers.filter((item: unknown): item is string => typeof item === 'string')
          : [],
      },
    };
  }

  const legacy = parsed as Record<string, unknown>;
  const migratedSettings: AppSettings = {
    activeConfigId: 'default',
    configs: [
      {
        ...defaultConfig,
        apiKey: typeof legacy.apiKey === 'string' ? legacy.apiKey : '',
        baseUrl: typeof legacy.baseUrl === 'string' ? legacy.baseUrl : '',
        model: typeof legacy.model === 'string' ? legacy.model : 'gemini-3-flash-preview',
        provider: typeof legacy.provider === 'string' ? legacy.provider : '鑷畾涔?(Custom)',
      },
    ],
  };

  return {
    migratedSettings,
    settings: migratedSettings,
  };
}

export async function bootstrapLocalAppState({
  createDefaultAppData,
  defaultCharacters,
  defaultConfig,
  defaultDesktopWallpaper,
  defaultSettings,
  defaultUser,
  defaultZhouJibaiAvatar,
}: BootstrapLocalAppStateParams): Promise<BootstrapLocalAppStateResult> {
  let nextSettings = defaultSettings;
  let migratedSettings: AppSettings | undefined;
  const defaultAppData = createDefaultAppData();
  let nextAppData = defaultAppData;
  let legacyAppDataCache: Partial<AppData> | null | undefined;

  const getLegacyAppData = (): Partial<AppData> | null => {
    if (legacyAppDataCache === undefined) {
      legacyAppDataCache = readStoredJson<Partial<AppData>>(STORAGE_KEYS.appData);
    }

    return legacyAppDataCache;
  };

  const [
    indexedDbSettings,
    indexedDbCharacters,
    indexedDbChatHistory,
    indexedDbChatOrganization,
    indexedDbUserProfile,
    indexedDbMoments,
    indexedDbForumData,
    indexedDbCoupleSpace,
    indexedDbFriendRequests,
    indexedDbMeData,
    indexedDbWalletData,
  ] = await Promise.all([
    loadIndexedDbRecordSafe<unknown>(STORAGE_KEYS.settings),
    loadIndexedDbRecordSafe<unknown>(STORAGE_KEYS.characters),
    loadIndexedDbRecordSafe<unknown>(STORAGE_KEYS.chatHistory),
    loadIndexedDbRecordSafe<unknown>(STORAGE_KEYS.chatOrganization),
    loadIndexedDbRecordSafe<unknown>(STORAGE_KEYS.userProfile),
    loadIndexedDbRecordSafe<unknown>(STORAGE_KEYS.moments),
    loadIndexedDbRecordSafe<unknown>(STORAGE_KEYS.forumData),
    loadIndexedDbRecordSafe<unknown>(STORAGE_KEYS.coupleSpace),
    loadIndexedDbRecordSafe<unknown>(STORAGE_KEYS.friendRequests),
    loadIndexedDbRecordSafe<unknown>(STORAGE_KEYS.meData),
    loadIndexedDbRecordSafe<unknown>(STORAGE_KEYS.walletData),
  ]);

  const parsedSettings = indexedDbSettings ?? readStoredJson<unknown>(STORAGE_KEYS.settings);
  if (parsedSettings) {
    const resolvedSettings = resolveSettingsState(parsedSettings, defaultConfig, defaultSettings);
    nextSettings = resolvedSettings.settings;
    migratedSettings = resolvedSettings.migratedSettings;
  }

  const hasLocalCharacters = hasStoredJson(STORAGE_KEYS.characters);
  const hasLocalChatHistory = hasStoredJson(STORAGE_KEYS.chatHistory);
  const hasLocalChatOrganization = hasStoredJson(STORAGE_KEYS.chatOrganization);
  const hasLocalUserProfile = hasStoredJson(STORAGE_KEYS.userProfile);
  const hasLocalMeData = hasStoredJson(STORAGE_KEYS.meData);
  const hasLocalMoments = hasStoredJson(STORAGE_KEYS.moments);
  const hasLocalForumData = hasStoredJson(STORAGE_KEYS.forumData);
  const hasLocalFriendRequests = hasStoredJson(STORAGE_KEYS.friendRequests);
  const hasLocalDatingRecords = hasStoredJson(STORAGE_KEYS.datingRecords);
  const hasLocalCoupleSpace = hasStoredJson(STORAGE_KEYS.coupleSpace);
  const hasLocalVisualSettings = hasStoredJson(STORAGE_KEYS.visualSettings);
  const hasLocalMusicData = hasStoredJson(STORAGE_KEYS.musicData);
  const hasLocalWalletData = hasStoredJson(STORAGE_KEYS.walletData);
  const hasLocalCallHistory = hasStoredJson(STORAGE_KEYS.callHistory);

  const needsLegacyAppData = (
    (!indexedDbCharacters && !hasLocalCharacters)
    || (!indexedDbChatHistory && !hasLocalChatHistory)
    || (!indexedDbChatOrganization && !hasLocalChatOrganization)
    || (!indexedDbUserProfile && !hasLocalUserProfile)
    || (!indexedDbMeData && !hasLocalMeData)
    || (!indexedDbMoments && !hasLocalMoments)
    || (!indexedDbForumData && !hasLocalForumData)
    || (!indexedDbFriendRequests && !hasLocalFriendRequests)
    || !hasLocalDatingRecords
    || (!indexedDbCoupleSpace && !hasLocalCoupleSpace)
    || !hasLocalVisualSettings
    || !hasLocalMusicData
    || (!indexedDbWalletData && !hasLocalWalletData)
    || !hasLocalCallHistory
  );
  const legacyAppData = needsLegacyAppData ? getLegacyAppData() : null;
  const legacyGroups = Array.isArray(legacyAppData?.groups)
    ? legacyAppData.groups
    : ['瀹朵汉', '鏈嬪弸', '鍚屼簨', '鏄熸爣'];

  const characters = sanitizePersistedCharactersFromStore(
    Array.isArray(indexedDbCharacters)
      ? indexedDbCharacters
      : loadCharacters(
          !hasLocalCharacters ? (legacyAppData?.characters || defaultCharacters) : defaultCharacters,
        ),
    defaultCharacters,
    defaultZhouJibaiAvatar,
  );

  const localChatHistory = loadChatHistoryRecords({
    directHistory:
      !indexedDbChatHistory && !hasLocalChatHistory
        ? legacyAppData?.chatHistory || {}
        : {},
    directRelationshipWaves: {},
    directFactTraces: {},
    groupSessions: {},
  });
  const persistedChatHistory = indexedDbChatHistory
    ? hydrateChatHistoryRecords(
        indexedDbChatHistory as Partial<typeof localChatHistory>,
        localChatHistory,
      )
    : localChatHistory;

  const localChatOrganization = loadPersistedChatOrganization({
    groups: !indexedDbChatOrganization && !hasLocalChatOrganization ? legacyGroups : [],
    chatGroups: !indexedDbChatOrganization && !hasLocalChatOrganization
      ? sanitizeChatGroupsWithCharactersFromStore(legacyAppData?.chatGroups || [], characters)
      : [],
  });
  const persistedChatOrganization = indexedDbChatOrganization
    ? hydrateChatOrganization(
        indexedDbChatOrganization as Partial<typeof localChatOrganization>,
        localChatOrganization,
      )
    : localChatOrganization;

  const localUserProfile = loadPersistedUserProfile(
    !indexedDbUserProfile && !hasLocalUserProfile && legacyAppData?.userProfile
      ? {
          ...defaultUser,
          ...legacyAppData.userProfile,
          avatar: sanitizeTransientAssetValue(legacyAppData.userProfile.avatar) || defaultUser.avatar,
        }
      : defaultUser,
  );
  const userProfile = indexedDbUserProfile
    ? hydrateUserProfile(
        indexedDbUserProfile as Partial<typeof localUserProfile>,
        localUserProfile,
      )
    : localUserProfile;

  const meDataFallback = {
    masks: !indexedDbMeData && !hasLocalMeData && Array.isArray(legacyAppData?.masks)
      ? legacyAppData.masks
      : defaultAppData.masks,
    favorites: !indexedDbMeData && !hasLocalMeData && Array.isArray(legacyAppData?.favorites)
      ? legacyAppData.favorites
      : defaultAppData.favorites,
    worldBooks: !indexedDbMeData && !hasLocalMeData && Array.isArray(legacyAppData?.worldBooks)
      ? legacyAppData.worldBooks
      : defaultAppData.worldBooks,
  };
  const localMeData = loadPersistedMeData(meDataFallback);
  const meData = indexedDbMeData
    ? hydrateMeData(indexedDbMeData as Partial<typeof localMeData>, localMeData)
    : localMeData;

  const localMoments = loadPersistedMoments(
    sanitizePersistedMomentsFromStore(
      !indexedDbMoments && !hasLocalMoments ? legacyAppData?.moments : undefined,
    ),
  );
  const moments = sanitizePersistedMomentsFromStore(
    indexedDbMoments
      ? hydrateMoments(indexedDbMoments as typeof localMoments, localMoments)
      : localMoments,
  );

  const forumDataFallback =
    !indexedDbForumData && !hasLocalForumData
      ? (legacyAppData?.forumData ?? { posts: [], notifications: [], followedUsers: [] })
      : { posts: [], notifications: [], followedUsers: [] };
  const localForumData = loadPersistedForumData(forumDataFallback);
  const forumData = indexedDbForumData
    ? hydrateForumData(indexedDbForumData as Partial<typeof localForumData>, localForumData)
    : localForumData;

  const localFriendRequests = loadPersistedFriendRequests(
    !indexedDbFriendRequests && !hasLocalFriendRequests ? legacyAppData?.friendRequests || [] : [],
  );
  const friendRequests = indexedDbFriendRequests
    ? hydrateFriendRequests(
        indexedDbFriendRequests as typeof localFriendRequests,
        localFriendRequests,
      )
    : localFriendRequests;

  const datingRecords = loadDatingRecords({
    savedDates: !hasLocalDatingRecords ? legacyAppData?.savedDates || [] : [],
    collectedDates: !hasLocalDatingRecords ? legacyAppData?.collectedDates || [] : [],
  });

  const coupleSpacePersistedSource =
    indexedDbCoupleSpace
    ?? loadJson<unknown>(STORAGE_KEYS.coupleSpace, null)
    ?? (!hasLocalCoupleSpace ? legacyAppData?.coupleSpaceState : null)
    ?? (!hasLocalCoupleSpace ? legacyAppData?.coupleSpace : null)
    ?? null;
  const { coupleSpaceState, coupleSpace } = hydratePersistedCoupleSpacePayload(coupleSpacePersistedSource);

  const visualSettings = await loadPreferredVisualSettings(
    (!hasLocalVisualSettings ? legacyAppData?.visualSettings : undefined) ?? defaultAppData.visualSettings,
    defaultDesktopWallpaper,
  );

  const fallbackMusicData = !hasLocalMusicData && legacyAppData?.musicData
    ? { ...defaultAppData.musicData!, ...legacyAppData.musicData }
    : defaultAppData.musicData!;
  const musicData = loadPersistedMusicData(fallbackMusicData);

  const walletFallback =
    !indexedDbWalletData && !hasLocalWalletData
      ? (legacyAppData?.walletData ?? { cards: [], transactions: [] })
      : { cards: [], transactions: [] };
  const localWalletData = loadPersistedWalletData(walletFallback);
  const walletData = indexedDbWalletData
    ? hydrateWalletData(indexedDbWalletData as Partial<typeof localWalletData>, localWalletData)
    : localWalletData;

  const chatGroups = mergeGroupSessionsIntoChatGroups(
    sanitizeChatGroupsWithCharactersFromStore(persistedChatOrganization.chatGroups || [], characters),
    persistedChatHistory.groupSessions,
  );

  nextAppData = {
    ...defaultAppData,
    characters,
    chatHistory: persistedChatHistory.directHistory,
    userProfile,
    masks: meData.masks,
    favorites: meData.favorites,
    visualSettings,
    groups: persistedChatOrganization.groups,
    moments,
    worldBooks: meData.worldBooks,
    coupleSpaceState,
    coupleSpace,
    friendRequests,
    chatGroups,
    callHistory: loadCallHistory(!hasLocalCallHistory ? legacyAppData?.callHistory || [] : []),
    savedDates: datingRecords.savedDates,
    collectedDates: datingRecords.collectedDates,
    musicData,
    walletData,
    forumData,
  };

  await migrateCriticalRecordsIfNeeded({
    [STORAGE_KEYS.settings]: nextSettings,
    [STORAGE_KEYS.characters]: nextAppData.characters,
    [STORAGE_KEYS.chatHistory]: persistedChatHistory,
    [STORAGE_KEYS.chatOrganization]: {
      groups: nextAppData.groups,
      chatGroups: persistedChatOrganization.chatGroups,
    },
    [STORAGE_KEYS.userProfile]: nextAppData.userProfile,
  });

  await evaluateMigrationStatus();

  return {
    appData: nextAppData,
    migratedSettings,
    settings: nextSettings,
  };
}

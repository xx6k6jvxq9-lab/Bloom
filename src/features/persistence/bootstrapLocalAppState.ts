import type { AppData, AppSettings, ForumData, ForumSpectatorSettings } from '../../types';
import type { UserProfile } from '../app-shell/appShellTypes';
import {
  sanitizeChatGroupsWithCharacters as sanitizeChatGroupsWithCharactersFromStore,
  sanitizePersistedCharacters as sanitizePersistedCharactersFromStore,
  sanitizePersistedMoments as sanitizePersistedMomentsFromStore,
} from './appDataSanitizers';
import { loadJsonRecord } from './browserJsonStore';
import { loadPreferredCallHistory } from './callHistoryStore';
import { DEFAULT_CONTACT_GROUPS, normalizeContactGroups } from './contactGroupNames';
import {
  loadPreferredChatHistoryRecords,
  mergeGroupSessionsIntoChatGroups,
} from './chatHistoryStore';
import {
  loadPreferredChatOrganization,
} from './chatOrganizationStore';
import { loadPreferredCharacters } from './charactersStore';
import { hydratePersistedCoupleSpacePayload } from './coupleSpaceStore';
import { loadPreferredDatingRecords } from './datingRecordsStore';
import {
  hydrateForumData,
  loadPersistedForumData,
} from './forumDataStore';
import { DEFAULT_FORUM_GLOBAL_SETTINGS } from '../../services/forum/forumGlobalSettings';
import { normalizeStickerMetadataMap } from '../../services/chat/stickerMetadata';
import {
  hydrateFriendRequests,
  loadPersistedFriendRequests,
} from './friendRequestsStore';
import { loadJson } from './localConfigStore';
import {
  hydrateMeData,
  loadPreferredMeData,
} from './meDataStore';
import { evaluateMigrationStatusWithOptions, migrateCriticalRecordsIfNeeded } from './migrationStatusStore';
import {
  loadPreferredMoments,
} from './momentsStore';
import { loadPreferredMusicData } from './musicDataStore';
import { STORAGE_KEYS } from './storageKeys';
import { sanitizeTransientAssetValue } from './sanitizeTransientAssetValue';
import {
  loadPreferredUserProfile,
} from './userProfileStore';
import { loadPreferredVisualSettings } from './visualSettingsStore';
import {
  hydrateWalletData,
  loadPersistedWalletData,
} from './walletDataStore';
import { ensureApiCenterConfig } from '../../services/ai/apiCenter/defaults';

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

const EMPTY_SPECTATOR_SETTINGS: ForumSpectatorSettings = {
  subjectName: '',
  relationshipSummary: '',
  tone: undefined,
  worldShell: undefined,
  angles: [],
  autoGenerate: false,
  selectedCharacterIds: [],
  userSlot: { mode: 'self' },
  targetCharacters: [],
  targetPresets: [],
  defaultThreadTypePool: [],
  cluePool: [],
};

const EMPTY_FORUM_DATA: ForumData = {
  posts: [],
  notifications: [],
  followedUsers: [],
  followerMap: {},
  tempChats: {},
  runtimeAuthorProfiles: {},
  composerDraft: null,
  spectatorSettings: EMPTY_SPECTATOR_SETTINGS,
  globalSettings: DEFAULT_FORUM_GLOBAL_SETTINGS,
};

function readStoredJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[bootstrapLocalAppState] Failed to parse key "${key}"`, error);
    return null;
  }
}

function hasStoredJson(key: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(key) != null;
  } catch (error) {
    console.warn(`[bootstrapLocalAppState] Failed to inspect localStorage key "${key}"`, error);
    return false;
  }
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
    const normalized = parsed as Partial<AppSettings> & {
      sharedStickers?: unknown;
      sharedStickerMetadata?: unknown;
    };
    const sharedStickers = Array.isArray(normalized.sharedStickers)
      ? normalized.sharedStickers.filter((item: unknown): item is string => typeof item === 'string')
      : [];
    const settings: AppSettings = {
      ...defaultSettings,
      ...normalized,
      apiCenterConfig: normalized.apiCenterConfig,
      sharedStickers,
      sharedStickerMetadata: normalizeStickerMetadataMap(normalized.sharedStickerMetadata, sharedStickers),
    };
    settings.apiCenterConfig = ensureApiCenterConfig(settings);

    return {
      settings,
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
  migratedSettings.apiCenterConfig = ensureApiCenterConfig(migratedSettings);

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

  const hasIndexedDbCharacters = Array.isArray(indexedDbCharacters);
  const hasIndexedDbChatHistory = indexedDbChatHistory != null;
  const hasIndexedDbChatOrganization = indexedDbChatOrganization != null;
  const hasIndexedDbUserProfile = indexedDbUserProfile != null;
  const hasIndexedDbMoments = indexedDbMoments != null;
  const hasIndexedDbForumData = indexedDbForumData != null;
  const hasIndexedDbCoupleSpace = indexedDbCoupleSpace != null;
  const hasIndexedDbFriendRequests = indexedDbFriendRequests != null;
  const hasIndexedDbMeData = indexedDbMeData != null;
  const hasIndexedDbWalletData = indexedDbWalletData != null;

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

  const hasAnyModernBusinessData = (
    hasIndexedDbCharacters
    || hasIndexedDbChatHistory
    || hasIndexedDbChatOrganization
    || hasIndexedDbUserProfile
    || hasIndexedDbMoments
    || hasIndexedDbForumData
    || hasIndexedDbCoupleSpace
    || hasIndexedDbFriendRequests
    || hasIndexedDbMeData
    || hasIndexedDbWalletData
    || hasLocalCharacters
    || hasLocalChatHistory
    || hasLocalChatOrganization
    || hasLocalUserProfile
    || hasLocalMeData
    || hasLocalMoments
    || hasLocalForumData
    || hasLocalFriendRequests
    || hasLocalDatingRecords
    || hasLocalCoupleSpace
    || hasLocalVisualSettings
    || hasLocalMusicData
    || hasLocalWalletData
    || hasLocalCallHistory
  );
  const legacyAppData = hasAnyModernBusinessData ? null : getLegacyAppData();
  const legacyGroups = normalizeContactGroups(
    Array.isArray(legacyAppData?.groups) ? legacyAppData.groups : DEFAULT_CONTACT_GROUPS,
  );

  const characters = sanitizePersistedCharactersFromStore(
    await loadPreferredCharacters(
      !hasIndexedDbCharacters && !hasLocalCharacters
        ? (legacyAppData?.characters || defaultCharacters)
        : defaultCharacters,
    ),
    defaultCharacters,
    defaultZhouJibaiAvatar,
  );

  const persistedChatHistory = await loadPreferredChatHistoryRecords({
    directHistory:
      !hasIndexedDbChatHistory && !hasLocalChatHistory
        ? legacyAppData?.chatHistory || {}
        : {},
    directRelationshipWaves: {},
    directFactTraces: {},
    groupSessions: {},
  });

  const persistedChatOrganization = await loadPreferredChatOrganization({
    groups: !hasIndexedDbChatOrganization && !hasLocalChatOrganization ? legacyGroups : [],
    chatGroups: !hasIndexedDbChatOrganization && !hasLocalChatOrganization
      ? sanitizeChatGroupsWithCharactersFromStore(legacyAppData?.chatGroups || [], characters)
      : [],
  });

  const userProfile = await loadPreferredUserProfile(
    !hasIndexedDbUserProfile && !hasLocalUserProfile && legacyAppData?.userProfile
      ? {
          ...defaultUser,
          ...legacyAppData.userProfile,
          avatar: sanitizeTransientAssetValue(legacyAppData.userProfile.avatar) || defaultUser.avatar,
        }
      : defaultUser,
  );

  const meDataFallback = {
    masks: !hasIndexedDbMeData && !hasLocalMeData && Array.isArray(legacyAppData?.masks)
      ? legacyAppData.masks
      : defaultAppData.masks,
    favorites: !hasIndexedDbMeData && !hasLocalMeData && Array.isArray(legacyAppData?.favorites)
      ? legacyAppData.favorites
      : defaultAppData.favorites,
    worldBooks: !hasIndexedDbMeData && !hasLocalMeData && Array.isArray(legacyAppData?.worldBooks)
      ? legacyAppData.worldBooks
      : defaultAppData.worldBooks,
  };
  const meData = await loadPreferredMeData(meDataFallback);

  const moments = sanitizePersistedMomentsFromStore(
    await loadPreferredMoments(
      sanitizePersistedMomentsFromStore(
        !hasIndexedDbMoments && !hasLocalMoments ? legacyAppData?.moments : undefined,
      ),
    ),
  );

  const forumDataFallback =
    !hasIndexedDbForumData && !hasLocalForumData
      ? (legacyAppData?.forumData ?? EMPTY_FORUM_DATA)
      : EMPTY_FORUM_DATA;
  const localForumData = loadPersistedForumData(forumDataFallback);
  const forumData = hasIndexedDbForumData
    ? hydrateForumData(indexedDbForumData as Partial<typeof localForumData>, localForumData)
    : localForumData;

  const localFriendRequests = loadPersistedFriendRequests(
    !hasIndexedDbFriendRequests && !hasLocalFriendRequests ? legacyAppData?.friendRequests || [] : [],
  );
  const friendRequests = hasIndexedDbFriendRequests
    ? hydrateFriendRequests(
        indexedDbFriendRequests as typeof localFriendRequests,
        localFriendRequests,
      )
    : localFriendRequests;

  const datingRecords = await loadPreferredDatingRecords({
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
  const musicData = await loadPreferredMusicData(fallbackMusicData);

  const walletFallback =
    !hasIndexedDbWalletData && !hasLocalWalletData
      ? (legacyAppData?.walletData ?? { cards: [], transactions: [] })
      : { cards: [], transactions: [] };
  const localWalletData = loadPersistedWalletData(walletFallback);
  const walletData = hasIndexedDbWalletData
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
    callHistory: await loadPreferredCallHistory(!hasLocalCallHistory ? legacyAppData?.callHistory || [] : []),
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

  await evaluateMigrationStatusWithOptions({ countSuccessfulLaunch: true });

  return {
    appData: nextAppData,
    migratedSettings,
    settings: nextSettings,
  };
}

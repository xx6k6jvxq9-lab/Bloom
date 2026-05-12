import type { AppData, ForumData, ForumSpectatorSettings, WalletData } from '../../types';
import { saveJsonRecord } from './browserJsonStore';
import { saveCharacters } from './charactersStore';
import { buildPersistableCoupleSpacePayload, persistCoupleSpace } from './coupleSpaceStore';
import { saveDatingRecords } from './datingRecordsStore';
import { persistForumData } from './forumDataStore';
import { persistMeData } from './meDataStore';
import { persistMoments } from './momentsStore';
import { persistMusicData } from './musicDataStore';
import { persistPerception } from './perceptionStore';
import { STORAGE_KEYS } from './storageKeys';
import { persistUserProfile } from './userProfileStore';
import { persistVisualSettings } from './visualSettingsStore';
import { persistWalletData } from './walletDataStore';
import { saveCallHistory } from './callHistoryStore';
import { DEFAULT_FORUM_GLOBAL_SETTINGS } from '../../services/forum/forumGlobalSettings';

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

const EMPTY_WALLET_DATA: WalletData = {
  balance: 0,
  yuebaoBalance: 0,
  yuebaoInterest: 0,
  familyCards: [],
  paymentPassword: '',
  cards: [],
  transactions: [],
};

function persistIndexedDbOnly<T>(key: string, value: T): Promise<void> {
  return saveJsonRecord(key, value).catch((error) => {
    console.error(`[persistAppDataSnapshot] Failed to persist key "${key}" into IndexedDB`, error);
  });
}

export async function persistAppDataSnapshot(appData: AppData, fallbackAppData: AppData): Promise<void> {
  // Chat-domain persistence is handled independently so high-frequency message updates
  // do not get rewritten through the slower whole-app snapshot path.
  const normalizedCharacters = appData.characters ?? fallbackAppData.characters;
  const normalizedUserProfile = appData.userProfile ?? fallbackAppData.userProfile;
  const normalizedMasks = appData.masks ?? fallbackAppData.masks ?? [];
  const normalizedFavorites = appData.favorites ?? fallbackAppData.favorites ?? [];
  const normalizedPerception = appData.perception ?? fallbackAppData.perception;
  const normalizedWorldBooks = appData.worldBooks ?? fallbackAppData.worldBooks ?? [];
  const normalizedMoments = appData.moments ?? fallbackAppData.moments ?? [];
  const normalizedCallHistory = appData.callHistory ?? fallbackAppData.callHistory ?? [];
  const normalizedSavedDates = appData.savedDates ?? fallbackAppData.savedDates ?? [];
  const normalizedCollectedDates = appData.collectedDates ?? fallbackAppData.collectedDates ?? [];
  const normalizedVisualSettings = appData.visualSettings ?? fallbackAppData.visualSettings;
  const normalizedForumData = appData.forumData ?? fallbackAppData.forumData ?? EMPTY_FORUM_DATA;
  const normalizedMusicData = appData.musicData ?? fallbackAppData.musicData;
  const normalizedWalletData = appData.walletData ?? fallbackAppData.walletData ?? EMPTY_WALLET_DATA;
  const { coupleSpaceState, coupleSpace } = buildPersistableCoupleSpacePayload(
    appData.coupleSpaceState ?? fallbackAppData.coupleSpaceState,
    appData.coupleSpace ?? fallbackAppData.coupleSpace,
  );

  await Promise.all([
    saveCharacters(normalizedCharacters),
    persistUserProfile(normalizedUserProfile),
    persistMeData({
      masks: normalizedMasks,
      favorites: normalizedFavorites,
      worldBooks: normalizedWorldBooks,
    }),
    normalizedPerception ? persistPerception(normalizedPerception) : Promise.resolve(),
    persistMoments(normalizedMoments),
    saveCallHistory(normalizedCallHistory),
    saveDatingRecords({
      savedDates: normalizedSavedDates,
      collectedDates: normalizedCollectedDates,
    }),
    persistVisualSettings(normalizedVisualSettings),
    Promise.resolve(persistForumData(normalizedForumData)).then(() =>
      persistIndexedDbOnly(STORAGE_KEYS.forumData, normalizedForumData),
    ),
    Promise.resolve(persistCoupleSpace(coupleSpace, coupleSpaceState)).then(() =>
      persistIndexedDbOnly(STORAGE_KEYS.coupleSpace, coupleSpaceState),
    ),
    normalizedMusicData ? persistMusicData(normalizedMusicData) : Promise.resolve(),
    Promise.resolve(persistWalletData(normalizedWalletData)).then(() =>
      persistIndexedDbOnly(STORAGE_KEYS.walletData, normalizedWalletData),
    ),
  ]);
}

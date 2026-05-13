import type { AppData, ForumData, ForumSpectatorSettings, WalletData } from '../../types';
import { saveJsonRecord } from './browserJsonStore';
import { stripCharacterChatPreviewFieldsFromList } from './characterChatPreview';
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
import {
  normalizeCharactersWithNumericIds,
  normalizeForumRuntimeAuthorProfiles,
} from '../../services/social-id/stableNumericId';

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
    console.error(`[persistNonChatAppDataSnapshot] Failed to persist key "${key}" into IndexedDB`, error);
  });
}

export type PersistableNonChatAppDataSnapshot = {
  characters: AppData['characters'];
  userProfile: AppData['userProfile'];
  masks: AppData['masks'];
  favorites: AppData['favorites'];
  perception?: AppData['perception'];
  worldBooks: AppData['worldBooks'];
  moments: AppData['moments'];
  callHistory: NonNullable<AppData['callHistory']>;
  savedDates: NonNullable<AppData['savedDates']>;
  collectedDates: NonNullable<AppData['collectedDates']>;
  visualSettings: AppData['visualSettings'];
  forumData: ForumData;
  musicData?: AppData['musicData'];
  walletData: WalletData;
  coupleSpace: AppData['coupleSpace'];
  coupleSpaceState: AppData['coupleSpaceState'];
};

export function buildPersistableNonChatAppDataSnapshot(
  appData: AppData,
  fallbackAppData: AppData,
): PersistableNonChatAppDataSnapshot {
  const normalizedCharacters = normalizeCharactersWithNumericIds(
    stripCharacterChatPreviewFieldsFromList(
      appData.characters ?? fallbackAppData.characters,
    ),
  );
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
  const forumDataSource = appData.forumData ?? fallbackAppData.forumData ?? EMPTY_FORUM_DATA;
  const normalizedForumData = {
    ...forumDataSource,
    runtimeAuthorProfiles: normalizeForumRuntimeAuthorProfiles(
      forumDataSource.runtimeAuthorProfiles,
      normalizedCharacters,
    ),
  };
  const normalizedMusicData = appData.musicData ?? fallbackAppData.musicData;
  const normalizedWalletData = appData.walletData ?? fallbackAppData.walletData ?? EMPTY_WALLET_DATA;
  const { coupleSpaceState, coupleSpace } = buildPersistableCoupleSpacePayload(
    appData.coupleSpaceState ?? fallbackAppData.coupleSpaceState,
    appData.coupleSpace ?? fallbackAppData.coupleSpace,
  );

  return {
    characters: normalizedCharacters,
    userProfile: normalizedUserProfile,
    masks: normalizedMasks,
    favorites: normalizedFavorites,
    perception: normalizedPerception,
    worldBooks: normalizedWorldBooks,
    moments: normalizedMoments,
    callHistory: normalizedCallHistory,
    savedDates: normalizedSavedDates,
    collectedDates: normalizedCollectedDates,
    visualSettings: normalizedVisualSettings,
    forumData: normalizedForumData,
    musicData: normalizedMusicData,
    walletData: normalizedWalletData,
    coupleSpace,
    coupleSpaceState,
  };
}

export async function persistNonChatAppDataSnapshot(
  snapshot: PersistableNonChatAppDataSnapshot,
): Promise<void> {
  await Promise.all([
    saveCharacters(snapshot.characters),
    persistUserProfile(snapshot.userProfile),
    persistMeData({
      masks: snapshot.masks,
      favorites: snapshot.favorites,
      worldBooks: snapshot.worldBooks,
    }),
    snapshot.perception ? persistPerception(snapshot.perception) : Promise.resolve(),
    persistMoments(snapshot.moments),
    saveCallHistory(snapshot.callHistory),
    saveDatingRecords({
      savedDates: snapshot.savedDates,
      collectedDates: snapshot.collectedDates,
    }),
    persistVisualSettings(snapshot.visualSettings),
    Promise.resolve(persistForumData(snapshot.forumData)).then(() =>
      persistIndexedDbOnly(STORAGE_KEYS.forumData, snapshot.forumData),
    ),
    Promise.resolve(persistCoupleSpace(snapshot.coupleSpace, snapshot.coupleSpaceState)).then(() =>
      persistIndexedDbOnly(STORAGE_KEYS.coupleSpace, snapshot.coupleSpaceState),
    ),
    snapshot.musicData ? persistMusicData(snapshot.musicData) : Promise.resolve(),
    Promise.resolve(persistWalletData(snapshot.walletData)).then(() =>
      persistIndexedDbOnly(STORAGE_KEYS.walletData, snapshot.walletData),
    ),
  ]);
}

import type { AppData, ForumData, WalletData } from '../../types';
import { saveJsonRecord } from './browserJsonStore';
import {
  extractDirectFactTraces,
  extractDirectRelationshipWaves,
  extractGroupSessions,
  saveChatHistoryRecords,
} from './chatHistoryStore';
import { saveCharacters } from './charactersStore';
import { buildPersistableCoupleSpacePayload, persistCoupleSpace } from './coupleSpaceStore';
import { saveDatingRecords } from './datingRecordsStore';
import { persistForumData } from './forumDataStore';
import { persistFriendRequests } from './friendRequestsStore';
import { persistMeData } from './meDataStore';
import { persistMoments } from './momentsStore';
import { persistMusicData } from './musicDataStore';
import { STORAGE_KEYS } from './storageKeys';
import { persistUserProfile } from './userProfileStore';
import { persistVisualSettings } from './visualSettingsStore';
import { persistWalletData } from './walletDataStore';
import { persistChatOrganization } from './chatOrganizationStore';
import { saveCallHistory } from './callHistoryStore';

const EMPTY_FORUM_DATA: ForumData = {
  posts: [],
  notifications: [],
  followedUsers: [],
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
  const normalizedCharacters = appData.characters ?? fallbackAppData.characters;
  const normalizedDirectHistory = appData.chatHistory ?? fallbackAppData.chatHistory ?? {};
  const normalizedChatGroups = appData.chatGroups ?? fallbackAppData.chatGroups ?? [];
  const normalizedGroups = appData.groups ?? fallbackAppData.groups ?? [];
  const normalizedUserProfile = appData.userProfile ?? fallbackAppData.userProfile;
  const normalizedMasks = appData.masks ?? fallbackAppData.masks ?? [];
  const normalizedFavorites = appData.favorites ?? fallbackAppData.favorites ?? [];
  const normalizedWorldBooks = appData.worldBooks ?? fallbackAppData.worldBooks ?? [];
  const normalizedMoments = appData.moments ?? fallbackAppData.moments ?? [];
  const normalizedFriendRequests = appData.friendRequests ?? fallbackAppData.friendRequests ?? [];
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
    saveChatHistoryRecords({
      directHistory: normalizedDirectHistory,
      directRelationshipWaves: extractDirectRelationshipWaves(normalizedDirectHistory),
      directFactTraces: extractDirectFactTraces(normalizedDirectHistory),
      groupSessions: extractGroupSessions(normalizedChatGroups),
    }),
    persistChatOrganization({
      groups: normalizedGroups,
      chatGroups: normalizedChatGroups,
    }),
    persistUserProfile(normalizedUserProfile),
    persistMeData({
      masks: normalizedMasks,
      favorites: normalizedFavorites,
      worldBooks: normalizedWorldBooks,
    }),
    persistMoments(normalizedMoments),
    Promise.resolve(persistFriendRequests(normalizedFriendRequests)).then(() =>
      persistIndexedDbOnly(STORAGE_KEYS.friendRequests, normalizedFriendRequests),
    ),
    saveCallHistory(normalizedCallHistory),
    saveDatingRecords({
      savedDates: normalizedSavedDates,
      collectedDates: normalizedCollectedDates,
    }),
    persistVisualSettings(normalizedVisualSettings),
    Promise.resolve(persistForumData(normalizedForumData)).then(() =>
      persistIndexedDbOnly(STORAGE_KEYS.forumData, normalizedForumData),
    ),
    Promise.resolve(persistCoupleSpace(coupleSpace)).then(() =>
      persistIndexedDbOnly(STORAGE_KEYS.coupleSpace, coupleSpaceState),
    ),
    Promise.resolve(normalizedMusicData ? persistMusicData(normalizedMusicData) : undefined).then(() =>
      normalizedMusicData ? persistIndexedDbOnly(STORAGE_KEYS.musicData, normalizedMusicData) : Promise.resolve(),
    ),
    Promise.resolve(persistWalletData(normalizedWalletData)).then(() =>
      persistIndexedDbOnly(STORAGE_KEYS.walletData, normalizedWalletData),
    ),
  ]);
}

/// <reference lib="webworker" />

import type { AppData, AppSettings, Character, ChatGroup } from '../../types';
import {
  buildModularBackupArchive,
  buildSingleFileModularBackupBundle,
} from './backupArchive';
import { loadJsonRecord } from './browserJsonStore';
import type { ChatOrganizationData } from './chatOrganizationStore';
import {
  loadPreferredChatHistoryRecords,
  mergeDirectSessionMetadataIntoCharacters,
  mergeGroupSessionsIntoChatGroups,
  type PersistedChatHistoryData,
} from './chatHistoryStore';
import { loadPreferredFriendRequests } from './friendRequestsStore';
import { STORAGE_KEYS } from './storageKeys';

type BackupExportWorkerMode = 'full' | 'split';

type BackupExportWorkerRequest = {
  type: 'build';
  mode: BackupExportWorkerMode;
  timestamp: number;
};

type BackupExportWorkerProgress = {
  type: 'progress';
  message: string;
};

type BackupExportWorkerSuccess = {
  type: 'result';
  assetCount: number;
  files: Array<{
    blob: Blob;
    fileName: string;
  }>;
};

type BackupExportWorkerError = {
  type: 'error';
  message: string;
};

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

const EMPTY_CHAT_HISTORY: PersistedChatHistoryData = {
  directHistory: {},
  directSessionMetadata: {},
  directRelationshipWaves: {},
  directFactTraces: {},
  groupSessions: {},
};

async function loadPersistedBackupAppData(): Promise<Partial<AppData>> {
  workerScope.postMessage({
    type: 'progress',
    message: '正在读取聊天记录...',
  } satisfies BackupExportWorkerProgress);

  const persistedChatHistory = await loadPreferredChatHistoryRecords(EMPTY_CHAT_HISTORY);

  workerScope.postMessage({
    type: 'progress',
    message: '正在整理模块数据...',
  } satisfies BackupExportWorkerProgress);

  const [
    persistedCharacters,
    persistedChatOrganization,
    meData,
    perception,
    userProfile,
    moments,
    forumData,
    coupleSpaceState,
    callHistory,
    datingRecords,
    visualSettings,
    musicData,
    walletData,
  ] = await Promise.all([
    loadJsonRecord<Character[]>(STORAGE_KEYS.characters).catch(() => null),
    loadJsonRecord<ChatOrganizationData>(STORAGE_KEYS.chatOrganization).catch(() => null),
    loadJsonRecord<Record<string, unknown>>(STORAGE_KEYS.meData).catch(() => null),
    loadJsonRecord<unknown>(STORAGE_KEYS.perception).catch(() => null),
    loadJsonRecord<unknown>(STORAGE_KEYS.userProfile).catch(() => null),
    loadJsonRecord<unknown[]>(STORAGE_KEYS.moments).catch(() => null),
    loadJsonRecord<unknown>(STORAGE_KEYS.forumData).catch(() => null),
    loadJsonRecord<unknown>(STORAGE_KEYS.coupleSpace).catch(() => null),
    loadJsonRecord<unknown[]>(STORAGE_KEYS.callHistory).catch(() => null),
    loadJsonRecord<Record<string, unknown>>(STORAGE_KEYS.datingRecords).catch(() => null),
    loadJsonRecord<unknown>(STORAGE_KEYS.visualSettings).catch(() => null),
    loadJsonRecord<unknown>(STORAGE_KEYS.musicData).catch(() => null),
    loadJsonRecord<unknown>(STORAGE_KEYS.walletData).catch(() => null),
  ]);
  const friendRequests = await loadPreferredFriendRequests([]).catch(() => []);

  const characters = mergeDirectSessionMetadataIntoCharacters(
    Array.isArray(persistedCharacters) ? persistedCharacters : [],
    persistedChatHistory,
  );
  const organization = persistedChatOrganization ?? {
    groups: [],
    chatGroups: [],
  };
  const chatGroups = mergeGroupSessionsIntoChatGroups(
    Array.isArray(organization.chatGroups) ? organization.chatGroups as ChatGroup[] : [],
    persistedChatHistory.groupSessions,
  );
  const normalizedMeData = meData ?? {};
  const normalizedDatingRecords = datingRecords ?? {};

  return {
    characters,
    chatHistory: persistedChatHistory.directHistory,
    groups: Array.isArray(organization.groups) ? organization.groups : [],
    chatGroups,
    perception: (perception ?? {}) as AppData['perception'],
    userProfile: (userProfile ?? {}) as AppData['userProfile'],
    moments: Array.isArray(moments) ? moments : [],
    forumData: (forumData ?? {}) as AppData['forumData'],
    coupleSpaceState: (coupleSpaceState ?? {}) as AppData['coupleSpaceState'],
    friendRequests,
    callHistory: Array.isArray(callHistory) ? callHistory : [],
    savedDates: Array.isArray(normalizedDatingRecords.savedDates) ? normalizedDatingRecords.savedDates : [],
    collectedDates: Array.isArray(normalizedDatingRecords.collectedDates) ? normalizedDatingRecords.collectedDates : [],
    visualSettings: (visualSettings ?? {}) as AppData['visualSettings'],
    masks: Array.isArray(normalizedMeData.masks) ? normalizedMeData.masks : [],
    favorites: Array.isArray(normalizedMeData.favorites) ? normalizedMeData.favorites : [],
    worldBooks: Array.isArray(normalizedMeData.worldBooks) ? normalizedMeData.worldBooks : [],
    userAvatarLibrary: normalizedMeData.userAvatarLibrary ?? { entries: [], updatedAt: 0 },
    relationshipAvatarBindings: Array.isArray(normalizedMeData.relationshipAvatarBindings)
      ? normalizedMeData.relationshipAvatarBindings
      : [],
    musicData: (musicData ?? {}) as AppData['musicData'],
    walletData: (walletData ?? {}) as AppData['walletData'],
  };
}

function buildJsonBlob(payload: unknown): Blob {
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

async function handleBuildRequest(request: BackupExportWorkerRequest): Promise<void> {
  const [appData, settings] = await Promise.all([
    loadPersistedBackupAppData(),
    loadJsonRecord<AppSettings>(STORAGE_KEYS.settings).catch(() => null),
  ]);

  workerScope.postMessage({
    type: 'progress',
    message: request.mode === 'full' ? '正在后台生成完整备份...' : '正在后台生成分批备份...',
  } satisfies BackupExportWorkerProgress);

  if (request.mode === 'split') {
    const bundle = await buildSingleFileModularBackupBundle({
      appData,
      settings: settings ?? ({} as AppSettings),
    });

    workerScope.postMessage({
      type: 'progress',
      message: bundle.assetsArchive ? '正在整理单文件备份包...' : '正在整理主数据包...',
    } satisfies BackupExportWorkerProgress);

    workerScope.postMessage({
      type: 'result',
      assetCount: bundle.dataArchive.assetCount,
      files: [
        {
          fileName: `split_backup_${request.timestamp}.json`,
          blob: buildJsonBlob(bundle),
        },
      ],
    } satisfies BackupExportWorkerSuccess);
    return;
  }

  const archive = await buildModularBackupArchive({
    appData,
    settings: settings ?? ({} as AppSettings),
  });

  workerScope.postMessage({
    type: 'progress',
    message: '正在整理完整备份文件...',
  } satisfies BackupExportWorkerProgress);

  workerScope.postMessage({
    type: 'result',
    assetCount: archive.assets.length,
    files: [
      {
        fileName: `full_backup_${request.timestamp}.json`,
        blob: buildJsonBlob(archive),
      },
    ],
  } satisfies BackupExportWorkerSuccess);
}

workerScope.onmessage = (event: MessageEvent<BackupExportWorkerRequest>) => {
  const request = event.data;
  if (request?.type !== 'build') {
    return;
  }

  void handleBuildRequest(request).catch((error) => {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : '后台备份失败',
    } satisfies BackupExportWorkerError);
  });
};

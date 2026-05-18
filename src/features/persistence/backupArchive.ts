import type { AppData, AppSettings } from '../../types';
import { clearAssets, listAssets, putAsset, type StoredAssetRecord } from './browserDb';
import { listJsonRecordKeys, loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { removeLocalStorageValue, syncLocalStorageJsonValue } from './localConfigStore';
import { createUploadedAssetRef } from './persistentAssetRef';
import { STORAGE_KEYS } from './storageKeys';
import { buildPersistableCoupleSpacePayload } from './coupleSpaceStore';
import {
  buildCharacterMemoryRecord,
  stripCharacterMemoryFromCharacters,
} from './characterMemoryStore';
import { buildMemoryRecordDataFromChatHistory } from '../../services/memory/buildMemoryRecordData';
import { mergeLegacyCharacterMemoryRecordIntoMemoryRecordData } from '../../services/memory/memoryRecordSnapshots';
import { loadMemoryRecordData } from './memoryRecordStore';
import {
  extractDirectFactTraces,
  extractDirectRelationshipWaves,
  extractDirectSessionMetadata,
  extractGroupSessions,
} from './chatHistoryStore';

export const FULL_BACKUP_ARCHIVE_FORMAT = 'bloom-full-backup';
export const FULL_BACKUP_ARCHIVE_VERSION = 1;
export const MODULAR_BACKUP_ARCHIVE_SCHEMA = 'modular-persistence';
export const MODULAR_BACKUP_ARCHIVE_VERSION = 2;
export const MODULAR_BACKUP_DATA_SCHEMA = 'modular-persistence-data';
export const MODULAR_BACKUP_DATA_VERSION = 1;
export const MODULAR_BACKUP_ASSETS_SCHEMA = 'modular-persistence-assets';
export const MODULAR_BACKUP_ASSETS_VERSION = 1;

export type SerializedAssetRecord = Omit<StoredAssetRecord, 'blob'> & {
  dataUrl: string;
};

export type FullBackupArchive = {
  format: typeof FULL_BACKUP_ARCHIVE_FORMAT;
  version: typeof FULL_BACKUP_ARCHIVE_VERSION;
  exportedAt: string;
  storage: Record<string, unknown | null>;
  assets: SerializedAssetRecord[];
};

export type ModularBackupModules = {
  settings: unknown;
  characters: unknown;
  // Deprecated compatibility module. Memory content should live in memoryRecords.
  characterMemory: unknown;
  memoryRecords: unknown;
  chatHistory: unknown;
  chatOrganization: unknown;
  perception: unknown;
  userProfile: unknown;
  moments: unknown;
  forumData: unknown;
  coupleSpace: unknown;
  datingRecords: unknown;
  friendRequests: unknown;
  meData: unknown;
  musicData: unknown;
  walletData: unknown;
  callHistory: unknown;
  visualSettings: unknown;
  wechatRoleBindings: unknown;
  wechatBindSessions: unknown;
};

export type ModularBackupArchive = {
  version: typeof MODULAR_BACKUP_ARCHIVE_VERSION;
  schema: typeof MODULAR_BACKUP_ARCHIVE_SCHEMA;
  exportedAt: number;
  modules: ModularBackupModules;
  assets: SerializedAssetRecord[];
};

export type ModularBackupDataArchive = {
  version: typeof MODULAR_BACKUP_DATA_VERSION;
  schema: typeof MODULAR_BACKUP_DATA_SCHEMA;
  backupId: string;
  exportedAt: number;
  modules: ModularBackupModules;
  assetCount: number;
};

export type ModularBackupAssetsArchive = {
  version: typeof MODULAR_BACKUP_ASSETS_VERSION;
  schema: typeof MODULAR_BACKUP_ASSETS_SCHEMA;
  backupId: string;
  exportedAt: number;
  assets: SerializedAssetRecord[];
};

export type BackupRestoreProgress = {
  phase: 'modules' | 'assets' | 'complete';
  completed: number;
  total: number;
  message: string;
};

type FullBackupOverrides = {
  appData?: unknown;
  settings?: unknown;
  visualSettings?: unknown;
  characters?: unknown;
  userProfile?: unknown;
};

type ModularBackupOverrides = {
  appData: Partial<AppData> | null | undefined;
  settings: AppSettings | unknown;
  modules?: Partial<ModularBackupModules>;
};

const INDEXED_DB_RESTORE_KEYS = new Set<string>(
  Object.values(STORAGE_KEYS).filter((key) => key !== STORAGE_KEYS.appData),
);
const EXTRA_LOCAL_RESET_KEYS = new Set([
  'dream_app_archive_records_v1',
  'monitor_characters',
]);
const EXTRA_LOCAL_RESET_PREFIXES = [
  'memory_window_hint_dismissed_',
  'group_notice_dismissed:',
] as const;
const ASSET_RESTORE_BATCH_SIZE = 6;

type RestoreOptions = {
  onProgress?: (progress: BackupRestoreProgress) => void;
};

type RestoreEntry = {
  key: string;
  value: unknown | null;
};

function createArchiveAssetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ua_${crypto.randomUUID()}`;
  }

  return `ua_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createBackupBundleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `backup_${crypto.randomUUID()}`;
  }

  return `backup_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('无法将资源转换为 data URL'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取资源失败'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;,]+)(?:;[^,]+)?,(.+)$/i);
  if (!match?.[1] || !match?.[2]) {
    throw new Error('备份中的资源 data URL 无效');
  }

  const mimeType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function readStoredJson(key: string): unknown | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    console.error(`[backupArchive] Failed to parse localStorage key "${key}"`, error);
    return null;
  }
}

function collectStorageSnapshot(overrides?: FullBackupOverrides): Record<string, unknown | null> {
  const storage = Object.values(STORAGE_KEYS).reduce<Record<string, unknown | null>>((acc, key) => {
    acc[key] = readStoredJson(key);
    return acc;
  }, {});

  if (overrides?.settings !== undefined) {
    storage[STORAGE_KEYS.settings] = overrides.settings;
  }
  if (overrides?.appData !== undefined) {
    storage[STORAGE_KEYS.appData] = overrides.appData;
  }
  if (overrides?.visualSettings !== undefined) {
    storage[STORAGE_KEYS.visualSettings] = overrides.visualSettings;
  }
  if (overrides?.characters !== undefined) {
    storage[STORAGE_KEYS.characters] = overrides.characters;
  }
  if (overrides?.userProfile !== undefined) {
    storage[STORAGE_KEYS.userProfile] = overrides.userProfile;
  }

  return storage;
}

async function collectSerializedAssets(): Promise<SerializedAssetRecord[]> {
  let assets: StoredAssetRecord[] = [];
  try {
    assets = await listAssets();
  } catch (error) {
    console.warn('[backupArchive] Failed to list IndexedDB assets during export, continuing with JSON-only backup', error);
    return [];
  }

  return Promise.all(
    assets.map(async (asset) => ({
      id: asset.id,
      kind: asset.kind,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      source: asset.source,
      originalUrl: asset.originalUrl,
      dataUrl: await blobToDataUrl(asset.blob),
    })),
  );
}

function buildModularBackupModules({ appData, settings, modules }: ModularBackupOverrides): ModularBackupModules {
  const resolvedAppData = (appData || {}) as Partial<AppData>;
  const { coupleSpaceState } = buildPersistableCoupleSpacePayload(
    resolvedAppData.coupleSpaceState,
    resolvedAppData.coupleSpace,
  );
  const characters = resolvedAppData.characters ?? [];
  const directHistory = resolvedAppData.chatHistory ?? {};
  const chatGroups = resolvedAppData.chatGroups ?? [];
  const persistedChatHistory = {
    directHistory,
    directSessionMetadata: extractDirectSessionMetadata(characters, directHistory),
    directRelationshipWaves: extractDirectRelationshipWaves(directHistory),
    directFactTraces: extractDirectFactTraces(directHistory),
    groupSessions: extractGroupSessions(chatGroups),
  };
  const legacyCharacterMemory = buildCharacterMemoryRecord(characters);
  const fallbackMemoryRecords = buildMemoryRecordDataFromChatHistory(persistedChatHistory);
  const mergedMemoryRecords = mergeLegacyCharacterMemoryRecordIntoMemoryRecordData(
    (
      modules?.memoryRecords
      && typeof modules.memoryRecords === 'object'
      && !Array.isArray(modules.memoryRecords)
        ? modules.memoryRecords
        : loadMemoryRecordData(fallbackMemoryRecords)
    ) as ReturnType<typeof loadMemoryRecordData>,
    legacyCharacterMemory,
  );

  return {
    settings,
    characters: stripCharacterMemoryFromCharacters(characters),
    characterMemory: {},
    memoryRecords: mergedMemoryRecords,
    chatHistory: persistedChatHistory,
    chatOrganization: {
      groups: resolvedAppData.groups ?? [],
      chatGroups,
    },
    perception: resolvedAppData.perception ?? {},
    userProfile: resolvedAppData.userProfile ?? {},
    moments: resolvedAppData.moments ?? [],
    forumData: resolvedAppData.forumData ?? {},
    coupleSpace: coupleSpaceState ?? {},
    datingRecords: {
      savedDates: resolvedAppData.savedDates ?? [],
      collectedDates: resolvedAppData.collectedDates ?? [],
    },
    friendRequests: resolvedAppData.friendRequests ?? [],
    meData: {
      masks: resolvedAppData.masks ?? [],
      favorites: resolvedAppData.favorites ?? [],
      worldBooks: resolvedAppData.worldBooks ?? [],
      userAvatarLibrary: resolvedAppData.userAvatarLibrary ?? { entries: [], updatedAt: 0 },
      relationshipAvatarBindings: resolvedAppData.relationshipAvatarBindings ?? [],
    },
    musicData: resolvedAppData.musicData ?? {},
    walletData: resolvedAppData.walletData ?? {},
    callHistory: resolvedAppData.callHistory ?? [],
    visualSettings: resolvedAppData.visualSettings ?? {},
    wechatRoleBindings: modules?.wechatRoleBindings ?? [],
    wechatBindSessions: modules?.wechatBindSessions ?? [],
  };
}

async function collectIndexedDbModules(): Promise<Partial<ModularBackupModules>> {
  const keys = [
    STORAGE_KEYS.wechatRoleBindings,
    STORAGE_KEYS.wechatBindSessions,
  ] as const;

  const [wechatRoleBindings, wechatBindSessions] = await Promise.all(
    keys.map((key) => loadJsonRecord<unknown>(key).catch(() => null)),
  );

  return {
    wechatRoleBindings: wechatRoleBindings ?? [],
    wechatBindSessions: wechatBindSessions ?? [],
  };
}

async function normalizeBlobUrlsInValue(
  value: unknown,
  remappedAssets: SerializedAssetRecord[],
  blobUrlMap: Map<string, string>,
): Promise<unknown> {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^blob:/i.test(trimmed)) {
      return value;
    }

    const existingRef = blobUrlMap.get(trimmed);
    if (existingRef) {
      return existingRef;
    }

    try {
      const response = await fetch(trimmed);
      const blob = await response.blob();
      const id = createArchiveAssetId();
      const assetRef = createUploadedAssetRef(id);
      remappedAssets.push({
        id,
        kind: blob.type.startsWith('image/') ? 'image' : 'file',
        mimeType: blob.type || 'application/octet-stream',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'upload',
        dataUrl: await blobToDataUrl(blob),
      });
      blobUrlMap.set(trimmed, assetRef);
      return assetRef;
    } catch (error) {
      console.warn('[backupArchive] Failed to normalize blob URL during export', trimmed, error);
      return value;
    }
  }

  if (Array.isArray(value)) {
    const nextItems = await Promise.all(
      value.map((item) => normalizeBlobUrlsInValue(item, remappedAssets, blobUrlMap)),
    );
    return nextItems;
  }

  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, entryValue]) => [
        key,
        await normalizeBlobUrlsInValue(entryValue, remappedAssets, blobUrlMap),
      ] as const),
    );
    return Object.fromEntries(entries);
  }

  return value;
}

async function normalizeBlobUrlsInStorage(
  storage: Record<string, unknown | null>,
): Promise<{ storage: Record<string, unknown | null>; assets: SerializedAssetRecord[] }> {
  const remappedAssets: SerializedAssetRecord[] = [];
  const blobUrlMap = new Map<string, string>();
  const entries = await Promise.all(
    Object.entries(storage).map(async ([key, value]) => [
      key,
      await normalizeBlobUrlsInValue(value, remappedAssets, blobUrlMap),
    ] as const),
  );

  return {
    storage: Object.fromEntries(entries),
    assets: remappedAssets,
  };
}

export async function buildFullBackupArchive(overrides?: FullBackupOverrides): Promise<FullBackupArchive> {
  const baseStorage = collectStorageSnapshot(overrides);
  const existingAssets = await collectSerializedAssets();
  const normalized = await normalizeBlobUrlsInStorage(baseStorage);

  return {
    format: FULL_BACKUP_ARCHIVE_FORMAT,
    version: FULL_BACKUP_ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    storage: normalized.storage,
    assets: [...existingAssets, ...normalized.assets],
  };
}

export async function buildModularBackupArchive(overrides: ModularBackupOverrides): Promise<ModularBackupArchive> {
  const indexedDbModules = await collectIndexedDbModules();
  const baseModules = buildModularBackupModules({
    ...overrides,
    modules: {
      ...indexedDbModules,
      ...(overrides.modules || {}),
    },
  });
  const existingAssets = await collectSerializedAssets();
  const remappedAssets: SerializedAssetRecord[] = [];
  const normalized = await normalizeBlobUrlsInValue(baseModules, remappedAssets, new Map<string, string>());

  return {
    version: MODULAR_BACKUP_ARCHIVE_VERSION,
    schema: MODULAR_BACKUP_ARCHIVE_SCHEMA,
    exportedAt: Date.now(),
    modules: normalized as ModularBackupModules,
    assets: [...existingAssets, ...remappedAssets],
  };
}

export async function buildSplitModularBackupBundle(
  overrides: ModularBackupOverrides,
): Promise<{
  dataArchive: ModularBackupDataArchive;
  assetsArchive: ModularBackupAssetsArchive | null;
}> {
  const archive = await buildModularBackupArchive(overrides);
  const backupId = createBackupBundleId();
  const dataArchive: ModularBackupDataArchive = {
    version: MODULAR_BACKUP_DATA_VERSION,
    schema: MODULAR_BACKUP_DATA_SCHEMA,
    backupId,
    exportedAt: archive.exportedAt,
    modules: archive.modules,
    assetCount: archive.assets.length,
  };

  const assetsArchive = archive.assets.length > 0
    ? {
        version: MODULAR_BACKUP_ASSETS_VERSION,
        schema: MODULAR_BACKUP_ASSETS_SCHEMA,
        backupId,
        exportedAt: archive.exportedAt,
        assets: archive.assets,
      } satisfies ModularBackupAssetsArchive
    : null;

  return {
    dataArchive,
    assetsArchive,
  };
}

export function isFullBackupArchive(value: unknown): value is FullBackupArchive {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<FullBackupArchive>;
  return candidate.format === FULL_BACKUP_ARCHIVE_FORMAT
    && typeof candidate.version === 'number'
    && !!candidate.storage
    && typeof candidate.storage === 'object'
    && !Array.isArray(candidate.storage)
    && Array.isArray(candidate.assets);
}

export function isModularBackupArchive(value: unknown): value is ModularBackupArchive {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<ModularBackupArchive>;
  return candidate.schema === MODULAR_BACKUP_ARCHIVE_SCHEMA
    && candidate.version === MODULAR_BACKUP_ARCHIVE_VERSION
    && !!candidate.modules
    && typeof candidate.modules === 'object'
    && !Array.isArray(candidate.modules);
}

export function isModularBackupDataArchive(value: unknown): value is ModularBackupDataArchive {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<ModularBackupDataArchive>;
  return candidate.schema === MODULAR_BACKUP_DATA_SCHEMA
    && candidate.version === MODULAR_BACKUP_DATA_VERSION
    && typeof candidate.backupId === 'string'
    && typeof candidate.exportedAt === 'number'
    && !!candidate.modules
    && typeof candidate.modules === 'object'
    && !Array.isArray(candidate.modules);
}

export function isModularBackupAssetsArchive(value: unknown): value is ModularBackupAssetsArchive {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<ModularBackupAssetsArchive>;
  return candidate.schema === MODULAR_BACKUP_ASSETS_SCHEMA
    && candidate.version === MODULAR_BACKUP_ASSETS_VERSION
    && typeof candidate.backupId === 'string'
    && typeof candidate.exportedAt === 'number'
    && Array.isArray(candidate.assets);
}

function writeStorageValue(key: string, value: unknown | null, indexedDbWrites: Promise<void>[]) {
  if (value == null) {
    removeLocalStorageValue(key);
    if (INDEXED_DB_RESTORE_KEYS.has(key)) {
      indexedDbWrites.push(
        removeJsonRecord(key).catch((error) => {
          console.error(`[backupArchive] Failed to clear IndexedDB key "${key}" during restore`, error);
        }),
      );
    }
    return;
  }

  syncLocalStorageJsonValue(key, value);
  if (INDEXED_DB_RESTORE_KEYS.has(key)) {
    indexedDbWrites.push(
      saveJsonRecord(key, value).catch((error) => {
        console.error(`[backupArchive] Failed to restore IndexedDB key "${key}"`, error);
      }),
    );
  }
}

function emitRestoreProgress(
  options: RestoreOptions | undefined,
  progress: BackupRestoreProgress,
): void {
  options?.onProgress?.(progress);
}

function nextRestoreTick(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

async function restoreEntriesBatch(entries: RestoreEntry[]): Promise<void> {
  const indexedDbWrites: Promise<void>[] = [];
  entries.forEach((entry) => {
    writeStorageValue(entry.key, entry.value, indexedDbWrites);
  });
  await Promise.all(indexedDbWrites);
}

async function restoreAssetsBatch(assets: SerializedAssetRecord[]): Promise<void> {
  await Promise.all(
    assets.map((asset) =>
      putAsset({
        id: asset.id,
        kind: asset.kind,
        mimeType: asset.mimeType,
        blob: dataUrlToBlob(asset.dataUrl),
        fileName: asset.fileName,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
        source: asset.source,
        originalUrl: asset.originalUrl,
      }).catch((error) => {
        console.error('[backupArchive] Failed to restore asset into IndexedDB', error);
      }),
    ),
  );
}

async function restoreEntriesInBatches(
  batches: Array<{ message: string; entries: RestoreEntry[] }>,
  options?: RestoreOptions,
): Promise<void> {
  const total = batches.length;
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    emitRestoreProgress(options, {
      phase: 'modules',
      completed: index,
      total,
      message: batch.message,
    });
    await restoreEntriesBatch(batch.entries);
    emitRestoreProgress(options, {
      phase: 'modules',
      completed: index + 1,
      total,
      message: batch.message,
    });
    await nextRestoreTick();
  }
}

async function restoreAssetsInBatches(
  assets: SerializedAssetRecord[],
  options?: RestoreOptions,
): Promise<void> {
  if (assets.length === 0) {
    emitRestoreProgress(options, {
      phase: 'assets',
      completed: 0,
      total: 0,
      message: '本地资源恢复完成',
    });
    return;
  }

  const total = Math.ceil(assets.length / ASSET_RESTORE_BATCH_SIZE);
  for (let index = 0; index < assets.length; index += ASSET_RESTORE_BATCH_SIZE) {
    const chunk = assets.slice(index, index + ASSET_RESTORE_BATCH_SIZE);
    const completed = Math.floor(index / ASSET_RESTORE_BATCH_SIZE);
    emitRestoreProgress(options, {
      phase: 'assets',
      completed,
      total,
      message: `正在恢复本地资源（${index + 1}-${Math.min(index + chunk.length, assets.length)} / ${assets.length}）`,
    });
    await restoreAssetsBatch(chunk);
    emitRestoreProgress(options, {
      phase: 'assets',
      completed: completed + 1,
      total,
      message: `正在恢复本地资源（${Math.min(index + chunk.length, assets.length)} / ${assets.length}）`,
    });
    await nextRestoreTick();
  }
}

export async function clearAllPersistentData(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Current environment does not support persistence reset');
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;

    if (
      Object.values(STORAGE_KEYS).includes(key as (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS])
      || EXTRA_LOCAL_RESET_KEYS.has(key)
      || EXTRA_LOCAL_RESET_PREFIXES.some((prefix) => key.startsWith(prefix))
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    window.localStorage.removeItem(key);
  });

  const [directChatShardKeys, groupChatShardKeys, memoryRecordShardKeys] = await Promise.all([
    listJsonRecordKeys(`${STORAGE_KEYS.chatHistory}:direct:`).catch(() => [] as string[]),
    listJsonRecordKeys(`${STORAGE_KEYS.chatHistory}:group:`).catch(() => [] as string[]),
    listJsonRecordKeys(`${STORAGE_KEYS.memoryRecords}:character:`).catch(() => [] as string[]),
  ]);

  await Promise.all([
    clearAssets().catch((error) => {
      console.error('[backupArchive] Failed to clear IndexedDB assets during reset', error);
    }),
    Promise.all(
      [
        ...Object.values(STORAGE_KEYS),
        ...directChatShardKeys,
        ...groupChatShardKeys,
        ...memoryRecordShardKeys,
      ].map((key) =>
        removeJsonRecord(key).catch((error) => {
          console.error(`[backupArchive] Failed to clear IndexedDB key "${key}" during reset`, error);
        }),
      ),
    ),
  ]);
}

function buildLegacyAppDataFromModules(modules: ModularBackupModules): Record<string, unknown> {
  const legacyCharacters = Array.isArray(modules.characters)
    ? modules.characters
    : [];

  return {
    characters: legacyCharacters,
    chatHistory: (modules.chatHistory as { directHistory?: unknown } | null | undefined)?.directHistory ?? {},
    groups: (modules.chatOrganization as { groups?: unknown } | null | undefined)?.groups ?? [],
    chatGroups: (modules.chatOrganization as { chatGroups?: unknown } | null | undefined)?.chatGroups ?? [],
    perception: modules.perception,
    userProfile: modules.userProfile,
    moments: modules.moments,
    forumData: modules.forumData,
    coupleSpaceState: modules.coupleSpace,
    friendRequests: modules.friendRequests,
    masks: (modules.meData as { masks?: unknown } | null | undefined)?.masks ?? [],
    favorites: (modules.meData as { favorites?: unknown } | null | undefined)?.favorites ?? [],
    worldBooks: (modules.meData as { worldBooks?: unknown } | null | undefined)?.worldBooks ?? [],
    userAvatarLibrary: (
      modules.meData as { userAvatarLibrary?: unknown } | null | undefined
    )?.userAvatarLibrary as AppData['userAvatarLibrary'],
    relationshipAvatarBindings: (
      modules.meData as { relationshipAvatarBindings?: unknown } | null | undefined
    )?.relationshipAvatarBindings as AppData['relationshipAvatarBindings'],
    callHistory: modules.callHistory,
    savedDates: (modules.datingRecords as { savedDates?: unknown } | null | undefined)?.savedDates ?? [],
    collectedDates: (modules.datingRecords as { collectedDates?: unknown } | null | undefined)?.collectedDates ?? [],
    visualSettings: modules.visualSettings,
    musicData: modules.musicData,
    walletData: modules.walletData,
  };
}

async function restoreModularModules(
  modules: ModularBackupModules,
  options?: RestoreOptions,
): Promise<void> {
  const normalizedModules: ModularBackupModules = {
    ...modules,
    characterMemory: {},
    memoryRecords: mergeLegacyCharacterMemoryRecordIntoMemoryRecordData(
      (
        modules.memoryRecords
        && typeof modules.memoryRecords === 'object'
        && !Array.isArray(modules.memoryRecords)
          ? modules.memoryRecords
          : { recordsByCharacterId: {} }
      ) as ReturnType<typeof loadMemoryRecordData>,
      (
        modules.characterMemory
        && typeof modules.characterMemory === 'object'
        && !Array.isArray(modules.characterMemory)
          ? modules.characterMemory
          : {}
      ) as ReturnType<typeof buildCharacterMemoryRecord>,
    ),
  };
  const batches: Array<{ message: string; entries: RestoreEntry[] }> = [
    {
      message: '正在恢复基础设置',
      entries: [
        { key: STORAGE_KEYS.settings, value: normalizedModules.settings },
        { key: STORAGE_KEYS.perception, value: normalizedModules.perception },
        { key: STORAGE_KEYS.userProfile, value: normalizedModules.userProfile },
        { key: STORAGE_KEYS.visualSettings, value: normalizedModules.visualSettings },
      ],
    },
    {
      message: '正在恢复角色与组织数据',
      entries: [
        { key: STORAGE_KEYS.characters, value: normalizedModules.characters },
        { key: STORAGE_KEYS.characterMemory, value: normalizedModules.characterMemory },
        { key: STORAGE_KEYS.memoryRecords, value: normalizedModules.memoryRecords },
        { key: STORAGE_KEYS.chatOrganization, value: normalizedModules.chatOrganization },
        { key: STORAGE_KEYS.meData, value: normalizedModules.meData },
        { key: STORAGE_KEYS.friendRequests, value: normalizedModules.friendRequests },
      ],
    },
    {
      message: '正在恢复聊天与约会记录',
      entries: [
        { key: STORAGE_KEYS.chatHistory, value: normalizedModules.chatHistory },
        { key: STORAGE_KEYS.callHistory, value: normalizedModules.callHistory },
        { key: STORAGE_KEYS.datingRecords, value: normalizedModules.datingRecords },
        { key: STORAGE_KEYS.wechatRoleBindings, value: normalizedModules.wechatRoleBindings },
        { key: STORAGE_KEYS.wechatBindSessions, value: normalizedModules.wechatBindSessions },
      ],
    },
    {
      message: '正在恢复世界内容与应用数据',
      entries: [
        { key: STORAGE_KEYS.moments, value: normalizedModules.moments },
        { key: STORAGE_KEYS.forumData, value: normalizedModules.forumData },
        { key: STORAGE_KEYS.coupleSpace, value: normalizedModules.coupleSpace },
        { key: STORAGE_KEYS.musicData, value: normalizedModules.musicData },
        { key: STORAGE_KEYS.walletData, value: normalizedModules.walletData },
        { key: STORAGE_KEYS.appData, value: buildLegacyAppDataFromModules(normalizedModules) },
      ],
    },
  ];

  await restoreEntriesInBatches(batches, options);
}

export async function restoreModularBackupDataArchive(
  archive: ModularBackupDataArchive,
  options?: RestoreOptions,
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Current environment does not support restore');
  }

  await restoreModularModules(archive.modules, options);
  emitRestoreProgress(options, {
    phase: 'complete',
    completed: 1,
    total: 1,
    message: '主数据包恢复完成',
  });
}

export async function restoreModularBackupAssetsArchive(
  archive: ModularBackupAssetsArchive,
  options?: RestoreOptions,
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Current environment does not support restore');
  }

  await restoreAssetsInBatches(archive.assets, options);
  emitRestoreProgress(options, {
    phase: 'complete',
    completed: 1,
    total: 1,
    message: '资源包恢复完成',
  });
}

export async function restoreFullBackupArchive(
  archive: FullBackupArchive,
  options?: RestoreOptions,
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持恢复本地备份');
  }

  const storageEntries = Object.entries(archive.storage);
  const chunkSize = 4;
  const batches = Array.from({ length: Math.ceil(storageEntries.length / chunkSize) }, (_, batchIndex) => {
    const start = batchIndex * chunkSize;
    return {
      message: `正在恢复第 ${batchIndex + 1} 批备份模块`,
      entries: storageEntries
        .slice(start, start + chunkSize)
        .map(([key, value]) => ({ key, value })),
    };
  });

  await restoreEntriesInBatches(batches, options);
  await restoreAssetsInBatches(archive.assets, options);
  emitRestoreProgress(options, {
    phase: 'complete',
    completed: 1,
    total: 1,
    message: '完整备份恢复完成',
  });
}

export async function restoreModularBackupArchive(
  archive: ModularBackupArchive,
  options?: RestoreOptions,
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Current environment does not support restore');
  }

  await restoreModularModules(archive.modules, options);
  await restoreAssetsInBatches(archive.assets, options);
  emitRestoreProgress(options, {
    phase: 'complete',
    completed: 1,
    total: 1,
    message: '模块化备份恢复完成',
  });
}

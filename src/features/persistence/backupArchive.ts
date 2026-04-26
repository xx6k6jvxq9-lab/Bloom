import type { AppData, AppSettings } from '../../types';
import { listAssets, putAsset, type StoredAssetRecord } from './browserDb';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { createUploadedAssetRef } from './persistentAssetRef';
import { STORAGE_KEYS } from './storageKeys';
import { buildPersistableCoupleSpacePayload } from './coupleSpaceStore';
import {
  extractDirectFactTraces,
  extractDirectRelationshipWaves,
  extractGroupSessions,
} from './chatHistoryStore';

export const FULL_BACKUP_ARCHIVE_FORMAT = 'bloom-full-backup';
export const FULL_BACKUP_ARCHIVE_VERSION = 1;
export const MODULAR_BACKUP_ARCHIVE_SCHEMA = 'modular-persistence';
export const MODULAR_BACKUP_ARCHIVE_VERSION = 2;

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
  chatHistory: unknown;
  chatOrganization: unknown;
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

function createArchiveAssetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ua_${crypto.randomUUID()}`;
  }

  return `ua_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
  const assets = await listAssets();
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
  const directHistory = resolvedAppData.chatHistory ?? {};
  const chatGroups = resolvedAppData.chatGroups ?? [];

  return {
    settings,
    characters: resolvedAppData.characters ?? [],
    chatHistory: {
      directHistory,
      directRelationshipWaves: extractDirectRelationshipWaves(directHistory),
      directFactTraces: extractDirectFactTraces(directHistory),
      groupSessions: extractGroupSessions(chatGroups),
    },
    chatOrganization: {
      groups: resolvedAppData.groups ?? [],
      chatGroups,
    },
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

function writeStorageValue(key: string, value: unknown | null, indexedDbWrites: Promise<void>[]) {
  if (value == null) {
    window.localStorage.removeItem(key);
    if (INDEXED_DB_RESTORE_KEYS.has(key)) {
      indexedDbWrites.push(
        removeJsonRecord(key).catch((error) => {
          console.error(`[backupArchive] Failed to clear IndexedDB key "${key}" during restore`, error);
        }),
      );
    }
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
  if (INDEXED_DB_RESTORE_KEYS.has(key)) {
    indexedDbWrites.push(
      saveJsonRecord(key, value).catch((error) => {
        console.error(`[backupArchive] Failed to restore IndexedDB key "${key}"`, error);
      }),
    );
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

  await Promise.all([
    clearAssets(),
    Promise.all(
      Object.values(STORAGE_KEYS).map((key) =>
        removeJsonRecord(key).catch((error) => {
          console.error(`[backupArchive] Failed to clear IndexedDB key "${key}" during reset`, error);
        }),
      ),
    ),
  ]);
}

function buildLegacyAppDataFromModules(modules: ModularBackupModules): Record<string, unknown> {
  return {
    characters: modules.characters,
    chatHistory: (modules.chatHistory as { directHistory?: unknown } | null | undefined)?.directHistory ?? {},
    groups: (modules.chatOrganization as { groups?: unknown } | null | undefined)?.groups ?? [],
    chatGroups: (modules.chatOrganization as { chatGroups?: unknown } | null | undefined)?.chatGroups ?? [],
    userProfile: modules.userProfile,
    moments: modules.moments,
    forumData: modules.forumData,
    coupleSpaceState: modules.coupleSpace,
    friendRequests: modules.friendRequests,
    masks: (modules.meData as { masks?: unknown } | null | undefined)?.masks ?? [],
    favorites: (modules.meData as { favorites?: unknown } | null | undefined)?.favorites ?? [],
    worldBooks: (modules.meData as { worldBooks?: unknown } | null | undefined)?.worldBooks ?? [],
    callHistory: modules.callHistory,
    savedDates: (modules.datingRecords as { savedDates?: unknown } | null | undefined)?.savedDates ?? [],
    collectedDates: (modules.datingRecords as { collectedDates?: unknown } | null | undefined)?.collectedDates ?? [],
    visualSettings: modules.visualSettings,
    musicData: modules.musicData,
    walletData: modules.walletData,
  };
}

export async function restoreFullBackupArchive(archive: FullBackupArchive): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持恢复本地备份');
  }

  const indexedDbWrites: Promise<void>[] = [];

  Object.entries(archive.storage).forEach(([key, value]) => {
    writeStorageValue(key, value, indexedDbWrites);
  });

  await Promise.all(
    archive.assets.map((asset) =>
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
      }),
    ),
  );

  await Promise.all(indexedDbWrites);
}

export async function restoreModularBackupArchive(archive: ModularBackupArchive): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Current environment does not support restore');
  }

  const indexedDbWrites: Promise<void>[] = [];
  const { modules } = archive;

  writeStorageValue(STORAGE_KEYS.settings, modules.settings, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.characters, modules.characters, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.chatHistory, modules.chatHistory, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.chatOrganization, modules.chatOrganization, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.userProfile, modules.userProfile, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.moments, modules.moments, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.forumData, modules.forumData, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.coupleSpace, modules.coupleSpace, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.datingRecords, modules.datingRecords, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.friendRequests, modules.friendRequests, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.meData, modules.meData, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.musicData, modules.musicData, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.walletData, modules.walletData, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.callHistory, modules.callHistory, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.visualSettings, modules.visualSettings, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.wechatRoleBindings, modules.wechatRoleBindings, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.wechatBindSessions, modules.wechatBindSessions, indexedDbWrites);
  writeStorageValue(STORAGE_KEYS.appData, buildLegacyAppDataFromModules(modules), indexedDbWrites);

  await Promise.all(
    archive.assets.map((asset) =>
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
      }),
    ),
  );

  await Promise.all(indexedDbWrites);
}

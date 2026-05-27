import { listAssets } from './browserDb';
import { listJsonRecordKeys, loadJsonRecord } from './browserJsonStore';
import { STORAGE_KEYS } from './storageKeys';

const CHAT_HISTORY_DIRECT_SESSION_PREFIX = `${STORAGE_KEYS.chatHistory}:direct:`;
const CHAT_HISTORY_GROUP_SESSION_PREFIX = `${STORAGE_KEYS.chatHistory}:group:`;
const DOWNLOAD_URL_REVOKE_DELAY_MS = 30_000;

export type BackupSizeEstimateResult = {
  assetBytes: number;
  moduleBytes: Record<string, number>;
};

function waitForTimeout(delayMs = 0): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

function getJsonSizeBytes(value: unknown): number {
  if (value == null) {
    return 0;
  }

  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

async function yieldToMainThread(): Promise<void> {
  await waitForTimeout(0);
}

async function loadPersistedValue<T>(key: string): Promise<T | undefined> {
  try {
    const value = await loadJsonRecord<T>(key);
    return value ?? undefined;
  } catch {
    return undefined;
  }
}

async function estimateStoredJsonSizeBytes<T>(key: string, fallbackValue: T): Promise<number> {
  const persistedValue = await loadPersistedValue<T>(key);
  return getJsonSizeBytes(persistedValue ?? fallbackValue);
}

async function estimateChatHistorySizeBytes(fallbackValue: unknown): Promise<number> {
  const [directKeys, groupKeys] = await Promise.all([
    listJsonRecordKeys(CHAT_HISTORY_DIRECT_SESSION_PREFIX).catch(() => [] as string[]),
    listJsonRecordKeys(CHAT_HISTORY_GROUP_SESSION_PREFIX).catch(() => [] as string[]),
  ]);

  const shardKeys = [...directKeys, ...groupKeys];
  if (shardKeys.length === 0) {
    return getJsonSizeBytes(fallbackValue);
  }

  let totalBytes = 0;
  for (const key of shardKeys) {
    totalBytes += await estimateStoredJsonSizeBytes(key, null);
    await yieldToMainThread();
  }

  return totalBytes;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export async function waitForNextPaint(): Promise<void> {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    await waitForTimeout(0);
    return;
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 0);
    });
  });
}

export async function downloadJsonFile(payload: unknown, fileName: string): Promise<void> {
  await waitForNextPaint();

  const json = JSON.stringify(payload, null, 2);
  await waitForNextPaint();

  const blob = new Blob([json], { type: 'application/json' });
  downloadBlobFile(blob, fileName);
}

export function downloadBlobFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  window.setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, DOWNLOAD_URL_REVOKE_DELAY_MS);
}

export async function estimateBackupModuleSizes(
  fallbackModuleData: Record<string, unknown>,
): Promise<BackupSizeEstimateResult> {
  const moduleBytes: Record<string, number> = {};

  const settings = await loadPersistedValue(STORAGE_KEYS.settings);
  moduleBytes.settings = getJsonSizeBytes(settings ?? fallbackModuleData.settings);
  await yieldToMainThread();

  const characters = await loadPersistedValue(STORAGE_KEYS.characters);
  moduleBytes.characters = getJsonSizeBytes(characters ?? fallbackModuleData.characters);
  await yieldToMainThread();

  moduleBytes.chatHistory = await estimateChatHistorySizeBytes(fallbackModuleData.chatHistory);

  const chatOrganization = (
    await loadPersistedValue<Record<string, unknown>>(STORAGE_KEYS.chatOrganization)
  ) ?? {};
  moduleBytes.groups = getJsonSizeBytes(chatOrganization.groups ?? fallbackModuleData.groups);
  moduleBytes.chatGroups = getJsonSizeBytes(chatOrganization.chatGroups ?? fallbackModuleData.chatGroups);
  await yieldToMainThread();

  const meData = (await loadPersistedValue<Record<string, unknown>>(STORAGE_KEYS.meData)) ?? {};
  moduleBytes.favorites = getJsonSizeBytes(meData.favorites ?? fallbackModuleData.favorites);
  moduleBytes.masks = getJsonSizeBytes(meData.masks ?? fallbackModuleData.masks);
  moduleBytes.worldBooks = getJsonSizeBytes(meData.worldBooks ?? fallbackModuleData.worldBooks);
  await yieldToMainThread();

  moduleBytes.userProfile = await estimateStoredJsonSizeBytes(STORAGE_KEYS.userProfile, fallbackModuleData.userProfile);
  moduleBytes.friendRequests = await estimateStoredJsonSizeBytes(
    STORAGE_KEYS.friendRequests,
    fallbackModuleData.friendRequests,
  );
  moduleBytes.callHistory = await estimateStoredJsonSizeBytes(STORAGE_KEYS.callHistory, fallbackModuleData.callHistory);
  await yieldToMainThread();

  moduleBytes.coupleSpace = await estimateStoredJsonSizeBytes(STORAGE_KEYS.coupleSpace, fallbackModuleData.coupleSpace);
  moduleBytes.moments = await estimateStoredJsonSizeBytes(STORAGE_KEYS.moments, fallbackModuleData.moments);
  moduleBytes.forumData = await estimateStoredJsonSizeBytes(STORAGE_KEYS.forumData, fallbackModuleData.forumData);
  await yieldToMainThread();

  const datingRecords = (
    await loadPersistedValue<Record<string, unknown>>(STORAGE_KEYS.datingRecords)
  ) ?? {};
  moduleBytes.savedDates = getJsonSizeBytes(datingRecords.savedDates ?? fallbackModuleData.savedDates);
  moduleBytes.collectedDates = getJsonSizeBytes(datingRecords.collectedDates ?? fallbackModuleData.collectedDates);
  await yieldToMainThread();

  moduleBytes.visualSettings = await estimateStoredJsonSizeBytes(
    STORAGE_KEYS.visualSettings,
    fallbackModuleData.visualSettings,
  );
  moduleBytes.musicData = await estimateStoredJsonSizeBytes(STORAGE_KEYS.musicData, fallbackModuleData.musicData);
  moduleBytes.walletData = await estimateStoredJsonSizeBytes(STORAGE_KEYS.walletData, fallbackModuleData.walletData);
  await yieldToMainThread();

  const assets = await listAssets().catch(() => [] as Awaited<ReturnType<typeof listAssets>>);
  const assetBytes = assets.reduce((totalBytes, asset) => totalBytes + asset.blob.size, 0);

  return {
    assetBytes,
    moduleBytes,
  };
}

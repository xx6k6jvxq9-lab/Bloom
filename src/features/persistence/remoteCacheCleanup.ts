import type { AppSettings, Character, ChatMessage, VisualSettings } from '../../types';
import { listAssets } from './browserDb';
import { listJsonRecordKeys, loadJsonRecord } from './browserJsonStore';
import { createUploadedAssetRef, parseUploadedAssetRef } from './persistentAssetRef';
import { removeAssetByRef } from './persistentAssetService';
import { STORAGE_KEYS } from './storageKeys';

export type RemoteCacheCleanupOverrides = {
  settings?: AppSettings;
  characters?: Character[];
  visualSettings?: VisualSettings;
  directHistoryByCharacterId?: Record<string, ChatMessage[]>;
};

export type RemoteCacheCleanupSummary = {
  scannedRemoteCacheCount: number;
  removedCount: number;
  remainingCount: number;
  referencedCount: number;
  freedBytes: number;
};

export type RemoteCacheUsageSummary = {
  totalCount: number;
  totalBytes: number;
  referencedCount: number;
  referencedBytes: number;
  unreferencedCount: number;
  unreferencedBytes: number;
};

function buildDirectSessionStorageKey(characterId: string): string {
  return `${STORAGE_KEYS.chatHistory}:direct:${characterId}`;
}

function collectUploadedAssetIdsFromUnknown(
  value: unknown,
  collector: Set<string>,
  seenObjects = new WeakSet<object>(),
): void {
  if (typeof value === 'string') {
    const parsedRef = parseUploadedAssetRef(value);
    if (parsedRef?.id) {
      collector.add(parsedRef.id);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  if (seenObjects.has(value)) {
    return;
  }
  seenObjects.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => collectUploadedAssetIdsFromUnknown(item, collector, seenObjects));
    return;
  }

  Object.values(value).forEach((item) => collectUploadedAssetIdsFromUnknown(item, collector, seenObjects));
}

function buildOverrideJsonRecords(
  overrides: RemoteCacheCleanupOverrides = {},
): Record<string, unknown> {
  const records: Record<string, unknown> = {};

  if (overrides.settings) {
    records[STORAGE_KEYS.settings] = overrides.settings;
  }

  if (overrides.characters) {
    records[STORAGE_KEYS.characters] = overrides.characters;
  }

  if (overrides.visualSettings) {
    records[STORAGE_KEYS.visualSettings] = overrides.visualSettings;
  }

  for (const [characterId, history] of Object.entries(overrides.directHistoryByCharacterId || {})) {
    records[buildDirectSessionStorageKey(characterId)] = {
      history,
    };
  }

  return records;
}

async function collectReferencedRemoteCacheAssetIds(
  overrides: RemoteCacheCleanupOverrides = {},
): Promise<Set<string>> {
  const referencedIds = new Set<string>();
  const overrideRecords = buildOverrideJsonRecords(overrides);
  const overrideKeys = new Set(Object.keys(overrideRecords));
  const persistedKeys = await listJsonRecordKeys().catch((error) => {
    console.error('[remoteCacheCleanup] Failed to list persisted JSON keys', error);
    return [] as string[];
  });

  await Promise.all(
    persistedKeys.map(async (key) => {
      if (overrideKeys.has(key)) {
        return;
      }

      try {
        const value = await loadJsonRecord<unknown>(key);
        collectUploadedAssetIdsFromUnknown(value, referencedIds);
      } catch (error) {
        console.error(`[remoteCacheCleanup] Failed to inspect JSON record "${key}"`, error);
      }
    }),
  );

  Object.values(overrideRecords).forEach((value) => {
    collectUploadedAssetIdsFromUnknown(value, referencedIds);
  });

  return referencedIds;
}

export async function inspectRemoteCacheUsage(
  overrides: RemoteCacheCleanupOverrides = {},
): Promise<RemoteCacheUsageSummary> {
  const [referencedIds, assets] = await Promise.all([
    collectReferencedRemoteCacheAssetIds(overrides),
    listAssets(),
  ]);
  const remoteCacheAssets = assets.filter((asset) => asset.source === 'remote-cache');
  const referencedAssets = remoteCacheAssets.filter((asset) => referencedIds.has(asset.id));
  const unreferencedAssets = remoteCacheAssets.filter((asset) => !referencedIds.has(asset.id));

  return {
    totalCount: remoteCacheAssets.length,
    totalBytes: remoteCacheAssets.reduce((total, asset) => total + asset.blob.size, 0),
    referencedCount: referencedAssets.length,
    referencedBytes: referencedAssets.reduce((total, asset) => total + asset.blob.size, 0),
    unreferencedCount: unreferencedAssets.length,
    unreferencedBytes: unreferencedAssets.reduce((total, asset) => total + asset.blob.size, 0),
  };
}

export async function cleanupUnusedRemoteCachedAssets(
  overrides: RemoteCacheCleanupOverrides = {},
): Promise<RemoteCacheCleanupSummary> {
  const [referencedIds, assets] = await Promise.all([
    collectReferencedRemoteCacheAssetIds(overrides),
    listAssets(),
  ]);
  const remoteCacheAssets = assets.filter((asset) => asset.source === 'remote-cache');
  const removableAssets = remoteCacheAssets.filter((asset) => !referencedIds.has(asset.id));
  const freedBytes = removableAssets.reduce((total, asset) => total + asset.blob.size, 0);

  await Promise.all(
    removableAssets.map((asset) => removeAssetByRef(createUploadedAssetRef(asset.id, asset.fileName)).catch((error) => {
      console.error(`[remoteCacheCleanup] Failed to remove remote cache asset "${asset.id}"`, error);
    })),
  );

  return {
    scannedRemoteCacheCount: remoteCacheAssets.length,
    removedCount: removableAssets.length,
    remainingCount: Math.max(0, remoteCacheAssets.length - removableAssets.length),
    referencedCount: remoteCacheAssets.length - removableAssets.length,
    freedBytes,
  };
}

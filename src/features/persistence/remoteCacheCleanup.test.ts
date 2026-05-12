import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoredAssetRecord } from './browserDb';
import { clearAssets, listAssets, putAsset } from './browserDb';
import { saveJsonRecord } from './browserJsonStore';
import { createUploadedAssetRef } from './persistentAssetRef';
import { cleanupUnusedRemoteCachedAssets, inspectRemoteCacheUsage } from './remoteCacheCleanup';
import { STORAGE_KEYS } from './storageKeys';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from './testPersistenceHarness';

function buildRemoteCacheAsset(id: string, originalUrl: string): StoredAssetRecord {
  return {
    id,
    kind: 'image',
    mimeType: 'image/gif',
    blob: new Blob([id], { type: 'image/gif' }),
    fileName: `${id}.gif`,
    createdAt: 1,
    updatedAt: 1,
    source: 'remote-cache',
    originalUrl,
  };
}

function buildUploadedAsset(id: string): StoredAssetRecord {
  return {
    id,
    kind: 'image',
    mimeType: 'image/png',
    blob: new Blob([id], { type: 'image/png' }),
    fileName: `${id}.png`,
    createdAt: 1,
    updatedAt: 1,
    source: 'upload',
  };
}

async function resetRemoteCacheCleanupState() {
  await clearPersistenceKeys([
    STORAGE_KEYS.settings,
    STORAGE_KEYS.characters,
    STORAGE_KEYS.visualSettings,
    STORAGE_KEYS.chatHistory,
  ]);
  await clearAssets();
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  await resetRemoteCacheCleanupState();
});

test('cleanupUnusedRemoteCachedAssets removes only unreferenced remote-cache assets', async () => {
  const keptRemoteAsset = buildRemoteCacheAsset('remote-keep', 'https://example.com/keep.gif');
  const removedRemoteAsset = buildRemoteCacheAsset('remote-remove', 'https://example.com/remove.gif');
  const uploadedAsset = buildUploadedAsset('upload-keep');

  await Promise.all([
    putAsset(keptRemoteAsset),
    putAsset(removedRemoteAsset),
    putAsset(uploadedAsset),
    saveJsonRecord(`${STORAGE_KEYS.chatHistory}:direct:char-a`, {
      history: [
        {
          role: 'user',
          text: '[sticker]',
          imageUrl: createUploadedAssetRef(keptRemoteAsset.id, keptRemoteAsset.fileName),
          timestamp: 100,
        },
      ],
    }),
  ]);

  const result = await cleanupUnusedRemoteCachedAssets();
  const remainingAssets = await listAssets();
  const remainingIds = remainingAssets.map((asset) => asset.id).sort();

  assert.equal(result.scannedRemoteCacheCount, 2);
  assert.equal(result.removedCount, 1);
  assert.equal(result.remainingCount, 1);
  assert.deepEqual(remainingIds, ['remote-keep', 'upload-keep']);
});

test('cleanupUnusedRemoteCachedAssets respects current direct-history overrides over stale persisted shards', async () => {
  const staleRemoteAsset = buildRemoteCacheAsset('remote-stale', 'https://example.com/stale.gif');

  await Promise.all([
    putAsset(staleRemoteAsset),
    saveJsonRecord(`${STORAGE_KEYS.chatHistory}:direct:char-a`, {
      history: [
        {
          role: 'user',
          text: '[sticker]',
          imageUrl: createUploadedAssetRef(staleRemoteAsset.id, staleRemoteAsset.fileName),
          timestamp: 200,
        },
      ],
    }),
  ]);

  const result = await cleanupUnusedRemoteCachedAssets({
    directHistoryByCharacterId: {
      'char-a': [],
    },
  });
  const remainingAssets = await listAssets();

  assert.equal(result.removedCount, 1);
  assert.equal(remainingAssets.length, 0);
});

test('inspectRemoteCacheUsage reports total and cleanable remote cache bytes separately', async () => {
  const keptRemoteAsset = buildRemoteCacheAsset('remote-keep', 'https://example.com/keep.gif');
  const removedRemoteAsset = buildRemoteCacheAsset('remote-remove', 'https://example.com/remove.gif');

  await Promise.all([
    putAsset(keptRemoteAsset),
    putAsset(removedRemoteAsset),
    saveJsonRecord(`${STORAGE_KEYS.chatHistory}:direct:char-a`, {
      history: [
        {
          role: 'user',
          text: '[sticker]',
          imageUrl: createUploadedAssetRef(keptRemoteAsset.id, keptRemoteAsset.fileName),
          timestamp: 300,
        },
      ],
    }),
  ]);

  const usage = await inspectRemoteCacheUsage();

  assert.equal(usage.totalCount, 2);
  assert.equal(usage.referencedCount, 1);
  assert.equal(usage.unreferencedCount, 1);
  assert.equal(usage.totalBytes, keptRemoteAsset.blob.size + removedRemoteAsset.blob.size);
  assert.equal(usage.referencedBytes, keptRemoteAsset.blob.size);
  assert.equal(usage.unreferencedBytes, removedRemoteAsset.blob.size);
});

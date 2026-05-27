import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppData, AppSettings, Character } from '../../types';
import { clearAssets, listAssets, putAsset } from './browserDb';
import { loadJsonRecord } from './browserJsonStore';
import {
  buildSingleFileModularBackupBundle,
  restoreSingleFileModularBackupBundle,
  verifySingleFileModularBackupBundleIntegrity,
} from './backupArchive';
import { STORAGE_KEYS } from './storageKeys';
import { fakeLocalStorage, installPersistenceTestEnvironment } from './testPersistenceHarness';

function buildTestAppData(): Partial<AppData> {
  const character = {
    id: 'char-a',
    name: '测试角色',
    avatar: 'avatar-a.png',
    systemPrompt: 'be kind',
    greeting: 'hello',
    memories: [],
    tags: [],
    relationshipLevel: 1,
  } as unknown as Character;

  return {
    characters: [character],
    chatHistory: {
      'char-a': [
        {
          role: 'user',
          text: '你好',
          timestamp: 100,
        },
        {
          role: 'model',
          text: '在呢',
          timestamp: 101,
        },
      ],
    },
    groups: ['默认'],
    chatGroups: [],
    userProfile: {
      id: 'user-a',
      name: '测试用户',
      avatar: 'user.png',
      bio: 'bio',
      mood: 'ok',
    } as AppData['userProfile'],
    perception: {} as AppData['perception'],
    moments: [],
    forumData: {} as AppData['forumData'],
    coupleSpaceState: {} as AppData['coupleSpaceState'],
    friendRequests: [],
    callHistory: [],
    savedDates: [],
    collectedDates: [],
    visualSettings: {} as AppData['visualSettings'],
    masks: [],
    favorites: [],
    worldBooks: [],
    userAvatarLibrary: {
      entries: [],
      updatedAt: 0,
    },
    relationshipAvatarBindings: [],
    musicData: {} as AppData['musicData'],
    walletData: {} as AppData['walletData'],
  };
}

function buildTestSettings(): AppSettings {
  return {
    activeConfigId: 'default',
    configs: [],
  } as AppSettings;
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  fakeLocalStorage.clear();
  await clearAssets().catch(() => undefined);
});

test('buildSingleFileModularBackupBundle adds a verifiable integrity digest', async () => {
  const bundle = await buildSingleFileModularBackupBundle({
    appData: buildTestAppData(),
    settings: buildTestSettings(),
  });

  assert.equal(bundle.schema, 'modular-persistence-bundle');
  assert.equal(bundle.integrity.algorithm, 'SHA-256');
  assert.match(bundle.integrity.payloadSha256, /^[a-f0-9]{64}$/);
  assert.equal(await verifySingleFileModularBackupBundleIntegrity(bundle), true);
});

test('verifySingleFileModularBackupBundleIntegrity fails after tampering', async () => {
  const bundle = await buildSingleFileModularBackupBundle({
    appData: buildTestAppData(),
    settings: buildTestSettings(),
  });

  bundle.dataArchive.modules.settings = {
    tampered: true,
  };

  assert.equal(await verifySingleFileModularBackupBundleIntegrity(bundle), false);
});

test('restoreSingleFileModularBackupBundle restores settings, chat shards, and assets', async () => {
  await putAsset({
    id: 'asset-a',
    kind: 'image',
    mimeType: 'image/png',
    blob: new Blob(['image-bytes'], { type: 'image/png' }),
    fileName: 'avatar.png',
    createdAt: 1,
    updatedAt: 2,
    source: 'upload',
  });

  const bundle = await buildSingleFileModularBackupBundle({
    appData: buildTestAppData(),
    settings: buildTestSettings(),
  });

  installPersistenceTestEnvironment();
  fakeLocalStorage.clear();

  await restoreSingleFileModularBackupBundle(bundle);

  const persistedSettings = await loadJsonRecord<Record<string, unknown>>(STORAGE_KEYS.settings);
  const persistedCharacters = await loadJsonRecord<Array<{ id?: string }>>(STORAGE_KEYS.characters);
  const persistedChatHistory = await loadJsonRecord<{
    directHistory?: Record<string, Array<{ text?: string }>>;
  }>(STORAGE_KEYS.chatHistory);
  const restoredAssets = await listAssets();

  assert.equal(persistedSettings?.activeConfigId, 'default');
  assert.equal(persistedCharacters?.[0]?.id, 'char-a');
  assert.equal(persistedChatHistory?.directHistory?.['char-a']?.[1]?.text, '在呢');
  assert.equal(restoredAssets.length, 1);
  assert.equal(restoredAssets[0]?.fileName, 'avatar.png');
});

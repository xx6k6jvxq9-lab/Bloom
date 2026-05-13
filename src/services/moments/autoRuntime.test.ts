import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppData, Character } from '../../types';
import { loadMemoryRecordData, resetMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import { getLatestMemoryDiagnostic, resetMemoryDiagnostics } from '../memory/memoryDiagnostics';
import { publishGeneratedCharacterMomentToFeed } from './autoRuntime';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: '',
    postFrequency: 'medium',
    ...overrides,
  } as Character;
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  resetMemoryRecordData();
  resetMemoryDiagnostics();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
});

test('publishGeneratedCharacterMomentToFeed writes moment continuity into runtime state and memory records', async () => {
  const character = createCharacter({
    id: 'moment-char',
    shortTermSummary: '之前的短期摘要',
  });
  let appData: AppData = {
    characters: [character],
    moments: [],
    masks: [],
    worldBooks: [],
    chatGroups: [],
    chatHistory: {},
    favorites: [],
    groups: [],
    visualSettings: {
      globalBackground: '',
      chatOpacity: 1,
      desktopIcons: [],
      widgets: [],
      navBar: {
        show: true,
        style: 'default',
        shape: 'pill',
        showMultipleAvatars: false,
        statusBarPlacement: 'top',
      },
      desktop: {
        iconSize: 64,
        iconBorderRadius: 16,
        gridColumns: 4,
        gridGap: 12,
      },
      chat: {
        avatarSize: 40,
        avatarBorderRadius: 20,
        avatarBorderColor: '',
        avatarBorderWidth: 0,
        messageBorderRadius: 18,
        messageBackgroundColorUser: '',
        messageBackgroundColorModel: '',
        messageSpacing: 10,
      },
      dynamics: {
        background: '',
        cardStyle: 'flat',
        cardBorderRadius: 16,
        cardOpacity: 1,
      },
      globalCss: '',
    },
    userProfile: {
      name: 'User',
      avatar: '',
      bio: '',
      mood: '',
      id: 'user',
    },
  };

  await publishGeneratedCharacterMomentToFeed({
    payload: {
      authorId: character.id,
      content: '窗外风有点大，今天先记这一句。',
    },
    snapshot: appData,
    setAppData: (updater) => {
      appData = typeof updater === 'function'
        ? updater(appData)
        : updater;
    },
  });

  const updatedCharacter = appData.characters.find((item) => item.id === character.id) || null;
  const records = loadMemoryRecordData({
    recordsByCharacterId: {},
  }).recordsByCharacterId[character.id] || [];
  const diagnostic = getLatestMemoryDiagnostic({
    characterId: character.id,
    type: 'settlement_write',
  });

  assert.equal(appData.moments.length, 1);
  assert.equal(updatedCharacter?.sharedState?.sourceScene, 'moments');
  assert.match(updatedCharacter?.sharedState?.publicCarryover || '', /刚刚发了一条公开动态/);
  assert.equal(Boolean(updatedCharacter?.sharedContextSnapshots?.length), true);
  assert.equal(Boolean(updatedCharacter?.shortTermSummary?.includes('刚刚发了一条公开动态')), true);
  assert.equal(records.some((record) => record.kind === 'snapshot' && record.snapshotType === 'shared_state'), true);
  assert.equal(records.some((record) => record.kind === 'fact' && record.sourceScene === 'moments'), true);
  assert.equal(diagnostic?.type, 'settlement_write');
  if (diagnostic?.type === 'settlement_write') {
    assert.equal(diagnostic.status, 'success');
    assert.equal(diagnostic.sourceScene, 'moments');
  }
});

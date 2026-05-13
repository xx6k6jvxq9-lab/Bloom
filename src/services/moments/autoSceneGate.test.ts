import assert from 'node:assert/strict';
import test from 'node:test';
import { resetMemoryRecordData, saveMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import type { Character } from '../../types';
import {
  filterAutoMomentSceneUnlockedCharacters,
  getCharacterAutoMomentSceneGate,
  isStrongAutoMomentInteractionSurface,
} from './autoSceneGate';

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
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
});

test('strong interaction surfaces block background moment auto checks', () => {
  assert.equal(isStrongAutoMomentInteractionSurface('chat-session'), true);
  assert.equal(isStrongAutoMomentInteractionSurface('group-chat-session'), true);
  assert.equal(isStrongAutoMomentInteractionSurface('couple-space'), true);
  assert.equal(isStrongAutoMomentInteractionSurface('home'), false);
  assert.equal(isStrongAutoMomentInteractionSurface('settings'), false);
});

test('active dating state blocks automatic publishing but downgrades manual refresh to scene-carryover only', () => {
  const now = Date.parse('2026-05-14T21:59:00+08:00');
  const character = createCharacter({
    activeDatingState: {
      sessionId: 'date-1',
      startedAt: now - 20 * 60 * 1000,
      updatedAt: now - 60 * 1000,
      status: 'active',
      summary: '正在帮用户卸妆。',
    },
  });

  assert.equal(getCharacterAutoMomentSceneGate({
    character,
    trigger: 'app_foreground',
    now,
  }).allowed, false);
  const manualDecision = getCharacterAutoMomentSceneGate({
    character,
    trigger: 'manual_refresh',
    now,
  });
  assert.equal(manualDecision.allowed, true);
  assert.equal(manualDecision.restriction, 'scene_carryover_only');
});

test('recent strong shared state locks automatic life posts but not manual refresh', () => {
  const now = Date.parse('2026-05-14T21:59:00+08:00');
  const character = createCharacter({
    sharedState: {
      updatedAt: now - 3 * 60 * 1000,
      sourceScene: 'direct_chat',
      availability: 'live',
      currentActivity: '正在和用户聊天。',
    },
  });

  assert.equal(getCharacterAutoMomentSceneGate({
    character,
    trigger: 'moments_open',
    now,
  }).allowed, false);
  const manualDecision = getCharacterAutoMomentSceneGate({
    character,
    trigger: 'manual_refresh',
    now,
  });
  assert.equal(manualDecision.allowed, true);
  assert.equal(manualDecision.restriction, 'scene_carryover_only');
});

test('old strong shared state returns to the free life window', () => {
  const now = Date.parse('2026-05-14T21:59:00+08:00');
  const character = createCharacter({
    sharedState: {
      updatedAt: now - 30 * 60 * 1000,
      sourceScene: 'direct_chat',
      availability: 'recent',
      currentActivity: '刚和用户聊完。',
    },
  });

  assert.equal(getCharacterAutoMomentSceneGate({
    character,
    trigger: 'app_foreground',
    now,
  }).allowed, true);
});

test('scene gate filters only locked characters from automatic scheduler candidates', () => {
  const now = Date.parse('2026-05-14T21:59:00+08:00');
  const locked = createCharacter({
    id: 'locked',
    sharedState: {
      updatedAt: now - 2 * 60 * 1000,
      sourceScene: 'couple_space',
      availability: 'live',
      currentActivity: '正在情侣空间互动。',
    },
  });
  const free = createCharacter({
    id: 'free',
    sharedState: {
      updatedAt: now - 40 * 60 * 1000,
      sourceScene: 'moments',
      availability: 'recent',
      currentActivity: '刚发过动态。',
    },
  });

  assert.deepEqual(
    filterAutoMomentSceneUnlockedCharacters({
      characters: [locked, free],
      trigger: 'app_foreground',
      now,
    }).map((character) => character.id),
    ['free'],
  );
});

test('manual refresh keeps restricted characters out of the free-life planner pool by default', () => {
  const now = Date.parse('2026-05-14T21:59:00+08:00');
  const restricted = createCharacter({
    id: 'restricted',
    sharedState: {
      updatedAt: now - 2 * 60 * 1000,
      sourceScene: 'direct_chat',
      availability: 'live',
      currentActivity: '还在和用户说话。',
    },
  });
  const free = createCharacter({
    id: 'free',
    sharedState: {
      updatedAt: now - 40 * 60 * 1000,
      sourceScene: 'moments',
      availability: 'recent',
      currentActivity: '刚发过动态。',
    },
  });

  assert.deepEqual(
    filterAutoMomentSceneUnlockedCharacters({
      characters: [restricted, free],
      trigger: 'manual_refresh',
      now,
    }).map((character) => character.id),
    ['free'],
  );

  assert.deepEqual(
    filterAutoMomentSceneUnlockedCharacters({
      characters: [restricted, free],
      trigger: 'manual_refresh',
      now,
      includeRestricted: true,
    }).map((character) => character.id),
    ['restricted', 'free'],
  );
});

test('scene gate can derive a recent strong lock from records even when sharedState is stale', async () => {
  const now = Date.parse('2026-05-14T21:59:00+08:00');
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      'records-gate': [
        {
          id: 'recent-wave',
          kind: 'relationship_wave',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'records-gate',
          sourceEventIds: [],
          characterIds: ['records-gate'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'record-derived strong recent carryover',
          timestamp: now - 90_000,
          retrievalHints: ['record-derived strong recent carryover'],
          sceneTags: ['dating'],
          relationType: 'character_user',
          eventKind: 'bonding',
          valence: 'positive',
          intensity: 'medium',
          sourceCharacterId: 'records-gate',
          targetUser: true,
        },
      ],
    },
  });

  const character = createCharacter({
    id: 'records-gate',
    sharedState: {
      updatedAt: now - 40 * 60 * 1000,
      sourceScene: 'moments',
      availability: 'recent',
      currentActivity: 'stale shared state',
    },
  });

  assert.equal(getCharacterAutoMomentSceneGate({
    character,
    trigger: 'app_foreground',
    now,
  }).allowed, false);
});

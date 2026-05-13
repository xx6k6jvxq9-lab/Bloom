import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { resetMemoryRecordData, saveMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import { buildResolvedOpenLoopRegistry } from './buildResolvedOpenLoopRegistry';
import { buildLongTermMemoryProfile } from './buildLongTermMemoryProfile';
import { buildShortTermSummary } from './buildShortTermSummary';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'char-memory-derived',
    name: overrides.name ?? '测试角色',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? '',
    openingRemark: overrides.openingRemark ?? '',
    ...overrides,
  } as Character;
}

async function clearMemoryRecordState() {
  resetMemoryRecordData();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  await clearMemoryRecordState();
});

test('buildShortTermSummary prefers derived recent memory records', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      'char-memory-derived': [
        {
          id: 'wave-conflict',
          kind: 'relationship_wave',
          sourceScene: 'direct_chat',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-memory-derived',
          sourceEventIds: ['direct:char-memory-derived:1'],
          characterIds: ['char-memory-derived'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'short',
          summary: '昨天那句别扭还没完全过去',
          timestamp: now - 1000,
          relationType: 'character_user',
          eventKind: 'conflict',
          valence: 'negative',
          intensity: 'medium',
          sourceCharacterId: 'char-memory-derived',
          targetUser: true,
        },
        {
          id: 'fact-plan',
          kind: 'fact',
          sourceScene: 'direct_chat',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-memory-derived',
          sourceEventIds: ['direct:char-memory-derived:2'],
          characterIds: ['char-memory-derived'],
          visibility: 'cross_scene_readable',
          stability: 'temporary',
          decayHint: 'short',
          summary: '周末一起去看电影',
          timestamp: now - 500,
          factType: 'plan',
          subjectType: 'character',
          subjectId: 'char-memory-derived',
          confidence: 'explicit',
          relatedCharacterIds: ['char-memory-derived'],
        },
      ],
    },
  });

  const summary = buildShortTermSummary(createCharacter({
    id: 'char-memory-derived',
    shortTermSummary: '旧短期摘要',
  })) || '';

  assert.match(summary, /昨天那句别扭还没完全过去/);
  assert.match(summary, /周末一起去看电影/);
  assert.match(summary, /开放回路/);
});

test('buildLongTermMemoryProfile prefers derived stable memory records', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      'char-memory-derived': [
        {
          id: 'fact-preference',
          kind: 'fact',
          sourceScene: 'direct_chat',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-memory-derived',
          sourceEventIds: ['direct:char-memory-derived:3'],
          characterIds: ['char-memory-derived'],
          visibility: 'cross_scene_readable',
          stability: 'stable',
          decayHint: 'stable',
          summary: '喜欢热可可，也会记住你怕冷',
          timestamp: now - 2000,
          factType: 'preference',
          subjectType: 'character',
          subjectId: 'char-memory-derived',
          confidence: 'explicit',
          relatedCharacterIds: ['char-memory-derived'],
        },
      ],
    },
  });

  const profile = buildLongTermMemoryProfile(createCharacter({
    id: 'char-memory-derived',
    longTermMemoryProfile: '旧长期画像',
  })) || '';

  assert.match(profile, /喜欢热可可/);
  assert.doesNotMatch(profile, /旧长期画像/);
});

test('buildResolvedOpenLoopRegistry merges derived open loops before legacy entries', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      'char-memory-derived': [
        {
          id: 'fact-plan',
          kind: 'fact',
          sourceScene: 'direct_chat',
          sourceSessionType: 'direct',
          sourceSessionId: 'char-memory-derived',
          sourceEventIds: ['direct:char-memory-derived:4'],
          characterIds: ['char-memory-derived'],
          visibility: 'cross_scene_readable',
          stability: 'temporary',
          decayHint: 'short',
          summary: '记得补上那张票',
          timestamp: now - 500,
          factType: 'plan',
          subjectType: 'character',
          subjectId: 'char-memory-derived',
          confidence: 'explicit',
          relatedCharacterIds: ['char-memory-derived'],
        },
      ],
    },
  });

  const registry = buildResolvedOpenLoopRegistry(createCharacter({
    id: 'char-memory-derived',
    openLoopRegistry: [
      {
        id: 'legacy-loop',
        kind: 'relationship',
        status: 'waiting_user',
        content: '旧的关系回路',
        source: 'manual',
        createdAt: now - 10_000,
        lastTouchedAt: now - 10_000,
        updatedAt: now - 10_000,
      },
    ],
  }));

  assert.match(registry[0]?.content || '', /记得补上那张票/);
  assert.match(registry[1]?.content || '', /旧的关系回路/);
});

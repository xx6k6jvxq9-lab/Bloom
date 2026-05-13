import assert from 'node:assert/strict';
import test from 'node:test';
import { resetMemoryRecordData, saveMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import type { Character, MomentItem } from '../../types';
import { buildAutoMomentPlan } from './autoScheduler';

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

function createMoment(authorId: string, timestamp: number): MomentItem {
  return {
    id: `${authorId}-${timestamp}`,
    authorId,
    content: 'test',
    timestamp,
    likes: 0,
    comments: [],
  };
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  resetMemoryRecordData();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
});

test('manual refresh can fallback to one candidate even before full cooldown', () => {
  const now = Date.parse('2026-05-11T12:00:00+08:00');
  const character = createCharacter({
    id: 'high-char',
    postFrequency: 'high',
    sharedState: {
      updatedAt: now,
      sourceScene: 'direct_chat',
      availability: 'recent',
      currentActivity: '刚下班，正在回家路上',
    },
  });
  const moments = [createMoment(character.id, now - 60 * 60 * 1000)];

  const plan = buildAutoMomentPlan({
    characters: [character],
    moments,
    now,
    lastCheckedAt: now - 30 * 60 * 1000,
    trigger: 'manual_refresh',
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.characterId, character.id);
});

test('foreground auto-check stays conservative when cooldown has not fully passed', () => {
  const now = Date.parse('2026-05-11T12:00:00+08:00');
  const character = createCharacter({
    id: 'high-char',
    postFrequency: 'high',
    sharedState: {
      updatedAt: now,
      sourceScene: 'direct_chat',
      availability: 'recent',
      currentActivity: '刚下班，正在回家路上',
    },
  });
  const moments = [createMoment(character.id, now - 60 * 60 * 1000)];

  const plan = buildAutoMomentPlan({
    characters: [character],
    moments,
    now,
    lastCheckedAt: now - 30 * 60 * 1000,
    trigger: 'app_foreground',
  });

  assert.equal(plan.length, 0);
});

test('manual refresh still respects daily cap', () => {
  const now = Date.parse('2026-05-11T12:00:00+08:00');
  const character = createCharacter({
    id: 'low-char',
    postFrequency: 'low',
    sharedState: {
      updatedAt: now,
      sourceScene: 'direct_chat',
      availability: 'recent',
      currentActivity: '今天有点累',
    },
  });
  const moments = [createMoment(character.id, now - 2 * 60 * 60 * 1000)];

  const plan = buildAutoMomentPlan({
    characters: [character],
    moments,
    now,
    lastCheckedAt: now - 30 * 60 * 1000,
    trigger: 'manual_refresh',
  });

  assert.equal(plan.length, 0);
});

test('manual refresh can still pick a candidate without explicit state signals', () => {
  const now = Date.parse('2026-05-11T12:00:00+08:00');
  const character = createCharacter({
    id: 'plain-char',
    postFrequency: 'medium',
  });
  const moments = [createMoment(character.id, now - 60 * 60 * 1000)];

  const plan = buildAutoMomentPlan({
    characters: [character],
    moments,
    now,
    lastCheckedAt: now - 30 * 60 * 1000,
    trigger: 'manual_refresh',
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.characterId, character.id);
});

test('auto moment planning prefers record-derived public carryover over stale shared state text', async () => {
  const now = Date.parse('2026-05-11T12:00:00+08:00');
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      'records-char': [
        {
          id: 'wave-record',
          kind: 'relationship_wave',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'records-char',
          sourceEventIds: [],
          characterIds: ['records-char'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'record-derived public residue',
          timestamp: now - 200,
          retrievalHints: ['record-derived public residue', 'dating'],
          sceneTags: ['dating'],
          relationType: 'character_user',
          eventKind: 'bonding',
          valence: 'positive',
          intensity: 'medium',
          sourceCharacterId: 'records-char',
          targetUser: true,
        },
      ],
    },
  });

  const character = createCharacter({
    id: 'records-char',
    postFrequency: 'medium',
    sharedState: {
      updatedAt: now - 10_000,
      sourceScene: 'forum',
      availability: 'recent',
      currentActivity: 'stale activity',
      publicCarryover: 'stale public carryover',
    },
  });

  const plan = buildAutoMomentPlan({
    characters: [character],
    moments: [],
    now,
    lastCheckedAt: now - 30 * 60 * 1000,
    trigger: 'manual_refresh',
  });

  assert.equal(plan.length, 1);
  assert.equal(
    plan[0]?.extraPromptSections.some((section) => section.includes('record-derived public residue')),
    true,
  );
  assert.equal(
    plan[0]?.extraPromptSections.some((section) => section.includes('stale public carryover')),
    false,
  );
});

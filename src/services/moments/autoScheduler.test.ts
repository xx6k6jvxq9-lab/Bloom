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

function createMoment(authorId: string, timestamp: number, overrides: Partial<MomentItem> = {}): MomentItem {
  return {
    id: `${authorId}-${timestamp}`,
    authorId,
    content: 'test',
    timestamp,
    likes: 0,
    comments: [],
    ...overrides,
  };
}

const LONG_MOMENT_TEXT = [
  '今天这一整天都像被拆成很多小段，走到现在才慢慢收回来一点。',
  '有些念头刚冒出来的时候还很吵，过一会儿又只剩一点余温留在身上。',
  '先记在这里，免得明天醒来又忘了自己今天到底是怎么过来的。',
].join('\n');

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

test('daytime planning does not use the night journal intent', () => {
  const now = Date.parse('2026-05-11T12:00:00+08:00');
  const character = createCharacter({
    id: 'day-char',
    postFrequency: 'high',
    sharedState: {
      updatedAt: now,
      sourceScene: 'direct_chat',
      availability: 'recent',
      currentActivity: '刚把窗帘拉开一点。',
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
  assert.equal(plan[0]?.requestText.includes('夜间记录'), false);
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

test('recent long streak keeps long and visual shapes available under balanced odds', () => {
  const now = Date.parse('2026-05-11T22:30:00+08:00');
  const character = createCharacter({
    id: 'cooldown-char',
    postFrequency: 'high',
    sharedState: {
      updatedAt: now - 5 * 60 * 1000,
      sourceScene: 'forum',
      availability: 'recent',
      currentActivity: '今晚风有点大。',
    },
  });
  const moments = [
    createMoment(character.id, now - 2 * 60 * 60 * 1000, {
      content: LONG_MOMENT_TEXT,
    }),
    createMoment(character.id, now - 5 * 60 * 60 * 1000, {
      content: LONG_MOMENT_TEXT,
    }),
  ];

  const plan = buildAutoMomentPlan({
    characters: [character],
    moments,
    now,
    lastCheckedAt: now - 60 * 60 * 1000,
    trigger: 'manual_refresh',
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.generationHints?.forceTextOnly, undefined);
  assert.equal(plan[0]?.generationHints?.allowedShapes.includes('short_status'), true);
  assert.equal(plan[0]?.generationHints?.allowedShapes.includes('multi_paragraph'), true);
  assert.equal(plan[0]?.generationHints?.allowedShapes.includes('journal_note'), true);
  assert.equal(plan[0]?.generationHints?.allowedShapes.includes('photo_dump'), true);
  assert.equal(plan[0]?.generationHints?.blockedShapes, undefined);
  assert.equal(
    plan[0]?.extraPromptSections.some((section) => section.includes('不要硬禁长文')),
    true,
  );
});

test('recent visual streak keeps photo-first shapes available under balanced odds', () => {
  const now = Date.parse('2026-05-11T22:30:00+08:00');
  const character = createCharacter({
    id: 'visual-char',
    postFrequency: 'high',
    sharedState: {
      updatedAt: now - 5 * 60 * 1000,
      sourceScene: 'forum',
      availability: 'recent',
      currentActivity: '刚把灯关小一点。',
    },
  });
  const imageCard = {
    title: 'preview',
    description: 'preview',
    theme: 'film' as const,
  };
  const moments = [
    createMoment(character.id, now - 2 * 60 * 60 * 1000, {
      content: '灯光有一点软。今天先放这几张。',
      imageCard,
    }),
    createMoment(character.id, now - 5 * 60 * 60 * 1000, {
      content: '又补几张普通碎片，字就不多写了。',
      imageCard,
    }),
  ];

  const plan = buildAutoMomentPlan({
    characters: [character],
    moments,
    now,
    lastCheckedAt: now - 60 * 60 * 1000,
    trigger: 'manual_refresh',
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.generationHints?.forceTextOnly, undefined);
  assert.equal(plan[0]?.generationHints?.allowedShapes.includes('photo_dump'), true);
  assert.equal(plan[0]?.generationHints?.allowedShapes.includes('music_diary'), true);
  assert.equal(plan[0]?.generationHints?.blockedShapes, undefined);
  assert.equal(
    plan[0]?.extraPromptSections.some((section) => section.includes('图文和纯文字仍按正常概率选择')),
    true,
  );
});

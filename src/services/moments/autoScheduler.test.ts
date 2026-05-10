import assert from 'node:assert/strict';
import test from 'node:test';
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

import assert from 'node:assert/strict';
import test from 'node:test';
import type { GroupOfflineSession } from '../../types';
import {
  buildGroupOfflineWritebackPlan,
  resolveGroupOfflineMemoryWritebackPolicy,
  shouldWriteGroupOfflineMemoryBack,
} from './groupOfflineWritebackPlan';

function createSession(): GroupOfflineSession {
  return {
    id: 'offline-writeback-1',
    groupId: 'group-1',
    mode: 'daily',
    generationMode: 'blocks',
    activityType: 'Late Night Hangout',
    location: 'Parking Exit',
    timeLabel: 'Tonight 21:30',
    weatherLabel: 'Cool Night Wind',
    vibe: 'Unsure',
    participants: [
      { characterId: 'alpha', joinedAt: 1, presence: 'arrived' },
    ],
    createdAt: 1,
    updatedAt: 1,
    currentRound: 1,
    messages: [],
    status: 'ended',
    endedAt: 10,
    summaryCard: {
      title: 'Late Night Hangout ended',
      lines: ['The group left with one unfinished line still hanging in the air.'],
    },
    generatedContent: {
      card: {
        timeLabel: 'Tonight 21:30',
        locationLabel: 'Parking Exit',
        weatherLabel: 'Cool Night Wind',
        participantLabels: ['Alpha'],
      },
      intro: 'The scene wrapped.',
      lines: [],
      characterBlocks: [],
      rounds: [{
        id: 'round-1',
        sceneText: 'The wind cooled the scene.',
        characterEntries: [{
          characterId: 'alpha',
          speakerLabel: 'Alpha',
          target: { type: 'user', label: 'User' },
          text: 'Alpha still asked whether the user got home safely.',
          statusFields: [],
          memoryPanel: {
            shortTerm: ['He asked about the user first.'],
            longTerm: ['He keeps this protective instinct for a long time.'],
          },
        }],
      }],
    },
  } as GroupOfflineSession;
}

test('group offline writeback plan blocks special-directive sessions', () => {
  const session = createSession();
  session.directorInstruction = '暂停当前主线，生成一个番外小剧场，不计入主线。';

  assert.equal(resolveGroupOfflineMemoryWritebackPolicy(session), 'block');
  assert.equal(shouldWriteGroupOfflineMemoryBack(session), false);
});

test('group offline writeback plan still blocks special directives even when the raw text says to merge back', () => {
  const session = createSession();
  session.directorInstruction = '暂停当前主线，生成一个番外小剧场，但这次计入主线。';

  assert.equal(resolveGroupOfflineMemoryWritebackPolicy(session), 'block');
  assert.equal(shouldWriteGroupOfflineMemoryBack(session), false);
});

test('group offline writeback plan lets side-story directives override old default allow state', () => {
  const session = createSession();
  session.memoryWritebackPolicy = 'allow';
  session.directorInstruction = '暂停当前主线，生成一个番外小剧场，不计入主线。';

  assert.equal(resolveGroupOfflineMemoryWritebackPolicy(session), 'block');
  assert.equal(shouldWriteGroupOfflineMemoryBack(session), false);
});

test('group offline writeback plan prefers long-term evidence and keeps shared event summary', () => {
  const session = createSession();
  const plan = buildGroupOfflineWritebackPlan(session);

  assert.equal(plan.shouldWriteMemoryBack, true);
  assert.match(plan.sharedEventSummary || '', /unfinished line/i);
  assert.equal(
    plan.participantEvidenceByCharacterId.alpha?.latestLongTerm,
    'He keeps this protective instinct for a long time.',
  );
  assert.deepEqual(
    plan.participantEvidenceByCharacterId.alpha?.latestShortTerm,
    ['He asked about the user first.'],
  );
});

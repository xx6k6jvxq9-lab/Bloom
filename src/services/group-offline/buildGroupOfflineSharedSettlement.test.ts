import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, GroupOfflineSession } from '../../types';
import { buildGroupOfflineSharedSettlement } from './buildGroupOfflineSharedSettlement';
import { buildGroupOfflineWritebackPlan } from './groupOfflineWritebackPlan';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'alpha',
    name: overrides.name ?? 'Alpha',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? 'Calm on the surface, but notices small shifts.',
    openingRemark: overrides.openingRemark ?? 'You are here.',
    sharedContextSnapshots: overrides.sharedContextSnapshots,
    shortTermSummary: overrides.shortTermSummary,
    openLoopRegistry: overrides.openLoopRegistry,
    presenceState: overrides.presenceState,
    sharedState: overrides.sharedState,
  } as Character;
}

function createSession(): GroupOfflineSession {
  return {
    id: 'offline-1',
    groupId: 'group-1',
    mode: 'daily',
    generationMode: 'blocks',
    activityType: 'Late Night Hangout',
    location: 'Parking Exit',
    timeLabel: 'Tonight 21:30',
    weatherLabel: 'Cool Night Wind',
    vibe: 'Everyone is carrying something unsaid',
    participants: [
      { characterId: 'alpha', joinedAt: 1, presence: 'arrived' },
      { characterId: 'beta', joinedAt: 1, presence: 'arrived' },
    ],
    createdAt: 1,
    updatedAt: 1,
    currentRound: 2,
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
        participantLabels: ['Alpha', 'Beta'],
      },
      intro: 'The offline scene has just wrapped.',
      lines: [],
      characterBlocks: [],
      rounds: [
        {
          id: 'round-1',
          title: 'Round 1',
          sceneText: 'The wind at the parking exit cooled the scene, but not fully.',
          userMessageText: 'Did you all get home yet?',
          characterEntries: [
            {
              characterId: 'alpha',
              speakerLabel: 'Alpha',
              target: { type: 'user', label: 'User' },
              text: 'Alpha checked the phone first and still asked whether the user got home safely.',
              highlightText: '"Get back first. Do not stay in the wind."',
              statusFields: [],
              notebook: 'Still noticed the glance back before leaving.',
              memoryPanel: {
                shortTerm: ['He asked whether the user got home safely first.'],
                longTerm: ['He tends to carry this protective reflex for a long time.'],
              },
            },
            {
              characterId: 'beta',
              speakerLabel: 'Beta',
              text: 'Beta was still joking on the surface, but had already started hurrying people home.',
              statusFields: [],
            },
          ],
        },
      ],
    },
  } as GroupOfflineSession;
}

test('buildGroupOfflineSharedSettlement emits settlement records for participant continuity', () => {
  const session = createSession();
  const plan = buildGroupOfflineWritebackPlan(session);
  const settlement = buildGroupOfflineSharedSettlement(createCharacter(), session, {
    writebackPlan: plan,
  });

  assert.equal(settlement.sharedContextSnapshots.length > 0, true);
  assert.equal(settlement.sharedContextSnapshots[0]?.sourceScene, 'group_offline');
  assert.equal((settlement.shortTermSummary || '').length > 0, true);
  assert.equal(settlement.sceneProgressRecords?.length, 1);
  assert.equal((settlement.sceneProgressRecords?.[0]?.summary || '').includes('群线下推进到'), true);
  assert.equal(settlement.sharedState?.sourceScene, 'group_offline');
  assert.equal(settlement.openLoopRegistry, undefined);
});

test('buildGroupOfflineSharedSettlement prefers long-term memoryPanel evidence when available', () => {
  const session = createSession();
  const plan = buildGroupOfflineWritebackPlan(session);
  const settlement = buildGroupOfflineSharedSettlement(createCharacter(), session, {
    writebackPlan: plan,
  });

  const relationshipSummary = settlement.sharedContextSnapshots[0]?.relationshipResidue?.[0]?.summary || '';
  assert.match(relationshipSummary, /protective reflex/i);
  assert.doesNotMatch(relationshipSummary, /checked the phone first/i);
});

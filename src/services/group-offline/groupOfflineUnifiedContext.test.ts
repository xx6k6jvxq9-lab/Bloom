import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, GroupOfflineSession } from '../../types';
import {
  buildGroupOfflineUnifiedContextPatch,
  mergeFactTraceRecords,
  mergeRelationshipWaveRecords,
} from './groupOfflineUnifiedContext';

function createCharacter(id: string, name: string): Character {
  return {
    id,
    name,
    gender: 'other',
    avatar: '',
    setting: `${name} persona.`,
  } as Character;
}

function createSession(): GroupOfflineSession {
  return {
    id: 'offline-context-1',
    groupId: 'group-1',
    mode: 'daily',
    generationMode: 'blocks',
    activityType: 'Temporary Collision',
    location: 'Old City Entrance',
    scenePrompt: 'Wind moves through the old entrance.',
    timeLabel: 'Tonight 21:30',
    weatherLabel: 'Windy',
    vibe: 'cooling down',
    participants: [
      { characterId: 'alpha', joinedAt: 1, presence: 'arrived' },
      { characterId: 'beta', joinedAt: 1, presence: 'arrived' },
    ],
    createdAt: 1,
    updatedAt: 1,
    currentRound: 1,
    messages: [],
    status: 'ended',
    endedAt: 10,
    summaryCard: {
      title: 'Temporary Collision ended',
      lines: ['The group went home, but the unfinished line was still hanging there.'],
    },
    generatedContent: {
      card: {
        timeLabel: 'Tonight 21:30',
        locationLabel: 'Old City Entrance',
        weatherLabel: 'Windy',
        participantLabels: ['Alpha', 'Beta'],
      },
      intro: 'The scene cooled, but not fully.',
      lines: [],
      characterBlocks: [],
      rounds: [{
        id: 'round-1',
        sceneText: 'Nobody really let the last thread drop.',
        characterEntries: [
          {
            characterId: 'alpha',
            speakerLabel: 'Alpha',
            target: { type: 'user', label: 'User' },
            text: 'Alpha still checked whether the user got home first.',
            highlightText: 'Do not stay in the wind.',
            statusFields: [],
            memoryPanel: {
              shortTerm: ['He asked about the user first.'],
              longTerm: ['He keeps this protective instinct for a long time.'],
            },
          },
          {
            characterId: 'beta',
            speakerLabel: 'Beta',
            target: { type: 'character', label: 'Alpha', characterId: 'alpha' },
            text: 'Beta still had his attention hanging on Alpha.',
            statusFields: [],
            memoryPanel: {
              shortTerm: ['He did not really let Alpha go.'],
              longTerm: [],
            },
          },
        ],
      }],
    },
  } as GroupOfflineSession;
}

test('buildGroupOfflineUnifiedContextPatch emits sparse waves and shared group fact', () => {
  const members = [
    createCharacter('alpha', 'Alpha'),
    createCharacter('beta', 'Beta'),
  ];
  const patch = buildGroupOfflineUnifiedContextPatch({
    session: createSession(),
    members,
  });

  assert.equal(patch.relationshipWaves.length, 2);
  assert.equal(patch.factTraces.length, 1);
  assert.equal(patch.relationshipWaves.some((wave) => wave.targetUser === true), true);
  assert.equal(patch.relationshipWaves.some((wave) => wave.targetCharacterId === 'alpha'), true);
  assert.match(patch.factTraces[0]?.summary || '', /共同经历|unfinished line/i);
});

test('group offline unified context merge helpers dedupe repeated records', () => {
  const session = createSession();
  const patch = buildGroupOfflineUnifiedContextPatch({
    session,
    members: [createCharacter('alpha', 'Alpha'), createCharacter('beta', 'Beta')],
  });

  const mergedWaves = mergeRelationshipWaveRecords(patch.relationshipWaves, patch.relationshipWaves);
  const mergedFacts = mergeFactTraceRecords(patch.factTraces, patch.factTraces);

  assert.equal(mergedWaves.length, patch.relationshipWaves.length);
  assert.equal(mergedFacts.length, patch.factTraces.length);
});

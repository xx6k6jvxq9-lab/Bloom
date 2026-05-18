import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, GroupOfflineSession } from '../../types';
import {
  buildDerivedGroupOfflineEndingPayload,
  buildGroupOfflineEndingReactionPlan,
  buildUserAnchoredGroupOfflineEndingVoices,
} from './endingPayload';

function createCharacter(id: string, name: string): Character {
  return {
    id,
    name,
    gender: 'other',
    avatar: '',
    setting: `${name} persona.`,
  } as Character;
}

function createSession(overrides?: Partial<GroupOfflineSession>): GroupOfflineSession {
  return {
    id: 'offline-ending-1',
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
    status: 'active',
    summaryCard: {
      title: 'Temporary Collision ended',
      lines: ['The group went home, but the unfinished line was still hanging there.'],
    },
    ...overrides,
  } as GroupOfflineSession;
}

test('buildGroupOfflineEndingReactionPlan marks user-followup cues from user-targeted evidence', () => {
  const members = [
    createCharacter('alpha', 'Alpha'),
    createCharacter('beta', 'Beta'),
  ];
  const session = createSession({
    generatedContent: {
      card: {
        timeLabel: 'Tonight 21:30',
        locationLabel: 'Old City Entrance',
        weatherLabel: 'Windy',
        participantLabels: ['Alpha', 'Beta'],
      },
      intro: 'The wind cooled the scene but not fully.',
      lines: [],
      characterBlocks: [],
      rounds: [{
        id: 'round-1',
        userMessageText: 'Do not let that last line die here.',
        characterEntries: [
          {
            characterId: 'alpha',
            speakerLabel: 'Alpha',
            target: { type: 'user', label: 'User' },
            text: 'Alpha still looked back at the user before leaving.',
            highlightText: 'Do not go back into the wind yet.',
            statusFields: [],
            memoryPanel: {
              shortTerm: ['He still checked whether the user got home first.'],
              longTerm: [],
            },
          },
          {
            characterId: 'beta',
            speakerLabel: 'Beta',
            target: { type: 'character', label: 'Alpha', characterId: 'alpha' },
            text: 'Beta only threw the last look back at Alpha.',
            statusFields: [],
          },
        ],
      }],
    },
  });

  const plan = buildGroupOfflineEndingReactionPlan(session, members);

  assert.equal(plan.cues.length, 2);
  assert.equal(plan.cues[0]?.kind, 'user_followup');
  assert.equal(plan.cues[0]?.characterId, 'alpha');
  assert.equal(plan.cues[1]?.kind, 'pair_aftertaste');
  assert.equal(plan.cues[1]?.targetLabel, 'Alpha');
});

test('buildUserAnchoredGroupOfflineEndingVoices keeps reactions grounded in each character cue', () => {
  const members = [createCharacter('alpha', 'Alpha')];
  const session = createSession({
    participants: [{ characterId: 'alpha', joinedAt: 1, presence: 'arrived' }],
    generatedContent: {
      card: {
        timeLabel: 'Tonight 21:30',
        locationLabel: 'Old City Entrance',
        weatherLabel: 'Windy',
        participantLabels: ['Alpha'],
      },
      intro: 'The scene is about to scatter.',
      lines: [],
      characterBlocks: [],
      rounds: [{
        id: 'round-1',
        userMessageText: 'Alpha, do not leave yet.',
        characterEntries: [{
          characterId: 'alpha',
          speakerLabel: 'Alpha',
          target: { type: 'user', label: 'User' },
          text: 'He still held back half a sentence.',
          highlightText: 'Do not make me drop this yet.',
          statusFields: [],
        }],
      }],
    },
  });

  const voices = buildUserAnchoredGroupOfflineEndingVoices(session, members);

  assert.equal(voices.length, 1);
  assert.match(voices[0]?.text || '', /还记着|没翻篇|先别让我就这么放掉/u);
});

test('buildDerivedGroupOfflineEndingPayload can still produce group-facing voices without explicit user-only continuity', () => {
  const members = [
    createCharacter('alpha', 'Alpha'),
    createCharacter('beta', 'Beta'),
  ];
  const session = createSession({
    generatedContent: {
      card: {
        timeLabel: 'Tonight 21:30',
        locationLabel: 'Old City Entrance',
        weatherLabel: 'Windy',
        participantLabels: ['Alpha', 'Beta'],
      },
      intro: 'The scene is over, but not fully cooled.',
      lines: [],
      characterBlocks: [],
      rounds: [{
        id: 'round-1',
        sceneText: 'Both of them were still carrying the aftertaste out of the gate.',
        characterEntries: [
          {
            characterId: 'alpha',
            speakerLabel: 'Alpha',
            target: { type: 'character', label: 'Beta', characterId: 'beta' },
            text: 'He was still watching Beta even after the scene broke apart.',
            statusFields: [],
            memoryPanel: {
              shortTerm: ['He still kept his attention on Beta.'],
              longTerm: [],
            },
          },
          {
            characterId: 'beta',
            speakerLabel: 'Beta',
            target: { type: 'group', label: 'Whole Group' },
            text: 'He did not let the mood go completely light again.',
            statusFields: [],
          },
        ],
      }],
    },
  });

  const payload = buildDerivedGroupOfflineEndingPayload(session, members);

  assert.equal(payload.summaryLines.length > 0, true);
  assert.equal(payload.endingVoices.length, 2);
  assert.match(payload.endingVoices[0]?.text || '', /@Beta|话头|挂着/u);
});

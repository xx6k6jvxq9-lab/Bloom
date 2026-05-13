import assert from 'node:assert/strict';
import test from 'node:test';
import { resetMemoryRecordData, saveMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import type { Character, DateSession, UserProfileExtended } from '../../types';
import { getLatestMemoryDiagnostic, resetMemoryDiagnostics } from '../memory/memoryDiagnostics';
import { buildDatingSceneInput } from './buildDatingSceneInput';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'alpha',
    name: overrides.name ?? 'Alpha',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? 'Calm, observant, and quietly affectionate.',
    openingRemark: overrides.openingRemark ?? '',
    ...overrides,
  } as Character;
}

function createSession(overrides: Partial<DateSession> = {}): DateSession {
  return {
    id: overrides.id ?? 'date-1',
    characterId: overrides.characterId ?? 'alpha',
    location: overrides.location ?? 'Cafe',
    scenario: overrides.scenario ?? 'Evening walk',
    mood: overrides.mood ?? 'Warm',
    backgroundScene: overrides.backgroundScene ?? 'city-night',
    messages: overrides.messages ?? [],
    timestamp: overrides.timestamp ?? 1_700_000_000_000,
    ...overrides,
  } as DateSession;
}

const userProfile: UserProfileExtended = {
  id: 'user-1',
  name: 'User',
  avatar: '',
  bio: '',
  mood: 'curious',
};

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  resetMemoryRecordData();
  resetMemoryDiagnostics();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
});

test('buildDatingSceneInput injects retrieved memory into dating prompt sections', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      alpha: [
        {
          id: 'fact-experience-1',
          kind: 'fact',
          sourceScene: 'direct_chat',
          sourceSessionType: 'direct',
          sourceSessionId: 'alpha',
          sourceEventIds: [],
          characterIds: ['alpha'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'remember the rooftop cafe story',
          timestamp: now - 600,
          factType: 'experience',
          subjectType: 'character',
          subjectId: 'alpha',
          confidence: 'explicit',
          relatedCharacterIds: ['alpha'],
        },
        {
          id: 'fact-plan-1',
          kind: 'fact',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'alpha',
          sourceEventIds: [],
          characterIds: ['alpha'],
          visibility: 'cross_scene_readable',
          stability: 'temporary',
          decayHint: 'medium',
          summary: 'schedule the next cafe revisit',
          timestamp: now - 500,
          factType: 'plan',
          subjectType: 'character',
          subjectId: 'alpha',
          confidence: 'explicit',
          relatedCharacterIds: ['alpha'],
        },
      ],
    },
  });

  const sceneInput = buildDatingSceneInput({
    mode: 'continue',
    character: createCharacter(),
    userProfile,
    session: createSession({
      messages: [
        {
          id: 'date-msg-1',
          role: 'user',
          text: 'Maybe we can revisit that cafe soon.',
          timestamp: now - 100,
        },
      ],
    }),
    chatHistory: [
      {
        role: 'user',
        text: 'You once mentioned the cafe rooftop view.',
        timestamp: now - 800,
      },
      {
        role: 'model',
        text: 'I still remember it.',
        timestamp: now - 700,
      },
    ],
    latestUserInput: 'cafe',
  });

  const joinedSections = sceneInput.sections.join('\n\n');
  const latestDiagnostic = getLatestMemoryDiagnostic({
    characterId: 'alpha',
    sourceScene: 'dating',
    type: 'read',
  });

  assert.match(joinedSections, /Retrieved Related Facts/);
  assert.match(joinedSections, /remember the rooftop cafe story/);
  assert.match(joinedSections, /Retrieved Open Tasks/);
  assert.match(joinedSections, /schedule the next cafe revisit/);
  assert.equal(latestDiagnostic?.type, 'read');
  if (latestDiagnostic?.type === 'read') {
    assert.equal(latestDiagnostic.retrievedMemoryCounts.matchedFacts > 0, true);
    assert.equal(latestDiagnostic.retrievedMemoryCounts.openTasks > 0, true);
    assert.equal(latestDiagnostic.promptSectionCount! > 0, true);
  }
});

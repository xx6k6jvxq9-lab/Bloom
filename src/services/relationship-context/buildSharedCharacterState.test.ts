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
  buildSharedCharacterStateFromCharacter,
  rebuildSharedStateFromCharacter,
} from './buildSharedCharacterState';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'alpha',
    name: overrides.name ?? 'Alpha',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? 'Quietly attentive.',
    openingRemark: overrides.openingRemark ?? '',
    ...overrides,
  } as Character;
}

test.beforeEach(async () => {
  installPersistenceTestEnvironment();
  resetMemoryRecordData();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
});

test('shared character state prefers record-derived signals before legacy snapshot fallback', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      alpha: [
        {
          id: 'wave-1',
          kind: 'relationship_wave',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'alpha',
          sourceEventIds: [],
          characterIds: ['alpha'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'record relationship residue',
          timestamp: now - 200,
          relationType: 'character_user',
          eventKind: 'bonding',
          valence: 'positive',
          intensity: 'medium',
          sourceCharacterId: 'alpha',
          targetUser: true,
        },
        {
          id: 'plan-1',
          kind: 'fact',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'alpha',
          sourceEventIds: [],
          characterIds: ['alpha'],
          visibility: 'cross_scene_readable',
          stability: 'temporary',
          decayHint: 'medium',
          summary: 'record cafe follow-up',
          timestamp: now - 150,
          factType: 'plan',
          subjectType: 'character',
          subjectId: 'alpha',
          confidence: 'explicit',
          relatedCharacterIds: ['alpha'],
        },
      ],
    },
  });

  const character = createCharacter({
    shortTermSummary: 'legacy short summary',
    sharedContextSnapshots: [{
      sourceScene: 'forum',
      settledAt: now - 1_000,
      relationshipResidue: [{
        type: 'relationship_residue',
        summary: 'legacy snapshot residue',
        sourceScene: 'forum',
        timestamp: now - 1_000,
        decay: 'short',
        visibility: 'cross_scene_readable',
      }],
      taskResidue: [{
        type: 'task_residue',
        summary: 'legacy snapshot task',
        sourceScene: 'forum',
        timestamp: now - 1_000,
        decay: 'short',
        visibility: 'cross_scene_readable',
      }],
    }],
  });

  const promptState = buildSharedCharacterStateFromCharacter({
    character,
  });
  const rebuiltSharedState = rebuildSharedStateFromCharacter({
    character,
  });

  assert.match(promptState.directPrompt, /record relationship residue|record cafe follow-up/);
  assert.doesNotMatch(promptState.directPrompt, /legacy short summary|legacy snapshot residue|legacy snapshot task/);
  assert.match(rebuiltSharedState.publicCarryover || '', /record relationship residue|record cafe follow-up/);
  assert.doesNotMatch(rebuiltSharedState.publicCarryover || '', /legacy snapshot residue|legacy snapshot task/);
  assert.doesNotMatch(rebuiltSharedState.privateCarryover || '', /legacy short summary|legacy snapshot residue|legacy snapshot task/);
});

test('shared character state also refreshes stale sharedState carryover from records first', async () => {
  const now = Date.now();
  await saveMemoryRecordData({
    updatedAt: now,
    recordsByCharacterId: {
      alpha: [
        {
          id: 'wave-2',
          kind: 'relationship_wave',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'alpha',
          sourceEventIds: [],
          characterIds: ['alpha'],
          visibility: 'cross_scene_readable',
          stability: 'situational',
          decayHint: 'medium',
          summary: 'fresh record residue',
          timestamp: now - 120,
          relationType: 'character_user',
          eventKind: 'bonding',
          valence: 'positive',
          intensity: 'medium',
          sourceCharacterId: 'alpha',
          targetUser: true,
        },
        {
          id: 'plan-2',
          kind: 'fact',
          sourceScene: 'dating',
          sourceSessionType: 'direct',
          sourceSessionId: 'alpha',
          sourceEventIds: [],
          characterIds: ['alpha'],
          visibility: 'cross_scene_readable',
          stability: 'temporary',
          decayHint: 'medium',
          summary: 'fresh record follow-up',
          timestamp: now - 100,
          factType: 'plan',
          subjectType: 'character',
          subjectId: 'alpha',
          confidence: 'explicit',
          relatedCharacterIds: ['alpha'],
        },
      ],
    },
  });

  const character = createCharacter({
    sharedState: {
      updatedAt: now - 10_000,
      sourceScene: 'forum',
      availability: 'recent',
      resumeTone: 'soft_return',
      currentActivity: 'legacy activity',
      attentionNote: 'legacy tone',
      publicCarryover: 'legacy public carryover',
      privateCarryover: 'legacy private carryover',
    },
  });

  const promptState = buildSharedCharacterStateFromCharacter({
    character,
  });
  const rebuiltSharedState = rebuildSharedStateFromCharacter({
    character,
  });

  assert.doesNotMatch(promptState.directPrompt, /legacy private carryover/);
  assert.match(promptState.groupPrompt, /fresh record residue|fresh record follow-up/);
  assert.doesNotMatch(promptState.groupPrompt, /legacy public carryover/);
  assert.match(rebuiltSharedState.publicCarryover || '', /fresh record residue|fresh record follow-up/);
  assert.doesNotMatch(rebuiltSharedState.publicCarryover || '', /legacy public carryover/);
  assert.doesNotMatch(rebuiltSharedState.privateCarryover || '', /legacy private carryover/);
});

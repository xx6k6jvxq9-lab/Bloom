import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { resetMemoryRecordData, saveMemoryRecordData } from '../../features/persistence/memoryRecordStore';
import { STORAGE_KEYS } from '../../features/persistence/storageKeys';
import {
  clearPersistenceKeys,
  installPersistenceTestEnvironment,
} from '../../features/persistence/testPersistenceHarness';
import { buildRelationshipProjection } from './buildRelationshipProjection';

function createCharacter(overrides: Partial<Character>): Character {
  return {
    id: 'character',
    name: 'Character',
    gender: 'other',
    avatar: '',
    setting: '',
    openingRemark: '',
    ...overrides,
  } as Character;
}

test('buildRelationshipProjection surfaces manual public-thread hints in public acquaintance summary', () => {
  const alpha = createCharacter({
    id: 'alpha',
    name: 'Alpha',
    publicThreadPeerHints: [{
      targetCharacterId: 'beta',
      familiarity: 'aware',
      interactionStyle: 'guarded',
      allowBanter: false,
      momentInteractionPolicy: 'observe_only',
      note: 'keep it brief in public',
      updatedAt: 20,
    }],
  });
  const beta = createCharacter({
    id: 'beta',
    name: 'Beta',
    publicThreadPeerHints: [{
      targetCharacterId: 'alpha',
      familiarity: 'aware',
      interactionStyle: 'guarded',
      allowBanter: false,
      momentInteractionPolicy: 'observe_only',
      note: 'keep it brief in public',
      updatedAt: 21,
    }],
  });

  const projection = buildRelationshipProjection({
    character: alpha,
    characters: [alpha, beta],
    userName: 'User',
  });

  const summary = projection.sceneScopedSignals.publicAcquaintanceSummary || '';
  assert.match(summary, /Manual public relation override with Beta:/);
  assert.match(summary, /aware of each other in public/);
  assert.match(summary, /style guarded/);
  assert.match(summary, /banter no/);
  assert.match(summary, /moment observe only/);
  assert.match(summary, /note keep it brief in public/);
});

test('buildRelationshipProjection also reads reverse-side manual public-thread hints', () => {
  const alpha = createCharacter({
    id: 'alpha',
    name: 'Alpha',
  });
  const beta = createCharacter({
    id: 'beta',
    name: 'Beta',
    publicThreadPeerHints: [{
      targetCharacterId: 'alpha',
      familiarity: 'familiar',
      interactionStyle: 'warm',
      allowIntimateTone: false,
      allowOwnershipTone: false,
      updatedAt: 10,
    }],
  });

  const projection = buildRelationshipProjection({
    character: alpha,
    characters: [alpha, beta],
    userName: 'User',
  });

  const summary = projection.sceneScopedSignals.publicAcquaintanceSummary || '';
  assert.match(summary, /Manual public relation override with Beta:/);
  assert.match(summary, /not close in public/);
  assert.match(summary, /style warm/);
  assert.match(summary, /intimate no/);
  assert.match(summary, /ownership no/);
});

test('buildRelationshipProjection can read scene signals from structured settlement records', async () => {
  installPersistenceTestEnvironment();
  resetMemoryRecordData();
  await clearPersistenceKeys([STORAGE_KEYS.memoryRecords]);
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
          summary: '刚结束的约会留下了一点关系余波',
          timestamp: now - 1_000,
          relationType: 'character_user',
          eventKind: 'bonding',
          valence: 'positive',
          intensity: 'medium',
          sourceCharacterId: 'alpha',
          targetUser: true,
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
          summary: '这场约会里还可能算数的约定：下周一起吃饭',
          timestamp: now - 800,
          factType: 'plan',
          subjectType: 'character',
          subjectId: 'alpha',
          confidence: 'explicit',
          relatedCharacterIds: ['alpha'],
        },
      ],
    },
  });

  const alpha = createCharacter({
    id: 'alpha',
    name: 'Alpha',
  });

  const projection = buildRelationshipProjection({
    character: alpha,
    userName: 'User',
  });

  assert.equal((projection.sceneScopedSignals.relationshipResidue || []).length > 0, true);
  assert.equal((projection.sceneScopedSignals.taskResidue || []).length > 0, true);
  assert.match(projection.sceneScopedSignals.sharedRecentRelationshipSummary || '', /下周一起吃饭|关系余波/);
});

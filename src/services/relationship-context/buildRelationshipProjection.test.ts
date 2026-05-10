import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
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

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { clearCoupleSpaceCharacterMemory } from './clearCoupleSpaceCharacterMemory';

function buildCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-a',
    name: '测试角色',
    gender: 'female',
    avatar: '',
    setting: '',
    openingRemark: '你好',
    ...overrides,
  } as Character;
}

test('clearCoupleSpaceCharacterMemory removes couple-space traces while keeping other shared snapshots', () => {
  const character = buildCharacter({
    shortTermSummary: '情侣空间里刚留下一点余波',
    openLoopRegistry: [{
      id: 'loop-1',
      kind: 'relationship',
      status: 'active',
      content: '情侣空间约定',
      source: 'short_term_summary',
      createdAt: 1,
      lastTouchedAt: 1,
      updatedAt: 1,
    }],
    presenceState: {
      lastSeenAt: 1,
      availability: 'live',
      updatedAt: 1,
    },
    sharedState: {
      updatedAt: 1,
      sourceScene: 'couple_space',
      availability: 'live',
      privateCarryover: '情侣空间里的余波',
    },
    sharedContextSnapshots: [
      {
        sourceScene: 'couple_space',
        settledAt: 1,
        relationshipResidue: [{
          type: 'relationship_residue',
          summary: '情侣空间里的痕迹',
          sourceScene: 'couple_space',
          timestamp: 1,
          decay: 'medium',
          visibility: 'private',
        }],
      },
      {
        sourceScene: 'direct_chat',
        settledAt: 2,
        relationshipResidue: [{
          type: 'relationship_residue',
          summary: '聊天里的痕迹',
          sourceScene: 'direct_chat',
          timestamp: 2,
          decay: 'short',
          visibility: 'private',
        }],
      },
    ],
  });

  const cleared = clearCoupleSpaceCharacterMemory(character);

  assert.equal(cleared.shortTermSummary, undefined);
  assert.equal(cleared.openLoopRegistry, undefined);
  assert.deepEqual(
    (cleared.sharedContextSnapshots || []).map((snapshot) => snapshot.sourceScene),
    ['direct_chat'],
  );
  assert.equal(cleared.sharedState?.sourceScene, 'direct_chat');
});

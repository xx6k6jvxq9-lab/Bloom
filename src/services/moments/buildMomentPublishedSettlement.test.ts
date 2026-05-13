import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { buildMomentPublishedSettlement } from './buildMomentPublishedSettlement';

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

test('buildMomentPublishedSettlement creates unified scene settlement for a normal public post', () => {
  const settlement = buildMomentPublishedSettlement({
    character: createCharacter({
      shortTermSummary: '旧的短期摘要',
    }),
    moment: {
      content: '窗外风有点大，今天先记这一句。',
      timestamp: 1_700_000_000_123,
    },
  });

  assert.equal(settlement.sharedContextSnapshots.length, 1);
  assert.match(settlement.shortTermSummary || '', /刚刚发了一条公开动态/);
  assert.match(settlement.sharedState?.publicCarryover || '', /刚刚发了一条公开动态/);
});

test('buildMomentPublishedSettlement can preserve relationship residue when the post has clear carryover vibes', () => {
  const settlement = buildMomentPublishedSettlement({
    character: createCharacter(),
    moment: {
      content: '偏心这种事，有时候装不出来。',
      timestamp: 1_700_000_000_456,
    },
  });

  const snapshot = settlement.sharedContextSnapshots[0];
  assert.equal(Boolean(snapshot?.relationshipResidue?.length), true);
  assert.match(snapshot?.relationshipResidue?.[0]?.summary || '', /关系余波/);
});

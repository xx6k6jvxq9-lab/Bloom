import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { buildCoupleSpaceSharedSettlement } from './buildCoupleSpaceSharedSettlement';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'couple-char',
    name: overrides.name ?? 'Couple Character',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? '',
    openingRemark: overrides.openingRemark ?? '',
    ...overrides,
  } as Character;
}

test('buildCoupleSpaceSharedSettlement emits structured scene progress for couple-space continuity', () => {
  const settlement = buildCoupleSpaceSharedSettlement(createCharacter(), {
    type: 'co_note',
    content: '下周一起把那件事办掉，记得回来补上。',
    timestamp: 1_700_000_000_002,
    authorRole: 'partner',
  });

  const record = settlement.sceneProgressRecords?.[0];

  assert.equal(Boolean(record), true);
  assert.match(record?.summary || '', /情侣空间推进到/);
  assert.match(record?.stageLabel || '', /共同生活协作阶段/);
  assert.match(record?.currentSignature || '', /共笔安排/);
  assert.equal(record?.nextStepOptions?.length ? true : false, true);
});

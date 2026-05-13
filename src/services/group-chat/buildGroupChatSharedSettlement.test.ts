import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { buildGroupChatSharedSettlement } from './buildGroupChatSharedSettlement';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'group-char',
    name: overrides.name ?? 'Group Character',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? '',
    openingRemark: overrides.openingRemark ?? '',
    ...overrides,
  } as Character;
}

test('buildGroupChatSharedSettlement emits structured scene progress for group continuity', () => {
  const settlement = buildGroupChatSharedSettlement(createCharacter(), {
    speakerName: 'Alpha',
    content: '那这件事我来接，我们约定晚点把细节补上。',
    timestamp: 1_700_000_000_003,
  });

  const record = settlement.sceneProgressRecords?.[0];

  assert.equal(Boolean(record), true);
  assert.match(record?.summary || '', /群聊推进到/);
  assert.match(record?.stageLabel || '', /群内协作推进阶段/);
  assert.match(record?.currentSignature || '', /群内协作/);
  assert.equal(record?.visibility, 'group_public');
});

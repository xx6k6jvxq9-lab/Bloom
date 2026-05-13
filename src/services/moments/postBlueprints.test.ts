import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { buildMomentPostBlueprint } from './postBlueprints';

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

test('text-only blueprint constraints can override image-heavy requests', () => {
  const blueprint = buildMomentPostBlueprint({
    character: createCharacter(),
    requestText: '九宫格截图配文，但这次必须是纯文字动态。',
    mode: 'relationship_carryover',
    forceTextOnly: true,
    allowedShapes: ['short_status', 'soft_claim'],
  });

  assert.equal(blueprint.allowImages, false);
  assert.equal(['short_status', 'soft_claim'].includes(blueprint.shape), true);
  assert.equal(
    blueprint.styleHints.some((hint) => hint.includes('纯文字动态')),
    true,
  );
  assert.equal(
    blueprint.promptSections.some((section) => section.includes('不要写配图说明')),
    true,
  );
});

test('blocked shapes keep blueprint away from cooled-down long forms', () => {
  const blueprint = buildMomentPostBlueprint({
    character: createCharacter(),
    requestText: '想写一条夜里记录，分段长文也可以。',
    mode: 'self_life',
    blockedShapes: ['multi_paragraph', 'journal_note'],
  });

  assert.equal(['multi_paragraph', 'journal_note'].includes(blueprint.shape), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../../types';
import { buildForumCharacterContext } from './buildForumCharacterContext';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'alpha',
    name: overrides.name ?? 'Alpha',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? '他在别人面前不避讳占有欲，喜欢半开玩笑提你，像在宣示主权。',
    openingRemark: overrides.openingRemark ?? '你终于来了。',
    signature: overrides.signature ?? '懒得装不在意。',
    expressionStyle: overrides.expressionStyle ?? '公开场合会轻描淡写地阴阳一句。',
    boundaryPack: overrides.boundaryPack ?? '不会把私聊原话直接搬到群里。',
    ...overrides,
  } as Character;
}

test('buildForumCharacterContext includes a public persona guide for public-scene generation', () => {
  const context = buildForumCharacterContext(createCharacter());

  assert.match(context.publicPersonaGuide, /## 公开场合角色锚点/);
  assert.match(context.publicPersonaGuide, /宣示主权/);
  assert.match(context.publicPersonaGuide, /不会把私聊原话直接搬到群里/);
});

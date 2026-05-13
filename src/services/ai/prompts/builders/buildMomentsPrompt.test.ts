import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMomentsPrompt } from './buildMomentsPrompt';

test('buildMomentsPrompt keeps public persona guide inside the character core section', () => {
  const prompt = buildMomentsPrompt({
    characterCore: {
      characterSetting: '他在公开场合会嘴硬，会留一点余地。',
      signature: '懒得装不在意。',
      personaGuidePrompt: [
        '## 公开场合角色锚点',
        '[角色可主动外放的私密线索]',
        '- 喜欢半开玩笑提你，像在宣示主权。',
      ].join('\n'),
    },
  });

  assert.match(prompt, /## 公开场合角色锚点/);
  assert.match(prompt, /宣示主权/);
});

test('buildMomentsPrompt renders fact boundary rules when provided', () => {
  const prompt = buildMomentsPrompt({
    postContext: {
      factBoundaryLines: [
        '事实来源优先级：当前场景 > 已写回共享状态/近期记忆 > 角色设定与长期设定 > 模型自由补充。',
        '没有来源的事实一律视为“未知”，不是“不存在”；可以不写，但不要硬补成稳定设定。',
      ],
    },
  });

  assert.match(prompt, /## 事实边界与受控扩写/);
  assert.match(prompt, /事实来源优先级/);
  assert.match(prompt, /未知/);
});

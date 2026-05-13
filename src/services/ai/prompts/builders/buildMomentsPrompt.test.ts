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

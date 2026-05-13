import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMomentCommentReplyPrompt } from './buildMomentCommentReplyPrompt';

test('buildMomentCommentReplyPrompt keeps public persona guide for public reply contexts', () => {
  const prompt = buildMomentCommentReplyPrompt({
    characterCore: {
      characterSetting: '他在公开场合会嘴硬，会留一点余地。',
      signature: '懒得装不在意。',
      personaGuidePrompt: [
        '## 公开场合角色锚点',
        '[公开外放方式倾向]',
        '- 轻描淡写地阴阳一句，再装作若无其事。',
      ].join('\n'),
    },
    momentContext: {
      momentContent: '今天风很大。',
      userComment: '看起来你心情不错。',
    },
  });

  assert.match(prompt, /## 公开场合角色锚点/);
  assert.match(prompt, /轻描淡写地阴阳一句/);
});

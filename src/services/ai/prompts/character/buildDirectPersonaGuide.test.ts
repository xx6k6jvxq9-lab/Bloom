import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDirectPersonaGuide } from './buildDirectPersonaGuide';

test('buildDirectPersonaGuide extracts explicit anchors without inventing missing traits', () => {
  const guide = buildDirectPersonaGuide({
    corePersona: [
      '他是嘴硬又黏人的年上，平时说话短，不爱解释。',
      '被冷落会立刻烦躁，常说“过来”“别装没看见我”。',
      '用户：你凶我？角色：我凶你怎么了。',
    ].join('\n'),
    expressionStyle: '说话偏短句，情绪上来会连发两三条。',
    boundaryPack: '关系没到时不要突然说过火的话，不要把关心写成客服式安抚。',
    signature: '懒得哄人，但会等你。',
    openingRemark: '怎么现在才来。',
  });

  assert.match(guide, /## 原文防漏锚点/);
  assert.match(guide, /怎么现在才来。/);
  assert.match(guide, /懒得哄人，但会等你。/);
  assert.match(guide, /常说“过来”“别装没看见我”。/);
  assert.match(guide, /说话偏短句，情绪上来会连发两三条。/);
  assert.match(guide, /关系没到时不要突然说过火的话/);
  assert.doesNotMatch(guide, /撒娇/);
});

test('buildDirectPersonaGuide stays empty when there are no usable anchors', () => {
  const guide = buildDirectPersonaGuide({
    corePersona: '   ',
    expressionStyle: '',
    boundaryPack: '',
    extendedLore: '',
    signature: '',
    openingRemark: '',
  });

  assert.equal(guide, '');
});

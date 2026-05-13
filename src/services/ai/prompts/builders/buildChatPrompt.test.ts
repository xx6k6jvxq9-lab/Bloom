import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChatPrompt } from './buildChatPrompt';

test('buildChatPrompt keeps opening anchors and direct persona guide inside the character core section', () => {
  const prompt = buildChatPrompt({
    characterCore: {
      characterSetting: '你是一个嘴硬但会认真接话的人。',
      openingRemark: '怎么现在才来。',
      signature: '懒得哄人，但会等你。',
      personaGuidePrompt: [
        '## 原文防漏锚点',
        '[开口语感锚点]',
        '- 过来。',
      ].join('\n'),
    },
    sections: ['## 其他补充\n先读这个也没关系。'],
  });

  const coreIndex = prompt.indexOf('[核心设定与原生性格]');
  const openingIndex = prompt.indexOf('[常见开口语感 / first message anchor]');
  const signatureIndex = prompt.indexOf('[角色签名 / short vibe anchor]');
  const guideIndex = prompt.indexOf('## 原文防漏锚点');
  const extraIndex = prompt.indexOf('## 其他补充');

  assert.ok(coreIndex > 0);
  assert.ok(openingIndex > coreIndex);
  assert.ok(signatureIndex > openingIndex);
  assert.ok(guideIndex > signatureIndex);
  assert.ok(extraIndex > guideIndex);
});

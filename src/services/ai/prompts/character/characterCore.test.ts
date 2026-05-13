import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCharacterCoreSection } from './characterCore';

test('buildCharacterCoreSection renders opening anchor, signature, and direct persona guide before scene rules', () => {
  const section = buildCharacterCoreSection({
    mode: 'character_speaking',
    characterSetting: '你是一个嘴硬但会认真接话的人。',
    openingRemark: '怎么现在才来。',
    signature: '懒得哄人，但会等你。',
    personaGuidePrompt: [
      '## 原文防漏锚点',
      '[开口语感锚点]',
      '- 过来。',
    ].join('\n'),
  });

  const openingIndex = section.indexOf('[常见开口语感 / first message anchor]');
  const signatureIndex = section.indexOf('[角色签名 / short vibe anchor]');
  const guideIndex = section.indexOf('## 原文防漏锚点');
  const maskIndex = section.indexOf('[Mask / 当前身份与关系滤镜]');

  assert.ok(openingIndex > 0);
  assert.ok(signatureIndex > openingIndex);
  assert.ok(guideIndex > signatureIndex);
  assert.equal(maskIndex, -1);
  assert.match(section, /怎么现在才来。/);
  assert.match(section, /懒得哄人，但会等你。/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicPersonaGuide } from './buildPublicPersonaGuide';

test('buildPublicPersonaGuide keeps public anchors and explicit shareable-private cues separate', () => {
  const guide = buildPublicPersonaGuide({
    corePersona: [
      '他在别人面前不避讳占有欲，喜欢半开玩笑提你，像在宣示主权。',
      '但不会把私聊原话直接搬出去。',
    ].join('\n'),
    expressionStyle: '公开场合会轻描淡写地阴阳一句，再装作若无其事。',
    boundaryPack: '不会把私聊原话直接搬到群里，不让别人知道只有你们两个才懂的细节。',
    signature: '懒得装不在意。',
  });

  assert.match(guide, /## 公开场合角色锚点/);
  assert.match(guide, /懒得装不在意。/);
  assert.match(guide, /喜欢半开玩笑提你，像在宣示主权。/);
  assert.match(guide, /公开场合会轻描淡写地阴阳一句/);
  assert.match(guide, /不会把私聊原话直接搬到群里/);
});

test('buildPublicPersonaGuide does not invent shareable cues when the raw persona never says so', () => {
  const guide = buildPublicPersonaGuide({
    corePersona: '他慢热，公开场合更克制，说话不多。',
    expressionStyle: '公开时偏短句。',
    boundaryPack: '不喜欢把私事讲给外人听。',
  });

  assert.doesNotMatch(guide, /\[角色可主动外放的私密线索\]/);
  assert.match(guide, /公开场合收着的边界/);
});

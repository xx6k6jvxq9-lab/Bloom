import test from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildGroupOfflineDirectorInstructionRuntimeText,
  resolveGroupOfflineDirectorPagePlan,
} from './directorInstructionOutputMode';

test('buildGroupOfflineDirectorInstructionRuntimeText keeps auto mode transparent', () => {
  assert.equal(
    buildGroupOfflineDirectorInstructionRuntimeText('先让沈星回接。', 'auto'),
    '先让沈星回接。',
  );
});

test('buildGroupOfflineDirectorInstructionRuntimeText prepends fixed-route hints for forced output modes', () => {
  const runtimeText = buildGroupOfflineDirectorInstructionRuntimeText('先让沈星回接。', 'wechat_chat');

  assert.match(runtimeText, /固定输出为微信聊天页面/);
  assert.match(runtimeText, /先让沈星回接。/);
});

test('resolveGroupOfflineDirectorPagePlan can force a wechat page without relying on raw keywords', () => {
  assert.deepEqual(
    resolveGroupOfflineDirectorPagePlan('先让沈星回接。', 'wechat_chat'),
    { pageType: 'wechat_chat', platform: 'wechat' },
  );
});

test('resolveGroupOfflineDirectorPagePlan can force plain narrative even when the raw instruction mentions html', () => {
  assert.equal(
    resolveGroupOfflineDirectorPagePlan('生成一个 html 页面，做一个可交互模块。', 'narrative'),
    undefined,
  );
});

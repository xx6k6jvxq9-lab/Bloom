import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDatingPrompt } from './buildDatingPrompt';

test('buildDatingPrompt uses scene progress instead of replaying the previous full narrative block', () => {
  const prompt = buildDatingPrompt({
    sceneInput: {
      mode: 'continue',
      characterName: '测试角色',
      corePersona: '嘴硬但会认真接话。',
      userName: '用户',
      location: '街角',
      scenario: '散步',
      mood: '暧昧',
      backgroundRule: '不要把背景图片当成剧情线索。',
      pastChatContext: '用户：上次你说过会来接我。',
      datingMessages: '角色上一轮剧情：她靠近了一点，没有躲开。',
      sceneProgress: '## Scene Progress\n[当前阶段] 试探靠近阶段\n[本轮禁止重复]\n- 靠近\n- 对视',
      currentGeneratedStatus: '当前状态：地点：街角',
      currentGeneratedPlaylist: '当前歌单：暂无',
      task: '请继续推进当前约会。',
      sections: [],
    },
  });

  assert.match(prompt, /## Scene Progress/);
  assert.match(prompt, /本轮禁止重复/);
  assert.doesNotMatch(prompt, /最近一轮已生成的约会正文/);
});

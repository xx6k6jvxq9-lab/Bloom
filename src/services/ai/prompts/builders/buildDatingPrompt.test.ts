import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDatingPrompt } from './buildDatingPrompt';

test('buildDatingPrompt uses scene progress instead of replaying the previous full narrative block', () => {
  const prompt = buildDatingPrompt({
    sceneInput: {
      mode: 'continue',
      outputMode: 'scene',
      characterName: '测试角色',
      corePersona: '嘴硬但会认真接话。',
      userName: '用户',
      location: '街角',
      scenario: '散步',
      mood: '暧昧',
      backgroundRule: '不要把背景图片当成剧情线索。',
      relationshipBaselineBlock: '## 当前关系基线\n[已成立关系基线] 这是一段已经成立的亲密关系。',
      pastChatContext: '用户：上次你说过会来接我。',
      datingMessages: '角色上一轮剧情：她靠近了一点，没有躲开。',
      sceneProgress: '## Scene Progress\n[说明] 这里只描述当前这几轮约会里的动作推进与气氛节奏，不等于你们整体关系被重置或降级。\n[本轮推进阶段] 试探靠近阶段\n[本轮禁止重复]\n- 靠近\n- 对视',
      currentGeneratedStatus: '当前状态：地点：街角',
      currentGeneratedPlaylist: '当前歌单：暂无',
      task: '请继续推进当前约会。',
      sections: [],
    },
  });

  assert.match(prompt, /## Scene Progress/);
  assert.match(prompt, /本轮禁止重复/);
  assert.match(prompt, /当前关系基线/);
  assert.doesNotMatch(prompt, /最近一轮已生成的约会正文/);
});

test('buildDatingPrompt switches to page episode protocol when requested', () => {
  const prompt = buildDatingPrompt({
    sceneInput: {
      mode: 'continue',
      outputMode: 'page_episode',
      pageEpisodeInstructionBlock: '## 页面番外输出模式\n本轮输出协议切换为 `page_episode`。',
      characterName: '测试角色',
      corePersona: '嘴硬但会认真接话。',
      openingRemark: '常见开口：先冷一下，再补一句。',
      personaGuidePrompt: '## 原文防漏锚点\n- 嘴硬，不会突然变成标准温柔模板。',
      userName: '用户',
      pagePromptContext: {
        directReplyConfig: {
          minReplies: 2,
          maxReplies: 4,
        },
        languagePolicy: {
          replyLanguageMode: 'follow-user',
          nativeLanguage: '中文',
        },
        memoryContext: {
          shortTermSummary: '刚刚留下了一点没散的情绪余波。',
          longTermMemoryProfile: '长期关系里更容易嘴硬，但会认真回消息。',
        },
        recentContext: {
          shortTermSummary: '最近还在拉扯里。',
        },
      },
      location: '街角',
      scenario: '散步',
      mood: '暧昧',
      backgroundRule: '不要把背景图片当成剧情线索。',
      relationshipBaselineBlock: '## 当前关系基线\n[已成立关系基线] 这是一段已经成立的亲密关系。',
      directorInstructionBlock: '## 导演额外指令\n暂停主线，改成微信聊天番外。',
      pastChatContext: '用户：上次你说过会来接我。',
      datingMessages: '角色上一轮剧情：她靠近了一点，没有躲开。',
      sceneProgress: '## Scene Progress\n[本轮推进阶段] 试探靠近阶段',
      currentGeneratedStatus: '当前状态：地点：街角',
      currentGeneratedPlaylist: '当前歌单：暂无',
      task: '当前任务：下一轮优先生成一页微信聊天页面番外。',
      sections: [],
    },
  });

  assert.match(prompt, /page_episode/);
  assert.match(prompt, /微信聊天页规则/);
  assert.match(prompt, /页面番外输出模式/);
  assert.match(prompt, /pageEpisode\.feed\.items/);
  assert.match(prompt, /不要把 5 条内容编号成 1\/2\/3\/4\/5 然后塞进同一个 "body"/);
  assert.match(prompt, /主页资料页 \+ 下面动态流/);
  assert.match(prompt, /默认都要生成网友评论/);
  assert.match(prompt, /首屏必须直接可见/);
  assert.match(prompt, /主要视觉区/);
  assert.match(prompt, /handle/);
  assert.match(prompt, /bio/);
  assert.match(prompt, /followerCountLabel/);
  assert.match(prompt, /角色核心/);
  assert.match(prompt, /嘴硬，不会突然变成标准温柔模板/);
  assert.match(prompt, /当前对话用户/);
  assert.match(prompt, /单聊节奏/);
  assert.match(prompt, /近期记忆与当前处境/);
  assert.ok(prompt.indexOf('角色核心') < prompt.indexOf('微信聊天页规则'));
});

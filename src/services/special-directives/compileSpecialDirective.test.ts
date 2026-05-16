import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileSpecialDirective,
  extractSpecialDirectiveCommand,
} from './compileSpecialDirective';

test('extractSpecialDirectiveCommand pulls the body behind full-width or ascii dollar prefixes', () => {
  assert.equal(extractSpecialDirectiveCommand('$暂停主线，开番外'), '暂停主线，开番外');
  assert.equal(extractSpecialDirectiveCommand('＄生成微信页面'), '生成微信页面');
  assert.equal(extractSpecialDirectiveCommand('普通消息'), null);
});

test('compileSpecialDirective classifies ordinary special episodes as narrative output', () => {
  const plan = compileSpecialDirective('暂停当前主线，生成一个番外小剧场，不计入主线。');

  assert.equal(plan?.outputKind, 'narrative_episode');
  assert.equal(plan?.sceneHandling, 'pause_mainline');
  assert.equal(plan?.writebackPolicy, 'side_story');
  assert.equal(plan?.eventPlan.length, 1);
});

test('compileSpecialDirective compiles wechat page directives into structured platform page plans', () => {
  const plan = compileSpecialDirective(`现在暂停主线剧情，为我生成一个小手机微信聊天格式的番外。
不要状态栏。
消息不低于 60 条。
话风幽默搞笑，直白大胆。`);

  assert.equal(plan?.outputKind, 'platform_page');
  assert.equal(plan?.platform, 'wechat');
  assert.equal(plan?.pageType, 'wechat_chat');
  assert.equal(plan?.chrome.statusBarMode, 'hidden');
  assert.equal(plan?.hardConstraints.some((line) => line.includes('消息不低于 60 条')), true);
  assert.equal(plan?.softPreferences.some((line) => line.includes('幽默搞笑')), true);
});

test('compileSpecialDirective routes interactive html mini-app asks into micro app plans', () => {
  const plan = compileSpecialDirective(`生成一个html，使用js+svg+css。
点击按钮后出现绘制动画。
框架为 height:400px, max-width:350px。`);

  assert.equal(plan?.outputKind, 'micro_app');
  assert.equal(plan?.pageType, 'micro_app');
  assert.equal(plan?.hardConstraints.some((line) => line.includes('height:400px')), true);
});

test('compileSpecialDirective routes survey-like page asks into document page plans', () => {
  const plan = compileSpecialDirective('生成一个 html 页面，做一个调查问卷页，带 5 个问题和提交按钮。');

  assert.equal(plan?.outputKind, 'platform_page');
  assert.equal(plan?.platform, 'survey');
  assert.equal(plan?.pageType, 'document_page');
});

test('compileSpecialDirective routes feed-like platform asks into feed post plans', () => {
  const momentsPlan = compileSpecialDirective('生成一个朋友圈页面番外，连续发5条动态，带评论区。');
  const xhsPlan = compileSpecialDirective('生成一个小红书风页面，带标题和评论。');

  assert.equal(momentsPlan?.outputKind, 'platform_page');
  assert.equal(momentsPlan?.platform, 'moments');
  assert.equal(momentsPlan?.pageType, 'feed_post');
  assert.equal(momentsPlan?.hardConstraints.some((line) => line.includes('5条动态')), true);
  assert.equal(xhsPlan?.platform, 'xiaohongshu');
  assert.equal(xhsPlan?.pageType, 'feed_post');
});

test('compileSpecialDirective can still fall back to custom html for unsupported generic html asks', () => {
  const plan = compileSpecialDirective('生成一个 html 页面，做一个奇怪的赛博互动页面，带自由布局。');

  assert.equal(plan?.outputKind, 'custom_html');
  assert.equal(plan?.pageType, 'custom_html');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureSocialFeedComments, extractRequiredCommentCount, splitFeedBodyIntoItems } from './pageEpisodeFeed';

test('splitFeedBodyIntoItems keeps ordinary single-post copy untouched', () => {
  const result = splitFeedBodyIntoItems('只是普通的一条朋友圈正文，没有编号。');

  assert.deepEqual(result, []);
});

test('splitFeedBodyIntoItems expands numbered series into multiple posts and preserves intro on the first item', () => {
  const result = splitFeedBodyIntoItems(`【今日份碎碎念】

1. 刚才在路边看到一棵树，长得很像林然。

2. 尝试把林然的备注改成“薯条”，结果看着看着又改回去了。

3. 刚才有一只流浪猫路过，它长得像林然不回消息时的样子。`);

  assert.equal(result.length, 3);
  assert.match(result[0], /今日份碎碎念/);
  assert.doesNotMatch(result[0], /^1\./);
  assert.equal(result[1].startsWith('尝试把林然的备注改成“薯条”'), true);
  assert.equal(result[2].startsWith('刚才有一只流浪猫路过'), true);
});

test('extractRequiredCommentCount can read explicit comment count asks', () => {
  assert.equal(extractRequiredCommentCount('评论区至少有20条评论，一次性生成完成。'), 20);
  assert.equal(extractRequiredCommentCount('普通动态，不要求评论。'), undefined);
});

test('ensureSocialFeedComments auto-fills public social comments outside wechat and moments', () => {
  const hydrated = ensureSocialFeedComments({
    authorName: '测试楼主',
    body: '【求助】请问这种情况我该不该继续？',
    comments: [],
  }, 'weibo', '评论区至少有5条评论');

  assert.equal(hydrated.comments.length, 5);
  assert.equal(hydrated.commentCountLabel, '5');
});

test('ensureSocialFeedComments leaves moments untouched when comments are empty', () => {
  const hydrated = ensureSocialFeedComments({
    authorName: '测试楼主',
    body: '今天风很大。',
    comments: [],
  }, 'moments', '评论区至少有5条评论');

  assert.equal(hydrated.comments.length, 0);
});

test('ensureSocialFeedComments uses different fallback tones across platforms', () => {
  const weibo = ensureSocialFeedComments({
    authorName: '测试楼主',
    body: '【求助】她这样到底算不算特别？',
    comments: [],
  }, 'weibo', '评论区至少有1条评论');
  const xiaohongshu = ensureSocialFeedComments({
    authorName: '测试楼主',
    body: '【求助】她这样到底算不算特别？',
    comments: [],
  }, 'xiaohongshu', '评论区至少有1条评论');

  assert.notEqual(weibo.comments[0]?.text, xiaohongshu.comments[0]?.text);
});

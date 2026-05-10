import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isDirectMomentPublishCommand,
  isFollowupMomentPublishCommand,
  shouldTriggerMomentPublishFromChat,
} from './triggers';

test('direct moment publish commands accept natural generate phrases', () => {
  assert.equal(isDirectMomentPublishCommand('生成一个动态'), true);
  assert.equal(isDirectMomentPublishCommand('写条朋友圈'), true);
  assert.equal(isDirectMomentPublishCommand('帮我发个状态吧'), true);
  assert.equal(isDirectMomentPublishCommand('帮我生成一条说说呀'), true);
});

test('follow-up moment publish commands accept rewrite phrases after a direct trigger', () => {
  const context = {
    recentMessages: [
      {
        role: 'user' as const,
        text: '发条动态',
        timestamp: Date.now() - 1000,
      },
    ],
    now: Date.now(),
  };

  assert.equal(isFollowupMomentPublishCommand('再生成一个', context), true);
  assert.equal(isFollowupMomentPublishCommand('再写一条朋友圈', context), true);
  assert.equal(isFollowupMomentPublishCommand('再来个状态', context), true);
});

test('unrelated chat should not trigger moment publishing', () => {
  assert.equal(shouldTriggerMomentPublishFromChat('生成一张图'), false);
  assert.equal(shouldTriggerMomentPublishFromChat('帮我总结一下刚才的话'), false);
  assert.equal(shouldTriggerMomentPublishFromChat('在吗'), false);
});

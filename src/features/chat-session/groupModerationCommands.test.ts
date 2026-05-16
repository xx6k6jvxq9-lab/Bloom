import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseModerationDurationMs,
  resolveExplicitModerationCommand,
  resolveRequestedModerationAction,
} from './groupModerationCommands';

const members = [
  { id: 'a', name: '张白', remarkName: '小白' },
  { id: 'b', name: '沈星回', remarkName: '沈星回' },
];

test('resolveExplicitModerationCommand parses direct mute command', () => {
  const result = resolveExplicitModerationCommand({
    message: { text: '把张白先禁言一下。' },
    members,
  });

  assert.deepEqual(result, {
    action: 'mute',
    targetMemberId: 'a',
    durationMs: undefined,
  });
});

test('resolveExplicitModerationCommand extracts mute duration when spoken explicitly', () => {
  const result = resolveExplicitModerationCommand({
    message: { text: '把张白禁言10分钟。' },
    members,
  });

  assert.deepEqual(result, {
    action: 'mute',
    targetMemberId: 'a',
    durationMs: 10 * 60 * 1000,
  });
});

test('resolveExplicitModerationCommand ignores discussion about mute button', () => {
  const result = resolveExplicitModerationCommand({
    message: { text: '我在研究禁言按钮在哪里。' },
    members,
  });

  assert.equal(result, null);
});

test('resolveRequestedModerationAction can use user request plus admin approval reply', () => {
  const result = resolveRequestedModerationAction({
    userMessage: { text: '管理员把张白禁言一下' },
    adminReplyText: '确实有点吵，先处理一下。',
    members,
  });

  assert.deepEqual(result, {
    action: 'mute',
    targetMemberId: 'a',
    durationMs: undefined,
  });
});

test('parseModerationDurationMs supports minute and hour forms', () => {
  assert.equal(parseModerationDurationMs('先禁言10分钟'), 10 * 60 * 1000);
  assert.equal(parseModerationDurationMs('那就禁言2小时'), 2 * 60 * 60 * 1000);
  assert.equal(parseModerationDurationMs('半小时就行'), 30 * 60 * 1000);
});

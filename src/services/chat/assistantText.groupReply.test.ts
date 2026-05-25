import assert from 'node:assert/strict';
import test from 'node:test';
import { stripAssistantSpeakerPrefix } from './assistantText';

test('stripAssistantSpeakerPrefix removes reply cues after trimming the speaker label', () => {
  const cleaned = stripAssistantSpeakerPrefix(
    '怀哥哥: [reply: 沈星回] 听听，人家把你当货物呢。',
    ['怀哥哥'],
  );

  assert.equal(cleaned, '听听，人家把你当货物呢。');
});

test('stripAssistantSpeakerPrefix also removes reply-to cues with @ targets', () => {
  const cleaned = stripAssistantSpeakerPrefix(
    '怀哥哥: [reply to @沈星回] 还有，沈星回，',
    ['怀哥哥'],
  );

  assert.equal(cleaned, '还有，沈星回，');
});

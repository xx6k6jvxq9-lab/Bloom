import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGroupActionCue } from './useGroupChatRuntime';

test('parseGroupActionCue parses reply cues even when the model omits the colon', () => {
  const cue = parseGroupActionCue('[reply 张白] 给搭档分一点光，不算浪费。');

  assert.deepEqual(cue, {
    kind: 'reply',
    replyTargetName: '张白',
    content: '给搭档分一点光，不算浪费。',
  });
});

test('parseGroupActionCue parses reply cues when the target starts with @', () => {
  const cue = parseGroupActionCue('[reply to @张白] 阳光对土豆只能催熟，不能开机。');

  assert.deepEqual(cue, {
    kind: 'reply',
    replyTargetName: '张白',
    content: '阳光对土豆只能催熟，不能开机。',
  });
});

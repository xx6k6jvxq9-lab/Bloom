import assert from 'node:assert/strict';
import test from 'node:test';
import { splitDirectAssistantReplyText } from './assistantText';

test('splitDirectAssistantReplyText separates bracket action from spoken text on the same line', () => {
  const parts = splitDirectAssistantReplyText('（走近你）晚安，别熬了。', 4);

  assert.deepEqual(parts, ['（走近你）', '晚安，别熬了。']);
});

test('splitDirectAssistantReplyText keeps bracket-only action as its own bubble', () => {
  const parts = splitDirectAssistantReplyText('（轻轻抱住你）', 4);

  assert.deepEqual(parts, ['（轻轻抱住你）']);
});

test('splitDirectAssistantReplyText respects a bubble cap above five when explicit segments are present', () => {
  const parts = splitDirectAssistantReplyText(
    [
      '第一句',
      '第二句',
      '第三句',
      '第四句',
      '第五句',
      '第六句',
      '第七句',
      '第八句',
    ].join('\n'),
    8,
  );

  assert.equal(parts.length, 8);
  assert.equal(parts[7], '第八句');
});

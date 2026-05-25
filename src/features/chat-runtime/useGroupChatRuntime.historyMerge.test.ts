import assert from 'node:assert/strict';
import test from 'node:test';
import { appendUniqueGroupHistoryMessages } from './useGroupChatRuntime';

test('appendUniqueGroupHistoryMessages appends new messages without dropping existing history', () => {
  const merged = appendUniqueGroupHistoryMessages(
    [
      { role: 'user', text: 'hello', timestamp: 1 } as any,
      { role: 'model', text: 'reply', timestamp: 2, senderCharacterId: 'speaker' } as any,
    ],
    [
      { role: 'model', text: '[system] poke', timestamp: 3, isSystem: true } as any,
    ],
  );

  assert.equal(merged.length, 3);
  assert.equal(merged[2]?.text, '[system] poke');
});

test('appendUniqueGroupHistoryMessages skips duplicate messages by history key', () => {
  const systemMessage = { role: 'model', text: '[system] poke', timestamp: 3, isSystem: true } as any;
  const merged = appendUniqueGroupHistoryMessages([systemMessage], [systemMessage]);

  assert.equal(merged.length, 1);
});

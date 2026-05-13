import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAssistantOutput } from './outputQuality';

test('evaluateAssistantOutput rejects obvious generic assistant reassurance when tone guard is enabled', () => {
  const result = evaluateAssistantOutput(
    '如果你愿意，可以慢慢和我说。我会一直在这里陪你。',
    {
      toneGuardMode: 'character_chat',
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'generic_assistant_tone');
});

test('evaluateAssistantOutput keeps roleful direct replies even when they are warm', () => {
  const result = evaluateAssistantOutput(
    '别装了。过来，先让我看看你。',
    {
      toneGuardMode: 'character_chat',
    },
  );

  assert.equal(result.ok, true);
});

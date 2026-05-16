import assert from 'node:assert/strict';
import test from 'node:test';
import { STRUCTURED_ASSISTANT_REPLY_TOKEN } from './assistantReplyEnvelope';
import { evaluateAssistantOutput } from './outputQuality';

test('evaluateAssistantOutput rejects obvious generic assistant reassurance when tone guard is enabled', () => {
  const result = evaluateAssistantOutput(
    'If you want, you can talk to me slowly. I will always be here with you.',
    {
      toneGuardMode: 'character_chat',
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'generic_assistant_tone');
});

test('evaluateAssistantOutput keeps roleful direct replies even when they are warm', () => {
  const result = evaluateAssistantOutput(
    'Stop acting. Come here and let me look at you first.',
    {
      toneGuardMode: 'character_chat',
    },
  );

  assert.equal(result.ok, true);
});

test('evaluateAssistantOutput accepts structured assistant reply envelopes when protocols are allowed', () => {
  const result = evaluateAssistantOutput(
    `${STRUCTURED_ASSISTANT_REPLY_TOKEN} {"items":[{"kind":"text","text":"Bonjour.","translation":"你好。"}]}`,
    {
      allowStructuredProtocols: true,
      toneGuardMode: 'character_chat',
    },
  );

  assert.equal(result.ok, true);
});

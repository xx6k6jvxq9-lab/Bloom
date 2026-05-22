import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStructuredAssistantReplyPrompt } from './directReplyProtocolPrompt';

test('buildStructuredAssistantReplyPrompt omits inline translation fields when disabled', () => {
  const prompt = buildStructuredAssistantReplyPrompt({
    character: {
      replyLanguageMode: 'follow-user',
      nativeLanguage: 'English',
    } as any,
    structuredReplyToken: '[ASSISTANT_REPLY]',
    requireInlineTranslation: false,
  });

  assert.equal(prompt.includes('{"kind":"text","text":"当前聊天主语言 正文"}'), true);
  assert.equal(prompt.includes('"translation":"对应的简体中文"'), false);
  assert.equal(prompt.includes('当前这轮不要输出 translation 字段'), true);
});

test('buildStructuredAssistantReplyPrompt keeps bilingual schema when inline translation is enabled', () => {
  const prompt = buildStructuredAssistantReplyPrompt({
    character: {
      replyLanguageMode: 'native-first',
      nativeLanguage: '英语',
    } as any,
    structuredReplyToken: '[ASSISTANT_REPLY]',
    requireInlineTranslation: true,
  });

  assert.equal(prompt.includes('{"kind":"text","text":"英语 正文","translation":"对应的简体中文"}'), true);
  assert.equal(prompt.includes('只要本轮存在普通正文 text item，就必须给每个 text item 填 translation'), true);
});

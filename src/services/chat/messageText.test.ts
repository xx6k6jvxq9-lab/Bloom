import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveMessageTranslationForDisplay,
  stripLegacyTranslationBlock,
} from './messageText';

test('resolveMessageTranslationForDisplay hides translation when auto translate is disabled', () => {
  const translation = resolveMessageTranslationForDisplay({
    text: '点进去了。',
    translation: 'I have clicked into it.',
  }, {
    autoTranslate: false,
  });

  assert.equal(translation, '');
});

test('resolveMessageTranslationForDisplay keeps visible Chinese translation when enabled', () => {
  const translation = resolveMessageTranslationForDisplay({
    text: 'Come here first.',
    translation: '先过来。',
  }, {
    autoTranslate: true,
  });

  assert.equal(translation, '先过来。');
});

test('resolveMessageTranslationForDisplay drops non-Chinese translation text', () => {
  const translation = resolveMessageTranslationForDisplay({
    text: '点进去了。',
    translation: 'I have clicked into it.',
  }, {
    autoTranslate: true,
  });

  assert.equal(translation, '');
});

test('resolveMessageTranslationForDisplay falls back to legacy Chinese translation when field is invalid', () => {
  const translation = resolveMessageTranslationForDisplay({
    text: 'Bonjour.\n\n---TRANSLATION---\n你好。',
    translation: 'Hello.',
  }, {
    autoTranslate: true,
  });

  assert.equal(translation, '你好。');
});

test('stripLegacyTranslationBlock removes legacy translation payloads', () => {
  assert.equal(
    stripLegacyTranslationBlock('Bonjour.\n\n---TRANSLATION---\n你好。'),
    'Bonjour.',
  );
});

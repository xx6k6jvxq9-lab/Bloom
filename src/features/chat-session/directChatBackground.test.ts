import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIRECT_CHAT_BACKGROUND_DISABLED,
  resolveDirectChatBackground,
} from './directChatBackground';

test('resolveDirectChatBackground falls back to the global background only when no direct override exists', () => {
  const result = resolveDirectChatBackground({
    characterBackground: '',
    resolvedCharacterBackgroundUrl: null,
    globalBackground: 'https://example.com/global.jpg',
    resolvedGlobalBackgroundUrl: null,
  });

  assert.equal(result, 'https://example.com/global.jpg');
});

test('resolveDirectChatBackground does not fall back to the global background while a direct uploaded asset is unresolved', () => {
  const result = resolveDirectChatBackground({
    characterBackground: 'asset://uploaded/ua_test?name=wallpaper.png',
    resolvedCharacterBackgroundUrl: null,
    globalBackground: 'https://example.com/global.jpg',
    resolvedGlobalBackgroundUrl: 'https://example.com/global.jpg',
  });

  assert.equal(result, '');
});

test('resolveDirectChatBackground keeps single-chat background cleared even when a global background exists', () => {
  const result = resolveDirectChatBackground({
    characterBackground: DIRECT_CHAT_BACKGROUND_DISABLED,
    resolvedCharacterBackgroundUrl: null,
    globalBackground: 'https://example.com/global.jpg',
    resolvedGlobalBackgroundUrl: 'https://example.com/global.jpg',
  });

  assert.equal(result, '');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMusicTogetherBackground } from './resolveMusicTogetherBackground';

test('resolveMusicTogetherBackground falls back to the global chat background when no dedicated background is set', () => {
  const result = resolveMusicTogetherBackground({
    musicTogetherBackground: '',
    resolvedMusicTogetherBackgroundUrl: null,
    globalBackground: 'https://example.com/global.jpg',
    resolvedGlobalBackgroundUrl: null,
  });

  assert.equal(result, 'https://example.com/global.jpg');
});

test('resolveMusicTogetherBackground prefers the dedicated music-together background when present', () => {
  const result = resolveMusicTogetherBackground({
    musicTogetherBackground: 'https://example.com/music-together.jpg',
    resolvedMusicTogetherBackgroundUrl: null,
    globalBackground: 'https://example.com/global.jpg',
    resolvedGlobalBackgroundUrl: null,
  });

  assert.equal(result, 'https://example.com/music-together.jpg');
});

test('resolveMusicTogetherBackground does not fall back while an uploaded dedicated background is unresolved', () => {
  const result = resolveMusicTogetherBackground({
    musicTogetherBackground: 'asset://uploaded/ua_test?name=music-together.png',
    resolvedMusicTogetherBackgroundUrl: null,
    globalBackground: 'https://example.com/global.jpg',
    resolvedGlobalBackgroundUrl: 'https://example.com/global.jpg',
  });

  assert.equal(result, '');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNeteaseCoverProxyUrl, normalizeMusicCoverValue } from './neteaseCover';

test('buildNeteaseCoverProxyUrl rewrites allowed NetEase cover hosts to same-origin proxy URLs', () => {
  const value = 'http://p1.music.126.net/cover-hash/abc.jpg';
  const proxied = buildNeteaseCoverProxyUrl(value);

  assert.equal(
    proxied,
    '/api/netease/cover?src=https%3A%2F%2Fp1.music.126.net%2Fcover-hash%2Fabc.jpg%3Fparam%3D400y400',
  );
});

test('buildNeteaseCoverProxyUrl preserves existing param size if present', () => {
  const value = 'https://p1.music.126.net/cover-hash/abc.jpg?param=180y180';
  const proxied = buildNeteaseCoverProxyUrl(value);

  assert.equal(
    proxied,
    '/api/netease/cover?src=https%3A%2F%2Fp1.music.126.net%2Fcover-hash%2Fabc.jpg%3Fparam%3D180y180',
  );
});

test('buildNeteaseCoverProxyUrl rejects non-NetEase hosts', () => {
  const proxied = buildNeteaseCoverProxyUrl('https://example.com/cover.jpg');

  assert.equal(proxied, null);
});

test('normalizeMusicCoverValue leaves non-NetEase URLs unchanged apart from upgrading http', () => {
  const normalized = normalizeMusicCoverValue('http://example.com/cover.jpg');

  assert.equal(normalized, 'https://example.com/cover.jpg');
});

test('normalizeMusicCoverValue keeps already proxied cover URLs', () => {
  const normalized = normalizeMusicCoverValue('/api/netease/cover?src=abc');

  assert.equal(normalized, '/api/netease/cover?src=abc');
});

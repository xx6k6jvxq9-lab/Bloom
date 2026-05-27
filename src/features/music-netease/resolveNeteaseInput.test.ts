import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNeteaseMediaInput, resolveNeteasePlaylistInput } from './resolveNeteaseInput';

const originalFetch = globalThis.fetch;

test('resolveNeteaseMediaInput returns direct parse results without fetching share resolver', async () => {
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error('fetch should not be called for direct urls');
  }) as typeof fetch;

  try {
    const parsed = await resolveNeteaseMediaInput('https://music.163.com/#/song?id=112233445');

    assert.equal(parsed?.kind, 'song');
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolveNeteasePlaylistInput resolves 163cn short links through the share resolver endpoint', async () => {
  globalThis.fetch = (async () => new Response(
    JSON.stringify({
      url: 'https://y.music.163.com/m/playlist?id=135792468&userid=2468',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  )) as typeof fetch;

  try {
    const parsed = await resolveNeteasePlaylistInput('https://163cn.tv/example-share');

    assert.equal(parsed?.id, '135792468');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolveNeteaseMediaInput returns null when the share resolver reports invalid input', async () => {
  globalThis.fetch = (async () => new Response(
    JSON.stringify({
      error: 'Unable to resolve NetEase share input',
    }),
    {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  )) as typeof fetch;

  try {
    const parsed = await resolveNeteaseMediaInput('https://163cn.tv/not-a-song-or-playlist');

    assert.equal(parsed, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolveNeteaseMediaInput surfaces resolver server failures', async () => {
  globalThis.fetch = (async () => new Response(
    JSON.stringify({
      error: 'Failed to resolve NetEase share input',
    }),
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  )) as typeof fetch;

  try {
    await assert.rejects(
      () => resolveNeteaseMediaInput('https://163cn.tv/server-error'),
      /Failed to resolve NetEase share input/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

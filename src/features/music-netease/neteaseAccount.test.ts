import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseNeteaseAccountInput,
  parseNeteaseMediaInput,
  parseNeteasePlaylistInput,
  parseNeteaseSongInput,
} from './neteaseAccount';

test('parseNeteaseAccountInput accepts a pure UID', () => {
  const parsed = parseNeteaseAccountInput('123456789');

  assert.equal(parsed?.uid, '123456789');
  assert.equal(parsed?.profileUrl, 'https://music.163.com/#/user/home?id=123456789');
});

test('parseNeteaseAccountInput accepts a NetEase profile URL', () => {
  const parsed = parseNeteaseAccountInput('https://music.163.com/#/user/home?id=246813579');

  assert.equal(parsed?.uid, '246813579');
});

test('parseNeteaseAccountInput accepts a mobile NetEase profile URL', () => {
  const parsed = parseNeteaseAccountInput('https://y.music.163.com/m/user?id=246813579');

  assert.equal(parsed?.uid, '246813579');
});

test('parseNeteaseAccountInput extracts a profile URL from share text', () => {
  const parsed = parseNeteaseAccountInput('网易云主页分享 https://music.163.com/#/user/home?id=246813579。');

  assert.equal(parsed?.uid, '246813579');
});

test('parseNeteaseAccountInput rejects playlist URLs', () => {
  const parsed = parseNeteaseAccountInput('https://music.163.com/#/playlist?id=987654321');

  assert.equal(parsed, null);
});

test('parseNeteasePlaylistInput accepts a pure playlist ID', () => {
  const parsed = parseNeteasePlaylistInput('987654321');

  assert.equal(parsed?.id, '987654321');
  assert.equal(parsed?.playlistUrl, 'https://music.163.com/#/playlist?id=987654321');
});

test('parseNeteasePlaylistInput accepts a NetEase playlist URL', () => {
  const parsed = parseNeteasePlaylistInput('music.163.com/#/playlist?id=135792468');

  assert.equal(parsed?.id, '135792468');
});

test('parseNeteasePlaylistInput accepts a mobile NetEase playlist URL', () => {
  const parsed = parseNeteasePlaylistInput('https://y.music.163.com/m/playlist?id=135792468');

  assert.equal(parsed?.id, '135792468');
});

test('parseNeteasePlaylistInput extracts playlist URLs from share text', () => {
  const parsed = parseNeteasePlaylistInput('网易云音乐歌单《热歌榜》 https://music.163.com/#/playlist?id=135792468。');

  assert.equal(parsed?.id, '135792468');
});

test('parseNeteasePlaylistInput accepts path-style playlist URLs', () => {
  const parsed = parseNeteasePlaylistInput('https://music.163.com/playlist/135792468/');

  assert.equal(parsed?.id, '135792468');
});

test('parseNeteasePlaylistInput rejects profile URLs', () => {
  const parsed = parseNeteasePlaylistInput('https://music.163.com/#/user/home?id=123456789');

  assert.equal(parsed, null);
});

test('parseNeteaseSongInput accepts a NetEase song URL', () => {
  const parsed = parseNeteaseSongInput('https://music.163.com/#/song?id=112233445');

  assert.equal(parsed?.id, '112233445');
  assert.equal(parsed?.songUrl, 'https://music.163.com/#/song?id=112233445');
});

test('parseNeteaseSongInput accepts a mobile NetEase song URL', () => {
  const parsed = parseNeteaseSongInput('https://y.music.163.com/m/song?id=112233445');

  assert.equal(parsed?.id, '112233445');
});

test('parseNeteaseSongInput extracts song URLs from share text', () => {
  const parsed = parseNeteaseSongInput('分享歌曲《晴天》: https://music.163.com/#/song?id=112233445。');

  assert.equal(parsed?.id, '112233445');
});

test('parseNeteaseSongInput accepts path-style song URLs', () => {
  const parsed = parseNeteaseSongInput('https://music.163.com/song/112233445/');

  assert.equal(parsed?.id, '112233445');
});

test('parseNeteaseMediaInput prefers playlist parsing for plain numeric IDs', () => {
  const parsed = parseNeteaseMediaInput('987654321');

  assert.equal(parsed?.kind, 'playlist');
  if (parsed?.kind === 'playlist') {
    assert.equal(parsed.playlist.id, '987654321');
  }
});

test('parseNeteaseMediaInput detects song URLs', () => {
  const parsed = parseNeteaseMediaInput('https://music.163.com/#/song?id=112233445');

  assert.equal(parsed?.kind, 'song');
  if (parsed?.kind === 'song') {
    assert.equal(parsed.song.id, '112233445');
  }
});

test('parseNeteaseMediaInput detects playlist share text before song parsing', () => {
  const parsed = parseNeteaseMediaInput('歌单分享 https://music.163.com/playlist/135792468/');

  assert.equal(parsed?.kind, 'playlist');
  if (parsed?.kind === 'playlist') {
    assert.equal(parsed.playlist.id, '135792468');
  }
});

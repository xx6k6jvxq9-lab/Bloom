import type { MusicData } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

function isTransientLocalSong(url?: string, id?: string): boolean {
  return Boolean((url && url.startsWith('blob:')) || (id && id.startsWith('local-')));
}

function normalizeSongSource<TSong extends MusicData['queue'][number]>(song: TSong): TSong {
  if (!song) return song;
  if (song.id.startsWith('netease-')) {
    const neteaseId = song.id.replace('netease-', '');
    return {
      ...song,
      url: `/api/netease/song?id=${neteaseId}`,
    };
  }
  return song;
}

function sanitizeMusicData<T extends MusicData>(data: T, fallback: T): T {
  const sanitizeSongs = (songs: T['queue']) =>
    songs
      .filter((song) => !isTransientLocalSong(song.url, song.id))
      .map((song) => normalizeSongSource(song));

  const queue = sanitizeSongs(data.queue || []);
  const playlists = (data.playlists || []).map((playlist) => ({
    ...playlist,
    songs: sanitizeSongs(playlist.songs || []),
  }));

  const currentSong =
    data.currentSong && !isTransientLocalSong(data.currentSong.url, data.currentSong.id)
      ? normalizeSongSource(data.currentSong)
      : queue[0] || fallback.currentSong;

  return {
    ...data,
    currentSong,
    isPlaying: currentSong ? data.isPlaying : false,
    queue,
    playlists,
  };
}

export function loadPersistedMusicData<T extends MusicData>(fallback: T): T {
  const persisted = loadJson<T | null>(STORAGE_KEYS.musicData, null);
  return (persisted ? sanitizeMusicData({ ...fallback, ...persisted } as T, fallback) : fallback) as T;
}

export function persistMusicData(data: MusicData): void {
  saveJson(STORAGE_KEYS.musicData, sanitizeMusicData(data, data));
}

export function clearPersistedMusicData(): void {
  removeStoredJson(STORAGE_KEYS.musicData);
}

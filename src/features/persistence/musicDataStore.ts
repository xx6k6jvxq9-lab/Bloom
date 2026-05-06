import type { MusicData } from '../../types';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

function isTransientLocalSong(url?: string): boolean {
  return Boolean(url && url.startsWith('blob:'));
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

function sanitizeSong<TSong extends MusicData['queue'][number]>(song: TSong | null | undefined): TSong | null {
  if (!song || isTransientLocalSong(song.url)) {
    return null;
  }
  return normalizeSongSource(song);
}

function sanitizeSongList<TSong extends MusicData['queue'][number]>(songs: TSong[] | null | undefined): TSong[] {
  return (songs || [])
    .map((song) => sanitizeSong(song))
    .filter((song): song is TSong => Boolean(song));
}

function buildSongsById<T extends MusicData>(
  data: T,
  queue: T['queue'],
  playlists: T['playlists'],
  currentSong: T['currentSong'],
): T['songsById'] {
  const songsById = Object.values(data.songsById || {}).reduce<T['songsById']>((acc, song) => {
    const sanitizedSong = sanitizeSong(song);
    if (sanitizedSong) {
      acc[sanitizedSong.id] = sanitizedSong;
    }
    return acc;
  }, {} as T['songsById']);

  const registerSong = (song: MusicData['queue'][number] | null | undefined) => {
    const sanitizedSong = sanitizeSong(song);
    if (sanitizedSong) {
      songsById[sanitizedSong.id] = sanitizedSong;
    }
  };

  queue.forEach(registerSong);
  playlists.forEach((playlist) => playlist.songs.forEach(registerSong));
  registerSong(currentSong);

  return songsById;
}

function sanitizeMusicData<T extends MusicData>(data: T, fallback: T): T {
  const queue = sanitizeSongList(data.queue || []);
  const playlists = (data.playlists || []).map((playlist) => ({
    ...playlist,
    songs: sanitizeSongList(playlist.songs || []),
  }));

  const fallbackCurrentSong = sanitizeSong(fallback.currentSong) ?? null;
  const currentSong = sanitizeSong(data.currentSong) ?? queue[0] ?? fallbackCurrentSong;
  const songsById = buildSongsById(data, queue, playlists, currentSong);

  return {
    ...data,
    currentSong,
    isPlaying: currentSong ? data.isPlaying : false,
    queue,
    playlists,
    songsById,
  };
}

export function loadPersistedMusicData<T extends MusicData>(fallback: T): T {
  const persisted = loadJson<T | null>(STORAGE_KEYS.musicData, null);
  return (persisted ? sanitizeMusicData({ ...fallback, ...persisted } as T, fallback) : fallback) as T;
}

export async function loadPreferredMusicData<T extends MusicData>(fallback: T): Promise<T> {
  try {
    const persisted = await loadJsonRecord<T>(STORAGE_KEYS.musicData);
    if (persisted) {
      return sanitizeMusicData({ ...fallback, ...persisted } as T, fallback) as T;
    }
  } catch (error) {
    console.error('[musicDataStore] Failed to load music data from IndexedDB', error);
  }

  return loadPersistedMusicData(fallback);
}

export function persistMusicData(data: MusicData): Promise<void> {
  const sanitized = sanitizeMusicData(data, data);
  saveJson(STORAGE_KEYS.musicData, sanitized);

  return saveJsonRecord(STORAGE_KEYS.musicData, sanitized).catch((error) => {
    console.error('[musicDataStore] Failed to persist music data into IndexedDB', error);
  });
}

export function clearPersistedMusicData(): void {
  removeStoredJson(STORAGE_KEYS.musicData);
  void removeJsonRecord(STORAGE_KEYS.musicData).catch((error) => {
    console.error('[musicDataStore] Failed to remove music data from IndexedDB', error);
  });
}

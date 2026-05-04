import type { MusicData } from '../../types';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
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

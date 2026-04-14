import type { Song } from '../../types';
import type { MusicSearchResult, MusicSearchSource } from './musicSearchTypes';

type FreeToUseArtistTuple = [number, { id?: string; name?: string }];

type FreeToUseTrack = {
  id: string;
  title?: string;
  duration?: number;
  artists?: FreeToUseArtistTuple[];
  thumbnails?: Record<string, string | undefined>;
  files?: {
    mp3?: string;
  };
  is_premium?: boolean;
};

type FreeToUseSearchResponse = {
  ok?: boolean;
  data?: FreeToUseTrack[];
  error?: string;
};

function mapFreeToUseTrackToSong(track: FreeToUseTrack): Song {
  const normalizedId = String(track.id);
  const artistNames =
    track.artists
      ?.map(([, artist]) => artist?.name)
      .filter(Boolean)
      .join(', ') || '未知艺术家';

  return {
    id: `freetouse-${normalizedId}`,
    title: track.title || '未知歌曲',
    artist: artistNames,
    albumArt:
      track.thumbnails?.xl ||
      track.thumbnails?.lg ||
      track.thumbnails?.md ||
      track.thumbnails?.sm ||
      `https://picsum.photos/seed/freetouse-${normalizedId}/300/300`,
    url:
      track.files?.mp3 ||
      `https://data.freetouse.com/music/tracks/${normalizedId}/file/mp3/file.mp3`,
    duration: Math.floor(track.duration || 0),
  };
}

async function searchFreeToUseMusic(query: string, limit = 30): Promise<MusicSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const response = await fetch(
    `/api/freetouse/search?query=${encodeURIComponent(trimmedQuery)}&limit=${limit}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Free To Use 搜索服务暂时不可用，请确认服务已启动后再试。');
  }

  const data = (await response.json()) as FreeToUseSearchResponse;
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Free To Use 搜索失败：${response.status}`);
  }

  return (data.data || []).map((track) => ({
    song: mapFreeToUseTrackToSong(track),
    sourceId: 'freetouse',
    sourceLabel: 'Free To Use',
    category: 'free',
    playbackStatus: track.is_premium ? 'search-only' : 'supported',
    note: track.is_premium
      ? '这首是高级曲目，当前只展示结果，不直接播放。'
      : '免费可播音源，支持网页直接播放。',
  }));
}

export const freeToUseMusicSearchSource: MusicSearchSource = {
  id: 'freetouse',
  label: 'Free To Use',
  search: searchFreeToUseMusic,
};

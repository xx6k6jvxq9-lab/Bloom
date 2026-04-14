import type { MusicSearchResult, MusicSearchSource } from './musicSearchTypes';
import type { Song } from '../../types';

type NeteaseArtist = {
  name?: string;
};

type NeteaseSong = {
  id: number | string;
  name?: string;
  ar?: NeteaseArtist[];
  artists?: NeteaseArtist[];
  al?: {
    picUrl?: string;
  };
  album?: {
    picUrl?: string;
  };
  dt?: number;
  duration?: number;
};

type NeteaseSearchResponse = {
  result?: {
    songs?: NeteaseSong[];
  };
  error?: string;
};

function mapNeteaseSongToSong(track: NeteaseSong): Song {
  const normalizedId = String(track.id);

  return {
    id: `netease-${normalizedId}`,
    title: track.name || '未知歌曲',
    artist:
      (track.ar || track.artists)
        ?.map((artist) => artist.name)
        .filter(Boolean)
        .join(', ') || '未知歌手',
    albumArt:
      track.al?.picUrl ||
      track.album?.picUrl ||
      `https://picsum.photos/seed/netease-search-${normalizedId}/300/300`,
    url: `/api/netease/song?id=${normalizedId}`,
    duration: Math.floor((track.dt || track.duration || 0) / 1000),
  };
}

async function searchNeteaseMusic(query: string, limit = 10): Promise<MusicSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const response = await fetch(
    `/api/netease/search-playable?keywords=${encodeURIComponent(trimmedQuery)}&limit=${limit}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('网易云搜索服务暂时不可用，请稍后再试。');
  }

  const data = (await response.json()) as NeteaseSearchResponse;
  if (!response.ok) {
    throw new Error(data.error || `网易云搜索失败：${response.status}`);
  }

  return (data.result?.songs || []).map((track) => ({
    song: mapNeteaseSongToSong(track),
    sourceId: 'netease',
    sourceLabel: '网易云',
    playbackStatus: 'supported',
    note: '已过滤当前网页端不可直接播放的结果。',
  }));
}

export const neteaseMusicSearchSource: MusicSearchSource = {
  id: 'netease',
  label: '网易云',
  search: searchNeteaseMusic,
};

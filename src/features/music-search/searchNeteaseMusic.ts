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

export async function searchNeteaseMusic(query: string, limit = 12): Promise<Song[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const response = await fetch(`/api/netease/search?keywords=${encodeURIComponent(trimmedQuery)}&limit=${limit}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('搜索服务暂时没有接通，请确认当前用的是项目开发服务');
  }

  const data = (await response.json()) as NeteaseSearchResponse;
  if (!response.ok) {
    throw new Error(data.error || `搜索失败：${response.status}`);
  }

  return (data.result?.songs || []).map(mapNeteaseSongToSong);
}

import type { Song } from '../../types';
import type { MusicSearchEntitlement, MusicSearchResult, MusicSearchSource } from './musicSearchTypes';
import { normalizeMusicCoverValue } from '../music-netease/neteaseCover';

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
  fee?: number;
  privilege?: {
    fee?: number;
    payed?: number;
  };
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
      normalizeMusicCoverValue(track.al?.picUrl || track.album?.picUrl) ||
      `https://picsum.photos/seed/netease-search-${normalizedId}/300/300`,
    url: `/api/netease/song?id=${normalizedId}`,
    duration: Math.floor((track.dt || track.duration || 0) / 1000),
  };
}

function getNeteaseEntitlement(track: NeteaseSong): MusicSearchEntitlement {
  const fee = typeof track.fee === 'number' ? track.fee : track.privilege?.fee;
  const payed = track.privilege?.payed;

  if (fee === 1 || fee === 4 || fee === 16 || payed === 1) {
    return 'vip';
  }

  if (fee === 0 || fee === 8) {
    return 'free';
  }

  return 'unknown';
}

async function searchNeteaseMusic(query: string, limit = 12): Promise<MusicSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const response = await fetch(
    `/api/netease/search?keywords=${encodeURIComponent(trimmedQuery)}&limit=${limit}`,
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

  return (data.result?.songs || []).map((track) => {
    const entitlement = getNeteaseEntitlement(track);
    return {
      song: mapNeteaseSongToSong(track),
      sourceId: 'netease',
      sourceLabel: '网易云',
      category: 'song',
      entitlement,
      playbackStatus: 'unverified',
      note:
        entitlement === 'vip'
          ? '这首歌可能需要会员，播放时会再轻量校验。'
          : '先展示搜索结果，播放时再轻量校验当前网页端是否可播。',
    };
  });
}

export const neteaseMusicSearchSource: MusicSearchSource = {
  id: 'netease',
  label: '网易云',
  search: searchNeteaseMusic,
};

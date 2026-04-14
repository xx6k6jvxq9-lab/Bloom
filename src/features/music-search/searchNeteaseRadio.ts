import type { MusicSearchResult, MusicSearchSource } from './musicSearchTypes';
import type { Song } from '../../types';

type NeteaseRadioProgram = {
  id?: number | string;
  name?: string;
  coverUrl?: string;
  duration?: number;
  description?: string;
  mainSong?: {
    id?: number | string;
    duration?: number;
  };
};

type NeteaseDjRadio = {
  id?: number | string;
  name?: string;
  picUrl?: string;
  dj?: {
    nickname?: string;
  };
};

type NeteaseRadioSearchResponse = {
  result?: {
    programs?: Array<{
      radio?: NeteaseDjRadio;
      program?: NeteaseRadioProgram;
    }>;
  };
  error?: string;
};

function mapNeteaseRadioToSong(entry: { radio?: NeteaseDjRadio; program?: NeteaseRadioProgram }): Song | null {
  const radio = entry.radio;
  const program = entry.program;
  const mainSongId = program?.mainSong?.id;
  if (!mainSongId) return null;

  const normalizedId = String(mainSongId);
  const radioName = radio?.name?.trim() || '网易云播客';
  const hostName = radio?.dj?.nickname?.trim();
  const programName = program?.name?.trim() || `${radioName} 最新节目`;
  const artistLabel = hostName ? `${radioName} · ${hostName}` : radioName;

  return {
    id: `netease-${normalizedId}`,
    title: programName,
    artist: artistLabel,
    albumArt:
      program?.coverUrl ||
      radio?.picUrl ||
      `https://picsum.photos/seed/netease-radio-${radio?.id || normalizedId}/300/300`,
    url: `/api/netease/song?id=${normalizedId}`,
    duration: Math.floor(((program?.mainSong?.duration || program?.duration) || 0) / 1000),
  };
}

async function searchNeteaseRadio(query: string, limit = 8): Promise<MusicSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const response = await fetch(
    `/api/netease/search-radio?keywords=${encodeURIComponent(trimmedQuery)}&limit=${limit}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('网易云播客搜索服务暂时不可用，请稍后再试。');
  }

  const data = (await response.json()) as NeteaseRadioSearchResponse;
  if (!response.ok) {
    throw new Error(data.error || `网易云播客搜索失败：${response.status}`);
  }

  const results: MusicSearchResult[] = [];

  (data.result?.programs || []).forEach((entry) => {
    const song = mapNeteaseRadioToSong(entry);
    if (!song) return;

    results.push({
      song,
      sourceId: 'netease-radio',
      sourceLabel: '网易云播客',
      category: 'podcast',
      playbackStatus: 'supported',
      note: '已匹配当前可直接播放的播客或电台节目。',
    });
  });

  return results;
}

export const neteaseRadioSearchSource: MusicSearchSource = {
  id: 'netease-radio',
  label: '网易云播客',
  search: searchNeteaseRadio,
};

import type { Playlist, Song } from '../../types';

type NeteaseUserPlaylistItem = {
  id: number | string;
  name?: string;
  coverImgUrl?: string;
};

type NeteaseUserPlaylistResponse = {
  playlist?: NeteaseUserPlaylistItem[];
  error?: string;
};

type NeteaseTrack = {
  id: number | string;
  name?: string;
  ar?: Array<{ name?: string }>;
  artists?: Array<{ name?: string }>;
  al?: { picUrl?: string };
  album?: { picUrl?: string };
  dt?: number;
  duration?: number;
};

type NeteasePlaylistDetail = {
  id: number | string;
  name?: string;
  coverImgUrl?: string;
  tracks?: NeteaseTrack[];
};

type NeteasePlaylistDetailResponse = {
  playlist?: NeteasePlaylistDetail;
  result?: NeteasePlaylistDetail;
  error?: string;
};

function mapTrackToSong(track: NeteaseTrack): Song {
  const normalizedId = String(track.id);

  return {
    id: `netease-${normalizedId}`,
    title: track.name || '未知歌曲',
    artist:
      (track.ar || track.artists)
        ?.map((artist) => artist.name)
        .filter(Boolean)
        .join(', ') || '未知艺人',
    albumArt:
      track.al?.picUrl ||
      track.album?.picUrl ||
      `https://picsum.photos/seed/netease-${normalizedId}/300/300`,
    url: `/api/netease/song?id=${normalizedId}`,
    duration: Math.floor((track.dt || track.duration || 0) / 1000),
  };
}

function mapPlaylistToAppPlaylist(playlist: NeteasePlaylistDetail): Playlist {
  return {
    id: `netease-pl-${playlist.id}`,
    name: playlist.name || '网易云歌单',
    cover:
      playlist.coverImgUrl ||
      `https://picsum.photos/seed/netease-playlist-${playlist.id}/300/300`,
    songs: (playlist.tracks || []).map(mapTrackToSong),
    type: 'user',
  };
}

async function readJsonResponse<T>(response: Response, offlineMessage: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(offlineMessage);
  }

  return (await response.json()) as T;
}

async function fetchPlayablePlaylist(rawPlaylist: NeteaseUserPlaylistItem): Promise<Playlist | null> {
  const detailResponse = await fetch(`/api/netease/playlist-playable?id=${rawPlaylist.id}`);
  const detailData = await readJsonResponse<NeteasePlaylistDetailResponse>(
    detailResponse,
    '歌单详情接口暂时不可用，请稍后再试。',
  );

  if (!detailResponse.ok) {
    return null;
  }

  const detailPlaylist = detailData.playlist || detailData.result;
  if (!detailPlaylist) {
    return null;
  }

  return mapPlaylistToAppPlaylist(detailPlaylist);
}

export async function syncNeteasePlaylistsByUid(uid: string, limit = 12): Promise<Playlist[]> {
  const response = await fetch(`/api/netease/user-playlists?uid=${encodeURIComponent(uid)}&limit=${limit}`);
  const data = await readJsonResponse<NeteaseUserPlaylistResponse>(
    response,
    '歌单同步接口暂时不可用，请稍后再试。',
  );

  if (!response.ok) {
    throw new Error(data.error || '获取网易云歌单列表失败');
  }

  const rawPlaylists = data.playlist || [];
  const settled = await Promise.allSettled(rawPlaylists.map(fetchPlayablePlaylist));

  return settled
    .filter((result): result is PromiseFulfilledResult<Playlist | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((playlist): playlist is Playlist => Boolean(playlist));
}

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

type NeteasePlaylistDetailResponse = {
  playlist?: {
    id: number | string;
    name?: string;
    coverImgUrl?: string;
    tracks?: NeteaseTrack[];
  };
  result?: {
    id: number | string;
    name?: string;
    coverImgUrl?: string;
    tracks?: NeteaseTrack[];
  };
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

function mapPlaylistToAppPlaylist(playlist: NonNullable<NeteasePlaylistDetailResponse['playlist']>): Playlist {
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

export async function syncNeteasePlaylistsByUid(uid: string, limit = 12): Promise<Playlist[]> {
  const response = await fetch(`/api/netease/user-playlists?uid=${encodeURIComponent(uid)}&limit=${limit}`);
  const data = (await response.json()) as NeteaseUserPlaylistResponse;

  if (!response.ok) {
    throw new Error(data.error || '获取网易云歌单列表失败');
  }

  const rawPlaylists = data.playlist || [];
  const imported: Playlist[] = [];

  for (const rawPlaylist of rawPlaylists) {
    const detailResponse = await fetch(`/api/netease/playlist?id=${rawPlaylist.id}`);
    const detailData = (await detailResponse.json()) as NeteasePlaylistDetailResponse;
    if (!detailResponse.ok) {
      continue;
    }

    const detailPlaylist = detailData.playlist || detailData.result;
    if (!detailPlaylist) {
      continue;
    }

    imported.push(mapPlaylistToAppPlaylist(detailPlaylist));
  }

  return imported;
}

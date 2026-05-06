import type { Playlist, Song } from '../../types';

type NeteaseUserPlaylistItem = {
  id: number | string;
  name?: string;
  coverImgUrl?: string;
};

type NeteaseUserPlaylistResponse = {
  playlist?: NeteaseUserPlaylistItem[];
  more?: boolean;
  count?: number;
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
  trackCount?: number;
  trackIds?: Array<{ id: number | string }>;
};

type NeteasePlaylistDetailResponse = {
  playlist?: NeteasePlaylistDetail;
  result?: NeteasePlaylistDetail;
  error?: string;
};

type SyncedPlaylistData = {
  playlist: Playlist;
  expectedSongCount: number;
  importedSongCount: number;
  rawPlaylistId: string;
  rawPlaylistName: string;
};

export type SyncedNeteasePlaylistsResult = {
  playlists: Playlist[];
  stats: {
    requestedPlaylistCount: number;
    importedPlaylistCount: number;
    expectedSongCount: number;
    importedSongCount: number;
    missingSongCount: number;
    truncatedPlaylists: Array<{
      id: string;
      name: string;
      expectedSongCount: number;
      importedSongCount: number;
    }>;
  };
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

function getExpectedSongCount(detailPlaylist: NeteasePlaylistDetail): number {
  if (typeof detailPlaylist.trackCount === 'number' && detailPlaylist.trackCount > 0) {
    return detailPlaylist.trackCount;
  }
  if (Array.isArray(detailPlaylist.trackIds) && detailPlaylist.trackIds.length > 0) {
    return detailPlaylist.trackIds.length;
  }
  return (detailPlaylist.tracks || []).length;
}

async function fetchPlaylistData(rawPlaylist: NeteaseUserPlaylistItem): Promise<SyncedPlaylistData | null> {
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

  return {
    playlist: mapPlaylistToAppPlaylist(detailPlaylist),
    expectedSongCount: getExpectedSongCount(detailPlaylist),
    importedSongCount: (detailPlaylist.tracks || []).length,
    rawPlaylistId: String(detailPlaylist.id ?? rawPlaylist.id),
    rawPlaylistName: detailPlaylist.name || rawPlaylist.name || `网易云歌单 ${rawPlaylist.id}`,
  };
}

async function fetchAllUserPlaylists(uid: string, pageSize: number): Promise<NeteaseUserPlaylistItem[]> {
  const allPlaylists: NeteaseUserPlaylistItem[] = [];
  let offset = 0;
  let page = 0;

  while (page < 20) {
    const response = await fetch(
      `/api/netease/user-playlists?uid=${encodeURIComponent(uid)}&limit=${pageSize}&offset=${offset}`,
    );
    const data = await readJsonResponse<NeteaseUserPlaylistResponse>(
      response,
      '歌单同步接口暂时不可用，请稍后再试。',
    );

    if (!response.ok) {
      throw new Error(data.error || '获取网易云歌单列表失败');
    }

    const pagePlaylists = data.playlist || [];
    allPlaylists.push(...pagePlaylists);

    const hasMore =
      data.more === true
      || (typeof data.count === 'number' && allPlaylists.length < data.count);

    if (!hasMore || pagePlaylists.length === 0) {
      break;
    }

    offset += pagePlaylists.length;
    page += 1;
  }

  return Array.from(
    new Map(allPlaylists.map((playlist) => [String(playlist.id), playlist])).values(),
  );
}

export async function syncNeteasePlaylistsByUid(uid: string, pageSize = 50): Promise<SyncedNeteasePlaylistsResult> {
  const rawPlaylists = await fetchAllUserPlaylists(uid, Math.max(1, Math.min(pageSize, 100)));
  const settled = await Promise.allSettled(rawPlaylists.map(fetchPlaylistData));

  const importedPlaylists = settled
    .filter((result): result is PromiseFulfilledResult<SyncedPlaylistData | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((playlist): playlist is SyncedPlaylistData => Boolean(playlist));

  const truncatedPlaylists = importedPlaylists
    .filter((playlist) => playlist.importedSongCount < playlist.expectedSongCount)
    .map((playlist) => ({
      id: playlist.rawPlaylistId,
      name: playlist.rawPlaylistName,
      expectedSongCount: playlist.expectedSongCount,
      importedSongCount: playlist.importedSongCount,
    }));

  const expectedSongCount = importedPlaylists.reduce((total, playlist) => total + playlist.expectedSongCount, 0);
  const importedSongCount = importedPlaylists.reduce((total, playlist) => total + playlist.importedSongCount, 0);

  return {
    playlists: importedPlaylists.map((playlist) => playlist.playlist),
    stats: {
      requestedPlaylistCount: rawPlaylists.length,
      importedPlaylistCount: importedPlaylists.length,
      expectedSongCount,
      importedSongCount,
      missingSongCount: Math.max(0, expectedSongCount - importedSongCount),
      truncatedPlaylists,
    },
  };
}

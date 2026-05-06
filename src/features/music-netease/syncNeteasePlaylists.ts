import type { Playlist, Song } from '../../types';

type NeteaseUserPlaylistItem = {
  id: number | string;
  name?: string;
  coverImgUrl?: string;
};

type NeteaseUserPlaylistResponse = {
  playlist?: NeteaseUserPlaylistItem[];
  more?: boolean;
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
    title: track.name || 'Unknown Song',
    artist:
      (track.ar || track.artists)
        ?.map((artist) => artist.name)
        .filter(Boolean)
        .join(', ') || 'Unknown Artist',
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
    name: playlist.name || 'NetEase Playlist',
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
    'NetEase playlist details are temporarily unavailable.',
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

async function fetchUserPlaylistPage(
  uid: string,
  limit: number,
  offset: number,
): Promise<NeteaseUserPlaylistResponse> {
  const response = await fetch(
    `/api/netease/user-playlists?uid=${encodeURIComponent(uid)}&limit=${limit}&offset=${offset}`,
  );
  const data = await readJsonResponse<NeteaseUserPlaylistResponse>(
    response,
    'NetEase playlist sync is temporarily unavailable.',
  );

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch NetEase playlists.');
  }

  return data;
}

export async function syncNeteasePlaylistsByUid(uid: string, pageSize = 30): Promise<Playlist[]> {
  const rawPlaylists: NeteaseUserPlaylistItem[] = [];
  let offset = 0;

  for (let page = 0; page < 10; page += 1) {
    const data = await fetchUserPlaylistPage(uid, pageSize, offset);
    const pagePlaylists = data.playlist || [];
    if (pagePlaylists.length === 0) {
      break;
    }

    rawPlaylists.push(...pagePlaylists);
    offset += pagePlaylists.length;

    if (data.more === false || pagePlaylists.length < pageSize) {
      break;
    }
  }

  const uniquePlaylists = Array.from(
    new Map(rawPlaylists.map((playlist) => [String(playlist.id), playlist])).values(),
  );
  const settled = await Promise.allSettled(uniquePlaylists.map(fetchPlayablePlaylist));

  return settled
    .filter((result): result is PromiseFulfilledResult<Playlist | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((playlist): playlist is Playlist => Boolean(playlist));
}

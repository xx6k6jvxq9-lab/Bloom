const NETEASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  Referer: "https://music.163.com/",
};

const FREETOUSE_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  Referer: "https://freetouse.com/",
  Origin: "https://freetouse.com",
};

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

export function serverError(message, error) {
  console.error(message, error);
  return json({ error: message }, { status: 500 });
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Upstream request failed: ${response.status}`);
  }
  return response.json();
}

async function searchNeteaseByType(keywords, limit, type) {
  return fetchJson("https://music.163.com/api/search/get/web?csrf_token=", {
    method: "POST",
    headers: {
      ...NETEASE_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      s: keywords,
      type: String(type),
      offset: "0",
      limit: String(limit),
    }),
  });
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const normalizedConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: normalizedConcurrency }, () => worker()),
  );

  return results;
}

export async function resolveNeteasePlayableUrl(id) {
  const fallbackUrl = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;

  try {
    const headResponse = await fetch(fallbackUrl, {
      method: "HEAD",
      redirect: "manual",
      headers: NETEASE_HEADERS,
    });

    if (headResponse.status === 301 || headResponse.status === 302) {
      const location = headResponse.headers.get("location");
      if (location) {
        if (location.includes("/404")) {
          return null;
        }
        return location.replace(/^http:/, "https:");
      }
    }

    if (headResponse.status === 404) {
      return null;
    }

    // Some deployments/upstreams reject HEAD or return non-ideal statuses
    // while the actual audio GET still works, so keep the outer URL as fallback.
    return fallbackUrl;
  } catch (error) {
    console.warn("Failed to pre-resolve NetEase playable URL, fallback to outer URL", error);
    return fallbackUrl;
  }
}

export async function proxyNeteaseSong(request, id) {
  const fallbackUrl = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
  const resolvedUrl = await resolveNeteasePlayableUrl(id);
  if (!resolvedUrl) {
    return json(
      { error: "Song not found or is VIP/copyright restricted" },
      { status: 404 },
    );
  }

  const headers = new Headers(NETEASE_HEADERS);
  const range = request.headers.get("range");
  if (range) {
    headers.set("Range", range);
  }

  let response = await fetch(resolvedUrl, {
    headers,
    redirect: "follow",
  });

  if (!response.ok && resolvedUrl !== fallbackUrl) {
    response = await fetch(fallbackUrl, {
      headers,
      redirect: "follow",
    });
  }

  if (!response.ok) {
    return json(
      { error: "Song not found or is temporarily unavailable" },
      { status: response.status >= 400 ? response.status : 502 },
    );
  }

  const passHeaders = new Headers();
  const headerNames = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
  ];

  for (const headerName of headerNames) {
    const value = response.headers.get(headerName);
    if (value) {
      passHeaders.set(headerName, value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    headers: passHeaders,
  });
}

export async function fetchNeteaseSongDetail(id) {
  return fetchJson(`https://music.163.com/api/song/detail?ids=[${id}]`, {
    headers: NETEASE_HEADERS,
  });
}

export async function fetchNeteaseLyric(id) {
  return fetchJson(
    `https://music.163.com/api/song/lyric?id=${id}&lv=1&kv=1&tv=-1`,
    {
      headers: NETEASE_HEADERS,
    },
  );
}

export async function searchPlayableNeteaseSongs(keywords, limit) {
  const data = await searchNeteaseSongs(keywords, limit);
  const songs = data?.result?.songs || [];
  const playableChecks = await Promise.all(
    songs.map(async (song) => ({
      song,
      playableUrl: await resolveNeteasePlayableUrl(song.id),
    })),
  );

  return {
    result: {
      songs: playableChecks.filter((item) => item.playableUrl).map((item) => item.song),
    },
  };
}

export async function searchNeteaseSongs(keywords, limit) {
  return searchNeteaseByType(keywords, limit, 1);
}

export async function fetchNeteaseDjProgramsByRadio(radioId, limit = 5) {
  return fetchJson(
    `https://music.163.com/api/dj/program/byradio?radioId=${radioId}&offset=0&limit=${limit}&asc=false`,
    {
      headers: NETEASE_HEADERS,
    },
  );
}

export async function searchNeteaseRadioPrograms(keywords, limit) {
  const data = await searchNeteaseByType(keywords, limit, 1009);
  const radios = data?.result?.djRadios || [];

  const enrichedRadios = await mapWithConcurrency(radios, 4, async (radio) => {
    try {
      const programData = await fetchNeteaseDjProgramsByRadio(radio.id, 5);
      const programs = programData?.programs || [];

      for (const program of programs) {
        const mainSongId = program?.mainSong?.id;
        if (!mainSongId) continue;

        const playableUrl = await resolveNeteasePlayableUrl(mainSongId);
        if (!playableUrl) continue;

        return {
          radio,
          program: {
            id: program.id,
            name: program.name,
            coverUrl: program.coverUrl,
            duration: program.duration,
            mainSong: program.mainSong,
          },
        };
      }

      return null;
    } catch (error) {
      console.warn("Failed to resolve NetEase radio program", radio?.id, error);
      return null;
    }
  });

  return {
    result: {
      programs: enrichedRadios.filter(Boolean),
    },
  };
}

export async function fetchNeteasePlaylist(id) {
  const data = await fetchJson(`https://music.163.com/api/playlist/detail?id=${id}`, {
    headers: NETEASE_HEADERS,
  });
  const playlist = data.playlist || data.result;

  if (!playlist) {
    return data;
  }

  if (playlist.trackIds && playlist.trackIds.length > 0) {
    const trackIds = playlist.trackIds.map((track) => track.id);
    const allTracks = [];

    for (let index = 0; index < trackIds.length; index += 500) {
      const batchIds = trackIds.slice(index, index + 500);
      const detailData = await fetchJson(
        `https://music.163.com/api/song/detail?ids=[${batchIds.join(",")}]`,
        {
          headers: NETEASE_HEADERS,
        },
      );

      if (detailData?.songs?.length) {
        allTracks.push(...detailData.songs);
      }
    }

    if (allTracks.length > 0) {
      playlist.tracks = allTracks;
    }
  }

  return data;
}

export async function fetchPlayableNeteasePlaylist(id) {
  const data = await fetchNeteasePlaylist(id);
  const playlist = data.playlist || data.result;

  if (!playlist) {
    return data;
  }

  const tracks = playlist.tracks || [];
  const playableChecks = await mapWithConcurrency(tracks, 8, async (track) => ({
    track,
    playableUrl: await resolveNeteasePlayableUrl(track.id),
  }));
  const playableTracks = playableChecks
    .filter((item) => item.playableUrl)
    .map((item) => item.track);

  const nextPlaylist = {
    ...playlist,
    tracks: playableTracks,
  };

  return {
    ...data,
    playlist: data.playlist ? nextPlaylist : undefined,
    result: data.result ? nextPlaylist : undefined,
  };
}

export async function fetchNeteaseUserPlaylists(uid, limit) {
  return fetchJson(
    `https://music.163.com/api/user/playlist/?offset=0&limit=${limit}&uid=${uid}`,
    {
      headers: NETEASE_HEADERS,
    },
  );
}

export async function searchFreeToUseMusic(query, limit) {
  const upstreamUrl = new URL("https://api.freetouse.com/v3/music/tracks/search");
  upstreamUrl.searchParams.set("query", query);
  upstreamUrl.searchParams.set("limit", String(limit));
  return fetchJson(upstreamUrl, {
    headers: FREETOUSE_HEADERS,
  });
}

export { json };

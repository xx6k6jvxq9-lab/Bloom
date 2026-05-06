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
  const searchUrl = new URL("https://music.163.com/api/search/get");
  searchUrl.searchParams.set("s", keywords);
  searchUrl.searchParams.set("type", String(type));
  searchUrl.searchParams.set("offset", "0");
  searchUrl.searchParams.set("limit", String(limit));
  searchUrl.searchParams.set("total", "true");

  return fetchJson(searchUrl, {
    headers: NETEASE_HEADERS,
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

    return fallbackUrl;
  } catch (error) {
    console.warn("Failed to pre-resolve NetEase playable URL, fallback to outer URL", error);
    return fallbackUrl;
  }
}

function isAudioLikeResponse(response) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  return (
    contentType.startsWith("audio/") ||
    contentType.includes("application/octet-stream") ||
    contentType.includes("binary/octet-stream")
  );
}

function getNeteaseSongEntitlement(song) {
  const fee = typeof song?.fee === "number" ? song.fee : song?.privilege?.fee;
  const payed = song?.privilege?.payed;

  if (fee === 1 || fee === 4 || fee === 16 || payed === 1) {
    return "vip";
  }

  if (fee === 0 || fee === 8) {
    return "free";
  }

  return "unknown";
}

function pickPreviewDurationMs(song) {
  const directCandidates = [
    song?.previewDurationMs,
    song?.previewDuration,
    song?.freeTrialInfo?.duration,
    song?.freeTrialPrivilege?.duration,
    song?.privilege?.freeTrialInfo?.duration,
    song?.privilege?.freeTrialPrivilege?.duration,
  ];

  for (const candidate of directCandidates) {
    if (Number.isFinite(candidate) && Number(candidate) > 0) {
      return Number(candidate);
    }
  }

  const rangedCandidates = [
    song?.freeTrialInfo,
    song?.freeTrialPrivilege,
    song?.privilege?.freeTrialInfo,
    song?.privilege?.freeTrialPrivilege,
  ];

  for (const candidate of rangedCandidates) {
    const start = Number(candidate?.start);
    const end = Number(candidate?.end);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return end - start;
    }
  }

  return null;
}

export async function resolveNeteaseSongAccess(id) {
  const [resolvedUrl, detail] = await Promise.all([
    resolveNeteasePlayableUrl(id),
    fetchNeteaseSongDetail(id).catch((error) => {
      console.warn("Failed to fetch NetEase song detail for access resolution", error);
      return null;
    }),
  ]);

  const track = detail?.songs?.[0] || null;
  const entitlement = getNeteaseSongEntitlement(track);
  const previewDurationMs = pickPreviewDurationMs(track);
  const proxyUrl = `/api/netease/song?id=${id}`;

  if (!resolvedUrl) {
    return {
      id: String(id),
      status: "unavailable",
      entitlement,
      previewDurationMs,
      proxyUrl,
      note:
        entitlement === "vip"
          ? "当前链路没有拿到可播放的官方试听音频。"
          : "当前没有拿到可播放音频。",
    };
  }

  if (entitlement === "vip") {
    return {
      id: String(id),
      status: "preview",
      entitlement,
      previewDurationMs,
      playUrl: resolvedUrl,
      proxyUrl,
      note:
        previewDurationMs && previewDurationMs > 0
          ? `当前按官方可返回的试听片段播放，约 ${Math.ceil(previewDurationMs / 1000)} 秒。`
          : "当前按官方可返回的试听片段播放，实际时长以上游返回为准。",
    };
  }

  return {
    id: String(id),
    status: "full",
    entitlement,
    previewDurationMs,
    playUrl: resolvedUrl,
    proxyUrl,
    note: "当前可以直接播放。",
  };
}

export async function proxyNeteaseSong(request, id) {
  const fallbackUrl = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
  const access = await resolveNeteaseSongAccess(id);
  if (!access.playUrl) {
    return json(
      { error: access.note || "Song not found or is VIP/copyright restricted" },
      { status: 404 },
    );
  }

  const headers = new Headers(NETEASE_HEADERS);
  const range = request.headers.get("range");
  if (range) {
    headers.set("Range", range);
  }

  let response = await fetch(access.playUrl, {
    headers,
    redirect: "follow",
  });

  if ((!response.ok || !isAudioLikeResponse(response)) && access.playUrl !== fallbackUrl) {
    response = await fetch(fallbackUrl, {
      headers,
      redirect: "follow",
    });
  }

  if (!response.ok || !isAudioLikeResponse(response)) {
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

  passHeaders.set("x-bloom-playback-status", access.status);
  if (access.previewDurationMs) {
    passHeaders.set("x-bloom-preview-duration-ms", String(access.previewDurationMs));
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

export async function fetchNeteaseUserPlaylists(uid, limit, offset = 0) {
  return fetchJson(
    `https://music.163.com/api/user/playlist/?offset=${offset}&limit=${limit}&uid=${uid}`,
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

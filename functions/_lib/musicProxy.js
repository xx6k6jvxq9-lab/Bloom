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

const NETEASE_COVER_HOST_PATTERN = /(^|\.)music\.126\.net$|(^|\.)nosdn\.127\.net$/i;
const NETEASE_SHARE_HOST_PATTERN = /(^|\.)music\.163\.com$|(^|\.)y\.music\.163\.com$|(^|\.)163cn\.tv$/i;
const NETEASE_SHARE_SHORT_HOST_PATTERN = /(^|\.)163cn\.tv$/i;
const EMBEDDED_NETEASE_SHARE_URL_PATTERN = /((?:https?:\/\/)?(?:(?:music|y\.music)\.163\.com|163cn\.tv)\/[^\s"'<>]+)/i;
const TRAILING_NETEASE_SHARE_PUNCTUATION_PATTERN = /[),.;!?'"，。！？；：》】）]+$/;
const DEFAULT_NETEASE_COVER_PARAM = "400y400";

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

function stripTrailingNeteaseSharePunctuation(value) {
  return String(value || "").replace(TRAILING_NETEASE_SHARE_PUNCTUATION_PATTERN, "");
}

function extractNeteaseShareCandidate(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) {
    return "";
  }

  if (/^[a-z]+:\/\//i.test(trimmed) || /^(?:(?:music|y\.music)\.163\.com|163cn\.tv)\//i.test(trimmed)) {
    return stripTrailingNeteaseSharePunctuation(trimmed);
  }

  const embeddedMatch = trimmed.match(EMBEDDED_NETEASE_SHARE_URL_PATTERN);
  if (embeddedMatch?.[1]) {
    return stripTrailingNeteaseSharePunctuation(embeddedMatch[1]);
  }

  return "";
}

function normalizeNeteaseShareCandidate(candidate) {
  const trimmed = String(candidate || "").trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  if (!/^https?:$/i.test(url.protocol) || !NETEASE_SHARE_HOST_PATTERN.test(url.hostname)) {
    return null;
  }

  url.protocol = "https:";
  return url.toString();
}

async function readManualRedirectLocation(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const response = await fetch(url, {
        method,
        redirect: "manual",
        headers: NETEASE_HEADERS,
      });
      const location = response.headers.get("location");
      if (
        location
        && [301, 302, 303, 307, 308].includes(response.status)
      ) {
        return new URL(location, url).toString();
      }

      if (method === "HEAD" && response.status === 405) {
        continue;
      }

      return null;
    } catch (error) {
      if (method === "GET") {
        throw error;
      }
    }
  }

  return null;
}

function normalizeNeteaseCoverSource(src) {
  const trimmed = String(src || "").trim();
  if (!trimmed) {
    return null;
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!/^https?:$/i.test(url.protocol) || !NETEASE_COVER_HOST_PATTERN.test(url.hostname)) {
    return null;
  }

  url.protocol = "https:";
  if (!url.searchParams.has("param")) {
    url.searchParams.set("param", DEFAULT_NETEASE_COVER_PARAM);
  }

  return url.toString();
}

function isImageLikeResponse(response) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  return contentType.startsWith("image/");
}

function buildResponseHeaders(response, headerNames, fallbackCacheControl) {
  const passHeaders = new Headers();

  for (const headerName of headerNames) {
    const value = response.headers.get(headerName);
    if (value) {
      passHeaders.set(headerName, value);
    }
  }

  if (fallbackCacheControl && !passHeaders.has("cache-control")) {
    passHeaders.set("cache-control", fallbackCacheControl);
  }

  return passHeaders;
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

export async function resolveNeteaseShareInputToUrl(input, maxHops = 4) {
  const normalizedCandidate = normalizeNeteaseShareCandidate(extractNeteaseShareCandidate(input));
  if (!normalizedCandidate) {
    return null;
  }

  let currentUrl = normalizedCandidate;
  for (let hop = 0; hop < maxHops; hop += 1) {
    let url;
    try {
      url = new URL(currentUrl);
    } catch {
      return null;
    }

    if (!/^https?:$/i.test(url.protocol) || !NETEASE_SHARE_HOST_PATTERN.test(url.hostname)) {
      return null;
    }

    url.protocol = "https:";
    currentUrl = url.toString();

    if (!NETEASE_SHARE_SHORT_HOST_PATTERN.test(url.hostname)) {
      return currentUrl;
    }

    const nextLocation = await readManualRedirectLocation(currentUrl);
    if (!nextLocation) {
      return currentUrl;
    }

    currentUrl = nextLocation;
  }

  return currentUrl;
}

function isAudioLikeResponse(response) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  return (
    contentType.startsWith("audio/") ||
    contentType.includes("application/octet-stream") ||
    contentType.includes("binary/octet-stream")
  );
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

  if ((!response.ok || !isAudioLikeResponse(response)) && resolvedUrl !== fallbackUrl) {
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

  const passHeaders = buildResponseHeaders(response, [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
  ]);

  return new Response(response.body, {
    status: response.status,
    headers: passHeaders,
  });
}

export async function proxyNeteaseCover(request, src) {
  const normalizedSource = normalizeNeteaseCoverSource(src);
  if (!normalizedSource) {
    return badRequest("Invalid NetEase cover source");
  }

  const headers = new Headers(NETEASE_HEADERS);
  headers.set("Accept", "image/*,*/*;q=0.8");

  const response = await fetch(normalizedSource, {
    headers,
    redirect: "follow",
  });

  if (!response.ok || !isImageLikeResponse(response)) {
    return json(
      { error: "Failed to fetch NetEase cover" },
      { status: response.status >= 400 ? response.status : 502 },
    );
  }

  const passHeaders = buildResponseHeaders(response, [
    "content-type",
    "content-length",
    "cache-control",
    "etag",
    "last-modified",
  ], "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");

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

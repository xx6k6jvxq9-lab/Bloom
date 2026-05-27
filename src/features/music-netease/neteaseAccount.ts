export type NeteaseAccountBinding = {
  uid: string;
  profileUrl: string;
  linkedAt: number;
};

export type NeteasePlaylistBinding = {
  id: string;
  playlistUrl: string;
  linkedAt: number;
};

export type NeteaseSongBinding = {
  id: string;
  songUrl: string;
  linkedAt: number;
};

export type NeteaseMediaBinding =
  | {
      kind: 'song';
      song: NeteaseSongBinding;
    }
  | {
      kind: 'playlist';
      playlist: NeteasePlaylistBinding;
    };

const NETEASE_HOST_PATTERN = /(^|\.)music\.163\.com$|(^|\.)y\.music\.163\.com$/i;
const EMBEDDED_NETEASE_URL_PATTERN = /((?:https?:\/\/)?(?:music\.163\.com|y\.music\.163\.com)\/[^\s"'<>]+)/i;
const TRAILING_URL_PUNCTUATION_PATTERN = /[),.;!?'"，。！？；：》】）]+$/;

function isNumericNeteaseId(value: string): boolean {
  return /^\d{5,}$/.test(value.trim());
}

function stripTrailingUrlPunctuation(value: string): string {
  return value.replace(TRAILING_URL_PUNCTUATION_PATTERN, '');
}

function extractEmbeddedNeteaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^[a-z]+:\/\//i.test(trimmed) || /^(music|y\.music)\.163\.com\//i.test(trimmed)) {
    return stripTrailingUrlPunctuation(trimmed);
  }

  const embeddedMatch = trimmed.match(EMBEDDED_NETEASE_URL_PATTERN);
  if (embeddedMatch?.[1]) {
    return stripTrailingUrlPunctuation(embeddedMatch[1]);
  }

  return trimmed;
}

function normalizeUrlCandidate(input: string): string {
  const trimmed = extractEmbeddedNeteaseUrl(input);
  if (/^[a-z]+:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^(music|y\.music)\.163\.com\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function tryParseUrl(input: string): URL | null {
  try {
    return new URL(normalizeUrlCandidate(input));
  } catch {
    return null;
  }
}

function readHashRoute(url: URL): { path: string; params: URLSearchParams } {
  const rawHash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  if (!rawHash) {
    return {
      path: '',
      params: new URLSearchParams(),
    };
  }

  try {
    const normalizedHash = rawHash.startsWith('/') ? rawHash : `/${rawHash}`;
    const hashUrl = new URL(normalizedHash, 'https://music.163.com');
    return {
      path: hashUrl.pathname.toLowerCase(),
      params: hashUrl.searchParams,
    };
  } catch {
    return {
      path: rawHash.toLowerCase(),
      params: new URLSearchParams(),
    };
  }
}

function extractPathRouteId(url: URL, routeKeywords: string[]): string {
  if (routeKeywords.length === 0) {
    return '';
  }

  const candidates = getRouteCandidates(url);
  for (const candidate of candidates) {
    const segments = candidate
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);

    for (let index = 0; index < segments.length - 1; index += 1) {
      const currentSegment = segments[index]?.toLowerCase() || '';
      const nextSegment = segments[index + 1] || '';

      if (!routeKeywords.includes(currentSegment)) {
        continue;
      }

      if (isNumericNeteaseId(nextSegment)) {
        return nextSegment;
      }
    }
  }

  return '';
}

function extractRouteId(url: URL, pathRouteKeywords: string[] = []): string {
  const directId = url.searchParams.get('id')?.trim() || '';
  if (isNumericNeteaseId(directId)) {
    return directId;
  }

  const hashId = readHashRoute(url).params.get('id')?.trim() || '';
  if (isNumericNeteaseId(hashId)) {
    return hashId;
  }

  const pathId = extractPathRouteId(url, pathRouteKeywords);
  if (pathId) {
    return pathId;
  }

  return '';
}

function getRouteCandidates(url: URL): string[] {
  const candidates = [url.pathname.toLowerCase(), readHashRoute(url).path];
  return candidates.filter((candidate): candidate is string => Boolean(candidate));
}

function matchesNeteaseRoute(url: URL, routePatterns: string[]): boolean {
  if (!NETEASE_HOST_PATTERN.test(url.hostname)) {
    return false;
  }

  const candidates = getRouteCandidates(url);
  return routePatterns.some((pattern) =>
    candidates.some((candidate) =>
      candidate === pattern
      || candidate.endsWith(pattern)
      || candidate.startsWith(`${pattern}/`)
      || candidate.includes(`${pattern}/`),
    ),
  );
}

function buildNeteaseAccountBinding(uid: string): NeteaseAccountBinding {
  return {
    uid,
    profileUrl: `https://music.163.com/#/user/home?id=${uid}`,
    linkedAt: Date.now(),
  };
}

function buildNeteasePlaylistBinding(id: string): NeteasePlaylistBinding {
  return {
    id,
    playlistUrl: `https://music.163.com/#/playlist?id=${id}`,
    linkedAt: Date.now(),
  };
}

function buildNeteaseSongBinding(id: string): NeteaseSongBinding {
  return {
    id,
    songUrl: `https://music.163.com/#/song?id=${id}`,
    linkedAt: Date.now(),
  };
}

export function parseNeteaseAccountInput(input: string): NeteaseAccountBinding | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (isNumericNeteaseId(trimmed)) {
    return buildNeteaseAccountBinding(trimmed);
  }

  const url = tryParseUrl(trimmed);
  if (!url || !matchesNeteaseRoute(url, ['/user/home', '/m/user', '/user'])) {
    return null;
  }

  const uid = extractRouteId(url, ['home', 'user']);
  if (!uid) {
    return null;
  }

  return buildNeteaseAccountBinding(uid);
}

export function parseNeteasePlaylistInput(input: string): NeteasePlaylistBinding | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (isNumericNeteaseId(trimmed)) {
    return buildNeteasePlaylistBinding(trimmed);
  }

  const url = tryParseUrl(trimmed);
  if (!url || !matchesNeteaseRoute(url, ['/playlist', '/m/playlist'])) {
    return null;
  }

  const id = extractRouteId(url, ['playlist']);
  if (!id) {
    return null;
  }

  return buildNeteasePlaylistBinding(id);
}

export function parseNeteaseSongInput(input: string): NeteaseSongBinding | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (isNumericNeteaseId(trimmed)) {
    return buildNeteaseSongBinding(trimmed);
  }

  const url = tryParseUrl(trimmed);
  if (!url || !matchesNeteaseRoute(url, ['/song', '/m/song'])) {
    return null;
  }

  const id = extractRouteId(url, ['song']);
  if (!id) {
    return null;
  }

  return buildNeteaseSongBinding(id);
}

export function parseNeteaseMediaInput(input: string): NeteaseMediaBinding | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const playlist = parseNeteasePlaylistInput(trimmed);
  if (playlist) {
    return {
      kind: 'playlist',
      playlist,
    };
  }

  const song = parseNeteaseSongInput(trimmed);
  if (song) {
    return {
      kind: 'song',
      song,
    };
  }

  return null;
}

export function getNeteaseLoginUrl(): string {
  return 'https://music.163.com/#/login';
}

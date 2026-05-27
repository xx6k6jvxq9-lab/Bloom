import {
  parseNeteaseMediaInput,
  parseNeteasePlaylistInput,
  type NeteaseMediaBinding,
  type NeteasePlaylistBinding,
} from './neteaseAccount';

type NeteaseShareResolveResponse = {
  url?: string;
  error?: string;
};

async function fetchResolvedNeteaseShareUrl(input: string): Promise<string | null> {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const response = await fetch(`/api/netease/resolve-share?input=${encodeURIComponent(trimmed)}`);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? (await response.json()) as NeteaseShareResolveResponse
    : null;

  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error(data?.error || 'Failed to resolve NetEase share input.');
    }

    return null;
  }

  const resolvedUrl = typeof data?.url === 'string' ? data.url.trim() : '';
  return resolvedUrl || null;
}

export async function resolveNeteaseMediaInput(input: string): Promise<NeteaseMediaBinding | null> {
  const directParsed = parseNeteaseMediaInput(input);
  if (directParsed) {
    return directParsed;
  }

  const resolvedUrl = await fetchResolvedNeteaseShareUrl(input);
  if (!resolvedUrl) {
    return null;
  }

  return parseNeteaseMediaInput(resolvedUrl);
}

export async function resolveNeteasePlaylistInput(input: string): Promise<NeteasePlaylistBinding | null> {
  const directParsed = parseNeteasePlaylistInput(input);
  if (directParsed) {
    return directParsed;
  }

  const resolvedUrl = await fetchResolvedNeteaseShareUrl(input);
  if (!resolvedUrl) {
    return null;
  }

  return parseNeteasePlaylistInput(resolvedUrl);
}

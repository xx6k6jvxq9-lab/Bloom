const NETEASE_COVER_HOST_PATTERN = /(^|\.)music\.126\.net$|(^|\.)nosdn\.127\.net$/i;
const DEFAULT_NETEASE_COVER_SIZE = 400;

function clampCoverSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_NETEASE_COVER_SIZE;
  return Math.max(64, Math.min(1024, Math.round(size)));
}

function tryParseAbsoluteUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function buildNeteaseCoverProxyUrl(
  value: string | null | undefined,
  size = DEFAULT_NETEASE_COVER_SIZE,
): string | null {
  const trimmed = value?.trim() || '';
  if (!trimmed) return null;

  if (/^\/api\/netease\/cover\?/i.test(trimmed)) {
    return trimmed;
  }

  const url = tryParseAbsoluteUrl(trimmed);
  if (!url || !/^https?:$/i.test(url.protocol)) {
    return null;
  }

  if (!NETEASE_COVER_HOST_PATTERN.test(url.hostname)) {
    return null;
  }

  url.protocol = 'https:';
  if (!url.searchParams.has('param')) {
    const resolvedSize = clampCoverSize(size);
    url.searchParams.set('param', `${resolvedSize}y${resolvedSize}`);
  }

  return `/api/netease/cover?src=${encodeURIComponent(url.toString())}`;
}

export function normalizeMusicCoverValue(
  value: string | null | undefined,
  size = DEFAULT_NETEASE_COVER_SIZE,
): string {
  const trimmed = value?.trim() || '';
  if (!trimmed) return '';

  const proxiedCover = buildNeteaseCoverProxyUrl(trimmed, size);
  if (proxiedCover) {
    return proxiedCover;
  }

  return trimmed.replace(/^http:/i, 'https:');
}

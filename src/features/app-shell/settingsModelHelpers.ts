export const extractModelNamesFromResponse = (payload: any): string[] => {
  const rawList = payload?.data || payload?.models || payload;

  if (Array.isArray(rawList)) {
    return rawList
      .map((item: any) => {
        if (typeof item === 'string') return item;
        return item?.id || item?.name || item?.model || '';
      })
      .filter((item: string) => typeof item === 'string' && item.length > 0);
  }

  if (typeof rawList === 'object' && rawList !== null) {
    return Object.keys(rawList).filter((key) => key !== 'object');
  }

  return [];
};

export const resolveNextModelsPageUrl = (
  payload: any,
  response: Response,
  currentUrl: string,
): string | null => {
  const linkHeader = response.headers.get('link') || response.headers.get('Link');
  if (linkHeader) {
    const nextLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="?next"?/i);
    if (nextLinkMatch?.[1]) {
      return new URL(nextLinkMatch[1], currentUrl).toString();
    }
  }

  const nestedCandidates = [
    payload?.next,
    payload?.next_page,
    payload?.nextPage,
    payload?.next_page_url,
    payload?.nextPageUrl,
    payload?.pagination?.next,
    payload?.pagination?.next_page,
    payload?.pagination?.nextPage,
    payload?.pages?.next,
    payload?.links?.next,
    payload?.meta?.next,
  ];

  for (const candidate of nestedCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return new URL(candidate, currentUrl).toString();
    }

    if (candidate && typeof candidate === 'object') {
      const objectUrl = candidate.url || candidate.href;
      if (typeof objectUrl === 'string' && objectUrl.trim()) {
        return new URL(objectUrl, currentUrl).toString();
      }
    }
  }

  return null;
};

export const fetchAllPagedModelNames = async (
  initialUrl: string,
  headers: HeadersInit,
): Promise<string[]> => {
  const collected: string[] = [];
  const visited = new Set<string>();
  let nextUrl: string | null = initialUrl;
  let pageCount = 0;

  while (nextUrl && !visited.has(nextUrl) && pageCount < 20) {
    visited.add(nextUrl);
    pageCount += 1;

    const response = await fetch(nextUrl, { headers });
    if (!response.ok) {
      throw new Error(`获取失败 (${response.status})，请检查 Base URL 和 API Key`);
    }

    const payload = await response.json();
    collected.push(...extractModelNamesFromResponse(payload));
    nextUrl = resolveNextModelsPageUrl(payload, response, nextUrl);
  }

  return collected;
};

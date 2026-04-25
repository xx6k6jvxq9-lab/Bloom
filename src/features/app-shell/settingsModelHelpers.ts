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

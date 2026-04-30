import type { ApiConfig } from '../../../types';

export function extractModelNamesFromResponse(payload: any): string[] {
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
}

export function resolveNextModelsPageUrl(
  payload: any,
  response: Response,
  currentUrl: string,
): string | null {
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
}

export async function fetchAllPagedModelNames(
  initialUrl: string,
  headers: HeadersInit,
): Promise<string[]> {
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
}

export function filterAvailableModels(
  availableModels: string[],
  keyword: string,
): string[] {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!availableModels.length) return [];
  if (!normalizedKeyword) return availableModels;

  const startsWithMatches = availableModels.filter((model) =>
    model.toLowerCase().startsWith(normalizedKeyword),
  );
  const includesMatches = availableModels.filter(
    (model) =>
      !model.toLowerCase().startsWith(normalizedKeyword)
      && model.toLowerCase().includes(normalizedKeyword),
  );

  return [...startsWithMatches, ...includesMatches];
}

export async function fetchAvailableModels(
  config: ApiConfig,
): Promise<{ models: string[]; normalizedBaseUrl?: string }> {
  let models: string[] = [];
  let nextModelsPageUrl: string | null = null;
  let paginationHeaders: HeadersInit | null = null;
  let normalizedBaseUrl: string | undefined;

  const isGemini =
    config.provider === 'Google Gemini'
    || (!config.baseUrl && config.provider === 'Custom');

  if (isGemini) {
    const key = config.apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('未配置 API Key，无法拉取模型');

    let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (!response.ok) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
    }

    if (!response.ok) {
      throw new Error(`获取失败 (${response.status})，请检查 API Key 是否有效`);
    }

    const data = await response.json();
    const rawList = data.models || data.data || data;
    if (Array.isArray(rawList)) {
      models = rawList
        .map((item: any) => {
          const name = typeof item === 'string' ? item : item.name || item.id;
          return name ? name.replace('models/', '') : '';
        })
        .filter((name) => name && (name.includes('gemini') || name.includes('learnlm')));
    }
  } else {
    if (!config.baseUrl) throw new Error('请先填写 Base URL');

    let baseUrl = config.baseUrl.replace(/\/$/, '');
    const headers: HeadersInit = { Accept: 'application/json' };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }
    paginationHeaders = headers;

    let modelsUrl = `${baseUrl}/models`;
    let response = await fetch(modelsUrl, { headers });
    let contentType = response.headers.get('content-type');

    if ((!response.ok || (contentType && contentType.includes('text/html'))) && !baseUrl.endsWith('/v1')) {
      const retryUrl = `${baseUrl}/v1/models`;
      try {
        const retryResponse = await fetch(retryUrl, { headers });
        const retryContentType = retryResponse.headers.get('content-type');
        if (retryResponse.ok && retryContentType && retryContentType.includes('application/json')) {
          response = retryResponse;
          baseUrl = `${baseUrl}/v1`;
          modelsUrl = retryUrl;
          normalizedBaseUrl = baseUrl;
          contentType = retryContentType;
        }
      } catch {
        // Ignore retry error and keep the original failure path.
      }
    }

    if (!response.ok) {
      throw new Error(`获取失败 (${response.status})，请检查 Base URL 和 API Key`);
    }

    const data = await response.json();
    const rawList = data.data || data.models || data;
    if (Array.isArray(rawList)) {
      models = rawList
        .map((item: any) => {
          if (typeof item === 'string') return item;
          return item.id || item.name || item.model || String(item);
        })
        .filter((item) => typeof item === 'string' && item.length > 0);
    } else if (typeof rawList === 'object' && rawList !== null) {
      models = Object.keys(rawList).filter((key) => key !== 'object');
    } else {
      throw new Error('返回的数据格式不正确，未找到模型列表');
    }

    nextModelsPageUrl = resolveNextModelsPageUrl(data, response, modelsUrl);
  }

  if (nextModelsPageUrl && paginationHeaders) {
    models = [...models, ...(await fetchAllPagedModelNames(nextModelsPageUrl, paginationHeaders))];
  }

  models = [...new Set(models)].sort();
  if (models.length === 0) throw new Error('未找到可用模型');

  return { models, normalizedBaseUrl };
}

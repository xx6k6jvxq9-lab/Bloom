import type { ApiConfig } from '../../types';

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

export const filterAvailableModels = (
  availableModels: string[],
  keyword: string,
): string[] => {
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
};
export const testSettingsConnection = async (
  editForm: ApiConfig,
): Promise<{ normalizedBaseUrl?: string }> => {
  const isGemini =
    editForm.provider === 'Google Gemini'
    || (!editForm.baseUrl && editForm.provider === '自定义 (Custom)');

  if (isGemini) {
    const key = editForm.apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('需要 API Key');
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (!res.ok) throw new Error('连接失败，请检查 API Key');
    return {};
  }

  if (!editForm.baseUrl) throw new Error('请先填写 Base URL');
  let baseUrl = editForm.baseUrl.replace(/\/$/, '');
  const headers: HeadersInit = { Accept: 'application/json' };
  if (editForm.apiKey) {
    headers.Authorization = `Bearer ${editForm.apiKey}`;
  }

  let res = await fetch(`${baseUrl}/models`, { headers });
  let contentType = res.headers.get('content-type');

  if ((!res.ok || (contentType && contentType.includes('text/html'))) && !baseUrl.endsWith('/v1')) {
    const retryUrl = `${baseUrl}/v1/models`;
    try {
      const retryRes = await fetch(retryUrl, { headers });
      const retryContentType = retryRes.headers.get('content-type');
      if (retryRes.ok && retryContentType && retryContentType.includes('application/json')) {
        res = retryRes;
        baseUrl = `${baseUrl}/v1`;
        contentType = retryContentType;
      }
    } catch {
      // Ignore retry error and keep the original failure path.
    }
  }

  if (!res.ok) throw new Error('连接失败，请检查 Base URL 和 API Key');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('服务器返回了非 JSON 格式的数据，请检查 Base URL 是否正确。');
  }

  return { normalizedBaseUrl: baseUrl !== editForm.baseUrl ? baseUrl : undefined };
};

export const fetchSettingsModels = async (
  editForm: ApiConfig,
): Promise<{ models: string[]; normalizedBaseUrl?: string }> => {
  let models: string[] = [];
  let nextModelsPageUrl: string | null = null;
  let paginationHeaders: HeadersInit | null = null;
  let normalizedBaseUrl: string | undefined;

  const isGemini =
    editForm.provider === 'Google Gemini'
    || (!editForm.baseUrl && editForm.provider === '自定义 (Custom)');

  if (isGemini) {
    const key = editForm.apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('未配置 API Key，无法拉取模型');

    let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (!res.ok) {
      res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
    }

    if (!res.ok) {
      throw new Error(`获取失败 (${res.status})，请检查 API Key 是否有效`);
    }

    const data = await res.json();
    const rawList = data.models || data.data || data;
    if (Array.isArray(rawList)) {
      models = rawList
        .map((m: any) => {
          const name = typeof m === 'string' ? m : m.name || m.id;
          return name ? name.replace('models/', '') : '';
        })
        .filter((m) => m && (m.includes('gemini') || m.includes('learnlm')));
    }
  } else {
    if (!editForm.baseUrl) throw new Error('请先填写 Base URL');
    let baseUrl = editForm.baseUrl.replace(/\/$/, '');
    const headers: HeadersInit = { Accept: 'application/json' };
    if (editForm.apiKey) {
      headers.Authorization = `Bearer ${editForm.apiKey}`;
    }
    paginationHeaders = headers;

    let modelsUrl = `${baseUrl}/models`;
    let res = await fetch(modelsUrl, { headers });
    let contentType = res.headers.get('content-type');

    if ((!res.ok || (contentType && contentType.includes('text/html'))) && !baseUrl.endsWith('/v1')) {
      const retryUrl = `${baseUrl}/v1/models`;
      try {
        const retryRes = await fetch(retryUrl, { headers });
        const retryContentType = retryRes.headers.get('content-type');
        if (retryRes.ok && retryContentType && retryContentType.includes('application/json')) {
          res = retryRes;
          baseUrl = `${baseUrl}/v1`;
          modelsUrl = retryUrl;
          normalizedBaseUrl = baseUrl;
          contentType = retryContentType;
        }
      } catch {
        // Ignore retry error and keep the original failure path.
      }
    }

    if (!res.ok) {
      throw new Error(`获取失败 (${res.status})，请检查 Base URL 和 API Key`);
    }

    const data = await res.json();
    const rawList = data.data || data.models || data;
    if (Array.isArray(rawList)) {
      models = rawList
        .map((m: any) => {
          if (typeof m === 'string') return m;
          return m.id || m.name || m.model || String(m);
        })
        .filter((m) => typeof m === 'string' && m.length > 0);
    } else if (typeof rawList === 'object' && rawList !== null) {
      models = Object.keys(rawList).filter((k) => k !== 'object');
    } else {
      throw new Error('返回的数据格式不正确 (未找到模型列表)');
    }

    nextModelsPageUrl = resolveNextModelsPageUrl(data, res, modelsUrl);
  }

  if (nextModelsPageUrl && paginationHeaders) {
    models = [...models, ...(await fetchAllPagedModelNames(nextModelsPageUrl, paginationHeaders))];
  }

  models = [...new Set(models)].sort();
  if (models.length === 0) throw new Error('未找到可用模型');

  return { models, normalizedBaseUrl };
};

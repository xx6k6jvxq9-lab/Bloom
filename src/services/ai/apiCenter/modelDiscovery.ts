import type { ApiConfig } from '../../../types';

const MODEL_FETCH_TIMEOUT_MS = 12000;

type JsonFetchResult = {
  response: Response;
  payload: any;
  contentType: string;
  rawText: string;
};

function normalizeErrorDetail(detail: string, maxLength = 180): string {
  const normalized = detail.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function extractErrorDetail(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const objectPayload = payload as Record<string, unknown>;
  const errorPayload = objectPayload.error;

  if (errorPayload && typeof errorPayload === 'object') {
    const nestedMessage = Reflect.get(errorPayload, 'message');
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage;
    }

    const nestedDetail = Reflect.get(errorPayload, 'detail');
    if (typeof nestedDetail === 'string' && nestedDetail.trim()) {
      return nestedDetail;
    }
  }

  const directCandidates = [
    objectPayload.message,
    objectPayload.detail,
    objectPayload.error_msg,
    objectPayload.msg,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return '';
}

function buildTimeoutError(timeoutMs: number): Error {
  return new Error(`拉取模型超时（${Math.ceil(timeoutMs / 1000)} 秒）。`);
}

async function runWithTimeout<T>(
  run: (signal?: AbortSignal) => Promise<T>,
  timeoutMs = MODEL_FETCH_TIMEOUT_MS,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return run();
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => {
        controller?.abort();
        reject(buildTimeoutError(timeoutMs));
      }, timeoutMs);

      run(controller?.signal)
        .then(resolve)
        .catch((error) => {
          if (error instanceof Error && error.name === 'AbortError') {
            reject(buildTimeoutError(timeoutMs));
            return;
          }

          reject(error);
        });
    });
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function buildBrowserRequestError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || /timed out/i.test(error.message)) {
      return buildTimeoutError(MODEL_FETCH_TIMEOUT_MS);
    }

    if (error instanceof TypeError) {
      return new Error(
        '浏览器无法访问模型接口。安卓上常见原因是网络不稳定、CORS 被拦截、TLS 证书异常，或代理站屏蔽了浏览器请求。',
      );
    }

    return error;
  }

  return new Error(String(error ?? '拉取模型时发生未知错误。'));
}

async function readJsonResult(response: Response): Promise<JsonFetchResult> {
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const rawText = await response.text().catch(() => '');
  let payload: any = null;

  if (rawText.trim()) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  return {
    response,
    payload,
    contentType,
    rawText,
  };
}

function buildResponseError(result: JsonFetchResult, fallbackMessage: string): Error {
  const detail = normalizeErrorDetail(
    extractErrorDetail(result.payload) || result.rawText,
  );

  if (result.contentType.includes('text/html')) {
    return new Error(
      detail
        ? `${fallbackMessage}（${result.response.status}）。接口返回了 HTML 页面而不是 JSON：${detail}`
        : `${fallbackMessage}（${result.response.status}）。接口返回了 HTML 页面而不是 JSON，请检查 Base URL 是否填成网页地址、登录页、网关提示页或防护页。`,
    );
  }

  return new Error(
    detail
      ? `${fallbackMessage}（${result.response.status}）：${detail}`
      : `${fallbackMessage}（${result.response.status}）。`,
  );
}

async function fetchJsonWithDiagnostics(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<JsonFetchResult> {
  let response: Response;

  try {
    response = await runWithTimeout(
      (signal) => fetch(url, { ...init, signal }),
      MODEL_FETCH_TIMEOUT_MS,
    );
  } catch (error) {
    throw buildBrowserRequestError(error);
  }

  const result = await readJsonResult(response);
  if (!response.ok) {
    throw buildResponseError(result, fallbackMessage);
  }

  if (result.contentType.includes('text/html')) {
    throw buildResponseError(result, fallbackMessage);
  }

  if (!result.rawText.trim()) {
    throw new Error(`${fallbackMessage} 接口返回了空响应。`);
  }

  if (result.payload === null) {
    throw new Error(`${fallbackMessage} 接口没有返回合法的 JSON。`);
  }

  return result;
}

function extractArrayLikeModelList(payload: any): any {
  return payload?.data
    || payload?.models
    || payload?.items
    || payload?.result?.data
    || payload?.result?.models
    || payload;
}

export function extractModelNamesFromResponse(payload: any): string[] {
  const rawList = extractArrayLikeModelList(payload);

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

function resolveCursorPaginationUrl(payload: any, currentUrl: string): string | null {
  const hasMore = [
    payload?.has_more,
    payload?.hasMore,
    payload?.pagination?.has_more,
    payload?.pagination?.hasMore,
    payload?.meta?.has_more,
    payload?.meta?.hasMore,
    payload?.page_info?.has_more,
    payload?.pageInfo?.hasMore,
  ].some((value) => value === true);

  if (!hasMore) {
    return null;
  }

  const rawList = extractArrayLikeModelList(payload);
  const lastItem = Array.isArray(rawList) && rawList.length > 0
    ? rawList[rawList.length - 1]
    : null;

  const cursorCandidates: Array<{ value: unknown; param: string }> = [
    { value: payload?.after, param: 'after' },
    { value: payload?.starting_after, param: 'starting_after' },
    { value: payload?.next_cursor, param: 'cursor' },
    { value: payload?.nextCursor, param: 'cursor' },
    { value: payload?.pagination?.after, param: 'after' },
    { value: payload?.pagination?.starting_after, param: 'starting_after' },
    { value: payload?.pagination?.next_cursor, param: 'cursor' },
    { value: payload?.pagination?.nextCursor, param: 'cursor' },
    { value: payload?.meta?.after, param: 'after' },
    { value: payload?.meta?.next_cursor, param: 'cursor' },
    { value: payload?.page_info?.end_cursor, param: 'after' },
    { value: payload?.pageInfo?.endCursor, param: 'after' },
    { value: payload?.last_id, param: 'after' },
    { value: payload?.lastId, param: 'after' },
    { value: lastItem?.id, param: 'after' },
  ];

  const current = new URL(currentUrl);
  const existingCursorParam = [
    'after',
    'starting_after',
    'cursor',
    'page_cursor',
    'pageCursor',
    'page_token',
    'pageToken',
    'next_cursor',
    'nextCursor',
  ].find((name) => current.searchParams.has(name));

  for (const candidate of cursorCandidates) {
    if (typeof candidate.value !== 'string' || !candidate.value.trim()) {
      continue;
    }

    const next = new URL(currentUrl);
    next.searchParams.set(existingCursorParam || candidate.param, candidate.value.trim());
    return next.toString();
  }

  return null;
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
    payload?.next_url,
    payload?.nextUrl,
    payload?.next_page,
    payload?.nextPage,
    payload?.next_page_url,
    payload?.nextPageUrl,
    payload?.pagination?.next,
    payload?.pagination?.next_url,
    payload?.pagination?.nextUrl,
    payload?.pagination?.next_page,
    payload?.pagination?.nextPage,
    payload?.pages?.next,
    payload?.links?.next,
    payload?.meta?.next,
    payload?.meta?.next_url,
    payload?.meta?.nextUrl,
  ];

  for (const candidate of nestedCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return new URL(candidate, currentUrl).toString();
    }

    if (candidate && typeof candidate === 'object') {
      const objectUrl = (candidate as Record<string, unknown>).url || (candidate as Record<string, unknown>).href;
      if (typeof objectUrl === 'string' && objectUrl.trim()) {
        return new URL(objectUrl, currentUrl).toString();
      }
    }
  }

  return resolveCursorPaginationUrl(payload, currentUrl);
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

    const result = await fetchJsonWithDiagnostics(
      nextUrl,
      { headers },
      '继续拉取分页模型列表失败。',
    );

    collected.push(...extractModelNamesFromResponse(result.payload));
    nextUrl = resolveNextModelsPageUrl(result.payload, result.response, nextUrl);
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
    if (!key) {
      throw new Error('请先填写 API Key。');
    }

    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      `https://generativelanguage.googleapis.com/v1/models?key=${key}`,
    ];

    let lastError: Error | null = null;
    for (const endpoint of endpoints) {
      try {
        const result = await fetchJsonWithDiagnostics(
          endpoint,
          {
            headers: {
              Accept: 'application/json',
            },
          },
          '拉取 Gemini 模型失败。',
        );

        models = extractModelNamesFromResponse(result.payload)
          .map((name) => name.replace(/^models\//, ''))
          .filter((name) => name && (name.includes('gemini') || name.includes('learnlm')));

        if (models.length > 0) {
          break;
        }

        lastError = new Error('Gemini 接口返回成功，但没有解析到可用模型。');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error ?? '拉取模型时发生未知错误。'));
      }
    }

    if (!models.length) {
      throw lastError || new Error('未找到可用模型。');
    }
  } else {
    if (!config.baseUrl) {
      throw new Error('请先填写 Base URL。');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const headers: HeadersInit = {
      Accept: 'application/json',
    };

    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    paginationHeaders = headers;

    const candidates = [
      {
        url: `${baseUrl}/models`,
        normalizedBaseUrl: undefined as string | undefined,
      },
      ...(!baseUrl.endsWith('/v1')
        ? [{
            url: `${baseUrl}/v1/models`,
            normalizedBaseUrl: `${baseUrl}/v1`,
          }]
        : []),
    ];

    let lastError: Error | null = null;
    for (const candidate of candidates) {
      try {
        const result = await fetchJsonWithDiagnostics(
          candidate.url,
          { headers },
          '拉取模型失败。',
        );
        const discoveredModels = extractModelNamesFromResponse(result.payload);
        const discoveredNextPageUrl = resolveNextModelsPageUrl(
          result.payload,
          result.response,
          candidate.url,
        );

        if (!discoveredModels.length && !discoveredNextPageUrl) {
          lastError = new Error(
            '接口已经返回 JSON，但没有找到模型列表字段。请确认 Base URL 指向的是 OpenAI 兼容 API 根地址。',
          );
          continue;
        }

        models = discoveredModels;
        nextModelsPageUrl = discoveredNextPageUrl;
        normalizedBaseUrl = candidate.normalizedBaseUrl;
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error ?? '拉取模型时发生未知错误。'));
      }
    }

    if (!models.length && !nextModelsPageUrl) {
      throw lastError || new Error('未找到可用模型。');
    }
  }

  if (nextModelsPageUrl && paginationHeaders) {
    models = [...models, ...(await fetchAllPagedModelNames(nextModelsPageUrl, paginationHeaders))];
  }

  models = [...new Set(models)].sort();
  if (models.length === 0) {
    throw new Error('未找到可用模型。');
  }

  return { models, normalizedBaseUrl };
}

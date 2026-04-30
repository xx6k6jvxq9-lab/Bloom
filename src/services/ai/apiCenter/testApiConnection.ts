import type { ApiConfig } from '../../../types';

export async function testApiConnection(
  config: ApiConfig,
): Promise<{ normalizedBaseUrl?: string }> {
  const isGemini =
    config.provider === 'Google Gemini'
    || (!config.baseUrl && config.provider === 'Custom');

  if (isGemini) {
    const key = config.apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('需要 API Key');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (!response.ok) {
      throw new Error('连接失败，请检查 API Key');
    }

    return {};
  }

  if (!config.baseUrl) throw new Error('请先填写 Base URL');

  let baseUrl = config.baseUrl.replace(/\/$/, '');
  const headers: HeadersInit = { Accept: 'application/json' };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  let response = await fetch(`${baseUrl}/models`, { headers });
  let contentType = response.headers.get('content-type');

  if ((!response.ok || (contentType && contentType.includes('text/html'))) && !baseUrl.endsWith('/v1')) {
    const retryUrl = `${baseUrl}/v1/models`;
    try {
      const retryResponse = await fetch(retryUrl, { headers });
      const retryContentType = retryResponse.headers.get('content-type');
      if (retryResponse.ok && retryContentType && retryContentType.includes('application/json')) {
        response = retryResponse;
        baseUrl = `${baseUrl}/v1`;
        contentType = retryContentType;
      }
    } catch {
      // Ignore retry error and keep the original failure path.
    }
  }

  if (!response.ok) throw new Error('连接失败，请检查 Base URL 和 API Key');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('服务返回的不是 JSON 数据，请检查 Base URL 是否正确');
  }

  return { normalizedBaseUrl: baseUrl !== config.baseUrl ? baseUrl : undefined };
}

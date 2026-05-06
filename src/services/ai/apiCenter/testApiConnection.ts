import type { ApiConfig } from '../../../types';

const TEST_PROMPT = 'Reply with OK only.';

function normalizeErrorDetail(detail: string, maxLength = 160) {
  const normalized = detail.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function extractErrorDetail(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return '';
  }

  const error = Reflect.get(data, 'error');
  if (error && typeof error === 'object') {
    const message = Reflect.get(error, 'message');
    if (typeof message === 'string') {
      return message;
    }
  }

  const message = Reflect.get(data, 'message');
  if (typeof message === 'string') {
    return message;
  }

  const detail = Reflect.get(data, 'detail');
  if (typeof detail === 'string') {
    return detail;
  }

  return '';
}

async function buildErrorFromResponse(response: Response): Promise<Error> {
  const rawText = await response.text().catch(() => '');
  let detail = '';

  if (rawText.trim()) {
    try {
      detail = extractErrorDetail(JSON.parse(rawText));
    } catch {
      detail = rawText;
    }
  }

  const normalizedDetail = normalizeErrorDetail(detail);
  return new Error(
    normalizedDetail
      ? `${response.status}: ${normalizedDetail}`
      : `${response.status}: Chat request failed`,
  );
}

async function testGeminiChatConnection(config: ApiConfig) {
  const key = config.apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Missing API Key');

  const model = config.model?.trim() || 'gemini-3-flash-preview';
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: TEST_PROMPT }],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 8,
    },
  };

  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`,
    `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${key}`,
  ];

  let lastError: Error | null = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        lastError = await buildErrorFromResponse(response);
        continue;
      }

      const rawText = await response.text().catch(() => '');
      if (!rawText.trim()) {
        lastError = new Error('Gemini chat endpoint returned an empty response');
        continue;
      }

      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
    }
  }

  throw lastError || new Error('Gemini chat request failed');
}

async function testOpenAiCompatibleChatConnection(config: ApiConfig): Promise<{ normalizedBaseUrl?: string }> {
  if (!config.baseUrl) throw new Error('Missing Base URL');

  const model = config.model?.trim();
  if (!model) {
    throw new Error('Missing model name');
  }

  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const body = {
    model,
    messages: [{ role: 'user', content: TEST_PROMPT }],
    temperature: 0,
    max_tokens: 8,
    stream: false,
  };

  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const candidates = [
    { url: `${baseUrl}/chat/completions`, normalizedBaseUrl: undefined as string | undefined },
    ...(!baseUrl.endsWith('/v1')
      ? [{ url: `${baseUrl}/v1/chat/completions`, normalizedBaseUrl: `${baseUrl}/v1` }]
      : []),
  ];

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        lastError = await buildErrorFromResponse(response);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        lastError = new Error('Chat endpoint returned HTML instead of JSON');
        continue;
      }

      const rawText = await response.text().catch(() => '');
      if (!rawText.trim()) {
        lastError = new Error('Chat endpoint returned an empty response');
        continue;
      }

      return { normalizedBaseUrl: candidate.normalizedBaseUrl };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
    }
  }

  throw lastError || new Error('OpenAI-compatible chat request failed');
}

export async function testApiConnection(
  config: ApiConfig,
): Promise<{ normalizedBaseUrl?: string; message?: string }> {
  const isGemini =
    config.provider === 'Google Gemini'
    || (!config.baseUrl && config.provider === 'Custom');

  if (isGemini) {
    await testGeminiChatConnection(config);
    return { message: 'Chat request succeeded.' };
  }

  const result = await testOpenAiCompatibleChatConnection(config);
  return {
    ...result,
    message: 'Chat request succeeded.',
  };
}

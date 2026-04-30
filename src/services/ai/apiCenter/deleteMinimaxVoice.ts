import type { ApiConfig } from '../../../types';

function ensureValidConfig(config: ApiConfig) {
  const apiKey = config.apiKey?.trim() || '';
  const baseUrl = config.baseUrl?.trim().replace(/\/$/, '') || '';

  if (!apiKey) {
    throw new Error('请先填写 MiniMax API Key。');
  }

  if (!baseUrl) {
    throw new Error('请先填写 MiniMax Base URL。');
  }

  return { apiKey, baseUrl };
}

function resolveDeleteVoiceEndpoint(baseUrl: string) {
  return baseUrl.endsWith('/v1')
    ? `${baseUrl}/delete_voice`
    : `${baseUrl}/v1/delete_voice`;
}

function readNestedString(source: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    let current: unknown = source;
    for (const key of path) {
      if (!current || typeof current !== 'object') {
        current = null;
        break;
      }
      current = Reflect.get(current, key);
    }
    if (typeof current === 'string' && current.trim()) {
      return current.trim();
    }
  }

  return null;
}

export async function deleteMinimaxVoice(config: ApiConfig, voiceId: string) {
  const { apiKey, baseUrl } = ensureValidConfig(config);
  const normalizedVoiceId = voiceId.trim();

  if (!normalizedVoiceId) {
    throw new Error('缺少要删除的 voiceId。');
  }

  const response = await fetch(resolveDeleteVoiceEndpoint(baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      voice_id: normalizedVoiceId,
    }),
  });

  const raw = await response.text();
  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = raw;
  }

  if (!response.ok) {
    const detail = typeof payload === 'string'
      ? payload.slice(0, 180)
      : readNestedString(payload, [
        ['base_resp', 'status_msg'],
        ['status_msg'],
        ['error', 'message'],
        ['message'],
      ]) || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  const statusCode = typeof payload === 'object' && payload
    ? Reflect.get(Reflect.get(payload, 'base_resp') as object, 'status_code')
    : null;
  if (typeof statusCode === 'number' && statusCode !== 0) {
    const statusMessage = readNestedString(payload, [
      ['base_resp', 'status_msg'],
      ['status_msg'],
    ]) || `status_code=${statusCode}`;
    throw new Error(statusMessage);
  }
}

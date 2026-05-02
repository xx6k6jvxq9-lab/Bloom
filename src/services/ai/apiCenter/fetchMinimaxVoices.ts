import type { ApiConfig } from '../../../types';

export type MinimaxVoiceRecord = {
  voiceId: string;
  voiceName: string;
  description: string;
  createdTime?: string;
  source: 'system' | 'voice_cloning' | 'voice_generation';
};

function ensureValidConfig(config: ApiConfig) {
  const apiKey = config.apiKey?.trim() || '';
  const baseUrl = config.baseUrl?.trim().replace(/\/$/, '') || '';

  if (!apiKey) {
    throw new Error('请先填写 MiniMax API Key。');
  }

  if (!baseUrl) {
    throw new Error('请先填写 MiniMax Base URL。');
  }

  return {
    apiKey,
    baseUrl,
  };
}

function resolveMinimaxEndpoint(baseUrl: string, path: string) {
  return baseUrl.endsWith('/v1')
    ? `${baseUrl}${path}`
    : `${baseUrl}/v1${path}`;
}

function normalizeVoiceList(rawList: unknown, source: MinimaxVoiceRecord['source']) {
  if (!Array.isArray(rawList)) {
    return [];
  }

  return rawList
    .map((item: any) => {
      const voiceId = typeof item?.voice_id === 'string'
        ? item.voice_id.trim()
        : typeof item?.voiceId === 'string'
          ? item.voiceId.trim()
          : '';

      if (!voiceId) {
        return null;
      }

      const descriptionList = Array.isArray(item?.description)
        ? item.description.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];

      return {
        voiceId,
        voiceName: typeof item?.voice_name === 'string' && item.voice_name.trim()
          ? item.voice_name.trim()
          : voiceId,
        description: descriptionList.join(' / '),
        createdTime: typeof item?.created_time === 'string' ? item.created_time : undefined,
        source,
      } satisfies MinimaxVoiceRecord;
    })
    .filter((item) => item !== null);
}

export async function fetchMinimaxVoices(
  config: ApiConfig,
  voiceType: 'system' | 'all' = 'system',
): Promise<MinimaxVoiceRecord[]> {
  const { apiKey, baseUrl } = ensureValidConfig(config);

  const response = await fetch(resolveMinimaxEndpoint(baseUrl, '/get_voice'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      voice_type: voiceType,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.base_resp?.status_msg || payload?.message || `HTTP ${response.status}`;
    throw new Error(`拉取音色失败：${detail}`);
  }

  const statusCode = payload?.base_resp?.status_code;
  if (typeof statusCode === 'number' && statusCode !== 0) {
    throw new Error(`拉取音色失败：${payload?.base_resp?.status_msg || statusCode}`);
  }

  const systemVoices = normalizeVoiceList(payload?.system_voice, 'system');
  const clonedVoices = voiceType === 'all' ? normalizeVoiceList(payload?.voice_cloning, 'voice_cloning') : [];
  const generatedVoices = voiceType === 'all' ? normalizeVoiceList(payload?.voice_generation, 'voice_generation') : [];

  return [...systemVoices, ...clonedVoices, ...generatedVoices];
}

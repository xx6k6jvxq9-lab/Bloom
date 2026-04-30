import type { ApiConfig } from '../../../types';
import { saveUploadedBlob } from '../../../features/persistence/persistentAssetService';

type DesignTtsVoiceParams = {
  config: ApiConfig;
  prompt: string;
  previewText: string;
  voiceId?: string;
};

type DesignTtsVoiceResult = {
  voiceId: string;
  previewAudioUrl?: string;
  previewAvailable: boolean;
};

function ensureValidConfig(config: ApiConfig) {
  const apiKey = config.apiKey?.trim() || '';
  const baseUrl = config.baseUrl?.trim().replace(/\/$/, '') || '';
  const model = config.model?.trim() || 'speech-02-hd';

  if (!apiKey) {
    throw new Error('请先填写 MiniMax API Key。');
  }

  if (!baseUrl) {
    throw new Error('请先填写 MiniMax Base URL。');
  }

  return { apiKey, baseUrl, model };
}

function resolveMinimaxEndpoint(baseUrl: string, path: string) {
  return baseUrl.endsWith('/v1')
    ? `${baseUrl}${path}`
    : `${baseUrl}/v1${path}`;
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

function hexToBlob(hex: string, mimeType: string) {
  const normalized = hex.trim();
  if (!normalized || normalized.length % 2 !== 0) {
    throw new Error('Voice Design 返回的试听音频格式无效。');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = parseInt(normalized.slice(index, index + 2), 16);
  }

  return new Blob([bytes], { type: mimeType });
}

async function resolvePreviewAudioUrl(payload: unknown, voiceId: string) {
  const audioUrl = readNestedString(payload, [
    ['audio_url'],
    ['trial_audio_url'],
    ['data', 'audio_url'],
    ['data', 'trial_audio_url'],
    ['audio_file'],
    ['data', 'audio_file'],
  ]);

  if (audioUrl) {
    return audioUrl;
  }

  const hexAudio = readNestedString(payload, [
    ['trial_audio'],
    ['audio'],
    ['data', 'trial_audio'],
    ['data', 'audio'],
    ['audio_hex'],
    ['data', 'audio_hex'],
  ]);

  if (!hexAudio) {
    return undefined;
  }

  const blob = hexToBlob(hexAudio, 'audio/mpeg');
  if (blob.size === 0) {
    return undefined;
  }

  return saveUploadedBlob(blob, {
    fileName: `voice-design-${voiceId}.mp3`,
    mimeType: 'audio/mpeg',
  });
}

export async function designTtsVoice(
  params: DesignTtsVoiceParams,
): Promise<DesignTtsVoiceResult> {
  const { apiKey, baseUrl, model } = ensureValidConfig(params.config);

  const response = await fetch(resolveMinimaxEndpoint(baseUrl, '/voice_design'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: params.prompt,
      preview_text: params.previewText,
      ...(params.voiceId?.trim() ? { voice_id: params.voiceId.trim() } : {}),
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.base_resp?.status_msg || payload?.message || `HTTP ${response.status}`;
    throw new Error(`Voice Design 调用失败：${detail}`);
  }

  const statusCode = payload?.base_resp?.status_code;
  if (typeof statusCode === 'number' && statusCode !== 0) {
    throw new Error(`Voice Design 调用失败：${payload?.base_resp?.status_msg || statusCode}`);
  }

  const voiceId = readNestedString(payload, [
    ['voice_id'],
    ['voiceId'],
    ['data', 'voice_id'],
    ['data', 'voiceId'],
  ]) || '';

  if (!voiceId) {
    throw new Error('Voice Design 成功返回，但没有拿到 voice_id。');
  }

  const previewAudioUrl = await resolvePreviewAudioUrl(payload, voiceId).catch(() => undefined);

  return {
    voiceId,
    previewAudioUrl,
    previewAvailable: Boolean(previewAudioUrl),
  };
}

import type { ApiConfig } from '../../types';
import { saveUploadedBlob } from '../../../features/persistence/persistentAssetService';

type SynthesizeTtsAudioParams = {
  config: ApiConfig;
  text: string;
  preferredVoiceId?: string;
  fallbackVoiceId?: string;
  fileNameBase?: string;
};

type SynthesizeTtsAudioResult = {
  audioUrl: string;
  audioMimeType: string;
};

function ensureValidConfig(config: ApiConfig) {
  const apiKey = config.apiKey?.trim() || '';
  const baseUrl = config.baseUrl?.trim().replace(/\/$/, '') || '';
  const model = config.model?.trim() || '';

  if (!apiKey) {
    throw new Error('TTS 配置缺少 API Key。');
  }

  if (!baseUrl) {
    throw new Error('TTS 配置缺少 Base URL。');
  }

  if (!model) {
    throw new Error('TTS 配置缺少模型名称。');
  }

  return {
    apiKey,
    baseUrl,
    model,
  };
}

function isMinimaxTtsConfig(config: ApiConfig) {
  const provider = config.provider?.trim().toLowerCase() || '';
  const baseUrl = config.baseUrl?.trim().toLowerCase() || '';
  const model = config.model?.trim().toLowerCase() || '';

  return provider.includes('minimax')
    || baseUrl.includes('minimax')
    || model.startsWith('speech-');
}

function resolveMinimaxTtsEndpoint(baseUrl: string) {
  return baseUrl.endsWith('/v1')
    ? `${baseUrl}/t2a_v2`
    : `${baseUrl}/v1/t2a_v2`;
}

function inferAudioMimeType(format: string | null | undefined) {
  const normalized = (format || 'mp3').trim().toLowerCase();
  if (normalized === 'wav') return 'audio/wav';
  if (normalized === 'flac') return 'audio/flac';
  if (normalized === 'aac') return 'audio/aac';
  if (normalized === 'ogg') return 'audio/ogg';
  return 'audio/mpeg';
}

function sanitizeFileSegment(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 32) || 'tts';
}

function hexToBlob(hex: string, mimeType: string) {
  const normalized = hex.trim();
  if (!normalized || normalized.length % 2 !== 0) {
    throw new Error('TTS 返回的音频数据格式无效。');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = parseInt(normalized.slice(index, index + 2), 16);
  }

  return new Blob([bytes], { type: mimeType });
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

async function extractMinimaxAudioBlob(payload: unknown, requestedFormat: string) {
  const responseFormat = readNestedString(payload, [
    ['data', 'audio_format'],
    ['extra_info', 'audio_format'],
    ['audio_format'],
  ]) || requestedFormat;
  const mimeType = inferAudioMimeType(responseFormat);

  const hexAudio = readNestedString(payload, [
    ['data', 'audio'],
    ['audio'],
    ['data', 'audio_hex'],
    ['audio_hex'],
  ]);
  if (hexAudio) {
    return {
      blob: hexToBlob(hexAudio, mimeType),
      mimeType,
    };
  }

  const remoteAudioUrl = readNestedString(payload, [
    ['data', 'audio_file'],
    ['audio_file'],
    ['data', 'audio_url'],
    ['audio_url'],
  ]);
  if (remoteAudioUrl) {
    const remoteResponse = await fetch(remoteAudioUrl);
    if (!remoteResponse.ok) {
      throw new Error(`下载 TTS 音频失败：HTTP ${remoteResponse.status}`);
    }
    const blob = await remoteResponse.blob();
    return {
      blob,
      mimeType: blob.type || mimeType,
    };
  }

  throw new Error('TTS 返回中没有可用音频数据。');
}

async function synthesizeMinimaxTtsAudio(params: SynthesizeTtsAudioParams): Promise<SynthesizeTtsAudioResult> {
  const { apiKey, baseUrl, model } = ensureValidConfig(params.config);
  const voiceId = params.preferredVoiceId?.trim() || params.fallbackVoiceId?.trim() || '';

  if (!voiceId) {
    throw new Error('请先填写 TTS 默认声音 ID，或为角色配置 voiceId。');
  }

  const format = 'mp3';
  const response = await fetch(resolveMinimaxTtsEndpoint(baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      text: params.text,
      stream: false,
      voice_setting: {
        voice_id: voiceId,
        speed: 1,
        vol: 1,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format,
        channel: 1,
      },
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
    throw new Error(`Minimax TTS 调用失败：${detail}`);
  }

  const statusCode = typeof payload === 'object' && payload
    ? Reflect.get(Reflect.get(payload, 'base_resp') as object, 'status_code')
    : null;
  if (typeof statusCode === 'number' && statusCode !== 0) {
    const statusMessage = readNestedString(payload, [
      ['base_resp', 'status_msg'],
      ['status_msg'],
    ]) || `status_code=${statusCode}`;
    throw new Error(`Minimax TTS 调用失败：${statusMessage}`);
  }

  const { blob, mimeType } = await extractMinimaxAudioBlob(payload, format);
  const fileNameBase = sanitizeFileSegment(params.fileNameBase || 'tts');
  const fileExtension = mimeType === 'audio/wav'
    ? 'wav'
    : mimeType === 'audio/flac'
      ? 'flac'
      : mimeType === 'audio/aac'
        ? 'aac'
        : mimeType === 'audio/ogg'
          ? 'ogg'
          : 'mp3';
  const audioUrl = await saveUploadedBlob(blob, {
    fileName: `${fileNameBase}.${fileExtension}`,
    mimeType,
  });

  return {
    audioUrl,
    audioMimeType: mimeType,
  };
}

export async function synthesizeTtsAudio(
  params: SynthesizeTtsAudioParams,
): Promise<SynthesizeTtsAudioResult> {
  if (isMinimaxTtsConfig(params.config)) {
    return synthesizeMinimaxTtsAudio(params);
  }

  throw new Error('当前只接入了 Minimax TTS，请使用 Minimax 语音配置。');
}

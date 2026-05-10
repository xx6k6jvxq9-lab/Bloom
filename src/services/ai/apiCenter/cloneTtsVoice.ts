import type { ApiConfig } from '../../../types';
import { getAsset } from '../../../features/persistence/browserDb';
import { parseUploadedAssetRef } from '../../../features/persistence/persistentAssetRef';
import { isLikelyVoiceSampleFile } from './voiceSampleCompat';

type CloneTtsVoiceParams = {
  config: ApiConfig;
  sampleAssetRef: string;
  voiceId: string;
  promptText?: string;
};

type CloneTtsVoiceResult = {
  voiceId: string;
  demoAudioUrl?: string;
};

function extractResolvedVoiceId(payload: any, fallbackVoiceId: string) {
  const candidates = [
    payload?.voice_id,
    payload?.voiceId,
    payload?.data?.voice_id,
    payload?.data?.voiceId,
    payload?.voice?.voice_id,
    payload?.voice?.voiceId,
  ];

  const resolved = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return resolved?.trim() || fallbackVoiceId;
}

function ensureValidConfig(config: ApiConfig) {
  const apiKey = config.apiKey?.trim() || '';
  const baseUrl = config.baseUrl?.trim().replace(/\/$/, '') || '';
  const model = config.model?.trim() || 'speech-2.8-hd';

  if (!apiKey) {
    throw new Error('Please fill in the TTS API Key first.');
  }

  if (!baseUrl) {
    throw new Error('Please fill in the TTS Base URL first.');
  }

  return {
    apiKey,
    baseUrl,
    model,
  };
}

function resolveMinimaxEndpoint(baseUrl: string, path: string) {
  return baseUrl.endsWith('/v1')
    ? `${baseUrl}${path}`
    : `${baseUrl}/v1${path}`;
}

async function readAssetBlob(assetRef: string) {
  const parsed = parseUploadedAssetRef(assetRef);
  if (!parsed) {
    throw new Error('The saved voice sample reference is invalid.');
  }

  const record = await getAsset(parsed.id);
  if (!record) {
    throw new Error('The saved voice sample could not be found. Please upload it again.');
  }

  return {
    blob: record.blob,
    fileName: record.fileName || 'voice-sample.wav',
  };
}

async function uploadMinimaxFile(params: {
  apiKey: string;
  baseUrl: string;
  blob: Blob;
  fileName: string;
  purpose: 'voice_clone' | 'prompt_audio';
}) {
  const formData = new FormData();
  formData.append('purpose', params.purpose);
  formData.append('file', params.blob, params.fileName);

  const response = await fetch(resolveMinimaxEndpoint(params.baseUrl, '/files/upload'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.base_resp?.status_msg || payload?.message || `HTTP ${response.status}`;
    throw new Error(`Voice sample upload failed: ${detail}`);
  }

  const statusCode = payload?.base_resp?.status_code;
  if (typeof statusCode === 'number' && statusCode !== 0) {
    throw new Error(`Voice sample upload failed: ${payload?.base_resp?.status_msg || statusCode}`);
  }

  const fileId = payload?.file?.file_id;
  if (typeof fileId !== 'number') {
    throw new Error('MiniMax upload response did not include a file_id.');
  }

  return fileId;
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const channelCount = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frameCount = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataLength = frameCount * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wavBuffer);

  const writeAsciiString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAsciiString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAsciiString(8, 'WAVE');
  writeAsciiString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAsciiString(36, 'data');
  view.setUint32(40, dataLength, true);

  const channelData = Array.from({ length: channelCount }, (_, index) => buffer.getChannelData(index));
  let offset = 44;

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channelIndex][frameIndex] || 0));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

async function createPromptAudioBlob(blob: Blob, fileName: string) {
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return blob;
  }

  const audioContext = new AudioContextCtor();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const promptDuration = Math.min(decoded.duration, 7.5);
    const promptFrameCount = Math.max(1, Math.floor(promptDuration * decoded.sampleRate));
    const slicedBuffer = audioContext.createBuffer(
      decoded.numberOfChannels,
      promptFrameCount,
      decoded.sampleRate,
    );

    for (let channelIndex = 0; channelIndex < decoded.numberOfChannels; channelIndex += 1) {
      const source = decoded.getChannelData(channelIndex).subarray(0, promptFrameCount);
      slicedBuffer.copyToChannel(source, channelIndex, 0);
    }

    return audioBufferToWavBlob(slicedBuffer);
  } catch (error) {
    if (isLikelyVoiceSampleFile({ name: fileName, type: blob.type })) {
      return blob;
    }

    throw error;
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

function normalizeVoiceId(input: string) {
  let normalized = input.trim().replace(/[^A-Za-z0-9_-]/g, '-');
  if (!normalized) {
    normalized = `BloomVoice${Date.now()}`;
  }

  if (!/^[A-Za-z]/.test(normalized)) {
    normalized = `Bloom${normalized}`;
  }

  normalized = normalized.replace(/[-_]+$/g, '');
  if (normalized.length < 8) {
    normalized = `${normalized}${'VoiceSeed'.slice(0, 8 - normalized.length)}`;
  }

  return normalized.slice(0, 256);
}

export async function cloneTtsVoice(
  params: CloneTtsVoiceParams,
): Promise<CloneTtsVoiceResult> {
  const { apiKey, baseUrl, model } = ensureValidConfig(params.config);
  const { blob, fileName } = await readAssetBlob(params.sampleAssetRef);
  const promptBlob = await createPromptAudioBlob(blob, fileName);
  const normalizedVoiceId = normalizeVoiceId(params.voiceId);

  const [fileId, promptAudioId] = await Promise.all([
    uploadMinimaxFile({
      apiKey,
      baseUrl,
      blob,
      fileName,
      purpose: 'voice_clone',
    }),
    uploadMinimaxFile({
      apiKey,
      baseUrl,
      blob: promptBlob,
      fileName: `prompt-${fileName.replace(/\s+/g, '-') || 'voice-sample.wav'}`,
      purpose: 'prompt_audio',
    }),
  ]);

  const response = await fetch(resolveMinimaxEndpoint(baseUrl, '/voice_clone'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      file_id: fileId,
      voice_id: normalizedVoiceId,
      clone_prompt: {
        prompt_audio: promptAudioId,
        prompt_text: params.promptText || 'Hello, nice to meet you.',
      },
      text: 'Hello, nice to meet you.',
      model,
      need_noise_reduction: false,
      need_volume_normalization: false,
      aigc_watermark: false,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.base_resp?.status_msg || payload?.message || `HTTP ${response.status}`;
    throw new Error(`Voice cloning failed: ${detail}`);
  }

  const statusCode = payload?.base_resp?.status_code;
  if (typeof statusCode === 'number' && statusCode !== 0) {
    throw new Error(`Voice cloning failed: ${payload?.base_resp?.status_msg || statusCode}`);
  }

  return {
    voiceId: extractResolvedVoiceId(payload, normalizedVoiceId),
    demoAudioUrl: typeof payload?.demo_audio === 'string' ? payload.demo_audio : undefined,
  };
}

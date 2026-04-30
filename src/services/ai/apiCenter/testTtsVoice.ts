import type { ApiConfig } from '../../../types';
import { resolveValueToDisplayUrl } from '../../../features/persistence/persistentAssetService';
import { synthesizeTtsAudio } from './synthesizeTtsAudio';

export async function testTtsVoice(
  config: ApiConfig,
  options?: { voiceId?: string },
): Promise<{ ok: true; message: string; audioUrl?: string }> {
  const result = await synthesizeTtsAudio({
    config,
    text: '你好，这是 Bloom 的语音测试。',
    fallbackVoiceId: options?.voiceId?.trim(),
    fileNameBase: 'tts-preview',
  });

  const displayUrl = await resolveValueToDisplayUrl(result.audioUrl);

  return {
    ok: true,
    message: '已生成一段 TTS 试听音频。',
    audioUrl: displayUrl || undefined,
  };
}

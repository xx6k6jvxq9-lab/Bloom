import { ensureApiCenterConfig } from './defaults';
import type { ResolveVoiceCallConfigParams, ResolvedVoiceCallConfig } from './types';

export function resolveVoiceCallConfig(
  params: ResolveVoiceCallConfigParams,
): ResolvedVoiceCallConfig {
  const apiCenterConfig = ensureApiCenterConfig(params.settings);
  const voiceCall = apiCenterConfig.voiceCall;

  if (!voiceCall?.enabled) {
    return {
      source: 'none',
      config: null,
      characterVoiceProfile: params.character?.voiceProfile,
    };
  }

  if (!voiceCall.tts?.enabled) {
    return {
      source: 'none',
      config: null,
      characterVoiceProfile: params.character?.voiceProfile,
    };
  }

  return {
    source: 'tts',
    config: voiceCall.tts.config,
    characterVoiceProfile: params.character?.voiceProfile,
    defaultVoiceId: voiceCall.tts.defaultVoiceId,
    supportsVoiceClone: voiceCall.tts.supportsVoiceClone,
  };
}

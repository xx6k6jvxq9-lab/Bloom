import type { ApiCenterConfig, ApiConfig, AppSettings, Character, CharacterVoiceProfile } from '../../../types';

export type TextCallScene =
  | 'default'
  | 'single-chat'
  | 'group-chat'
  | 'forum'
  | 'dating';

export type VoiceCallScene = 'tts';

export type ApiCenterSettingsLike = Pick<AppSettings, 'activeConfigId' | 'configs' | 'apiCenterConfig'>;

export type ResolveTextCallConfigParams = {
  settings: ApiCenterSettingsLike;
  scene: TextCallScene;
  characterId?: string | null;
};

export type ResolveVoiceCallConfigParams = {
  settings: ApiCenterSettingsLike;
  mode: VoiceCallScene;
  character?: Pick<Character, 'id' | 'voiceProfile'> | null;
};

export type ResolvedTextCallConfig = {
  source: 'default' | 'single-chat-rule' | 'group-chat' | 'forum' | 'dating' | 'legacy-active';
  ruleId?: string;
  config: NonNullable<ApiCenterConfig['defaultTextCall']>['config'] | null;
  legacyConfig?: ApiConfig | null;
};

export type ResolvedVoiceCallConfig = {
  source: 'tts' | 'none';
  config: ApiCenterConfig['voiceCall'] extends { tts?: infer T }
    ? NonNullable<T extends { config: infer C } ? C : never> | null
    : null;
  characterVoiceProfile?: CharacterVoiceProfile;
  defaultVoiceId?: string;
  supportsVoiceClone?: boolean;
};

import type { ApiConfig } from '../../../types';

export type MinimaxBaseUrlPreset = {
  id: 'official' | 'cn';
  label: string;
  baseUrl: string;
  description: string;
};

export const MINIMAX_BASE_URL_PRESETS: MinimaxBaseUrlPreset[] = [
  {
    id: 'official',
    label: '官方 / 国际版',
    baseUrl: 'https://api.minimax.io',
    description: '适合官方平台 API Key',
  },
  {
    id: 'cn',
    label: '国内版 / 兼容域名',
    baseUrl: 'https://api.minimaxi.com',
    description: '适合你当前常用的国内控制台配置',
  },
];

export const MINIMAX_OFFICIAL_TTS_MODELS = [
  { value: 'speech-2.8-hd', label: 'speech-2.8-hd', description: '高清，推荐' },
  { value: 'speech-2.8-turbo', label: 'speech-2.8-turbo', description: '更快，成本更低' },
  { value: 'speech-2.6-hd', label: 'speech-2.6-hd', description: '旧版高清' },
  { value: 'speech-2.6-turbo', label: 'speech-2.6-turbo', description: '旧版极速' },
  { value: 'speech-02-hd', label: 'speech-02-hd', description: '设计音色常用' },
  { value: 'speech-02-turbo', label: 'speech-02-turbo', description: '设计音色极速' },
];

export function looksLikeMinimaxConfig(config: Pick<ApiConfig, 'provider' | 'baseUrl' | 'model'>) {
  const provider = config.provider?.trim().toLowerCase() || '';
  const baseUrl = config.baseUrl?.trim().toLowerCase() || '';
  const model = config.model?.trim().toLowerCase() || '';

  return provider.includes('minimax')
    || baseUrl.includes('minimax')
    || model.startsWith('speech-');
}

export function inferMinimaxBaseUrlPreset(baseUrl: string | undefined) {
  const normalized = baseUrl?.trim().toLowerCase() || '';
  if (normalized.includes('minimaxi.com')) {
    return 'cn';
  }
  return 'official';
}

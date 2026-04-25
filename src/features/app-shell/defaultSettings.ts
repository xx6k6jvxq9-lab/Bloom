import type { ApiConfig, AppSettings } from '../../types';
import type { UserProfile } from './appShellTypes';

export const DEFAULT_USER: UserProfile = {
  name: 'AI 用户',
  avatar: 'https://tu.tuhenmei.com/uploads/allimg/2021090521/s4ljgp4msrd.jpg',
  id: 'user_8888',
  bio: '探索 AI 的无限可能',
  mood: '今天很开心',
};

export const DEFAULT_CONFIG: ApiConfig = {
  id: 'default',
  name: 'Google Gemini (默认)',
  provider: 'Google Gemini',
  apiKey: '',
  baseUrl: '',
  model: 'gemini-3-flash-preview',
  temperature: 1.0,
};

export const DEFAULT_SETTINGS: AppSettings = {
  activeConfigId: 'default',
  configs: [DEFAULT_CONFIG],
  sharedStickers: [],
  showChatTimeDividers: true,
  showChatMessageTime: true,
};

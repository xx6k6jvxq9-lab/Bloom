import type { ApiConfig, AppSettings, DesktopIconConfig, WidgetConfig } from '../../types';

export const DEFAULT_NAV_BAR_BACKGROUND = '';

export const DEFAULT_ZHOU_JIBAI_AVATAR =
  'https://tu.tuhenmei.com/tu2026/2025120917/mklyjkctwie22637.jpeg';

export const DEFAULT_CONFIG: ApiConfig = {
  id: 'default',
  name: 'Google Gemini (榛樿)',
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

export const DEFAULT_DESKTOP_WALLPAPER =
  'https://tse3.mm.bing.net/th/id/OIP.GdwwXxbY6ullokoEq_KO2gHaNK?rs=1&pid=ImgDetMain&o=7&rm=3';

export const DEFAULT_HOME_ICONS: DesktopIconConfig[] = [
  { id: 'chat', slotId: 'slot-1-2' },
  { id: 'settings', slotId: 'slot-1-3' },
  { id: 'worldbook', slotId: 'slot-2-2' },
  { id: 'monitor', slotId: 'slot-2-3' },
  { id: 'couple-space', slotId: 'slot-3-0' },
  { id: 'perception', slotId: 'slot-3-1' },
  { id: 'music', slotId: 'slot-4-0' },
  { id: 'forum', slotId: 'slot-4-1' },
];

export const DEFAULT_HOME_WIDGETS: WidgetConfig[] = [
  {
    id: 'blankCardA',
    type: 'blank',
    slotId: 'slot-1-0',
    w: 2,
    h: 2,
    background: 'https://tu.tuhenmei.com/tu2026/2025120917/qi35sbin1js22635.jpeg',
    borderRadius: 32,
    opacity: 1,
  },
  {
    id: 'blankCardB',
    type: 'blank',
    slotId: 'slot-3-2',
    w: 2,
    h: 2,
    background: 'https://tu.tuhenmei.com/uploads/allimg/2021090514/2vzjil1xqkt.jpg',
    borderRadius: 32,
    opacity: 1,
  },
];

import { Calendar, Cloud, Disc3, Heart, Images, Layout, LayoutGrid, Monitor, User, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import type { WidgetConfig } from '../../types';

export type SupportedDesktopWidgetType = WidgetConfig['type'];

export type DesktopWidgetTemplate = {
  type: SupportedDesktopWidgetType;
  label: string;
  size: { w: number; h: number };
  icon: ReactNode;
  create: () => WidgetConfig;
};

function createWidgetId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const SUPPORTED_DESKTOP_WIDGET_TEMPLATES: DesktopWidgetTemplate[] = [
  {
    type: 'kawaii-launcher',
    label: '快捷胶囊',
    size: { w: 4, h: 2 },
    icon: <User size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'kawaii-launcher',
      w: 4,
      h: 2,
      background: '#ffffff',
      borderRadius: 40,
      opacity: 1,
      avatarUrl: '',
      bio: '',
      item1Label: '',
      item2Label: '',
      item3Label: '',
      item4Label: '',
    }),
  },
  {
    type: 'kawaii-scrapbook',
    label: '拼贴手账',
    size: { w: 4, h: 2 },
    icon: <Layout size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'kawaii-scrapbook',
      w: 4,
      h: 2,
      background: '#ffffff',
      borderRadius: 32,
      opacity: 1,
      avatarUrl: '',
      title: '',
      bio: '',
      photoUrl: '',
      secondaryPhotoUrl: '',
      note: '',
      item1Color: '#f3e7eb',
      item2Color: '#ffffff',
      item3Color: '#efede7',
      item4Color: '#f7ecef',
    }),
  },
  {
    type: 'glass-duo-card',
    label: '双人玻璃卡',
    size: { w: 4, h: 2 },
    icon: <Users size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'glass-duo-card',
      w: 4,
      h: 2,
      background: '#ffffff',
      borderRadius: 32,
      opacity: 0.18,
      avatarUrl: '',
      secondaryAvatarUrl: '',
      line1Text: '',
      line2Text: '',
      bio: '',
    }),
  },
  {
    type: 'glass-vinyl-player',
    label: '黑胶播放器',
    size: { w: 4, h: 3 },
    icon: <Disc3 size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'glass-vinyl-player',
      w: 4,
      h: 3,
      background: '#ffffff',
      borderRadius: 34,
      opacity: 0.18,
      title: '',
      bio: '',
      note: '',
      photoUrl: '',
      secondaryPhotoUrl: '',
      audioUrl: '',
    }),
  },
  {
    type: 'glass-polaroid-strip',
    label: '拍立得三连',
    size: { w: 4, h: 2 },
    icon: <Images size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'glass-polaroid-strip',
      w: 4,
      h: 2,
      background: '#ffffff',
      borderRadius: 30,
      opacity: 0.18,
      avatarUrl: '',
      photoUrl: '',
      secondaryPhotoUrl: '',
    }),
  },
  {
    type: 'glass-recent-grid',
    label: '最近照片墙',
    size: { w: 4, h: 3 },
    icon: <LayoutGrid size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'glass-recent-grid',
      w: 4,
      h: 3,
      background: '#ffffff',
      borderRadius: 30,
      opacity: 0.18,
      title: '',
      note: '',
      images: ['', '', '', '', '', ''],
    }),
  },
  {
    type: 'profile-card',
    label: '资料卡片',
    size: { w: 4, h: 2 },
    icon: <User size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'profile-card',
      w: 4,
      h: 2,
      background: '#ffffff',
      profileName: '自定义',
      handle: '自定义',
      bio: '自定义',
      location: '自定义',
      material: 'default',
    }),
  },
  {
    type: 'calendar',
    label: '日历组件',
    size: { w: 2, h: 2 },
    icon: <Calendar size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'calendar',
      w: 2,
      h: 2,
      background: '#ffffff',
      style: 'default',
    }),
  },
  {
    type: 'time',
    label: '时间卡片',
    size: { w: 2, h: 2 },
    icon: <Monitor size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'time',
      w: 2,
      h: 2,
      background: '#ffffff',
      style: 'default',
    }),
  },
  {
    type: 'floating-time',
    label: '透明时间',
    size: { w: 4, h: 2 },
    icon: <Monitor size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'floating-time',
      w: 4,
      h: 2,
      background: '',
      style: 'poster',
      showDate: true,
      showLunar: true,
      showOutline: true,
      textAlign: 'center',
      datePosition: 'top',
      timeWeight: 700,
      timeColor: '#6f7892',
      dateColor: '#7c8499',
    }),
  },
  {
    type: 'anniversary',
    label: '纪念日组件',
    size: { w: 2, h: 2 },
    icon: <Heart size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'anniversary',
      w: 2,
      h: 2,
      background: '#ffffff',
      title: '纪念日',
      date: new Date().toISOString().slice(0, 10),
    }),
  },
  {
    type: 'weather',
    label: '天气组件',
    size: { w: 2, h: 2 },
    icon: <Cloud size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'weather',
      w: 2,
      h: 2,
      background: '#ffffff',
    }),
  },
  {
    type: 'blank',
    label: '空白卡片',
    size: { w: 2, h: 2 },
    icon: <Layout size={18} />,
    create: () => ({
      id: createWidgetId(),
      type: 'blank',
      w: 2,
      h: 2,
      background: '#ffffff',
    }),
  },
];

export function isSupportedDesktopWidgetType(type: WidgetConfig['type']): type is SupportedDesktopWidgetType {
  return SUPPORTED_DESKTOP_WIDGET_TEMPLATES.some(template => template.type === type);
}

export function isLegacyMusicWidget(widget: { type?: string | null | undefined }) {
  return widget.type === 'music' || widget.type === 'kawaii-couple-pills';
}

export function createDesktopWidgetFromType(type: SupportedDesktopWidgetType) {
  return SUPPORTED_DESKTOP_WIDGET_TEMPLATES.find(template => template.type === type)?.create() ?? null;
}

export function getDesktopWidgetTypeLabel(type: WidgetConfig['type']) {
  switch (type) {
    case 'kawaii-launcher':
      return '快捷胶囊';
    case 'kawaii-scrapbook':
      return '拼贴手账';
    case 'glass-duo-card':
      return '双人玻璃卡';
    case 'glass-vinyl-player':
      return '黑胶播放器';
    case 'glass-polaroid-strip':
      return '拍立得三连';
    case 'glass-recent-grid':
      return '最近照片墙';
    case 'calendar':
      return '日历组件';
    case 'time':
      return '时间卡片';
    case 'floating-time':
      return '透明时间';
    case 'anniversary':
      return '纪念日组件';
    case 'weather':
      return '天气组件';
    case 'profile-card':
      return '资料卡片';
    case 'blank':
      return '空白卡片';
    default:
      return '小组件';
  }
}

export function getDesktopWidgetStyleOptions(type: WidgetConfig['type']) {
  switch (type) {
    case 'time':
      return [
        { value: 'default', label: '默认卡片' },
        { value: 'minimal', label: '极简数字' },
      ];
    case 'floating-time':
      return [
        { value: 'poster', label: 'iOS 海报' },
        { value: 'clean', label: '纯文字' },
      ];
    case 'calendar':
      return [
        { value: 'default', label: '默认样式' },
        { value: 'list', label: '日程列表' },
      ];
    default:
      return [{ value: 'default', label: '默认样式' }];
  }
}

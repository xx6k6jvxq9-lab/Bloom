export const CATEGORY_ICON_MAP: Record<string, string> = {
  '全部': '🛍️',
  '男装': '👔',
  '女装': '👗',
  '家居': '🕯️',
  '数码': '💬',
  '礼物': '🎁',
  '睡眠': '🛌',
  '私密': '🌙',
  '情侣': '💞',
  '共同空间': '🏠',
};

export const HOME_HERO_SLIDES = [
  {
    id: 'hero-home',
    eyebrow: '今日主推',
    title: '把房间慢慢补齐',
    description: '更适合先补香氛、夜灯、杯子和会长期待在房间里的小东西。',
    accent: 'linear-gradient(135deg, #a4b8d7 0%, #d7dce8 100%)',
    emoji: '🕯️',
    actionLabel: '去看家居',
    actionValue: '家居',
  },
  {
    id: 'hero-sleep',
    eyebrow: '晚间补货',
    title: '睡前会更想买的',
    description: '如果你现在更偏宅家和放松路线，可以先看睡衣、夜灯和小型数字主题。',
    accent: 'linear-gradient(135deg, #c0b7df 0%, #e5dff3 100%)',
    emoji: '🛌',
    actionLabel: '去看睡眠',
    actionValue: '睡眠',
  },
  {
    id: 'hero-digital',
    eyebrow: '马上到账',
    title: '想立刻看到变化',
    description: '数字主题和聊天气泡会更适合现在，不需要等待配送就能直接解锁。',
    accent: 'linear-gradient(135deg, #8ca7d6 0%, #d6e3f6 100%)',
    emoji: '💬',
    actionLabel: '去看数码',
    actionValue: '数码',
  },
] as const;

export type MallOrderFilter = 'all' | 'pending' | 'delivering' | 'done' | 'digital';

export const ORDER_FILTER_OPTIONS: Array<{ value: MallOrderFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'delivering', label: '配送中' },
  { value: 'done', label: '已完成' },
  { value: 'digital', label: '数字商品' },
];

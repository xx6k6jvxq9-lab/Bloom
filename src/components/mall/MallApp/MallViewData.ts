export const CATEGORY_ICON_MAP: Record<string, string> = {
  '全部': '🛍️',
  '男装': '👕',
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

export type MallHomeMode = 'self' | 'gift' | 'companion' | 'private';

export const HOME_MODE_OPTIONS: Array<{
  value: MallHomeMode;
  label: string;
  description: string;
}> = [
  { value: 'self', label: '自己买', description: '更偏日常自购和高频使用' },
  { value: 'gift', label: '送给TA', description: '优先看适合送礼和有反馈余波的商品' },
  { value: 'companion', label: '一起逛', description: '更强调陪逛、讨论感和共同挑选' },
  { value: 'private', label: '私密专区', description: '预留独立模式入口，不混入普通货架' },
];

export type MallOrderFilter = 'all' | 'pending' | 'delivering' | 'done' | 'digital' | 'gift' | 'shared_space';

export const ORDER_FILTER_OPTIONS: Array<{ value: MallOrderFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'delivering', label: '配送中' },
  { value: 'done', label: '已完成' },
  { value: 'digital', label: '数字商品' },
  { value: 'gift', label: '送礼记录' },
  { value: 'shared_space', label: '共同空间' },
];

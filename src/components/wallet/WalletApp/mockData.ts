import type { WalletCard, WalletTransaction } from '../../../types';

export const MOCK_CARDS: WalletCard[] = [
  {
    id: 'card-baby',
    type: 'bank',
    bankName: '宝宝银行',
    cardType: '亲密付',
    number: '**** 5200',
    balance: 1314.0,
    color: 'from-zinc-900 to-black border border-zinc-800',
    textColor: 'text-white',
    iconColor: 'text-yellow-500',
    theme: 'dark',
    icon: 'heart',
  },
  {
    id: 'card-1',
    type: 'bank',
    bankName: '招商银行',
    cardType: '储蓄卡',
    number: '**** 8888',
    balance: 12580.0,
    color: 'from-white to-zinc-50 border border-zinc-200',
    textColor: 'text-zinc-900',
    iconColor: 'text-zinc-900',
    theme: 'light',
    icon: 'wallet',
  },
];

export const MOCK_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 't-0',
    type: 'expense',
    title: '给宝宝买礼物',
    amount: 520.0,
    date: '刚刚',
    category: '恋爱',
    cardId: 'card-baby',
    icon: 'shopping-bag',
  },
  {
    id: 't-1',
    type: 'expense',
    title: '7-Eleven',
    amount: 25.5,
    date: '今天 08:30',
    category: '购物',
    cardId: 'card-1',
    icon: 'store',
  },
  {
    id: 't-2',
    type: 'expense',
    title: '转账给阿强',
    amount: 200.0,
    date: '昨天 19:20',
    category: '转账',
    cardId: 'card-1',
    icon: 'transfer',
  },
];

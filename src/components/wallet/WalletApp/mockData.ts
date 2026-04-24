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
];

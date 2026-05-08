import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, QrCode, ArrowLeftRight, Plus, MoreHorizontal, 
  Wallet, History, ArrowUpRight, ArrowDownLeft, Send, ScanLine,
  ChevronLeft, Bell, X, Heart, Coins, Users, Lock
} from 'lucide-react';
import { AppDataExtended, ChatHistory, WalletCard, WalletTransaction, WalletData } from '../../../types';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';

function ResolvedWalletAvatar({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) {
    return <div className={`${className} bg-zinc-200`} aria-label={alt} />;
  }

  return <img src={resolvedUrl} alt={alt} className={className} referrerPolicy="no-referrer" />;
}

// Extend the type to include chatHistory which is present in the actual appData passed
interface AppDataWithChat extends AppDataExtended {
  chatHistory: ChatHistory;
  [key: string]: any; // Allow other properties to pass through
}

// Mock Data
export const MOCK_CARDS: WalletCard[] = [
  {
    id: 'card-baby',
    type: 'bank',
    bankName: '宝宝银行',
    cardType: '亲密付',
    number: '**** 5200',
    balance: 1314.00,
    color: 'from-zinc-900 to-black border border-zinc-800',
    textColor: 'text-white',
    iconColor: 'text-yellow-500',
    theme: 'dark',
    icon: 'heart'
  },
  {
    id: 'card-1',
    type: 'bank',
    bankName: '招商银行',
    cardType: '储蓄卡',
    number: '**** 8888',
    balance: 12580.00,
    color: 'from-white to-zinc-50 border border-zinc-200',
    textColor: 'text-zinc-900',
    iconColor: 'text-zinc-900',
    theme: 'light',
    icon: 'wallet'
  }
];

export const MOCK_TRANSACTIONS: WalletTransaction[] = [];

type WalletAppProps = {
  onClose: () => void;
  appData: AppDataWithChat;
  onUpdateAppData?: (data: AppDataWithChat) => void;
};

export default function WalletApp({ onClose, appData, onUpdateAppData }: WalletAppProps) {
  const walletData: WalletData = appData.walletData || {
    balance: 12580.00,
    yuebaoBalance: 0,
    yuebaoInterest: 0,
    familyCards: [],
    paymentPassword: '',
    cards: MOCK_CARDS,
    transactions: [],
  };
  const cards = walletData.cards || MOCK_CARDS;
  const transactions = walletData.transactions ?? [];
  const balance = walletData.balance ?? 12580.00;
  const yuebaoBalance = walletData.yuebaoBalance ?? 0;
  const yuebaoInterest = walletData.yuebaoInterest ?? 0;
  const familyCards = walletData.familyCards ?? [];
  const paymentPassword = walletData.paymentPassword ?? '';

  const updateWalletData = (
    newBalance: number, 
    newCards: WalletCard[], 
    newTransactions: WalletTransaction[],
    newYuebaoBalance: number = yuebaoBalance,
    newFamilyCards: any[] = familyCards,
    newPaymentPassword: string = paymentPassword,
    newYuebaoInterest: number = yuebaoInterest
  ) => {
    if (onUpdateAppData) {
      onUpdateAppData({
        ...appData,
        walletData: {
          balance: newBalance,
          cards: newCards,
          transactions: newTransactions,
          yuebaoBalance: newYuebaoBalance,
          yuebaoInterest: newYuebaoInterest,
          familyCards: newFamilyCards,
          paymentPassword: newPaymentPassword
        }
      });
    }
  };

  const [showRecharge, setShowRecharge] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedCardForWithdraw, setSelectedCardForWithdraw] = useState<string>('');

  // New Modals State
  const [expandedSection, setExpandedSection] = useState<'yuebao' | 'family' | 'bank' | 'password' | null>(null);

  const toggleSection = (section: 'yuebao' | 'family' | 'bank' | 'password') => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  // Yu'e Bao State
  const [showYuebaoTransferIn, setShowYuebaoTransferIn] = useState(false);
  const [showYuebaoTransferOut, setShowYuebaoTransferOut] = useState(false);
  const [yuebaoAmount, setYuebaoAmount] = useState('');
  const [yuebaoTransferMethod, setYuebaoTransferMethod] = useState<string>('balance');
  
  // Family Card State
  const [familyCardCharacter, setFamilyCardCharacter] = useState('');
  const [familyCardLimit, setFamilyCardLimit] = useState('');
  const [isFamilyCardDropdownOpen, setIsFamilyCardDropdownOpen] = useState(false);

  // Bank Card State
  const [newBankName, setNewBankName] = useState('');
  const [newCardNumber, setNewCardNumber] = useState('');
  const [isAddingBankCard, setIsAddingBankCard] = useState(false);

  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const handleRecharge = () => {
    if (!rechargeAmount) return;
    const amount = parseFloat(rechargeAmount);
    if (isNaN(amount) || amount <= 0) return;

    const newBalance = balance + amount;
    const newTransaction = {
      id: `t-${Date.now()}`,
      title: '充值',
      type: 'income' as const,
      amount: amount,
      date: '刚刚',
      icon: 'income',
      category: '充值',
      cardId: 'wallet'
    };
    const newTransactions: WalletTransaction[] = [newTransaction, ...transactions];

    updateWalletData(newBalance, cards, newTransactions);

    alert(`成功充值 ￥${amount.toFixed(2)}`);
    setShowRecharge(false);
    setRechargeAmount('');
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || !selectedCardForWithdraw) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (balance < amount) {
      alert('余额不足');
      return;
    }

    const card = cards.find(c => c.id === selectedCardForWithdraw);
    if (!card) return;

    const newBalance = balance - amount;
    const newCards = cards.map(c => c.id === selectedCardForWithdraw ? { ...c, balance: c.balance + amount } : c);
    
    const newTransaction = {
      id: `t-${Date.now()}`,
      title: `提现到 ${card.bankName}`,
      type: 'expense' as const,
      amount: amount,
      date: '刚刚',
      icon: 'transfer',
      category: '提现',
      cardId: selectedCardForWithdraw
    };
    const newTransactions: WalletTransaction[] = [newTransaction, ...transactions];

    updateWalletData(newBalance, newCards, newTransactions);

    alert(`成功提现 ￥${amount.toFixed(2)} 到 ${card.bankName}`);
    setShowWithdraw(false);
    setWithdrawAmount('');
    setSelectedCardForWithdraw('');
  };

  const handleYuebaoTransferIn = () => {
    if (!yuebaoAmount) return;
    const amount = parseFloat(yuebaoAmount);
    if (isNaN(amount) || amount <= 0) return;

    let newBalance = balance;
    let newCards = [...cards];

    if (yuebaoTransferMethod === 'balance') {
      if (balance < amount) {
        alert('余额不足');
        return;
      }
      newBalance = balance - amount;
    } else {
      const cardIndex = cards.findIndex(c => c.id === yuebaoTransferMethod);
      if (cardIndex === -1) return;
      if (cards[cardIndex].balance < amount) {
        alert('银行卡余额不足');
        return;
      }
      newCards[cardIndex] = { ...cards[cardIndex], balance: cards[cardIndex].balance - amount };
    }

    const newYuebaoBalance = yuebaoBalance + amount;
    
    const newTransaction = {
      id: `t-${Date.now()}`,
      title: '转入余额宝',
      type: 'expense' as const,
      amount: amount,
      date: '刚刚',
      icon: 'transfer',
      category: '理财',
      cardId: yuebaoTransferMethod === 'balance' ? 'wallet' : yuebaoTransferMethod
    };
    
    updateWalletData(newBalance, newCards, [newTransaction, ...transactions], newYuebaoBalance);
    alert(`成功转入余额宝 ￥${amount.toFixed(2)}`);
    setYuebaoAmount('');
    setShowYuebaoTransferIn(false);
  };

  const handleYuebaoTransferOut = () => {
    if (!yuebaoAmount) return;
    const amount = parseFloat(yuebaoAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (yuebaoBalance < amount) {
      alert('余额宝余额不足');
      return;
    }

    let newBalance = balance;
    let newCards = [...cards];

    if (yuebaoTransferMethod === 'balance') {
      newBalance = balance + amount;
    } else {
      const cardIndex = cards.findIndex(c => c.id === yuebaoTransferMethod);
      if (cardIndex === -1) return;
      newCards[cardIndex] = { ...cards[cardIndex], balance: cards[cardIndex].balance + amount };
    }

    const newYuebaoBalance = yuebaoBalance - amount;
    
    const newTransaction = {
      id: `t-${Date.now()}`,
      title: '余额宝转出',
      type: 'income' as const,
      amount: amount,
      date: '刚刚',
      icon: 'transfer',
      category: '理财',
      cardId: yuebaoTransferMethod === 'balance' ? 'wallet' : yuebaoTransferMethod
    };
    
    updateWalletData(newBalance, newCards, [newTransaction, ...transactions], newYuebaoBalance);
    alert(`成功转出到${yuebaoTransferMethod === 'balance' ? '余额' : '银行卡'} ￥${amount.toFixed(2)}`);
    setYuebaoAmount('');
    setShowYuebaoTransferOut(false);
  };

  const handleCalculateInterest = () => {
    if (yuebaoBalance <= 0) {
      alert('余额宝暂无余额，无法产生收益');
      return;
    }
    // Simulate daily interest (e.g., 2% annualized, but we make it a bit visible for simulation)
    // Using a slightly higher rate for simulation purposes so users can see the change
    const simulatedInterest = Math.max(0.01, yuebaoBalance * 0.0005); 
    
    const newYuebaoBalance = yuebaoBalance + simulatedInterest;
    const newYuebaoInterest = yuebaoInterest + simulatedInterest;
    
    const newTransaction = {
      id: `t-${Date.now()}`,
      title: '余额宝收益发放',
      type: 'income' as const,
      amount: simulatedInterest,
      date: '刚刚',
      icon: 'income',
      category: '理财',
      cardId: 'wallet'
    };
    
    updateWalletData(
      balance, 
      cards, 
      [newTransaction, ...transactions], 
      newYuebaoBalance, 
      familyCards, 
      paymentPassword, 
      newYuebaoInterest
    );
    alert(`余额宝收益发放：￥${simulatedInterest.toFixed(2)}`);
  };

  const handleAddFamilyCard = () => {
    if (!familyCardCharacter || !familyCardLimit) return;
    const limit = parseFloat(familyCardLimit);
    if (isNaN(limit) || limit <= 0) return;

    const newFamilyCard = {
      id: `fc-${Date.now()}`,
      characterId: familyCardCharacter,
      limit: limit,
      spent: 0
    };

    updateWalletData(balance, cards, transactions, yuebaoBalance, [...familyCards, newFamilyCard]);
    alert(`成功赠送亲属卡给 ${familyCardCharacter}，额度 ￥${limit.toFixed(2)}`);
    setFamilyCardCharacter('');
    setFamilyCardLimit('');
  };

  const handleAddBankCard = () => {
    if (!newBankName || !newCardNumber) return;
    
    const newCard: WalletCard = {
      id: `card-${Date.now()}`,
      type: 'bank',
      bankName: newBankName,
      cardType: '储蓄卡',
      number: `**** ${newCardNumber.slice(-4)}`,
      balance: 0,
      color: 'bg-white border border-zinc-200',
      textColor: 'text-zinc-900',
      iconColor: 'text-zinc-900',
      theme: 'light',
      icon: 'wallet'
    };

    updateWalletData(balance, [newCard, ...cards], transactions);
    alert(`成功添加银行卡：${newBankName}`);
    setNewBankName('');
    setNewCardNumber('');
    setIsAddingBankCard(false);
  };

  const handleSetPassword = () => {
    if (!newPassword || newPassword.length < 6) {
      alert('密码至少需要6位');
      return;
    }
    updateWalletData(balance, cards, transactions, yuebaoBalance, familyCards, newPassword);
    alert('支付密码设置成功');
    setNewPassword('');
    setIsSettingPassword(false);
  };

  const handleClearTransactions = () => {
    if (!window.confirm('确认清空当前钱包交易记录吗？')) return;
    updateWalletData(balance, cards, [], yuebaoBalance, familyCards, paymentPassword, yuebaoInterest);
    setShowManageMenu(false);
  };

  const handleResetWallet = () => {
    if (!window.confirm('确认重置钱包到默认状态吗？这会覆盖当前余额、卡片和交易记录。')) return;
    if (onUpdateAppData) {
      onUpdateAppData({
        ...appData,
        walletData: {
          balance: 12580.0,
          yuebaoBalance: 0,
          yuebaoInterest: 0,
          familyCards: [],
          paymentPassword: '',
          cards: MOCK_CARDS,
          transactions: [],
        },
      });
    }
    setExpandedSection(null);
    setShowManageMenu(false);
  };

  const handleCollapsePanels = () => {
    setExpandedSection(null);
    setShowManageMenu(false);
  };

  // Simple grouping logic for transactions
  const groupedTransactions: { [key: string]: typeof transactions } = {};
  transactions.forEach(t => {
    let dateKey = t.date;
    if (t.date.includes('今天')) dateKey = '今天';
    else if (t.date.includes('昨天')) dateKey = '昨天';
    else if (t.date.includes('刚刚')) dateKey = '刚刚';
    else dateKey = t.date.split(' ')[0];
    
    if (!groupedTransactions[dateKey]) groupedTransactions[dateKey] = [];
    groupedTransactions[dateKey].push(t);
  });

  return (
    <div className="h-full bg-[#F2F2F7] flex flex-col relative overflow-hidden">
      {/* Header */}
      <div
        className="px-4 pb-2 flex items-center justify-between bg-[#F2F2F7]/90 backdrop-blur-md sticky top-0 z-20"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <div className="flex items-center gap-2">
          <button 
            onClick={onClose}
            className="p-1 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-zinc-900">钱包</h1>
        </div>
        <div className="relative flex gap-2">
          <button
            onClick={() => setShowManageMenu((prev) => !prev)}
            className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors"
            aria-label="钱包管理"
            title="钱包管理"
          >
            <MoreHorizontal size={20} />
          </button>
          <AnimatePresence>
            {showManageMenu && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                className="absolute right-0 top-11 z-30 min-w-[148px] rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg"
              >
                <button
                  onClick={handleCollapsePanels}
                  className="w-full rounded-xl px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100"
                >
                  收起功能区
                </button>
                <button
                  onClick={handleCalculateInterest}
                  className="w-full rounded-xl px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100"
                >
                  模拟发收益
                </button>
                <button
                  onClick={handleClearTransactions}
                  className="w-full rounded-xl px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100"
                >
                  清空交易记录
                </button>
                <button
                  onClick={handleResetWallet}
                  className="w-full rounded-xl px-3 py-2 text-left text-[13px] text-red-500 transition-colors hover:bg-red-50"
                >
                  重置钱包
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex-1 min-h-0 overflow-y-auto">
        <div className="flex min-h-full flex-col px-4 pt-2">

        {/* Balance Section */}
        <div className="bg-white rounded-xl p-5 shadow-sm mb-4 flex flex-col items-center justify-center">
          <div className="text-zinc-500 text-xs mb-1">余额</div>
          <div className="text-3xl font-bold text-zinc-900 mb-5 tracking-tight">
            <span className="text-xl mr-1">¥</span>
            {balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex w-full gap-3">
            <button 
              onClick={() => setShowRecharge(true)}
              className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              充值
            </button>
            <button 
              onClick={() => setShowWithdraw(true)}
              className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              提现
            </button>
          </div>
        </div>

        {/* Icons Row */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <div className="grid grid-cols-4 gap-2">
            <button onClick={() => toggleSection('yuebao')} className="flex flex-col items-center gap-1.5 group">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${expandedSection === 'yuebao' ? 'bg-zinc-100 text-zinc-400 shadow-sm' : 'bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200'}`}>
                <Coins size={18} />
              </div>
              <span className="text-[12px] text-zinc-600 font-medium">余额宝</span>
            </button>
            <button onClick={() => toggleSection('family')} className="flex flex-col items-center gap-1.5 group">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${expandedSection === 'family' ? 'bg-zinc-100 text-zinc-400 shadow-sm' : 'bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200'}`}>
                <Users size={18} />
              </div>
              <span className="text-[12px] text-zinc-600 font-medium">亲属卡</span>
            </button>
            <button onClick={() => toggleSection('bank')} className="flex flex-col items-center gap-1.5 group">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${expandedSection === 'bank' ? 'bg-zinc-100 text-zinc-400 shadow-sm' : 'bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200'}`}>
                <CreditCard size={18} />
              </div>
              <span className="text-[12px] text-zinc-600 font-medium">银行卡</span>
            </button>
            <button onClick={() => toggleSection('password')} className="flex flex-col items-center gap-1.5 group">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${expandedSection === 'password' ? 'bg-zinc-100 text-zinc-400 shadow-sm' : 'bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200'}`}>
                <Lock size={18} />
              </div>
              <span className="text-[12px] text-zinc-600 font-medium">支付密码</span>
            </button>
          </div>

          {/* Expanded Sections */}
          <AnimatePresence mode="wait">
            {expandedSection === 'yuebao' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-6 border-t border-zinc-100 mt-4 flex flex-col items-center">
                  <div className="text-zinc-500 text-xs mb-1">总金额</div>
                  <div className="text-2xl font-bold text-zinc-900 mb-2">¥ {yuebaoBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded-md">
                      累计收益: ¥ {yuebaoInterest.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </div>
                    {yuebaoBalance > 0 && (
                      <button 
                        onClick={handleCalculateInterest}
                        className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-2 py-1 rounded-md transition-colors active:scale-95"
                      >
                        模拟发收益
                      </button>
                    )}
                  </div>

                  <div className="flex w-full gap-3 mt-4">
                    <button onClick={() => { setYuebaoAmount(''); setYuebaoTransferMethod('balance'); setShowYuebaoTransferIn(true); }} className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium py-2.5 rounded-lg transition-colors text-sm">
                      转入
                    </button>
                    <button onClick={() => { setYuebaoAmount(''); setYuebaoTransferMethod('balance'); setShowYuebaoTransferOut(true); }} className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium py-2.5 rounded-lg transition-colors text-sm">
                      转出
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {expandedSection === 'family' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-6 border-t border-zinc-100 mt-4">
                  {familyCards.length > 0 ? (
                    <div className="space-y-3 mb-4 max-h-[200px] overflow-y-auto">
                      {familyCards.map(fc => {
                        const character = appData.characters?.find(c => c.name === fc.characterId);
                        return (
                          <div key={fc.id} className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-200 shrink-0">
                              {character?.avatar ? (
                                <ResolvedWalletAvatar value={character.avatar} alt={character.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                  <Users size={16} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm text-zinc-900 mb-0.5">赠予: {fc.characterId}</div>
                              <div className="text-xs text-zinc-500">
                                额度: ¥{fc.limit.toFixed(2)} | 已用: ¥{fc.spent.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-zinc-400">
                      <Users size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂未赠送亲属卡</p>
                    </div>
                  )}

                  <div className="border-t border-zinc-100 pt-4 mt-2 space-y-3">
                    <h4 className="text-xs font-medium text-zinc-900">赠送新亲属卡</h4>
                    <div className="relative">
                      <div 
                        onClick={() => setIsFamilyCardDropdownOpen(!isFamilyCardDropdownOpen)}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-sm text-zinc-900 flex items-center justify-between cursor-pointer focus:border-zinc-900 transition-colors"
                      >
                        {familyCardCharacter ? (
                          <div className="flex items-center gap-2">
                            <ResolvedWalletAvatar
                              value={appData.characters?.find(c => c.name === familyCardCharacter)?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${familyCardCharacter}`}
                              alt={familyCardCharacter}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                            <span>{familyCardCharacter}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500">选择角色...</span>
                        )}
                        <ChevronLeft size={16} className={`text-zinc-400 transition-transform ${isFamilyCardDropdownOpen ? 'rotate-90' : 'rotate-[-90deg]'}`} />
                      </div>
                      
                      <AnimatePresence>
                        {isFamilyCardDropdownOpen && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-1 bg-white border border-zinc-100 rounded-lg shadow-sm max-h-48 overflow-y-auto">
                              {appData.characters?.map(c => (
                                <div 
                                  key={c.id}
                                  onClick={() => {
                                    setFamilyCardCharacter(c.name);
                                    setIsFamilyCardDropdownOpen(false);
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 cursor-pointer transition-colors"
                                >
                                  <ResolvedWalletAvatar
                                    value={c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`}
                                    alt={c.name}
                                    className="w-6 h-6 rounded-full object-cover"
                                  />
                                  <span className="text-sm text-zinc-900">{c.name}</span>
                                </div>
                              ))}
                              {(!appData.characters || appData.characters.length === 0) && (
                                <div className="px-3 py-4 text-center text-sm text-zinc-500">
                                  暂无可选角色
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <input 
                      type="number"
                      value={familyCardLimit}
                      onChange={e => setFamilyCardLimit(e.target.value)}
                      placeholder="设置每月额度"
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 transition-colors"
                    />
                    <button 
                      onClick={handleAddFamilyCard}
                      disabled={!familyCardCharacter || !familyCardLimit}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-100 py-2.5 text-[14px] font-medium text-zinc-900 transition-transform active:scale-[0.98] hover:bg-zinc-200 disabled:opacity-50"
                    >
                      确认赠送
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {expandedSection === 'bank' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-6 border-t border-zinc-100 mt-4">
                  {!isAddingBankCard ? (
                    <>
                      <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-1">
                        {cards.map(card => (
                          <div key={card.id} className="bg-gradient-to-br from-zinc-800 via-zinc-900 to-black border border-zinc-700/50 rounded-xl p-5 flex flex-col gap-4 shadow-lg relative overflow-hidden">
                            {/* Decorative background elements */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl -ml-10 -mb-10 pointer-events-none"></div>
                            
                            <div className="flex justify-between items-start relative z-10">
                              <div className="text-[16px] font-bold text-zinc-100 tracking-wider">{card.bankName}</div>
                              {/* Premium Chip */}
                              <div className="w-9 h-6 rounded bg-gradient-to-br from-amber-200 via-yellow-500 to-amber-600 border border-amber-700/50 relative overflow-hidden opacity-90 shadow-sm">
                                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-amber-900/30"></div>
                                <div className="absolute top-0 left-1/3 w-[1px] h-full bg-amber-900/30"></div>
                                <div className="absolute top-0 right-1/3 w-[1px] h-full bg-amber-900/30"></div>
                                <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 border border-amber-900/30 rounded-sm"></div>
                              </div>
                            </div>
                            
                            <div className="mt-2 text-xl font-mono tracking-[0.15em] text-zinc-100 relative z-10 drop-shadow-md">
                              {card.number}
                            </div>
                            
                            <div className="flex justify-between items-end relative z-10 mt-1">
                              <div className="text-xs text-zinc-400 font-medium tracking-widest uppercase">{card.cardType}</div>
                              {/* Card Brand Logo Placeholder */}
                              <div className="flex -space-x-2 opacity-80">
                                <div className="w-6 h-6 rounded-full bg-zinc-400 mix-blend-screen"></div>
                                <div className="w-6 h-6 rounded-full bg-zinc-500 mix-blend-screen"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setIsAddingBankCard(true)} className="w-full bg-zinc-100 text-zinc-900 font-medium text-[14px] py-2.5 rounded-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                        <Plus size={16} /> 添加银行卡
                      </button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <input 
                        type="text"
                        value={newBankName}
                        onChange={e => setNewBankName(e.target.value)}
                        placeholder="银行名称 (如: 建设银行)"
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 transition-colors"
                      />
                      <input 
                        type="text"
                        value={newCardNumber}
                        onChange={e => setNewCardNumber(e.target.value)}
                        placeholder="银行卡号"
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 transition-colors"
                      />
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => setIsAddingBankCard(false)} className="flex-1 bg-zinc-100 text-zinc-900 font-medium py-2 rounded-lg">
                          取消
                        </button>
                        <button onClick={handleAddBankCard} disabled={!newBankName || !newCardNumber} className="flex-1 rounded-lg border border-zinc-200 bg-zinc-100 py-2 font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50">
                          确认添加
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {expandedSection === 'password' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-6 border-t border-zinc-100 mt-4">
                  {!isSettingPassword ? (
                    <div className="space-y-3 mb-2">
                      <div className="text-center py-2">
                        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-800 mx-auto mb-2">
                          <Lock size={24} />
                        </div>
                        <p className="text-sm text-zinc-500">
                          {paymentPassword ? '已设置支付密码' : '尚未设置支付密码'}
                        </p>
                      </div>
                      <button onClick={() => setIsSettingPassword(true)} className="w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-3 text-center text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200">
                        {paymentPassword ? '修改支付密码' : '设置支付密码'}
                      </button>
                      {paymentPassword && (
                        <button onClick={() => { alert('已发送验证码到您的手机'); setIsSettingPassword(true); }} className="w-full text-center px-3 py-3 bg-zinc-50 hover:bg-zinc-100 rounded-lg text-sm font-medium text-zinc-900 transition-colors">
                          忘记支付密码
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input 
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="输入新密码 (至少6位)"
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 transition-colors"
                      />
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => setIsSettingPassword(false)} className="flex-1 bg-zinc-100 text-zinc-900 font-medium py-2 rounded-lg">
                          取消
                        </button>
                        <button onClick={handleSetPassword} disabled={!newPassword || newPassword.length < 6} className="flex-1 rounded-lg border border-zinc-200 bg-zinc-100 py-2 font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50">
                          确认
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Transactions List */}
        <div className="flex min-h-[300px] flex-1 flex-col rounded-xl bg-white p-5 pb-[calc(var(--app-safe-area-bottom-ui,0px)+20px)] shadow-sm">
          <h3 className="font-bold text-zinc-900 text-base mb-4">支付等一些转账记录</h3>
          
          {Object.entries(groupedTransactions).length > 0 ? (
            Object.entries(groupedTransactions).map(([date, items]) => (
              <div key={date} className="mb-5 last:mb-0">
                <h4 className="text-zinc-500 text-[12px] font-medium mb-2">{date}</h4>
                <div className="space-y-0">
                  {items.map((t, i) => (
                    <div key={t.id} className="flex items-center justify-between py-3 border-b border-zinc-50 last:border-0 group active:bg-zinc-50 -mx-2 px-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-zinc-100 text-zinc-800">
                          {t.icon === 'store' && <Wallet size={16} />}
                          {t.icon === 'transfer' && <ArrowLeftRight size={16} />}
                          {t.icon === 'income' && <ArrowDownLeft size={16} />}
                          {t.icon === 'transport' && <History size={16} />}
                          {t.icon === 'food' && <ScanLine size={16} />}
                          {t.icon === 'heart' && <Heart size={16} fill="currentColor" />}
                        </div>
                        <div>
                          <div className="font-medium text-zinc-900 text-[14px] mb-0.5">{t.title}</div>
                          <div className="text-[11px] text-zinc-500">{t.category}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium text-[14px] ${t.type === 'income' ? 'text-zinc-900' : 'text-zinc-900'}`}>
                          {t.type === 'income' ? '+' : '-'} ¥{t.amount.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">{t.date.includes(' ') ? t.date.split(' ')[1] : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center text-zinc-400">
              <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <History size={24} className="opacity-50" />
              </div>
              <p className="text-sm">暂无交易记录</p>
            </div>
          )}
        </div>
        </div>

        {/* Recharge Dialog */}
        <AnimatePresence>
          {showRecharge && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-[300px] rounded-xl p-5 shadow-xl flex flex-col"
              >
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-[16px] font-bold text-zinc-900">充值</h3>
                  <button onClick={() => setShowRecharge(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">金额</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-lg font-bold text-zinc-900">¥</span>
                      <input 
                        type="number"
                        value={rechargeAmount}
                        onChange={e => setRechargeAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-lg pl-8 pr-3 py-2.5 text-[18px] font-bold text-zinc-900 outline-none focus:border-zinc-900 transition-colors placeholder:text-zinc-300"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={handleRecharge}
                      disabled={!rechargeAmount}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-100 py-2.5 text-[14px] font-medium text-zinc-900 transition-transform hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
                    >
                      确认充值
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Withdraw Dialog */}
        <AnimatePresence>
          {showWithdraw && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-[300px] rounded-xl p-5 shadow-xl flex flex-col"
              >
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-[16px] font-bold text-zinc-900">提现到银行卡</h3>
                  <button onClick={() => setShowWithdraw(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">选择银行卡</label>
                    <div className="relative">
                      <select 
                        value={selectedCardForWithdraw}
                        onChange={e => setSelectedCardForWithdraw(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2.5 text-[14px] text-zinc-900 appearance-none outline-none focus:border-zinc-900 transition-colors"
                      >
                        <option value="">请选择银行卡...</option>
                        {cards.map(card => (
                          <option key={card.id} value={card.id}>{card.bankName} ({card.number.slice(-4)})</option>
                        ))}
                      </select>
                      <ChevronLeft size={16} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-[-90deg] text-zinc-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">金额</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-lg font-bold text-zinc-900">¥</span>
                      <input 
                        type="number"
                        value={withdrawAmount}
                        onChange={e => setWithdrawAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-lg pl-8 pr-3 py-2.5 text-[18px] font-bold text-zinc-900 outline-none focus:border-zinc-900 transition-colors placeholder:text-zinc-300"
                      />
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1.5">
                      可用余额: ¥{balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={handleWithdraw}
                      disabled={!withdrawAmount || !selectedCardForWithdraw}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-100 py-2.5 text-[14px] font-medium text-zinc-900 transition-transform hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
                    >
                      确认提现
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>



        {/* Yu'e Bao Transfer In Dialog */}
        <AnimatePresence>
          {showYuebaoTransferIn && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-[300px] rounded-xl p-5 shadow-xl flex flex-col"
              >
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-[16px] font-bold text-zinc-900">转入余额宝</h3>
                  <button onClick={() => setShowYuebaoTransferIn(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">付款方式</label>
                    <div className="relative">
                      <select 
                        value={yuebaoTransferMethod}
                        onChange={e => setYuebaoTransferMethod(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2.5 text-[14px] text-zinc-900 appearance-none outline-none focus:border-zinc-900 transition-colors"
                      >
                        <option value="balance">账户余额 (¥{balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })})</option>
                        {cards.map(card => (
                          <option key={card.id} value={card.id}>{card.bankName} ({card.number.slice(-4)})</option>
                        ))}
                      </select>
                      <ChevronLeft size={16} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-[-90deg] text-zinc-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">转入金额</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-lg font-bold text-zinc-900">¥</span>
                      <input 
                        type="number"
                        value={yuebaoAmount}
                        onChange={e => setYuebaoAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-lg pl-8 pr-3 py-2.5 text-[18px] font-bold text-zinc-900 outline-none focus:border-zinc-900 transition-colors placeholder:text-zinc-300"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={handleYuebaoTransferIn}
                      disabled={!yuebaoAmount}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-100 py-2.5 text-[14px] font-medium text-zinc-900 transition-transform hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
                    >
                      确认转入
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Yu'e Bao Transfer Out Dialog */}
        <AnimatePresence>
          {showYuebaoTransferOut && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-[300px] rounded-xl p-5 shadow-xl flex flex-col"
              >
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-[16px] font-bold text-zinc-900">转出到</h3>
                  <button onClick={() => setShowYuebaoTransferOut(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">收款账户</label>
                    <div className="relative">
                      <select 
                        value={yuebaoTransferMethod}
                        onChange={e => setYuebaoTransferMethod(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2.5 text-[14px] text-zinc-900 appearance-none outline-none focus:border-zinc-900 transition-colors"
                      >
                        <option value="balance">账户余额</option>
                        {cards.map(card => (
                          <option key={card.id} value={card.id}>{card.bankName} ({card.number.slice(-4)})</option>
                        ))}
                      </select>
                      <ChevronLeft size={16} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-[-90deg] text-zinc-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">转出金额</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-lg font-bold text-zinc-900">¥</span>
                      <input 
                        type="number"
                        value={yuebaoAmount}
                        onChange={e => setYuebaoAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-lg pl-8 pr-3 py-2.5 text-[18px] font-bold text-zinc-900 outline-none focus:border-zinc-900 transition-colors placeholder:text-zinc-300"
                      />
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1.5">
                      可转出余额: ¥{yuebaoBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={handleYuebaoTransferOut}
                      disabled={!yuebaoAmount}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-100 py-2.5 text-[14px] font-medium text-zinc-900 transition-transform hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
                    >
                      确认转出
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

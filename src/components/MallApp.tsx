import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, Search, Heart, Share2, ChevronLeft, 
  Star, CreditCard, CheckCircle2, X, Users, MessageSquare
} from 'lucide-react';
import { Character, WalletCard, WalletTransaction } from '../types';

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  rating: number;
  sales: number;
  category: string;
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: '草莓奶油蛋糕',
    price: 52.0,
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=500&auto=format&fit=crop&q=60',
    description: '新鲜草莓配上丝滑奶油，每一口都是幸福的味道。',
    rating: 4.9,
    sales: 1200,
    category: '美食'
  },
  {
    id: 'p2',
    name: '永生花礼盒',
    price: 299.0,
    image: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=500&auto=format&fit=crop&q=60',
    description: '象征永恒的爱，精选优质玫瑰，手工打造。',
    rating: 4.8,
    sales: 500,
    category: '礼品'
  },
  {
    id: 'p3',
    name: '简约陶瓷杯',
    price: 35.0,
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fbed20?w=500&auto=format&fit=crop&q=60',
    description: '极简设计，磨砂质感，让喝水也变得优雅。',
    rating: 4.7,
    sales: 3500,
    category: '家居'
  },
  {
    id: 'p4',
    name: '复古黑胶唱片机',
    price: 899.0,
    image: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500&auto=format&fit=crop&q=60',
    description: '重拾经典的旋律，感受黑胶的独特魅力。',
    rating: 4.9,
    sales: 150,
    category: '数码'
  },
  {
    id: 'p5',
    name: '手工编织围巾',
    price: 128.0,
    image: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=500&auto=format&fit=crop&q=60',
    description: '温暖的不仅是身体，更是心意。',
    rating: 4.6,
    sales: 800,
    category: '服饰'
  },
  {
    id: 'p6',
    name: '香薰蜡烛套装',
    price: 158.0,
    image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=500&auto=format&fit=crop&q=60',
    description: '舒缓压力，营造浪漫氛围，多种香型可选。',
    rating: 4.8,
    sales: 2100,
    category: '家居'
  }
];

interface MallAppProps {
  onClose: () => void;
  appData: any;
  onUpdateAppData: (data: any) => void;
}

export default function MallApp({ onClose, appData, onUpdateAppData }: MallAppProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const walletCards = appData.walletData?.cards || [];
  const characters = appData.characters || [];

  const handlePurchase = () => {
    if (!selectedProduct || !selectedCardId) return;

    const card = walletCards.find((c: WalletCard) => c.id === selectedCardId);
    if (!card) return;

    if (card.balance < selectedProduct.price) {
      alert('余额不足，请选择其他卡片或充值');
      return;
    }

    const newCards = walletCards.map((c: WalletCard) => 
      c.id === selectedCardId ? { ...c, balance: c.balance - selectedProduct.price } : c
    );

    const newTransaction: WalletTransaction = {
      id: `t-mall-${Date.now()}`,
      title: `购买 ${selectedProduct.name}`,
      type: 'expense',
      amount: selectedProduct.price,
      date: '刚刚',
      icon: 'store',
      category: '购物',
      cardId: selectedCardId
    };

    const newTransactions = [newTransaction, ...(appData.walletData?.transactions || [])];

    onUpdateAppData({
      ...appData,
      walletData: {
        ...appData.walletData,
        cards: newCards,
        transactions: newTransactions
      }
    });

    setPaymentSuccess(true);
    setTimeout(() => {
      setPaymentSuccess(false);
      setShowPayModal(false);
    }, 2000);
  };

  const handleShare = (characterId: string) => {
    if (!selectedProduct) return;

    const character = characters.find((c: Character) => c.id === characterId);
    if (!character) return;

    const newHistory = { ...appData.chatHistory };
    const chatKey = character.id;
    const currentChat = newHistory[chatKey] || [];

    const shareMsg = {
      role: 'user' as const,
      text: `[分享商品: ${selectedProduct.name}] 我觉得这个很适合你，要不要看看？\n价格: ￥${selectedProduct.price.toFixed(2)}`,
      timestamp: Date.now(),
      metadata: {
        type: 'product_share',
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productImage: selectedProduct.image,
        productPrice: selectedProduct.price
      }
    };

    newHistory[chatKey] = [...currentChat, shareMsg];

    onUpdateAppData({
      ...appData,
      chatHistory: newHistory
    });

    alert(`已分享给 ${character.name}`);
    setShowShareModal(false);
  };

  return (
    <div className="h-full bg-zinc-100 flex flex-col relative overflow-hidden font-sans">
      {/* Taobao-style Header */}
      <div className="px-4 pt-4 pb-2 bg-orange-500 z-20">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-white">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 bg-white/20 rounded-full px-4 py-2 flex items-center gap-2 text-white/80">
            <Search size={18} />
            <span className="text-sm">搜索商品、店铺</span>
          </div>
          <button className="text-white">
            <ShoppingBag size={24} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Banner */}
        <div className="bg-orange-500 h-32 px-4 pb-4">
          <div className="w-full h-full bg-white/20 rounded-xl flex items-center justify-center text-white font-bold">
            淘宝风格轮播图区域
          </div>
        </div>

        {/* Categories Grid */}
        <div className="bg-white mx-4 -mt-4 rounded-xl p-4 grid grid-cols-4 gap-4 shadow-sm">
          {['天猫', '聚划算', '天猫超市', '充值中心', '机票酒店', '金币庄园', '阿里拍卖', '分类'].map((cat, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-xs">
                {cat[0]}
              </div>
              <span className="text-xs text-zinc-600">{cat}</span>
            </div>
          ))}
        </div>

        {/* Product Grid */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {MOCK_PRODUCTS.map(product => (
            <motion.div 
              key={product.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedProduct(product)}
              className="bg-white rounded-xl overflow-hidden shadow-sm flex flex-col"
            >
              <div className="aspect-square relative">
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="p-2 flex-1 flex flex-col">
                <h3 className="text-sm text-zinc-800 line-clamp-2">{product.name}</h3>
                <div className="mt-auto pt-2 flex items-center justify-between">
                  <span className="text-lg font-bold text-orange-600">￥{product.price.toFixed(2)}</span>
                  <span className="text-xs text-zinc-400">{product.sales}人付款</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Product Detail Modal (Same as before) */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 bg-white z-[100] flex flex-col"
          >
            <div className="relative h-[40vh]">
              <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 left-4 p-2 bg-black/20 backdrop-blur-md text-white rounded-full hover:bg-black/40 transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={() => setShowShareModal(true)}
                  className="p-2 bg-black/20 backdrop-blur-md text-white rounded-full hover:bg-black/40 transition-colors"
                >
                  <Share2 size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              <div className="text-3xl font-bold text-orange-600">￥{selectedProduct.price.toFixed(2)}</div>
              <h2 className="text-xl font-bold text-zinc-900 mt-2">{selectedProduct.name}</h2>
              <p className="text-zinc-600 mt-4 leading-relaxed">{selectedProduct.description}</p>
            </div>

            <div className="p-4 bg-white border-t border-zinc-100 flex gap-2">
              <button 
                onClick={() => setShowShareModal(true)}
                className="flex-1 py-3 px-4 rounded-full border border-zinc-200 font-bold text-zinc-900 flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Share2 size={18} />
                分享
              </button>
              <button 
                onClick={() => setShowPayModal(true)}
                className="flex-[2] py-3 px-4 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
              >
                <CreditCard size={18} />
                立即购买
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal (Same as before) */}
      <AnimatePresence>
        {showPayModal && (
          <div className="absolute inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full rounded-t-[32px] p-6 pb-10 shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-zinc-900">确认付款</h3>
                <button onClick={() => setShowPayModal(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X size={24} />
                </button>
              </div>

              {paymentSuccess ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10">
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4"
                  >
                    <CheckCircle2 size={48} />
                  </motion.div>
                  <h4 className="text-xl font-bold text-zinc-900">支付成功</h4>
                  <p className="text-zinc-500 mt-1">商品将尽快为您送达</p>
                </div>
              ) : (
                <>
                  <div className="text-center py-6">
                    <div className="text-sm text-zinc-500 mb-1">支付金额</div>
                    <div className="text-4xl font-bold text-zinc-900">￥{selectedProduct?.price.toFixed(2)}</div>
                  </div>

                  <div className="mt-4 flex-1 overflow-y-auto space-y-3">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">选择支付卡片</div>
                    {walletCards.map((card: WalletCard) => (
                      <button 
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${selectedCardId === card.id ? 'border-orange-500 bg-orange-50' : 'border-zinc-100 hover:border-zinc-200'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${card.color} flex items-center justify-center text-white`}>
                            <CreditCard size={20} />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-zinc-900">{card.bankName}</div>
                            <div className="text-xs text-zinc-500">余额: ￥{card.balance.toFixed(2)}</div>
                          </div>
                        </div>
                        {selectedCardId === card.id && <CheckCircle2 size={20} className="text-orange-500" />}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={handlePurchase}
                    disabled={!selectedCardId || (walletCards.find((c: any) => c.id === selectedCardId)?.balance || 0) < (selectedProduct?.price || 0)}
                    className="mt-8 w-full py-4 rounded-full bg-orange-500 text-white font-bold shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                  >
                    立即支付
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Modal (Same as before) */}
      <AnimatePresence>
        {showShareModal && (
          <div className="absolute inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full rounded-t-[32px] p-6 pb-10 shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-zinc-900">分享商品</h3>
                <button onClick={() => setShowShareModal(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X size={24} />
                </button>
              </div>

              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex gap-3 mb-6">
                <img src={selectedProduct?.image} className="w-16 h-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
                <div>
                  <div className="font-bold text-zinc-900 line-clamp-1">{selectedProduct?.name}</div>
                  <div className="text-sm text-zinc-500 mt-1">￥{selectedProduct?.price.toFixed(2)}</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1 mb-2">选择分享对象</div>
                {characters.map((char: Character) => (
                  <button 
                    key={char.id}
                    onClick={() => handleShare(char.id)}
                    className="w-full p-3 rounded-2xl hover:bg-zinc-50 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <img src={char.avatar} className="w-12 h-12 rounded-full object-cover border border-zinc-100" referrerPolicy="no-referrer" />
                      <div className="text-left">
                        <div className="font-bold text-zinc-900">{char.name}</div>
                        <div className="text-xs text-zinc-500 line-clamp-1">{char.setting}</div>
                      </div>
                    </div>
                    <div className="p-2 bg-zinc-100 text-zinc-400 rounded-full group-hover:bg-orange-500 group-hover:text-white transition-colors">
                      <MessageSquare size={18} />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

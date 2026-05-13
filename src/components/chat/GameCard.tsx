import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Zap, MessageCircle, HelpCircle, X } from 'lucide-react';

interface GameCardProps {
  data: {
    game: 'qna' | 'tod' | 'blocks';
    type: 'question' | 'answer' | 'truth' | 'dare' | 'request_question' | 'result';
    question?: string; // For QnA
    content: string;
  };
  isUser: boolean;
  disabled?: boolean;
  translation?: string;
}

export const GameCard: React.FC<GameCardProps> = React.memo(function GameCard({ data, isUser, disabled, translation }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const normalizedTranslation = (translation || '').trim();
  const translationSegments = normalizedTranslation
    .split('---')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const frontTranslation = data.question
    ? (translationSegments.length > 1 ? translationSegments[0] : '')
    : normalizedTranslation;
  const backTranslation = data.question
    ? (translationSegments.length > 1
      ? translationSegments[translationSegments.length - 1]
      : normalizedTranslation)
    : normalizedTranslation;

  const getIcon = () => {
    if (data.game === 'qna') return <Heart size={16} className="text-pink-500 fill-pink-500" />;
    if (data.game === 'blocks') return <Zap size={16} className="text-amber-500 fill-amber-500" />;
    if (data.type === 'truth') return <MessageCircle size={16} className="text-blue-500 fill-blue-500" />;
    if (data.type === 'dare') return <Zap size={16} className="text-red-500 fill-red-500" />;
    return <HelpCircle size={16} className="text-purple-500" />;
  };

  const getTitle = () => {
    if (data.game === 'qna') return '情侣快问快答';
    if (data.game === 'tod') return '真心话大冒险';
    if (data.game === 'blocks') return '抽积木';
    return '小游戏';
  };

  const getLabel = () => {
    if (data.game === 'qna') {
      if (data.type === 'request_question') return '邀请提问';
      return data.type === 'question' ? '提问' : '回答';
    }
    if (data.game === 'blocks') return '对局结果';
    if (data.type === 'truth') return data.question ? '真心话回答' : '真心话';
    if (data.type === 'dare') return data.question ? '大冒险回应' : '大冒险';
    return '';
  };

  const getGradient = () => {
    if (data.game === 'qna') return 'bg-gradient-to-br from-pink-50 to-rose-100 border-pink-200';
    if (data.game === 'blocks') return 'bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200';
    if (data.type === 'truth') return 'bg-white border-blue-100 shadow-sm';
    if (data.type === 'dare') return 'bg-white border-orange-100 shadow-sm';
    return 'bg-white border-purple-100 shadow-sm';
  };

  const transferRegex = /\[[^\]]*?转账[^\]]*?([\d\.]+)\]/;
  const transferMatch = data.content.match(transferRegex);
  const cleanContent = data.content.replace(transferRegex, '').trim();
  const transferAmount = transferMatch ? transferMatch[1] : null;

  const isLongContent = cleanContent.length > 60;

  return (
    <>
      <div 
        className="relative w-64 h-40 cursor-pointer group perspective-1000" 
        onClick={(e) => {
          if (disabled) return;
          e.stopPropagation();
          setIsFlipped(!isFlipped);
        }}
        style={{ perspective: '1000px' }}
      >
        <motion.div
          className="w-full h-full relative preserve-3d transition-all duration-500"
          initial={false}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div 
            className={`absolute inset-0 w-full h-full rounded-xl border shadow-sm p-4 flex flex-col justify-between backface-hidden ${getGradient()}`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white/80 rounded-full flex items-center justify-center shadow-sm backdrop-blur-sm">
                  {React.cloneElement(getIcon() as React.ReactElement<{ size?: number }>, { size: 18 })}
                </div>
                <span className="text-xs font-bold text-zinc-700 opacity-80">{getTitle()}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-white/60 rounded-full text-zinc-600 backdrop-blur-sm">
                {getLabel()}
              </span>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center text-center px-1">
              <p className="font-bold text-sm text-zinc-800 line-clamp-3 leading-relaxed">
                {data.question ? data.question : cleanContent}
              </p>
              {frontTranslation && (
                <p className="font-medium text-[10px] text-zinc-500 line-clamp-2 leading-relaxed mt-1">
                  {frontTranslation}
                </p>
              )}
              {transferAmount && (
                <div className="mt-2 bg-orange-500/10 px-2 py-0.5 rounded text-[10px] font-bold text-orange-600 flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-orange-500 flex items-center justify-center text-white text-[8px]">¥</span>
                  转账 {transferAmount}
                </div>
              )}
            </div>

            <div className="text-center text-[10px] text-zinc-500 opacity-60 font-medium">
              点击翻转查看{data.question ? '答案' : '详情'}
            </div>
          </div>

          {/* Back */}
          <div 
            className="absolute inset-0 w-full h-full rounded-xl border border-zinc-200 shadow-sm bg-white p-5 flex flex-col justify-center items-center text-center backface-hidden rotate-y-180"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)' 
            }}
          >
            <div className="w-8 h-8 bg-zinc-50 rounded-full flex items-center justify-center mb-2 text-zinc-400">
              {data.game === 'qna' ? <Heart size={18} /> : <Zap size={18} />}
            </div>
            <div className="text-[10px] text-zinc-400 mb-1 font-medium">
              {data.question ? 'TA的回答' : '内容详情'}
            </div>
            <p 
              className="font-bold text-zinc-800 text-sm leading-relaxed line-clamp-4 cursor-pointer hover:opacity-80"
              onClick={(e) => {
                e.stopPropagation();
                setIsModalOpen(true);
              }}
            >
              {cleanContent}
            </p>
            {backTranslation && (
              <p className="font-medium text-[10px] text-zinc-500 line-clamp-2 leading-relaxed mt-1">
                {backTranslation}
              </p>
            )}
            {transferAmount && (
              <div className="mt-1 bg-orange-50 text-orange-600 text-[10px] px-2 py-0.5 rounded font-medium">
                [转账 ¥{transferAmount}]
              </div>
            )}
            <div className="text-[10px] text-zinc-400 mt-1 opacity-60">点击查看详情</div>
          </div>
        </motion.div>
      </div>

      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50" 
              onClick={() => setIsModalOpen(false)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl p-5 w-[85vw] max-w-[320px] shadow-2xl max-h-[60vh] overflow-y-auto relative flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 border-b border-zinc-50 z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-500 shadow-sm">
                      {React.cloneElement(getIcon() as React.ReactElement<{ size?: number }>, { size: 18 })}
                    </div>
                    <h3 className="font-bold text-base text-zinc-800">{getLabel()}</h3>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-zinc-100 rounded-full transition-colors"
                  >
                    <X size={18} className="text-zinc-400" />
                  </button>
                </div>
                <div className="prose prose-zinc max-w-none flex-1 overflow-y-auto custom-scrollbar">
                  <p className="text-zinc-800 leading-relaxed whitespace-pre-wrap text-sm font-medium text-center px-2">
                    {cleanContent}
                  </p>
                  {backTranslation && (
                    <div className="mt-4 pt-4 border-t border-zinc-100 px-2">
                      <p className="text-zinc-500 leading-relaxed whitespace-pre-wrap text-xs font-medium text-center">
                        {backTranslation}
                      </p>
                    </div>
                  )}
                  {transferAmount && (
                    <div className="mt-4 mx-4 bg-[#FA9D3B] rounded-xl p-3 flex items-center gap-3 text-white shadow-sm">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                        <span className="font-bold text-lg">¥</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-lg">¥{transferAmount}</span>
                        <span className="text-xs opacity-90">转账给你</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-50 text-center">
                  <span className="text-[10px] text-zinc-300 font-medium">
                    {getTitle()}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.getElementById('phone-container') || document.body
      )}
    </>
  );
});

GameCard.displayName = 'GameCard';


import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Character } from '../../types';
import { Heart, ArrowRight, CheckCircle2, HelpCircle } from 'lucide-react';

interface CouplesQnAProps {
  character: Character;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

const QUESTIONS = [
  "如果可以拥有一项超能力，你希望是什么？",
  "你最喜欢我穿哪件衣服？",
  "描述一下你心目中完美的周末是怎么样的？",
  "我们第一次约会时，你心里在想什么？",
  "你觉得我最可爱的一个小动作是什么？",
  "如果我们要养一只宠物，你想养什么？",
  "你最想和我一起完成的一件事是什么？",
  "你觉得我们最互补的地方在哪里？",
  "如果有一天我们吵架了，你希望我怎么哄你？",
  "你觉得我做的哪道菜最好吃？",
  "你觉得我们之间最搞笑的一次经历是什么？",
  "如果我们要一起去一个无人岛，你会带哪三样东西？",
  "现在如果只能选一个，你想先抱我还是先亲我？",
  "你先说，你刚刚看我的眼神是不是不太单纯？",
  "我要是现在靠近你，你会躲还是会配合？",
  "你觉得今晚我们俩，谁会先忍不住想贴近一点？",
  "你来选，你更想让我哄你，还是让我撩你？",
  "你老实说，你更想看我脸红，还是更想把我逗脸红？",
  "现在给你一次机会，你最想对我做的亲密小动作是什么？",
  "你猜我现在更想抱你，还是更想逗你？",
  "你选一个，以后见面先牵手，还是先抱一下？",
  "如果我突然凑近，你第一反应会是什么？",
  "你觉得是你比较会撩，还是我比较会接招？",
  "你要不要承认，其实你挺享受我故意靠近你的？",
  "你更喜欢我主动黏你，还是故意吊你一下？",
  "如果现在只能说一句暧昧的话，你会对我说什么？",
  "我们两个里面，谁更像表面正经心里不正经？",
  "你觉得我最会勾你的那个瞬间是什么？",
  "现在互相说一个最想对对方做的小动作，谁先来？",
  "你选吧，你想让我坐你旁边，还是直接靠你身上？",
  "你觉得我们对视几秒开始会有点危险？",
  "如果现在必须贴贴十秒，你觉得谁先顶不住？",
  "你先说一个我最让你有安全感的瞬间。",
  "说完换我，我也说一个你让我安心的时候。",
  "你觉得我最像“自己人”的时候是什么时候？",
  "如果今天心情不好，你最想让我怎么陪你？",
  "你更喜欢我安静陪着你，还是一直哄着你？",
  "你说一个你希望我永远记得的小习惯。",
  "我也说一个我最想保留的我们的习惯。",
  "你觉得我做过最让你心软的一件事是什么？",
  "你最喜欢我哪种偏爱你的方式？",
  "如果今天只能听一句话，你最想听我说什么？",
  "你觉得我们之间最珍贵的默契是什么？",
  "你更喜欢我在你累的时候抱你，还是逗你开心？",
  "你最希望我在什么时候坚定站你这边？",
  "你先讲一个你被我治愈到的瞬间。",
  "换我讲一个你让我很想珍惜的瞬间。",
  "你觉得我什么时候最像在认真爱你？",
  "如果你不开心，你希望我先问原因，还是先抱你？",
  "你最喜欢我对你说“没事有我在”的哪种感觉？",
  "你有没有哪一刻突然觉得，还好是我？",
  "你觉得我做什么最像偏爱，不是礼貌，是偏爱？",
  "你先说一个你最舍不得我的瞬间。",
  "我也说一个我最舍不得你的瞬间。",
  "你觉得我最需要被哄的时候是什么样子？",
  "那你最想被我哄的时候又是什么样子？",
  "你选一个，你更想被我懂，还是被我宠？",
  "你觉得我最不说但其实最在乎你的表现是什么？",
  "你希望我以后多做一件什么小事，让你更暖？",
  "我也想知道，你愿意为我多做一件什么小事？",
  "你最喜欢我们俩待在一起时哪种平静感？",
  "如果以后每次见面都有一个固定动作，你想是什么？",
  "你有没有一个只想跟我做的普通小事？",
  "你最想和我慢慢养成什么习惯？",
  "你觉得我们最适合一起过哪种平凡的一天？",
  "你最想让我记住你的哪一种脆弱？",
  "你觉得我最值得被爱的地方是什么？",
  "你也说一个你觉得自己值得被我爱的地方。",
  "如果我有点累了，你最想怎么安慰我？",
  "如果你累了，你希望我怎么接住你？",
  "你最想把哪种温柔留给我？",
  "你觉得“被爱着”的感觉，在我这里像什么？"
];

export const CouplesQnA: React.FC<CouplesQnAProps> = ({ character, onClose, onSendToChat }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [shuffledQuestions] = useState(() => [...QUESTIONS].sort(() => Math.random() - 0.5));

  const handleNext = () => {
    setDirection(1);
    if (currentIndex < shuffledQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handleShare = () => {
    const question = shuffledQuestions[currentIndex];
    const data = {
      game: 'qna',
      type: 'question',
      content: question
    };
    onSendToChat(`[GAME_CARD] ${JSON.stringify(data)}`);
    onClose();
  };

  return (
    <div className="flex flex-col items-center w-full h-full py-2">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-pink-500 flex items-center justify-center gap-2">
          <Heart className="fill-pink-500 animate-pulse" size={20} />
          情侣快问快答
        </h3>
        <p className="text-pink-300 text-xs mt-1 font-medium tracking-wider">
          TOPIC {currentIndex + 1} / {shuffledQuestions.length}
        </p>
      </div>

      <div className="relative w-full max-w-[260px] aspect-[3/4] mb-6 perspective-1000">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={{
              enter: (direction: number) => ({
                x: direction > 0 ? 300 : -300,
                opacity: 0,
                rotate: direction > 0 ? 15 : -15,
                scale: 0.8
              }),
              center: {
                zIndex: 1,
                x: 0,
                opacity: 1,
                rotate: 0,
                scale: 1
              },
              exit: (direction: number) => ({
                zIndex: 0,
                x: direction < 0 ? 300 : -300,
                opacity: 0,
                rotate: direction < 0 ? 15 : -15,
                scale: 0.8
              })
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 200, damping: 25 },
              opacity: { duration: 0.2 },
              rotate: { duration: 0.3 }
            }}
            className="absolute inset-0"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = offset.x;
              if (swipe < -50 || swipe > 50) {
                handleNext();
              }
            }}
          >
            <div className="w-full h-full bg-gradient-to-br from-pink-500 to-rose-400 rounded-3xl shadow-2xl p-1.5 flex flex-col transform transition-transform hover:scale-[1.02] duration-300 cursor-grab active:cursor-grabbing">
              <div className="flex-1 bg-white/95 backdrop-blur-sm rounded-[20px] p-6 flex flex-col items-center justify-center text-center relative overflow-hidden border border-white/50">
                <Heart className="absolute text-pink-50 opacity-30 w-32 h-32 -bottom-6 -right-6 transform rotate-12" />
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-200 via-pink-400 to-pink-200 opacity-50" />
                
                <div className="relative z-10 w-full">
                  <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-6 text-pink-500">
                    <span className="font-serif font-bold italic text-lg">Q</span>
                  </div>
                  <h4 className="text-lg font-bold text-zinc-800 leading-relaxed tracking-tight px-2">
                    {shuffledQuestions[currentIndex]}
                  </h4>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        
        {/* Stack Effect */}
        <div className="absolute inset-0 bg-white border border-pink-100 rounded-3xl transform translate-y-3 scale-95 -z-10 shadow-lg opacity-60" />
        <div className="absolute inset-0 bg-white border border-pink-50 rounded-3xl transform translate-y-6 scale-90 -z-20 shadow-md opacity-30" />
      </div>

      <div className="flex items-center gap-3 w-full max-w-[260px] px-2">
        <button
          onClick={handleNext}
          className="flex-1 py-2 bg-white border border-zinc-200 hover:border-pink-300 hover:bg-pink-50 text-zinc-600 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-sm group h-11"
        >
          <ArrowRight size={14} className="group-hover:rotate-180 transition-transform duration-500 text-pink-400" />
          <span className="text-[9px]">换一题</span>
        </button>
        
        <button
          onClick={() => {
            const data = {
              game: 'qna',
              type: 'request_question',
              content: '轮到你了，你来问我一个问题吧！'
            };
            onSendToChat(`[GAME_CARD] ${JSON.stringify(data)}`);
            onClose();
          }}
          className="flex-1 py-2 bg-white border border-zinc-200 hover:border-purple-300 hover:bg-purple-50 text-zinc-600 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-sm group h-11"
        >
          <HelpCircle size={14} className="text-purple-400" />
          <span className="text-[9px]">让TA问</span>
        </button>

        <button
          onClick={handleShare}
          className="flex-[1.5] py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-lg shadow-pink-500/30 hover:shadow-pink-500/40 hover:brightness-110 h-11"
        >
          <CheckCircle2 size={14} />
          <span className="text-[9px]">去回答</span>
        </button>
      </div>
    </div>
  );
};

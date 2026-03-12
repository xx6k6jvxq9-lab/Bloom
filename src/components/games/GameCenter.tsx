import React, { useState } from 'react';
import { X, Gamepad2, Trophy, ArrowRight, Grid3X3, Zap, Brain, LayoutGrid, Circle, Swords, Sword } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Character } from '../../types';
import { RockPaperScissors } from './RockPaperScissors';
import { SnakeGame } from './SnakeGame';
import { Gomoku } from './Gomoku';
import { CardDuel } from './CardDuel';
import { LinkUpGame } from './LinkUpGame';
import { TruthOrDare } from './TruthOrDare';
import { CouplesQnA } from './CouplesQnA';

interface GameCenterProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  onSendToChat: (text: string) => void;
}

const GAMES = [
  {
    id: 'rps',
    title: '猜拳游戏',
    description: '经典的石头剪刀布，看看谁的运气更好！',
    icon: '✌️',
    color: 'bg-blue-500'
  },
  {
    id: 'truth_or_dare',
    title: '真心话大冒险',
    description: '刺激的真心话大冒险，敢不敢来挑战？',
    icon: '🎭',
    color: 'bg-orange-500'
  },
  {
    id: 'couples_qna',
    title: '情侣快问快答',
    description: '增进感情的快问快答，看看你们有多默契！',
    icon: '💖',
    color: 'bg-pink-500'
  },
  {
    id: 'snake',
    title: '贪吃蛇大作战',
    description: '经典的贪吃蛇游戏，挑战最高分！',
    icon: <Zap size={24} className="text-white" />,
    color: 'bg-emerald-500'
  },
  {
    id: 'gomoku',
    title: '五子棋',
    description: '经典的策略博弈，挑战你的大局观！',
    icon: <Circle size={24} className="text-white" />,
    color: 'bg-zinc-800'
  },
  {
    id: 'cardduel',
    title: '卡牌对决',
    description: '简单的卡牌比大小，看看谁能笑到最后！',
    icon: <Swords size={24} className="text-white" />,
    color: 'bg-red-500'
  },
  {
    id: 'linkup',
    title: '连连看',
    description: '经典的连连看游戏，和我一起找出所有配对！',
    icon: <Grid3X3 size={24} className="text-white" />,
    color: 'bg-emerald-600'
  }
];

export const GameCenter: React.FC<GameCenterProps> = ({
  isOpen,
  onClose,
  character,
  onSendToChat
}) => {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const handleBack = () => {
    setSelectedGame(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="w-full bg-white rounded-t-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto min-h-[50vh]"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
                <Gamepad2 className="text-purple-500 fill-purple-500" size={24} />
                {selectedGame ? GAMES.find(g => g.id === selectedGame)?.title : '游戏中心'}
              </h2>
              <button 
                onClick={onClose}
                className="p-2 bg-zinc-100 rounded-full text-zinc-500 hover:bg-zinc-200"
              >
                <X size={20} />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {!selectedGame ? (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex gap-4 overflow-x-auto pb-4"
                >
                  {GAMES.map((game) => (
                    <button
                      key={game.id}
                      onClick={() => setSelectedGame(game.id)}
                      className="flex-shrink-0 w-48 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:bg-zinc-100 active:scale-[0.98] transition-all text-left group flex flex-col"
                    >
                      <div className={`w-12 h-12 ${game.color} rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-blue-500/20 mb-3`}>
                        {typeof game.icon === 'string' ? game.icon : game.icon}
                      </div>
                      <div className="flex-1 mb-3">
                        <h3 className="font-bold text-zinc-800 mb-1">{game.title}</h3>
                        <p className="text-xs text-zinc-500 line-clamp-2">{game.description}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-zinc-400 group-hover:text-purple-500 transition-colors self-end">
                        <ArrowRight size={16} />
                      </div>
                    </button>
                  ))}
                  
                  <div className="flex-shrink-0 w-48 p-4 rounded-2xl border border-dashed border-zinc-300 flex flex-col items-center justify-center text-zinc-400 gap-2 min-h-[100px]">
                    <Gamepad2 size={24} className="opacity-50" />
                    <span className="text-xs">更多游戏开发中...</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="game"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <button 
                    onClick={handleBack}
                    className="mb-4 text-sm text-zinc-500 flex items-center gap-1 hover:text-zinc-800"
                  >
                    ← 返回游戏列表
                  </button>
                  
                  {selectedGame === 'rps' && (
                    <RockPaperScissors 
                      character={character} 
                      onClose={onClose}
                      onSendToChat={onSendToChat}
                    />
                  )}
                  {selectedGame === 'truth_or_dare' && (
                    <TruthOrDare
                      character={character}
                      onClose={onClose}
                      onSendToChat={onSendToChat}
                    />
                  )}
                  {selectedGame === 'couples_qna' && (
                    <CouplesQnA
                      character={character}
                      onClose={onClose}
                      onSendToChat={onSendToChat}
                    />
                  )}
                  {selectedGame === 'snake' && (
                    <SnakeGame
                      character={character}
                      onClose={onClose}
                      onSendToChat={onSendToChat}
                    />
                  )}
                  {selectedGame === 'gomoku' && (
                    <Gomoku
                      character={character}
                      onClose={onClose}
                      onSendToChat={onSendToChat}
                    />
                  )}
                  {selectedGame === 'cardduel' && (
                    <CardDuel
                      character={character}
                      onClose={onClose}
                      onSendToChat={onSendToChat}
                    />
                  )}
                  {selectedGame === 'linkup' && (
                    <LinkUpGame
                      character={character}
                      onClose={onClose}
                      onSendToChat={onSendToChat}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

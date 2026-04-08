import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, MessageSquare, Swords } from 'lucide-react';
import { Character } from '../../types';

interface CardDuelProps {
  character: Character;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

interface Card {
  id: number;
  value: number;
  suit: string;
}

const SUITS = ['♠️', '♥️', '♣️', '♦️'];

export const CardDuel: React.FC<CardDuelProps> = ({ character, onClose, onSendToChat }) => {
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [aiHand, setAiHand] = useState<Card[]>([]);
  const [playerPlayed, setPlayerPlayed] = useState<Card | null>(null);
  const [aiPlayed, setAiPlayed] = useState<Card | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [round, setRound] = useState(1);
  const [gameState, setGameState] = useState<'playing' | 'roundResult' | 'gameOver'>('playing');
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    initGame();
  }, []);

  const initGame = () => {
    const cards: Card[] = [];
    for (let i = 1; i <= 5; i++) {
      cards.push({ id: i, value: i, suit: SUITS[Math.floor(Math.random() * SUITS.length)] });
    }
    setPlayerHand([...cards].sort(() => Math.random() - 0.5));
    setAiHand([...cards].sort(() => Math.random() - 0.5));
    setPlayerScore(0);
    setAiScore(0);
    setRound(1);
    setGameState('playing');
    setWinner(null);
    setPlayerPlayed(null);
    setAiPlayed(null);
  };

  const handlePlayCard = (card: Card) => {
    if (gameState !== 'playing') return;

    setPlayerPlayed(card);
    setPlayerHand(prev => prev.filter(c => c.id !== card.id));
    
    // AI plays
    const aiCard = aiHand[Math.floor(Math.random() * aiHand.length)];
    setAiPlayed(aiCard);
    setAiHand(prev => prev.filter(c => c.id !== aiCard.id));

    setGameState('roundResult');
  };

  const handleEndTurn = () => {
    if (gameState !== 'roundResult' || !playerPlayed || !aiPlayed) return;

    let newPlayerScore = playerScore;
    let newAiScore = aiScore;

    if (playerPlayed.value > aiPlayed.value) {
      newPlayerScore += 1;
      setPlayerScore(newPlayerScore);
    } else if (aiPlayed.value > playerPlayed.value) {
      newAiScore += 1;
      setAiScore(newAiScore);
    }

    if (round === 5) {
      setGameState('gameOver');
      if (newPlayerScore > newAiScore) {
        setWinner('player');
      } else if (newAiScore > newPlayerScore) {
        setWinner('ai');
      } else {
        setWinner('draw');
      }
    } else {
      setRound(prev => prev + 1);
      setPlayerPlayed(null);
      setAiPlayed(null);
      setGameState('playing');
    }
  };

  const shareResult = () => {
    let message = "";
    if (winner === 'player') {
      message = `我在卡牌对决中以 ${playerScore}:${aiScore} 赢了${character.name}！真是惊险刺激。`;
    } else if (winner === 'ai') {
      message = `${character.name}在卡牌对决中以 ${aiScore}:${playerScore} 赢了我，他的牌技太厉害了！`;
    } else {
      message = `我和${character.name}在卡牌对决中打成了平手，比分 ${playerScore}:${aiScore}。`;
    }
    onSendToChat(message);
    onClose();
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4 min-h-[400px]">
      {/* AI Side */}
      <div className="flex flex-col items-center gap-2 w-full">
        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full text-xs font-bold text-zinc-500">
          <span>{character.name}</span>
          <span className="bg-zinc-800 text-white px-2 py-0.5 rounded-full">{aiScore}</span>
        </div>
        <div className="flex gap-1 overflow-x-auto p-2 w-full justify-center">
          {aiHand.map((_, i) => (
            <div key={i} className="w-8 h-12 bg-zinc-800 rounded-md border border-zinc-700 shadow-sm" />
          ))}
        </div>
      </div>

      {/* Battle Area */}
      <div className="flex-1 flex items-center justify-center gap-8 w-full relative h-40">
        <AnimatePresence mode="wait">
          {aiPlayed && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-20 h-28 bg-white rounded-xl shadow-xl border-2 border-zinc-200 flex flex-col items-center justify-center gap-1"
            >
              <span className="text-2xl font-bold">{aiPlayed.value}</span>
              <span className="text-xl">{aiPlayed.suit}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center gap-1">
          <Swords className="text-zinc-300" size={24} />
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Round {round}</span>
        </div>

        <AnimatePresence mode="wait">
          {playerPlayed && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-20 h-28 bg-white rounded-xl shadow-xl border-2 border-purple-500 flex flex-col items-center justify-center gap-1"
            >
              <span className="text-2xl font-bold text-purple-600">{playerPlayed.value}</span>
              <span className="text-xl">{playerPlayed.suit}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {gameState === 'roundResult' && (
        <button 
          onClick={handleEndTurn}
          className="px-6 py-2 bg-purple-600 text-white rounded-full font-bold shadow-lg shadow-purple-500/30 hover:bg-purple-700 transition-all"
        >
          结束回合
        </button>
      )}

      {/* Player Side */}
      <div className="flex flex-col items-center gap-4 w-full">
        <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 rounded-full text-xs font-bold text-purple-600">
          <span>你</span>
          <span className="bg-purple-600 text-white px-2 py-0.5 rounded-full">{playerScore}</span>
        </div>
        
        <div className="flex gap-2 overflow-x-auto p-4 w-full justify-start no-scrollbar">
          {playerHand.map((card) => (
            <motion.button
              key={card.id}
              whileHover={{ y: -10 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handlePlayCard(card)}
              disabled={gameState !== 'playing'}
              className={`flex-shrink-0 w-14 h-20 bg-white rounded-xl shadow-md border-2 ${
                gameState === 'playing' ? 'border-zinc-100 hover:border-purple-300' : 'border-zinc-50 opacity-50'
              } flex flex-col items-center justify-center gap-1 transition-colors`}
            >
              <span className="text-lg font-bold">{card.value}</span>
              <span className="text-sm">{card.suit}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Game Over Modal */}
      {gameState === 'gameOver' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm p-6"
        >
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-zinc-100 flex flex-col items-center gap-6 w-full max-w-xs">
            <Trophy className={winner === 'player' ? 'text-yellow-500' : 'text-zinc-300'} size={64} />
            <div className="text-center">
              <h3 className="text-2xl font-black italic mb-1">
                {winner === 'player' ? '大获全胜！' : winner === 'ai' ? '惜败...' : '平局'}
              </h3>
              <p className="text-zinc-500 text-sm">最终比分 {playerScore} : {aiScore}</p>
            </div>
            
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={initGame}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 py-3 font-bold text-zinc-900 transition-colors hover:bg-zinc-200 shadow-sm"
              >
                <RotateCcw size={18} />
                再来一局
              </button>
              <button
                onClick={shareResult}
                className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
              >
                <MessageSquare size={18} />
                分享战报
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

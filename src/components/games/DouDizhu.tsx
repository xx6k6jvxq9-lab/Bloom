import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, MessageSquare, Swords, Zap } from 'lucide-react';
import { Character } from '../../types';

interface DouDizhuProps {
  character: Character;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

type Card = {
  id: number;
  value: number; // 3-15 (3-10, J=11, Q=12, K=13, A=14, 2=15, SmallJoker=16, BigJoker=17)
  suit: string;
};

const SUITS = ['♠️', '♥️', '♣️', '♦️'];

export const DouDizhu: React.FC<DouDizhuProps> = ({ character, onClose, onSendToChat }) => {
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [aiHand, setAiHand] = useState<Card[]>([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [gameState, setGameState] = useState<'robbing' | 'playing' | 'gameOver'>('robbing');
  const [winner, setWinner] = useState<string | null>(null);
  const [lastPlayed, setLastPlayed] = useState<Card[]>([]);
  const [turn, setTurn] = useState<'player' | 'ai'>('player');

  useEffect(() => {
    initGame();
  }, []);

  const initGame = () => {
    const cards: Card[] = [];
    for (let v = 3; v <= 15; v++) {
      for (let s = 0; s < 4; s++) {
        cards.push({ id: v * 4 + s, value: v, suit: SUITS[s] });
      }
    }
    cards.push({ id: 100, value: 16, suit: '🃏' });
    cards.push({ id: 101, value: 17, suit: '🃏' });
    
    cards.sort(() => Math.random() - 0.5);
    
    setPlayerHand(cards.slice(0, 20).sort((a, b) => a.value - b.value));
    setAiHand(cards.slice(20, 37).sort((a, b) => a.value - b.value));
    setGameState('robbing');
    setWinner(null);
    setLastPlayed([]);
    setTurn('player');
  };

  const handleRob = (rob: boolean) => {
    if (rob) {
      setGameState('playing');
    } else {
      // Simple logic: if user doesn't rob, AI becomes landlord
      setGameState('playing');
      setTurn('ai');
    }
  };

  const handlePlayCard = (cards: Card[]) => {
    if (turn !== 'player' || cards.length === 0) return;
    
    setPlayerHand(prev => prev.filter(c => !cards.includes(c)));
    setLastPlayed(cards);
    setTurn('ai');
    
    // Simple AI response
    setTimeout(() => {
      const aiCards = aiHand.filter(c => c.value > cards[0].value);
      if (aiCards.length > 0) {
        const played = [aiCards[0]];
        setAiHand(prev => prev.filter(c => c !== played[0]));
        setLastPlayed(played);
      } else {
        setLastPlayed([]);
      }
      setTurn('player');
      
      if (aiHand.length === 0) {
        setGameState('gameOver');
        setWinner('ai');
        setAiScore(prev => prev + 1);
      }
    }, 1000);
    
    if (playerHand.length === cards.length) {
      setGameState('gameOver');
      setWinner('player');
      setPlayerScore(prev => prev + 1);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4 min-h-[400px]">
      {gameState === 'robbing' && (
        <div className="flex flex-col items-center gap-4">
          <p>是否抢地主？</p>
          <div className="flex gap-4">
            <button onClick={() => handleRob(true)} className="px-4 py-2 bg-red-500 text-white rounded-lg">抢地主</button>
            <button onClick={() => handleRob(false)} className="px-4 py-2 bg-zinc-500 text-white rounded-lg">不抢</button>
          </div>
        </div>
      )}
      
      {gameState === 'playing' && (
        <div className="w-full flex flex-col gap-4">
          <div className="text-center">AI ({character.name}) 剩余牌: {aiHand.length}</div>
          <div className="h-20 bg-zinc-100 rounded-lg flex items-center justify-center">
            {lastPlayed.map(c => <span key={c.id} className="text-2xl">{c.suit}{c.value}</span>)}
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {playerHand.map(card => (
              <button key={card.id} onClick={() => handlePlayCard([card])} className="p-2 bg-white border rounded">
                {card.suit}{card.value}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {gameState === 'gameOver' && (
        <div className="text-center">
          <p>{winner === 'player' ? '你赢了！' : 'AI赢了！'}</p>
          <button onClick={initGame} className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg">再来一局</button>
        </div>
      )}
    </div>
  );
};

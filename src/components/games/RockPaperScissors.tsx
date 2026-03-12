import React, { useState } from 'react';
import { Hand, Scissors, Scroll, RefreshCw, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Character } from '../../types';

interface RockPaperScissorsProps {
  character: Character;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

type Choice = 'rock' | 'paper' | 'scissors';

const CHOICES: { id: Choice; label: string; icon: React.ReactNode }[] = [
  { id: 'rock', label: '石头', icon: <div className="w-8 h-8 rounded-full bg-zinc-400" /> }, // Placeholder for Rock
  { id: 'paper', label: '布', icon: <Scroll size={32} /> },
  { id: 'scissors', label: '剪刀', icon: <Scissors size={32} /> },
];

export const RockPaperScissors: React.FC<RockPaperScissorsProps> = ({
  character,
  onClose,
  onSendToChat
}) => {
  const [userChoice, setUserChoice] = useState<Choice | null>(null);
  const [aiChoice, setAiChoice] = useState<Choice | null>(null);
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState({ user: 0, ai: 0 });

  const play = (choice: Choice) => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    setUserChoice(choice);
    setAiChoice(null);
    setResult(null);

    // Simulate thinking time
    setTimeout(() => {
      const choices: Choice[] = ['rock', 'paper', 'scissors'];
      const aiPick = choices[Math.floor(Math.random() * choices.length)];
      setAiChoice(aiPick);

      let gameResult: 'win' | 'lose' | 'draw';
      if (choice === aiPick) {
        gameResult = 'draw';
      } else if (
        (choice === 'rock' && aiPick === 'scissors') ||
        (choice === 'paper' && aiPick === 'rock') ||
        (choice === 'scissors' && aiPick === 'paper')
      ) {
        gameResult = 'win';
        setScore(s => ({ ...s, user: s.user + 1 }));
      } else {
        gameResult = 'lose';
        setScore(s => ({ ...s, ai: s.ai + 1 }));
      }
      setResult(gameResult);
      setIsPlaying(false);
    }, 1000);
  };

  const getResultText = () => {
    if (!result) return '';
    if (result === 'win') return '你赢了！🎉';
    if (result === 'lose') return '你输了！😢';
    return '平局！🤝';
  };

  const shareResult = () => {
    onSendToChat(`[小游戏：猜拳]\n我出了${CHOICES.find(c => c.id === userChoice)?.label}，${character.name}出了${CHOICES.find(c => c.id === aiChoice)?.label}。\n结果：${getResultText()}`);
    onClose();
  };

  return (
    <div className="flex flex-col items-center p-4">
      <div className="flex justify-between w-full mb-8 px-4">
        <div className="flex flex-col items-center">
          <span className="text-sm text-zinc-500">你</span>
          <span className="text-2xl font-bold text-blue-500">{score.user}</span>
        </div>
        <div className="flex flex-col items-center">
          <Trophy size={24} className="text-yellow-500 mb-1" />
          <span className="text-xs text-zinc-400">VS</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-sm text-zinc-500">{character.name}</span>
          <span className="text-2xl font-bold text-pink-500">{score.ai}</span>
        </div>
      </div>

      <div className="h-48 flex items-center justify-center mb-8 w-full relative">
        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div
              key="shaking"
              animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-6xl"
            >
              ✊
            </motion.div>
          ) : result ? (
            <div className="flex items-center gap-8">
              <motion.div 
                initial={{ scale: 0, x: -50 }} 
                animate={{ scale: 1, x: 0 }}
                className="flex flex-col items-center"
              >
                <div className="text-6xl mb-2">
                  {userChoice === 'rock' ? '✊' : userChoice === 'paper' ? '✋' : '✌️'}
                </div>
                <span className="text-xs text-zinc-400">你</span>
              </motion.div>
              
              <div className="text-2xl font-bold text-zinc-300">VS</div>

              <motion.div 
                initial={{ scale: 0, x: 50 }} 
                animate={{ scale: 1, x: 0 }}
                className="flex flex-col items-center"
              >
                <div className="text-6xl mb-2">
                  {aiChoice === 'rock' ? '✊' : aiChoice === 'paper' ? '✋' : '✌️'}
                </div>
                <span className="text-xs text-zinc-400">{character.name}</span>
              </motion.div>
            </div>
          ) : (
            <div className="text-zinc-400 text-sm">点击下方按钮开始</div>
          )}
        </AnimatePresence>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="text-xl font-bold text-zinc-800 mb-2">{getResultText()}</div>
          <button
            onClick={shareResult}
            className="text-sm text-blue-500 hover:underline"
          >
            分享结果到聊天
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-3 gap-4 w-full">
        {CHOICES.map((choice) => (
          <button
            key={choice.id}
            onClick={() => play(choice.id)}
            disabled={isPlaying}
            className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all ${
              isPlaying 
                ? 'bg-zinc-100 opacity-50 cursor-not-allowed' 
                : 'bg-white shadow-md hover:shadow-lg active:scale-95 border border-zinc-100'
            }`}
          >
            <div className="text-3xl mb-2">
              {choice.id === 'rock' ? '✊' : choice.id === 'paper' ? '✋' : '✌️'}
            </div>
            <span className="text-xs text-zinc-600 font-medium">{choice.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

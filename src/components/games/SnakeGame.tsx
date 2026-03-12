import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy, RotateCcw, Play, Pause } from 'lucide-react';
import { motion } from 'motion/react';
import { Character } from '../../types';

interface SnakeGameProps {
  character: Character;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

type Point = { x: number; y: number };

const GRID_SIZE = 15;
const INITIAL_SNAKE: Point[] = [
  { x: 7, y: 7 },
  { x: 7, y: 8 },
  { x: 7, y: 9 },
];
const INITIAL_DIRECTION: Point = { x: 0, y: -1 };
const SPEED = 150;

export const SnakeGame: React.FC<SnakeGameProps> = ({ character, onSendToChat }) => {
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Point>(INITIAL_DIRECTION);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [highScore, setHighScore] = useState(0);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  const generateFood = useCallback((currentSnake: Point[]) => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      const isOnSnake = currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      if (!isOnSnake) break;
    }
    return newFood;
  }, []);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setIsGameOver(false);
    setScore(0);
    setIsPaused(true);
    setFood(generateFood(INITIAL_SNAKE));
  };

  const moveSnake = useCallback(() => {
    if (isGameOver || isPaused) return;

    setSnake(prevSnake => {
      const head = prevSnake[0];
      const newHead = {
        x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
        y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE,
      };

      // Check collision with self
      if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        setIsGameOver(true);
        if (score > highScore) setHighScore(score);
        onSendToChat(`我在贪吃蛇大作战中获得了 ${score} 分！快来挑战我吧！`);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check collision with food
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(s => s + 10);
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, isGameOver, isPaused, score, highScore, generateFood, onSendToChat]);

  useEffect(() => {
    if (!isPaused && !isGameOver) {
      gameLoopRef.current = setInterval(moveSnake, SPEED);
    } else {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPaused, isGameOver, moveSnake]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': if (direction.y === 0) setDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown': if (direction.y === 0) setDirection({ x: 0, y: 1 }); break;
        case 'ArrowLeft': if (direction.x === 0) setDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': if (direction.x === 0) setDirection({ x: 1, y: 0 }); break;
        case ' ': setIsPaused(p => !p); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  return (
    <div className="flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-4 px-2">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-yellow-500" />
          <span className="text-sm font-bold text-zinc-700">分数: {score}</span>
        </div>
        <div className="text-xs text-zinc-400">最高分: {highScore}</div>
      </div>

      <div 
        className="relative bg-zinc-900 rounded-xl overflow-hidden shadow-inner border-4 border-zinc-800"
        style={{ 
          width: '280px', 
          height: '280px',
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`
        }}
      >
        {/* Render Snake */}
        {snake.map((segment, i) => (
          <div
            key={i}
            className={`rounded-sm ${i === 0 ? 'bg-emerald-400 z-10' : 'bg-emerald-600'}`}
            style={{
              gridColumnStart: segment.x + 1,
              gridRowStart: segment.y + 1,
            }}
          />
        ))}

        {/* Render Food */}
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="bg-rose-500 rounded-full"
          style={{
            gridColumnStart: food.x + 1,
            gridRowStart: food.y + 1,
          }}
        />

        {/* Game Over Overlay */}
        {isGameOver && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
            <h3 className="text-white font-bold text-xl mb-2">游戏结束</h3>
            <p className="text-zinc-400 text-sm mb-4">最终得分: {score}</p>
            <button
              onClick={resetGame}
              className="px-6 py-2 bg-emerald-500 text-white rounded-full flex items-center gap-2 hover:bg-emerald-600 transition-colors"
            >
              <RotateCcw size={18} />
              再来一局
            </button>
          </div>
        )}

        {/* Pause Overlay */}
        {isPaused && !isGameOver && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
            <button
              onClick={() => setIsPaused(false)}
              className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all scale-110"
            >
              <Play size={32} fill="white" />
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        <div />
        <button 
          onClick={() => direction.y === 0 && setDirection({ x: 0, y: -1 })}
          className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center active:bg-zinc-200"
        >
          ↑
        </button>
        <div />
        <button 
          onClick={() => direction.x === 0 && setDirection({ x: -1, y: 0 })}
          className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center active:bg-zinc-200"
        >
          ←
        </button>
        <button 
          onClick={() => direction.y === 0 && setDirection({ x: 0, y: 1 })}
          className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center active:bg-zinc-200"
        >
          ↓
        </button>
        <button 
          onClick={() => direction.x === 0 && setDirection({ x: 1, y: 0 })}
          className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center active:bg-zinc-200"
        >
          →
        </button>
      </div>

      <div className="mt-4 flex gap-4">
        <button
          onClick={() => setIsPaused(p => !p)}
          className="p-2 text-zinc-500 hover:text-zinc-800"
        >
          {isPaused ? <Play size={20} /> : <Pause size={20} />}
        </button>
        <button
          onClick={resetGame}
          className="p-2 text-zinc-500 hover:text-zinc-800"
        >
          <RotateCcw size={20} />
        </button>
      </div>
    </div>
  );
};

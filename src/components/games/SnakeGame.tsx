import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy, RotateCcw, Play, Pause, Send } from 'lucide-react';
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

function buildSnakeShareText(score: number) {
  return `我在贪吃蛇大作战中获得了 ${score} 分！快来挑战我吧！`;
}

export const SnakeGame: React.FC<SnakeGameProps> = ({ onClose, onSendToChat }) => {
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Point>(INITIAL_DIRECTION);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [highScore, setHighScore] = useState(0);
  const [shareText, setShareText] = useState('');

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  const generateFood = useCallback((currentSnake: Point[]) => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      const isOnSnake = currentSnake.some((segment) => segment.x === newFood.x && segment.y === newFood.y);
      if (!isOnSnake) break;
    }
    return newFood;
  }, []);

  const resetGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setIsGameOver(false);
    setScore(0);
    setIsPaused(true);
    setFood(generateFood(INITIAL_SNAKE));
    setShareText('');
  }, [generateFood]);

  const moveSnake = useCallback(() => {
    if (isGameOver || isPaused) return;

    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const newHead = {
        x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
        y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE,
      };

      if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
        setIsGameOver(true);
        if (score > highScore) setHighScore(score);
        setShareText(buildSnakeShareText(score));
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      if (newHead.x === food.x && newHead.y === food.y) {
        setScore((current) => current + 10);
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, isGameOver, isPaused, score, highScore, generateFood]);

  useEffect(() => {
    if (!isPaused && !isGameOver) {
      gameLoopRef.current = setInterval(moveSnake, SPEED);
    } else if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPaused, isGameOver, moveSnake]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          if (direction.y === 0) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
          if (direction.y === 0) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
          if (direction.x === 0) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          if (direction.x === 0) setDirection({ x: 1, y: 0 });
          break;
        case ' ':
          setIsPaused((current) => !current);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex w-full items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-yellow-500" />
          <span className="text-sm font-bold text-zinc-700">分数: {score}</span>
        </div>
        <div className="text-xs text-zinc-400">最高分: {highScore}</div>
      </div>

      <div
        className="relative overflow-hidden rounded-xl border-4 border-zinc-800 bg-zinc-900 shadow-inner"
        style={{
          width: '280px',
          height: '280px',
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
        }}
      >
        {snake.map((segment, index) => (
          <div
            key={index}
            className={`rounded-sm ${index === 0 ? 'z-10 bg-emerald-400' : 'bg-emerald-600'}`}
            style={{
              gridColumnStart: segment.x + 1,
              gridRowStart: segment.y + 1,
            }}
          />
        ))}

        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="rounded-full bg-rose-500"
          style={{
            gridColumnStart: food.x + 1,
            gridRowStart: food.y + 1,
          }}
        />

        {isGameOver && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80">
            <h3 className="mb-2 text-xl font-bold text-white">游戏结束</h3>
            <p className="mb-4 text-sm text-zinc-400">最终得分 {score}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  if (!shareText.trim()) return;
                  onSendToChat(shareText);
                  onClose();
                }}
                className="flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2 text-zinc-900 transition-colors hover:bg-zinc-100"
              >
                <Send size={18} />
                发到聊天
              </button>
              <button
                onClick={resetGame}
                className="flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-2 text-white transition-colors hover:bg-emerald-600"
              >
                <RotateCcw size={18} />
                再来一局
              </button>
            </div>
          </div>
        )}

        {isPaused && !isGameOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
            <button
              onClick={() => setIsPaused(false)}
              className="flex h-16 w-16 scale-110 items-center justify-center rounded-full bg-white/20 text-white transition-all hover:bg-white/30"
            >
              <Play size={32} fill="white" />
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <div />
        <button
          onClick={() => direction.y === 0 && setDirection({ x: 0, y: -1 })}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 active:bg-zinc-200"
        >
          上
        </button>
        <div />
        <button
          onClick={() => direction.x === 0 && setDirection({ x: -1, y: 0 })}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 active:bg-zinc-200"
        >
          左
        </button>
        <button
          onClick={() => direction.y === 0 && setDirection({ x: 0, y: 1 })}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 active:bg-zinc-200"
        >
          下
        </button>
        <button
          onClick={() => direction.x === 0 && setDirection({ x: 1, y: 0 })}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 active:bg-zinc-200"
        >
          右
        </button>
      </div>

      <div className="mt-4 flex gap-4">
        <button
          onClick={() => setIsPaused((current) => !current)}
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

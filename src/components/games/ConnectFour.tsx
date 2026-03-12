import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Character } from '../../types';
import { Trophy, RotateCcw } from 'lucide-react';

interface ConnectFourProps {
  character: Character;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

type Player = 'user' | 'ai' | null;
const ROWS = 6;
const COLS = 7;

export const ConnectFour: React.FC<ConnectFourProps> = ({
  character,
  onClose,
  onSendToChat
}) => {
  const [board, setBoard] = useState<Player[][]>(
    Array(ROWS).fill(null).map(() => Array(COLS).fill(null))
  );
  const [isUserTurn, setIsUserTurn] = useState(true);
  const [winner, setWinner] = useState<Player | 'draw'>(null);
  const [winningCells, setWinningCells] = useState<[number, number][]>([]);

  const checkWinner = (currentBoard: Player[][]) => {
    // Check horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const cell = currentBoard[r][c];
        if (cell && cell === currentBoard[r][c+1] && cell === currentBoard[r][c+2] && cell === currentBoard[r][c+3]) {
          return { winner: cell, cells: [[r, c], [r, c+1], [r, c+2], [r, c+3]] as [number, number][] };
        }
      }
    }
    // Check vertical
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = currentBoard[r][c];
        if (cell && cell === currentBoard[r+1][c] && cell === currentBoard[r+2][c] && cell === currentBoard[r+3][c]) {
          return { winner: cell, cells: [[r, c], [r+1, c], [r+2, c], [r+3, c]] as [number, number][] };
        }
      }
    }
    // Check diagonal (down-right)
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const cell = currentBoard[r][c];
        if (cell && cell === currentBoard[r+1][c+1] && cell === currentBoard[r+2][c+2] && cell === currentBoard[r+3][c+3]) {
          return { winner: cell, cells: [[r, c], [r+1, c+1], [r+2, c+2], [r+3, c+3]] as [number, number][] };
        }
      }
    }
    // Check diagonal (up-right)
    for (let r = 3; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const cell = currentBoard[r][c];
        if (cell && cell === currentBoard[r-1][c+1] && cell === currentBoard[r-2][c+2] && cell === currentBoard[r-3][c+3]) {
          return { winner: cell, cells: [[r, c], [r-1, c+1], [r-2, c+2], [r-3, c+3]] as [number, number][] };
        }
      }
    }

    // Check draw
    if (currentBoard.every(row => row.every(cell => cell !== null))) {
      return { winner: 'draw' as const, cells: [] };
    }

    return null;
  };

  const dropDisc = (col: number, player: Player) => {
    if (winner || !isUserTurn && player === 'user') return;

    const newBoard = [...board.map(row => [...row])];
    let droppedRow = -1;

    for (let r = ROWS - 1; r >= 0; r--) {
      if (!newBoard[r][col]) {
        newBoard[r][col] = player;
        droppedRow = r;
        break;
      }
    }

    if (droppedRow !== -1) {
      setBoard(newBoard);
      const result = checkWinner(newBoard);
      if (result) {
        setWinner(result.winner);
        if (result.cells) setWinningCells(result.cells);
        
        if (result.winner === 'user') {
          onSendToChat(`我在四子棋中赢了${character.name}！真开心~`);
        } else if (result.winner === 'ai') {
          onSendToChat(`${character.name}在四子棋中赢了我，下次我一定会赢回来的！`);
        }
      } else {
        setIsUserTurn(player === 'ai');
      }
    }
  };

  useEffect(() => {
    if (!isUserTurn && !winner) {
      const timer = setTimeout(() => {
        // Simple AI: Prefer winning, then blocking, then random
        const availableCols = [];
        for (let c = 0; c < COLS; c++) {
          if (!board[0][c]) availableCols.push(c);
        }

        if (availableCols.length > 0) {
          // Try to win
          for (const c of availableCols) {
            const tempBoard = board.map(row => [...row]);
            for (let r = ROWS - 1; r >= 0; r--) {
              if (!tempBoard[r][c]) {
                tempBoard[r][c] = 'ai';
                if (checkWinner(tempBoard)?.winner === 'ai') {
                  dropDisc(c, 'ai');
                  return;
                }
                break;
              }
            }
          }

          // Try to block user
          for (const c of availableCols) {
            const tempBoard = board.map(row => [...row]);
            for (let r = ROWS - 1; r >= 0; r--) {
              if (!tempBoard[r][c]) {
                tempBoard[r][c] = 'user';
                if (checkWinner(tempBoard)?.winner === 'user') {
                  dropDisc(c, 'ai');
                  return;
                }
                break;
              }
            }
          }

          // Random move
          const randomCol = availableCols[Math.floor(Math.random() * availableCols.length)];
          dropDisc(randomCol, 'ai');
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isUserTurn, winner, board]);

  const resetGame = () => {
    setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
    setIsUserTurn(true);
    setWinner(null);
    setWinningCells([]);
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="flex justify-between w-full px-4">
        <div className={`flex items-center gap-2 p-2 rounded-xl transition-all ${isUserTurn && !winner ? 'bg-blue-100 ring-2 ring-blue-400' : 'opacity-50'}`}>
          <div className="w-4 h-4 rounded-full bg-blue-500 shadow-sm" />
          <span className="text-sm font-bold text-blue-700">我的回合</span>
        </div>
        <div className={`flex items-center gap-2 p-2 rounded-xl transition-all ${!isUserTurn && !winner ? 'bg-red-100 ring-2 ring-red-400' : 'opacity-50'}`}>
          <span className="text-sm font-bold text-red-700">{character.name}的回合</span>
          <div className="w-4 h-4 rounded-full bg-red-500 shadow-sm" />
        </div>
      </div>

      <div className="relative bg-zinc-800 p-3 rounded-2xl shadow-2xl border-4 border-zinc-700">
        <div className="grid grid-cols-7 gap-2">
          {Array(COLS).fill(0).map((_, colIndex) => (
            <div key={colIndex} className="flex flex-col gap-2">
              {Array(ROWS).fill(0).map((_, rowIndex) => {
                const cell = board[rowIndex][colIndex];
                const isWinning = winningCells.some(([r, c]) => r === rowIndex && c === colIndex);
                
                return (
                  <div 
                    key={rowIndex}
                    onClick={() => isUserTurn && !winner && dropDisc(colIndex, 'user')}
                    className={`
                      w-8 h-8 sm:w-10 sm:h-10 rounded-full cursor-pointer transition-all duration-300
                      ${!cell ? 'bg-zinc-900 hover:bg-zinc-700' : ''}
                      ${cell === 'user' ? 'bg-blue-500 shadow-inner' : ''}
                      ${cell === 'ai' ? 'bg-red-500 shadow-inner' : ''}
                      ${isWinning ? 'ring-4 ring-yellow-400 animate-pulse scale-110 z-10' : ''}
                    `}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="flex flex-col items-center gap-4 bg-white p-6 rounded-3xl shadow-xl border border-zinc-100 w-full max-w-xs"
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg ${
              winner === 'user' ? 'bg-blue-500 text-white' : 
              winner === 'ai' ? 'bg-red-500 text-white' : 'bg-zinc-500 text-white'
            }`}>
              {winner === 'draw' ? '🤝' : <Trophy size={32} />}
            </div>
            <div className="text-center">
              <h4 className="text-xl font-black text-zinc-800">
                {winner === 'user' ? '你赢了！' : 
                 winner === 'ai' ? `${character.name}赢了` : '平局'}
              </h4>
              <p className="text-sm text-zinc-500 mt-1">
                {winner === 'user' ? '太棒了，你打败了AI！' : 
                 winner === 'ai' ? '别灰心，下次一定能赢！' : '势均力敌的较量'}
              </p>
            </div>
            <button
              onClick={resetGame}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 active:scale-95 transition-all w-full justify-center"
            >
              <RotateCcw size={18} />
              再来一局
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!winner && (
        <button
          onClick={resetGame}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-600 transition-colors text-sm font-medium"
        >
          <RotateCcw size={14} />
          重置游戏
        </button>
      )}
    </div>
  );
};

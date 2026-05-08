import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Trophy, RotateCcw, MessageSquare } from 'lucide-react';
import { Character } from '../../types';

interface GomokuProps {
  character: Character;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

type Player = 'black' | 'white' | null;
const BOARD_SIZE = 13; // 13x13 for better mobile fit

export const Gomoku: React.FC<GomokuProps> = ({ character, onClose, onSendToChat }) => {
  const [board, setBoard] = useState<Player[][]>(
    Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))
  );
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [winner, setWinner] = useState<Player | 'draw'>(null);
  const [lastMove, setLastMove] = useState<{ r: number; c: number } | null>(null);

  const checkWinner = (r: number, c: number, b: Player[][]): Player | 'draw' | null => {
    const player = b[r][c];
    if (!player) return null;

    const directions = [
      [0, 1],  // horizontal
      [1, 0],  // vertical
      [1, 1],  // diagonal \
      [1, -1], // diagonal /
    ];

    for (const [dr, dc] of directions) {
      let count = 1;
      
      // Check forward
      for (let i = 1; i < 5; i++) {
        const nr = r + dr * i;
        const nc = c + dc * i;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && b[nr][nc] === player) {
          count++;
        } else break;
      }
      
      // Check backward
      for (let i = 1; i < 5; i++) {
        const nr = r - dr * i;
        const nc = c - dc * i;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && b[nr][nc] === player) {
          count++;
        } else break;
      }

      if (count >= 5) return player;
    }

    // Check draw
    if (b.every(row => row.every(cell => cell !== null))) return 'draw';

    return null;
  };

  const makeMove = useCallback((r: number, c: number) => {
    if (board[r][c] || winner) return;

    const newBoard = board.map(row => [...row]);
    newBoard[r][c] = isPlayerTurn ? 'black' : 'white';
    setBoard(newBoard);
    setLastMove({ r, c });

    const winResult = checkWinner(r, c, newBoard);
    if (winResult) {
      setWinner(winResult);
    } else {
      setIsPlayerTurn(!isPlayerTurn);
    }
  }, [board, isPlayerTurn, winner]);

  // Simple AI for the character
  useEffect(() => {
    if (!isPlayerTurn && !winner) {
      const timer = setTimeout(() => {
        const aiMove = getBestMove(board, 'white', 'black');
        if (aiMove) {
          makeMove(aiMove.r, aiMove.c);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isPlayerTurn, winner, board, makeMove]);

  const getBestMove = (b: Player[][], ai: Player, human: Player) => {
    // 1. Can AI win?
    const winMove = findWinningMove(b, ai);
    if (winMove) return winMove;

    // 2. Can human win? Block it.
    const blockMove = findWinningMove(b, human);
    if (blockMove) return blockMove;

    // 3. Try to create 4 or 3
    const strategicMove = findStrategicMove(b, ai);
    if (strategicMove) return strategicMove;

    // 4. Random near center
    const emptyCells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!b[r][c]) {
          // Weight towards center and existing pieces
          let weight = 0;
          if (r >= 4 && r <= 8 && c >= 4 && c <= 8) weight += 5;
          
          // Check neighbors
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && b[nr][nc]) {
                weight += 10;
              }
            }
          }
          emptyCells.push({ r, c, weight });
        }
      }
    }

    if (emptyCells.length === 0) return null;
    emptyCells.sort((a, b) => b.weight - a.weight);
    const topMoves = emptyCells.slice(0, 5);
    return topMoves[Math.floor(Math.random() * topMoves.length)];
  };

  const findWinningMove = (b: Player[][], player: Player) => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!b[r][c]) {
          const tempBoard = b.map(row => [...row]);
          tempBoard[r][c] = player;
          if (checkWinner(r, c, tempBoard) === player) return { r, c };
        }
      }
    }
    return null;
  };

  const findStrategicMove = (b: Player[][], player: Player) => {
    // Simplified: find a spot that creates a line of 3 or 4
    // In a real Gomoku AI, this would be much more complex
    return null;
  };

  const resetGame = () => {
    setBoard(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
    setIsPlayerTurn(true);
    setWinner(null);
    setLastMove(null);
  };

  const shareResult = () => {
    let message = "";
    if (winner === 'black') {
      message = `我在五子棋中赢了${character.name}！真是一场精彩的对决。`;
    } else if (winner === 'white') {
      message = `${character.name}在五子棋中赢了我，下次我一定会赢回来的！`;
    } else {
      message = `我和${character.name}在五子棋中打成了平手，旗鼓相当！`;
    }
    onSendToChat(message);
    onClose();
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="flex justify-between w-full max-w-[360px] items-center px-4">
        <div className={`flex items-center gap-2 p-2 rounded-xl transition-all ${isPlayerTurn && !winner ? 'bg-zinc-800 text-white scale-105 shadow-lg' : 'bg-zinc-100 text-zinc-400'}`}>
          <div className="w-3 h-3 rounded-full bg-zinc-900 border border-white/20" />
          <span className="text-sm font-bold">你 (黑子)</span>
        </div>
        <div className="text-zinc-300 font-bold italic">VS</div>
        <div className={`flex items-center gap-2 p-2 rounded-xl transition-all ${!isPlayerTurn && !winner ? 'bg-zinc-800 text-white scale-105 shadow-lg' : 'bg-zinc-100 text-zinc-400'}`}>
          <span className="text-sm font-bold">{character.name} (白子)</span>
          <div className="w-3 h-3 rounded-full bg-[#fffdf6] border border-[#8f6b32] shadow-[0_1px_2px_rgba(64,41,7,0.28)]" />
        </div>
      </div>

      <div className="relative p-2 bg-[#d6ae60] rounded-lg shadow-2xl border-4 border-[#a57d36]">
        <div 
          className="grid gap-0" 
          style={{ 
            gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
            width: 'min(90vw, 340px)',
            height: 'min(90vw, 340px)'
          }}
        >
          {board.map((row, r) => 
            row.map((cell, c) => (
              <div 
                key={`${r}-${c}`}
                onClick={() => isPlayerTurn && !winner && makeMove(r, c)}
                className="relative flex items-center justify-center cursor-pointer group"
                style={{
                  borderTop: r === 0 ? 'none' : '0.5px solid #886224',
                  borderLeft: c === 0 ? 'none' : '0.5px solid #886224',
                }}
              >
                {/* Grid Lines */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-[1px] bg-[#886224]" />
                  <div className="h-full w-[1px] bg-[#886224]" />
                </div>

                {/* Star Points (Hoshi) */}
                {((r === 3 || r === 9 || r === 6) && (c === 3 || c === 9 || c === 6)) && (
                  <div className="absolute w-1.5 h-1.5 bg-[#7d591e] rounded-full z-0" />
                )}

                {/* Pieces */}
                {cell && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`w-[86%] h-[86%] rounded-full z-10 ${
                      cell === 'black' 
                        ? 'bg-gradient-to-br from-[#58585f] via-[#232329] to-[#050505] ring-1 ring-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.45)]'
                        : 'bg-gradient-to-br from-[#fffef9] via-[#fff9ec] to-[#ead29c] ring-1 ring-[#8f6b32] shadow-[0_3px_8px_rgba(82,56,16,0.28)]'
                    } relative`}
                  >
                    {lastMove?.r === r && lastMove?.c === c && (
                      <div className={`absolute inset-0 flex items-center justify-center`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${cell === 'black' ? 'bg-white/50' : 'bg-black/50'}`} />
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Hover Effect */}
                {!cell && !winner && isPlayerTurn && (
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm z-0" />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {winner && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 bg-white p-6 rounded-3xl shadow-xl border border-zinc-100 w-full max-w-[320px]"
        >
          <div className="flex items-center gap-3 text-2xl font-black italic">
            <Trophy className="text-yellow-500" size={32} />
            <span className="bg-gradient-to-r from-zinc-800 to-zinc-500 bg-clip-text text-transparent">
              {winner === 'black' ? '你赢了！' : winner === 'white' ? `${character.name} 赢了` : '平局！'}
            </span>
          </div>
          
          <div className="flex gap-3 w-full">
            <button
              onClick={resetGame}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
            >
              <RotateCcw size={18} />
              再来一局
            </button>
            <button
              onClick={shareResult}
               className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 py-3 font-bold text-zinc-900 transition-colors hover:bg-zinc-200 shadow-sm"
            >
              <MessageSquare size={18} />
              分享战报
            </button>
          </div>
        </motion.div>
      )}

      {!winner && (
        <p className="text-xs text-zinc-400 italic">
          {isPlayerTurn ? '轮到你下棋了，加油！' : `${character.name} 正在思考...`}
        </p>
      )}
    </div>
  );
};

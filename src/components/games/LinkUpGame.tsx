import React, { useState, useEffect, useCallback } from 'react';
import { Character } from '../../types';
import { RefreshCw } from 'lucide-react';

interface LinkUpGameProps {
  character: Character;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

type Point = { x: number; y: number };

const EMOJIS = ['🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🍍', '🥝', '🥑', '🍊', '🍋', '🍑'];
const ROWS = 6;
const COLS = 6;

// Helper functions
function checkLine(board: (string | null)[][], p1: Point, p2: Point): boolean {
  if (p1.x !== p2.x && p1.y !== p2.y) return false;
  if (p1.x === p2.x) {
    const min = Math.min(p1.y, p2.y);
    const max = Math.max(p1.y, p2.y);
    for (let y = min + 1; y < max; y++) {
      if (board[y][p1.x] !== null) return false;
    }
    return true;
  } else {
    const min = Math.min(p1.x, p2.x);
    const max = Math.max(p1.x, p2.x);
    for (let x = min + 1; x < max; x++) {
      if (board[p1.y][x] !== null) return false;
    }
    return true;
  }
}

function findPath(board: (string | null)[][], p1: Point, p2: Point): Point[] | null {
  if (board[p1.y][p1.x] !== board[p2.y][p2.x]) return null;
  if (p1.x === p2.x && p1.y === p2.y) return null;

  // 0 turns
  if (checkLine(board, p1, p2)) return [p1, p2];

  // 1 turn
  const c1 = { x: p1.x, y: p2.y };
  if (board[c1.y][c1.x] === null && checkLine(board, p1, c1) && checkLine(board, c1, p2)) {
    return [p1, c1, p2];
  }
  const c2 = { x: p2.x, y: p1.y };
  if (board[c2.y][c2.x] === null && checkLine(board, p1, c2) && checkLine(board, c2, p2)) {
    return [p1, c2, p2];
  }

  // 2 turns
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [dx, dy] of dirs) {
    let curr = { x: p1.x + dx, y: p1.y + dy };
    while (curr.x >= 0 && curr.x < board[0].length && curr.y >= 0 && curr.y < board.length) {
      if (board[curr.y][curr.x] !== null) break;
      
      const corner1 = { x: curr.x, y: p2.y };
      if (board[corner1.y][corner1.x] === null && checkLine(board, curr, corner1) && checkLine(board, corner1, p2)) {
        return [p1, curr, corner1, p2];
      }
      const corner2 = { x: p2.x, y: curr.y };
      if (board[corner2.y][corner2.x] === null && checkLine(board, curr, corner2) && checkLine(board, corner2, p2)) {
        return [p1, curr, corner2, p2];
      }
      
      curr = { x: curr.x + dx, y: curr.y + dy };
    }
  }

  return null;
}

export const LinkUpGame: React.FC<LinkUpGameProps> = ({ character, onClose, onSendToChat }) => {
  const [board, setBoard] = useState<(string | null)[][]>([]);
  const [selected, setSelected] = useState<Point | null>(null);
  const [lines, setLines] = useState<Point[] | null>(null);
  const [userScore, setUserScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [isAiTurn, setIsAiTurn] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const initGame = useCallback(() => {
    const emojisToUse = EMOJIS.slice(0, 9);
    let tiles: string[] = [];
    emojisToUse.forEach(e => {
      tiles.push(e, e, e, e);
    });
    tiles.sort(() => Math.random() - 0.5);

    const newBoard: (string | null)[][] = Array(ROWS + 2).fill(null).map(() => Array(COLS + 2).fill(null));
    let idx = 0;
    for (let r = 1; r <= ROWS; r++) {
      for (let c = 1; c <= COLS; c++) {
        newBoard[r][c] = tiles[idx++];
      }
    }
    setBoard(newBoard);
    setSelected(null);
    setLines(null);
    setUserScore(0);
    setAiScore(0);
    setIsAiTurn(false);
    setGameOver(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const checkGameOver = (currentBoard: (string | null)[][]) => {
    for (let r = 1; r <= ROWS; r++) {
      for (let c = 1; c <= COLS; c++) {
        if (currentBoard[r][c] !== null) return false;
      }
    }
    return true;
  };

  const hasValidMoves = (currentBoard: (string | null)[][]) => {
    for (let r1 = 1; r1 <= ROWS; r1++) {
      for (let c1 = 1; c1 <= COLS; c1++) {
        if (currentBoard[r1][c1] === null) continue;
        for (let r2 = 1; r2 <= ROWS; r2++) {
          for (let c2 = 1; c2 <= COLS; c2++) {
            if (r1 === r2 && c1 === c2) continue;
            if (currentBoard[r2][c2] === null) continue;
            if (currentBoard[r1][c1] !== currentBoard[r2][c2]) continue;
            if (findPath(currentBoard, { x: c1, y: r1 }, { x: c2, y: r2 })) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  const handleTileClick = (r: number, c: number) => {
    if (isAiTurn || gameOver || board[r][c] === null) return;

    if (!selected) {
      setSelected({ x: c, y: r });
      return;
    }

    if (selected.x === c && selected.y === r) {
      setSelected(null);
      return;
    }

    const path = findPath(board, selected, { x: c, y: r });
    if (path) {
      setLines(path);
      const newBoard = [...board.map(row => [...row])];
      newBoard[selected.y][selected.x] = null;
      newBoard[r][c] = null;
      
      setTimeout(() => {
        setBoard(newBoard);
        setLines(null);
        setSelected(null);
        setUserScore(s => s + 1);
        
        if (checkGameOver(newBoard)) {
          setGameOver(true);
          onSendToChat(`连连看游戏结束！我得了 ${aiScore} 分，你得了 ${userScore + 1} 分。`);
        } else if (!hasValidMoves(newBoard)) {
          setGameOver(true);
          onSendToChat(`好像没有可以连的了！游戏结束，我得了 ${aiScore} 分，你得了 ${userScore + 1} 分。`);
        } else {
          setIsAiTurn(true);
        }
      }, 500);
    } else {
      setSelected({ x: c, y: r });
    }
  };

  useEffect(() => {
    if (!isAiTurn || gameOver) return;

    const timer = setTimeout(() => {
      let found = false;
      for (let r1 = 1; r1 <= ROWS && !found; r1++) {
        for (let c1 = 1; c1 <= COLS && !found; c1++) {
          if (board[r1][c1] === null) continue;
          for (let r2 = 1; r2 <= ROWS && !found; r2++) {
            for (let c2 = 1; c2 <= COLS && !found; c2++) {
              if (r1 === r2 && c1 === c2) continue;
              if (board[r2][c2] === null) continue;
              if (board[r1][c1] !== board[r2][c2]) continue;

              const path = findPath(board, { x: c1, y: r1 }, { x: c2, y: r2 });
              if (path) {
                found = true;
                setLines(path);
                const newBoard = [...board.map(row => [...row])];
                newBoard[r1][c1] = null;
                newBoard[r2][c2] = null;
                
                setTimeout(() => {
                  setBoard(newBoard);
                  setLines(null);
                  setAiScore(s => s + 1);
                  if (checkGameOver(newBoard)) {
                    setGameOver(true);
                    onSendToChat(`连连看游戏结束！我得了 ${aiScore + 1} 分，你得了 ${userScore} 分。`);
                  } else if (!hasValidMoves(newBoard)) {
                    setGameOver(true);
                    onSendToChat(`好像没有可以连的了！游戏结束，我得了 ${aiScore + 1} 分，你得了 ${userScore} 分。`);
                  } else {
                    setIsAiTurn(false);
                  }
                }, 800);
              }
            }
          }
        }
      }

      if (!found) {
        setGameOver(true);
        onSendToChat(`好像没有可以连的了！游戏结束，我得了 ${aiScore} 分，你得了 ${userScore} 分。`);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [isAiTurn, board, gameOver, aiScore, userScore, onSendToChat]);

  const renderLines = () => {
    if (!lines) return null;
    
    return (
      <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: '100%', height: '100%' }}>
        {lines.map((p, i) => {
          if (i === 0) return null;
          const prev = lines[i - 1];
          const x1 = prev.x * 44 + 20;
          const y1 = prev.y * 44 + 20;
          const x2 = p.x * 44 + 20;
          const y2 = p.y * 44 + 20;
          
          return (
            <line 
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2} 
              stroke="#8b5cf6" 
              strokeWidth="4" 
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    );
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-between w-full mb-4 px-4">
        <div className="flex flex-col items-center">
          <span className="text-sm text-zinc-500">你</span>
          <span className="text-2xl font-bold text-blue-500">{userScore}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-zinc-800">{isAiTurn ? `${character.name} 思考中...` : '你的回合'}</span>
          {gameOver && <span className="text-sm text-red-500 font-bold">游戏结束</span>}
        </div>
        <div className="flex flex-col items-center">
          <span className="text-sm text-zinc-500">{character.name}</span>
          <span className="text-2xl font-bold text-purple-500">{aiScore}</span>
        </div>
      </div>

      <div className="relative bg-zinc-100 p-2 rounded-xl overflow-hidden">
        <div 
          className="grid gap-1 relative" 
          style={{ 
            gridTemplateColumns: `repeat(${COLS + 2}, 40px)`,
            gridTemplateRows: `repeat(${ROWS + 2}, 40px)`
          }}
        >
          {board.map((row, r) => 
            row.map((cell, c) => {
              const isSelected = selected?.x === c && selected?.y === r;
              const isBorder = r === 0 || r === ROWS + 1 || c === 0 || c === COLS + 1;
              
              return (
                <div 
                  key={`${r}-${c}`}
                  onClick={() => !isBorder && handleTileClick(r, c)}
                  className={`
                    w-10 h-10 flex items-center justify-center text-2xl rounded-lg
                    ${isBorder ? 'pointer-events-none' : 'bg-white shadow-sm cursor-pointer hover:bg-blue-50'}
                    ${isSelected ? 'ring-2 ring-blue-500 bg-blue-100 scale-110 z-10' : ''}
                    ${cell === null && !isBorder ? 'opacity-0 pointer-events-none' : ''}
                    transition-all duration-200
                  `}
                >
                  {cell}
                </div>
              );
            })
          )}
          {renderLines()}
        </div>
      </div>

      <button
        onClick={initGame}
        className="mt-6 flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-700 rounded-full hover:bg-zinc-200 transition-colors"
      >
        <RefreshCw size={16} />
        重新开始
      </button>
    </div>
  );
};

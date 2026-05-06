import React, { useState, useEffect, useCallback } from 'react';
import { Character } from '../../types';
import { RefreshCw, Send } from 'lucide-react';

interface LinkUpGameProps {
  character: Character;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

type Point = { x: number; y: number };

const EMOJIS = ['🍓', '🍒', '🍌', '🍏', '🍜', '🍚', '🍓', '🥢', '🍇', '🍐', '🍱', '🍙'];
const ROWS = 6;
const COLS = 6;

function checkLine(board: (string | null)[][], p1: Point, p2: Point): boolean {
  if (p1.x !== p2.x && p1.y !== p2.y) return false;
  if (p1.x === p2.x) {
    const min = Math.min(p1.y, p2.y);
    const max = Math.max(p1.y, p2.y);
    for (let y = min + 1; y < max; y += 1) {
      if (board[y][p1.x] !== null) return false;
    }
    return true;
  }

  const min = Math.min(p1.x, p2.x);
  const max = Math.max(p1.x, p2.x);
  for (let x = min + 1; x < max; x += 1) {
    if (board[p1.y][x] !== null) return false;
  }
  return true;
}

function findPath(board: (string | null)[][], p1: Point, p2: Point): Point[] | null {
  if (board[p1.y][p1.x] !== board[p2.y][p2.x]) return null;
  if (p1.x === p2.x && p1.y === p2.y) return null;

  if (checkLine(board, p1, p2)) return [p1, p2];

  const c1 = { x: p1.x, y: p2.y };
  if (board[c1.y][c1.x] === null && checkLine(board, p1, c1) && checkLine(board, c1, p2)) {
    return [p1, c1, p2];
  }
  const c2 = { x: p2.x, y: p1.y };
  if (board[c2.y][c2.x] === null && checkLine(board, p1, c2) && checkLine(board, c2, p2)) {
    return [p1, c2, p2];
  }

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

function buildShareText(aiScore: number, userScore: number, reason: 'cleared' | 'stalled') {
  if (reason === 'cleared') {
    return `连连看游戏结束！我得了 ${aiScore} 分，你得了 ${userScore} 分。`;
  }
  return `好像没有可以连的了！游戏结束，我得了 ${aiScore} 分，你得了 ${userScore} 分。`;
}

export const LinkUpGame: React.FC<LinkUpGameProps> = ({ onClose, onSendToChat }) => {
  const [board, setBoard] = useState<(string | null)[][]>([]);
  const [selected, setSelected] = useState<Point | null>(null);
  const [lines, setLines] = useState<Point[] | null>(null);
  const [userScore, setUserScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [isAiTurn, setIsAiTurn] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [shareText, setShareText] = useState('');

  const initGame = useCallback(() => {
    const emojisToUse = EMOJIS.slice(0, 9);
    const tiles: string[] = [];
    emojisToUse.forEach((emoji) => {
      tiles.push(emoji, emoji, emoji, emoji);
    });
    tiles.sort(() => Math.random() - 0.5);

    const newBoard: (string | null)[][] = Array(ROWS + 2).fill(null).map(() => Array(COLS + 2).fill(null));
    let index = 0;
    for (let row = 1; row <= ROWS; row += 1) {
      for (let col = 1; col <= COLS; col += 1) {
        newBoard[row][col] = tiles[index++];
      }
    }

    setBoard(newBoard);
    setSelected(null);
    setLines(null);
    setUserScore(0);
    setAiScore(0);
    setIsAiTurn(false);
    setGameOver(false);
    setShareText('');
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const checkGameOver = (currentBoard: (string | null)[][]) => {
    for (let row = 1; row <= ROWS; row += 1) {
      for (let col = 1; col <= COLS; col += 1) {
        if (currentBoard[row][col] !== null) return false;
      }
    }
    return true;
  };

  const hasValidMoves = (currentBoard: (string | null)[][]) => {
    for (let r1 = 1; r1 <= ROWS; r1 += 1) {
      for (let c1 = 1; c1 <= COLS; c1 += 1) {
        if (currentBoard[r1][c1] === null) continue;
        for (let r2 = 1; r2 <= ROWS; r2 += 1) {
          for (let c2 = 1; c2 <= COLS; c2 += 1) {
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

  const finishGame = useCallback((nextAiScore: number, nextUserScore: number, reason: 'cleared' | 'stalled') => {
    setGameOver(true);
    setIsAiTurn(false);
    setShareText(buildShareText(nextAiScore, nextUserScore, reason));
  }, []);

  const handleTileClick = (row: number, col: number) => {
    if (isAiTurn || gameOver || board[row][col] === null) return;

    if (!selected) {
      setSelected({ x: col, y: row });
      return;
    }

    if (selected.x === col && selected.y === row) {
      setSelected(null);
      return;
    }

    const path = findPath(board, selected, { x: col, y: row });
    if (!path) {
      setSelected({ x: col, y: row });
      return;
    }

    setLines(path);
    const newBoard = [...board.map((boardRow) => [...boardRow])];
    newBoard[selected.y][selected.x] = null;
    newBoard[row][col] = null;

    setTimeout(() => {
      const nextUserScore = userScore + 1;
      setBoard(newBoard);
      setLines(null);
      setSelected(null);
      setUserScore(nextUserScore);

      if (checkGameOver(newBoard)) {
        finishGame(aiScore, nextUserScore, 'cleared');
      } else if (!hasValidMoves(newBoard)) {
        finishGame(aiScore, nextUserScore, 'stalled');
      } else {
        setIsAiTurn(true);
      }
    }, 500);
  };

  useEffect(() => {
    if (!isAiTurn || gameOver) return;

    const timer = setTimeout(() => {
      let found = false;
      for (let r1 = 1; r1 <= ROWS && !found; r1 += 1) {
        for (let c1 = 1; c1 <= COLS && !found; c1 += 1) {
          if (board[r1][c1] === null) continue;
          for (let r2 = 1; r2 <= ROWS && !found; r2 += 1) {
            for (let c2 = 1; c2 <= COLS && !found; c2 += 1) {
              if (r1 === r2 && c1 === c2) continue;
              if (board[r2][c2] === null) continue;
              if (board[r1][c1] !== board[r2][c2]) continue;

              const path = findPath(board, { x: c1, y: r1 }, { x: c2, y: r2 });
              if (!path) continue;

              found = true;
              setLines(path);
              const newBoard = [...board.map((boardRow) => [...boardRow])];
              newBoard[r1][c1] = null;
              newBoard[r2][c2] = null;

              setTimeout(() => {
                const nextAiScore = aiScore + 1;
                setBoard(newBoard);
                setLines(null);
                setAiScore(nextAiScore);

                if (checkGameOver(newBoard)) {
                  finishGame(nextAiScore, userScore, 'cleared');
                } else if (!hasValidMoves(newBoard)) {
                  finishGame(nextAiScore, userScore, 'stalled');
                } else {
                  setIsAiTurn(false);
                }
              }, 800);
            }
          }
        }
      }

      if (!found) {
        finishGame(aiScore, userScore, 'stalled');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [aiScore, board, finishGame, gameOver, isAiTurn, userScore]);

  const renderLines = () => {
    if (!lines) return null;

    return (
      <svg className="pointer-events-none absolute inset-0 z-10" style={{ width: '100%', height: '100%' }}>
        {lines.map((point, index) => {
          if (index === 0) return null;
          const prev = lines[index - 1];
          const x1 = prev.x * 44 + 20;
          const y1 = prev.y * 44 + 20;
          const x2 = point.x * 44 + 20;
          const y2 = point.y * 44 + 20;

          return (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
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
      <div className="mb-4 flex w-full justify-between px-4">
        <div className="flex flex-col items-center">
          <span className="text-sm text-zinc-500">你</span>
          <span className="text-2xl font-bold text-blue-500">{userScore}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-zinc-800">{isAiTurn ? '对方思考中...' : '你的回合'}</span>
          {gameOver && <span className="text-sm font-bold text-red-500">游戏结束</span>}
        </div>
        <div className="flex flex-col items-center">
          <span className="text-sm text-zinc-500">对方</span>
          <span className="text-2xl font-bold text-purple-500">{aiScore}</span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-zinc-100 p-2">
        <div
          className="relative grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${COLS + 2}, 40px)`,
            gridTemplateRows: `repeat(${ROWS + 2}, 40px)`,
          }}
        >
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const isSelected = selected?.x === colIndex && selected?.y === rowIndex;
              const isBorder = rowIndex === 0 || rowIndex === ROWS + 1 || colIndex === 0 || colIndex === COLS + 1;

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => !isBorder && handleTileClick(rowIndex, colIndex)}
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-lg text-2xl transition-all duration-200
                    ${isBorder ? 'pointer-events-none' : 'cursor-pointer bg-white shadow-sm hover:bg-blue-50'}
                    ${isSelected ? 'z-10 scale-110 bg-blue-100 ring-2 ring-blue-500' : ''}
                    ${cell === null && !isBorder ? 'pointer-events-none opacity-0' : ''}
                  `}
                >
                  {cell}
                </div>
              );
            }),
          )}
          {renderLines()}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {gameOver && shareText ? (
          <button
            onClick={() => {
              onSendToChat(shareText);
              onClose();
            }}
            className="flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-white transition-colors hover:bg-zinc-800"
          >
            <Send size={16} />
            发到聊天
          </button>
        ) : null}
        <button
          onClick={initGame}
          className="flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-200"
        >
          <RefreshCw size={16} />
          重新开始
        </button>
      </div>
    </div>
  );
};

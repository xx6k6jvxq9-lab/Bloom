import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BrickWall, CheckCircle2, Sparkles } from 'lucide-react';
import { Character } from '../../types';

interface DrawBlocksGameProps {
  character: Character;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

type CharacterPlayStyle = 'strategist' | 'gentle' | 'tsundere' | 'playful';
type Winner = 'user' | 'character' | null;

const TOTAL_BLOCKS = 21;

function resolveCharacterPlayStyle(character: Character): CharacterPlayStyle {
  const fingerprint = `${character.name} ${character.setting} ${character.expressionStyle || ''} ${character.signature || ''}`.toLowerCase();

  if (/冷静|清晰|理性|克制|测试|稳/.test(fingerprint)) {
    return 'strategist';
  }

  if (/青梅|照顾|偏爱|安静|温柔|兜底|陪/.test(fingerprint)) {
    return 'gentle';
  }

  if (/嘴硬|别扭|傲娇|逞强/.test(fingerprint)) {
    return 'tsundere';
  }

  return 'playful';
}

function clampTakeCount(value: number, remaining: number) {
  return Math.max(1, Math.min(3, Math.min(value, remaining)));
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function getCharacterOpening(character: Character, style: CharacterPlayStyle) {
  if (style === 'strategist') {
    return `${character.name}把积木在桌上排好，低声说：“来吧，别急着乱抽，我会认真陪你玩完这一局。”`;
  }

  if (style === 'gentle') {
    return `${character.name}把积木往你这边推了推：“你先来。我看着，别紧张，抽坏了也算我的。”`;
  }

  if (style === 'tsundere') {
    return `${character.name}抬了抬眼：“规则很简单。别一会儿输急了又赖我。”`;
  }

  return `${character.name}把积木塔敲得轻轻作响：“试试看？这局我可不一定让你。”`;
}

function getCharacterReaction(
  character: Character,
  style: CharacterPlayStyle,
  drawCount: number,
  remaining: number,
  isWinningMove: boolean,
) {
  if (isWinningMove) {
    if (style === 'strategist') {
      return `${character.name}抽走了 ${drawCount} 根，指尖轻敲桌面：“收官了。你刚刚那一步，还是给我留了口子。”`;
    }
    if (style === 'gentle') {
      return `${character.name}轻轻抽走 ${drawCount} 根，朝你弯了弯眼：“这局我先赢一次。下局我还陪你。”`;
    }
    if (style === 'tsundere') {
      return `${character.name}把最后 ${drawCount} 根拿开，语气淡淡的：“嗯，我赢了。你刚才要是再稳一点，也不是没机会。”`;
    }
    return `${character.name}利落抽走 ${drawCount} 根，笑了一下：“被我拿下了。你刚才已经快追上我了。”`;
  }

  if (remaining <= 4) {
    if (style === 'strategist') {
      return `${character.name}抽走 ${drawCount} 根，剩下 ${remaining} 根：“现在局面很窄了。你可以再想一秒。”`;
    }
    if (style === 'gentle') {
      return `${character.name}抽走 ${drawCount} 根，抬眼看你：“只剩 ${remaining} 根了。别慌，慢一点选。”`;
    }
    if (style === 'tsundere') {
      return `${character.name}拿走 ${drawCount} 根，轻哼一声：“剩 ${remaining} 根。你最好别手抖。”`;
    }
    return `${character.name}抽走 ${drawCount} 根，眨了下眼：“只剩 ${remaining} 根了，这下有意思了。”`;
  }

  if (style === 'strategist') {
    return `${character.name}抽走 ${drawCount} 根，目光没离开积木：“我在算。你也别只凭感觉。”`;
  }

  if (style === 'gentle') {
    return `${character.name}抽走 ${drawCount} 根，声音很稳：“到你了。我会看着你抽，不催你。”`;
  }

  if (style === 'tsundere') {
    return `${character.name}抽走 ${drawCount} 根，嘴上还是淡的：“轮到你。可别真输给我得这么快。”`;
  }

  return `${character.name}顺手抽走 ${drawCount} 根：“到你。让我看看你这次想怎么接。”`;
}

function getResultLine(character: Character, style: CharacterPlayStyle, winner: Winner) {
  if (winner === 'character') {
    if (style === 'gentle') {
      return `${character.name}赢下了这局，但语气还是软的：“我先记一分。你要是想翻盘，我可以继续陪你。”`;
    }
    if (style === 'tsundere') {
      return `${character.name}看着你，唇角压了压：“这局算我赢。下次别让我这么轻松。”`;
    }
    if (style === 'strategist') {
      return `${character.name}收起最后一根积木：“这局我拿下了。不过你已经开始会卡我的节奏了。”`;
    }
    return `${character.name}笑着把最后一根积木放到手心：“我赢了。你差一点点，再来一局会很近。”`;
  }

  if (style === 'gentle') {
    return `${character.name}看着你赢下来，没恼，只是低声说：“行，你这次比我稳。我认。”`;
  }
  if (style === 'tsundere') {
    return `${character.name}顿了下，还是承认了：“行，这局你赢。别一副早就知道会这样似的。”`;
  }
  if (style === 'strategist') {
    return `${character.name}看着桌上空掉的积木列，轻轻点头：“这步选得对。你赢得很干净。”`;
  }
  return `${character.name}望着你手里的最后一根积木，笑意更明显了：“好吧，这局让你拿到了。”`;
}

function getCharacterMove(remaining: number, style: CharacterPlayStyle) {
  const winningMove = remaining % 4 === 0 ? 3 : (remaining % 4) - 1;
  const preferred = winningMove >= 1 && winningMove <= 3 ? winningMove : clampTakeCount(Math.ceil(Math.random() * 3), remaining);

  const styleAccuracyMap: Record<CharacterPlayStyle, number> = {
    strategist: 0.9,
    gentle: 0.72,
    tsundere: 0.8,
    playful: 0.58,
  };

  const accuracy = styleAccuracyMap[style];
  const shouldPlayOptimal = Math.random() < accuracy;

  if (shouldPlayOptimal) {
    return clampTakeCount(preferred, remaining);
  }

  const casualChoices = [1, 2, 3]
    .filter((count) => count <= remaining && count !== preferred);

  if (casualChoices.length === 0) {
    return clampTakeCount(preferred, remaining);
  }

  return pickRandom(casualChoices);
}

export const DrawBlocksGame: React.FC<DrawBlocksGameProps> = ({ character, onClose, onSendToChat }) => {
  const style = useMemo(() => resolveCharacterPlayStyle(character), [character]);
  const timeoutRef = useRef<number | null>(null);
  const [remainingBlocks, setRemainingBlocks] = useState(TOTAL_BLOCKS);
  const [playerTaken, setPlayerTaken] = useState(0);
  const [characterTaken, setCharacterTaken] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<'user' | 'character'>('user');
  const [winner, setWinner] = useState<Winner>(null);
  const [statusText, setStatusText] = useState(() => getCharacterOpening(character, style));

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleReset = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setRemainingBlocks(TOTAL_BLOCKS);
    setPlayerTaken(0);
    setCharacterTaken(0);
    setCurrentTurn('user');
    setWinner(null);
    setStatusText(getCharacterOpening(character, style));
  };

  const finishRound = (roundWinner: Winner, nextRemaining: number, summaryLine: string) => {
    setWinner(roundWinner);
    setCurrentTurn('user');
    setRemainingBlocks(nextRemaining);
    setStatusText(summaryLine);
  };

  const handleCharacterTurn = (remainingAfterUserMove: number) => {
    setCurrentTurn('character');
    setStatusText(`${character.name}正在看着积木，像是在算你刚才那一步。`);

    timeoutRef.current = window.setTimeout(() => {
      const takeCount = getCharacterMove(remainingAfterUserMove, style);
      const nextRemaining = Math.max(0, remainingAfterUserMove - takeCount);
      const isWinningMove = nextRemaining === 0;

      setCharacterTaken((prev) => prev + takeCount);

      if (isWinningMove) {
        finishRound('character', nextRemaining, getResultLine(character, style, 'character'));
        return;
      }

      setRemainingBlocks(nextRemaining);
      setCurrentTurn('user');
      setStatusText(getCharacterReaction(character, style, takeCount, nextRemaining, false));
    }, 720);
  };

  const handlePlayerMove = (takeCount: number) => {
    if (currentTurn !== 'user' || winner) {
      return;
    }

    const actualTakeCount = clampTakeCount(takeCount, remainingBlocks);
    const nextRemaining = Math.max(0, remainingBlocks - actualTakeCount);

    setPlayerTaken((prev) => prev + actualTakeCount);

    if (nextRemaining === 0) {
      finishRound('user', nextRemaining, getResultLine(character, style, 'user'));
      return;
    }

    setRemainingBlocks(nextRemaining);
    handleCharacterTurn(nextRemaining);
  };

  const handleSendResult = () => {
    const resultSummary = [
      `你和${character.name}玩了一局抽积木。`,
      `你一共抽了 ${playerTaken} 根，${character.name}抽了 ${characterTaken} 根。`,
      winner === 'user' ? '结果：这局你赢了。' : `结果：这局${character.name}赢了。`,
      statusText,
    ].join('\n');

    const data = {
      game: 'blocks',
      type: 'result',
      question: `${character.name}和你完成了一局抽积木`,
      content: resultSummary,
    };

    onSendToChat(`[GAME_CARD] ${JSON.stringify(data)}`);
    onClose();
  };

  return (
    <div className="flex h-full w-full flex-col items-center py-2">
      <div className="text-center mb-5">
        <h3 className="text-xl font-bold text-zinc-800 flex items-center justify-center gap-2">
          <BrickWall className="text-amber-500" size={20} />
          抽积木
        </h3>
        <p className="text-zinc-400 text-xs mt-1 font-medium tracking-wider">
          和 {character.name} 一起抽，不是和随机数玩
        </p>
      </div>

      <div className="w-full max-w-[300px] rounded-3xl border border-amber-100 bg-gradient-to-b from-amber-50 to-white p-4 shadow-sm">
        <div className="rounded-2xl bg-white/90 p-4 border border-amber-100">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
            <span>剩余积木</span>
            <span>{remainingBlocks} / {TOTAL_BLOCKS}</span>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {Array.from({ length: remainingBlocks }).map((_, index) => (
              <motion.div
                key={`${remainingBlocks}-${index}`}
                layout
                className="h-6 rounded-md bg-gradient-to-r from-amber-300 to-orange-300 shadow-[0_2px_6px_rgba(251,146,60,0.25)]"
              />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-zinc-950 px-4 py-3 text-white">
            <div className="text-[11px] uppercase tracking-widest text-zinc-400">你</div>
            <div className="mt-1 text-2xl font-bold">{playerTaken}</div>
            <div className="text-xs text-zinc-400">已抽走</div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 border border-zinc-200">
            <div className="text-[11px] uppercase tracking-widest text-zinc-400">{character.name}</div>
            <div className="mt-1 text-2xl font-bold text-zinc-800">{characterTaken}</div>
            <div className="text-xs text-zinc-400">已抽走</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
            <Sparkles size={16} className="text-amber-500" />
            {currentTurn === 'character' && !winner ? `${character.name} 的回合` : winner ? '这局结束了' : '你的回合'}
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-600 whitespace-pre-wrap">
            {statusText}
          </p>
        </div>
      </div>

      <div className="mt-5 grid w-full max-w-[300px] grid-cols-3 gap-3">
        {[1, 2, 3].map((count) => (
          <button
            key={count}
            onClick={() => handlePlayerMove(count)}
            disabled={currentTurn !== 'user' || !!winner || remainingBlocks < count}
            className="rounded-2xl bg-white border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-amber-300 enabled:hover:bg-amber-50"
          >
            抽 {count} 根
          </button>
        ))}
      </div>

      <div className="mt-4 flex w-full max-w-[300px] items-center gap-3">
        <button
          onClick={handleReset}
          className="flex-1 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700 transition-all active:scale-95"
        >
          再来一局
        </button>
        <button
          onClick={handleSendResult}
          disabled={!winner}
          className="flex-[1.4] rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={16} />
            发回聊天
          </span>
        </button>
      </div>
    </div>
  );
};

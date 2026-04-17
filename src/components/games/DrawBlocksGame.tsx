import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BrickWall, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { Character } from '../../types';

interface DrawBlocksGameProps {
  character: Character;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

type CharacterPlayStyle = 'strategist' | 'gentle' | 'tsundere' | 'playful';
type PlayerTurn = 'user' | 'character';
type Winner = 'user' | 'character' | null;
type BlockOrientation = 'x' | 'z';

type TowerBlock = {
  id: string;
  layerIndex: number;
  slotIndex: number;
  centerX: number;
  width: number;
  depth: number;
  orientation: BlockOrientation;
  removedBy?: PlayerTurn;
  removedAt?: number;
};

type TowerState = {
  blocks: TowerBlock[];
  towerSeed: number;
  baseLean: number;
};

type StabilitySnapshot = {
  stable: boolean;
  risk: number;
  weakestLayer: number | null;
};

type RenderedTowerBlock = TowerBlock & {
  renderLayer: number;
};

const SCENE_WIDTH = 252;
const BLOCKS_PER_LAYER = 3;
const BLOCK_HEIGHT = 18;
const LAYER_STEP = 24;
const BASE_BLOCK_WIDTH = 64;
const MAX_CHARACTER_DELAY_MS = 950;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createSeededRandom(seed: number) {
  let current = seed % 2147483647;
  if (current <= 0) {
    current += 2147483646;
  }
  return () => {
    current = (current * 16807) % 2147483647;
    return (current - 1) / 2147483646;
  };
}

function resolveCharacterPlayStyle(character: Character): CharacterPlayStyle {
  const fingerprint = `${character.name} ${character.setting} ${character.expressionStyle || ''} ${character.signature || ''}`.toLowerCase();

  if (/冷静|清晰|理性|克制|测试|稳定|分析/.test(fingerprint)) {
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

function createRandomTower(): TowerState {
  const towerSeed = Math.floor(Date.now() + Math.random() * 100000);
  const random = createSeededRandom(towerSeed);
  const layerCount = 9 + Math.floor(random() * 2);
  const baseLean = (random() - 0.5) * 10;
  const blocks: TowerBlock[] = [];

  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    const orientation: BlockOrientation = layerIndex % 2 === 0 ? 'x' : 'z';
    const taper = 1 - (layerIndex / Math.max(1, layerCount - 1)) * 0.2;
    const layerShift = baseLean + (random() - 0.5) * 6 + (layerIndex - layerCount / 2) * ((random() - 0.5) * 0.8);

    for (let slotIndex = 0; slotIndex < BLOCKS_PER_LAYER; slotIndex += 1) {
      const slotShift = (slotIndex - 1) * (BASE_BLOCK_WIDTH - 18) * taper;
      const centerX = layerShift + slotShift + (random() - 0.5) * 2.5;
      const width = BASE_BLOCK_WIDTH + (random() - 0.5) * 3.5;

      blocks.push({
        id: `tower-${towerSeed}-${layerIndex}-${slotIndex}`,
        layerIndex,
        slotIndex,
        centerX,
        width,
        depth: 18,
        orientation,
      });
    }
  }

  return { blocks, towerSeed, baseLean };
}

function getPresentBlocks(blocks: TowerBlock[]) {
  return blocks.filter((block) => !block.removedBy);
}

function getHighestLayer(blocks: TowerBlock[]) {
  return blocks.reduce((max, block) => Math.max(max, block.layerIndex), 0);
}

function getLayerBlocks(blocks: TowerBlock[], layerIndex: number) {
  return blocks.filter((block) => !block.removedBy && block.layerIndex === layerIndex);
}

function getLayerSupportRange(blocks: TowerBlock[]) {
  if (blocks.length === 0) {
    return null;
  }

  return {
    min: Math.min(...blocks.map((block) => block.centerX - block.width / 2)),
    max: Math.max(...blocks.map((block) => block.centerX + block.width / 2)),
  };
}

function getUpperMassCenter(blocks: TowerBlock[], layerIndex: number) {
  const upperBlocks = blocks.filter((block) => !block.removedBy && block.layerIndex >= layerIndex);
  if (upperBlocks.length === 0) {
    return null;
  }

  return upperBlocks.reduce((sum, block) => sum + block.centerX, 0) / upperBlocks.length;
}

function evaluateTowerStability(blocks: TowerBlock[]): StabilitySnapshot {
  const presentBlocks = getPresentBlocks(blocks);
  const highestLayer = getHighestLayer(presentBlocks);
  let maxRisk = 0;
  let weakestLayer: number | null = null;

  for (let layerIndex = 0; layerIndex < highestLayer; layerIndex += 1) {
    const supportRange = getLayerSupportRange(getLayerBlocks(blocks, layerIndex));
    const upperCenter = getUpperMassCenter(blocks, layerIndex + 1);

    if (!supportRange || upperCenter === null) {
      continue;
    }

    const supportSpan = supportRange.max - supportRange.min;
    const margin = clamp(6 + supportSpan * 0.06, 6, 12);
    const riskLeft = supportRange.min + margin - upperCenter;
    const riskRight = upperCenter - (supportRange.max - margin);
    const localRisk = Math.max(0, riskLeft, riskRight);

    if (supportSpan < 56) {
      maxRisk = Math.max(maxRisk, 0.35);
    }

    if (localRisk > maxRisk) {
      maxRisk = localRisk;
      weakestLayer = layerIndex;
    }
  }

  return {
    stable: maxRisk < 8,
    risk: clamp(maxRisk / 14, 0, 1),
    weakestLayer,
  };
}

function describeBlockPosition(block: TowerBlock) {
  if (block.slotIndex === 1) {
    return '中间那根';
  }
  return block.slotIndex === 0 ? '左边那根' : '右边那根';
}

function getTowerIntro(character: Character, style: CharacterPlayStyle, layerCount: number) {
  if (style === 'strategist') {
    return `${character.name}把 ${layerCount} 层积木塔摆好，低声说：“这局塔型和上一把不同，先看支点再动手。”`;
  }
  if (style === 'gentle') {
    return `${character.name}把积木塔轻轻扶稳：“这次有点斜。你先挑，慢一点抽就好。”`;
  }
  if (style === 'tsundere') {
    return `${character.name}看了看塔：“先说好，倒了别怪我笑你。”`;
  }
  return `${character.name}把新塔推到你面前：“这次长得挺好看。来，挑一根试试。”`;
}

function getCharacterThinkingLine(character: Character, style: CharacterPlayStyle, targetBlock: TowerBlock, risk: number) {
  const position = describeBlockPosition(targetBlock);
  if (style === 'strategist') {
    return `${character.name}盯着第 ${targetBlock.layerIndex + 1} 层的${position}：“这根受力还行，风险大概 ${Math.round(risk * 100)}%。”`;
  }
  if (style === 'gentle') {
    return `${character.name}碰了碰第 ${targetBlock.layerIndex + 1} 层的${position}：“我试这根。如果太紧，我就换。”`;
  }
  if (style === 'tsundere') {
    return `${character.name}盯上第 ${targetBlock.layerIndex + 1} 层的${position}：“这根看着悬，但也不是不能碰。”`;
  }
  return `${character.name}已经看中第 ${targetBlock.layerIndex + 1} 层的${position}：“就它吧，抽出来应该挺顺手。”`;
}

function getCharacterAfterMoveLine(
  character: Character,
  style: CharacterPlayStyle,
  targetBlock: TowerBlock,
  stability: StabilitySnapshot,
) {
  const position = describeBlockPosition(targetBlock);

  if (!stability.stable) {
    if (style === 'gentle') {
      return `${character.name}刚抽出第 ${targetBlock.layerIndex + 1} 层的${position}，塔就开始偏了：“好吧，这次算我手重。”`;
    }
    if (style === 'tsundere') {
      return `${character.name}抽出第 ${targetBlock.layerIndex + 1} 层的${position}，塔身立刻一晃：“啧，这根比看上去更坏。”`;
    }
    if (style === 'strategist') {
      return `${character.name}抽出第 ${targetBlock.layerIndex + 1} 层的${position}后，支撑线断了：“这步判断差了一点。”`;
    }
    return `${character.name}刚把第 ${targetBlock.layerIndex + 1} 层的${position}抽出来，整座塔就歪了：“这次是我翻车了。”`;
  }

  if (style === 'strategist') {
    return `${character.name}稳稳抽出第 ${targetBlock.layerIndex + 1} 层的${position}：“还行，重心没彻底偏。到你。”`;
  }
  if (style === 'gentle') {
    return `${character.name}把第 ${targetBlock.layerIndex + 1} 层的${position}抽出来，顺手扶了扶塔：“还稳着，你来吧。”`;
  }
  if (style === 'tsundere') {
    return `${character.name}抽出第 ${targetBlock.layerIndex + 1} 层的${position}：“没倒。你别乱碰太险的。”`;
  }
  return `${character.name}抽出第 ${targetBlock.layerIndex + 1} 层的${position}后朝你扬了扬下巴：“还稳，接你。”`;
}

function getWinnerLine(character: Character, style: CharacterPlayStyle, winner: Winner) {
  if (winner === 'user') {
    if (style === 'gentle') {
      return `${character.name}看着塔在自己手里倒掉，还是笑了下：“这局算你赢。下局我再陪你追回来。”`;
    }
    if (style === 'tsundere') {
      return `${character.name}看着倒掉的塔：“行，这局你拿下。别太得意。”`;
    }
    if (style === 'strategist') {
      return `${character.name}把散开的积木重新拢了拢：“这局是你更稳。”`;
    }
    return `${character.name}望着散开的积木：“被你拿到了。下一局我不想再让你这么轻松。”`;
  }

  if (style === 'gentle') {
    return `${character.name}接住一根滑下来的积木：“这局我赢了，但你刚才已经很接近了。”`;
  }
  if (style === 'tsundere') {
    return `${character.name}看着倒下的塔，抬了抬下巴：“这局归我。你刚才那根本来就不该碰。”`;
  }
  if (style === 'strategist') {
    return `${character.name}望着失衡的塔身：“那根是连锁支点。你一碰，它就会倒。”`;
  }
  return `${character.name}看着倒下去的塔，眼里带着笑：“这局我赢。”`;
}

function getPlayableBlocks(blocks: TowerBlock[]) {
  const presentBlocks = getPresentBlocks(blocks);
  const topLayer = getHighestLayer(presentBlocks);
  const safeTopLimit = Math.max(0, topLayer - 1);

  return presentBlocks.filter((block) => {
    if (block.layerIndex >= safeTopLimit) {
      return true;
    }
    return getLayerBlocks(blocks, block.layerIndex).length > 1;
  });
}

function getHorizontalOverlap(left: TowerBlock, right: TowerBlock) {
  const leftMin = left.centerX - left.width / 2;
  const leftMax = left.centerX + left.width / 2;
  const rightMin = right.centerX - right.width / 2;
  const rightMax = right.centerX + right.width / 2;
  return Math.max(0, Math.min(leftMax, rightMax) - Math.max(leftMin, rightMin));
}

function computeRenderedTowerBlocks(blocks: TowerBlock[]): RenderedTowerBlock[] {
  const presentBlocks = getPresentBlocks(blocks).sort((left, right) => {
    if (left.layerIndex !== right.layerIndex) {
      return left.layerIndex - right.layerIndex;
    }
    return left.slotIndex - right.slotIndex;
  });

  const placedBlocks: RenderedTowerBlock[] = [];

  for (const block of presentBlocks) {
    const supporters = placedBlocks.filter((candidate) => {
      const overlap = getHorizontalOverlap(block, candidate);
      return overlap >= Math.min(block.width, candidate.width) * 0.22;
    });

    const highestSupportLayer = supporters.length > 0
      ? Math.max(...supporters.map((candidate) => candidate.renderLayer))
      : -1;

    placedBlocks.push({
      ...block,
      renderLayer: highestSupportLayer + 1,
    });
  }

  return blocks.map((block) => {
    const placed = placedBlocks.find((candidate) => candidate.id === block.id);
    return {
      ...block,
      renderLayer: placed?.renderLayer ?? block.layerIndex,
    };
  });
}

function chooseCharacterTarget(blocks: TowerBlock[], style: CharacterPlayStyle) {
  const candidates = getPlayableBlocks(blocks).map((block) => {
    const simulatedBlocks = blocks.map((item): TowerBlock =>
      item.id === block.id ? { ...item, removedBy: 'character', removedAt: Date.now() } : item,
    );
    const stability = evaluateTowerStability(simulatedBlocks);

    return {
      block,
      stability,
      score: (() => {
        if (style === 'strategist') {
          return stability.stable ? stability.risk + block.layerIndex * 0.02 : 9 + stability.risk;
        }
        if (style === 'gentle') {
          return stability.stable ? stability.risk * 0.7 + block.layerIndex * 0.03 : 10 + stability.risk;
        }
        if (style === 'tsundere') {
          return stability.stable ? stability.risk * 0.9 + Math.abs(block.slotIndex - 1) * 0.12 : 4 + stability.risk;
        }
        return stability.stable ? Math.abs(block.slotIndex - 1) * 0.08 + stability.risk * 0.95 : 2.8 + stability.risk;
      })(),
    };
  });

  candidates.sort((left, right) => left.score - right.score);
  return candidates[0] || null;
}

export const DrawBlocksGame: React.FC<DrawBlocksGameProps> = ({ character, onClose, onSendToChat }) => {
  const style = useMemo(() => resolveCharacterPlayStyle(character), [character]);
  const characterTimerRef = useRef<number | null>(null);
  const actionTimerRef = useRef<number | null>(null);

  const [towerState, setTowerState] = useState<TowerState>(() => createRandomTower());
  const [currentTurn, setCurrentTurn] = useState<PlayerTurn>('user');
  const [winner, setWinner] = useState<Winner>(null);
  const [statusText, setStatusText] = useState(() => {
    const initialTower = createRandomTower();
    return getTowerIntro(character, style, getHighestLayer(initialTower.blocks) + 1);
  });
  const [removedByUser, setRemovedByUser] = useState(0);
  const [removedByCharacter, setRemovedByCharacter] = useState(0);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [collapseAngle, setCollapseAngle] = useState(0);
  const [lastStability, setLastStability] = useState<StabilitySnapshot>(() => evaluateTowerStability(towerState.blocks));

  useEffect(() => {
    return () => {
      if (characterTimerRef.current !== null) {
        window.clearTimeout(characterTimerRef.current);
      }
      if (actionTimerRef.current !== null) {
        window.clearTimeout(actionTimerRef.current);
      }
    };
  }, []);

  const highestLayer = useMemo(() => getHighestLayer(towerState.blocks), [towerState.blocks]);
  const playableBlocks = useMemo(() => getPlayableBlocks(towerState.blocks), [towerState.blocks]);
  const renderedBlocks = useMemo(() => computeRenderedTowerBlocks(towerState.blocks), [towerState.blocks]);
  const visibleBlocks = useMemo(
    () => renderedBlocks.filter((block) => !block.removedBy || block.id === activeBlockId),
    [renderedBlocks, activeBlockId],
  );

  const resetGame = () => {
    const nextTower = createRandomTower();
    setTowerState(nextTower);
    setCurrentTurn('user');
    setWinner(null);
    setRemovedByUser(0);
    setRemovedByCharacter(0);
    setActiveBlockId(null);
    setCollapseAngle(0);
    setLastStability(evaluateTowerStability(nextTower.blocks));
    setStatusText(getTowerIntro(character, style, getHighestLayer(nextTower.blocks) + 1));
  };

  const applyRemoval = (blockId: string, actor: PlayerTurn, blockLine: string) => {
    setActiveBlockId(blockId);
    setStatusText(blockLine);

    actionTimerRef.current = window.setTimeout(() => {
      const nextBlocks = towerState.blocks.map((block): TowerBlock =>
        block.id === blockId
          ? {
              ...block,
              removedBy: actor,
              removedAt: Date.now(),
            }
          : block,
      );

      const nextStability = evaluateTowerStability(nextBlocks);
      const removedBlock = towerState.blocks.find((block) => block.id === blockId) || null;

      setTowerState((prev) => ({
        ...prev,
        blocks: nextBlocks,
      }));
      setLastStability(nextStability);
      setActiveBlockId(null);

      if (actor === 'user') {
        setRemovedByUser((prev) => prev + 1);
      } else {
        setRemovedByCharacter((prev) => prev + 1);
      }

      if (!removedBlock) {
        return;
      }

      if (!nextStability.stable) {
        const roundWinner: Winner = actor === 'user' ? 'character' : 'user';
        setWinner(roundWinner);
        setCurrentTurn('user');
        setCollapseAngle((removedBlock.slotIndex - 1) * 10 + (actor === 'user' ? -8 : 8));
        setStatusText(getWinnerLine(character, style, roundWinner));
        return;
      }

      if (actor === 'user') {
        setCurrentTurn('character');
        setStatusText(`${character.name}看着你抽走了第 ${removedBlock.layerIndex + 1} 层的${describeBlockPosition(removedBlock)}，正在挑下一根。`);
      } else {
        setCurrentTurn('user');
        setStatusText(getCharacterAfterMoveLine(character, style, removedBlock, nextStability));
      }
    }, 360);
  };

  const handleUserSelectBlock = (block: TowerBlock) => {
    if (currentTurn !== 'user' || winner || activeBlockId) {
      return;
    }

    const simulatedBlocks = towerState.blocks.map((item): TowerBlock =>
      item.id === block.id ? { ...item, removedBy: 'user', removedAt: Date.now() } : item,
    );
    const simulatedStability = evaluateTowerStability(simulatedBlocks);
    const stabilityTone = simulatedStability.risk < 0.28 ? '还算稳' : simulatedStability.risk < 0.56 ? '有点晃' : '很悬';

    applyRemoval(
      block.id,
      'user',
      `你捏住了第 ${block.layerIndex + 1} 层的${describeBlockPosition(block)}，慢慢往外抽。这根现在${stabilityTone}。`,
    );
  };

  useEffect(() => {
    if (currentTurn !== 'character' || winner || activeBlockId) {
      return;
    }

    const target = chooseCharacterTarget(towerState.blocks, style);
    if (!target) {
      return;
    }

    setStatusText(getCharacterThinkingLine(character, style, target.block, target.stability.risk));
    characterTimerRef.current = window.setTimeout(() => {
      applyRemoval(target.block.id, 'character', getCharacterThinkingLine(character, style, target.block, target.stability.risk));
    }, clamp(560 + target.stability.risk * 220, 560, MAX_CHARACTER_DELAY_MS));

    return () => {
      if (characterTimerRef.current !== null) {
        window.clearTimeout(characterTimerRef.current);
      }
    };
  }, [activeBlockId, character, currentTurn, style, towerState.blocks, winner]);

  const handleSendResult = () => {
    const totalLayers = highestLayer + 1;
    const resultSummary = [
      `你和${character.name}玩了一局抽积木塔。`,
      `这局塔一共有 ${totalLayers} 层，塔形是随机生成的。`,
      `你抽出了 ${removedByUser} 根，${character.name}抽出了 ${removedByCharacter} 根。`,
      winner === 'user' ? '结果：你让塔在对方手里倒了。' : '结果：你这边抽动后，塔倒了。',
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
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-t-[32px] bg-[linear-gradient(180deg,#9fd8ff_0%,#dff3ff_36%,#eef9ff_62%,#fff8ee_100%)]">
      <div className="pointer-events-none absolute inset-x-[-8%] top-[-84px] h-[210px] rounded-full bg-white/55 blur-3xl" />
      <div className="pointer-events-none absolute left-[-36px] top-[92px] h-24 w-24 rounded-full bg-white/70 blur-2xl" />
      <div className="pointer-events-none absolute right-[-14px] top-[76px] h-28 w-28 rounded-full bg-white/60 blur-2xl" />
      <div className="pointer-events-none absolute inset-x-0 bottom-[142px] mx-auto h-24 w-[72%] rounded-full bg-[radial-gradient(circle,rgba(247,185,70,0.16)_0%,rgba(247,185,70,0.04)_52%,transparent_76%)] blur-2xl" />

      <div className="relative z-10 flex items-center justify-between px-5 pt-4">
        <div className="rounded-full bg-white/64 px-4 py-2 shadow-[0_12px_28px_rgba(148,163,184,0.14)] backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
            <BrickWall className="text-amber-500" size={16} />
            抽积木塔
          </div>
        </div>
        <div className="rounded-full bg-white/58 px-3 py-2 text-xs font-semibold text-zinc-600 shadow-[0_10px_22px_rgba(148,163,184,0.12)] backdrop-blur-xl">
          稳定度 {Math.round((1 - lastStability.risk) * 100)}%
        </div>
      </div>

      <div className="relative z-10 flex-1 px-3 pb-3 pt-2">
        <div className="relative flex h-full min-h-[620px] flex-col overflow-hidden rounded-[30px] border border-white/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.08))] shadow-[0_24px_60px_rgba(148,163,184,0.18)] backdrop-blur-[18px]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[56%] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.62),rgba(255,255,255,0.08)_58%,transparent_78%)]" />

          <div className="relative h-[470px] shrink-0 overflow-hidden px-2 pt-5">
            <motion.div
              className="absolute inset-x-0 bottom-4 mx-auto h-[408px] w-[252px]"
              animate={{
                rotateZ: winner ? collapseAngle : 0,
                x: winner ? collapseAngle * 0.9 : 0,
                y: winner ? 14 : 0,
              }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            >
              {visibleBlocks.map((block) => {
                const isRemoved = !!block.removedBy;
                const isClickable = currentTurn === 'user' && !winner && !activeBlockId && playableBlocks.some((item) => item.id === block.id);
                const isActive = activeBlockId === block.id;
                const baseLeft = SCENE_WIDTH / 2 + block.centerX - block.width / 2;
                const bottom = block.renderLayer * LAYER_STEP + 12;
                const paletteIndex = (block.layerIndex + block.slotIndex) % 4;
                const blockPalette = [
                  {
                    body: 'linear-gradient(180deg, rgba(255,214,124,0.98), rgba(243,176,64,0.96) 100%)',
                    top: 'rgba(255, 236, 188, 0.88)',
                    side: 'rgba(214, 132, 34, 0.32)',
                    glow: 'rgba(245, 158, 11, 0.16)',
                  },
                  {
                    body: 'linear-gradient(180deg, rgba(255,243,212,0.98), rgba(236,208,154,0.96) 100%)',
                    top: 'rgba(255, 251, 241, 0.88)',
                    side: 'rgba(181, 145, 86, 0.24)',
                    glow: 'rgba(180, 145, 86, 0.12)',
                  },
                  {
                    body: 'linear-gradient(180deg, rgba(255,209,168,0.98), rgba(238,150,92,0.96) 100%)',
                    top: 'rgba(255, 233, 214, 0.88)',
                    side: 'rgba(191, 104, 49, 0.26)',
                    glow: 'rgba(234, 88, 12, 0.14)',
                  },
                  {
                    body: 'linear-gradient(180deg, rgba(252,224,145,0.98), rgba(224,172,48,0.96) 100%)',
                    top: 'rgba(255, 240, 189, 0.86)',
                    side: 'rgba(172, 126, 22, 0.24)',
                    glow: 'rgba(202, 138, 4, 0.14)',
                  },
                ][paletteIndex];

                return (
                  <motion.button
                    key={block.id}
                    type="button"
                    disabled={!isClickable}
                    onClick={() => handleUserSelectBlock(block)}
                    className={`absolute border-none bg-transparent p-0 text-left ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                    initial={false}
                    animate={{
                      left: baseLeft,
                      bottom,
                      opacity: isRemoved ? 0 : 1,
                      x: isActive ? (block.slotIndex - 1) * 8 + 106 : 0,
                      y: isActive ? -4 : 0,
                      rotateZ: winner && !isRemoved ? collapseAngle * ((block.layerIndex + 1) / Math.max(1, highestLayer + 1)) : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                    style={{
                      width: block.width + 16,
                      height: BLOCK_HEIGHT + 16,
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    <div className="relative h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
                      <div
                        className={`absolute inset-x-[8px] top-0 rounded-[14px] border ${isClickable ? 'border-white/80' : 'border-white/60'}`}
                        style={{
                          height: BLOCK_HEIGHT + 9,
                          background: blockPalette.body,
                          boxShadow: `0 10px 18px ${blockPalette.glow}, inset 0 1px 0 rgba(255,255,255,0.32)`,
                        }}
                      >
                        <div
                          className="absolute inset-x-[8px] top-[3px] h-[3px] rounded-full"
                          style={{ background: blockPalette.top }}
                        />
                        <div className="absolute bottom-[2px] left-[14px] right-[14px] h-[4px] rounded-full bg-black/5 blur-[1px]" />
                        {isClickable && <div className="absolute inset-0 rounded-[14px] bg-white/0 transition-colors hover:bg-white/10" />}
                      </div>
                      <div
                        className="absolute bottom-[2px] right-[6px] top-[7px] w-[10px] rounded-r-[11px]"
                        style={{
                          background: blockPalette.side,
                        }}
                      />
                      <div
                        className="absolute bottom-[-5px] left-[18px] right-[18px] h-[10px] rounded-full blur-[5px]"
                        style={{
                          background: blockPalette.glow,
                        }}
                      />
                    </div>
                  </motion.button>
                );
              })}

              <div className="absolute inset-x-7 bottom-0 h-4 rounded-full bg-[rgba(120,53,15,0.14)] blur-md" />
            </motion.div>
          </div>

          <div className="relative z-10 mt-auto px-3 pb-3">
            <div className="rounded-[24px] bg-white/54 p-3 shadow-[0_12px_32px_rgba(148,163,184,0.14)] backdrop-blur-xl">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[22px] bg-zinc-950/92 px-4 py-3 text-white shadow-[0_14px_28px_rgba(15,23,42,0.2)]">
                  <div className="text-[11px] uppercase tracking-widest text-zinc-400">YOU</div>
                  <div className="mt-1 text-2xl font-bold">{removedByUser}</div>
                </div>
                <div className="rounded-[22px] bg-white/86 px-4 py-3 text-zinc-800 shadow-[0_12px_24px_rgba(148,163,184,0.12)]">
                  <div className="text-[11px] uppercase tracking-widest text-zinc-400">{character.name}</div>
                  <div className="mt-1 text-2xl font-bold">{removedByCharacter}</div>
                </div>
              </div>

              <div className="mt-3 rounded-[22px] bg-white/74 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                  <Sparkles size={16} className="text-amber-500" />
                  {winner ? '这局结束了' : currentTurn === 'user' ? '你的回合：点一根积木' : `${character.name} 正在选积木`}
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                  {statusText}
                </p>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={resetGame}
                  className="flex-1 rounded-[20px] bg-white/84 px-4 py-3 text-sm font-semibold text-zinc-700 shadow-[0_10px_24px_rgba(148,163,184,0.14)] transition-all active:scale-95"
                >
                  <span className="inline-flex items-center gap-2">
                    <RotateCcw size={16} />
                    新塔重开
                  </span>
                </button>
                <button
                  onClick={handleSendResult}
                  disabled={!winner}
                  className="flex-[1.15] rounded-[20px] bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(245,158,11,0.24)] transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    发回聊天
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

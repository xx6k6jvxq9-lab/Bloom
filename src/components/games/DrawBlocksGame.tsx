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
  hue: number;
  tint: number;
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

const SCENE_WIDTH = 288;
const BLOCKS_PER_LAYER = 3;
const BLOCK_HEIGHT = 16;
const LAYER_STEP = 20;
const BASE_BLOCK_WIDTH = 72;
const BASE_BLOCK_DEPTH = 18;
const MAX_CHARACTER_DELAY_MS = 950;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
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
  const layerCount = 7 + Math.floor(random() * 2);
  const baseLean = (random() - 0.5) * 18;
  const blocks: TowerBlock[] = [];

  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    const orientation: BlockOrientation = layerIndex % 2 === 0 ? 'x' : 'z';
    const layerShift = baseLean + (random() - 0.5) * 12 + (layerIndex - layerCount / 2) * ((random() - 0.5) * 1.8);

    for (let slotIndex = 0; slotIndex < BLOCKS_PER_LAYER; slotIndex += 1) {
      const slotShift = (slotIndex - 1) * (BASE_BLOCK_WIDTH - 10);
      const centerX = layerShift + slotShift + (random() - 0.5) * 5;
      const width = BASE_BLOCK_WIDTH + (random() - 0.5) * 6;
      const depth = BASE_BLOCK_DEPTH + (random() - 0.5) * 4;
      const hue = 32 + Math.round(random() * 10);
      const tint = 56 + Math.round(random() * 16);

      blocks.push({
        id: `tower-${towerSeed}-${layerIndex}-${slotIndex}`,
        layerIndex,
        slotIndex,
        centerX,
        width,
        depth,
        hue,
        tint,
        orientation,
      });
    }
  }

  return { blocks, towerSeed, baseLean };
}

function getHighestLayer(blocks: TowerBlock[]) {
  return blocks.reduce((max, block) => Math.max(max, block.layerIndex), 0);
}

function getPresentBlocks(blocks: TowerBlock[]) {
  return blocks.filter((block) => !block.removedBy);
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

    if (supportSpan < 70) {
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
    return `${character.name}把 ${layerCount} 层积木塔摆好，指尖在塔边停了一下：“这次塔型不一样。你可以先观察，再决定抽哪根。”`;
  }
  if (style === 'gentle') {
    return `${character.name}把积木塔轻轻扶稳，往你这边看了一眼：“这次搭得有点斜。你先挑，别急，我会接着玩。”`;
  }
  if (style === 'tsundere') {
    return `${character.name}抱臂看着新塔型：“先说好，倒了算谁的手抖，不许赖塔。”`;
  }
  return `${character.name}把新一局积木塔推到中间：“这次塔长得不太一样。你挑一根，看看手气。”`;
}

function getCharacterThinkingLine(character: Character, style: CharacterPlayStyle, targetBlock: TowerBlock, risk: number) {
  const position = describeBlockPosition(targetBlock);
  if (style === 'strategist') {
    return `${character.name}盯着第 ${targetBlock.layerIndex + 1} 层的${position}：“这根现在的受力还行，风险大概在 ${Math.round(risk * 100)}% 左右。”`;
  }
  if (style === 'gentle') {
    return `${character.name}伸手去碰第 ${targetBlock.layerIndex + 1} 层的${position}：“我先试这根。要是它太紧，我会收手。”`;
  }
  if (style === 'tsundere') {
    return `${character.name}目光落在第 ${targetBlock.layerIndex + 1} 层的${position}：“这根看着别扭，但还没到不能碰的程度。”`;
  }
  return `${character.name}已经盯上第 ${targetBlock.layerIndex + 1} 层的${position}：“就它吧，抽出来应该会很好看。”`;
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
      return `${character.name}刚把第 ${targetBlock.layerIndex + 1} 层的${position}抽出来，塔就开始偏了：“……好，算我这次手重了。”`;
    }
    if (style === 'tsundere') {
      return `${character.name}抽出第 ${targetBlock.layerIndex + 1} 层的${position}，塔身随即一晃：“啧，这根比看上去更坏。”`;
    }
    if (style === 'strategist') {
      return `${character.name}抽出第 ${targetBlock.layerIndex + 1} 层的${position}后，塔的支撑线立刻断了：“判断差了一点，这局我认。”`;
    }
    return `${character.name}刚抽出第 ${targetBlock.layerIndex + 1} 层的${position}，整座塔就倒向一边：“好吧，这次是我翻车了。”`;
  }

  if (style === 'strategist') {
    return `${character.name}稳稳抽出第 ${targetBlock.layerIndex + 1} 层的${position}：“还行，重心没有彻底偏。到你了。”`;
  }
  if (style === 'gentle') {
    return `${character.name}把第 ${targetBlock.layerIndex + 1} 层的${position}抽了出来，顺手扶了一下塔边：“现在轮到你，慢一点抽。”`;
  }
  if (style === 'tsundere') {
    return `${character.name}抽出第 ${targetBlock.layerIndex + 1} 层的${position}，语气还是淡淡的：“没倒。你别挑太冒险的那根。”`;
  }
  return `${character.name}把第 ${targetBlock.layerIndex + 1} 层的${position}抽出来后朝你扬了扬下巴：“还稳着，接你。”`;
}

function getWinnerLine(character: Character, style: CharacterPlayStyle, winner: Winner) {
  if (winner === 'user') {
    if (style === 'gentle') {
      return `${character.name}看着塔在自己手里倒掉，还是轻轻笑了下：“这局算你赢。我下局会认真追回来。”`;
    }
    if (style === 'tsundere') {
      return `${character.name}看了一眼倒掉的塔：“行，这局你拿下。别一副早就知道我会失手的样子。”`;
    }
    if (style === 'strategist') {
      return `${character.name}把倒下的积木重新拢了一下：“这局是你更稳。我输在那根中层支点上。”`;
    }
    return `${character.name}望着散开的积木塔：“被你拿到了。下一局我不想再让你这么轻松。”`;
  }

  if (style === 'gentle') {
    return `${character.name}接住一根滑下来的积木，声音还是很低：“这局我赢了，但你刚才已经很接近了。”`;
  }
  if (style === 'tsundere') {
    return `${character.name}看着倒掉的塔，抬了抬下巴：“这局归我。你刚才那根本来就不该碰。”`;
  }
  if (style === 'strategist') {
    return `${character.name}望着失衡的塔身：“这根是连锁支点。你一碰，它就会倒。这局我收下了。”`;
  }
  return `${character.name}看着倒下去的塔，眼里带着笑：“这局我赢。你刚才明明已经快抽出来了。”`;
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
  const [statusText, setStatusText] = useState(() => getTowerIntro(character, style, getHighestLayer(createRandomTower().blocks) + 1));
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
  const visibleBlocks = useMemo(() => towerState.blocks.filter((block) => !block.removedBy || block.id === activeBlockId), [towerState.blocks, activeBlockId]);

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
      const nextBlocks = towerState.blocks.map((block) =>
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
    const stabilityTone =
      simulatedStability.risk < 0.28 ? '还算稳' : simulatedStability.risk < 0.56 ? '有点晃' : '很悬';

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
    <div className="flex h-full w-full flex-col items-center py-2">
      <div className="mb-5 text-center">
        <h3 className="flex items-center justify-center gap-2 text-xl font-bold text-zinc-800">
          <BrickWall className="text-amber-500" size={20} />
          抽积木塔
        </h3>
        <p className="mt-1 text-xs font-medium tracking-wider text-zinc-400">
          每一局塔形都不同，要点具体积木去抽
        </p>
      </div>

      <div className="w-full max-w-[320px] rounded-[28px] border border-amber-100 bg-gradient-to-b from-amber-50 to-white p-4 shadow-[0_20px_50px_rgba(249,115,22,0.08)]">
        <div className="rounded-[24px] border border-amber-100 bg-white/95 p-4">
          <div className="mb-3 flex items-center justify-between text-xs font-semibold text-zinc-500">
            <span>塔稳定度</span>
            <span>{Math.round((1 - lastStability.risk) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100">
            <motion.div
              className={`h-full rounded-full ${lastStability.risk > 0.55 ? 'bg-rose-400' : lastStability.risk > 0.3 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              animate={{ width: `${Math.max(10, (1 - lastStability.risk) * 100)}%` }}
            />
          </div>

          <div className="relative mx-auto mt-5 h-[260px] w-full overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(254,243,199,0.8)_55%,_rgba(255,237,213,0.65))]">
            <motion.div
              className="absolute inset-x-0 bottom-3 mx-auto h-[228px] w-[288px]"
              animate={{
                rotateZ: winner ? collapseAngle : 0,
                x: winner ? collapseAngle * 0.8 : 0,
                y: winner ? 12 : 0,
              }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            >
              {visibleBlocks.map((block) => {
                const isRemoved = !!block.removedBy;
                const isClickable = currentTurn === 'user' && !winner && !activeBlockId && playableBlocks.some((item) => item.id === block.id);
                const isActive = activeBlockId === block.id;
                const baseLeft = SCENE_WIDTH / 2 + block.centerX - block.width / 2;
                const bottom = block.layerIndex * LAYER_STEP + 8;
                const sideShade = block.orientation === 'x' ? 0.88 : 0.78;

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
                      x: isActive ? (block.slotIndex - 1) * 10 + 110 : 0,
                      y: isActive ? -4 : 0,
                      rotateZ: winner && !isRemoved ? collapseAngle * ((block.layerIndex + 1) / Math.max(1, highestLayer + 1)) : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                    style={{
                      width: block.width,
                      height: BLOCK_HEIGHT,
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    <div
                      className={`relative h-full w-full rounded-md border border-amber-300/80 shadow-[0_6px_12px_rgba(120,53,15,0.14)] ${isClickable ? 'ring-1 ring-transparent hover:ring-amber-300' : ''}`}
                      style={{
                        background: `linear-gradient(135deg, hsl(${block.hue} 90% ${block.tint + 8}%), hsl(${block.hue} 78% ${block.tint}%) 56%, hsl(${block.hue} 65% ${block.tint - 8}%))`,
                      }}
                    >
                      <div
                        className="absolute inset-y-[2px] right-[5px] w-[8px] rounded-sm"
                        style={{
                          background: `linear-gradient(180deg, rgba(120,53,15,${sideShade}), rgba(120,53,15,0.35))`,
                        }}
                      />
                      <div className="absolute inset-x-[8px] top-[4px] h-[2px] rounded-full bg-white/60" />
                      {isClickable && (
                        <div className="absolute inset-0 rounded-md bg-white/0 transition-colors hover:bg-white/12" />
                      )}
                    </div>
                  </motion.button>
                );
              })}

              <div className="absolute inset-x-6 bottom-0 h-3 rounded-full bg-[rgba(120,53,15,0.18)] blur-md" />
            </motion.div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-zinc-950 px-4 py-3 text-white">
              <div className="text-[11px] uppercase tracking-widest text-zinc-400">你</div>
              <div className="mt-1 text-2xl font-bold">{removedByUser}</div>
              <div className="text-xs text-zinc-400">已抽出</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-[11px] uppercase tracking-widest text-zinc-400">{character.name}</div>
              <div className="mt-1 text-2xl font-bold text-zinc-800">{removedByCharacter}</div>
              <div className="text-xs text-zinc-400">已抽出</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
              <Sparkles size={16} className="text-amber-500" />
              {winner ? '这局结束了' : currentTurn === 'user' ? '你的回合：点一根积木抽出来' : `${character.name} 正在选积木`}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
              {statusText}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex w-full max-w-[320px] items-center gap-3">
        <button
          onClick={resetGame}
          className="flex-1 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700 transition-all active:scale-95"
        >
          <span className="inline-flex items-center gap-2">
            <RotateCcw size={16} />
            新塔重开
          </span>
        </button>
        <button
          onClick={handleSendResult}
          disabled={!winner}
          className="flex-[1.2] rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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

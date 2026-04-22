import type { DreamNarrativeBlock, DreamNarrativeDocument, DreamNarrativePage } from './dreamNarrativeSchema';
import { resolveDreamPresentation } from './resolveDreamPresentation';
import type {
  DreamCustomChoice,
  DreamEndingInput,
  DreamAftermathInput,
  DreamGeneratedChoice,
  DreamPresentation,
  DreamRuntimeAct,
  DreamRuntimeChoiceSet,
  DreamSelection,
  DreamStoryFrame,
} from './dreamRuntimeTypes';

type RawNarrativeBlock = Partial<DreamNarrativeBlock>;
type RawNarrativePage = {
  id?: string;
  title?: string;
  blocks?: RawNarrativeBlock[];
};

type RawNarrativeDocument = {
  themeId?: string;
  layoutId?: string;
  pages?: RawNarrativePage[];
};

export type RawChoice = {
  id?: string;
  title?: string;
  direction?: string;
  detail?: string;
  reactionHint?: string;
  storyPush?: string;
  emotion?: string;
};

export type RawAct = {
  id?: string;
  label?: string;
  scene?: string;
  charState?: string;
  narrative?: RawNarrativeDocument;
  choices?: RawChoice[];
  progression?: {
    consequence?: string;
    plotAdvance?: string;
    tensionShift?: string;
  };
};

export type RawScenario = {
  coverTitle?: string;
  coverSubtitle?: string;
  confirmHint?: string;
  storyFrame?: Partial<DreamStoryFrame>;
  acts?: RawAct[];
  endingInput?: Partial<DreamEndingInput>;
  aftermathInput?: Partial<DreamAftermathInput>;
};

function hasSelected(selection: DreamSelection, categories: string[]) {
  return categories.some((category) => (selection.selectedTags[category as keyof typeof selection.selectedTags] ?? []).length > 0);
}

function allowsExtraMechanics(selection: DreamSelection) {
  const selectedIds = Object.values(selection.selectedTags).flat();
  const mechanicTags = new Set([
    'rules',
    'folk-horror',
    'crime-suspense',
    'closed-mystery',
    'infinite',
    'game-world',
    'apocalypse',
    'urban-fantasy',
    'spiritual-revival',
    'time-loop',
    'parallel-world',
    'dream-therapy',
    'body-swap',
    'book-transmigration',
    'rebirth-line',
    'system-mission',
    'seven-rules',
    'one-night-countdown',
    'hidden-permission',
    'script-rewrites',
    'vote-to-survive',
    'door-after-midnight',
    'shop-trades-memory',
    'sealed-memory',
    'swapped-memory',
    'dream-leaks',
    'phone-from-future',
    'photo-changed',
    'calendar-missing-day',
    'mirror-message',
    'name-erased',
    'forced-live-stream',
    'quiet-creepy',
    'absurd-rule',
    'not-touch',
    'not-admit',
    'identity-reveal',
    'everyone-secret',
    'familiar-suspicious',
    'truth-barb',
    'world-offline',
  ]);
  return selectedIds.some((id) => mechanicTags.has(id));
}

const extraMechanicPattern = /规则|禁忌|倒计时|契约|审判|预言|试炼|阵营|身份壳|隐藏身份|秘密身份|观众|视线|学生壳子|都市囚笼|时间流速|流速|不稳定|共享记忆|记忆共享|梦境稳定|稳定世界|世界机制|回溯|系统|权限|诅咒|法则|异变|无限流|末日|深空|神明|神权|副本|投票|直播|剧本|惩罚|封印|污染|怪谈/u;

function stripExtraMechanicSentences(text: string, selection: DreamSelection) {
  const trimmed = text.trim();
  if (!trimmed || selection.entryMode !== 'custom' || allowsExtraMechanics(selection)) {
    return trimmed;
  }

  const sentences = trimmed
    .split(/(?<=[。！？；.!?;])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length === 0) {
    return extraMechanicPattern.test(trimmed) ? '' : trimmed;
  }

  const kept = sentences.filter((sentence) => !extraMechanicPattern.test(sentence));
  return kept.join('');
}

export function sanitizeCustomStoryFrame(storyFrame: DreamStoryFrame, selection: DreamSelection): DreamStoryFrame {
  if (selection.entryMode !== 'custom') return storyFrame;

  const backgroundSelected = hasSelected(selection, ['world', 'genre', 'climate', 'camp', 'faction']);
  const identitySelected = hasSelected(selection, ['identity', 'participants']);
  const relationshipSelected = hasSelected(selection, ['tension', 'lead']);
  const driveSelected = hasSelected(selection, ['drive', 'interaction', 'intensity']);

  return {
    worldTitle: backgroundSelected ? stripExtraMechanicSentences(storyFrame.worldTitle, selection) : '',
    worldSummary: backgroundSelected ? stripExtraMechanicSentences(storyFrame.worldSummary, selection) : '',
    userDreamIdentity: identitySelected ? stripExtraMechanicSentences(storyFrame.userDreamIdentity, selection) : '',
    characterDreamIdentity: identitySelected ? stripExtraMechanicSentences(storyFrame.characterDreamIdentity, selection) : '',
    dreamRelationship: relationshipSelected ? stripExtraMechanicSentences(storyFrame.dreamRelationship, selection) : '',
    openingNode: driveSelected ? stripExtraMechanicSentences(storyFrame.openingNode, selection) : '',
    storyObjective: driveSelected ? stripExtraMechanicSentences(storyFrame.storyObjective, selection) : '',
    coreConflict: '',
    realityAnchor: '',
    timeNode: '',
    currentCrisis: '',
    forbiddenRule: '',
    immediateGoal: driveSelected ? stripExtraMechanicSentences(storyFrame.immediateGoal, selection) : '',
  };
}

export function sanitizeCustomAct(act: DreamRuntimeAct, selection: DreamSelection): DreamRuntimeAct {
  if (selection.entryMode !== 'custom' || allowsExtraMechanics(selection)) return act;

  const scene = stripExtraMechanicSentences(act.scene, selection);
  const charState = stripExtraMechanicSentences(act.charState, selection);
  const narrative = {
    ...act.narrative,
    pages: act.narrative.pages.map((page) => ({
      ...page,
      blocks: page.blocks
        .map((block) => ({
          ...block,
          text: stripExtraMechanicSentences(block.text, selection),
        }))
        .filter((block) => block.text.trim()),
    })),
  };

  return {
    ...act,
    scene,
    charState,
    narrative,
    progression: {
      consequence: stripExtraMechanicSentences(act.progression.consequence, selection),
      plotAdvance: stripExtraMechanicSentences(act.progression.plotAdvance, selection),
      tensionShift: stripExtraMechanicSentences(act.progression.tensionShift, selection),
    },
  };
}

function splitSceneParagraphs(scene: string) {
  return scene
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitSceneSentences(scene: string) {
  return scene
    .split(/(?<=[。！？!?；;：:])/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function splitLongParagraph(paragraph: string) {
  if (paragraph.length <= 110) {
    return [paragraph];
  }

  const sentences = splitSceneSentences(paragraph);
  if (sentences.length <= 1) {
    return [paragraph];
  }

  const chunks: string[] = [];
  let current = '';

  sentences.forEach((sentence) => {
    if ((current + sentence).length > 100 && current) {
      chunks.push(current.trim());
      current = sentence;
      return;
    }
    current += sentence;
  });

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(Boolean);
}

function normalizeSceneFragments(scene: string) {
  const paragraphs = splitSceneParagraphs(scene);
  const sources =
    paragraphs.length > 0
      ? paragraphs
      : scene
          .split(/(?<=[。！？!?；;：:])/)
          .map((segment) => segment.trim())
          .filter(Boolean);

  return sources.flatMap((source) => splitLongParagraph(source)).filter(Boolean);
}

function mergeFragmentsForRange(fragments: string[], minBlocks: number, maxBlocks: number) {
  if (fragments.length <= maxBlocks) {
    return fragments;
  }

  const result = [...fragments];
  while (result.length > maxBlocks) {
    let mergeIndex = 0;
    let shortestLength = Number.POSITIVE_INFINITY;

    for (let index = 0; index < result.length - 1; index += 1) {
      const pairLength = result[index].length + result[index + 1].length;
      if (pairLength < shortestLength) {
        shortestLength = pairLength;
        mergeIndex = index;
      }
    }

    result.splice(mergeIndex, 2, `${result[mergeIndex]} ${result[mergeIndex + 1]}`.trim());
  }

  if (result.length < minBlocks && fragments.length >= minBlocks) {
    return fragments.slice(0, minBlocks);
  }

  return result;
}

function getBlocksTextLength(blocks: Array<{ text?: string }>) {
  return blocks.reduce((sum, block) => sum + (block.text?.trim().length || 0), 0);
}

function isSpecialBlock(type: DreamNarrativeBlock['type']) {
  return type !== 'narration';
}

function formatFitScore(block: DreamNarrativeBlock, index: number, total: number, layoutId: string) {
  if (!isSpecialBlock(block.type)) return -1;
  const middleStart = Math.max(1, Math.floor(total / 3));
  const middleEnd = Math.max(middleStart, Math.floor(total * 0.72));
  const isMiddle = index >= middleStart && index <= middleEnd;
  const isBack = index >= total - 3;
  const quoted = hasQuotedText(block.text);
  const short = block.text.length <= 90;
  let score = 1;

  if (layoutId === 'full-bleed-dialogue-card') {
    if (block.type === 'framed-dialogue' && quoted) score += 5;
    if (block.type === 'verdict' && isBack && short) score += 4;
  } else if (layoutId === 'soft-overlay-monologue') {
    if (block.type === 'dialogue' && quoted) score += 5;
    if (block.type === 'annotation' && short) score += 4;
    if (block.type === 'aside' && short) score += 3;
  } else if (layoutId === 'highlight-line-break') {
    if (block.type === 'highlight-dialogue' && quoted) score += 5;
    if (block.type === 'echo-line' && short) score += 4;
  } else if (layoutId === 'floating-aside-stack') {
    if (block.type === 'aside' && (quoted || short)) score += 5;
    if (block.type === 'strikethrough' && short) score += 4;
  } else if (layoutId === 'cinematic-caption-stream') {
    if (block.type === 'prompt' && short) score += 5;
    if (block.type === 'redacted') score += 4;
  }

  if (isMiddle) score += 2;
  if (isBack) score += 1;
  if (quoted) score += 1;
  if (short) score += 1;
  return score;
}

function hasQuotedText(text: string) {
  return /“[^”]+”|"[^"]+"/.test(text);
}

function inferSpeakerName(text: string) {
  const chineseQuote = text.match(/^“([^”]{1,12})[：:，,]/);
  if (chineseQuote) {
    return chineseQuote[1].trim();
  }

  const plainPrefix = text.match(/^([^，。！？：:\s]{1,10})[：:]/);
  if (plainPrefix) {
    return plainPrefix[1].trim();
  }

  return undefined;
}

function findCandidateIndex(
  blocks: DreamNarrativeBlock[],
  used: Set<number>,
  predicate: (block: DreamNarrativeBlock, index: number) => boolean,
) {
  const index = blocks.findIndex((block, blockIndex) => !used.has(blockIndex) && predicate(block, blockIndex));
  return index >= 0 ? index : -1;
}

function applyBlockType(
  block: DreamNarrativeBlock,
  type: DreamNarrativeBlock['type'],
): DreamNarrativeBlock {
  return {
    ...block,
    type,
    text: decorateFallbackText(block.text, type, 0, 1),
    speakerName: type === 'dialogue' || type === 'framed-dialogue'
      ? block.speakerName || inferSpeakerName(block.text)
      : block.speakerName,
    emphasis: type === 'highlight-dialogue' || type === 'verdict' ? 'high' : block.emphasis,
    align: type === 'prompt' || type === 'highlight-dialogue' || type === 'verdict' ? 'center' : block.align,
  };
}

function trimExcessSpecialBlocks(blocks: DreamNarrativeBlock[], layoutId: string, maxSpecialBlocks = 2) {
  const specialIndexes = blocks
    .map((block, index) => ({ index, score: formatFitScore(block, index, blocks.length, layoutId) }))
    .filter((item) => item.score >= 0);
  if (specialIndexes.length <= maxSpecialBlocks) {
    return blocks;
  }

  const keep = new Set(
    specialIndexes
      .sort((left, right) => right.score - left.score)
      .slice(0, maxSpecialBlocks)
      .map((item) => item.index),
  );

  return blocks.map((block, index) => (
    isSpecialBlock(block.type) && !keep.has(index)
      ? { ...block, type: 'narration' as const, speakerName: undefined, align: block.align === 'center' ? 'left' as const : block.align }
      : block
  ));
}

function pickFormatTypeForLayout(layoutId: string, block: DreamNarrativeBlock, index: number): DreamNarrativeBlock['type'] {
  const quoted = hasQuotedText(block.text);
  if (layoutId === 'full-bleed-dialogue-card') return quoted ? 'framed-dialogue' : 'verdict';
  if (layoutId === 'soft-overlay-monologue') return quoted ? 'dialogue' : 'annotation';
  if (layoutId === 'highlight-line-break') return quoted ? 'highlight-dialogue' : 'echo-line';
  if (layoutId === 'floating-aside-stack') return index % 2 === 0 ? 'aside' : 'strikethrough';
  if (layoutId === 'cinematic-caption-stream') return index % 2 === 0 ? 'prompt' : 'redacted';
  return quoted ? 'dialogue' : 'aside';
}

function ensureMinimumSpecialBlocks(blocks: DreamNarrativeBlock[], layoutId: string, minSpecialBlocks = 2) {
  if (blocks.length < 2) {
    return blocks;
  }

  const nextBlocks = trimExcessSpecialBlocks(blocks, layoutId, minSpecialBlocks);
  const used = new Set(
    nextBlocks
      .map((block, index) => (isSpecialBlock(block.type) ? index : -1))
      .filter((index) => index >= 0),
  );
  const preferredIndexes = [
    Math.max(1, Math.floor(nextBlocks.length * 0.38)),
    Math.max(1, Math.floor(nextBlocks.length * 0.68)),
    Math.max(1, nextBlocks.length - 2),
  ];

  for (const preferredIndex of preferredIndexes) {
    if (nextBlocks.filter((block) => isSpecialBlock(block.type)).length >= minSpecialBlocks) break;
    if (used.has(preferredIndex) || !nextBlocks[preferredIndex]) continue;
    const block = nextBlocks[preferredIndex];
    nextBlocks[preferredIndex] = applyBlockType(block, pickFormatTypeForLayout(layoutId, block, preferredIndex));
    used.add(preferredIndex);
  }

  return trimExcessSpecialBlocks(nextBlocks, layoutId, minSpecialBlocks);
}

function ensureNarrativeFormatVariety(blocks: DreamNarrativeBlock[], layoutId: string) {
  const trimmedBlocks = trimExcessSpecialBlocks(blocks, layoutId);
  if (blocks.length < 4 || trimmedBlocks.filter((block) => isSpecialBlock(block.type)).length >= 2) {
    return ensureMinimumSpecialBlocks(trimmedBlocks, layoutId);
  }

  const nextBlocks = [...trimmedBlocks];
  const used = new Set<number>();
  const addType = (type: DreamNarrativeBlock['type'], predicate: (block: DreamNarrativeBlock, index: number) => boolean) => {
    const index = findCandidateIndex(nextBlocks, used, predicate);
    if (index < 0) return;
    nextBlocks[index] = applyBlockType(nextBlocks[index], type);
    used.add(index);
  };
  const middleStart = Math.max(1, Math.floor(nextBlocks.length / 3));
  const middleEnd = Math.max(middleStart, Math.floor(nextBlocks.length * 0.72));
  const isMiddle = (_block: DreamNarrativeBlock, index: number) => index >= middleStart && index <= middleEnd;
  const isShort = (block: DreamNarrativeBlock) => block.text.length <= 90;

  if (layoutId === 'full-bleed-dialogue-card') {
    addType('framed-dialogue', (block, index) => hasQuotedText(block.text) && isMiddle(block, index));
    addType('verdict', (block, index) => index >= nextBlocks.length - 3 && isShort(block));
  } else if (layoutId === 'soft-overlay-monologue') {
    addType('dialogue', (block, index) => hasQuotedText(block.text) && isMiddle(block, index));
    addType('annotation', (block, index) => index >= middleStart && index <= nextBlocks.length - 2 && isShort(block));
  } else if (layoutId === 'highlight-line-break') {
    addType('highlight-dialogue', (block, index) => hasQuotedText(block.text) && isMiddle(block, index));
    addType('echo-line', (block, index) => index >= nextBlocks.length - 3 && isShort(block));
  } else if (layoutId === 'floating-aside-stack') {
    addType('aside', (block, index) => hasQuotedText(block.text) && isMiddle(block, index));
    addType('strikethrough', (block, index) => index >= middleStart && index <= nextBlocks.length - 2 && isShort(block));
  } else if (layoutId === 'cinematic-caption-stream') {
    addType('prompt', (block, index) => index > 0 && index < nextBlocks.length - 1 && isShort(block));
    addType('redacted', (_block, index) => index >= nextBlocks.length - 3);
  }

  if (nextBlocks.filter((block) => isSpecialBlock(block.type)).length < 2) {
    addType('dialogue', (block, index) => hasQuotedText(block.text) && index > 0);
  }
  if (nextBlocks.filter((block) => isSpecialBlock(block.type)).length < 2) {
    addType('aside', (block, index) => index >= nextBlocks.length - 3 && isShort(block));
  }

  return ensureMinimumSpecialBlocks(trimExcessSpecialBlocks(nextBlocks, layoutId), layoutId);
}

function inferBlockType(
  text: string,
  index: number,
  total: number,
  layoutId: string,
): DreamNarrativeBlock['type'] {
  const hasQuote = /“[^”]+”|"[^"]+"/.test(text);
  const endsWithQuestion = /[？?]$/.test(text);
  const shortLine = text.length <= 34;
  const nearFront = index === 1;
  const nearMiddle = index === Math.max(1, Math.floor(total / 2));
  const nearBack = index === Math.max(1, total - 2);

  if (layoutId === 'cinematic-caption-stream') {
    if (index === 0 && shortLine) return 'prompt';
    if (hasQuote && nearMiddle) return text.length <= 40 ? 'highlight-dialogue' : 'dialogue';
    if (endsWithQuestion && nearBack) return 'prompt';
    return 'narration';
  }
  if (layoutId === 'highlight-line-break') {
    if (shortLine && (nearFront || nearBack || index === total - 1)) return 'highlight-dialogue';
    if (hasQuote && nearMiddle) return 'dialogue';
    return 'narration';
  }
  if (layoutId === 'full-bleed-dialogue-card') {
    if (hasQuote && (nearFront || nearMiddle)) return 'framed-dialogue';
    return 'narration';
  }
  if (layoutId === 'floating-aside-stack') {
    if (shortLine && (nearFront || nearBack)) return 'aside';
    if (hasQuote && nearMiddle) return 'dialogue';
    return 'narration';
  }
  if (layoutId === 'soft-overlay-monologue') {
    if (hasQuote && (nearFront || nearMiddle)) return 'dialogue';
    if (shortLine && (nearBack || index === total - 1)) return 'aside';
    return 'narration';
  }
  if (hasQuote) {
    return text.length <= 40 ? 'highlight-dialogue' : 'dialogue';
  }
  if (endsWithQuestion) {
    return 'prompt';
  }
  if (shortLine && index === total - 1) {
    return 'aside';
  }
  return 'narration';
}

function decorateFallbackText(
  text: string,
  type: DreamNarrativeBlock['type'],
  index: number,
  total: number,
) {
  if (type === 'strikethrough') {
    return `~~${text}~~`;
  }
  if (type === 'annotation') {
    return `注：${text}`;
  }
  if (type === 'verdict') {
    return text.replace(/[。！？]+$/u, '');
  }
  if (type === 'redacted') {
    const cut = Math.max(2, Math.min(8, Math.floor(text.length / 5)));
    return `${text.slice(0, Math.max(0, text.length - cut))}${'█'.repeat(cut)}`;
  }
  if (type === 'echo-line') {
    const excerpt = text.slice(0, Math.min(22, text.length)).trim();
    return excerpt ? `${text}\n${excerpt}` : text;
  }
  return text;
}

function buildFallbackBlocks(scene: string, layoutId: string) {
  const fragments = normalizeSceneFragments(scene);
  const grouped = mergeFragmentsForRange(fragments, 8, 12);

  const blocks: DreamNarrativeBlock[] = grouped.slice(0, 12).map((text, index, array) => {
    let type = inferBlockType(text, index, array.length, layoutId);
    const nearFront = index === 1;
    const nearMiddle = index === Math.max(1, Math.floor(array.length / 2));
    const nearBack = index === Math.max(1, array.length - 2);
    const isLast = index === array.length - 1;

    if (layoutId === 'full-bleed-dialogue-card' && ((nearBack && text.length <= 80) || (isLast && text.length <= 64))) {
      type = 'verdict';
    } else if (layoutId === 'soft-overlay-monologue' && ((nearBack && text.length <= 84) || (nearMiddle && text.length <= 72))) {
      type = 'annotation';
    } else if (layoutId === 'highlight-line-break' && ((isLast && text.length <= 54) || (nearMiddle && text.length <= 42))) {
      type = 'echo-line';
    } else if (layoutId === 'floating-aside-stack' && ((nearFront && text.length <= 64) || (nearBack && text.length <= 52))) {
      type = 'strikethrough';
    } else if (layoutId === 'cinematic-caption-stream' && ((nearBack && text.length <= 90) || (nearFront && text.length <= 56))) {
      type = 'redacted';
    }
    const renderedText = decorateFallbackText(text, type, index, array.length);
    return {
      id: `fallback-block-${index + 1}`,
      type,
      text: renderedText,
      speakerName: type === 'dialogue' || type === 'framed-dialogue' ? inferSpeakerName(text) : undefined,
      emphasis:
        type === 'highlight-dialogue' || type === 'verdict'
          ? 'high'
          : index === 0
            ? 'high'
            : index === array.length - 1
              ? 'low'
              : 'medium',
      align:
        type === 'prompt' || type === 'highlight-dialogue' || type === 'verdict'
          ? 'center' as const
          : 'left' as const,
    };
  });

  return ensureMinimumSpecialBlocks(blocks, layoutId);
}

export function computeShallowActCount(seed: string) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return total % 2 === 0 ? 4 : 5;
}

export function parseJsonResponse<T>(raw: string): T {
  const trimmed = raw.trim();
  const normalized = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(normalized) as T;
}

export function buildPresentation(seed: string): DreamPresentation {
  const presentation = resolveDreamPresentation(seed);
  return {
    themeId: presentation.theme.id,
    themeName: presentation.theme.name,
    accent: presentation.theme.accent,
    accentSoft: presentation.theme.accentSoft,
    dialogueText: presentation.theme.dialogueText,
    frameBorder: presentation.theme.frameBorder,
    frameFill: presentation.theme.frameFill,
    layoutId: presentation.layout.id,
    layoutName: presentation.layout.name,
  };
}

export function buildCustomChoice(): DreamCustomChoice {
  return {
    id: 'custom-input',
    title: '自定义描述',
    placeholder: '输入你想怎么做、怎么说，或者你想把这一幕推向哪边。',
    guidance: '这条不会预设固定动作，由你自己描述，系统会按当前这一幕的语境继续往下生成。',
  };
}

export function normalizeNarrativeDocument(
  raw: RawNarrativeDocument | undefined,
  actLabel: string,
  presentation: DreamPresentation,
  fallbackScene?: string,
): DreamNarrativeDocument {
  const normalizeNodeId = (prefix: string, rawId: string | undefined, fallbackIndex: number) => {
    const normalizedRawId = (rawId?.trim() || '')
      .replace(/[^\w-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalizedRawId ? `${prefix}-${fallbackIndex + 1}-${normalizedRawId}` : `${prefix}-${fallbackIndex + 1}`;
  };

  const pages: DreamNarrativePage[] = (raw?.pages ?? []).slice(0, 1).map((page, pageIndex) => {
    const normalizedBlocks = (page.blocks ?? [])
      .map((block, blockIndex) => ({
        id: normalizeNodeId(`block-${pageIndex + 1}`, block.id, blockIndex),
        type: block.type || 'narration',
        text: block.text?.trim() || '',
        speakerName: block.speakerName?.trim() || undefined,
        speakerAvatar: block.speakerAvatar?.trim() || undefined,
        emphasis: block.emphasis || 'medium',
        align: block.align || 'left',
      }))
      .filter((block) => block.text);
    const sceneTextLength = fallbackScene?.trim().length || 0;
    const blockTextLength = getBlocksTextLength(normalizedBlocks);
    const shouldUseFullScene =
      sceneTextLength >= 700
      && blockTextLength > 0
      && blockTextLength < Math.floor(sceneTextLength * 0.75);
    const layoutId = raw?.layoutId?.trim() || presentation.layoutId;

    return {
      id: normalizeNodeId('page', page.id, pageIndex),
      title: page.title?.trim() || actLabel,
      blocks:
        normalizedBlocks.length > 0 && !shouldUseFullScene
          ? ensureNarrativeFormatVariety(normalizedBlocks, layoutId)
          : buildFallbackBlocks(fallbackScene || '', layoutId),
    };
  });

  const normalizedPages = pages.length > 0
    ? pages
    : [{ id: 'page-1', title: actLabel, blocks: buildFallbackBlocks(fallbackScene || '', raw?.layoutId?.trim() || presentation.layoutId) }];

  return {
    themeId: raw?.themeId?.trim() || presentation.themeId,
    layoutId: raw?.layoutId?.trim() || presentation.layoutId,
    pages: normalizedPages,
  };
}

export function toGeneratedChoice(choice: RawChoice, actIndex: number, choiceIndex: number): DreamGeneratedChoice {
  return {
    id: choice.id?.trim() || `act-${actIndex + 1}-choice-${choiceIndex + 1}`,
    title: choice.title?.trim() || `选项 ${choiceIndex + 1}`,
    direction: choice.direction?.trim() || '继续试探',
    detail: choice.detail?.trim() || '',
    reactionHint: choice.reactionHint?.trim() || '',
    storyPush: choice.storyPush?.trim() || '',
    emotion: choice.emotion?.trim() || '波动',
  };
}

export function toChoiceSet(choices: RawChoice[] | undefined, actIndex: number): DreamRuntimeChoiceSet {
  const normalized = [0, 1, 2].map((choiceIndex) => toGeneratedChoice(choices?.[choiceIndex] || {}, actIndex, choiceIndex));
  return {
    generated: normalized as [DreamGeneratedChoice, DreamGeneratedChoice, DreamGeneratedChoice],
    custom: buildCustomChoice(),
  };
}

export function toAct(act: RawAct, actIndex: number, presentation: DreamPresentation): DreamRuntimeAct {
  const label = act.label?.trim() || `第 ${actIndex + 1} 幕`;
  const normalizedRawId = (act.id?.trim() || 'act').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'act';
  return {
    id: `${normalizedRawId}-${actIndex + 1}`,
    label,
    scene: act.scene?.trim() || '',
    charState: act.charState?.trim() || '',
    narrative: normalizeNarrativeDocument(act.narrative, label, presentation, act.scene?.trim() || ''),
    choiceSet: toChoiceSet(act.choices, actIndex),
    progression: {
      consequence: act.progression?.consequence?.trim() || '',
      plotAdvance: act.progression?.plotAdvance?.trim() || '',
      tensionShift: act.progression?.tensionShift?.trim() || '',
    },
  };
}

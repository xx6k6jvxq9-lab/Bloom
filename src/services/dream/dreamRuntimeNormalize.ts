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

function inferBlockType(
  text: string,
  index: number,
  total: number,
  layoutId: string,
): DreamNarrativeBlock['type'] {
  const hasQuote = /“[^”]+”|"[^"]+"/.test(text);
  const endsWithQuestion = /[？?]$/.test(text);
  const shortLine = text.length <= 34;

  if (layoutId === 'cinematic-caption-stream' && (index === 0 || endsWithQuestion)) {
    return 'prompt';
  }
  if (layoutId === 'highlight-line-break' && shortLine && (hasQuote || index === 1 || index === total - 2)) {
    return 'highlight-dialogue';
  }
  if (layoutId === 'full-bleed-dialogue-card' && hasQuote && text.length > 26) {
    return 'framed-dialogue';
  }
  if (layoutId === 'floating-aside-stack' && shortLine && index % 2 === 1) {
    return 'aside';
  }
  if (layoutId === 'soft-overlay-monologue' && shortLine && index === total - 1) {
    return 'aside';
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

function buildFallbackBlocks(scene: string, layoutId: string) {
  const fragments = normalizeSceneFragments(scene);
  const grouped = mergeFragmentsForRange(fragments, 8, 12);

  return grouped.slice(0, 12).map((text, index, array) => {
    const type = inferBlockType(text, index, array.length, layoutId);
    const fallbackType = type === 'dialogue' || type === 'highlight-dialogue' || type === 'framed-dialogue' ? type : 'narration';
    return {
      id: `fallback-block-${index + 1}`,
      type: fallbackType,
      text,
      speakerName: fallbackType === 'dialogue' || fallbackType === 'framed-dialogue' ? inferSpeakerName(text) : undefined,
      emphasis:
        fallbackType === 'highlight-dialogue'
          ? 'high'
          : index === 0
            ? 'high'
            : index === array.length - 1
              ? 'low'
              : 'medium',
      align: fallbackType === 'highlight-dialogue' ? 'center' as const : 'left' as const,
    };
  });
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

    return {
      id: normalizeNodeId('page', page.id, pageIndex),
      title: page.title?.trim() || actLabel,
      blocks:
        normalizedBlocks.length > 0 && !shouldUseFullScene
          ? normalizedBlocks
          : buildFallbackBlocks(fallbackScene || '', raw?.layoutId?.trim() || presentation.layoutId),
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

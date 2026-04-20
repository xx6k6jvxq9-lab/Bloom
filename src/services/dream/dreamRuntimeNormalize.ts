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

function inferBlockType(text: string, index: number, total: number): DreamNarrativeBlock['type'] {
  if (/“[^”]+”|"[^"]+"/.test(text)) {
    return text.length <= 40 ? 'highlight-dialogue' : 'dialogue';
  }
  if (/[？?]$/.test(text)) {
    return 'prompt';
  }
  if (text.length <= 28 && index === total - 1) {
    return 'aside';
  }
  return 'narration';
}

function buildFallbackBlocks(scene: string) {
  const paragraphs = splitSceneParagraphs(scene);
  const sources =
    paragraphs.length > 0
      ? paragraphs
      : scene
          .split(/(?<=[。！？!?；;])/)
          .map((segment) => segment.trim())
          .filter(Boolean);

  return sources.slice(0, 7).map((text, index, array) => ({
    id: `fallback-block-${index + 1}`,
    type: inferBlockType(text, index, array.length),
    text,
    emphasis: index === 0 ? 'high' : index === array.length - 1 ? 'low' : 'medium',
    align: 'left' as const,
  }));
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

    return {
      id: normalizeNodeId('page', page.id, pageIndex),
      title: page.title?.trim() || actLabel,
      blocks: normalizedBlocks.length > 0 ? normalizedBlocks : buildFallbackBlocks(fallbackScene || ''),
    };
  });

  const normalizedPages = pages.length > 0 ? pages : [{ id: 'page-1', title: actLabel, blocks: buildFallbackBlocks(fallbackScene || '') }];

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

import type { DreamNarrativeBlock, DreamNarrativeDocument, DreamNarrativePage } from './dreamNarrativeSchema';
import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { resolveDreamPresentation } from './resolveDreamPresentation';
import { buildDreamPromptInput } from './buildDreamPromptInput';
import { buildDreamScenarioPrompt } from './buildDreamScenarioPrompt';
import type {
  DreamAftermathInput,
  DreamCustomChoice,
  DreamEndingInput,
  DreamGeneratedChoice,
  DreamPresentation,
  DreamRuntimeAct,
  DreamRuntimeChoiceSet,
  DreamRuntimeScenario,
  DreamStoryFrame,
  GenerateDreamScenarioOptions,
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

type RawChoice = {
  id?: string;
  title?: string;
  direction?: string;
  detail?: string;
  reactionHint?: string;
  storyPush?: string;
  emotion?: string;
};

type RawAct = {
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

type RawScenario = {
  coverTitle?: string;
  coverSubtitle?: string;
  confirmHint?: string;
  storyFrame?: Partial<DreamStoryFrame>;
  acts?: RawAct[];
  endingInput?: Partial<DreamEndingInput>;
  aftermathInput?: Partial<DreamAftermathInput>;
};

function computeShallowActCount(seed: string) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return total % 2 === 0 ? 4 : 5;
}

function parseJsonResponse(raw: string): RawScenario {
  const trimmed = raw.trim();
  const normalized = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(normalized) as RawScenario;
}

function buildPresentation(seed: string): DreamPresentation {
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

function normalizeNarrativeDocument(raw: RawNarrativeDocument | undefined, actLabel: string, presentation: DreamPresentation): DreamNarrativeDocument {
  const pages: DreamNarrativePage[] = (raw?.pages ?? []).slice(0, 1).map((page, pageIndex) => ({
    id: page.id?.trim() || `page-${pageIndex + 1}`,
    title: page.title?.trim() || actLabel,
    blocks: (page.blocks ?? []).map((block, blockIndex) => ({
      id: block.id?.trim() || `block-${blockIndex + 1}`,
      type: block.type || 'narration',
      text: block.text?.trim() || '',
      speakerName: block.speakerName?.trim() || undefined,
      speakerAvatar: block.speakerAvatar?.trim() || undefined,
      emphasis: block.emphasis || 'medium',
      align: block.align || 'left',
    })),
  }));

  return {
    themeId: raw?.themeId?.trim() || presentation.themeId,
    layoutId: raw?.layoutId?.trim() || presentation.layoutId,
    pages,
  };
}

function toGeneratedChoice(choice: RawChoice, actIndex: number, choiceIndex: number): DreamGeneratedChoice {
  return {
    id: choice.id?.trim() || `act-${actIndex + 1}-choice-${choiceIndex + 1}`,
    title: choice.title?.trim() || `选项${choiceIndex + 1}`,
    direction: choice.direction?.trim() || '继续试探',
    detail: choice.detail?.trim() || '',
    reactionHint: choice.reactionHint?.trim() || '',
    storyPush: choice.storyPush?.trim() || '',
    emotion: choice.emotion?.trim() || '波动',
  };
}

function buildCustomChoice(): DreamCustomChoice {
  return {
    id: 'custom-input',
    title: '自定义描述',
    placeholder: '输入你想怎么做、怎么说，或者你想推动剧情往哪边走。',
    guidance: '这一项不预设具体动作，由你自己描述，系统再按同幕语境继续生成。',
  };
}

function toChoiceSet(choices: RawChoice[] | undefined, actIndex: number): DreamRuntimeChoiceSet {
  const normalized = [0, 1, 2].map((choiceIndex) => toGeneratedChoice(choices?.[choiceIndex] || {}, actIndex, choiceIndex));
  return {
    generated: normalized as [DreamGeneratedChoice, DreamGeneratedChoice, DreamGeneratedChoice],
    custom: buildCustomChoice(),
  };
}

function toAct(act: RawAct, actIndex: number, presentation: DreamPresentation): DreamRuntimeAct {
  const label = act.label?.trim() || `第${actIndex + 1}幕`;
  return {
    id: act.id?.trim() || `act-${actIndex + 1}`,
    label,
    scene: act.scene?.trim() || '',
    charState: act.charState?.trim() || '',
    narrative: normalizeNarrativeDocument(act.narrative, label, presentation),
    choiceSet: toChoiceSet(act.choices, actIndex),
    progression: {
      consequence: act.progression?.consequence?.trim() || '',
      plotAdvance: act.progression?.plotAdvance?.trim() || '',
      tensionShift: act.progression?.tensionShift?.trim() || '',
    },
  };
}

export async function generateDreamScenario(options: GenerateDreamScenarioOptions): Promise<DreamRuntimeScenario> {
  const promptInput = buildDreamPromptInput(options);
  const prompt = buildDreamScenarioPrompt(options);
  const expectedActs =
    promptInput.resolvedSelection.depth === 'deep'
      ? 4
      : computeShallowActCount(`${options.character.id}-${promptInput.resolvedSelection.domainId}-${promptInput.resolvedSelection.entryMode}`);
  const seed = `${options.character.id}-${promptInput.resolvedSelection.domainId}-${promptInput.resolvedSelection.depth}-${promptInput.resolvedSelection.entryMode}`;
  const presentation = buildPresentation(seed);

  const raw = await generateTextFromMessagesWithConfig({
    activeConfig: options.activeConfig,
    messages: [
      {
        role: 'system',
        content: '你是一个严格按 JSON 输出的梦境剧情生成器。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.9,
    maxOutputTokens: 7800,
  });

  const parsed = parseJsonResponse(raw);
  const normalizedActs = Array.from({ length: expectedActs }, (_, index) => toAct(parsed.acts?.[index] || {}, index, presentation));

  return {
    id: `dream-${promptInput.resolvedSelection.domainId}-${promptInput.resolvedSelection.depth}-${Date.now()}`,
    coverTitle: parsed.coverTitle?.trim() || '今夜',
    coverSubtitle: parsed.coverSubtitle?.trim() || '',
    confirmHint: parsed.confirmHint?.trim() || '',
    storyFrame: {
      worldTitle: parsed.storyFrame?.worldTitle?.trim() || '',
      worldSummary: parsed.storyFrame?.worldSummary?.trim() || '',
      userDreamIdentity: parsed.storyFrame?.userDreamIdentity?.trim() || '',
      characterDreamIdentity: parsed.storyFrame?.characterDreamIdentity?.trim() || '',
      dreamRelationship: parsed.storyFrame?.dreamRelationship?.trim() || '',
      openingNode: parsed.storyFrame?.openingNode?.trim() || '',
      storyObjective: parsed.storyFrame?.storyObjective?.trim() || '',
      coreConflict: parsed.storyFrame?.coreConflict?.trim() || '',
      realityAnchor: parsed.storyFrame?.realityAnchor?.trim() || '',
    },
    presentation,
    acts: normalizedActs,
    endingInput: {
      titlePoolKey: parsed.endingInput?.titlePoolKey?.trim() || 'default',
      endingDirection: parsed.endingInput?.endingDirection?.trim() || '',
      keyActionSummary: parsed.endingInput?.keyActionSummary?.trim() || '',
    },
    aftermathInput: {
      relationshipShift: parsed.aftermathInput?.relationshipShift?.trim() || '',
      toneDrift: parsed.aftermathInput?.toneDrift?.trim() || '',
      messagePreviewDirection: parsed.aftermathInput?.messagePreviewDirection?.trim() || '',
    },
  };
}

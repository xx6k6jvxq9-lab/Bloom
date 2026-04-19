import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { buildDreamPromptInput } from './buildDreamPromptInput';
import { buildDreamScenarioPrompt } from './buildDreamScenarioPrompt';
import type {
  DreamAftermathInput,
  DreamCustomChoice,
  DreamEndingInput,
  DreamGeneratedChoice,
  DreamRuntimeAct,
  DreamRuntimeChoiceSet,
  DreamRuntimeScenario,
  GenerateDreamScenarioOptions,
} from './dreamRuntimeTypes';

type RawChoice = {
  id?: string;
  title?: string;
  direction?: string;
  detail?: string;
  reactionHint?: string;
  emotion?: string;
};

type RawAct = {
  id?: string;
  label?: string;
  scene?: string;
  charState?: string;
  choices?: RawChoice[];
};

type RawScenario = {
  coverTitle?: string;
  coverSubtitle?: string;
  confirmHint?: string;
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

function toGeneratedChoice(choice: RawChoice, actIndex: number, choiceIndex: number): DreamGeneratedChoice {
  return {
    id: choice.id?.trim() || `act-${actIndex + 1}-choice-${choiceIndex + 1}`,
    title: choice.title?.trim() || `选项${choiceIndex + 1}`,
    direction: choice.direction?.trim() || '继续试探',
    detail: choice.detail?.trim() || '顺着这一幕的情绪继续向前推动一步。',
    reactionHint: choice.reactionHint?.trim() || '角色会沿着这次选择给出新的反应。',
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

function toAct(act: RawAct, actIndex: number): DreamRuntimeAct {
  return {
    id: act.id?.trim() || `act-${actIndex + 1}`,
    label: act.label?.trim() || `第${actIndex + 1}幕`,
    scene: act.scene?.trim() || '',
    charState: act.charState?.trim() || '角色的情绪正在朝你慢慢变化。',
    choiceSet: toChoiceSet(act.choices, actIndex),
  };
}

export async function generateDreamScenario(options: GenerateDreamScenarioOptions): Promise<DreamRuntimeScenario> {
  const promptInput = buildDreamPromptInput(options);
  const prompt = buildDreamScenarioPrompt(options);
  const expectedActs =
    promptInput.resolvedSelection.depth === 'deep'
      ? 4
      : computeShallowActCount(`${options.character.id}-${promptInput.resolvedSelection.domainId}-${promptInput.resolvedSelection.entryMode}`);

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
    maxOutputTokens: 7200,
  });

  const parsed = parseJsonResponse(raw);
  const normalizedActs = Array.from({ length: expectedActs }, (_, index) => toAct(parsed.acts?.[index] || {}, index));

  return {
    id: `dream-${promptInput.resolvedSelection.domainId}-${promptInput.resolvedSelection.depth}-${Date.now()}`,
    coverTitle: parsed.coverTitle?.trim() || '今夜',
    coverSubtitle: parsed.coverSubtitle?.trim() || '梦还没有完全浮现，但你已经站在入口前。',
    confirmHint: parsed.confirmHint?.trim() || '这一局会从一处失真的夜色开始，真正的走向要等你进入后才会被看见。',
    acts: normalizedActs,
    endingInput: {
      titlePoolKey: parsed.endingInput?.titlePoolKey?.trim() || 'default',
      endingDirection: parsed.endingInput?.endingDirection?.trim() || '留白式靠近',
      keyActionSummary: parsed.endingInput?.keyActionSummary?.trim() || '用户在梦里推动关系继续向前。',
    },
    aftermathInput: {
      relationshipShift: parsed.aftermathInput?.relationshipShift?.trim() || '轻微升温',
      toneDrift: parsed.aftermathInput?.toneDrift?.trim() || '语气更柔和',
      messagePreviewDirection: parsed.aftermathInput?.messagePreviewDirection?.trim() || '明天会有一条更自然的开场消息。',
    },
  };
}

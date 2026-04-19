import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
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

function parseJsonResponse(raw: string): RawScenario {
  const trimmed = raw.trim();
  const normalized = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(normalized) as RawScenario;
}

function toGeneratedChoice(choice: RawChoice, actIndex: number, choiceIndex: number): DreamGeneratedChoice {
  return {
    id: choice.id?.trim() || `act-${actIndex + 1}-choice-${choiceIndex + 1}`,
    title: choice.title?.trim() || `选项${choiceIndex + 1}`,
    direction: choice.direction?.trim() || '向前试探',
    detail: choice.detail?.trim() || '顺着这一幕的情绪再往前一步。',
    reactionHint: choice.reactionHint?.trim() || '角色会因你的靠近给出新的反应。',
    emotion: choice.emotion?.trim() || '波动',
  };
}

function buildCustomChoice(): DreamCustomChoice {
  return {
    id: 'custom-input',
    title: '自定义描述',
    placeholder: '输入你想怎么做、怎么说，或你想推动剧情往哪边走。',
    guidance: '这一项不预设具体动作，用户自己描述，系统再按同幕语境继续生成。',
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
    scene: act.scene?.trim() || '这一幕的梦还没有真正浮现出来。',
    charState: act.charState?.trim() || '角色的情绪正在慢慢靠近你。',
    choiceSet: toChoiceSet(act.choices, actIndex),
  };
}

function buildFallbackScenario(options: GenerateDreamScenarioOptions): DreamRuntimeScenario {
  const roleName = options.character.remarkName?.trim() || options.character.name;
  const actCount = options.selection.depth === 'deep' ? 4 : 3;
  const acts = Array.from({ length: actCount }, (_, index) =>
    toAct(
      {
        id: `act-${index + 1}`,
        label: `第${index + 1}幕`,
        scene: `${roleName} 的梦局正在生成中，这一幕先以临时占位承接。`,
        charState: '角色的情绪还没有完全显形。',
        choices: [
          { title: '靠近', direction: '主动靠近', detail: '向角色更近一步。', reactionHint: '角色会更快地注意到你。', emotion: '靠近' },
          { title: '停住', direction: '先观察', detail: '先不打破当前气氛。', reactionHint: '角色会因为你的克制而变化。', emotion: '迟疑' },
          { title: '追问', direction: '碰真相', detail: '直接碰这一幕最关键的问题。', reactionHint: '角色可能短暂失衡。', emotion: '波动' },
        ],
      },
      index,
    ),
  );

  return {
    id: `dream-${options.selection.domainId}-${options.selection.depth}-${Date.now()}`,
    coverTitle: '今夜',
    coverSubtitle: `${roleName} 的梦还在浮现，你将从第一幕开始进入。`,
    confirmHint: '当前为降级 dream runtime，占位用于保证页面链路先能跑通。',
    acts,
    endingInput: {
      titlePoolKey: 'default',
      endingDirection: '留白式靠近',
      keyActionSummary: '用户沿着梦里最深的一条线继续靠近角色。',
    },
    aftermathInput: {
      relationshipShift: '轻微升温',
      toneDrift: '语气更缓一些',
      messagePreviewDirection: '明天的聊天会更早、更自然地接上这场梦。',
    },
  };
}

export async function generateDreamScenario(options: GenerateDreamScenarioOptions): Promise<DreamRuntimeScenario> {
  const prompt = buildDreamScenarioPrompt(options);

  try {
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
      maxOutputTokens: 2400,
    });

    const parsed = parseJsonResponse(raw);
    const expectedActs = options.selection.depth === 'deep' ? 4 : 3;
    const normalizedActs = Array.from({ length: expectedActs }, (_, index) => toAct(parsed.acts?.[index] || {}, index));

    return {
      id: `dream-${options.selection.domainId}-${options.selection.depth}-${Date.now()}`,
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
  } catch (error) {
    console.warn('[dream] generateDreamScenario fallback triggered:', error);
    return buildFallbackScenario(options);
  }
}

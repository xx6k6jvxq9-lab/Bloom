import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { buildDreamContinuationPrompt } from './buildDreamContinuationPrompt';
import { parseJsonResponse, sanitizeCustomAct, toAct, type RawAct } from './dreamRuntimeNormalize';
import type {
  DreamAftermathInput,
  DreamContinuationPayload,
  DreamEndingInput,
  GenerateDreamContinuationOptions,
} from './dreamRuntimeTypes';

type RawContinuation = {
  reactionText?: string;
  emotion?: string;
  storyPush?: string;
  nextAct?: RawAct;
  nextActs?: RawAct[];
  finalAct?: RawAct;
  endingInput?: Partial<DreamEndingInput>;
  aftermathInput?: Partial<DreamAftermathInput>;
};

function hasValidChoiceSet(act: RawAct | undefined) {
  if (!act) return false;
  if (!act.choices || act.choices.length !== 3) return false;
  return act.choices.every((choice) => (
    Boolean(choice?.title?.trim())
    && Boolean(choice?.direction?.trim())
    && Boolean(choice?.detail?.trim())
    && Boolean(choice?.reactionHint?.trim())
    && Boolean(choice?.storyPush?.trim())
    && Boolean(choice?.emotion?.trim())
  ));
}

export async function generateDreamContinuation(options: GenerateDreamContinuationOptions): Promise<DreamContinuationPayload> {
  const prompt = buildDreamContinuationPrompt(options);
  const raw = await generateTextFromMessagesWithConfig({
    activeConfig: options.activeConfig,
    messages: [
      {
        role: 'system',
        content: '你是一个严格输出 JSON 的梦境续写生成器。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.94,
    maxOutputTokens: options.mode === 'deeper' ? 7600 : 5200,
  });

  const parsed = parseJsonResponse<RawContinuation>(raw);
  const nextActIndex = options.actIndex + 1;

  if (options.mode === 'deeper') {
    const acts = parsed.nextActs || [];
    if (acts.length !== 5 || acts.some((act) => !hasValidChoiceSet(act))) {
      throw new Error('深梦续写没有稳定返回 5 幕且每幕 3 个有效选项。');
    }
  }

  if (options.mode === 'custom' && !hasValidChoiceSet(parsed.nextAct)) {
    throw new Error('自定义续写没有返回 3 个有效选项。');
  }

  return {
    reactionText: parsed.reactionText?.trim() || '',
    emotion: parsed.emotion?.trim() || '',
    storyPush: parsed.storyPush?.trim() || '',
    nextAct: parsed.nextAct ? sanitizeCustomAct(toAct(parsed.nextAct, nextActIndex, options.scenario.presentation), options.selection) : undefined,
    nextActs: parsed.nextActs?.map((act, index) => sanitizeCustomAct(toAct(act, nextActIndex + index, options.scenario.presentation), options.selection)),
    finalAct: parsed.finalAct ? sanitizeCustomAct(toAct(parsed.finalAct, nextActIndex, options.scenario.presentation), options.selection) : undefined,
    endingInput: parsed.endingInput
      ? {
          titlePoolKey: parsed.endingInput.titlePoolKey?.trim() || 'default',
          endingDirection: parsed.endingInput.endingDirection?.trim() || '',
          keyActionSummary: parsed.endingInput.keyActionSummary?.trim() || '',
        }
      : undefined,
    aftermathInput: parsed.aftermathInput
      ? {
          relationshipShift: parsed.aftermathInput.relationshipShift?.trim() || '',
          toneDrift: parsed.aftermathInput.toneDrift?.trim() || '',
          messagePreviewDirection: parsed.aftermathInput.messagePreviewDirection?.trim() || '',
        }
      : undefined,
  };
}

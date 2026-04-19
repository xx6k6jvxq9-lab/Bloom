import { generateTextFromMessagesWithConfig } from '../ai/runtimeClient';
import { buildDreamContinuationPrompt } from './buildDreamContinuationPrompt';
import { parseJsonResponse, toAct, type RawAct } from './dreamRuntimeNormalize';
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
  finalAct?: RawAct;
  endingInput?: Partial<DreamEndingInput>;
  aftermathInput?: Partial<DreamAftermathInput>;
};

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
    temperature: 0.92,
    maxOutputTokens: 5200,
  });

  const parsed = parseJsonResponse<RawContinuation>(raw);
  const nextActIndex = options.actIndex + 1;

  return {
    reactionText: parsed.reactionText?.trim() || '',
    emotion: parsed.emotion?.trim() || '',
    storyPush: parsed.storyPush?.trim() || '',
    nextAct: parsed.nextAct ? toAct(parsed.nextAct, nextActIndex, options.scenario.presentation) : undefined,
    finalAct: parsed.finalAct ? toAct(parsed.finalAct, nextActIndex, options.scenario.presentation) : undefined,
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

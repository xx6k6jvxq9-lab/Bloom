import type { ApiConfig } from '../../../../types';
import {
  buildCoupleCoNotePrompt,
  buildCoupleDailyCommentPrompt,
  buildCoupleDailyCommentReplyPrompt,
  buildCoupleDailyPostPrompt,
  buildCoupleLoveLetterPrompt,
  buildCoupleLoveLetterReplyPrompt,
  buildCoupleMessageBoardPrompt,
} from '../../prompts';
import type {
  BuildCoupleCoNotePromptOptions,
  BuildCoupleDailyCommentPromptOptions,
  BuildCoupleDailyCommentReplyPromptOptions,
  BuildCoupleDailyPostPromptOptions,
  BuildCoupleLoveLetterPromptOptions,
  BuildCoupleLoveLetterReplyPromptOptions,
  BuildCoupleMessageBoardPromptOptions,
} from '../../prompts';
import type { CoupleSpaceRecentImageReference } from '../../prompts/coupleSpace/types';
import { generateTextFromMessagesWithConfig } from '../../runtimeClient';

export type CoupleSpaceSettingsLike = {
  activeConfigId?: string;
  configs?: ApiConfig[];
};

function resolveActiveConfig(settings: CoupleSpaceSettingsLike): ApiConfig | null {
  const configs = settings.configs || [];
  if (configs.length === 0) return null;

  const activeConfig = configs.find((config) => config.id === settings.activeConfigId) || configs[0];
  return activeConfig?.apiKey ? activeConfig : null;
}

async function generateCoupleSpaceText(options: {
  settings: CoupleSpaceSettingsLike;
  prompt: string;
  temperature?: number;
  recentImageReferences?: CoupleSpaceRecentImageReference[];
}) {
  const activeConfig = resolveActiveConfig(options.settings);
  if (!activeConfig) return '';

  const recentImageReferences = canUseCoupleSpaceImageInputs(activeConfig)
    ? (options.recentImageReferences ?? []).filter((reference) => !!reference.imageUrl).slice(0, 2)
    : [];

  return generateTextFromMessagesWithConfig({
    activeConfig,
    messages: [
      ...recentImageReferences.map((reference, index) => ({
        role: 'user' as const,
        content: buildRecentImageReferenceMessage(reference, index),
        imageUrl: reference.imageUrl,
      })),
      { role: 'user', content: options.prompt },
    ],
    temperature: options.temperature,
  });
}

function canUseCoupleSpaceImageInputs(activeConfig: ApiConfig): boolean {
  if (activeConfig.provider === 'Google Gemini' || !activeConfig.baseUrl?.trim()) {
    return true;
  }

  const model = activeConfig.model?.trim().toLowerCase() || '';
  const provider = activeConfig.provider?.trim().toLowerCase() || '';
  return /(gpt-4o|gpt-4\.1|gpt-4-turbo|vision|claude-3|gemini|qwen-vl|glm-4v|o1|o3|o4)/i.test(model)
    || provider.includes('openai');
}

function buildRecentImageReferenceMessage(
  reference: CoupleSpaceRecentImageReference,
  index: number,
): string {
  return [
    `这是情侣空间最近的相关图片参考 ${index + 1}。`,
    reference.authorLabel ? `发布者：${reference.authorLabel}` : '',
    reference.relatedText ? `配文或上下文：${reference.relatedText}` : '',
    '请只依据图片里能直接看到的内容辅助判断，不要虚构图片外的信息。',
  ].filter(Boolean).join('\n');
}

/**
 * Thin prompt service for couple-space text generation.
 *
 * Current role:
 * - keep Page.tsx free from prompt selection / runtime plumbing
 * - centralize builder entrypoints for future proactive orchestration
 *
 * Future role:
 * - be called by a dedicated couple-space initiative/orchestration layer
 */
export async function generateCoupleDailyCommentReply(
  settings: CoupleSpaceSettingsLike,
  input: BuildCoupleDailyCommentReplyPromptOptions,
) {
  return generateCoupleSpaceText({
    settings,
    prompt: buildCoupleDailyCommentReplyPrompt(input),
    temperature: 0.9,
    recentImageReferences: input.recentContext?.recentImageReferences,
  });
}

export async function generateCoupleCoNote(
  settings: CoupleSpaceSettingsLike,
  input: BuildCoupleCoNotePromptOptions,
) {
  return generateCoupleSpaceText({
    settings,
    prompt: buildCoupleCoNotePrompt(input),
    temperature: 0.9,
    recentImageReferences: input.recentContext?.recentImageReferences,
  });
}

export async function generateCoupleLoveLetterReply(
  settings: CoupleSpaceSettingsLike,
  input: BuildCoupleLoveLetterReplyPromptOptions,
) {
  return generateCoupleSpaceText({
    settings,
    prompt: buildCoupleLoveLetterReplyPrompt(input),
    temperature: 0.9,
    recentImageReferences: input.recentContext?.recentImageReferences,
  });
}

export async function generateCoupleDailyPost(
  settings: CoupleSpaceSettingsLike,
  input: BuildCoupleDailyPostPromptOptions,
) {
  return generateCoupleSpaceText({
    settings,
    prompt: buildCoupleDailyPostPrompt(input),
    temperature: 0.95,
    recentImageReferences: input.recentContext?.recentImageReferences,
  });
}

export async function generateCoupleLoveLetter(
  settings: CoupleSpaceSettingsLike,
  input: BuildCoupleLoveLetterPromptOptions,
) {
  return generateCoupleSpaceText({
    settings,
    prompt: buildCoupleLoveLetterPrompt(input),
    temperature: 0.9,
    recentImageReferences: input.recentContext?.recentImageReferences,
  });
}

export async function generateCoupleDailyComment(
  settings: CoupleSpaceSettingsLike,
  input: BuildCoupleDailyCommentPromptOptions,
) {
  return generateCoupleSpaceText({
    settings,
    prompt: buildCoupleDailyCommentPrompt(input),
    temperature: 0.9,
    recentImageReferences: input.recentContext?.recentImageReferences,
  });
}

export async function generateCoupleMessageBoardReply(
  settings: CoupleSpaceSettingsLike,
  input: BuildCoupleMessageBoardPromptOptions,
) {
  return generateCoupleSpaceText({
    settings,
    prompt: buildCoupleMessageBoardPrompt(input),
    temperature: 0.9,
    recentImageReferences: input.recentContext?.recentImageReferences,
  });
}

export async function generateCoupleMessageBoardEntry(
  settings: CoupleSpaceSettingsLike,
  input: BuildCoupleMessageBoardPromptOptions,
) {
  return generateCoupleSpaceText({
    settings,
    prompt: buildCoupleMessageBoardPrompt({
      ...input,
      mode: input.mode ?? 'active',
    }),
    temperature: 0.9,
    recentImageReferences: input.recentContext?.recentImageReferences,
  });
}

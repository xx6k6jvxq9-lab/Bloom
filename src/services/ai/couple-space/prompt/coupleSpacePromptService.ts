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
import { streamTextWithConfig } from '../../runtimeClient';

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
}) {
  const activeConfig = resolveActiveConfig(options.settings);
  if (!activeConfig) return '';

  let responseText = '';
  await streamTextWithConfig({
    activeConfig,
    messages: [{ role: 'system', content: options.prompt }],
    temperature: options.temperature,
    onTextChunk: (chunkText) => {
      responseText += chunkText;
    },
  });

  return responseText;
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
  });
}

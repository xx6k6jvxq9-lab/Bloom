import type { ApiConfig } from '../../types';
import { streamTextWithConfig, type RuntimeChatMessage } from './runtimeClient';

export type OutputQualityReason =
  | 'empty'
  | 'punctuation_only'
  | 'punctuation_heavy'
  | 'repetition_noise'
  | 'analysis_leak'
  | 'system_leak'
  | 'too_short_after_cleaning';

export type OutputQualityResult = {
  ok: boolean;
  cleanedText: string;
  reason?: OutputQualityReason;
};

export type AssistantOutputQualityOptions = {
  allowBracketActions?: boolean;
  allowStructuredProtocols?: boolean;
};

export type GenerateQualityCheckedAssistantReplyParams = {
  activeConfig: ApiConfig;
  messages: RuntimeChatMessage[];
  allowBracketActions?: boolean;
  allowStructuredProtocols?: boolean;
  temperature?: number;
  retryTemperature?: number;
  onInvalid?: (result: OutputQualityResult) => void;
  onProgress?: (text: string, meta: { attempt: 1 | 2 }) => void;
};

const ANALYSIS_LEAK_PATTERN =
  /\b(?:based on these points|reacting to|reflecting(?: and adjusting)?|adjusting my response|i['\u2019]?m (?:crafting|developing|focusing|meticulously)|my goal is|given the shutdown|strategy|acknowledging her decision)\b/i;

const SYSTEM_LEAK_PATTERN =
  /\b(?:system prompt|developer message|as an ai|language model|task requires|output only|rules?:|instruction(?:s)?|prompt says)\b/i;

const BRACKET_BLOCK_REGEX = /[\(\uFF08]([^\(\)\uFF08\uFF09\n]{0,160})[\)\uFF09]/gu;
const PUNCTUATION_CHARS_REGEX = /[\s,\uFF0C.\u3002!\uFF01?\uFF1F\u3001;\uFF1B:"\u201C\u201D'\u2018\u2019`~\u2026\-\u2014()[\]{}<>\u300A\u300B\u3010\u3011\uFF08\uFF09]/gu;
const EFFECTIVE_CHAR_REGEX = /[\p{L}\p{N}]/gu;
const CJK_REGEX = /[\u4e00-\u9fff]/u;
const REPEATED_CHAR_RUN_REGEX = /(.)\1{7,}/u;
const REPEATED_PUNCTUATION_CLUSTER_REGEX = /([,，.。!！?？、;；~…])\1{3,}/u;

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function normalizeExcessivePunctuation(text: string): string {
  return text
    .replace(/[,\uFF0C]{2,}/g, '\uFF0C')
    .replace(/[.\u3002]{3,}/g, '\u3002')
    .replace(/[!\uFF01]{3,}/g, '\uFF01')
    .replace(/[?\uFF1F]{3,}/g, '\uFF1F')
    .replace(/[\u3001]{3,}/g, '\u3001')
    .replace(/[\u2026]{3,}/g, '\u2026')
    .replace(/\s{3,}/g, ' ')
    .trim();
}

function hasStructuredProtocolPayload(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  return (
    trimmed.startsWith('[GAME_CARD]')
    || trimmed.includes('---TRANSLATION---')
    || trimmed.startsWith('[COUPLE_SPACE_INVITE_ACCEPTED]')
    || trimmed.startsWith('[COUPLE_SPACE_INVITE]')
    || trimmed.startsWith('[transfer]')
    || /^\[转账\s*[\d.]+\]/.test(trimmed)
    || /^TRANSFER\|[\d.]+\|/i.test(trimmed)
  );
}

function hasObviousRepetitionNoise(text: string): boolean {
  const compactText = text.replace(/\s/g, '');
  if (!compactText) {
    return false;
  }

  if (REPEATED_CHAR_RUN_REGEX.test(compactText)) {
    return true;
  }

  const punctuationClusters = compactText.match(REPEATED_PUNCTUATION_CLUSTER_REGEX) ?? [];
  if (punctuationClusters.length >= 2) {
    return true;
  }

  return false;
}

function isInvalidBracketContent(content: string): boolean {
  const normalized = content.trim();
  if (!normalized) {
    return true;
  }

  if (ANALYSIS_LEAK_PATTERN.test(normalized) || SYSTEM_LEAK_PATTERN.test(normalized)) {
    return true;
  }

  const effectiveChars = countMatches(normalized, EFFECTIVE_CHAR_REGEX);
  if (effectiveChars === 0) {
    return true;
  }

  const punctuationChars = countMatches(normalized, PUNCTUATION_CHARS_REGEX);
  return normalized.length >= 4 && punctuationChars / Math.max(normalized.length, 1) > 0.65;
}

function sanitizeBracketBlocks(text: string, allowBracketActions: boolean): string {
  return text.replace(BRACKET_BLOCK_REGEX, (fullMatch, content: string) => {
    if (isInvalidBracketContent(content)) {
      return '';
    }

    return allowBracketActions ? fullMatch : '';
  });
}

function stripLeakedAnalysisLines(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }

      const unwrapped = line
        .replace(/^\*{1,3}/, '')
        .replace(/\*{1,3}$/, '')
        .replace(/^#{1,6}\s*/, '')
        .trim();

      if (ANALYSIS_LEAK_PATTERN.test(unwrapped)) {
        return false;
      }

      if (SYSTEM_LEAK_PATTERN.test(unwrapped)) {
        return false;
      }

      const looksLikeEnglishHeading =
        /^[A-Z][A-Za-z\s:'"-]{8,80}$/.test(unwrapped)
        && !CJK_REGEX.test(unwrapped)
        && !/[.!?]$/.test(unwrapped);
      if (looksLikeEnglishHeading) {
        return false;
      }

      return true;
    })
    .join('\n')
    .trim();
}

function buildInvalidOutputRetryInstruction(reason?: OutputQualityReason): string {
  return [
    '\u521A\u624D\u7684\u8F93\u51FA\u65E0\u6CD5\u4F5C\u4E3A\u804A\u5929\u6D88\u606F\u4F7F\u7528\u3002',
    reason ? `\u65E0\u6548\u539F\u56E0\uFF1A${reason}\u3002` : '',
    '\u8BF7\u53EA\u8F93\u51FA\u5F53\u524D\u89D2\u8272\u4F1A\u53D1\u51FA\u7684\u4E00\u53E5\u81EA\u7136\u804A\u5929\u5185\u5BB9\u3002',
    '\u4E0D\u8981\u5199\u6807\u9898\u3001\u89E3\u91CA\u3001\u7CFB\u7EDF\u89C4\u5219\u3001\u601D\u8003\u8FC7\u7A0B\u3001\u82F1\u6587\u5206\u6790\u6216\u7EAF\u6807\u70B9\u3002',
    '\u5982\u679C\u7528\u6237\u6B63\u5728\u4F7F\u7528\u4E2D\u6587\uFF0C\u5C31\u7528\u81EA\u7136\u4E2D\u6587\uFF1B\u5982\u679C\u7528\u6237\u660E\u786E\u4F7F\u7528\u5176\u4ED6\u8BED\u8A00\u6216\u8981\u6C42\u7FFB\u8BD1\uFF0C\u624D\u8DDF\u968F\u5BF9\u5E94\u8BED\u8A00\u3002',
  ].filter(Boolean).join('\n');
}

async function streamRuntimeReplyText(params: {
  activeConfig: ApiConfig;
  messages: RuntimeChatMessage[];
  temperature?: number;
  onProgress?: (text: string) => void;
}): Promise<string> {
  let responseText = '';
  await streamTextWithConfig({
    ...params,
    onTextChunk: (chunkText) => {
      responseText += chunkText;
      params.onProgress?.(responseText);
    },
  });
  return responseText;
}

export function shouldAllowBracketActions(input: {
  actionDescriptionEnabled?: boolean;
  characterActionDescriptionEnabled?: boolean;
}): boolean {
  return !!(input.actionDescriptionEnabled && input.characterActionDescriptionEnabled);
}

export function sanitizeAssistantOutput(
  text: string,
  options: AssistantOutputQualityOptions = {},
): string {
  if (!text) {
    return '';
  }

  let cleaned = text
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<think\b[^>]*>[\s\S]*$/gi, '')
    .trim();

  cleaned = stripLeakedAnalysisLines(cleaned);
  cleaned = sanitizeBracketBlocks(cleaned, !!options.allowBracketActions);
  cleaned = normalizeExcessivePunctuation(cleaned);
  cleaned = cleaned
    .replace(/^\s*["'\u201C\u201D\u2018\u2019]+|["'\u201C\u201D\u2018\u2019]+\s*$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

export function evaluateAssistantOutput(
  text: string,
  options: AssistantOutputQualityOptions = {},
): OutputQualityResult {
  const cleanedText = sanitizeAssistantOutput(text, options);
  if (!cleanedText) {
    return { ok: false, cleanedText, reason: 'empty' };
  }

  if (ANALYSIS_LEAK_PATTERN.test(cleanedText)) {
    return { ok: false, cleanedText, reason: 'analysis_leak' };
  }

  if (SYSTEM_LEAK_PATTERN.test(cleanedText)) {
    return { ok: false, cleanedText, reason: 'system_leak' };
  }

  const effectiveChars = countMatches(cleanedText, EFFECTIVE_CHAR_REGEX);
  if (effectiveChars === 0) {
    return { ok: false, cleanedText, reason: 'punctuation_only' };
  }

  const compactText = cleanedText.replace(/\s/g, '');
  const punctuationChars = countMatches(compactText, PUNCTUATION_CHARS_REGEX);
  const punctuationRatio = punctuationChars / Math.max(compactText.length, 1);
  const isStructuredProtocol = !!options.allowStructuredProtocols && hasStructuredProtocolPayload(cleanedText);
  if (!isStructuredProtocol && compactText.length >= 8 && punctuationRatio > 0.45) {
    return { ok: false, cleanedText, reason: 'punctuation_heavy' };
  }

  if (hasObviousRepetitionNoise(text)) {
    return { ok: false, cleanedText, reason: 'repetition_noise' };
  }

  return { ok: true, cleanedText };
}

export async function generateQualityCheckedAssistantReply(
  params: GenerateQualityCheckedAssistantReplyParams,
): Promise<OutputQualityResult> {
  const firstText = await streamRuntimeReplyText({
    activeConfig: params.activeConfig,
    messages: params.messages,
    temperature: params.temperature,
    onProgress: (text) => {
      params.onProgress?.(text, { attempt: 1 });
    },
  });
  const firstResult = evaluateAssistantOutput(firstText, {
    allowBracketActions: params.allowBracketActions,
    allowStructuredProtocols: params.allowStructuredProtocols,
  });
  if (firstResult.ok) {
    return firstResult;
  }

  params.onInvalid?.(firstResult);
  return firstResult;
}

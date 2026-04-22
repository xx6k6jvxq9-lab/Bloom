import type { ChatMessage } from '../../types';
import { evaluateAssistantOutput } from '../ai/outputQuality';
import { getMessageMainText } from '../../utils';

type BuildAutoSummarySourceLinesInput = {
  history: ChatMessage[];
  assistantName: string;
};

const ANALYSIS_LEAK_PATTERN =
  /\b(?:based on these points|reacting to|reflecting(?: and adjusting)?|adjusting my response|i['\u2019]?m (?:crafting|developing|focusing|meticulously)|my goal is|given the shutdown|strategy|acknowledging her decision)\b/i;

const SYSTEM_LEAK_PATTERN =
  /\b(?:system prompt|developer message|as an ai|language model|task requires|output only|rules?:|instruction(?:s)?|prompt says)\b/i;

const EFFECTIVE_CHAR_REGEX = /[\p{L}\p{N}]/gu;
const PUNCTUATION_CHARS_REGEX = /[\s,\uFF0C.\u3002!\uFF01?\uFF1F\u3001;\uFF1B:"\u201C\u201D'\u2018\u2019`~\u2026\-\u2014()[\]{}<>\u300A\u300B\u3010\u3011\uFF08\uFF09]/gu;

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function normalizeSummaryCandidate(text: string): string {
  return text
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<think\b[^>]*>[\s\S]*$/gi, '')
    .replace(/[,\uFF0C]{3,}/g, '\uFF0C')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isNoisyMemoryText(text: string): boolean {
  const normalized = normalizeSummaryCandidate(text);
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

  const compactText = normalized.replace(/\s/g, '');
  const punctuationChars = countMatches(compactText, PUNCTUATION_CHARS_REGEX);
  const punctuationRatio = punctuationChars / Math.max(compactText.length, 1);
  return compactText.length >= 8 && punctuationRatio > 0.45;
}

export function buildAutoSummarySourceLines({
  history,
  assistantName,
}: BuildAutoSummarySourceLinesInput): string[] {
  return history
    .filter((message) => !message.isSystem)
    .map((message) => {
      const mainText = getMessageMainText(message).trim();
      if (isNoisyMemoryText(mainText)) {
        return '';
      }

      return `${message.role === 'user' ? '用户' : assistantName}: ${mainText}`;
    })
    .filter(Boolean);
}

export function sanitizeAutoSummaryText(text: string): string {
  const normalized = normalizeSummaryCandidate(text);
  if (!normalized || isNoisyMemoryText(normalized)) {
    return '';
  }

  const qualityResult = evaluateAssistantOutput(normalized, {
    allowBracketActions: true,
  });

  return qualityResult.ok ? qualityResult.cleanedText.trim() : '';
}

const EFFECTIVE_CHAR_REGEX = /[\p{L}\p{N}]/gu;
const PUNCTUATION_CHARS_REGEX = /[\s,\uFF0C.\u3002!\uFF01?\uFF1F\u3001;\uFF1B:"\u201C\u201D'\u2018\u2019`~\u2026\-\u2014()[\]{}<>\u300A\u300B\u3010\u3011\uFF08\uFF09]/gu;

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

export function normalizeChatPunctuationNoise(text: string): string {
  return text
    .replace(/[,\uFF0C]{3,}/g, '\uFF0C')
    .replace(/[.\u3002]{4,}/g, '\u3002')
    .replace(/[!\uFF01]{4,}/g, '\uFF01')
    .replace(/[?\uFF1F]{4,}/g, '\uFF1F')
    .replace(/[\u3001]{3,}/g, '\u3001')
    .replace(/[\u2026]{4,}/g, '\u2026')
    .replace(/\s{3,}/g, ' ')
    .trim();
}

export function isUsableChatText(text: string): boolean {
  const normalized = normalizeChatPunctuationNoise(text);
  if (!normalized) {
    return false;
  }

  const effectiveChars = countMatches(normalized, EFFECTIVE_CHAR_REGEX);
  if (effectiveChars === 0) {
    return false;
  }

  const compactText = normalized.replace(/\s/g, '');
  const punctuationChars = countMatches(compactText, PUNCTUATION_CHARS_REGEX);
  const punctuationRatio = punctuationChars / Math.max(compactText.length, 1);
  if (compactText.length >= 6 && punctuationRatio > 0.55) {
    return false;
  }

  return true;
}

import { isUsableChatText, normalizeChatPunctuationNoise } from './messageHygiene';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLeadingMeta(text: string): string {
  return text
    .replace(/^\[(?:reply(?:\s+to)?|回复)\s*(?:[:：]|\s)\s*@?[^\]]+\]\s*/i, '')
    .replace(/^\[(?:notice|system|sticker|image)\]\s*/i, '')
    .replace(/^[\s"'`\u201c\u201d\u2018\u2019!?,，。？]+/u, '')
    .trim();
}

export function stripAssistantSpeakerPrefix(text: string, aliases: string[]): string {
  let normalized = stripLeadingMeta(text);
  const normalizedAliases = aliases
    .map((alias) => alias?.trim())
    .filter((alias): alias is string => Boolean(alias));

  for (const alias of normalizedAliases) {
    const escapedAlias = escapeRegExp(alias);
    const patterns = [
      new RegExp(`^${escapedAlias}\\s*[:：]\\s*`, 'i'),
      new RegExp(`^${escapedAlias}\\s*(?:说|表示|回复|回)\\s*[:：]\\s*`, 'i'),
      new RegExp(`^[【\\[]${escapedAlias}[】\\]]\\s*[:：]?\\s*`, 'i'),
    ];

    for (const pattern of patterns) {
      const nextValue = normalized.replace(pattern, '').trim();
      if (nextValue !== normalized) {
        normalized = nextValue;
        break;
      }
    }
  }

  normalized = stripLeadingMeta(normalized);
  return normalized.replace(/^["'`\u201c\u201d\u2018\u2019]+|["'`\u201c\u201d\u2018\u2019]+$/g, '').trim();
}

export function parseAssistantSpeakerLabel(text: string): { senderLabel: string; content: string } | null {
  const normalized = stripLeadingMeta(text);
  const wrappedMatch = normalized.match(/^[【\[]([^【】\]]+)[】\]]\s*[:：]?\s*(.*)$/u);
  if (wrappedMatch) {
    return {
      senderLabel: wrappedMatch[1].trim(),
      content: wrappedMatch[2].trim(),
    };
  }

  const plainMatch = normalized.match(/^([^:：\n]{1,24})\s*[:：]\s*(.*)$/u);
  if (!plainMatch) {
    return null;
  }

  return {
    senderLabel: plainMatch[1].trim(),
    content: plainMatch[2].trim(),
  };
}

const DIRECT_DEFAULT_MAX_BUBBLES = 5;
const DIRECT_HARD_MAX_BUBBLES = 10;
const DIRECT_ENDING_PUNCTUATION = /[\u3002\uFF01\uFF1F!?]+$/u;
const DIRECT_SENTENCE_REGEX = /[^\u3002\uFF01\uFF1F!?\n]+(?:[\u3002\uFF01\uFF1F!?]+)?/gu;
const DIRECT_SHORT_REACTION = /^(?:嗯|啊|哦|好|好吧|行|行吧|知道了|在呢|来了|收到|别闹|没事|可以)$/u;
const DIRECT_BREAK_STARTERS = /^(?:然后|而且|不过|所以|那|那就|还有|顺便|提前|另外|其实|反正|我先|我再|我就|你先|你就|要么|不然|别|现在)/u;
const DISPLAYABLE_EFFECTIVE_CHAR_REGEX = /[\p{L}\p{N}]/u;
const DISPLAYABLE_PROTOCOL_ONLY_REGEX = /^\[(?:game_card|game_card_error|transfer|sticker|image|audio|notice|system)\b/i;
const ACTION_BOUNDARY_LEADING_PUNCTUATION = /^[\s,，。！？?!、；;：:…]+/u;

function resolveDirectBubbleCap(maxBubbles?: number): number {
  if (!Number.isFinite(maxBubbles)) {
    return DIRECT_DEFAULT_MAX_BUBBLES;
  }

  return Math.max(1, Math.min(Math.floor(maxBubbles as number), DIRECT_HARD_MAX_BUBBLES));
}

function isOpeningBracketActionChar(char: string): boolean {
  return char === '(' || char === '（';
}

function isClosingBracketActionChar(char: string): boolean {
  return char === ')' || char === '）';
}

function findBalancedBracketActionEnd(text: string, startIndex: number): number {
  if (!isOpeningBracketActionChar(text[startIndex] || '')) {
    return -1;
  }

  let depth = 0;
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (isOpeningBracketActionChar(char)) {
      depth += 1;
      continue;
    }

    if (isClosingBracketActionChar(char)) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }

      if (depth < 0) {
        return -1;
      }
    }
  }

  return -1;
}

function trimLeadingActionBoundaryPunctuation(text: string): string {
  return text.replace(ACTION_BOUNDARY_LEADING_PUNCTUATION, '').trim();
}

function isBracketActionOnlyText(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  if (
    !isOpeningBracketActionChar(normalized[0])
    || !isClosingBracketActionChar(normalized[normalized.length - 1])
  ) {
    return false;
  }

  return findBalancedBracketActionEnd(normalized, 0) === normalized.length - 1;
}

function normalizeBubbleEnding(text: string, isFinalBubble: boolean): string {
  const normalized = text.trim();
  if (!normalized || isFinalBubble || isBracketActionOnlyText(normalized)) {
    return normalized;
  }

  const plainText = normalized.replace(DIRECT_ENDING_PUNCTUATION, '').trim();
  if (!plainText) {
    return normalized;
  }

  if (plainText.length <= 3 || DIRECT_SHORT_REACTION.test(plainText)) {
    return plainText;
  }

  return normalized.replace(DIRECT_ENDING_PUNCTUATION, '').trim();
}

function splitBySentenceChunks(text: string): string[] {
  return text.match(DIRECT_SENTENCE_REGEX)?.map((part) => part.trim()).filter(Boolean) ?? [];
}

function splitByBracketActionBlocks(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const parts: string[] = [];
  let cursor = 0;
  let previousPartWasAction = false;

  const pushSpeechPart = (rawText: string) => {
    const nextValue = previousPartWasAction
      ? trimLeadingActionBoundaryPunctuation(rawText)
      : rawText.trim();
    if (!nextValue) {
      return;
    }

    parts.push(nextValue);
    previousPartWasAction = false;
  };

  for (let index = 0; index < normalized.length; index += 1) {
    if (!isOpeningBracketActionChar(normalized[index])) {
      continue;
    }

    const matchEnd = findBalancedBracketActionEnd(normalized, index);
    if (matchEnd < 0) {
      continue;
    }

    pushSpeechPart(normalized.slice(cursor, index));

    const bracketText = normalized.slice(index, matchEnd + 1).trim();
    if (bracketText) {
      parts.push(bracketText);
      previousPartWasAction = true;
    }

    cursor = matchEnd + 1;
    index = matchEnd;
  }

  pushSpeechPart(normalized.slice(cursor));

  return parts.length > 0 ? parts : [normalized];
}

function splitDirectLongClause(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  if (normalized.length <= 24) return [normalized];

  const commaParts = normalized
    .replace(/([，,、；;])/gu, '$1\n')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (commaParts.length <= 1) {
    return [normalized];
  }

  const chunks: string[] = [];
  let current = '';

  for (const part of commaParts) {
    const compactPart = part.replace(/[，,、；;\s]/gu, '');
    const compactCurrent = current.replace(/[，,、；;\s]/gu, '');
    const shouldBreak =
      !!current
      && (
        compactCurrent.length >= 10
        || compactPart.length >= 12
        || DIRECT_BREAK_STARTERS.test(part.replace(/^[，,、；;\s]+/u, ''))
      );

    if (shouldBreak) {
      chunks.push(current.trim());
      current = part;
      continue;
    }

    const nextValue = current ? `${current}${part}` : part;
    if (current && nextValue.length > 28) {
      chunks.push(current.trim());
      current = part;
      continue;
    }

    current = nextValue;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 1 ? chunks : [normalized];
}

function splitByNaturalChatBeats(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const candidateParts = normalized
    .replace(/([。！？!?\u2026]+)/gu, '$1\n')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (candidateParts.length <= 1) {
    return [normalized];
  }

  const chunks: string[] = [];
  let current = '';

  for (const part of candidateParts) {
    const compactPart = part.replace(/\s/gu, '');
    const compactCurrent = current.replace(/\s/gu, '');
    const shouldBreak =
      !!current
      && (
        DIRECT_SHORT_REACTION.test(compactPart.replace(DIRECT_ENDING_PUNCTUATION, ''))
        || compactCurrent.length >= 16
        || (compactCurrent.length >= 9 && compactPart.length >= 9)
      );

    if (shouldBreak) {
      chunks.push(current.trim());
      current = part;
      continue;
    }

    current = current ? `${current}${part}` : part;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 1 ? chunks : [normalized];
}

function splitByStarterRhythm(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  for (const match of normalized.matchAll(/(?:^|[，。！？!?、\s])((?:然后|而且|不过|所以|顺便|提前|另外|其实|反正|我先|我再|你先|要么|不然|别|现在))/gu)) {
    const starter = match[1];
    const index = match.index ?? -1;
    if (index <= 0) continue;

    const starterIndex = normalized.indexOf(starter, index);
    if (starterIndex <= 0) continue;

    const head = normalized.slice(0, starterIndex).trim();
    const tail = normalized.slice(starterIndex).trim();
    if (head.length >= 4 && tail.length >= 3) {
      return [head, tail];
    }
  }

  return [normalized];
}

function mergeRhythmParts(parts: string[], maxBubbles = DIRECT_DEFAULT_MAX_BUBBLES): string[] {
  if (parts.length <= maxBubbles) {
    return parts;
  }

  const merged = [...parts];
  while (merged.length > maxBubbles) {
    const first = merged.shift();
    const second = merged.shift();
    if (!first || !second) {
      break;
    }
    const separator = DIRECT_ENDING_PUNCTUATION.test(first) ? '' : '，';
    merged.unshift(`${first}${separator}${second}`.trim());
  }

  return merged;
}

export function isDisplayableAssistantBubbleText(text: string): boolean {
  const normalized = normalizeChatPunctuationNoise(text);
  if (!normalized) {
    return false;
  }

  if (isBracketActionOnlyText(normalized)) {
    return true;
  }

  if (isUsableChatText(normalized)) {
    return true;
  }

  if (!DISPLAYABLE_EFFECTIVE_CHAR_REGEX.test(normalized)) {
    return false;
  }

  if (DISPLAYABLE_PROTOCOL_ONLY_REGEX.test(normalized)) {
    return false;
  }

  return true;
}

export function splitBracketActionDisplaySegments(text: string): Array<{
  kind: 'action' | 'speech';
  text: string;
}> {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  return splitByBracketActionBlocks(normalized)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({
      kind: isBracketActionOnlyText(part) ? 'action' : 'speech',
      text: part,
    }));
}

export function splitDirectAssistantReplyText(text: string, maxBubbles?: number): string[] {
  const bubbleCap = resolveDirectBubbleCap(maxBubbles);
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const explicitParts = normalized
    .split(/\n+/)
    .flatMap((part) => splitByBracketActionBlocks(part))
    .map((part) => part.trim())
    .filter(Boolean);

  if (explicitParts.length > 1) {
    return mergeRhythmParts(explicitParts, bubbleCap)
      .slice(0, bubbleCap)
      .map((part) => normalizeChatPunctuationNoise(part));
  }

  const parts = splitByBracketActionBlocks(normalized)
    .flatMap((part) => (
      isBracketActionOnlyText(part)
        ? [part]
        : splitBySentenceChunks(part)
          .flatMap((segment) => splitDirectLongClause(segment))
          .flatMap((segment) => splitByNaturalChatBeats(segment))
          .flatMap((segment) => splitByStarterRhythm(segment))
    ))
    .map((part) => part.trim())
    .filter(Boolean);

  const resolvedParts = parts.length > 0 ? parts : [normalized];
  const normalizedParts = mergeRhythmParts(resolvedParts, bubbleCap)
    .slice(0, bubbleCap)
    .map((part, index, allParts) => normalizeChatPunctuationNoise(normalizeBubbleEnding(part, index === allParts.length - 1)));
  const displayableParts = normalizedParts.filter(isDisplayableAssistantBubbleText);

  if (displayableParts.length === 0) {
    return [normalizeChatPunctuationNoise(normalized)];
  }

  const compactOriginal = normalizeChatPunctuationNoise(normalized).replace(/\s/gu, '');
  const compactDisplayable = displayableParts.join('').replace(/\s/gu, '');
  if (
    compactOriginal.length >= 12
    && compactDisplayable.length / Math.max(compactOriginal.length, 1) < 0.6
  ) {
    return [normalizeChatPunctuationNoise(normalized)];
  }

  return displayableParts;
}

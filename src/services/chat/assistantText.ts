function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLeadingMeta(text: string): string {
  return text
    .replace(/^\[(?:reply|reply to)\s*:\s*[^\]]+\]\s*/i, '')
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

  return normalized.replace(/^["'`\u201c\u201d\u2018\u2019]+|["'`\u201c\u201d\u2018\u2019]+$/g, '').trim();
}

export function parseAssistantSpeakerLabel(text: string): { senderLabel: string; content: string } | null {
  const normalized = stripLeadingMeta(text);
  const wrappedMatch = normalized.match(/^[【\[]([^】\]]+)[】\]]\s*[:：]?\s*(.*)$/u);
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

const DIRECT_MAX_BUBBLES = 5;

function resolveDirectBubbleCap(maxBubbles?: number): number {
  if (!Number.isFinite(maxBubbles)) {
    return DIRECT_MAX_BUBBLES;
  }

  return Math.max(1, Math.min(Math.floor(maxBubbles as number), DIRECT_MAX_BUBBLES));
}
const DIRECT_ENDING_PUNCTUATION = /[\u3002\uFF01\uFF1F!?]+$/u;
const DIRECT_SENTENCE_REGEX = /[^\u3002\uFF01\uFF1F!?\n]+(?:[\u3002\uFF01\uFF1F!?]+)?/gu;
const DIRECT_SHORT_REACTION = /^(?:嗯|哦|喔|行|行吧|行啊|好|好吧|知道了|在呢|来了|收到|别闹|别急|没事|可以)$/u;
const DIRECT_BREAK_STARTERS = /^(?:然后|而且|不过|所以|那|那就|还有|顺便|提前|另外|其实|反正|我先|我再|我就|你先|你就|要么|不然|别|过来|现在)/u;

function normalizeBubbleEnding(text: string, isFinalBubble: boolean): string {
  const normalized = text.trim();
  if (!normalized || isFinalBubble) {
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

function splitDirectLongClause(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  if (normalized.length <= 24) return [normalized];

  const commaParts = normalized
    .split(/(?<=[，,、；;])/u)
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
    .split(/(?<=[。！？!?\u2026]+)\s*/u)
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

  for (const match of normalized.matchAll(/(?:^|[，,。！？!?；;\s])((?:然后|而且|不过|所以|顺便|提前|另外|其实|反正|我先|我再|你先|要么|不然|别|过来|现在))/gu)) {
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

function mergeRhythmParts(parts: string[], maxBubbles = DIRECT_MAX_BUBBLES): string[] {
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

export function splitDirectAssistantReplyText(text: string, maxBubbles?: number): string[] {
  const bubbleCap = resolveDirectBubbleCap(maxBubbles);
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const explicitLines = normalized
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (explicitLines.length > 1) {
    return explicitLines
      .slice(0, bubbleCap)
      .map((part, index, allParts) => normalizeBubbleEnding(part, index === allParts.length - 1));
  }

  const parts = splitBySentenceChunks(normalized)
    .flatMap((part) => splitDirectLongClause(part))
    .flatMap((part) => splitByNaturalChatBeats(part))
    .flatMap((part) => splitByStarterRhythm(part))
    .map((part) => part.trim())
    .filter(Boolean);

  const resolvedParts = parts.length > 0 ? parts : [normalized];

  return mergeRhythmParts(resolvedParts, bubbleCap)
    .slice(0, bubbleCap)
    .map((part, index, allParts) => normalizeBubbleEnding(part, index === allParts.length - 1))
    .filter(Boolean);
}

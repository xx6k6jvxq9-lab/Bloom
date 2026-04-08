function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLeadingMeta(text: string): string {
  return text
    .replace(/^\[(?:reply|reply to)\s*:\s*[^\]]+\]\s*/i, '')
    .replace(/^\[(?:notice|system|sticker|image)\]\s*/i, '')
    .replace(/^[\s"'`\u201c\u201d\u2018\u2019!?，。？！,]+/, '')
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
  const wrappedMatch = normalized.match(/^[【\[]([^】\]]+)[】\]]\s*[:：]?\s*(.*)$/);
  if (wrappedMatch) {
    return {
      senderLabel: wrappedMatch[1].trim(),
      content: wrappedMatch[2].trim(),
    };
  }

  const plainMatch = normalized.match(/^([^:：\n]{1,24})\s*[:：]\s*(.*)$/);
  if (!plainMatch) {
    return null;
  }

  return {
    senderLabel: plainMatch[1].trim(),
    content: plainMatch[2].trim(),
  };
}

const DIRECT_MAX_BUBBLES = 4;
const DIRECT_ENDING_PUNCTUATION = /[。！？!?]+$/;
const RHYTHM_PREFIXES = [
  '还有',
  '然后',
  '而且',
  '那',
  '那么',
  '说',
  '你看',
  '不是',
  '听我说',
  '行',
  '行吧',
  '好',
  '好啦',
  '好吧',
  'OK',
  'ok',
];
const KEEP_ENDING_PHRASES = [
  '听见没',
  '知道了',
  '别闹',
  '记住了',
  '会感冒',
  '是不是',
  '对不对',
  '行不行',
];

function normalizeBubbleEnding(text: string, isFinalBubble: boolean): string {
  const normalized = text.trim();
  if (!normalized || isFinalBubble) {
    return normalized;
  }

  const plainText = normalized.replace(DIRECT_ENDING_PUNCTUATION, '').trim();
  if (plainText.length <= 3) {
    return plainText;
  }

  if (KEEP_ENDING_PHRASES.some((phrase) => plainText.endsWith(phrase))) {
    return normalized;
  }

  return normalized.replace(DIRECT_ENDING_PUNCTUATION, '').trim();
}

function splitBySentenceChunks(text: string): string[] {
  return (
    text.match(/[^。！？!?]+[。！？!?]?/g)
      ?.map((part) => part.trim())
      .filter(Boolean)
      ?? []
  );
}

function splitByRhythmPrefix(text: string): string[] | null {
  for (const prefix of RHYTHM_PREFIXES) {
    const index = text.indexOf(prefix);
    if (index > 0 && index <= 18) {
      const head = text.slice(0, index).trim();
      const tail = text.slice(index).trim();
      if (head.length >= 4 && tail.length >= 2) {
        return [head, tail];
      }
    }
  }

  return null;
}

function splitByCommaRhythm(text: string): string[] | null {
  const commaMatch = text.match(/^(.{2,18}?)[，、；;]\s*(.{2,24})$/);
  if (!commaMatch) {
    return null;
  }

  const firstPart = commaMatch[1].trim();
  const secondPart = commaMatch[2].trim();
  if (firstPart.length < 2 || secondPart.length < 2) {
    return null;
  }

  const firstLooksLead = /^(给你|还有|那|行|先|快|别|去|来|好|纸巾|记得|听我说|说|你看)/.test(firstPart);
  const secondLooksFollow = /^(别|记得|会|听见没|自己|谁|不|先|再|就|去|来)/.test(secondPart);
  if (firstLooksLead || secondLooksFollow) {
    return [firstPart, secondPart];
  }

  return null;
}

function mergeRhythmParts(parts: string[]): string[] {
  if (parts.length <= DIRECT_MAX_BUBBLES) {
    return parts;
  }

  const merged = [...parts];
  while (merged.length > DIRECT_MAX_BUBBLES) {
    const first = merged.shift();
    const second = merged.shift();
    if (!first || !second) {
      break;
    }
    merged.unshift(`${first}${DIRECT_ENDING_PUNCTUATION.test(first) ? '' : '，'}${second}`);
  }

  return merged;
}

export function splitDirectAssistantReplyText(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const explicitLines = normalized
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (explicitLines.length > 1) {
    return explicitLines.map((part, index) => normalizeBubbleEnding(part, index === explicitLines.length - 1));
  }

  const sentenceParts = splitBySentenceChunks(normalized);
  let parts: string[] = [normalized];

  if (sentenceParts.length >= 2 && sentenceParts.length <= DIRECT_MAX_BUBBLES) {
    parts = sentenceParts;
  } else {
    const rhythmPrefixSplit = splitByRhythmPrefix(normalized);
    if (rhythmPrefixSplit) {
      parts = rhythmPrefixSplit;
    } else {
      const commaSplit = splitByCommaRhythm(normalized);
      if (commaSplit) {
        parts = commaSplit;
      }
    }
  }

  return mergeRhythmParts(parts)
    .map((part, index, allParts) => normalizeBubbleEnding(part, index === allParts.length - 1))
    .filter(Boolean);
}

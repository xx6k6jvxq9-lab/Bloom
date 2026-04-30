import { inferStickerSemanticLabel } from './stickerSemantics';

type PickedSticker = {
  sticker: string;
  label: string;
};

function hashCueText(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function normalizeCueText(text: string): string {
  return text.trim().toLowerCase();
}

function scoreStickerMatch(cueText: string, cueLabel: string, stickerLabel: string): number {
  if (!stickerLabel) return 0;
  if (cueLabel && stickerLabel === cueLabel) return 100;
  if (cueText && stickerLabel && cueText.includes(stickerLabel)) return 80;
  if (cueText && stickerLabel && stickerLabel.includes(cueText)) return 70;
  return 0;
}

export function pickAssistantSticker(
  cueText: string,
  availableStickers: string[],
): PickedSticker | null {
  const stickerCandidates = availableStickers.filter((sticker) => !!sticker?.trim());
  if (stickerCandidates.length === 0) {
    return null;
  }

  const normalizedCueText = normalizeCueText(cueText);
  if (!normalizedCueText) {
    const fallbackSticker = stickerCandidates[0];
    return {
      sticker: fallbackSticker,
      label: inferStickerSemanticLabel(fallbackSticker)?.trim() || '表情包',
    };
  }

  const cueLabel = inferStickerSemanticLabel(undefined, cueText)?.trim().toLowerCase() || '';
  let bestMatch: PickedSticker | null = null;
  let bestScore = 0;

  for (const sticker of stickerCandidates) {
    const stickerLabel = inferStickerSemanticLabel(sticker)?.trim() || '';
    const normalizedStickerLabel = stickerLabel.toLowerCase();
    const score = scoreStickerMatch(normalizedCueText, cueLabel, normalizedStickerLabel);
    if (score <= bestScore) continue;
    bestScore = score;
    bestMatch = {
      sticker,
      label: stickerLabel || cueText.trim(),
    };
  }

  if (bestMatch) {
    return bestMatch;
  }

  const fallbackSticker = stickerCandidates[hashCueText(normalizedCueText) % stickerCandidates.length];
  const fallbackLabel = inferStickerSemanticLabel(fallbackSticker, cueText)?.trim()
    || inferStickerSemanticLabel(undefined, cueText)?.trim()
    || '表情包';

  return {
    sticker: fallbackSticker,
    label: fallbackLabel,
  };
}

export function buildAssistantStickerPromptSection(availableStickers: string[]): string {
  const labels = Array.from(new Set(
    availableStickers
      .map((sticker) => inferStickerSemanticLabel(sticker)?.trim())
      .filter((label): label is string => !!label),
  ));

  if (labels.length === 0) {
    return '';
  }

  return [
    '## Available stickers',
    `You can send one of the imported stickers when it fits the current emotion. Available sticker meanings: ${labels.join(' / ')}`,
    'To send a sticker, output a separate line exactly like: [sticker] meaning',
    'You may send only a sticker for a tiny emotional reaction, or send text first and then a sticker on the next line.',
    'Use stickers sparingly and naturally. Do not use a sticker when the user needs a clear answer, comfort, or important information.',
    'Prefer one of the listed meanings. Do not invent a new meaning unless it is very close to an available sticker.',
  ].join('\n');
}

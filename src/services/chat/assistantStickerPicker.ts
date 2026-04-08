import { inferStickerSemanticLabel } from './stickerSemantics';

type PickedSticker = {
  sticker: string;
  label: string;
};

function normalizeCueText(text: string): string {
  return text.trim().toLowerCase();
}

function scoreStickerMatch(cueText: string, cueLabel: string, sticker: string, stickerLabel: string): number {
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
  const normalizedCueText = normalizeCueText(cueText);
  if (!normalizedCueText) return null;

  const cueLabel = inferStickerSemanticLabel(undefined, cueText)?.trim().toLowerCase() || '';
  let bestMatch: PickedSticker | null = null;
  let bestScore = 0;

  for (const sticker of availableStickers) {
    if (!sticker?.trim()) continue;
    const stickerLabel = inferStickerSemanticLabel(sticker)?.trim() || '';
    const normalizedStickerLabel = stickerLabel.toLowerCase();
    const score = scoreStickerMatch(normalizedCueText, cueLabel, sticker, normalizedStickerLabel);
    if (score <= bestScore) continue;
    bestScore = score;
    bestMatch = {
      sticker,
      label: stickerLabel || cueText.trim(),
    };
  }

  return bestMatch;
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
    '## 可用表情包',
    `当前可主动发送的表情包语义只有这些：${labels.join('、')}`,
    '只有当其中某一种真的很贴合当前情绪时，才允许单独输出一条 `[sticker] 语义`。',
    '这里的“语义”必须尽量直接使用上面已有的表情包语义，不要自造新标签，不要频繁使用。',
  ].join('\n');
}

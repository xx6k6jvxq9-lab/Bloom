import type { StickerMetadata } from '../../types';

function normalizeTextValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeTextList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = Array.from(new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
  ));

  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeStickerMetadata(value: unknown): StickerMetadata | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const label = normalizeTextValue(record.label);
  const aliases = normalizeTextList(record.aliases);
  const traits = normalizeTextList(record.traits);

  if (!label && !aliases && !traits) {
    return undefined;
  }

  return {
    ...(label ? { label } : {}),
    ...(aliases ? { aliases } : {}),
    ...(traits ? { traits } : {}),
  };
}

export function normalizeStickerMetadataMap(
  value: unknown,
  allowedStickers?: string[],
): Record<string, StickerMetadata> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const allowedStickerSet = Array.isArray(allowedStickers)
    ? new Set(
        allowedStickers
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean),
      )
    : null;
  const normalizedEntries = Object.entries(value as Record<string, unknown>)
    .map(([sticker, metadata]) => ({
      sticker: sticker.trim(),
      metadata: normalizeStickerMetadata(metadata),
    }))
    .filter((entry) => (
      !!entry.sticker
      && !!entry.metadata
      && (!allowedStickerSet || allowedStickerSet.has(entry.sticker))
    ));

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    normalizedEntries.map((entry) => [entry.sticker, entry.metadata]),
  );
}

export function getStickerMetadata(
  metadataMap: Record<string, StickerMetadata> | null | undefined,
  sticker: string | null | undefined,
): StickerMetadata | undefined {
  const normalizedSticker = sticker?.trim();
  if (!metadataMap || !normalizedSticker) {
    return undefined;
  }

  return metadataMap[normalizedSticker];
}

export function resolveStickerMetadataLabel(
  metadataMap: Record<string, StickerMetadata> | null | undefined,
  sticker: string | null | undefined,
): string | undefined {
  return getStickerMetadata(metadataMap, sticker)?.label?.trim() || undefined;
}

export function buildStickerMetadataSemanticText(
  metadataMap: Record<string, StickerMetadata> | null | undefined,
  sticker: string | null | undefined,
  fallbackText?: string,
): string {
  const metadata = getStickerMetadata(metadataMap, sticker);
  return [
    metadata?.label?.trim() || '',
    ...(metadata?.aliases || []),
    ...(metadata?.traits || []),
    fallbackText?.trim() || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function withoutStickerMetadataKeys(
  metadataMap: Record<string, StickerMetadata> | null | undefined,
  stickers: string[],
): Record<string, StickerMetadata> | undefined {
  if (!metadataMap) {
    return undefined;
  }

  const blocked = new Set(
    stickers
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const entries = Object.entries(metadataMap).filter(([sticker]) => !blocked.has(sticker.trim()));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

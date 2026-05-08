import type { StickerMetadata } from '../../types';
import { inferStickerSemanticLabel } from './stickerSemantics';

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

function mergeTextLists(...lists: Array<string[] | undefined>): string[] | undefined {
  const merged = Array.from(new Set(
    lists
      .flatMap((list) => list || [])
      .map((item) => item.trim())
      .filter(Boolean),
  ));

  return merged.length > 0 ? merged : undefined;
}

function inferTraitsFromLabel(label?: string): string[] | undefined {
  const normalizedLabel = label?.trim() || '';
  if (!normalizedLabel) {
    return undefined;
  }

  if (/(贴贴|抱抱|亲亲|喜欢|撒娇|求安慰|安慰)/u.test(normalizedLabel)) {
    return /(求安慰|安慰)/u.test(normalizedLabel)
      ? ['comfort', 'affection']
      : ['affection', 'comfort'];
  }

  if (/(委屈|大哭|害怕|懵)/u.test(normalizedLabel)) {
    return ['sad', 'comfort'];
  }

  if (/(无语|阴阳怪气|冷漠)/u.test(normalizedLabel)) {
    return ['sarcastic', 'cool'];
  }

  if (/(生气|吃醋)/u.test(normalizedLabel)) {
    return ['angry'];
  }

  if (/(开心|庆祝|鼓励|得意|撒欢)/u.test(normalizedLabel)) {
    return ['cheerful', 'playful'];
  }

  if (/(害羞|期待)/u.test(normalizedLabel)) {
    return ['shy', 'affection'];
  }

  if (/(困倦|犯困)/u.test(normalizedLabel)) {
    return ['sleepy'];
  }

  if (/(认错)/u.test(normalizedLabel)) {
    return ['apology', 'comfort'];
  }

  if (/(疑惑|震惊)/u.test(normalizedLabel)) {
    return ['surprised'];
  }

  return undefined;
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

export function areStickerMetadataEqual(
  left: StickerMetadata | null | undefined,
  right: StickerMetadata | null | undefined,
): boolean {
  return JSON.stringify(normalizeStickerMetadata(left)) === JSON.stringify(normalizeStickerMetadata(right));
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

export function buildAutoStickerMetadata(
  sticker: string,
  existing?: StickerMetadata,
): StickerMetadata | undefined {
  const inferredLabel = inferStickerSemanticLabel(sticker, undefined, existing);
  return normalizeStickerMetadata({
    label: existing?.label || inferredLabel,
    aliases: existing?.aliases,
    traits: mergeTextLists(existing?.traits, inferTraitsFromLabel(existing?.label || inferredLabel)),
  });
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

export function applyAutoStickerMetadata(
  stickers: string[],
  metadataMap: Record<string, StickerMetadata> | null | undefined,
): {
  metadataMap?: Record<string, StickerMetadata>;
  changedCount: number;
} {
  const nextMetadataMap: Record<string, StickerMetadata> = { ...(metadataMap || {}) };
  let changedCount = 0;

  stickers
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((sticker) => {
      const current = nextMetadataMap[sticker];
      const next = buildAutoStickerMetadata(sticker, current);
      if (!areStickerMetadataEqual(current, next)) {
        changedCount += 1;
        if (next) {
          nextMetadataMap[sticker] = next;
        } else {
          delete nextMetadataMap[sticker];
        }
      }
    });

  return {
    metadataMap: Object.keys(nextMetadataMap).length > 0 ? nextMetadataMap : undefined,
    changedCount,
  };
}

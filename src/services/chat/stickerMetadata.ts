import type { StickerMetadata } from '../../types';
import { inferStickerSemanticLabel } from './stickerSemantics';

const STICKER_LABEL_HINTS: Record<string, { aliases?: string[]; traits?: string[] }> = {
  生气: { aliases: ['气呼呼', '炸毛', '别惹我', '不爽'], traits: ['angry'] },
  委屈: { aliases: ['委屈巴巴', '可怜', '装可怜', '来哄我'], traits: ['sad', 'comfort'] },
  大哭: { aliases: ['爆哭', '哭哭', '眼泪汪汪'], traits: ['sad'] },
  无语: { aliases: ['翻白眼', '白眼', '嫌弃', '没话说'], traits: ['sarcastic', 'cool'] },
  害羞: { aliases: ['脸红', '不好意思', '羞'], traits: ['shy', 'affection'] },
  撒娇: { aliases: ['黏人', '装乖', '求哄', '就要'], traits: ['affection', 'playful'] },
  贴贴: { aliases: ['抱抱', '蹭蹭', '贴一下', '靠近'], traits: ['affection', 'comfort'] },
  开心: { aliases: ['高兴', '好耶', '开心一下', '乐'], traits: ['cheerful'] },
  偷笑: { aliases: ['坏笑', '憋笑', '偷着乐'], traits: ['playful'] },
  疑惑: { aliases: ['问号', '不解', '你在说什么'], traits: ['surprised'] },
  震惊: { aliases: ['惊了', '吓到', '这也行'], traits: ['surprised'] },
  困倦: { aliases: ['困困', '没电了', '好困'], traits: ['sleepy'] },
  撒欢: { aliases: ['发疯', '闹腾', '打滚'], traits: ['playful', 'cheerful'] },
  可爱卖萌: { aliases: ['可爱', '卖萌', '呆呆', '萌'], traits: ['playful', 'affection'] },
  喜欢: { aliases: ['爱你', '心动', '喜欢你'], traits: ['affection'] },
  吃醋: { aliases: ['酸了', '不爽', '介意', '有点酸'], traits: ['angry', 'affection'] },
  亲亲: { aliases: ['么么', '啵啵', '亲一下'], traits: ['affection', 'shy'] },
  求安慰: { aliases: ['哄哄我', '抱一下', '安慰我'], traits: ['comfort', 'sad'] },
  求关注: { aliases: ['理我', '看看我', '在吗', '别无视我'], traits: ['affection', 'playful'] },
  期待: { aliases: ['等你', '想见你', '快点来'], traits: ['affection', 'shy'] },
  得意: { aliases: ['神气', '骄傲', '哼哼'], traits: ['playful', 'cheerful'] },
  认错: { aliases: ['道歉', '对不起', '我错了'], traits: ['apology', 'comfort'] },
  安慰: { aliases: ['摸摸', '别难过', '拍拍你'], traits: ['comfort'] },
  鼓励: { aliases: ['加油', '你可以', '打起精神'], traits: ['cheerful', 'comfort'] },
  犯困: { aliases: ['晚安', '睡觉', '想睡了'], traits: ['sleepy'] },
  懵: { aliases: ['呆住', '傻眼', '没反应过来'], traits: ['surprised'] },
  冷漠: { aliases: ['哦', '行吧', '随便'], traits: ['cool', 'sarcastic'] },
  耍赖: { aliases: ['不管', '就要', '赖着'], traits: ['playful', 'affection'] },
  阴阳怪气: { aliases: ['呵呵', '哟', '你真行'], traits: ['sarcastic'] },
  害怕: { aliases: ['怕怕', '吓死', '救命'], traits: ['sad', 'surprised'] },
  庆祝: { aliases: ['撒花', '恭喜', '过年了'], traits: ['cheerful', 'playful'] },
};

export const STICKER_CATEGORY_OPTIONS = [
  { value: 'emotion', label: '情绪' },
  { value: 'relationship', label: '关系' },
  { value: 'scene', label: '场景' },
  { value: 'reaction', label: '反应' },
] as const;

export type StickerCategoryValue = typeof STICKER_CATEGORY_OPTIONS[number]['value'];

function isUrlLikeLabel(value: string | undefined): boolean {
  const normalized = value?.trim() || '';
  return /^https?:\/\//i.test(normalized) || normalized.startsWith('asset://uploaded/');
}

function normalizeTextValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || isUrlLikeLabel(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function normalizeStickerCategory(value: unknown): StickerCategoryValue | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return STICKER_CATEGORY_OPTIONS.some((item) => item.value === normalized)
    ? normalized as StickerCategoryValue
    : undefined;
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

function inferAliasesFromLabel(label?: string): string[] | undefined {
  const normalizedLabel = label?.trim() || '';
  if (!normalizedLabel) {
    return undefined;
  }

  return STICKER_LABEL_HINTS[normalizedLabel]?.aliases;
}

function inferCategoryFromLabel(label?: string): StickerCategoryValue | undefined {
  const normalizedLabel = label?.trim() || '';
  if (!normalizedLabel) {
    return undefined;
  }

  if (/(贴贴|亲亲|喜欢|吃醋|求安慰|求关注|期待|认错|安慰|鼓励|撒娇)/u.test(normalizedLabel)) {
    return 'relationship';
  }

  if (/(犯困|困倦|庆祝|晚安|加油)/u.test(normalizedLabel)) {
    return 'scene';
  }

  if (/(偷笑|无语|疑惑|震惊|得意|耍赖|阴阳怪气|撒欢|可爱卖萌|冷漠)/u.test(normalizedLabel)) {
    return 'reaction';
  }

  if (/(生气|委屈|大哭|害羞|开心|懵|害怕)/u.test(normalizedLabel)) {
    return 'emotion';
  }

  return 'emotion';
}

function inferTraitsFromLabel(label?: string): string[] | undefined {
  const normalizedLabel = label?.trim() || '';
  if (!normalizedLabel) {
    return undefined;
  }

  const explicitTraits = STICKER_LABEL_HINTS[normalizedLabel]?.traits;
  if (explicitTraits?.length) {
    return explicitTraits;
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
  const category = normalizeStickerCategory(record.category);
  const caption = normalizeTextValue(record.caption);
  const ocrText = normalizeTextValue(record.ocrText);

  if (!label && !aliases && !traits && !category && !caption && !ocrText) {
    return undefined;
  }

  return {
    ...(label ? { label } : {}),
    ...(aliases ? { aliases } : {}),
    ...(traits ? { traits } : {}),
    ...(category ? { category } : {}),
    ...(caption ? { caption } : {}),
    ...(ocrText ? { ocrText } : {}),
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
  const normalizedExisting = normalizeStickerMetadata(existing);
  const inferredLabel = inferStickerSemanticLabel(sticker, undefined, normalizedExisting);
  return normalizeStickerMetadata({
    label: normalizedExisting?.label || inferredLabel,
    aliases: mergeTextLists(normalizedExisting?.aliases, inferAliasesFromLabel(normalizedExisting?.label || inferredLabel)),
    traits: mergeTextLists(normalizedExisting?.traits, inferTraitsFromLabel(normalizedExisting?.label || inferredLabel)),
    category: normalizedExisting?.category || inferCategoryFromLabel(normalizedExisting?.label || inferredLabel),
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
    metadata?.category?.trim() || '',
    metadata?.caption?.trim() || '',
    metadata?.ocrText?.trim() || '',
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

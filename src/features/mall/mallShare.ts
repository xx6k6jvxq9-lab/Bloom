import type {
  ChatMessage,
  MallCatalogItem,
  SharedMallItemSnapshot,
} from '../../types';

export type MallShareMode = 'share' | 'ask';

export function createSharedMallItemSnapshot(item: MallCatalogItem): SharedMallItemSnapshot {
  return {
    id: item.id,
    title: item.title,
    ...(item.subtitle || item.subCategory ? { subtitle: item.subtitle || item.subCategory } : {}),
    category: item.category,
    price: item.price,
    blurb: item.copy.cardBlurb,
    ...(item.copy.detailDescription ? { detailDescription: item.copy.detailDescription } : {}),
    ...(item.media.coverImage || item.media.thumbnailImage
      ? { coverImage: item.media.coverImage || item.media.thumbnailImage }
      : {}),
    ...(item.media.fallbackEmoji ? { fallbackEmoji: item.media.fallbackEmoji } : {}),
    ...(item.media.fallbackIcon ? { fallbackIcon: item.media.fallbackIcon } : {}),
    ...(item.media.accentColor ? { accentColor: item.media.accentColor } : {}),
    ...(item.media.backgroundPreset ? { backgroundPreset: item.media.backgroundPreset } : {}),
  };
}

export function buildMallShareDraftText(item: MallCatalogItem, mode: MallShareMode): string {
  const title = item.title.trim() || '这个商品';

  if (mode === 'ask') {
    return `我刚看到「${title}」，你觉得适合我吗？现在买合适吗？`;
  }

  return `我刚看到「${title}」，想分享给你看看。`;
}

export function createMallShareChatMessage(
  item: MallCatalogItem,
  mode: MallShareMode,
  timestamp: number = Date.now(),
): ChatMessage {
  return {
    role: 'user',
    text: buildMallShareDraftText(item, mode),
    timestamp,
    source: 'app',
    channel: 'app',
    needsReply: true,
    sharedMallItem: createSharedMallItemSnapshot(item),
  };
}

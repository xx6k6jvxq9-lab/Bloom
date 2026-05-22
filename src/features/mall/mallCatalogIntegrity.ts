import type { MallCatalogItem } from '../../types';

const MOJIBAKE_FRAGMENT_PATTERN = /(?:�|锛|銆|鈥|鐨|鍦|鍙|娌|浠|鎴|浣|璇|绗|閫|鍟|鍝|妯|鐢|鏇|绀|绉|瀹|鏁|鐫|鍏|闃|鏈€|鏌|钀|偐|鐭|灞|妗|绾|鐏|鍥|搧|鐗|楂|嫟|寮|姘|鍐|堣)/g;

export function isSuspectedMojibakeText(value: string | null | undefined): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (normalized.includes('�')) {
    return true;
  }

  const matches = normalized.match(MOJIBAKE_FRAGMENT_PATTERN);
  return (matches?.length ?? 0) >= 2;
}

export function isSuspectedMojibakeMallItem(item: MallCatalogItem | null | undefined): boolean {
  if (!item) {
    return false;
  }

  return [
    item.title,
    item.subtitle,
    item.category,
    item.subCategory,
    item.copy.cardBlurb,
    item.copy.detailDescription,
    item.copy.recommendationReason,
  ].some((entry) => isSuspectedMojibakeText(entry));
}

export function sanitizeMallCatalogSource(
  sourceCatalog: MallCatalogItem[] | undefined,
  fallbackCatalog: MallCatalogItem[],
): MallCatalogItem[] | undefined {
  if (!Array.isArray(sourceCatalog) || sourceCatalog.length === 0) {
    return sourceCatalog;
  }

  const fallbackIdSet = new Set(fallbackCatalog.map((item) => item.id));

  return sourceCatalog.filter((item) => {
    if (fallbackIdSet.has(item.id)) {
      return true;
    }

    return !isSuspectedMojibakeMallItem(item);
  });
}

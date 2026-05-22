import type { MallHomeMode } from '../../components/mall/MallApp/MallViewData';
import type { MallCatalogItem } from '../../types';
import type { MallGeneratedShelfPlan } from './generateMallShelfPlan';

export function isPrivateMallItem(item: MallCatalogItem): boolean {
  return item.category === '私密' || item.sensitivity === 'private' || item.sensitivity === 'restricted';
}

export function isMallItemVisibleForMode(item: MallCatalogItem, mode: MallHomeMode): boolean {
  if (mode === 'private') {
    return isPrivateMallItem(item);
  }

  return !isPrivateMallItem(item);
}

export function getMallVisibleCategories(catalog: MallCatalogItem[], mode: MallHomeMode): string[] {
  return ['全部', ...Array.from(new Set(
    catalog
      .filter((item) => isMallItemVisibleForMode(item, mode))
      .map((item) => item.category),
  ))];
}

export function normalizeMallCategorySelection(
  value: string | null | undefined,
  catalog: MallCatalogItem[],
  mode: MallHomeMode,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return getMallVisibleCategories(catalog, mode).includes(normalized)
    ? normalized
    : null;
}

export function sanitizeMallGeneratedShelfPlan(
  plan: MallGeneratedShelfPlan,
  catalog: MallCatalogItem[],
  mode: MallHomeMode,
): MallGeneratedShelfPlan | null {
  const visibleItemIds = new Set(
    catalog
      .filter((item) => isMallItemVisibleForMode(item, mode))
      .map((item) => item.id),
  );
  const itemIds = Array.from(new Set(
    (Array.isArray(plan.itemIds) ? plan.itemIds : [])
      .filter((itemId): itemId is string => typeof itemId === 'string' && visibleItemIds.has(itemId)),
  ));

  if (itemIds.length === 0) {
    return null;
  }

  const rawCategoryHint = typeof plan.categoryHint === 'string'
    ? plan.categoryHint.trim()
    : '';
  const categoryHint = normalizeMallCategorySelection(rawCategoryHint || null, catalog, mode);

  if (rawCategoryHint && !categoryHint) {
    return null;
  }

  return {
    ...plan,
    itemIds,
    categoryHint,
  };
}

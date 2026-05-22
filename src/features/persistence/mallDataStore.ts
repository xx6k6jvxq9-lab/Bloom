import type { MallCatalogItem, MallData } from '../../types';
import { sanitizeMallCatalogSource } from '../mall/mallCatalogIntegrity';
import { createDefaultMallData } from '../mall/defaultMallData';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

function mergeMallCatalog(
  sourceCatalog: MallCatalogItem[] | undefined,
  fallbackCatalog: MallCatalogItem[],
): MallCatalogItem[] {
  if (!Array.isArray(sourceCatalog) || sourceCatalog.length === 0) {
    return fallbackCatalog;
  }

  const fallbackById = new Map(fallbackCatalog.map((item) => [item.id, item]));
  const merged = sourceCatalog.map((item) => {
    const fallbackItem = fallbackById.get(item.id);
    if (!fallbackItem) {
      return item;
    }

    const mergedDestinationKinds = Array.from(new Set([
      ...(Array.isArray(fallbackItem.destinationKinds) ? fallbackItem.destinationKinds : []),
      ...(Array.isArray(item.destinationKinds) ? item.destinationKinds : []),
    ]));

    // Catalog entries are seed data; prefer the code-defined copy to heal stale or corrupted persisted text.
    return {
      ...item,
      ...fallbackItem,
      destinationKinds: mergedDestinationKinds,
      media: {
        ...item.media,
        ...fallbackItem.media,
      },
      copy: {
        ...item.copy,
        ...fallbackItem.copy,
      },
    };
  });

  const existingIds = new Set(merged.map((item) => item.id));
  const missingFallbackItems = fallbackCatalog.filter((item) => !existingIds.has(item.id));
  return [...merged, ...missingFallbackItems];
}

export function hydrateMallData(source: Partial<MallData> | null | undefined, fallback: MallData): MallData {
  const sanitizedSourceCatalog = sanitizeMallCatalogSource(
    Array.isArray(source?.catalog) ? source!.catalog : undefined,
    fallback.catalog,
  );

  return {
    catalog: mergeMallCatalog(sanitizedSourceCatalog, fallback.catalog),
    cart: Array.isArray(source?.cart) ? source!.cart : fallback.cart,
    orders: Array.isArray(source?.orders) ? source!.orders : fallback.orders,
    ownedItems: Array.isArray(source?.ownedItems) ? source!.ownedItems : fallback.ownedItems,
    deliveryFeed: Array.isArray(source?.deliveryFeed) ? source!.deliveryFeed : fallback.deliveryFeed,
    wishlist: Array.isArray(source?.wishlist) ? source!.wishlist : fallback.wishlist,
    recentSearches: Array.isArray(source?.recentSearches) ? source!.recentSearches : fallback.recentSearches,
    recentViewedItemIds: Array.isArray(source?.recentViewedItemIds) ? source!.recentViewedItemIds : fallback.recentViewedItemIds,
    addresses: Array.isArray(source?.addresses) ? source!.addresses : fallback.addresses,
    selectedAddressId: source?.selectedAddressId ?? fallback.selectedAddressId,
    currentShoppingCompanionId: source?.currentShoppingCompanionId ?? fallback.currentShoppingCompanionId,
  };
}

export function loadPersistedMallData(fallback: MallData = createDefaultMallData()): MallData {
  const persisted = loadJson<Partial<MallData> | null>(STORAGE_KEYS.mallData, null);
  return hydrateMallData(persisted ? { ...fallback, ...persisted } : fallback, fallback);
}

export function persistMallData(data: MallData): void {
  saveJson(STORAGE_KEYS.mallData, data);
}

export function clearPersistedMallData(): void {
  removeStoredJson(STORAGE_KEYS.mallData);
}

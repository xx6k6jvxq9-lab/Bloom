import type { MallData } from '../../types';
import { createDefaultMallData } from '../mall/defaultMallData';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export function hydrateMallData(source: Partial<MallData> | null | undefined, fallback: MallData): MallData {
  return {
    catalog: Array.isArray(source?.catalog) ? source!.catalog : fallback.catalog,
    cart: Array.isArray(source?.cart) ? source!.cart : fallback.cart,
    orders: Array.isArray(source?.orders) ? source!.orders : fallback.orders,
    ownedItems: Array.isArray(source?.ownedItems) ? source!.ownedItems : fallback.ownedItems,
    deliveryFeed: Array.isArray(source?.deliveryFeed) ? source!.deliveryFeed : fallback.deliveryFeed,
    wishlist: Array.isArray(source?.wishlist) ? source!.wishlist : fallback.wishlist,
    recentSearches: Array.isArray(source?.recentSearches) ? source!.recentSearches : fallback.recentSearches,
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

import type { FavoriteMessage, Mask, WorldBookEntry } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export type MeData = {
  masks: Mask[];
  favorites: FavoriteMessage[];
  worldBooks: WorldBookEntry[];
};

export function hydrateMeData(source: Partial<MeData> | null | undefined, fallback: MeData): MeData {
  return {
    masks: Array.isArray(source?.masks) ? source!.masks : fallback.masks,
    favorites: Array.isArray(source?.favorites) ? source!.favorites : fallback.favorites,
    worldBooks: Array.isArray(source?.worldBooks) ? source!.worldBooks : fallback.worldBooks,
  };
}

export function loadPersistedMeData(fallback: MeData): MeData {
  const persisted = loadJson<Partial<MeData> | null>(STORAGE_KEYS.meData, null);
  return hydrateMeData(persisted ? { ...fallback, ...persisted } : fallback, fallback);
}

export function persistMeData(data: MeData): void {
  saveJson(STORAGE_KEYS.meData, data);
}

export function clearPersistedMeData(): void {
  removeStoredJson(STORAGE_KEYS.meData);
}

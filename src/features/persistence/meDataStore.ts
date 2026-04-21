import type { FavoriteMessage, Mask, WorldBookEntry } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export type MeData = {
  masks: Mask[];
  favorites: FavoriteMessage[];
  worldBooks: WorldBookEntry[];
};

function mergeById<T extends { id: string }>(
  primary: T[] | undefined,
  fallback: T[],
): T[] {
  if (!Array.isArray(primary)) {
    return fallback;
  }

  const seenIds = new Set(primary.map((item) => item.id).filter(Boolean));
  const missingFromFallback = fallback.filter((item) => {
    if (!item?.id || seenIds.has(item.id)) {
      return false;
    }

    seenIds.add(item.id);
    return true;
  });

  return [...primary, ...missingFromFallback];
}

export function hydrateMeData(source: Partial<MeData> | null | undefined, fallback: MeData): MeData {
  return {
    masks: mergeById(source?.masks, fallback.masks),
    favorites: mergeById(source?.favorites, fallback.favorites),
    worldBooks: mergeById(source?.worldBooks, fallback.worldBooks),
  };
}

export function loadPersistedMeData(fallback: MeData): MeData {
  const persisted = loadJson<Partial<MeData> | null>(STORAGE_KEYS.meData, null);
  const hydrated = hydrateMeData(persisted ?? fallback, fallback);

  if (persisted && JSON.stringify(hydrated) !== JSON.stringify(persisted)) {
    persistMeData(hydrated);
  }

  return hydrated;
}

export function persistMeData(data: MeData): void {
  saveJson(STORAGE_KEYS.meData, data);
}

export function clearPersistedMeData(): void {
  removeStoredJson(STORAGE_KEYS.meData);
}

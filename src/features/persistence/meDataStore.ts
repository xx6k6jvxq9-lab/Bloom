import type { FavoriteMessage, Mask, WorldBookEntry } from '../../types';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
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

export async function loadPreferredMeData(fallback: MeData): Promise<MeData> {
  try {
    const persisted = await loadJsonRecord<Partial<MeData>>(STORAGE_KEYS.meData);
    if (persisted) {
      return hydrateMeData(persisted, fallback);
    }
  } catch (error) {
    console.error('[meDataStore] Failed to load meData from IndexedDB', error);
  }

  return loadPersistedMeData(fallback);
}

export function persistMeData(data: MeData): Promise<void> {
  saveJson(STORAGE_KEYS.meData, data);

  return saveJsonRecord(STORAGE_KEYS.meData, data).catch((error) => {
    console.error('[meDataStore] Failed to persist meData into IndexedDB', error);
  });
}

export function clearPersistedMeData(): void {
  removeStoredJson(STORAGE_KEYS.meData);
  void removeJsonRecord(STORAGE_KEYS.meData).catch((error) => {
    console.error('[meDataStore] Failed to remove meData from IndexedDB', error);
  });
}

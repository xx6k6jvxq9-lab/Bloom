import type {
  FavoriteMessage,
  Mask,
  RelationshipAvatarBinding,
  UserAvatarLibrary,
  WorldBookEntry,
} from '../../types';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';
import {
  normalizeWorldBookCategory,
  normalizeWorldBookPriorityLevel,
} from '../../services/world-book/worldBookMeta';
import { buildWorldBookChunkCache } from '../../services/world-book/worldBookBudget';
import { applyDerivedWorldBookMetadata } from '../../services/world-book/worldBookDerived';
import { sanitizeTransientAssetValue } from './sanitizeTransientAssetValue';
import {
  normalizeRelationshipAvatarBindings,
  normalizeUserAvatarLibrary,
} from '../../services/user-avatar/userAvatarState';

export type MeData = {
  masks: Mask[];
  favorites: FavoriteMessage[];
  worldBooks: WorldBookEntry[];
  userAvatarLibrary?: UserAvatarLibrary;
  relationshipAvatarBindings?: RelationshipAvatarBinding[];
};

function normalizeWorldBookEntry(entry: WorldBookEntry): WorldBookEntry {
  return applyDerivedWorldBookMetadata({
    ...entry,
    title: typeof entry.title === 'string' ? entry.title.trim() : '',
    content: typeof entry.content === 'string' ? entry.content.trim() : '',
    category: normalizeWorldBookCategory(entry.category),
    priorityLevel: normalizeWorldBookPriorityLevel(entry.priorityLevel),
    isActive: entry.isActive !== false,
    isGlobal: entry.isGlobal !== false,
    characterIds: Array.isArray(entry.characterIds) ? entry.characterIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) : [],
    pinMode: entry.pinMode === 'always' ? 'always' : 'none',
    chunkCache: buildWorldBookChunkCache(entry),
  });
}

function mergeWorldBooks(
  primary: WorldBookEntry[] | undefined,
  fallback: WorldBookEntry[],
): WorldBookEntry[] {
  return mergeById(primary, fallback).map(normalizeWorldBookEntry);
}

function sanitizeUserAvatarLibrary(library: UserAvatarLibrary | undefined): UserAvatarLibrary {
  const normalizedLibrary = normalizeUserAvatarLibrary(library);
  const entries = normalizedLibrary.entries
    .map((entry) => {
      const image = sanitizeTransientAssetValue(entry.image) || '';
      if (!image) {
        return null;
      }

      return {
        ...entry,
        image,
      };
    })
    .filter((entry): entry is UserAvatarLibrary['entries'][number] => !!entry);

  return {
    entries,
    updatedAt: entries.reduce(
      (maxValue, entry) => Math.max(maxValue, entry.updatedAt),
      normalizedLibrary.updatedAt,
    ),
  };
}

function mergeUserAvatarLibraries(
  primary: UserAvatarLibrary | undefined,
  fallback: UserAvatarLibrary | undefined,
): UserAvatarLibrary {
  const normalizedPrimary = sanitizeUserAvatarLibrary(primary);
  const normalizedFallback = sanitizeUserAvatarLibrary(fallback);
  const entries = [...normalizedPrimary.entries];
  const seenKeys = new Set(
    normalizedPrimary.entries.flatMap((entry) => [entry.id, `image:${entry.image}`]),
  );

  normalizedFallback.entries.forEach((entry) => {
    const imageKey = `image:${entry.image}`;
    if (seenKeys.has(entry.id) || seenKeys.has(imageKey)) {
      return;
    }

    entries.push(entry);
    seenKeys.add(entry.id);
    seenKeys.add(imageKey);
  });

  return {
    entries,
    updatedAt: entries.reduce(
      (maxValue, entry) => Math.max(maxValue, entry.updatedAt),
      Math.max(normalizedPrimary.updatedAt, normalizedFallback.updatedAt),
    ),
  };
}

function mergeRelationshipBindings(
  primary: RelationshipAvatarBinding[] | undefined,
  fallback: RelationshipAvatarBinding[] | undefined,
): RelationshipAvatarBinding[] {
  return normalizeRelationshipAvatarBindings([
    ...(fallback || []),
    ...(primary || []),
  ]);
}

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
    worldBooks: mergeWorldBooks(source?.worldBooks, fallback.worldBooks),
    userAvatarLibrary: mergeUserAvatarLibraries(source?.userAvatarLibrary, fallback.userAvatarLibrary),
    relationshipAvatarBindings: mergeRelationshipBindings(
      source?.relationshipAvatarBindings,
      fallback.relationshipAvatarBindings,
    ),
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

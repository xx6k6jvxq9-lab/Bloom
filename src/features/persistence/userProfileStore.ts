import type { UserProfileExtended } from '../../types';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { sanitizeTransientAssetValue } from './sanitizeTransientAssetValue';
import { STORAGE_KEYS } from './storageKeys';

export function hydrateUserProfile(
  source: Partial<UserProfileExtended> | null | undefined,
  fallback: UserProfileExtended,
): UserProfileExtended {
  return {
    name: source?.name || fallback.name,
    avatar: sanitizeTransientAssetValue(source?.avatar) || fallback.avatar,
    id: source?.id || fallback.id,
    bio: source?.bio || fallback.bio,
    mood: source?.mood || fallback.mood,
  };
}

export function loadPersistedUserProfile(fallback: UserProfileExtended): UserProfileExtended {
  const persisted = loadJson<Partial<UserProfileExtended> | null>(STORAGE_KEYS.userProfile, null);
  return hydrateUserProfile(persisted ? { ...fallback, ...persisted } : fallback, fallback);
}

export async function loadPreferredUserProfile(fallback: UserProfileExtended): Promise<UserProfileExtended> {
  const localProfile = loadPersistedUserProfile(fallback);

  try {
    const persisted = await loadJsonRecord<Partial<UserProfileExtended>>(STORAGE_KEYS.userProfile);
    if (persisted) {
      const indexedDbProfile = hydrateUserProfile({ ...fallback, ...persisted }, fallback);
      const localSerialized = JSON.stringify(localProfile);
      const indexedDbSerialized = JSON.stringify(indexedDbProfile);

      if (localSerialized !== indexedDbSerialized) {
        void saveJsonRecord(STORAGE_KEYS.userProfile, localProfile).catch((error) => {
          console.error('[userProfileStore] Failed to reconcile user profile into IndexedDB', error);
        });
        return localProfile;
      }

      return indexedDbProfile;
    }
  } catch (error) {
    console.error('[userProfileStore] Failed to load user profile from IndexedDB', error);
  }

  return localProfile;
}

export function persistUserProfile(profile: UserProfileExtended): Promise<void> {
  saveJson(STORAGE_KEYS.userProfile, profile);

  return saveJsonRecord(STORAGE_KEYS.userProfile, profile).catch((error) => {
    console.error('[userProfileStore] Failed to persist user profile into IndexedDB', error);
  });
}

export function clearPersistedUserProfile(): void {
  removeStoredJson(STORAGE_KEYS.userProfile);
  void removeJsonRecord(STORAGE_KEYS.userProfile).catch((error) => {
    console.error('[userProfileStore] Failed to remove user profile from IndexedDB', error);
  });
}

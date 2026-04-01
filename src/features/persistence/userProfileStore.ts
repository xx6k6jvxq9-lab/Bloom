import type { UserProfileExtended } from '../../types';
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

export function persistUserProfile(profile: UserProfileExtended): void {
  saveJson(STORAGE_KEYS.userProfile, profile);
}

export function clearPersistedUserProfile(): void {
  removeStoredJson(STORAGE_KEYS.userProfile);
}

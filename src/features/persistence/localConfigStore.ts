import { mirrorStorageRemoval, mirrorStorageValue } from './persistenceMirror';
import { STORAGE_KEYS } from './storageKeys';

const LOCAL_STORAGE_PREFERRED_KEYS = new Set<string>([
  STORAGE_KEYS.settings,
  STORAGE_KEYS.migrationMeta,
  STORAGE_KEYS.userProfile,
  STORAGE_KEYS.visualSettings,
]);
const LOCAL_STORAGE_MAX_BEST_EFFORT_BYTES = 64 * 1024;

type LocalStorageSyncDecision =
  | {
      mode: 'write';
      serialized: string;
    }
  | {
      mode: 'remove';
    };

function buildLocalStorageSyncDecision<T>(key: string, value: T): LocalStorageSyncDecision {
  if (key === STORAGE_KEYS.appData) {
    return { mode: 'remove' };
  }

  const serialized = JSON.stringify(value);
  if (!LOCAL_STORAGE_PREFERRED_KEYS.has(key)) {
    return serialized.length <= LOCAL_STORAGE_MAX_BEST_EFFORT_BYTES
      ? {
          mode: 'write',
          serialized,
        }
      : { mode: 'remove' };
  }

  return {
    mode: 'write',
    serialized,
  };
}

export function syncLocalStorageJsonValue<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    const decision = buildLocalStorageSyncDecision(key, value);
    if (decision.mode === 'write') {
      window.localStorage.setItem(key, decision.serialized);
      return;
    }

    window.localStorage.removeItem(key);
  } catch (error) {
    console.error(`[localConfigStore] Failed to sync key "${key}"`, error);
  }
}

export function removeLocalStorageValue(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error(`[localConfigStore] Failed to remove key "${key}"`, error);
  }
}

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[localConfigStore] Failed to load key "${key}"`, error);
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  syncLocalStorageJsonValue(key, value);

  mirrorStorageValue(key, value);
}

export function remove(key: string): void {
  if (typeof window === 'undefined') return;

  removeLocalStorageValue(key);

  mirrorStorageRemoval(key);
}

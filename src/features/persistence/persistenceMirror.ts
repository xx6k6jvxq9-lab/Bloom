import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { STORAGE_KEYS } from './storageKeys';

const MIRRORED_STORAGE_KEYS = new Set<string>([
  STORAGE_KEYS.coupleSpace,
  STORAGE_KEYS.datingRecords,
  STORAGE_KEYS.forumData,
  STORAGE_KEYS.mallData,
  STORAGE_KEYS.meData,
  STORAGE_KEYS.moments,
  STORAGE_KEYS.musicData,
  STORAGE_KEYS.userProfile,
  STORAGE_KEYS.walletData,
]);

export function shouldMirrorStorageKey(key: string): boolean {
  return MIRRORED_STORAGE_KEYS.has(key);
}

export function mirrorStorageValue<T>(key: string, value: T): void {
  if (!shouldMirrorStorageKey(key) || typeof window === 'undefined') {
    return;
  }

  void saveJsonRecord(key, value).catch((error) => {
    console.error(`[persistenceMirror] Failed to mirror key "${key}"`, error);
  });
}

export function mirrorStorageRemoval(key: string): void {
  if (!shouldMirrorStorageKey(key) || typeof window === 'undefined') {
    return;
  }

  void removeJsonRecord(key).catch((error) => {
    console.error(`[persistenceMirror] Failed to remove mirrored key "${key}"`, error);
  });
}

export async function restoreMirroredStorageKeys(keys?: string[]): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const targetKeys = (keys ?? Array.from(MIRRORED_STORAGE_KEYS)).filter((key) => shouldMirrorStorageKey(key));
  await Promise.all(
    targetKeys.map(async (key) => {
      const current = window.localStorage.getItem(key);
      if (current) {
        return;
      }

      const mirroredValue = await loadJsonRecord<unknown>(key);
      if (mirroredValue == null) {
        return;
      }

      try {
        window.localStorage.setItem(key, JSON.stringify(mirroredValue));
      } catch (error) {
        console.error(`[persistenceMirror] Failed to restore mirrored key "${key}"`, error);
      }
    }),
  );
}

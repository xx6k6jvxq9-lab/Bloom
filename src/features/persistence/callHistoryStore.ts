import type { CallRecord } from '../../types';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export function loadCallHistory(fallback: CallRecord[] = []): CallRecord[] {
  const persisted = loadJson<CallRecord[] | null>(STORAGE_KEYS.callHistory, null);
  return Array.isArray(persisted) ? persisted : fallback;
}

export async function loadPreferredCallHistory(fallback: CallRecord[] = []): Promise<CallRecord[]> {
  try {
    const persisted = await loadJsonRecord<CallRecord[]>(STORAGE_KEYS.callHistory);
    if (Array.isArray(persisted)) {
      return persisted;
    }
  } catch (error) {
    console.error('[callHistoryStore] Failed to load call history from IndexedDB', error);
  }

  return loadCallHistory(fallback);
}

export function saveCallHistory(value: CallRecord[]): Promise<void> {
  saveJson(STORAGE_KEYS.callHistory, value);

  return saveJsonRecord(STORAGE_KEYS.callHistory, value).catch((error) => {
    console.error('[callHistoryStore] Failed to persist call history into IndexedDB', error);
  });
}

export function patchCallHistory(
  updater: (current: CallRecord[]) => CallRecord[],
  fallback: CallRecord[] = [],
): Promise<CallRecord[]> {
  const nextValue = updater(loadCallHistory(fallback));
  return saveCallHistory(nextValue).then(() => nextValue);
}

export function resetCallHistory(): void {
  removeStoredJson(STORAGE_KEYS.callHistory);
  void removeJsonRecord(STORAGE_KEYS.callHistory).catch((error) => {
    console.error('[callHistoryStore] Failed to remove call history from IndexedDB', error);
  });
}

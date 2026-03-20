import type { CallRecord } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export function loadCallHistory(fallback: CallRecord[] = []): CallRecord[] {
  const persisted = loadJson<CallRecord[] | null>(STORAGE_KEYS.callHistory, null);
  return Array.isArray(persisted) ? persisted : fallback;
}

export function saveCallHistory(value: CallRecord[]): void {
  saveJson(STORAGE_KEYS.callHistory, value);
}

export function patchCallHistory(
  updater: (current: CallRecord[]) => CallRecord[],
  fallback: CallRecord[] = [],
): CallRecord[] {
  const nextValue = updater(loadCallHistory(fallback));
  saveCallHistory(nextValue);
  return nextValue;
}

export function resetCallHistory(): void {
  removeStoredJson(STORAGE_KEYS.callHistory);
}

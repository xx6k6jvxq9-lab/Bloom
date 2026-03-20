import type { DateSession } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export type DatingRecordsData = {
  savedDates: DateSession[];
  collectedDates: DateSession[];
};

function hydrateDatingRecords(
  source: Partial<DatingRecordsData> | null | undefined,
  fallback: DatingRecordsData,
): DatingRecordsData {
  return {
    savedDates: Array.isArray(source?.savedDates) ? source!.savedDates : fallback.savedDates,
    collectedDates: Array.isArray(source?.collectedDates) ? source!.collectedDates : fallback.collectedDates,
  };
}

export function loadDatingRecords(
  fallback: DatingRecordsData = { savedDates: [], collectedDates: [] },
): DatingRecordsData {
  const persisted = loadJson<Partial<DatingRecordsData> | null>(STORAGE_KEYS.datingRecords, null);
  return hydrateDatingRecords(persisted, fallback);
}

export function saveDatingRecords(value: DatingRecordsData): void {
  saveJson(STORAGE_KEYS.datingRecords, value);
}

export function patchDatingRecords(
  updater: (current: DatingRecordsData) => DatingRecordsData,
  fallback: DatingRecordsData = { savedDates: [], collectedDates: [] },
): DatingRecordsData {
  const nextValue = updater(loadDatingRecords(fallback));
  saveDatingRecords(nextValue);
  return nextValue;
}

export function resetDatingRecords(): void {
  removeStoredJson(STORAGE_KEYS.datingRecords);
}

export function loadSavedDates(fallback: DateSession[] = []): DateSession[] {
  return loadDatingRecords({ savedDates: fallback, collectedDates: [] }).savedDates;
}

export function saveSavedDates(value: DateSession[]): void {
  saveDatingRecords({ savedDates: value, collectedDates: loadCollectedDates([]) });
}

export function patchSavedDates(
  updater: (current: DateSession[]) => DateSession[],
  fallback: DateSession[] = [],
): DateSession[] {
  const nextValue = updater(loadSavedDates(fallback));
  saveDatingRecords({ savedDates: nextValue, collectedDates: loadCollectedDates([]) });
  return nextValue;
}

export function resetSavedDates(): void {
  const current = loadDatingRecords();
  saveDatingRecords({ ...current, savedDates: [] });
}

export function loadCollectedDates(fallback: DateSession[] = []): DateSession[] {
  return loadDatingRecords({ savedDates: [], collectedDates: fallback }).collectedDates;
}

export function saveCollectedDates(value: DateSession[]): void {
  saveDatingRecords({ savedDates: loadSavedDates([]), collectedDates: value });
}

export function patchCollectedDates(
  updater: (current: DateSession[]) => DateSession[],
  fallback: DateSession[] = [],
): DateSession[] {
  const nextValue = updater(loadCollectedDates(fallback));
  saveDatingRecords({ savedDates: loadSavedDates([]), collectedDates: nextValue });
  return nextValue;
}

export function resetCollectedDates(): void {
  const current = loadDatingRecords();
  saveDatingRecords({ ...current, collectedDates: [] });
}

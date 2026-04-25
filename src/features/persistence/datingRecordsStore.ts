import type { DateSession } from '../../types';
import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
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

export async function loadPreferredDatingRecords(
  fallback: DatingRecordsData = { savedDates: [], collectedDates: [] },
): Promise<DatingRecordsData> {
  try {
    const persisted = await loadJsonRecord<Partial<DatingRecordsData>>(STORAGE_KEYS.datingRecords);
    if (persisted) {
      return hydrateDatingRecords(persisted, fallback);
    }
  } catch (error) {
    console.error('[datingRecordsStore] Failed to load dating records from IndexedDB', error);
  }

  return loadDatingRecords(fallback);
}

export function saveDatingRecords(value: DatingRecordsData): Promise<void> {
  saveJson(STORAGE_KEYS.datingRecords, value);

  return saveJsonRecord(STORAGE_KEYS.datingRecords, value).catch((error) => {
    console.error('[datingRecordsStore] Failed to persist dating records into IndexedDB', error);
  });
}

export function patchDatingRecords(
  updater: (current: DatingRecordsData) => DatingRecordsData,
  fallback: DatingRecordsData = { savedDates: [], collectedDates: [] },
): Promise<DatingRecordsData> {
  const nextValue = updater(loadDatingRecords(fallback));
  return saveDatingRecords(nextValue).then(() => nextValue);
}

export function resetDatingRecords(): void {
  removeStoredJson(STORAGE_KEYS.datingRecords);
  void removeJsonRecord(STORAGE_KEYS.datingRecords).catch((error) => {
    console.error('[datingRecordsStore] Failed to remove dating records from IndexedDB', error);
  });
}

export function loadSavedDates(fallback: DateSession[] = []): DateSession[] {
  return loadDatingRecords({ savedDates: fallback, collectedDates: [] }).savedDates;
}

export function saveSavedDates(value: DateSession[]): Promise<void> {
  return saveDatingRecords({ savedDates: value, collectedDates: loadCollectedDates([]) });
}

export function patchSavedDates(
  updater: (current: DateSession[]) => DateSession[],
  fallback: DateSession[] = [],
): Promise<DateSession[]> {
  const nextValue = updater(loadSavedDates(fallback));
  return saveDatingRecords({ savedDates: nextValue, collectedDates: loadCollectedDates([]) }).then(() => nextValue);
}

export function resetSavedDates(): void {
  const current = loadDatingRecords();
  void saveDatingRecords({ ...current, savedDates: [] });
}

export function loadCollectedDates(fallback: DateSession[] = []): DateSession[] {
  return loadDatingRecords({ savedDates: [], collectedDates: fallback }).collectedDates;
}

export function saveCollectedDates(value: DateSession[]): Promise<void> {
  return saveDatingRecords({ savedDates: loadSavedDates([]), collectedDates: value });
}

export function patchCollectedDates(
  updater: (current: DateSession[]) => DateSession[],
  fallback: DateSession[] = [],
): Promise<DateSession[]> {
  const nextValue = updater(loadCollectedDates(fallback));
  return saveDatingRecords({ savedDates: loadSavedDates([]), collectedDates: nextValue }).then(() => nextValue);
}

export function resetCollectedDates(): void {
  const current = loadDatingRecords();
  void saveDatingRecords({ ...current, collectedDates: [] });
}

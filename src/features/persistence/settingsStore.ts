import type { AppSettings } from '../../types';
import { loadJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export function loadPersistedSettings(
  fallback: AppSettings,
): AppSettings {
  return loadJson<AppSettings>(STORAGE_KEYS.settings, fallback);
}

export async function loadPersistedSettingsFromIndexedDb(): Promise<AppSettings | null> {
  return loadJsonRecord<AppSettings>(STORAGE_KEYS.settings);
}

export async function persistSettings(settings: AppSettings): Promise<void> {
  saveJson(STORAGE_KEYS.settings, settings);

  try {
    await saveJsonRecord(STORAGE_KEYS.settings, settings);
  } catch (error) {
    console.error('[settingsStore] Failed to persist settings into IndexedDB', error);
  }
}

import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';
import type { PerceptionSettings } from '../../types';

type PerceptionField = {
  enabled: boolean;
  value: string;
};

function createDefaultPerceptionField(): PerceptionField {
  return {
    enabled: false,
    value: '',
  };
}

export function createDefaultPerceptionSettings(): PerceptionSettings {
  return {
    enabled: false,
    dateTime: createDefaultPerceptionField(),
    location: createDefaultPerceptionField(),
    weather: createDefaultPerceptionField(),
    temperature: createDefaultPerceptionField(),
    climate: createDefaultPerceptionField(),
  };
}

function hydratePerceptionField(
  source: Partial<PerceptionField> | null | undefined,
  fallback: PerceptionField,
): PerceptionField {
  return {
    enabled: source?.enabled === true,
    value: typeof source?.value === 'string' ? source.value : fallback.value,
  };
}

export function hydratePerceptionSettings(
  source: Partial<PerceptionSettings> | null | undefined,
  fallback: PerceptionSettings = createDefaultPerceptionSettings(),
): PerceptionSettings {
  return {
    enabled: source?.enabled === true,
    dateTime: hydratePerceptionField(source?.dateTime, fallback.dateTime),
    location: hydratePerceptionField(source?.location, fallback.location),
    weather: hydratePerceptionField(source?.weather, fallback.weather),
    temperature: hydratePerceptionField(source?.temperature, fallback.temperature),
    climate: hydratePerceptionField(source?.climate, fallback.climate),
  };
}

export function loadPersistedPerception(
  fallback: PerceptionSettings = createDefaultPerceptionSettings(),
): PerceptionSettings {
  const persisted = loadJson<Partial<PerceptionSettings> | null>(STORAGE_KEYS.perception, null);
  const hydrated = hydratePerceptionSettings(persisted, fallback);

  if (persisted && JSON.stringify(hydrated) !== JSON.stringify(persisted)) {
    void persistPerception(hydrated);
  }

  return hydrated;
}

export async function loadPreferredPerception(
  fallback: PerceptionSettings = createDefaultPerceptionSettings(),
): Promise<PerceptionSettings> {
  try {
    const persisted = await loadJsonRecord<Partial<PerceptionSettings>>(STORAGE_KEYS.perception);
    if (persisted) {
      return hydratePerceptionSettings(persisted, fallback);
    }
  } catch (error) {
    console.error('[perceptionStore] Failed to load perception from IndexedDB', error);
  }

  return loadPersistedPerception(fallback);
}

export function persistPerception(data: PerceptionSettings): Promise<void> {
  saveJson(STORAGE_KEYS.perception, data);

  return saveJsonRecord(STORAGE_KEYS.perception, data).catch((error) => {
    console.error('[perceptionStore] Failed to persist perception into IndexedDB', error);
  });
}

export function clearPersistedPerception(): void {
  removeStoredJson(STORAGE_KEYS.perception);
  void removeJsonRecord(STORAGE_KEYS.perception).catch((error) => {
    console.error('[perceptionStore] Failed to remove perception from IndexedDB', error);
  });
}

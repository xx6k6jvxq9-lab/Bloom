import type { MusicData } from '../../types';
import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export function loadPersistedMusicData<T extends MusicData>(fallback: T): T {
  const persisted = loadJson<T | null>(STORAGE_KEYS.musicData, null);
  return (persisted ? { ...fallback, ...persisted } : fallback) as T;
}

export function persistMusicData(data: MusicData): void {
  saveJson(STORAGE_KEYS.musicData, data);
}

export function clearPersistedMusicData(): void {
  removeStoredJson(STORAGE_KEYS.musicData);
}

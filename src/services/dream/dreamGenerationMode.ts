import type { DreamGenerationMode } from './dreamRuntimeTypes';

export const DREAM_DEFAULT_GENERATION_MODE_KEY = 'dream_generation_default_mode';

export function isDreamGenerationMode(value: unknown): value is DreamGenerationMode {
  return value === 'light' || value === 'woven';
}

export function readPersistedDefaultDreamGenerationMode(): DreamGenerationMode | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(DREAM_DEFAULT_GENERATION_MODE_KEY);
    return isDreamGenerationMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writePersistedDefaultDreamGenerationMode(mode: DreamGenerationMode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DREAM_DEFAULT_GENERATION_MODE_KEY, mode);
}

export function clearPersistedDefaultDreamGenerationMode() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DREAM_DEFAULT_GENERATION_MODE_KEY);
}

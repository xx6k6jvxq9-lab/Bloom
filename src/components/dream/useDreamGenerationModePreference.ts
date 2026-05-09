import { useCallback, useState } from 'react';

import {
  clearPersistedDefaultDreamGenerationMode,
  readPersistedDefaultDreamGenerationMode,
  writePersistedDefaultDreamGenerationMode,
} from '../../services/dream/dreamGenerationMode';
import type { DreamGenerationMode } from '../../services/dream/dreamRuntimeTypes';

export function useDreamGenerationModePreference() {
  const [defaultDreamGenerationMode, setDefaultDreamGenerationMode] = useState<DreamGenerationMode | null>(() => readPersistedDefaultDreamGenerationMode());
  const [dreamGenerationMode, setDreamGenerationMode] = useState<DreamGenerationMode | null>(() => readPersistedDefaultDreamGenerationMode());
  const [rememberDreamGenerationMode, setRememberDreamGenerationMode] = useState(() => Boolean(readPersistedDefaultDreamGenerationMode()));
  const [showDreamGenerationModeSheet, setShowDreamGenerationModeSheet] = useState(false);

  const openDreamGenerationModeSheet = useCallback(() => {
    setShowDreamGenerationModeSheet(true);
  }, []);

  const closeDreamGenerationModeSheet = useCallback(() => {
    setShowDreamGenerationModeSheet(false);
  }, []);

  const handleSelectDefaultDreamGenerationMode = useCallback((mode: DreamGenerationMode) => {
    writePersistedDefaultDreamGenerationMode(mode);
    setDefaultDreamGenerationMode(mode);
    setDreamGenerationMode(mode);
    setRememberDreamGenerationMode(true);
    setShowDreamGenerationModeSheet(false);
  }, []);

  const handleClearDefaultDreamGenerationMode = useCallback(() => {
    clearPersistedDefaultDreamGenerationMode();
    setDefaultDreamGenerationMode(null);
    setRememberDreamGenerationMode(false);
    setShowDreamGenerationModeSheet(false);
  }, []);

  const handleConfirmDreamMode = useCallback((onConfirmed: () => void) => {
    if (!dreamGenerationMode) return;
    if (rememberDreamGenerationMode) {
      writePersistedDefaultDreamGenerationMode(dreamGenerationMode);
      setDefaultDreamGenerationMode(dreamGenerationMode);
    }
    onConfirmed();
  }, [dreamGenerationMode, rememberDreamGenerationMode]);

  const resetDreamGenerationModeForNewEntry = useCallback(() => {
    if (!defaultDreamGenerationMode) {
      setDreamGenerationMode(null);
      setRememberDreamGenerationMode(false);
      return;
    }

    setDreamGenerationMode(defaultDreamGenerationMode);
    setRememberDreamGenerationMode(true);
  }, [defaultDreamGenerationMode]);

  const adoptDreamGenerationMode = useCallback((mode?: DreamGenerationMode | null) => {
    const resolvedMode = mode || defaultDreamGenerationMode || null;
    setDreamGenerationMode(resolvedMode);
    setRememberDreamGenerationMode(Boolean(defaultDreamGenerationMode && resolvedMode === defaultDreamGenerationMode));
  }, [defaultDreamGenerationMode]);

  return {
    defaultDreamGenerationMode,
    dreamGenerationMode,
    rememberDreamGenerationMode,
    showDreamGenerationModeSheet,
    setDreamGenerationMode,
    setRememberDreamGenerationMode,
    openDreamGenerationModeSheet,
    closeDreamGenerationModeSheet,
    handleSelectDefaultDreamGenerationMode,
    handleClearDefaultDreamGenerationMode,
    handleConfirmDreamMode,
    resetDreamGenerationModeForNewEntry,
    adoptDreamGenerationMode,
  };
}

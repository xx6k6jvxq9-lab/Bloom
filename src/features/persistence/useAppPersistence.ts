import { useCallback, useEffect, useState } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppData, AppSettings, Character } from '../../types';
import type { UserProfile } from '../app-shell/appShellTypes';
import { bootstrapLocalAppState } from './bootstrapLocalAppState';
import {
  hydratePersistedCharacters as hydratePersistedCharactersFromStore,
} from './appDataSanitizers';
import { persistAppDataSnapshot } from './persistAppDataSnapshot';
import { usePersistedCharactersBridge } from './usePersistedCharactersBridge';
import { persistSettings } from './settingsStore';

type UseAppPersistenceParams = {
  createDefaultAppData: () => AppData;
  defaultCharacters: AppData['characters'];
  defaultConfig: AppSettings['configs'][number];
  defaultDesktopWallpaper: string;
  defaultSettings: AppSettings;
  defaultUser: UserProfile;
  defaultZhouJibaiAvatar: string;
};

type UseAppPersistenceResult = {
  appData: AppData;
  hasHydratedStorage: boolean;
  setAppData: Dispatch<SetStateAction<AppData>>;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  settings: AppSettings;
};

export function useAppPersistence({
  createDefaultAppData,
  defaultCharacters,
  defaultConfig,
  defaultDesktopWallpaper,
  defaultSettings,
  defaultUser,
  defaultZhouJibaiAvatar,
}: UseAppPersistenceParams): UseAppPersistenceResult {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [appData, setAppData] = useState<AppData>(() => createDefaultAppData());
  const defaultAppData = useMemo(() => createDefaultAppData(), [createDefaultAppData]);

  const setCharacters = useCallback((characters: Character[]) => {
    setAppData((prev) => ({
      ...prev,
      characters,
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runBootstrap = async () => {
      const bootstrapped = await bootstrapLocalAppState({
        createDefaultAppData,
        defaultCharacters,
        defaultConfig,
        defaultDesktopWallpaper,
        defaultSettings,
        defaultUser,
        defaultZhouJibaiAvatar,
      });

      if (cancelled) {
        return;
      }

      setSettings(bootstrapped.settings);
      setAppData(bootstrapped.appData);
      if (bootstrapped.migratedSettings) {
        void persistSettings(bootstrapped.migratedSettings);
      }

      setHasHydratedStorage(true);
    };

    void runBootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    createDefaultAppData,
    defaultCharacters,
    defaultConfig,
    defaultDesktopWallpaper,
    defaultSettings,
    defaultUser,
    defaultZhouJibaiAvatar,
  ]);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    void persistSettings(settings);
  }, [hasHydratedStorage, settings]);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    void persistAppDataSnapshot(appData, defaultAppData);
  }, [appData, defaultAppData, hasHydratedStorage]);

  const hydrateCharacters = useCallback(
    (source: Character[] | null | undefined, fallback: Character[]) =>
      hydratePersistedCharactersFromStore(source, fallback, defaultZhouJibaiAvatar),
    [defaultZhouJibaiAvatar],
  );

  usePersistedCharactersBridge(appData.characters, setCharacters, {
    hydrate: hydrateCharacters,
  });

  return {
    appData,
    hasHydratedStorage,
    setAppData,
    setSettings,
    settings,
  };
}

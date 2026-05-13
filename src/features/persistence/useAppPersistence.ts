import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppData, AppSettings } from '../../types';
import type { UserProfile } from '../app-shell/appShellTypes';
import { bootstrapLocalAppState } from './bootstrapLocalAppState';
import {
  buildPersistableNonChatAppDataSnapshot,
  persistNonChatAppDataSnapshot,
} from './persistNonChatAppDataSnapshot';
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
  shouldShowHydrationFallback: boolean;
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
  const [hasCompletedDeferredHydration, setHasCompletedDeferredHydration] = useState(false);
  const [shouldShowHydrationFallback, setShouldShowHydrationFallback] = useState(false);
  const [appData, setAppData] = useState<AppData>(() => createDefaultAppData());
  const defaultAppData = useMemo(() => createDefaultAppData(), [createDefaultAppData]);
  const persistableNonChatSnapshot = useMemo(
    () => buildPersistableNonChatAppDataSnapshot(appData, defaultAppData),
    [appData, defaultAppData],
  );
  const persistableNonChatSnapshotSignature = useMemo(
    () => JSON.stringify(persistableNonChatSnapshot),
    [persistableNonChatSnapshot],
  );

  useEffect(() => {
    let cancelled = false;
    setHasCompletedDeferredHydration(false);

    const runBootstrap = async () => {
      try {
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

        if (bootstrapped.loadDeferredAppData) {
          void bootstrapped.loadDeferredAppData()
            .then((deferredAppData) => {
              if (cancelled) {
                return;
              }

              setAppData((prev) => ({
                ...prev,
                ...deferredAppData,
              }));
            })
            .catch((error) => {
              console.error('[useAppPersistence] Failed to hydrate deferred app data', error);
            })
            .finally(() => {
              if (!cancelled) {
                setHasCompletedDeferredHydration(true);
              }
            });
        } else {
          setHasCompletedDeferredHydration(true);
        }
      } catch (error) {
        console.error('[useAppPersistence] Failed to bootstrap persisted state', error);
        if (cancelled) {
          return;
        }
        setSettings(defaultSettings);
        setAppData(defaultAppData);
        setHasCompletedDeferredHydration(true);
      } finally {
        if (!cancelled) {
          setHasHydratedStorage(true);
        }
      }
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
    if (!hasHydratedStorage || !hasCompletedDeferredHydration) return;
    void persistNonChatAppDataSnapshot(persistableNonChatSnapshot);
  }, [
    hasCompletedDeferredHydration,
    hasHydratedStorage,
    persistableNonChatSnapshotSignature,
  ]);

  useEffect(() => {
    if (hasHydratedStorage) {
      setShouldShowHydrationFallback(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShouldShowHydrationFallback(true);
    }, 600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hasHydratedStorage]);

  return {
    appData,
    hasHydratedStorage,
    shouldShowHydrationFallback,
    setAppData,
    setSettings,
    settings,
  };
}

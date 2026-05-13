import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppData, AppSettings } from '../../types';
import type { MomentPublishToast } from './appShellTypes';
import { resolveSceneTextApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import {
  publishGeneratedCharacterMomentToFeed,
  runAutoMomentSchedulerPass,
} from '../../services/moments/autoRuntime';
import { isStrongAutoMomentInteractionSurface } from '../../services/moments/autoSceneGate';

type UseMomentsAutoChecksParams = {
  activeApp: string;
  appData: AppData;
  hasHydratedStorage: boolean;
  setAppData: Dispatch<SetStateAction<AppData>>;
  setMomentPublishToast: Dispatch<SetStateAction<MomentPublishToast | null>>;
  settings: AppSettings;
};

const CHAT_RUNTIME_BUSY_COUNT_KEY = '__bloomChatRuntimeBusyCount';
const CHAT_RUNTIME_LAST_ACTIVE_AT_KEY = '__bloomChatRuntimeLastActiveAt';
const CHAT_RUNTIME_IDLE_GRACE_MS = 4000;

export function useMomentsAutoChecks({
  activeApp,
  appData,
  hasHydratedStorage,
  setAppData,
  setMomentPublishToast,
  settings,
}: UseMomentsAutoChecksParams) {
  const appDataRef = useRef(appData);
  const settingsRef = useRef(settings);

  useEffect(() => {
    appDataRef.current = appData;
  }, [appData]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (
      !hasHydratedStorage
      || activeApp === 'moments'
      || isStrongAutoMomentInteractionSurface(activeApp)
    ) {
      return;
    }

    let cancelled = false;

    const isChatRuntimeBusy = () => {
      const scope = globalThis as typeof globalThis & Record<string, unknown>;
      const activeCount = typeof scope[CHAT_RUNTIME_BUSY_COUNT_KEY] === 'number'
        ? Math.max(0, scope[CHAT_RUNTIME_BUSY_COUNT_KEY] as number)
        : 0;
      if (activeCount > 0) {
        return true;
      }

      const lastActiveAt = typeof scope[CHAT_RUNTIME_LAST_ACTIVE_AT_KEY] === 'number'
        ? scope[CHAT_RUNTIME_LAST_ACTIVE_AT_KEY] as number
        : 0;
      return lastActiveAt > 0 && Date.now() - lastActiveAt < CHAT_RUNTIME_IDLE_GRACE_MS;
    };

    const resolveForumConfig = () => resolveSceneTextApiConfig({
      settings: settingsRef.current,
      scene: 'forum',
    }).runtimeConfig;

    const runBackgroundMomentChecks = async () => {
      const forumConfig = resolveForumConfig();
      if (!forumConfig?.apiKey?.trim() || isChatRuntimeBusy()) {
        return;
      }

      await runAutoMomentSchedulerPass({
        trigger: 'app_foreground',
        forumConfig,
        getSnapshot: () => appDataRef.current,
        publishGeneratedCharacterMoment: async (payload) => {
          if (cancelled) {
            return;
          }

          await publishGeneratedCharacterMomentToFeed({
            payload,
            snapshot: appDataRef.current,
            setAppData,
            forumConfig: resolveForumConfig(),
            onMomentPublished: (toast) => {
              if (cancelled) {
                return;
              }

              setMomentPublishToast({
                id: `${toast.authorId}-${Date.now()}`,
                authorId: toast.authorId,
                authorName: toast.authorName,
                authorAvatar: toast.authorAvatar,
                preview: toast.preview,
              });
            },
          });
        },
      });
    };

    void runBackgroundMomentChecks();

    const handleVisibilityRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void runBackgroundMomentChecks();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityRefresh);
    }

    const intervalId = window.setInterval(() => {
      void runBackgroundMomentChecks();
    }, 60 * 1000);

    return () => {
      cancelled = true;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityRefresh);
      }
      window.clearInterval(intervalId);
    };
  }, [
    activeApp,
    hasHydratedStorage,
    setAppData,
    setMomentPublishToast,
  ]);
}

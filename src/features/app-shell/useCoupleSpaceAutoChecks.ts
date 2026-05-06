import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppData, AppSettings } from '../../types';
import type { CoupleSpaceUpdateToast } from './appShellTypes';
import { runCoupleSpaceInitiativeAutoCheck } from '../../services/ai/couple-space/initiative/runCoupleSpaceInitiativeAutoCheck';
import { evaluateCoupleSpaceInitiativeAutoCheckGate } from '../../services/ai/couple-space/initiative/coupleSpaceInitiativeAutoCheckGate';
import { applyCoupleSpaceInitiativeRunResult } from '../../services/ai/couple-space/initiative/coupleSpaceInitiativeResultApplier';
import { resolveSceneTextApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import {
  resolveCoupleSpaceState,
  updatePartnerCoupleSpaceState,
} from '../persistence/coupleSpaceStore';

type UseCoupleSpaceAutoChecksParams = {
  activeApp: string;
  appData: AppData;
  hasHydratedStorage: boolean;
  setAppData: Dispatch<SetStateAction<AppData>>;
  setCoupleSpaceUpdateToast: Dispatch<SetStateAction<CoupleSpaceUpdateToast | null>>;
  settings: AppSettings;
};

const CHAT_RUNTIME_BUSY_COUNT_KEY = '__bloomChatRuntimeBusyCount';
const CHAT_RUNTIME_LAST_ACTIVE_AT_KEY = '__bloomChatRuntimeLastActiveAt';
const CHAT_RUNTIME_IDLE_GRACE_MS = 4000;

export function useCoupleSpaceAutoChecks({
  activeApp,
  appData,
  hasHydratedStorage,
  setAppData,
  setCoupleSpaceUpdateToast,
  settings,
}: UseCoupleSpaceAutoChecksParams) {
  const appDataRef = useRef(appData);
  const settingsRef = useRef(settings);
  const coupleSpaceAutoGateRef = useRef<
    Record<string, { lastCheckedAt: number | null; lastPartnerId: string | null }>
  >({});

  useEffect(() => {
    appDataRef.current = appData;
  }, [appData]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (
      !hasHydratedStorage
      || activeApp === 'couple-space'
    ) {
      return;
    }

    let cancelled = false;

    const hasUsableAutoCheckConfig = () => {
      const resolved = resolveSceneTextApiConfig({
        settings: settingsRef.current,
        scene: 'default',
      }).runtimeConfig;

      return !!resolved?.apiKey?.trim();
    };

    const isAuthUnavailableError = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error || '');
      return /auth_unavailable|no auth available providers|503/i.test(message);
    };

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

    const runBackgroundCoupleSpaceChecks = async () => {
      if (!hasUsableAutoCheckConfig()) {
        return;
      }
      if (isChatRuntimeBusy()) {
        return;
      }

      const currentAppData = appDataRef.current;
      const currentSettings = settingsRef.current;
      const resolvedState = resolveCoupleSpaceState(
        currentAppData.coupleSpaceState,
        currentAppData.coupleSpace,
      );
      const spaces = resolvedState.spacesByPartnerId || {};

      for (const [partnerId, coupleSpace] of Object.entries(spaces)) {
        const partner = currentAppData.characters.find((character) => character.id === partnerId) ?? null;
        if (!partner) {
          continue;
        }

        const now = Date.now();
        const gateResult = evaluateCoupleSpaceInitiativeAutoCheckGate({
          now,
          partnerId,
          previousState: coupleSpaceAutoGateRef.current[partnerId],
        });
        coupleSpaceAutoGateRef.current[partnerId] = gateResult.nextState;

        if (!gateResult.allowed) {
          continue;
        }

        try {
          const result = await runCoupleSpaceInitiativeAutoCheck({
            user: currentAppData.userProfile,
            partner,
            coupleSpace,
            chatHistory: currentAppData.chatHistory,
            masks: currentAppData.masks,
            worldBooks: currentAppData.worldBooks,
            appSettings: currentSettings,
            now,
          });

          if (cancelled) {
            return;
          }

          const applied = applyCoupleSpaceInitiativeRunResult(
            result.nextCoupleSpace,
            result.runResult,
            'auto_check',
            now,
          );

          if (applied.nextCoupleSpace !== coupleSpace) {
            setAppData((prev) => {
              const next = updatePartnerCoupleSpaceState(
                prev.coupleSpaceState,
                prev.coupleSpace,
                partnerId,
                applied.nextCoupleSpace,
              );
              return {
                ...prev,
                coupleSpaceState: next.coupleSpaceState,
                coupleSpace: next.coupleSpace,
              };
            });
          }

          if (applied.updatedModuleLabel) {
            setCoupleSpaceUpdateToast({
              id: `${partnerId}-${now}`,
              partnerId,
              partnerName: partner.name,
              partnerAvatar: partner.avatar,
              moduleLabel: applied.updatedModuleLabel,
            });
          }
        } catch (error) {
          if (isAuthUnavailableError(error)) {
            continue;
          }
          console.error('Background couple-space auto check failed:', error);
        }
      }
    };

    void runBackgroundCoupleSpaceChecks();
    const intervalId = window.setInterval(() => {
      void runBackgroundCoupleSpaceChecks();
    }, 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    activeApp,
    hasHydratedStorage,
    setAppData,
    setCoupleSpaceUpdateToast,
  ]);
}

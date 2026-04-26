import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppData } from '../../types';
import { applyWechatMemorySummaryWriteback } from '../unified-context/applyWechatMemorySummaryWriteback';
import { appendMemoryLibraryEntry } from '../../services/memory/memoryLibrary';
import {
  getWechatBindingsOverviewRequest,
  pullWechatIncomingMessagesRequest,
} from './api';
import { buildWechatMemoryLibraryEntry } from './buildWechatMemoryLibraryEntry';

type UseWechatBridgeRuntimeParams = {
  hasHydratedStorage: boolean;
  setAppData: Dispatch<SetStateAction<AppData>>;
};

export function useWechatBridgeRuntime({
  hasHydratedStorage,
  setAppData,
}: UseWechatBridgeRuntimeParams) {
  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }

    let cancelled = false;
    let bridgeUnavailable = false;
    let hasEnabledBinding = false;

    const pullWechatMessages = async () => {
      if (bridgeUnavailable || !hasEnabledBinding || cancelled) {
        return;
      }

      try {
        const messages = await pullWechatIncomingMessagesRequest();
        if (cancelled || !messages.length) {
          return;
        }

        setAppData((prev) => ({
          ...prev,
          characters: prev.characters.map((character) => {
            const characterMessages = messages.filter((message) => message.characterId === character.id);
            if (!characterMessages.length) {
              return character;
            }

            const latestMessage = characterMessages[characterMessages.length - 1];
            let nextShortTermSummary = character.shortTermSummary;

            for (const message of characterMessages) {
              nextShortTermSummary = applyWechatMemorySummaryWriteback(
                { shortTermSummary: nextShortTermSummary },
                message,
              );
            }

            const nextLibraryEntry = buildWechatMemoryLibraryEntry(
              character,
              nextShortTermSummary,
              latestMessage.createdAt,
            );

            return {
              ...character,
              shortTermSummary: nextShortTermSummary,
              lastMessage: `[微信] ${latestMessage.text}`,
              lastTime: latestMessage.createdAt,
              memoryLibraryEntries: nextLibraryEntry
                ? appendMemoryLibraryEntry(character, nextLibraryEntry)
                : character.memoryLibraryEntries,
            };
          }),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('404')) {
          bridgeUnavailable = true;
          console.warn('WeChat bridge API is unavailable in the current runtime. Skipping polling until reload.');
          return;
        }
        console.error('Failed to pull WeChat incoming messages:', error);
      }
    };

    const refreshBindings = async () => {
      if (bridgeUnavailable || cancelled) {
        return;
      }

      try {
        const overview = await getWechatBindingsOverviewRequest();
        hasEnabledBinding = overview.enabledCount > 0;
        if (hasEnabledBinding) {
          await pullWechatMessages();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('404')) {
          bridgeUnavailable = true;
          console.warn('WeChat bridge API is unavailable in the current runtime. Skipping binding refresh until reload.');
          return;
        }
        console.error('Failed to refresh WeChat bindings overview:', error);
      }
    };

    const handleBindingChanged = () => {
      void refreshBindings();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void refreshBindings();
      }
    };

    void refreshBindings();

    const pullIntervalId = window.setInterval(() => {
      void pullWechatMessages();
    }, 15000);

    const bindingIntervalId = window.setInterval(() => {
      void refreshBindings();
    }, 60000);

    window.addEventListener('wechat-binding-changed', handleBindingChanged);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(pullIntervalId);
      window.clearInterval(bindingIntervalId);
      window.removeEventListener('wechat-binding-changed', handleBindingChanged);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasHydratedStorage, setAppData]);
}

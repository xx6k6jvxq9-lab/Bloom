import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ApiConfig, AppData } from '../../types';
import { applyWechatMemorySummaryWriteback } from '../unified-context/applyWechatMemorySummaryWriteback';
import { appendMemoryLibraryEntry } from '../../services/memory/memoryLibrary';
import {
  enqueueWechatOutgoingMessageRequest,
  getWechatBindingsOverviewRequest,
  pullWechatIncomingMessagesRequest,
} from './api';
import { buildWechatMemoryLibraryEntry } from './buildWechatMemoryLibraryEntry';
import { appendWechatConversationMessage, type WechatConversationMessage } from './conversationStore';
import { generateWechatBridgeReply } from './generateWechatBridgeReply';

type UseWechatBridgeRuntimeParams = {
  activeConfig?: ApiConfig;
  appData: AppData;
  hasHydratedStorage: boolean;
  setAppData: Dispatch<SetStateAction<AppData>>;
};

function buildIncomingConversationMessage(message: Awaited<ReturnType<typeof pullWechatIncomingMessagesRequest>>[number]): WechatConversationMessage {
  return {
    id: message.id,
    role: 'user',
    text: message.text,
    timestamp: message.createdAt,
    sourceMessageId: message.id,
  };
}

export function useWechatBridgeRuntime({
  activeConfig,
  appData,
  hasHydratedStorage,
  setAppData,
}: UseWechatBridgeRuntimeParams) {
  const appDataRef = useRef(appData);
  const activeConfigRef = useRef(activeConfig);

  useEffect(() => {
    appDataRef.current = appData;
  }, [appData]);

  useEffect(() => {
    activeConfigRef.current = activeConfig;
  }, [activeConfig]);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }

    let cancelled = false;
    let bridgeUnavailable = false;
    let hasEnabledBinding = false;
    let processing = false;

    const applyWechatMemoryWriteback = (characterId: string, messageText: string, createdAt: number) => {
      setAppData((prev) => {
        const nextState = {
          ...prev,
          characters: prev.characters.map((character) => {
            if (character.id !== characterId) {
              return character;
            }

            const nextShortTermSummary = applyWechatMemorySummaryWriteback(
              { shortTermSummary: character.shortTermSummary },
              {
                id: `wechat-memory-${createdAt}`,
                channel: 'wechat-clawbot',
                characterId,
                conversationId: '',
                text: messageText,
                createdAt,
              },
            );

            const nextLibraryEntry = buildWechatMemoryLibraryEntry(
              character,
              nextShortTermSummary,
              createdAt,
            );

            return {
              ...character,
              shortTermSummary: nextShortTermSummary,
              lastMessage: `[微信] ${messageText}`,
              lastTime: createdAt,
              memoryLibraryEntries: nextLibraryEntry
                ? appendMemoryLibraryEntry(character, nextLibraryEntry)
                : character.memoryLibraryEntries,
            };
          }),
        };
        appDataRef.current = nextState;
        return nextState;
      });
    };

    const processWechatMessage = async (message: Awaited<ReturnType<typeof pullWechatIncomingMessagesRequest>>[number]) => {
      const currentAppData = appDataRef.current;
      const currentConfig = activeConfigRef.current;
      const character = currentAppData.characters.find((item) => item.id === message.characterId);

      if (!character) {
        console.warn('[wechat-bridge] Character not found for incoming message', message.characterId);
        return;
      }

      const incomingConversationMessage = buildIncomingConversationMessage(message);
      const conversationRecord = await appendWechatConversationMessage({
        conversationId: message.conversationId,
        characterId: message.characterId,
        message: incomingConversationMessage,
      });

      applyWechatMemoryWriteback(message.characterId, message.text, message.createdAt);

      if (!currentConfig?.apiKey?.trim()) {
        console.warn('[wechat-bridge] Skipping auto-reply because no active API config is available');
        return;
      }

      const replyText = await generateWechatBridgeReply({
        activeConfig: currentConfig,
        appData: currentAppData,
        character,
        recentConversation: conversationRecord.messages,
      });

      await appendWechatConversationMessage({
        conversationId: message.conversationId,
        characterId: message.characterId,
        message: {
          id: `wechat-reply-${message.id}`,
          role: 'assistant',
          text: replyText,
          timestamp: Date.now(),
          sourceMessageId: message.id,
        },
      });

      await enqueueWechatOutgoingMessageRequest({
        conversationId: message.conversationId,
        characterId: message.characterId,
        text: replyText,
        replyToMessageId: message.id,
        characterName: character.remarkName?.trim() || character.name,
        avatarUrl: character.avatar,
      });
    };

    const pullWechatMessages = async () => {
      if (bridgeUnavailable || !hasEnabledBinding || cancelled || processing) {
        return;
      }

      processing = true;

      try {
        const messages = await pullWechatIncomingMessagesRequest();
        if (cancelled || !messages.length) {
          return;
        }

        for (const message of messages) {
          if (cancelled) {
            break;
          }

          try {
            await processWechatMessage(message);
          } catch (error) {
            console.error('[wechat-bridge] Failed to process incoming message', error);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('404')) {
          bridgeUnavailable = true;
          console.warn('WeChat bridge API is unavailable in the current runtime. Skipping polling until reload.');
          return;
        }
        console.error('Failed to pull WeChat incoming messages:', error);
      } finally {
        processing = false;
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

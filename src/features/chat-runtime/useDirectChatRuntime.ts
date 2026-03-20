import { useCallback, useEffect, useRef } from 'react';
import type {
  ApiConfig,
  CallRecord,
  Character,
  ChatMessage,
  FavoriteMessage,
  Mask,
  PerceptionSettings,
  WalletData,
  WorldBookEntry,
} from '../../types';
import { generateTextWithConfig, streamTextWithConfig } from '../../services/ai/runtimeClient';
import { buildChatPrompt } from '../../services/ai/prompts/builders/buildChatPrompt';
import { buildSummaryPrompt } from '../../services/ai/prompts/builders/buildSummaryPrompt';
import {
  copyMessageText,
  createForwardText,
  createQuoteReplyPayload,
  createShareAction,
  deleteMessageAtIndex,
  deleteMessagesByIndexes,
  toggleFavoriteMessage,
  type ShareActionResult,
} from '../../services/chat/messageActions';
import { handleCommandTriggeredMomentPublish, maybeAutoPublishMoment } from '../../services/moments/orchestrator';
import { getMessageMainText, getSummaryHistoryWindow } from '../../utils';
import { MOCK_CARDS, MOCK_TRANSACTIONS } from '../../components/wallet/WalletApp/Page';
import { useSessionRuntimeCore } from './useSessionRuntimeCore';
import type { BaseSessionRuntimeState } from './types';

const sanitizePipeMarkers = (text: string, replacement: '\n' | ' ' = '\n'): string => {
  const replaced = text.replace(/\s*\|\|\|\s*/g, replacement);
  return replacement === '\n'
    ? replaced.replace(/\r?\n{3,}/g, '\n\n').trim()
    : replaced.replace(/[ \t]{2,}/g, ' ').trim();
};

const getLegacyTranslationParts = (text: string): { mainText: string; translation: string } => {
  const parts = text.split('---TRANSLATION---');
  if (parts.length > 1 && parts[0].trim() !== parts[1].trim()) {
    return {
      mainText: parts[0].trim(),
      translation: parts.slice(1).join('---TRANSLATION---').trim(),
    };
  }

  return {
    mainText: text.trim(),
    translation: '',
  };
};

const splitStreamingModelResponseIntoMessages = (
  text: string,
  baseTimestamp: number,
  options: { isInnerVoice?: boolean } = {}
): ChatMessage[] => {
  if (options.isInnerVoice) {
    return [{
      role: 'model',
      text,
      timestamp: baseTimestamp,
      isInnerVoice: true,
    }];
  }

  const trimmedText = text.trim();
  if (!trimmedText || trimmedText.startsWith('[GAME_CARD]') || /^\[[^\]]*?杞处[^\]]*?([\d\.]+)\]$/.test(trimmedText)) {
    return [{
      role: 'model',
      text,
      timestamp: baseTimestamp,
    }];
  }

  const legacyTranslationParts = getLegacyTranslationParts(text);
  const mainText = sanitizePipeMarkers(legacyTranslationParts.mainText, '\n');
  const explicitParts = mainText.split('\n').map(part => part.trim()).filter(Boolean);
  const parts = explicitParts.length > 1
    ? explicitParts
    : (mainText.match(/[^銆傦紒锛??锛?\n]+[銆傦紒锛??锛?]?/g)?.map(part => part.trim()).filter(Boolean) ?? [mainText]);

  return parts.map((part, index) => ({
    role: 'model' as const,
    text: part,
    ...(index === parts.length - 1 && legacyTranslationParts.translation ? { translation: legacyTranslationParts.translation } : {}),
    timestamp: baseTimestamp + index,
  }));
};

type UseDirectChatRuntimeArgs = {
  character: Character;
  history: ChatMessage[];
  setHistory: (history: ChatMessage[]) => void;
  activeConfig?: ApiConfig;
  input: string;
  setInput: (value: string) => void;
  replyingTo: ChatMessage['replyTo'] | null;
  setReplyingTo: (value: ChatMessage['replyTo'] | null) => void;
  masks: Mask[];
  worldBook?: WorldBookEntry[];
  perception?: PerceptionSettings;
  userName: string;
  favorites: FavoriteMessage[];
  setFavorites: (favorites: FavoriteMessage[]) => void;
  walletData?: WalletData;
  onUpdateWalletData?: (data: WalletData) => void;
  onUpdateCharacter: (character: Character) => void;
  onPublishMoment?: (moment: { authorId: string; content: string; images?: string[] }) => void;
  onAddCallRecord?: (record: CallRecord) => void;
};

type UseDirectChatRuntimeResult = BaseSessionRuntimeState & {
  setError: (value: string | null) => void;
  sendText: () => Promise<void>;
  handleSend: (overrideText?: string | any, locationData?: { name: string; address?: string; isVirtual?: boolean }) => Promise<void>;
  handleSendRef: React.MutableRefObject<(overrideText?: string | any, locationData?: any) => Promise<void>>;
  handleVoiceCallAIResponse: (userText: string) => Promise<string | null>;
  sendImageMessage: (base64String: string) => void;
  sendStickerMessage: () => void;
  sendLocationMessage: (text: string, locationData: { name: string; address?: string; isVirtual?: boolean }) => void;
  sendInnerVoiceProbe: () => void;
  sendSpeechTranscript: (transcript: string) => void;
  finalizeVoiceCall: (params: {
    duration: number;
    voiceCallHistory: { role: 'user' | 'model'; text: string }[];
    isRecordingCall: boolean;
  }) => void;
  recallMessageAt: (index: number) => void;
  deleteMessageAt: (index: number) => void;
  deleteSelectedMessages: (selectedIndexes: Iterable<number>) => void;
  copyMessageAt: (index: number) => Promise<{ ok: boolean; message: string }>;
  toggleFavoriteAt: (index: number) => void;
  quoteReplyAt: (index: number) => void;
  forwardMessageAt: (index: number) => void;
  createSharePayloadAt: (index: number) => ShareActionResult['payload'] | null;
  submitTransfer: (params: {
    transferAmount: string;
    transferType: 'toUser' | 'toCharacter';
    selectedCardId: string;
  }) => boolean;
  handleReceiveTransfer: (index: number) => void;
};

export function useDirectChatRuntime({
  character,
  history,
  setHistory,
  activeConfig,
  input,
  setInput,
  replyingTo,
  setReplyingTo,
  masks,
  worldBook = [],
  perception,
  userName,
  favorites,
  setFavorites,
  walletData,
  onUpdateWalletData,
  onUpdateCharacter,
  onPublishMoment,
  onAddCallRecord,
}: UseDirectChatRuntimeArgs): UseDirectChatRuntimeResult {
  const lastMomentPublishAtRef = useRef<number | null>(null);
  const { isLoading, error, setError: setErrorState, activeGenerationIdRef, runGeneration } = useSessionRuntimeCore();
  const activeAssistantMessageIdRef = useRef<number | null>(null);
  const handleSendRef = useRef<(overrideText?: string | any, locationData?: any) => Promise<void>>(async () => {});

  const setError = useCallback((value: string | null) => {
    setErrorState(value);
  }, []);

  useEffect(() => {
    const lastMsg = history[history.length - 1];
    if (lastMsg && lastMsg.role === 'user' && lastMsg.needsReply && !isLoading) {
      const reply = async () => {
        await runGeneration(async ({ setRuntimeError: _setRuntimeError }) => {
        setErrorState(null);
        const historySnapshot = history;

        if (!activeConfig) {
          setErrorState('Missing API Key. Please configure it in API Center settings.');
          return;
        }

        const assistantMsgId = Date.now() + 1;
        let currentResponseText = '';
        let latestHistory = historySnapshot;
        let renderedAssistantMessageCount = 0;
        const replaceAssistantMessages = (messages: ChatMessage[], text: string): ChatMessage[] => {
          const nextAssistantMessages = splitStreamingModelResponseIntoMessages(text, assistantMsgId);
          const nextMessages = messages.filter(msg =>
            !(msg.role === 'model' && msg.timestamp >= assistantMsgId && msg.timestamp < assistantMsgId + renderedAssistantMessageCount)
          );
          renderedAssistantMessageCount = nextAssistantMessages.length;
          return [...nextMessages, ...nextAssistantMessages];
        };

        const updateAssistantMessage = (text: string) => {
          currentResponseText = text;
          latestHistory = replaceAssistantMessages(latestHistory, currentResponseText);
          setHistory(latestHistory);
        };

        try {
          const historyLimit = character.memoryLimit || 20;
          const historyWindow = historySnapshot.slice(-historyLimit);

          const activeMask = masks.find(m => m.isActive && m.linkedCharacters.includes(character.id));
          const maskPrompt = activeMask
            ? `Name: ${activeMask.name || ''}\nPersonality: ${activeMask.personality || ''}\nOccupation: ${activeMask.occupation || ''}\nRelationship with you: ${activeMask.relationship || ''}\nWorld Background: ${activeMask.worldBackground || 'Standard'}`
            : '';

          const activeWorldBooks = worldBook.filter(wb =>
            (wb.isActive && (wb.isGlobal || wb.characterIds?.includes(character.id))) ||
            character.activeWorldBookIds?.includes(wb.id)
          );
          const worldBookPrompt = activeWorldBooks.length > 0
            ? activeWorldBooks.map(wb => `[${wb.category}] ${wb.title}:\n${wb.content}`).join('\n\n')
            : '';

          let perceptionPrompt = '';
          if (perception) {
            const parts = [];
            if (perception.enabled || perception.dateTime?.enabled) {
              if (perception.dateTime?.value) parts.push(`[Virtual Date/Time: ${perception.dateTime.value}]`);
            }
            if (perception.enabled || perception.location?.enabled) {
              if (perception.location?.value) parts.push(`[Virtual Location: ${perception.location.value}]`);
            }
            if (perception.enabled || perception.weather?.enabled) {
              if (perception.weather?.value) parts.push(`[Virtual Weather: ${perception.weather.value}]`);
            }
            if (perception.enabled || perception.temperature?.enabled) {
              if (perception.temperature?.value) parts.push(`[Virtual Temperature: ${perception.temperature.value}]`);
            }
            if (perception.enabled || perception.climate?.enabled) {
              if (perception.climate?.value) parts.push(`[Virtual Climate: ${perception.climate.value}]`);
            }

            if (parts.length > 0) {
              perceptionPrompt = parts.join('\n');
            }
          }

          const normalizedMemoryPrompt = character.memorySummary?.trim() || '';
          const systemPrompt = buildChatPrompt({
            mode: 'autoReply',
            characterCore: {
              characterSetting: character.setting,
              maskPrompt,
              worldBookPrompt,
            },
            memoryContext: {
              memorySummary: normalizedMemoryPrompt,
              perceptionPrompt,
            },
            includeProtocolRules: false,
          });

          await streamTextWithConfig({
            activeConfig,
            messages: [
              { role: 'system', content: systemPrompt },
              ...historyWindow.map(m => ({
                role: m.role === 'user' ? 'user' as const : 'assistant' as const,
                content: m.text,
              })),
            ],
            onTextChunk: (chunkText) => {
              currentResponseText += chunkText;
              updateAssistantMessage(currentResponseText);
            },
          });

          latestHistory = replaceAssistantMessages(latestHistory, currentResponseText);
          setHistory(latestHistory);

        } catch (err) {
          console.error(err);
          setErrorState('Failed to generate auto reply. Please try again later.');
        }
        });
      };

      void reply();
    }
  }, [activeConfig, character, history, isLoading, masks, onUpdateCharacter, perception, runGeneration, setHistory, worldBook]);

  useEffect(() => {
    const translateHistory = async () => {
      if (!character.autoTranslate || !activeConfig) return;

      const isMostlyChinese = (text: string) => {
        const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
        if (!chineseChars) return false;
        const textLength = text.replace(/\s/g, '').length;
        return textLength > 0 && (chineseChars.length / textLength > 0.5);
      };

      const messagesToTranslate = history
        .map((msg, index) => ({ msg, index }))
        .filter(({ msg }) => {
          if (msg.role !== 'model' || msg.isSystem || msg.translation || msg.text.includes('---TRANSLATION---')) return false;
          if (msg.text.match(/^\[[^\]]*?杞处[^\]]*?([\d\.]+)\]$/)) return false;

          let textToCheck = msg.text.replace(/\[[^\]]*?杞处[^\]]*?([\d\.]+)\]/g, '');
          if (msg.text.startsWith('[GAME_CARD]')) {
            try {
              const jsonString = msg.text.replace(/^\[GAME_CARD\]\s*/, '');
              const jsonStart = jsonString.indexOf('{');
              const jsonEnd = jsonString.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1) {
                const gameData = JSON.parse(jsonString.substring(jsonStart, jsonEnd + 1));
                textToCheck = gameData.content || '';
              }
            } catch {}
          }

          return !isMostlyChinese(textToCheck);
        })
        .slice(-10);

      if (messagesToTranslate.length === 0) return;

      const translateText = async (prompt: string) => {
        return generateTextWithConfig({
          activeConfig,
          prompt,
          temperature: 0.1,
        });
      };

      const newHistory = [...history];
      let hasUpdates = false;

      await Promise.all(messagesToTranslate.map(async ({ msg, index }) => {
        try {
          let textToTranslate = msg.text;
          let isQnaAnswer = false;
          let questionToTranslate = '';

          if (msg.text.startsWith('[GAME_CARD]')) {
            try {
              const jsonString = msg.text.replace(/^\[GAME_CARD\]\s*/, '');
              const jsonStart = jsonString.indexOf('{');
              const jsonEnd = jsonString.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1) {
                const gameData = JSON.parse(jsonString.substring(jsonStart, jsonEnd + 1));
                textToTranslate = gameData.content || '';
                if (gameData.game === 'qna' && gameData.type === 'answer' && gameData.question) {
                  isQnaAnswer = true;
                  questionToTranslate = gameData.question;
                }
              }
            } catch {}
          }

          const prompt = isQnaAnswer && questionToTranslate
            ? `Translate the following text to Chinese. Output ONLY the translation, no other text.\n\nText: ${questionToTranslate}\n\n---\n\nText: ${textToTranslate}`
            : `Translate the following text to Chinese. Output ONLY the translation, no other text.\n\nText: ${textToTranslate}`;

          const translation = await translateText(prompt);
          if (translation) {
            newHistory[index] = {
              ...newHistory[index],
              translation,
            };
            hasUpdates = true;
          }
        } catch (translationError) {
          console.error('Translation failed for message', index, translationError);
        }
      }));

      if (hasUpdates) {
        setHistory(newHistory);
      }
    };

    translateHistory();
  }, [activeConfig, character.autoTranslate, history, setHistory]);

  const handleVoiceCallAIResponse = useCallback(async (userText: string): Promise<string | null> => {
    if (!activeConfig) {
      setErrorState('Missing active API config.');
      return null;
    }

    try {
      const prompt = `你正在与用户进行语音通话。你的设定是：${character.setting}
用户的上一句话是："${userText}"
请以口语化的方式简短回应（50字以内）。`;

      const responseText = await generateTextWithConfig({
        activeConfig,
        prompt,
        temperature: 0.7,
      });

      return responseText || null;
    } catch (voiceCallError) {
      console.error('Voice call AI generation failed', voiceCallError);
      return null;
    }
  }, [activeConfig, character.setting]);

  const handleSend = useCallback(async (overrideText?: string | any, locationData?: { name: string; address?: string; isVirtual?: boolean }) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : input;
    if ((!textToSend.trim() && !locationData) || !activeConfig) {
      if (!activeConfig) {
        setErrorState('Missing active API config.');
      }
      return;
    }


    setErrorState(null);

    await runGeneration(async ({ generationId }) => {
    let baseHistory = history;
    if (activeAssistantMessageIdRef.current !== null) {
      const staleAssistantId = activeAssistantMessageIdRef.current;
      baseHistory = history.filter(msg => msg.timestamp !== staleAssistantId);
      setHistory(baseHistory);
      activeAssistantMessageIdRef.current = null;
    }

    const userMsg: ChatMessage = {
      role: 'user',
      text: textToSend.trim() || (locationData ? `[鍒嗕韩浣嶇疆] ${locationData.name}` : ''),
      timestamp: Date.now(),
      ...(replyingTo ? { replyTo: replyingTo } : {}),
      ...(locationData ? { location: locationData } : {}),
      ...(textToSend.trim() === '[鍊惧惉蹇冨０]' ? { isInnerVoice: true } : {}),
    };
    const newHistory = [...baseHistory, userMsg];
    setHistory(newHistory);

    if (typeof overrideText !== 'string') {
      setInput('');
    }

    setReplyingTo(null);

    const isInnerVoiceRequest = textToSend.trim() === '[鍊惧惉蹇冨０]';
    const assistantMsgId = Date.now() + 1;
    activeAssistantMessageIdRef.current = assistantMsgId;
    let currentResponseText = '';
    let latestHistory = newHistory;
    let renderedAssistantMessageCount = 0;
    const stripPseudoMomentPrefix = (text: string) =>
      text.replace(/^\s*(鍔ㄦ�亅鐘舵�亅鏈嬪弸鍦坾璇磋)[:锛歖\s*/u, '').trim();

    const replaceAssistantMessages = (messages: ChatMessage[], text: string): ChatMessage[] => {
      const displayText = stripPseudoMomentPrefix(text);
      const nextAssistantMessages = splitStreamingModelResponseIntoMessages(displayText, assistantMsgId, { isInnerVoice: isInnerVoiceRequest });
      const nextMessages = messages.filter(msg =>
        !(msg.role === 'model' && msg.timestamp >= assistantMsgId && msg.timestamp < assistantMsgId + renderedAssistantMessageCount)
      );
      renderedAssistantMessageCount = nextAssistantMessages.length;
      return [...nextMessages, ...nextAssistantMessages];
    };

    const updateAssistantMessage = (text: string) => {
      if (activeGenerationIdRef.current !== generationId) {
        return;
      }
      currentResponseText = text;
      latestHistory = replaceAssistantMessages(latestHistory, currentResponseText);
      setHistory(latestHistory);
    };

    try {
      const recentMomentContext = {
        recentMessages: history.slice(-6).map(message => ({
          role: message.role,
          text: message.text,
          timestamp: message.timestamp,
        })),
        recentMomentPublishedAt: lastMomentPublishAtRef.current,
        now: Date.now(),
      };

      const commandMomentResult = await handleCommandTriggeredMomentPublish({
        text: userMsg.text,
        recentContext: recentMomentContext,
        activeConfig,
        character,
        masks,
        worldBook,
      });

      if (commandMomentResult.shouldPublish && commandMomentResult.chatReaction && commandMomentResult.momentContent) {
        const chatReaction = commandMomentResult.chatReaction;
        const historyWithReaction = [...newHistory, {
          role: 'model' as const,
          text: chatReaction.trim(),
          timestamp: assistantMsgId,
        }];
        setHistory(historyWithReaction);
        activeAssistantMessageIdRef.current = null;

        onPublishMoment?.({
          authorId: character.id,
          content: commandMomentResult.momentContent,
        });
        lastMomentPublishAtRef.current = Date.now();
        return;
      }

      const historyLimit = character.memoryLimit || 20;
      const historyWindow = newHistory.slice(-historyLimit);

      const activeMask = masks.find(m => m.isActive && m.linkedCharacters.includes(character.id));
      const maskPrompt = activeMask
        ? `Name: ${activeMask.name || ''}\nPersonality: ${activeMask.personality || ''}\nOccupation: ${activeMask.occupation || ''}\nRelationship with you: ${activeMask.relationship || ''}\nWorld Background: ${activeMask.worldBackground || 'Standard'}`
        : '';

      const activeWorldBooks = worldBook.filter(wb =>
        (wb.isActive && (wb.isGlobal || wb.characterIds?.includes(character.id))) ||
        character.activeWorldBookIds?.includes(wb.id)
      );
      const worldBookPrompt = activeWorldBooks.length > 0
        ? activeWorldBooks.map(wb => `[${wb.category}] ${wb.title}:\n${wb.content}`).join('\n\n')
        : '';

      let perceptionPrompt = '';
      if (perception) {
        const parts = [];
        if (perception.enabled || perception.dateTime?.enabled) {
          if (perception.dateTime?.value) parts.push(`[Virtual Date/Time: ${perception.dateTime.value}]`);
        }
        if (perception.enabled || perception.location?.enabled) {
          if (perception.location?.value) parts.push(`[Virtual Location: ${perception.location.value}]`);
        }
        if (perception.enabled || perception.weather?.enabled) {
          if (perception.weather?.value) parts.push(`[Virtual Weather: ${perception.weather.value}]`);
        }
        if (perception.enabled || perception.temperature?.enabled) {
          if (perception.temperature?.value) parts.push(`[Virtual Temperature: ${perception.temperature.value}]`);
        }
        if (perception.enabled || perception.climate?.enabled) {
          if (perception.climate?.value) parts.push(`[Virtual Climate: ${perception.climate.value}]`);
        }
        if (parts.length > 0) {
          perceptionPrompt = parts.join('\n');
        }
      }

      const normalizedMemoryPrompt = character.memorySummary?.trim() || '';
      const systemPrompt = buildChatPrompt({
        mode: 'chat',
        characterCore: {
          characterSetting: character.setting,
          maskPrompt,
          worldBookPrompt,
        },
        memoryContext: {
          memorySummary: normalizedMemoryPrompt,
          perceptionPrompt,
        },
      });

      await streamTextWithConfig({
        activeConfig,
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyWindow.map(m => ({
            role: m.role === 'user' ? 'user' as const : 'assistant' as const,
            content: m.text,
          })),
        ],
        onTextChunk: (chunkText) => {
          if (activeGenerationIdRef.current !== generationId) {
            return;
          }
          currentResponseText += chunkText;
          updateAssistantMessage(currentResponseText);
        },
      });

      if (!currentResponseText) {
        throw new Error('妯″瀷杩斿洖涓虹┖');
      }
      if (activeGenerationIdRef.current !== generationId) {
        return;
      }

      currentResponseText = stripPseudoMomentPrefix(currentResponseText);
      const finalHistory = replaceAssistantMessages(newHistory, currentResponseText);
      setHistory(finalHistory);
      activeAssistantMessageIdRef.current = null;

      const autoMomentResult = await maybeAutoPublishMoment({
        userText: userMsg.text,
        assistantText: currentResponseText,
        finalHistory,
        recentContext: {
          recentMessages: finalHistory.slice(-6).map(message => ({
            role: message.role,
            text: message.text,
            timestamp: message.timestamp,
          })),
          recentMomentPublishedAt: lastMomentPublishAtRef.current,
          now: Date.now(),
        },
        activeConfig,
        character,
        masks,
        worldBook,
      });

      if (autoMomentResult.shouldPublish && autoMomentResult.momentContent) {
        onPublishMoment?.({
          authorId: character.id,
          content: autoMomentResult.momentContent,
        });
        lastMomentPublishAtRef.current = Date.now();
      }

      const finalHistoryLength = finalHistory.length;
      if (
        character.autoSummaryEnabled &&
        character.summaryInterval &&
        finalHistoryLength > 0 &&
        finalHistoryLength % character.summaryInterval === 0
      ) {
        try {
          const summaryHistoryWindow = getSummaryHistoryWindow(finalHistory, character.memoryLimit);
          const prompt = buildSummaryPrompt({
            mode: 'small',
            characterCore: {
              characterSetting: character.setting,
            },
            memoryContext: {
              memorySummary: character.memorySummary?.trim() || '',
            },
            sections: [
              summaryHistoryWindow.map(msg => `${msg.role === 'user' ? '鐢ㄦ埛' : character.name}: ${getMessageMainText(msg)}`).join('\n'),
            ],
          });

          const summaryText = await generateTextWithConfig({
            activeConfig,
            prompt,
          });

          if (summaryText) {
            onUpdateCharacter({ ...character, memorySummary: summaryText });
          }
        } catch (summaryError) {
          console.error('Auto-summarize failed:', summaryError);
        }
      }
    } catch (sendError: any) {
      if (activeGenerationIdRef.current !== generationId) {
        return;
      }
      console.error('Chat error:', sendError);
      setHistory([...newHistory, { role: 'model', text: `閿欒: ${sendError.message}`, timestamp: Date.now() }]);
    } finally {
      if (activeGenerationIdRef.current === generationId) {
        activeAssistantMessageIdRef.current = null;
      }
    }
    });
  }, [activeConfig, character, history, input, masks, onPublishMoment, onUpdateCharacter, perception, replyingTo, setHistory, setInput, setReplyingTo, worldBook]);

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const sendImageMessage = useCallback((base64String: string) => {
    const userMsg: ChatMessage = {
      role: 'user',
      text: '[鍥剧墖]',
      imageUrl: base64String,
      timestamp: Date.now(),
    };
    setHistory([...history, userMsg]);

    setTimeout(() => {
      setInput('[鍙戦�佷簡涓�寮犲浘鐗嘳');
      handleSendRef.current();
    }, 100);
  }, [history, setHistory, setInput]);

  const sendStickerMessage = useCallback(() => {
    const userMsg: ChatMessage = {
      role: 'user',
      text: '[琛ㄦ儏鍖匽',
      timestamp: Date.now(),
    };
    setHistory([...history, userMsg]);

    setTimeout(() => {
      setInput('[鍙戦�佷簡涓�涓〃鎯匽');
      handleSendRef.current();
    }, 100);
  }, [history, setHistory, setInput]);

  const sendLocationMessage = useCallback((text: string, locationData: { name: string; address?: string; isVirtual?: boolean }) => {
    handleSendRef.current(text, locationData);
  }, []);

  const sendInnerVoiceProbe = useCallback(() => {
    const userMsg: ChatMessage = {
      role: 'user',
      text: '[浣跨敤閬撳叿锛氬�惧惉Ta鐨勫績澹癩',
      timestamp: Date.now(),
      isInnerVoice: true,
    };
    setHistory([...history, userMsg]);

    setTimeout(() => {
      handleSendRef.current('[鍊惧惉蹇冨０]');
    }, 100);
  }, [history, setHistory]);

  const sendSpeechTranscript = useCallback((transcript: string) => {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) return;

    setInput(input + trimmedTranscript);
    setTimeout(() => {
      handleSendRef.current();
    }, 100);
  }, [input, setInput]);

  const finalizeVoiceCall = useCallback((params: {
    duration: number;
    voiceCallHistory: { role: 'user' | 'model'; text: string }[];
    isRecordingCall: boolean;
  }) => {
    const { duration, voiceCallHistory, isRecordingCall } = params;

    const userMsg: ChatMessage = {
      role: 'user',
      text: '[璇煶閫氳瘽]',
      isVoiceCall: true,
      duration,
      timestamp: Date.now(),
    };
    setHistory([...history, userMsg]);

    const fullText = voiceCallHistory
      .map(m => `${m.role === 'user' ? '用户' : character.name}: ${m.text}`)
      .join('\n');

    if (isRecordingCall && fullText.trim() && onAddCallRecord) {
      const newRecord: CallRecord = {
        id: Date.now().toString(),
        characterId: character.id,
        timestamp: Date.now(),
        duration,
        text: fullText,
      };
      onAddCallRecord(newRecord);
    }
  }, [character.id, character.name, history, onAddCallRecord, setHistory]);

  const recallMessageAt = useCallback((index: number) => {
    const nextHistory = [...history];
    if (!nextHistory[index]) return;
    nextHistory[index] = { ...nextHistory[index], isRecalled: true };
    setHistory(nextHistory);
  }, [history, setHistory]);

  const deleteMessageAt = useCallback((index: number) => {
    setHistory(deleteMessageAtIndex(history, index));
  }, [history, setHistory]);

  const deleteSelectedMessages = useCallback((selectedIndexes: Iterable<number>) => {
    setHistory(deleteMessagesByIndexes(history, selectedIndexes));
  }, [history, setHistory]);

  const copyMessageAt = useCallback(async (index: number) => {
    const targetMessage = history[index];
    if (!targetMessage) {
      return { ok: false, message: 'Message to copy was not found.' };
    }

    return copyMessageText(targetMessage);
  }, [history]);

  const toggleFavoriteAt = useCallback((index: number) => {
    const targetMessage = history[index];
    if (!targetMessage) return;

    const result = toggleFavoriteMessage(targetMessage, favorites, character);
    setFavorites(result.favorites);

    const nextHistory = [...history];
    nextHistory[index] = result.updatedMessage;
    setHistory(nextHistory);
  }, [character, favorites, history, setFavorites, setHistory]);

  const quoteReplyAt = useCallback((index: number) => {
    const targetMessage = history[index];
    if (!targetMessage) return;

    setReplyingTo(createQuoteReplyPayload(targetMessage, {
      userLabel: userName,
      modelLabel: character.name,
    }));
  }, [character.name, history, setReplyingTo, userName]);

  const forwardMessageAt = useCallback((index: number) => {
    const targetMessage = history[index];
    if (!targetMessage) return;
    setInput(createForwardText(targetMessage));
  }, [history, setInput]);

  const createSharePayloadAt = useCallback((index: number) => {
    const targetMessage = history[index];
    if (!targetMessage) return null;
    return createShareAction(targetMessage).payload;
  }, [history]);

  const submitTransfer = useCallback((params: {
    transferAmount: string;
    transferType: 'toUser' | 'toCharacter';
    selectedCardId: string;
  }): boolean => {
    const { transferAmount, transferType, selectedCardId } = params;
    if (!transferAmount || Number.isNaN(Number(transferAmount))) {
      return false;
    }

    const amount = parseFloat(transferAmount);
    if (transferType === 'toCharacter') {
      if (!selectedCardId) {
        alert('璇烽�夋嫨鏀粯鍗＄墖');
        return false;
      }

      const cards = walletData?.cards || MOCK_CARDS;
      const card = cards.find(c => c.id === selectedCardId);
      if (!card || card.balance < amount) {
        alert('浣欓涓嶈冻');
        return false;
      }

      const newCards = cards.map(c => c.id === selectedCardId ? { ...c, balance: c.balance - amount } : c);
      const newTransaction = {
        id: `t-${Date.now()}`,
        title: `杞处缁?${character.name}`,
        type: 'expense' as const,
        amount,
        date: '鍒氬垰',
        icon: 'transfer',
        category: '杞处',
        cardId: selectedCardId,
      };
      const newTransactions = [newTransaction, ...(walletData?.transactions || MOCK_TRANSACTIONS)];
      onUpdateWalletData?.({ cards: newCards, transactions: newTransactions });
      handleSend(`[杞处 ${transferAmount}]`);
      return true;
    }

    const modelMsg: ChatMessage = { role: 'model', text: `[杞处 ${transferAmount}]`, timestamp: Date.now() };
    setHistory([...history, modelMsg]);
    return true;
  }, [character.name, handleSend, history, onUpdateWalletData, setHistory, walletData]);

  const handleReceiveTransfer = useCallback((index: number) => {
    const msg = history[index];
    if (!msg || msg.transferStatus === 'received') return;

    const newHistory = [...history];
    newHistory[index] = { ...msg, transferStatus: 'received' };

    const transferRegex = /\[[^\]]*?杞处[^\]]*?([\d\.]+)\]/;
    const amountStr = msg.text.match(transferRegex)?.[1] || '0.00';
    const amount = parseFloat(amountStr);
    const receiverName = msg.role === 'user' ? character.name : userName;

    newHistory.push({
      role: 'user',
      text: `${receiverName} 已领取转账 ￥${amountStr}`,
      timestamp: Date.now(),
      isSystem: true,
    } as ChatMessage);

    setHistory(newHistory);

    if (msg.role === 'model' && !isNaN(amount) && amount > 0) {
      const cards = walletData?.cards || MOCK_CARDS;
      if (cards.length > 0) {
        const targetCardId = cards[0].id;
        const newCards = cards.map(c => c.id === targetCardId ? { ...c, balance: c.balance + amount } : c);
        const newTransaction = {
          id: `t-${Date.now()}`,
          title: `${character.name} 鐨勮浆璐,
          type: 'income' as const,
          amount,
          date: '鍒氬垰',
          icon: 'transfer',
          category: '杞处',
          cardId: targetCardId,
        };
        const newTransactions = [newTransaction, ...(walletData?.transactions || MOCK_TRANSACTIONS)];
        onUpdateWalletData?.({ cards: newCards, transactions: newTransactions });
      }
    }
  }, [character.name, history, onUpdateWalletData, setHistory, userName, walletData]);

  useEffect(() => {
    const lastMsg = history[history.length - 1];
    const transferRegex = /\[[^\]]*?杞处[^\]]*?([\d\.]+)\]/;
    if (lastMsg && lastMsg.role === 'user' && transferRegex.test(lastMsg.text) && !lastMsg.transferStatus) {
      const timer = setTimeout(() => {
        handleReceiveTransfer(history.length - 1);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [handleReceiveTransfer, history]);

  return {
    isLoading,
    error,
    setError,
    sendText: () => handleSend(),
    handleSend,
    handleSendRef,
    handleVoiceCallAIResponse,
    sendImageMessage,
    sendStickerMessage,
    sendLocationMessage,
    sendInnerVoiceProbe,
    sendSpeechTranscript,
    finalizeVoiceCall,
    recallMessageAt,
    deleteMessageAt,
    deleteSelectedMessages,
    copyMessageAt,
    toggleFavoriteAt,
    quoteReplyAt,
    forwardMessageAt,
    createSharePayloadAt,
    submitTransfer,
    handleReceiveTransfer,
  };
}






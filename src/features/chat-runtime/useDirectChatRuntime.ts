import { useCallback, useEffect, useRef } from 'react';
import type {
  ApiConfig,
  CallRecord,
  Character,
  ChatGroup,
  ChatHistory,
  ChatMessage,
  CoupleSpaceData,
  FavoriteMessage,
  Mask,
  MomentImageCard,
  PerceptionSettings,
  WalletData,
  WorldBookEntry,
} from '../../types';
import { streamTextWithConfig } from '../../services/ai/runtimeClient';
import { buildChatPrompt } from '../../services/ai/prompts/builders/buildChatPrompt';
import { buildSummaryPrompt } from '../../services/ai/prompts/builders/buildSummaryPrompt';
import { buildChatSceneInput } from '../../services/scene-inputs/buildChatSceneInput';
import { buildAutoLongTermRefreshPlan } from '../../services/memory/autoLongTermRefreshPlan';
import { buildLongTermMemoryProfile } from '../../services/memory/buildLongTermMemoryProfile';
import { appendMemoryLibraryEntry, createMemoryLibraryEntry } from '../../services/memory/memoryLibrary';
import { buildTemporalContextPrompt } from '../../services/relationship-time/buildTemporalContextPrompt';
import { buildCharacterContext } from '../../services/relationship-context/buildCharacterContext';
import { buildCoupleSpaceInviteContext } from '../../services/couple-space/invite/buildCoupleSpaceInviteContext';
import { generateCoupleSpaceInviteReply } from '../../services/couple-space/invite/generateCoupleSpaceInviteReply';
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
import { splitDirectAssistantReplyText, stripAssistantSpeakerPrefix } from '../../services/chat/assistantText';
import { buildAssistantStickerPromptSection, pickAssistantSticker } from '../../services/chat/assistantStickerPicker';
import { describeStickerMessageForPrompt, inferStickerSemanticLabel } from '../../services/chat/stickerSemantics';
import { getLegacyTranslationParts, normalizeBracketActionTextForPrompt, sanitizePipeMarkers } from '../../services/chat/messageText';
import { decideTransferOutcome, generateTransferEventReaction } from '../../services/chat/decideTransferOutcome';
import { handleCommandTriggeredMomentPublish, maybeAutoPublishMoment } from '../../services/moments/orchestrator';
import { getMessageMainText, getSummaryHistoryWindow } from '../../utils';
import { MOCK_CARDS, MOCK_TRANSACTIONS } from '../../components/wallet/WalletApp/Page';
import { useSessionRuntimeCore } from './useSessionRuntimeCore';
import type { BaseSessionRuntimeState } from './types';

const TRANSFER_BRACKET_REGEX = /\[转账\s*([\d.]+)\]/i;
const TRANSFER_BLOCK_REGEX = /\[transfer\]\s*([\d.]+)\s*\[\/transfer\]/i;
const TRANSFER_PIPE_REGEX = /^TRANSFER\|([\d.]+)\|([\s\S]*)$/i;

function parseDirectActionCue(segment: string): {
  kind: 'normal' | 'sticker';
  content: string;
} {
  const trimmed = segment.trim();
  const stickerMatch = trimmed.match(/^\[(?:sticker|image)\]\s*(.*)$/i);
  if (stickerMatch) {
    return {
      kind: 'sticker',
      content: stickerMatch[1].trim(),
    };
  }

  return {
    kind: 'normal',
    content: trimmed,
  };
}

function toPromptHistoryContent(message: ChatMessage): string {
  if (message.audioUrl) {
    return '[sent a voice message]';
  }

  if (message.imageUrl) {
    if (/^\[(?:sticker|表情包)\]/i.test(message.text || '')) {
      return describeStickerMessageForPrompt(message);
    }
    return '[sent an image]';
  }

  if (message.role === 'user') {
    return normalizeBracketActionTextForPrompt(message.text || '');
  }

  return message.text;
}

const extractTransferAmount = (text: string) => {
  const bracketMatch = text.match(TRANSFER_BRACKET_REGEX);
  if (bracketMatch?.[1]) {
    return bracketMatch[1];
  }

  const blockMatch = text.match(TRANSFER_BLOCK_REGEX);
  if (blockMatch?.[1]) {
    return blockMatch[1];
  }

  const pipeMatch = text.trim().match(TRANSFER_PIPE_REGEX);
  return pipeMatch?.[1] ?? null;
};

const parseTransferProtocol = (text: string) => {
  const trimmedText = text.trim();
  const amount = extractTransferAmount(trimmedText);
  if (!amount) {
    return null;
  }

  const pipeMatch = trimmedText.match(TRANSFER_PIPE_REGEX);
  return {
    amount,
    note: pipeMatch?.[2]?.trim() || '',
  };
};

const splitTransferReactionIntoMessages = (text: string, baseTimestamp: number): ChatMessage[] => {
  const normalizedText = sanitizePipeMarkers(text, '\n').trim();
  if (!normalizedText) {
    return [];
  }

  const explicitParts = normalizedText
    .split(/\n+/)
    .flatMap(part => part.split(/(?<=[。！？!?])\s*/))
    .map(part => part.trim())
    .filter(Boolean);

  const groupedParts: string[] = [];
  let currentGroup = '';

  for (const part of explicitParts) {
    const isQuestionLike = /[？?]$/.test(part);
    const isAdvisoryLike = /^(别|不要|记得|先|快|少|慢点|赶紧|记住)/.test(part);
    const isTurnLike = /^(那行|那就|那你|行吧|行，|好吧|好，|不过|但是|还是)/.test(part);
    const nextGroup = currentGroup ? `${currentGroup}\n${part}` : part;
    const shouldFlush =
      currentGroup.length > 0 &&
      (
        isQuestionLike ||
        isAdvisoryLike ||
        isTurnLike ||
        part.length >= 18 ||
        nextGroup.length >= 26
      );

    if (shouldFlush) {
      groupedParts.push(currentGroup);
      currentGroup = part;
      continue;
    }

    currentGroup = nextGroup;
  }

  if (currentGroup) {
    groupedParts.push(currentGroup);
  }

  const finalParts = groupedParts.length > 0 ? groupedParts : [normalizedText];
  return finalParts.map((part, index) => ({
    role: 'model' as const,
    text: part,
    timestamp: baseTimestamp + index,
  }));
};

const splitStreamingModelResponseIntoMessages = (
  text: string,
  baseTimestamp: number,
  options: { isInnerVoice?: boolean; transferTargetLabel?: string; assistantAliases?: string[]; availableStickers?: string[] } = {}
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
  const transferProtocol = parseTransferProtocol(trimmedText);
  if (
    !trimmedText ||
    trimmedText.startsWith('[GAME_CARD]') ||
    transferProtocol
  ) {
    if (transferProtocol) {
      return [{
        role: 'model',
        text: `[转账 ${transferProtocol.amount}]`,
        timestamp: baseTimestamp,
        transferStatus: 'pending',
        transferTargetLabel: options.transferTargetLabel,
      }];
    }

    return [{
      role: 'model',
      text,
      timestamp: baseTimestamp,
    }];
  }

  const legacyTranslationParts = getLegacyTranslationParts(text);
  const mainText = stripAssistantSpeakerPrefix(
    sanitizePipeMarkers(legacyTranslationParts.mainText, '\n'),
    options.assistantAliases || [],
  );
  const parts = splitDirectAssistantReplyText(mainText);

  return parts.map((part, index) => {
    const cue = parseDirectActionCue(part);
    const pickedSticker = cue.kind === 'sticker'
      ? pickAssistantSticker(cue.content, options.availableStickers || [])
      : null;

    return {
      role: 'model' as const,
      text: cue.kind === 'sticker' && pickedSticker ? '[sticker]' : cue.content || part,
      ...(cue.kind === 'sticker' && pickedSticker ? { imageUrl: pickedSticker.sticker, stickerLabel: pickedSticker.label } : {}),
      ...(index === parts.length - 1 && legacyTranslationParts.translation ? { translation: legacyTranslationParts.translation } : {}),
      timestamp: baseTimestamp + index,
    };
  });
};

function parseGameCardData(text: string) {
  if (!text.startsWith('[GAME_CARD]')) return null;

  try {
    let jsonString = text.replace(/^\[GAME_CARD\]\s*/, '').trim();

    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const jsonStart = jsonString.indexOf('{');
    const jsonEnd = jsonString.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return null;

    const gameData = JSON.parse(jsonString.substring(jsonStart, jsonEnd + 1));
    return gameData && typeof gameData === 'object' ? gameData : null;
  } catch (error) {
    console.warn('Ignoring invalid runtime game card payload.', error);
    return null;
  }
}

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
  coupleSpace?: CoupleSpaceData;
  userName: string;
  directChatHistory?: ChatHistory;
  chatGroups?: ChatGroup[];
  favorites: FavoriteMessage[];
  setFavorites: (favorites: FavoriteMessage[]) => void;
  walletData?: WalletData;
  onUpdateWalletData?: (data: WalletData) => void;
  onUpdateCharacter: (character: Character) => void;
  onPatchCharacter?: (patch: Partial<Character>) => void;
  onPublishMoment?: (moment: { authorId: string; content: string; images?: string[]; imageCard?: MomentImageCard }) => void;
  onAddCallRecord?: (record: CallRecord) => void;
  onAcceptCoupleSpaceInvite?: (characterId: string) => void;
};

type UseDirectChatRuntimeResult = BaseSessionRuntimeState & {
  setError: (value: string | null) => void;
  sendText: () => Promise<void>;
  handleSend: (overrideText?: string | any, locationData?: { name: string; address?: string; isVirtual?: boolean }) => Promise<void>;
  handleSendRef: React.MutableRefObject<(overrideText?: string | any, locationData?: any) => Promise<void>>;
  handleVoiceCallAIResponse: (userText: string) => Promise<string | null>;
  sendImageMessage: (base64String: string) => void;
  sendAudioMessage: (audioUrl: string, audioMimeType: string, durationSeconds?: number) => void;
  sendStickerMessage: (sticker: string) => void;
  sendLocationMessage: (text: string, locationData: { name: string; address?: string; isVirtual?: boolean }) => void;
  sendCoupleSpaceInvitation: () => void;
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
  handleRejectTransfer: (index: number) => void;
};

type DirectSendOverridePayload = {
  promptText: string;
  userText?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioMimeType?: string;
  duration?: number;
  stickerLabel?: string;
  locationData?: { name: string; address?: string; isVirtual?: boolean };
  isInnerVoice?: boolean;
};

function formatChatApiError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : '未知错误';
  const normalized = rawMessage.replace(/\s+/g, ' ').trim();
  const statusMatch = normalized.match(/^(\d{3})\s*:\s*(.+)$/);

  if (statusMatch) {
    const [, statusCode, detail] = statusMatch;
    return `错误 ${statusCode}: ${detail}`;
  }

  return `错误: ${normalized}`;
}

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
  coupleSpace,
  userName,
  directChatHistory,
  chatGroups,
  favorites,
  setFavorites,
  walletData,
  onUpdateWalletData,
  onUpdateCharacter,
  onPatchCharacter,
  onPublishMoment,
  onAddCallRecord,
  onAcceptCoupleSpaceInvite,
}: UseDirectChatRuntimeArgs): UseDirectChatRuntimeResult {
  const lastMomentPublishAtRef = useRef<number | null>(null);
  const { isLoading, error, setError: setErrorState, activeGenerationIdRef, runGeneration } = useSessionRuntimeCore();
  const activeAssistantMessageIdRef = useRef<number | null>(null);
  const handleSendRef = useRef<(overrideText?: string | any, locationData?: any) => Promise<void>>(async () => {});
  const historyRef = useRef(history);
  const inputRef = useRef(input);
  const pendingCoupleSpaceInviteRef = useRef(false);
  const pendingTransferDecisionIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

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
          const nextAssistantMessages = splitStreamingModelResponseIntoMessages(text, assistantMsgId, {
            transferTargetLabel: userName,
            assistantAliases: [character.name, character.remarkName?.trim() || ''],
            availableStickers: character.stickers || [],
          });
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

          const activeWorldBooks = worldBook.filter((wb) => {
            const isManuallySelected = !!character.activeWorldBookIds?.includes(wb.id);
            if (isManuallySelected) {
              return true;
            }

            return !!wb.isActive && (wb.isGlobal || wb.characterIds?.includes(character.id));
          });

          let perceptionPrompt = buildTemporalContextPrompt({
            perception,
            now: Date.now(),
          });
          if (perception) {
            const parts = [perceptionPrompt];
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

            perceptionPrompt = parts.filter(Boolean).join('\n');
          }

          const chatSceneInput = buildChatSceneInput({
            mode: 'autoReply',
            includeProtocolRules: false,
            character,
            userName,
            coupleSpace,
            activeMask,
            activeWorldBooks,
            worldBooks: worldBook,
            perception,
            perceptionPrompt,
            directChatHistory,
            chatGroups,
          });
          const systemPrompt = buildChatPrompt({
            ...chatSceneInput,
            sections: [
              ...(chatSceneInput.sections || []),
              buildAssistantStickerPromptSection(character.stickers || []),
            ].filter(Boolean),
          });

          await streamTextWithConfig({
            activeConfig,
            messages: [
              { role: 'system', content: systemPrompt },
              ...historyWindow.map(m => ({
                role: m.role === 'user' ? 'user' as const : 'assistant' as const,
                content: toPromptHistoryContent(m),
                ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
                ...(m.audioUrl ? { audioUrl: m.audioUrl, audioMimeType: m.audioMimeType } : {}),
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
          if (msg.text.match(/^\[[^\]]*?转账[^\]]*?([\d\.]+)\]$/)) return false;

          let textToCheck = msg.text.replace(/\[[^\]]*?转账[^\]]*?([\d\.]+)\]/g, '');
          const gameData = parseGameCardData(msg.text);
          if (gameData && typeof gameData.content === 'string') {
            textToCheck = gameData.content;
          }

          return !isMostlyChinese(textToCheck);
        })
        .slice(-10);

      if (messagesToTranslate.length === 0) return;

      const translateText = async (prompt: string) => {
        let responseText = '';
        await streamTextWithConfig({
          activeConfig,
          temperature: 0.1,
          messages: [{ role: 'system', content: prompt }],
          onTextChunk: (chunkText) => {
            responseText += chunkText;
          },
        });
        return responseText;
      };

      const newHistory = [...history];
      let hasUpdates = false;

      await Promise.all(messagesToTranslate.map(async ({ msg, index }) => {
        try {
          let textToTranslate = msg.text;
          let isQnaAnswer = false;
          let questionToTranslate = '';

          const gameData = parseGameCardData(msg.text);
          if (gameData) {
            if (typeof gameData.content === 'string') {
              textToTranslate = gameData.content;
            }
            if (
              gameData.game === 'qna'
              && gameData.type === 'answer'
              && typeof gameData.question === 'string'
            ) {
              isQnaAnswer = true;
              questionToTranslate = gameData.question;
            }
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
      const characterCorePersona = buildCharacterContext({
        character,
      }).corePersona ?? '';
      const prompt = `你正在与用户进行语音通话。你的核心人设是：${characterCorePersona}
用户的上一句话是："${userText}"
请以口语化的方式简短回应（50字以内）。`;

      let responseText = '';
      await streamTextWithConfig({
        activeConfig,
        temperature: 0.7,
        messages: [{ role: 'system', content: prompt }],
        onTextChunk: (chunkText) => {
          responseText += chunkText;
        },
      });

      return responseText || null;
    } catch (voiceCallError) {
      console.error('Voice call AI generation failed', voiceCallError);
      return null;
    }
  }, [activeConfig, character]);

  const handleSend = useCallback(async (overrideText?: string | any, locationData?: { name: string; address?: string; isVirtual?: boolean }) => {
    const overridePayload: DirectSendOverridePayload | null =
      typeof overrideText === 'object' && overrideText !== null && !Array.isArray(overrideText)
        ? overrideText as DirectSendOverridePayload
        : null;
    const effectiveLocationData = overridePayload?.locationData ?? locationData;
    const textToSend = typeof overrideText === 'string'
      ? overrideText
      : (overridePayload?.promptText ?? input);
    if ((!textToSend.trim() && !effectiveLocationData) || !activeConfig) {
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
      text: overridePayload?.userText?.trim() || textToSend.trim() || (effectiveLocationData ? `[位置分享] ${effectiveLocationData.name}` : ''),
      timestamp: Date.now(),
      ...(replyingTo ? { replyTo: replyingTo } : {}),
      ...(effectiveLocationData ? { location: effectiveLocationData } : {}),
      ...(overridePayload?.imageUrl ? { imageUrl: overridePayload.imageUrl } : {}),
      ...(overridePayload?.audioUrl ? { audioUrl: overridePayload.audioUrl, audioMimeType: overridePayload.audioMimeType } : {}),
      ...(typeof overridePayload?.duration === 'number' ? { duration: overridePayload.duration } : {}),
      ...(overridePayload?.stickerLabel ? { stickerLabel: overridePayload.stickerLabel } : {}),
      ...((overridePayload?.isInnerVoice || textToSend.trim() === '[倾听心声]') ? { isInnerVoice: true } : {}),
    };
    const newHistory = [...baseHistory, userMsg];
    setHistory(newHistory);

    if (typeof overrideText !== 'string' && !overridePayload) {
      setInput('');
    }

    setReplyingTo(null);

    const isInnerVoiceRequest = overridePayload?.isInnerVoice || textToSend.trim() === '[倾听心声]';
    const assistantMsgId = Date.now() + 1;
    activeAssistantMessageIdRef.current = assistantMsgId;
    let currentResponseText = '';
    let latestHistory = newHistory;
    let renderedAssistantMessageCount = 0;
    const stripPseudoMomentPrefix = (text: string) =>
      text.replace(/^\s*(动态|状态|朋友圈说说)[:：]\s*/u, '').trim();

    const replaceAssistantMessages = (messages: ChatMessage[], text: string): ChatMessage[] => {
      const displayText = stripPseudoMomentPrefix(text);
      const nextAssistantMessages = splitStreamingModelResponseIntoMessages(displayText, assistantMsgId, {
        isInnerVoice: isInnerVoiceRequest,
        transferTargetLabel: userName,
        assistantAliases: [character.name, character.remarkName?.trim() || ''],
        availableStickers: character.stickers || [],
      });
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
          imageCard: commandMomentResult.momentImageCard,
        });
        lastMomentPublishAtRef.current = Date.now();
        return;
      }

      const historyLimit = character.memoryLimit || 20;
      const historyWindow = newHistory.slice(-historyLimit);

      const activeMask = masks.find(m => m.isActive && m.linkedCharacters.includes(character.id));

      const activeWorldBooks = worldBook.filter((wb) => {
        const isManuallySelected = !!character.activeWorldBookIds?.includes(wb.id);
        if (isManuallySelected) {
          return true;
        }

        return !!wb.isActive && (wb.isGlobal || wb.characterIds?.includes(character.id));
      });

      let perceptionPrompt = buildTemporalContextPrompt({
        perception,
        now: Date.now(),
      });
      if (perception) {
        const parts = [perceptionPrompt];
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
        perceptionPrompt = parts.filter(Boolean).join('\n');
      }

      const chatSceneInput = buildChatSceneInput({
        mode: 'chat',
        character,
        userName,
        coupleSpace,
        activeMask,
        activeWorldBooks,
        worldBooks: worldBook,
        perception,
        perceptionPrompt,
        directChatHistory,
        chatGroups,
      });
      const systemPrompt = buildChatPrompt({
        ...chatSceneInput,
        sections: [
          ...(chatSceneInput.sections || []),
          buildAssistantStickerPromptSection(character.stickers || []),
        ].filter(Boolean),
      });

      await streamTextWithConfig({
        activeConfig,
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyWindow.map(m => ({
            role: m.role === 'user' ? 'user' as const : 'assistant' as const,
            content: toPromptHistoryContent(m),
            ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
            ...(m.audioUrl ? { audioUrl: m.audioUrl, audioMimeType: m.audioMimeType } : {}),
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
        throw new Error('模型返回为空');
      }
      if (activeGenerationIdRef.current !== generationId) {
        return;
      }

      currentResponseText = stripPseudoMomentPrefix(currentResponseText);
      const finalHistory = replaceAssistantMessages(newHistory, currentResponseText);
      setHistory(finalHistory);
      activeAssistantMessageIdRef.current = null;

      try {
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
            imageCard: autoMomentResult.momentImageCard,
          });
          lastMomentPublishAtRef.current = Date.now();
        }
      } catch (autoMomentError) {
        console.error('Auto moment publish failed:', autoMomentError);
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
          const longTermMemoryProfile = buildLongTermMemoryProfile(character) || '';
          const characterCorePersona = buildCharacterContext({
            character,
          }).corePersona ?? '';
          const prompt = buildSummaryPrompt({
            mode: 'small',
            characterCore: {
              characterSetting: characterCorePersona,
            },
            memoryContext: {
              longTermMemoryProfile,
            },
            sections: [
              summaryHistoryWindow.map(msg => `${msg.role === 'user' ? '用户' : character.name}: ${getMessageMainText(msg)}`).join('\n'),
            ],
          });

          let summaryText = '';
          await streamTextWithConfig({
            activeConfig,
            messages: [{ role: 'system', content: prompt }],
            onTextChunk: (chunkText) => {
              summaryText += chunkText;
            },
          });

          if (summaryText) {
            const shortTermEntry = createMemoryLibraryEntry({
              kind: 'short-term',
              source: 'auto',
              content: summaryText,
            });
            let nextMemoryLibraryEntries = appendMemoryLibraryEntry(character, shortTermEntry);
            let nextLongTermMemoryProfile: string | undefined;

            const autoLongTermPlan = buildAutoLongTermRefreshPlan({
              memoryLibraryEntries: character.memoryLibraryEntries,
              latestShortTermSummary: summaryText,
              pendingEntries: nextMemoryLibraryEntries,
            });

            if (autoLongTermPlan.shouldRefresh) {
              const longTermPrompt = buildSummaryPrompt({
                mode: 'large',
                characterCore: {
                  characterSetting: characterCorePersona,
                },
                memoryContext: {
                  shortTermSummary: summaryText,
                  longTermMemoryProfile,
                },
                sections: [
                  summaryHistoryWindow.map(msg => `${msg.role === 'user' ? '用户' : character.name}: ${getMessageMainText(msg)}`).join('\n'),
                ],
              });

              let longTermSummaryText = '';
              await streamTextWithConfig({
                activeConfig,
                messages: [{ role: 'system', content: longTermPrompt }],
                onTextChunk: (chunkText) => {
                  longTermSummaryText += chunkText;
                },
              });

              if (longTermSummaryText.trim()) {
                nextLongTermMemoryProfile = longTermSummaryText.trim();
                nextMemoryLibraryEntries = appendMemoryLibraryEntry(
                  { memoryLibraryEntries: nextMemoryLibraryEntries },
                  createMemoryLibraryEntry({
                    kind: 'long-term',
                    source: 'auto',
                    content: nextLongTermMemoryProfile,
                  }),
                );
              }
            }

            const patch: Partial<Character> = {
              shortTermSummary: summaryText,
              memoryLibraryEntries: nextMemoryLibraryEntries,
              ...(nextLongTermMemoryProfile
                ? { longTermMemoryProfile: nextLongTermMemoryProfile }
                : {}),
            };

            if (onPatchCharacter) {
              onPatchCharacter(patch);
            } else {
              onUpdateCharacter({
                ...character,
                ...patch,
              });
            }
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
      setHistory([...newHistory, { role: 'model', text: formatChatApiError(sendError), timestamp: Date.now() }]);
    } finally {
      if (activeGenerationIdRef.current === generationId) {
        activeAssistantMessageIdRef.current = null;
      }
    }
    });
  }, [activeConfig, character, history, input, masks, onPatchCharacter, onPublishMoment, onUpdateCharacter, perception, replyingTo, setHistory, setInput, setReplyingTo, worldBook]);

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const sendImageMessage = useCallback((base64String: string) => {
    void handleSendRef.current({
      promptText: '[sent an image]',
      userText: '[image]',
      imageUrl: base64String,
    });
  }, []);

  const sendAudioMessage = useCallback((audioUrl: string, audioMimeType: string, durationSeconds?: number) => {
    void handleSendRef.current({
      promptText: '[sent a voice message]',
      userText: '[audio]',
      audioUrl,
      audioMimeType,
      ...(typeof durationSeconds === 'number' ? { duration: durationSeconds } : {}),
    });
  }, []);

  const sendStickerMessage = useCallback((sticker: string) => {
    void handleSendRef.current({
      promptText: describeStickerMessageForPrompt({
        imageUrl: sticker,
        text: '[sticker]',
        stickerLabel: inferStickerSemanticLabel(sticker),
      }),
      userText: '[sticker]',
      imageUrl: sticker,
      stickerLabel: inferStickerSemanticLabel(sticker),
    });
  }, []);

  const sendLocationMessage = useCallback((text: string, locationData: { name: string; address?: string; isVirtual?: boolean }) => {
    handleSendRef.current(text, locationData);
  }, []);

  const sendCoupleSpaceInvitation = useCallback(() => {
    if (pendingCoupleSpaceInviteRef.current) {
      alert('情侣空间邀请发送中，请稍候。');
      return;
    }

    const openedPartnerIds = new Set<string>();
    if (coupleSpace?.partnerId) {
      openedPartnerIds.add(coupleSpace.partnerId);
    }
    for (const partnerId of coupleSpace?.addedPartnerIds || []) {
      if (partnerId) {
        openedPartnerIds.add(partnerId);
      }
    }

    if (openedPartnerIds.has(character.id)) {
      alert(`${character.name} 的情侣空间已经开通，不能重复邀请。`);
      return;
    }

    const userMsg: ChatMessage = {
      role: 'user',
      text: '[COUPLE_SPACE_INVITE]',
      timestamp: Date.now(),
    };
    const nextHistory = [...historyRef.current, userMsg];
    pendingCoupleSpaceInviteRef.current = true;
    setHistory(nextHistory);

    void (async () => {
      try {
        const inviteContext = buildCoupleSpaceInviteContext({
          userName,
          character,
          history: nextHistory,
        });

        const replyText = await generateCoupleSpaceInviteReply({
          activeConfig,
          context: inviteContext,
        });

        const latestHistory = historyRef.current;
        const modelReply: ChatMessage = {
          role: 'model',
          text: replyText,
          timestamp: Date.now(),
        };
        const acceptedCard: ChatMessage = {
          role: 'model',
          text: '[COUPLE_SPACE_INVITE_ACCEPTED]',
          timestamp: Date.now() + 1,
        };
        setHistory([...latestHistory, modelReply, acceptedCard]);
        onAcceptCoupleSpaceInvite?.(character.id);
      } finally {
        pendingCoupleSpaceInviteRef.current = false;
      }
    })();
  }, [activeConfig, character, coupleSpace, onAcceptCoupleSpaceInvite, setHistory, userName]);

  const sendInnerVoiceProbe = useCallback(() => {
    const userMsg: ChatMessage = {
      role: 'user',
      text: '[使用道具：倾听Ta的心声]',
      timestamp: Date.now(),
      isInnerVoice: true,
    };
    setHistory([...historyRef.current, userMsg]);

    setTimeout(() => {
      handleSendRef.current('[倾听心声]');
    }, 100);
  }, [setHistory]);

  const sendSpeechTranscript = useCallback((transcript: string) => {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) return;

    const nextText = `${inputRef.current}${trimmedTranscript}`.trim();
    inputRef.current = '';
    setInput('');
    setTimeout(() => {
      handleSendRef.current(nextText);
    }, 100);
  }, [setInput]);

  const applyTransferDecision = useCallback((params: {
    transferId: string;
    status: 'received' | 'rejected';
    replyText?: string;
  }) => {
    const { transferId, status, replyText } = params;
    const latestHistory = historyRef.current;
    const transferIndex = latestHistory.findIndex(message => message.transferId === transferId);
    const transferMessage = transferIndex >= 0 ? latestHistory[transferIndex] : null;
    if (!transferMessage || transferMessage.transferStatus !== 'pending') {
      return;
    }

    const amountStr = extractTransferAmount(transferMessage.text) || '0.00';
    const amount = parseFloat(amountStr);
    const nextHistory = [...latestHistory];
    nextHistory[transferIndex] = {
      ...transferMessage,
      transferStatus: status,
    };

    nextHistory.push({
      role: 'model',
      text: `[转账 ${amountStr}]`,
      timestamp: Date.now(),
      transferStatus: status,
      transferDisplayLabel: status === 'received' ? '已收款' : '已退回',
      transferTargetLabel: character.name,
    });

    if (replyText) {
      nextHistory.push({
        role: 'model',
        text: replyText,
        timestamp: Date.now(),
      });
    }

    if (status === 'rejected') {
      if (!Number.isNaN(amount) && amount > 0 && transferMessage.transferCardId) {
        const cards = walletData?.cards || MOCK_CARDS;
        const newCards = cards.map(card =>
          card.id === transferMessage.transferCardId
            ? { ...card, balance: card.balance + amount }
            : card,
        );
        const newTransaction = {
          id: `t-${Date.now()}`,
          title: `${character.name} 退回转账`,
          type: 'income' as const,
          amount,
          date: '刚刚',
          icon: 'transfer',
          category: '转账退款',
          cardId: transferMessage.transferCardId,
        };
        const newTransactions = [newTransaction, ...(walletData?.transactions || MOCK_TRANSACTIONS)];
        onUpdateWalletData?.({ cards: newCards, transactions: newTransactions });
      }
    }

    setHistory(nextHistory);
  }, [character.name, onUpdateWalletData, setHistory, walletData]);

  const queueTransferDecision = useCallback((params: {
    transferId: string;
    amount: number;
    history: ChatMessage[];
  }) => {
    const { transferId, amount, history } = params;
    if (!activeConfig || pendingTransferDecisionIdsRef.current.has(transferId)) {
      return;
    }

    pendingTransferDecisionIdsRef.current.add(transferId);
    void decideTransferOutcome({
      activeConfig,
      character,
      amount,
      history,
      userName,
    })
      .then(result => {
        if (!result) {
          return;
        }
        applyTransferDecision({
          transferId,
          status: result.decision === 'accept' ? 'received' : 'rejected',
          replyText: result.replyText,
        });
      })
      .catch(error => {
        console.error('Transfer decision failed:', error);
      })
      .finally(() => {
        pendingTransferDecisionIdsRef.current.delete(transferId);
      });
  }, [activeConfig, applyTransferDecision, character, userName]);

  const triggerTransferEventReaction = (params: {
    amount: number;
    direction: 'character_to_user_received' | 'character_to_user_rejected';
  }) => {
    if (!activeConfig) {
      return;
    }

    const historySnapshot = historyRef.current;
    void generateTransferEventReaction({
      activeConfig,
      character,
      amount: params.amount,
      history: historySnapshot,
      userName,
      direction: params.direction,
    })
      .then(result => {
        const replyText = result.replyText.trim();
        if (!replyText) {
          return;
        }

        const reactionMessages = splitTransferReactionIntoMessages(replyText, Date.now());
        setHistory([
          ...historyRef.current,
          ...reactionMessages,
        ]);
      })
      .catch(error => {
        console.error('Transfer reaction failed:', error);
      });
  };

  const finalizeVoiceCall = useCallback((params: {
    duration: number;
    voiceCallHistory: { role: 'user' | 'model'; text: string }[];
    isRecordingCall: boolean;
  }) => {
    const { duration, voiceCallHistory, isRecordingCall } = params;

    const userMsg: ChatMessage = {
      role: 'user',
      text: '[语音通话]',
      isVoiceCall: true,
      duration,
      timestamp: Date.now(),
    };
    setHistory([...historyRef.current, userMsg]);

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
  }, [character.id, character.name, onAddCallRecord, setHistory]);

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
    if (amount <= 0) {
      alert('请输入大于 0 的金额');
      return false;
    }

    if (transferType === 'toCharacter') {
      if (!activeConfig) {
        alert('当前未选择有效的 API 配置。');
        return false;
      }

      if (!selectedCardId) {
        alert('请选择支付卡片');
        return false;
      }

      const cards = walletData?.cards || MOCK_CARDS;
      const card = cards.find(c => c.id === selectedCardId);
      if (!card || card.balance < amount) {
        alert('余额不足');
        return false;
      }

      const newCards = cards.map(c => c.id === selectedCardId ? { ...c, balance: c.balance - amount } : c);
      const newTransaction = {
        id: `t-${Date.now()}`,
        title: `转账给 ${character.name}`,
        type: 'expense' as const,
        amount,
        date: '刚刚',
        icon: 'transfer',
        category: '转账',
        cardId: selectedCardId,
      };
      const newTransactions = [newTransaction, ...(walletData?.transactions || MOCK_TRANSACTIONS)];
      onUpdateWalletData?.({ cards: newCards, transactions: newTransactions });
      const transferId = `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const transferMessage: ChatMessage = {
        role: 'user',
        text: `[转账 ${transferAmount}]`,
        timestamp: Date.now(),
        transferStatus: 'pending',
        transferId,
        transferCardId: selectedCardId,
      };
      const nextHistory = [...historyRef.current, transferMessage];
      setHistory(nextHistory);
      queueTransferDecision({
        transferId,
        amount,
        history: nextHistory,
      });
      return true;
    }

    const modelMsg: ChatMessage = {
      role: 'model',
      text: `[转账 ${transferAmount}]`,
      timestamp: Date.now(),
      transferStatus: 'pending',
      transferId: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    setHistory([...historyRef.current, modelMsg]);
    return true;
  }, [activeConfig, character.name, onUpdateWalletData, queueTransferDecision, setHistory, walletData]);

  const handleReceiveTransfer = useCallback((index: number) => {
    const msg = history[index];
    if (!msg || msg.transferStatus === 'received' || msg.transferStatus === 'rejected') return;

    const newHistory = [...history];
    newHistory[index] = { ...msg, transferStatus: 'received' };

    const amountStr = extractTransferAmount(msg.text) || '0.00';
    const amount = parseFloat(amountStr);
    const receiptCard: ChatMessage = {
      role: 'user',
      text: `[转账 ${amountStr}]`,
      timestamp: Date.now(),
      transferStatus: 'received',
      transferDisplayLabel: '已收款',
      transferTargetLabel: userName,
    };

    setHistory([...newHistory, receiptCard]);

    if (msg.role === 'model' && !isNaN(amount) && amount > 0) {
      const cards = walletData?.cards || MOCK_CARDS;
      if (cards.length > 0) {
        const targetCardId = cards[0].id;
        const newCards = cards.map(c => c.id === targetCardId ? { ...c, balance: c.balance + amount } : c);
        const newTransaction = {
          id: `t-${Date.now()}`,
          title: `${character.name} 的转账`,
          type: 'income' as const,
          amount,
          date: '刚刚',
          icon: 'transfer',
          category: '转账',
          cardId: targetCardId,
        };
        const newTransactions = [newTransaction, ...(walletData?.transactions || MOCK_TRANSACTIONS)];
        onUpdateWalletData?.({ cards: newCards, transactions: newTransactions });
      }

      triggerTransferEventReaction({
        amount,
        direction: 'character_to_user_received',
      });
    }
  }, [activeConfig, character, character.name, history, onUpdateWalletData, setHistory, userName, walletData]);

  const handleRejectTransfer = useCallback((index: number) => {
    const msg = history[index];
    if (!msg || msg.role !== 'model' || msg.transferStatus === 'received' || msg.transferStatus === 'rejected') return;

    const amountStr = extractTransferAmount(msg.text) || '0.00';
    const amount = parseFloat(amountStr);
    const nextHistory = [...history];
    nextHistory[index] = { ...msg, transferStatus: 'rejected' };
    nextHistory.push({
      role: 'user',
      text: `[转账 ${amountStr}]`,
      timestamp: Date.now(),
      transferStatus: 'rejected',
      transferDisplayLabel: '已退回',
      transferTargetLabel: character.name,
    });

    setHistory(nextHistory);

    if (!Number.isNaN(amount) && amount > 0) {
      triggerTransferEventReaction({
        amount,
        direction: 'character_to_user_rejected',
      });
    }
  }, [character.name, history, setHistory]);

  return {
    isLoading,
    error,
    setError,
    sendText: () => handleSend(),
    handleSend,
    handleSendRef,
    handleVoiceCallAIResponse,
    sendImageMessage,
    sendAudioMessage,
    sendStickerMessage,
    sendLocationMessage,
    sendCoupleSpaceInvitation,
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
    handleRejectTransfer,
  };
}









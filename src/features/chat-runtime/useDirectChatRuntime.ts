import { useCallback, useEffect, useRef } from 'react';
import type {
  ApiConfig,
  AppSettings,
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
import { generateTextFromMessagesWithConfig, streamTextWithConfig } from '../../services/ai/runtimeClient';
import {
  generateQualityCheckedAssistantReply,
  shouldAllowBracketActions,
} from '../../services/ai/outputQuality';
import { buildChatPrompt } from '../../services/ai/prompts/builders/buildChatPrompt';
import { buildSummaryPrompt } from '../../services/ai/prompts/builders/buildSummaryPrompt';
import { buildReplyLanguageRules } from '../../services/ai/prompts/base/languageRules';
import { buildChatSceneInput } from '../../services/scene-inputs/buildChatSceneInput';
import { buildAutoLongTermRefreshPlan } from '../../services/memory/autoLongTermRefreshPlan';
import { buildAutoSummarySourceLines, sanitizeAutoSummaryText } from '../../services/memory/autoSummaryHygiene';
import { buildLongTermMemoryProfile } from '../../services/memory/buildLongTermMemoryProfile';
import { compressShortTermSummaryAfterLongTerm } from '../../services/memory/buildShortTermSummary';
import { findNearestChatMemorySnapshot } from '../../services/memory/chatMemoryTimeline';
import { clampDirectMemoryLimit, getDirectMemoryMessageLimit } from '../../services/memory/memoryWindowLimits';
import { appendMemoryLibraryEntry, createMemoryLibraryEntry } from '../../services/memory/memoryLibrary';
import { buildCharacterTemporalState } from '../../services/relationship-time/buildCharacterTemporalState';
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
import {
  analyzeLatestDirectUserIntent,
  buildDirectIntentPromptSection,
} from '../../services/chat/intentAnalysis';
import {
  analyzeDirectCharacterDecision,
  applyDirectTransferBridge,
  buildDirectCharacterDecisionPromptSection,
} from '../../services/chat/directCharacterDecision';
import { buildDirectContextLayers } from '../../services/chat/buildDirectContextLayers';
import { buildOpenLoopRegistryPrompt } from '../../services/chat/buildOpenLoopRegistry';
import { reconcileCharacterRuntimeState } from '../../services/chat/reconcileCharacterRuntimeState';
import { splitDirectAssistantReplyText, stripAssistantSpeakerPrefix } from '../../services/chat/assistantText';
import { buildAssistantStickerPromptSection, pickAssistantSticker } from '../../services/chat/assistantStickerPicker';
import {
  buildAutonomousAvatarLibraryPromptSection,
  buildAvatarActionPromptSection,
  buildCharacterAvatarPatchFromAction,
  latestUserMessageHasAvatarIntent,
  parseAvatarActionBlock,
  resolveAvatarCandidateFromAction,
  type ParsedAvatarAction,
} from '../../services/chat/avatarActions';
import { describeStickerMessageForPrompt, inferStickerSemanticLabel } from '../../services/chat/stickerSemantics';
import { getLegacyTranslationParts, normalizeBracketActionTextForPrompt, sanitizePipeMarkers } from '../../services/chat/messageText';
import { isUsableChatText, normalizeChatPunctuationNoise } from '../../services/chat/messageHygiene';
import { decideTransferOutcome, generateTransferEventReaction } from '../../services/chat/decideTransferOutcome';
import { handleCommandTriggeredMomentPublish, maybeAutoPublishMoment } from '../../services/moments/orchestrator';
import { resolveSceneTextApiConfig, resolveSceneVoiceApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import { synthesizeTtsAudio } from '../../services/ai/apiCenter/synthesizeTtsAudio';
import { getMessageMainText, getSummaryHistoryWindow } from '../../utils';
import { MOCK_CARDS } from '../../components/wallet/WalletApp/mockData';
import { useSessionRuntimeCore } from './useSessionRuntimeCore';
import type { BaseSessionRuntimeState } from './types';

const TRANSFER_BRACKET_REGEX = /\[转账\s*([\d.]+)\]/i;
const TRANSFER_BLOCK_REGEX = /\[transfer\]\s*([\d.]+)\s*\[\/transfer\]/i;
const TRANSFER_PIPE_REGEX = /^TRANSFER\|([\d.]+)\|([\s\S]*)$/i;
const COUPLE_SPACE_INVITE_TOKEN = '[COUPLE_SPACE_INVITE]';
const COUPLE_SPACE_INVITE_ACCEPTED_TOKEN = '[COUPLE_SPACE_INVITE_ACCEPTED]';

function isChineseLanguageName(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() || '';
  if (!normalized) {
    return false;
  }

  return ['中文', '汉语', '普通话', '简体中文', '繁体中文', 'chinese', 'mandarin', 'simplified chinese', 'traditional chinese']
    .includes(normalized);
}

function shouldInlineReplyTranslation(character: Character): boolean {
  if (!character.autoTranslate) {
    return false;
  }

  if (character.replyLanguageMode === 'native-first') {
    return !isChineseLanguageName(character.nativeLanguage);
  }

  if (character.replyLanguageMode === 'fixed') {
    return !isChineseLanguageName(character.fixedReplyLanguage);
  }

  return false;
}

function buildInlineReplyTranslationPrompt(character: Character): string {
  const targetLanguage = character.replyLanguageMode === 'fixed'
    ? (character.fixedReplyLanguage?.trim() || character.nativeLanguage?.trim() || '角色设定语言')
    : (character.nativeLanguage?.trim() || '角色母语');

  return [
    '## 双语输出',
    `本轮请先只输出角色实际会说的 ${targetLanguage} 原文。`,
    '如果这轮回复里出现了正文内容，请在正文全部结束后另起一行输出 `---TRANSLATION---`，然后给出与正文严格对应的简体中文翻译。',
    '翻译部分只做自然中文转写，不要补充解释、注释、语言标签、括号说明或额外寒暄。',
    '如果正文被拆成多条短气泡，翻译部分也必须按完全相同的气泡顺序输出，并使用 `|||` 分隔每一条对应翻译。',
    '除 `---TRANSLATION---` 这条分隔线外，不要输出任何额外格式标记。',
  ].join('\n');
}

function createMomentPublishedSystemMessage(characterName: string, timestamp: number): ChatMessage {
  return {
    role: 'model',
    text: `${characterName} 更新了一条动态`,
    timestamp,
    isSystem: true,
  };
}

function shouldApplyCharacterTts(character: Character) {
  return character.voiceProfile?.enabled === true;
}

function resolveCharacterTtsVoiceId(
  character: Character,
  fallbackVoiceId?: string,
) {
  if (character.voiceProfile?.enabled && (
    character.voiceProfile.mode === 'library'
    || character.voiceProfile.mode === 'voiceId'
    || character.voiceProfile.mode === 'cloned'
  )) {
    const customVoiceId = character.voiceProfile.voiceId?.trim();
    if (customVoiceId) {
      return customVoiceId;
    }
  }

  return fallbackVoiceId?.trim() || undefined;
}

function parseDirectActionCue(segment: string): {
  kind: 'normal' | 'sticker' | 'reply' | 'recall';
  content: string;
  replyTargetName?: string;
} {
  const trimmed = segment.trim();
  const normalized = trimmed.replace(/^[\s"'`“”‘’?!！？，、]+/, '');
  const replyMatch = normalized.match(/^\[(?:quote|reply|reply to)\s*:\s*([^\]]+)\]\s*(.*)$/i);
  if (replyMatch) {
    return {
      kind: 'reply',
      replyTargetName: replyMatch[1].trim(),
      content: replyMatch[2].trim(),
    };
  }

  const recallMatch = normalized.match(/^\[(?:recall|withdraw)\]\s*(.*)$/i);
  if (recallMatch) {
    return {
      kind: 'recall',
      content: recallMatch[1].trim(),
    };
  }

  const stickerMatch = trimmed.match(/^\[(?:sticker|image|表情包|图片)\]\s*(.*)$/i);
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

function resolveDirectReplyTarget(
  targetName: string | undefined,
  history: ChatMessage[],
  userLabel: string,
  modelLabel: string,
): ChatMessage['replyTo'] | null {
  const normalizedTarget = targetName?.trim().toLowerCase();
  if (!normalizedTarget) {
    return null;
  }

  const latestUserMessage = [...history].reverse().find((message) => message.role === 'user' && !message.isSystem && !message.isRecalled);
  const latestModelMessage = [...history].reverse().find((message) => message.role === 'model' && !message.isSystem && !message.isRecalled);

  if (['user', '我', '你', userLabel.trim().toLowerCase(), '刚才那句', '上一句'].includes(normalizedTarget) && latestUserMessage) {
    return createQuoteReplyPayload(latestUserMessage, {
      userLabel,
      modelLabel,
    });
  }

  if (['ta', '你自己', '上一条', '刚才那条', modelLabel.trim().toLowerCase()].includes(normalizedTarget) && latestModelMessage) {
    return createQuoteReplyPayload(latestModelMessage, {
      userLabel,
      modelLabel,
    });
  }

  return null;
}

function hasDirectRecallCue(
  text: string,
  options: {
    assistantAliases?: string[];
    maxDirectReplyBubbles?: number;
  } = {},
): boolean {
  const trimmedText = text.trim();
  if (!trimmedText || trimmedText.startsWith('[GAME_CARD]') || parseTransferProtocol(trimmedText)) {
    return false;
  }

  const legacyTranslationParts = getLegacyTranslationParts(text);
  const mainText = stripAssistantSpeakerPrefix(
    sanitizePipeMarkers(legacyTranslationParts.mainText, '\n'),
    options.assistantAliases || [],
  );

  return splitDirectAssistantReplyText(mainText, options.maxDirectReplyBubbles)
    .some((part) => parseDirectActionCue(part).kind === 'recall');
}

function splitDirectReplyTranslationsByBubble(
  mainText: string,
  translationText: string,
  maxDirectReplyBubbles?: number,
): string[] {
  const normalizedTranslation = sanitizePipeMarkers(translationText, '\n');
  if (!normalizedTranslation) {
    return [];
  }

  const sourceParts = splitDirectAssistantReplyText(mainText, maxDirectReplyBubbles);
  if (sourceParts.length <= 1) {
    return [normalizedTranslation];
  }

  const pipeSegments = translationText
    .split(/\s*\|\|\|\s*/g)
    .map((segment) => sanitizePipeMarkers(segment, '\n'))
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (pipeSegments.length === sourceParts.length) {
    return pipeSegments;
  }

  const explicitLineSegments = normalizedTranslation
    .split(/\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (explicitLineSegments.length === sourceParts.length) {
    return explicitLineSegments;
  }

  const heuristicSegments = splitDirectAssistantReplyText(normalizedTranslation, maxDirectReplyBubbles);
  if (heuristicSegments.length === sourceParts.length) {
    return heuristicSegments;
  }

  return sourceParts.map((_, index) => (index === sourceParts.length - 1 ? normalizedTranslation : ''));
}

function markLatestVisibleModelMessageRecalled(messages: ChatMessage[]): ChatMessage[] {
  const targetIndex = [...messages]
    .reverse()
    .findIndex((message) => message.role === 'model' && !message.isSystem && !message.isRecalled);

  if (targetIndex === -1) {
    return messages;
  }

  const actualIndex = messages.length - 1 - targetIndex;
  return messages.map((message, index) => (
    index === actualIndex
      ? { ...message, isRecalled: true }
      : message
  ));
}

function stripCoupleSpaceTokens(text: string) {
  return text
    .replace(/\[COUPLE_SPACE_INVITE_ACCEPTED\]/g, '')
    .replace(/\[COUPLE_SPACE_INVITE\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function resolveCharacterReplyBubbleLimit(character: Pick<Character, 'maxReplies'>): number {
  if (!Number.isFinite(character.maxReplies)) {
    return 3;
  }

  return Math.max(1, Math.min(Math.floor(character.maxReplies as number), 5));
}

function isRetryableSummaryStreamError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('failed to fetch') || message.includes('networkerror');
}

function isSameLocalDay(leftTimestamp: number, rightTimestamp: number): boolean {
  const left = new Date(leftTimestamp);
  const right = new Date(rightTimestamp);
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function formatPromptHistoryTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function formatPromptHistoryAge(timestamp: number, nowTimestamp: number): string {
  const diffMs = Math.max(0, nowTimestamp - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return '刚刚';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

function looksLikeFrozenSceneFragment(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  return /(门口|楼下|车里|路上|电梯里|马上到|快到了|过来|过去|来找你|在你家|端着|腾不开手|刚煮|煮了粉|还在这|还没走)/.test(normalized);
}

function buildPromptHistoryPrefix(
  message: ChatMessage,
  options: {
    nowTimestamp: number;
    continuityMode: 'continuous_scene' | 'same_day_resume' | 'resume_after_gap';
  },
): string {
  if (options.continuityMode === 'continuous_scene') {
    return '';
  }

  const absoluteTime = formatPromptHistoryTimestamp(message.timestamp);
  const ageText = formatPromptHistoryAge(message.timestamp, options.nowTimestamp);
  const basePrefix = `[发送时间 ${absoluteTime} / 相对现在 ${ageText}]`;

  if (
    options.continuityMode === 'resume_after_gap'
    && !isSameLocalDay(message.timestamp, options.nowTimestamp)
    && looksLikeFrozenSceneFragment(message.text || '')
  ) {
    return `${basePrefix}[旧现场片段，仅作背景参考，不代表此刻仍在发生] `;
  }

  return `${basePrefix} `;
}

function toPromptHistoryContent(
  message: ChatMessage,
  options: {
    nowTimestamp: number;
    continuityMode: 'continuous_scene' | 'same_day_resume' | 'resume_after_gap';
  },
): string {
  const prefix = buildPromptHistoryPrefix(message, options);

  if (message.audioUrl) {
    const transcript = message.audioTranscript?.trim();
    return transcript
      ? `${prefix}[sent a voice message; transcript: ${transcript}]`
      : `${prefix}[sent a voice message]`;
  }

  if (message.imageUrl) {
    if (/^\[(?:sticker|表情包)\]/i.test(message.text || '')) {
      return `${prefix}${describeStickerMessageForPrompt(message)}`;
    }
    return `${prefix}[sent an image]`;
  }

  if (message.role === 'user') {
    const userText = normalizeBracketActionTextForPrompt(message.text || '');
    return isUsableChatText(userText) ? `${prefix}${normalizeChatPunctuationNoise(userText)}` : '';
  }

  return isUsableChatText(message.text || '') ? `${prefix}${normalizeChatPunctuationNoise(message.text || '')}` : '';
}

function getDirectHistoryWindowByTemporalMode(
  messages: ChatMessage[],
  historyLimit: number,
  continuityMode: 'continuous_scene' | 'same_day_resume' | 'resume_after_gap',
): ChatMessage[] {
  const cappedWindow = messages.slice(-historyLimit);
  if (continuityMode === 'continuous_scene') {
    return cappedWindow;
  }

  if (continuityMode === 'same_day_resume') {
    return cappedWindow.slice(-Math.min(historyLimit, 10));
  }

  const latestPendingUserBlock = getLatestPendingUserMessageBlock(messages);
  if (latestPendingUserBlock) {
    return messages.slice(latestPendingUserBlock.start, latestPendingUserBlock.end + 1);
  }

  const visibleTail = messages
    .filter((message) => isVisibleDirectUserMessage(message) || isVisibleDirectModelMessage(message))
    .slice(-2);

  return visibleTail.length > 0 ? visibleTail : cappedWindow.slice(-1);
}

function isVisibleDirectUserMessage(message: ChatMessage): boolean {
  return (
    message.role === 'user'
    && !message.isSystem
    && !message.isRecalled
    && Boolean(message.text || message.imageUrl || message.audioUrl || message.location)
  );
}

function isVisibleDirectModelMessage(message: ChatMessage): boolean {
  return (
    message.role === 'model'
    && !message.isSystem
    && !message.isRecalled
  );
}

function getLatestPendingUserMessageBlock(messages: ChatMessage[]): { start: number; end: number } | null {
  let index = messages.length - 1;

  while (index >= 0 && !isVisibleDirectUserMessage(messages[index])) {
    if (isVisibleDirectModelMessage(messages[index])) {
      return null;
    }
    index -= 1;
  }

  if (index < 0) {
    return null;
  }

  const end = index;
  let start = index;
  while (start - 1 >= 0 && isVisibleDirectUserMessage(messages[start - 1])) {
    start -= 1;
  }

  return { start, end };
}

function buildDirectResumeModePrompt(
  continuityMode: 'continuous_scene' | 'same_day_resume' | 'resume_after_gap',
): string {
  if (continuityMode === 'continuous_scene') {
    return [
      '## 聊天连续性',
      '[当前模式] 连续场景',
      '[线上规则] 这仍然是同一段正在进行的私聊，可以自然接上上一轮，但只推进当前最自然的一个点，不要机械重复刚刚的话题。',
    ].join('\n');
  }

  if (continuityMode === 'same_day_resume') {
    return [
      '## 聊天连续性',
      '[当前模式] 同日重连',
      '[线上规则] 这是同一天里隔了一段时间后重新接上，默认按聊天软件里重新上线处理，不要把上一次的现场感直接续写成正在眼前发生。',
      '[表达要求] 先回到角色当前在线状态、这段时间在做什么，再决定是否轻轻接回旧话题。',
    ].join('\n');
  }

  return [
    '## 聊天连续性',
    '[当前模式] 隔段重连',
    '[线上规则] 私聊默认是线上社交聊天软件语境，不是线下现场连续推进。现在应按角色重新上线处理，而不是默认还停在上次聊天的那一刻。',
    '[默认做法] 先回到当下时间、角色当前状态、他这段时间自己的生活，再决定是否要接回旧话题。',
    '[明确限制] 除非用户主动提起，或上一轮有明显未完的强情绪线，否则不要默认直接续昨天或更早的话题。',
  ].join('\n');
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

const stripTransferProtocolText = (text: string) => {
  return text
    .replace(TRANSFER_BLOCK_REGEX, '')
    .replace(TRANSFER_BRACKET_REGEX, '')
    .replace(TRANSFER_PIPE_REGEX, '$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
  options: {
    isInnerVoice?: boolean;
    transferTargetLabel?: string;
    assistantAliases?: string[];
    availableStickers?: string[];
    maxDirectReplyBubbles?: number;
    currentHistory?: ChatMessage[];
    userLabel?: string;
    modelLabel?: string;
  } = {}
): ChatMessage[] => {
  const trimmedText = text.trim();
  const transferProtocol = parseTransferProtocol(trimmedText);

  if (options.isInnerVoice) {
    const innerVoiceText = stripTransferProtocolText(text);
    const messages: ChatMessage[] = [];

    if (innerVoiceText) {
      messages.push({
        role: 'model',
        text: innerVoiceText,
        timestamp: baseTimestamp,
        isInnerVoice: true,
      });
    }

    if (transferProtocol) {
      messages.push({
        role: 'model',
        text: `[转账 ${transferProtocol.amount}]`,
        timestamp: baseTimestamp + messages.length,
        transferStatus: 'pending',
        transferTargetLabel: options.transferTargetLabel,
      });
    }

    return messages.length > 0 ? messages : [{
      role: 'model',
      text,
      timestamp: baseTimestamp,
      isInnerVoice: true,
    }];
  }

  if (
    !trimmedText ||
    trimmedText.startsWith('[GAME_CARD]')
  ) {
    return [{
      role: 'model',
      text,
      timestamp: baseTimestamp,
    }];
  }

  const hasCoupleSpaceAcceptedToken = trimmedText.includes(COUPLE_SPACE_INVITE_ACCEPTED_TOKEN);
  const textWithoutProtocols = stripCoupleSpaceTokens(stripTransferProtocolText(text));
  const legacyTranslationParts = getLegacyTranslationParts(textWithoutProtocols);
  const mainText = stripAssistantSpeakerPrefix(
    sanitizePipeMarkers(legacyTranslationParts.mainText, '\n'),
    options.assistantAliases || [],
  );
  const parts = splitDirectAssistantReplyText(mainText, options.maxDirectReplyBubbles);
  const translationParts = legacyTranslationParts.translation
    ? splitDirectReplyTranslationsByBubble(
        mainText,
        legacyTranslationParts.translation,
        options.maxDirectReplyBubbles,
      )
    : [];
  const mappedMessages = parts.map((part, index) => {
    const cue = parseDirectActionCue(part);
    const pickedSticker = cue.kind === 'sticker'
      ? pickAssistantSticker(cue.content, options.availableStickers || [])
      : null;
    const replyTo = cue.kind === 'reply'
      ? resolveDirectReplyTarget(
          cue.replyTargetName,
          options.currentHistory || [],
          options.userLabel || '你',
          options.modelLabel || '对方',
        )
      : undefined;
    const bodyText = cue.kind === 'recall'
      ? cue.content
      : cue.kind === 'reply'
        ? cue.content || part
        : cue.content || part;

    return {
      role: 'model' as const,
      text: cue.kind === 'sticker' && pickedSticker ? '[sticker]' : bodyText,
      ...(cue.kind === 'sticker' && pickedSticker ? { imageUrl: pickedSticker.sticker, stickerLabel: pickedSticker.label } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...(translationParts[index] ? { translation: translationParts[index] } : {}),
      timestamp: baseTimestamp + index,
    };
  });

  const visibleMessages: ChatMessage[] = mappedMessages.filter((message) => (
    !!message.imageUrl
    || isUsableChatText(message.text || '')
  ));
  if (transferProtocol) {
    const nextMessages: ChatMessage[] = [
      ...visibleMessages,
      {
        role: 'model' as const,
        text: `[转账 ${transferProtocol.amount}]`,
        timestamp: baseTimestamp + visibleMessages.length,
        transferStatus: 'pending',
        transferTargetLabel: options.transferTargetLabel,
      },
    ];
    if (hasCoupleSpaceAcceptedToken) {
      nextMessages.push({
        role: 'model' as const,
        text: COUPLE_SPACE_INVITE_ACCEPTED_TOKEN,
        timestamp: baseTimestamp + nextMessages.length,
      });
    }
    return nextMessages;
  }

  if (hasCoupleSpaceAcceptedToken) {
    return [
      ...visibleMessages,
      {
        role: 'model' as const,
        text: COUPLE_SPACE_INVITE_ACCEPTED_TOKEN,
        timestamp: baseTimestamp + visibleMessages.length,
      },
    ];
  }

  return visibleMessages;
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

function resolveGameCardReplyType(gameData: any): string | null {
  if (!gameData || typeof gameData !== 'object') {
    return null;
  }

  if (gameData.game === 'qna') {
    if (gameData.type === 'question' || gameData.type === 'request_question') {
      return 'answer';
    }
    return null;
  }

  if (gameData.game === 'tod') {
    if (gameData.type === 'truth' || gameData.type === 'dare') {
      return gameData.type;
    }
    return null;
  }

  if (gameData.game === 'blocks') {
    return 'result';
  }

  return null;
}

function applyDirectGameCardBridge(params: {
  replyText: string;
  latestUserMessage: ChatMessage | null | undefined;
}) {
  const { replyText, latestUserMessage } = params;
  const trimmedReply = replyText.trim();
  if (!trimmedReply || trimmedReply.startsWith('[GAME_CARD]') || !latestUserMessage) {
    return replyText;
  }

  const gameData = parseGameCardData(latestUserMessage.text || '');
  const responseType = resolveGameCardReplyType(gameData);
  if (!gameData || !responseType) {
    return replyText;
  }

  const bridgedCard = {
    game: gameData.game,
    type: responseType,
    ...(typeof gameData.question === 'string' && gameData.question.trim()
      ? { question: gameData.question.trim() }
      : {}),
    content: trimmedReply,
  };

  return `[GAME_CARD] ${JSON.stringify(bridgedCard)}`;
}

function applyDirectCoupleSpaceBridge(params: {
  replyText: string;
  latestUserMessage: ChatMessage | null | undefined;
}) {
  const { replyText, latestUserMessage } = params;
  const trimmedReply = replyText.trim();
  if (!trimmedReply || !latestUserMessage) {
    return replyText;
  }

  if ((latestUserMessage.text || '').trim() !== COUPLE_SPACE_INVITE_TOKEN) {
    return replyText;
  }

  if (trimmedReply.includes(COUPLE_SPACE_INVITE_ACCEPTED_TOKEN)) {
    return replyText;
  }

  return `${trimmedReply}\n${COUPLE_SPACE_INVITE_ACCEPTED_TOKEN}`;
}

function buildDirectSpecialReplyPrompt(message: ChatMessage | null | undefined): string {
  if (!message || message.role !== 'user' || message.isSystem || message.isRecalled) {
    return '';
  }

  if (message.isInnerVoice) {
    return [
      '## 本轮特殊回复要求',
      '用户刚触发的是“倾听心声”卡片。',
      '这轮回复必须保持心声内容形态，不要退化成普通闲聊气泡。',
      '默认使用适合卡片展示的写法：先给 1 到 3 行短标题，每行单独换行；空一行后再写 1 到 3 段散文式正文。',
      '如果有很轻的尾注，可以最后单独一行以“PS:”开头。',
      '标题应该像被解锁的一瞬间浮出来的话，短、准、带情绪，不要写成普通称呼或开场白。',
      '如果这轮还伴随其它协议内容，例如转账，允许“心声卡片 + 转账卡”并存，但不要只剩协议本身。',
    ].join('\n');
  }

  const gameCard = parseGameCardData(message.text || '');
  if (gameCard && typeof gameCard.content === 'string') {
    const cardType = (() => {
      if (gameCard.game === 'qna') {
        return gameCard.type === 'question' || gameCard.type === 'request_question'
          ? {
              responseType: 'answer',
              instruction: '这轮应该继续输出 GAME_CARD，并把类型落成 answer。',
            }
          : {
              responseType: 'answer',
              instruction: '这轮仍然应该优先保持 GAME_CARD 结构，不要退化成普通文字。',
            };
      }

      if (gameCard.game === 'tod') {
        return {
          responseType: gameCard.type === 'dare' ? 'dare' : 'truth',
          instruction: '这轮是游戏卡互动，优先继续用 GAME_CARD 协议承载回答，不要退成普通消息。',
        };
      }

      return {
        responseType: gameCard.type === 'result' ? 'result' : gameCard.type,
        instruction: '这轮是结构化游戏内容，优先保持 GAME_CARD 输出。',
      };
    })();

    return [
      '## 本轮特殊回复要求',
      '用户最新消息是一张 GAME_CARD 卡片。',
      cardType.instruction,
      `建议协议骨架： [GAME_CARD] {"game":"${gameCard.game}","type":"${cardType.responseType}","question":${JSON.stringify(typeof gameCard.question === 'string' ? gameCard.question : '')},"content":"角色真正会说的话"}`,
      '要求：卡片内容要像这个角色本人说出来的，不要写成系统说明；最终输出优先直接给出可解析的 GAME_CARD，不要先写普通文本再解释。',
    ].join('\n');
  }

  if ((message.text || '').trim() === COUPLE_SPACE_INVITE_TOKEN) {
    return [
      '## 本轮特殊回复要求',
      '用户最新消息是情侣空间邀请卡。',
      `这轮回复如果同意，结尾必须补上 ${COUPLE_SPACE_INVITE_ACCEPTED_TOKEN}，让前端继续显示接受结果卡。`,
      '不要把这轮回复写成普通闲聊；优先按邀请事件来表态。',
    ].join('\n');
  }

  if ((message.text || '').trim() === COUPLE_SPACE_INVITE_ACCEPTED_TOKEN) {
    return [
      '## 本轮特殊回复要求',
      '用户最新消息是情侣空间已接受结果卡。',
      '这轮如果继续说话，要明确围绕这个结果事件展开，不要退成无关闲聊。',
    ].join('\n');
  }

  return '';
}

type UseDirectChatRuntimeArgs = {
  character: Character;
  sharedStickers?: string[];
  history: ChatMessage[];
  setHistory: (history: ChatMessage[]) => void;
  settings: Pick<AppSettings, 'activeConfigId' | 'configs' | 'apiCenterConfig'>;
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
  requestManualReply: () => void;
  handleVoiceCallAIResponse: (userText: string) => Promise<{
    text: string;
    translation?: string;
    audioUrl?: string;
    audioMimeType?: string;
  } | null>;
  sendImageMessage: (base64String: string) => void;
  sendAudioMessage: (
    audioUrl: string,
    audioMimeType: string,
    durationSeconds?: number,
    audioTranscript?: string,
    options?: {
      promptText?: string;
      userText?: string;
      displayTranscript?: string;
    },
  ) => void;
  sendStickerMessage: (sticker: string) => void;
  sendLocationMessage: (text: string, locationData: { name: string; address?: string; isVirtual?: boolean }) => void;
  sendCoupleSpaceInvitation: () => void;
  sendInnerVoiceProbe: () => void;
  sendSpeechTranscript: (transcript: string) => void;
  finalizeVoiceCall: (params: {
    duration: number;
    voiceCallHistory: { role: 'user' | 'model'; text: string; translation?: string }[];
    isRecordingCall: boolean;
  }) => void;
  editMessageAt: (index: number, text: string) => void;
  backtrackToMessageAt: (index: number) => void;
  regenerateLatestReplyAt: (index: number) => Promise<boolean>;
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
  suppressUserText?: boolean;
  imageUrl?: string;
  audioUrl?: string;
  audioMimeType?: string;
  duration?: number;
  stickerLabel?: string;
  locationData?: { name: string; address?: string; isVirtual?: boolean };
  isInnerVoice?: boolean;
  forceReply?: boolean;
};

type DirectGenerationMode = 'reply' | 'proactive';

const DIRECT_PROACTIVE_SPEAKING_PROMPT = [
  '## 本轮任务：单聊主动开口',
  '这次不是回复用户刚刚的问题，而是你作为这个角色在单聊里主动给用户发一条自然消息。',
  '可以基于你的当前生活状态、时间、地点、天气、最近聊天余波、关系记忆、世界书、面具和角色边界来开口。',
  '时间认知必须以当前语境里的时间来源为准：如果当前时间来源是感知时间/虚拟时间，就按感知时间推进角色状态；如果没有开启感知时间，才按现实时间推进。',
  '如果距离上一条可见消息已经过了一段时间，你必须把这次开口当作时间真实流逝后的重新出现，不要表现得像上一句话刚刚发生。',
  '优先像微信联系人一样发来一两句生活感强的消息：此刻在做什么、刚看到什么、突然想到用户、接上次没聊完的话题、轻轻关心一下，或分享一点自己的状态。',
  '不要复述、改写或延长你上一条已经发出的消息；如果接续上次话题，也必须换一个新的角度、状态或生活细节。',
  '不要解释“我来主动找你了”，不要写成日记、总结、旁白或长独白，不要编造重大事件、现实见面安排或不符合角色边界的亲密推进。',
  '如果最近确实没有合适话题，就发一条短的生活碎片或轻微问候。',
].join('\n');

const DIRECT_PROACTIVE_TRIGGER_MESSAGE = [
  '用户点击了“让TA说话”。',
  '请主动发一条新的单聊消息。',
  '不要重复、改写或延长你上一条已经发出的内容。',
  '如果时间已经流逝，请像重新拿起手机一样开口，并按当前语境里的时间来源理解现在。',
].join('\n');

function buildDirectActionDescriptionPrompt(inputEnabled?: boolean, characterEnabled?: boolean): string {
  if (inputEnabled && characterEnabled) {
    return [
      '## 场景动作描述格式',
      '用户可能会用中文全角括号“（）”描述动作、神态、环境或场景，括号外是说出口的话。',
      '你必须同时理解括号内的动作/场景和括号外的对话内容。',
      '你也可以在自然需要时使用“（）”写简短动作、神态或场景，再在括号外写角色真正说出口的话。',
      '不要每句话都强行加括号；括号内容要短、具体、贴合当前时间和关系，不要写成长篇旁白。',
    ].join('\n');
  }

  if (inputEnabled) {
    return [
      '## 场景动作描述格式',
      '用户可能会用中文全角括号“（）”描述动作、神态、环境或场景，括号外是说出口的话。',
      '你必须同时理解括号内的动作/场景和括号外的对话内容。',
      '当前未开启角色主动场景动作描述，所以不要主动用“（）”输出动作或旁白；请主要输出角色说出口的话。',
    ].join('\n');
  }

  return [
    '## 场景动作描述格式',
    '如果用户消息里出现中文全角括号“（）”，括号内代表动作、神态、环境或场景，括号外代表说出口的话，你需要理解两部分。',
    '当前未开启场景动作描述功能，所以不要主动用“（）”输出动作或旁白。',
  ].join('\n');
}

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

function cleanAutoTranslationResult(rawTranslation: string, sourceText: string): string {
  const normalized = sanitizePipeMarkers(rawTranslation, '\n')
    .replace(/\r/g, '')
    .trim();
  if (!normalized) {
    return '';
  }

  const sourceLines = new Set(
    sanitizePipeMarkers(sourceText, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );

  const cleanedLines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^---+\s*translation\s*---+$/i.test(line))
    .filter((line) => !/^(translation|translated text|中文翻译|翻译)[:：]?\s*$/i.test(line))
    .filter((line) => !/^text\s*[:：]/i.test(line))
    .filter((line) => !sourceLines.has(line));

  const cleaned = cleanedLines.join('\n').trim();
  if (!cleaned) {
    return '';
  }

  return cleaned === sanitizePipeMarkers(sourceText, '\n').trim()
    ? ''
    : cleaned;
}

function extractSpeechTextForAudio(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/（[^（）\n]{0,80}）/gu, ' ')
    .replace(/\([^()\n]{0,80}\)/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function shouldAttachCharacterVoiceReply(character: Character): boolean {
  if (character.voiceProfile?.enabled !== true) {
    return false;
  }

  const replyMode = character.voiceProfile?.replyMode || 'voice';
  if (replyMode === 'text') {
    return false;
  }

  if (replyMode === 'voice') {
    return true;
  }

  const frequency = character.voiceProfile?.replyFrequency || 'medium';
  const probability = frequency === 'high' ? 0.75 : frequency === 'low' ? 0.3 : 0.55;
  return Math.random() < probability;
}

function parseBatchTranslationResult(rawTranslation: string, expectedCount: number): string[] {
  const normalized = sanitizePipeMarkers(rawTranslation, '\n')
    .replace(/\r/g, '')
    .trim();
  if (!normalized) {
    return [];
  }

  const exactDelimiter = '<<<ITEM_BREAK>>>';
  if (normalized.includes(exactDelimiter)) {
    return normalized
      .split(exactDelimiter)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, expectedCount);
  }

  const taggedMatches = Array.from(
    normalized.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi),
  );
  if (taggedMatches.length > 0) {
    return taggedMatches
      .map((match) => match[1]?.trim() || '')
      .filter(Boolean)
      .slice(0, expectedCount);
  }

  return [];
}

function shouldTranslateVoiceCallReply(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  const hasCjk = /[\u3400-\u9fff]/.test(trimmed);
  const hasLatin = /[A-Za-z]/.test(trimmed);
  return hasLatin && !hasCjk;
}

export function useDirectChatRuntime({
  character,
  sharedStickers = [],
  history,
  setHistory,
  settings,
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
  const activeConfig = resolveSceneTextApiConfig({
    settings,
    scene: 'single-chat',
    characterId: character.id,
  }).runtimeConfig;
  const resolvedVoiceConfig = resolveSceneVoiceApiConfig({
    settings,
    mode: 'tts',
    character,
  });
  const voiceRuntimeConfig = resolvedVoiceConfig.runtimeConfig;
  const defaultTtsVoiceId = resolvedVoiceConfig.defaultVoiceId;
  const forumConfig = resolveSceneTextApiConfig({
    settings,
    scene: 'forum',
  }).runtimeConfig;
  const availableStickers = Array.from(new Set([
    ...sharedStickers,
    ...(character.stickers || []),
  ].filter((sticker): sticker is string => typeof sticker === 'string' && sticker.trim().length > 0)
    .map((sticker) => sticker.trim())));
  const lastMomentPublishAtRef = useRef<number | null>(null);
  const { isLoading, error, setError: setErrorState, activeGenerationIdRef, runGeneration } = useSessionRuntimeCore();
  const activeAssistantMessageIdRef = useRef<number | null>(null);
  const activeAssistantRenderCountRef = useRef(0);
  const handleSendRef = useRef<(overrideText?: string | any, locationData?: any) => Promise<void>>(async () => {});
  const historyRef = useRef(history);
  const inputRef = useRef(input);
  const translationWorkerRunningRef = useRef(false);
  const translationFailureNoticeShownRef = useRef(false);
  const pendingCoupleSpaceInviteRef = useRef(false);
  const pendingTransferDecisionIdsRef = useRef<Set<string>>(new Set());

  const syncCharacterRuntimeState = useCallback((params: {
    history: ChatMessage[];
    continuityMode: 'continuous_scene' | 'same_day_resume' | 'resume_after_gap';
    shortTermSummary?: string;
    latestUserText?: string;
    latestAssistantText?: string;
  }) => {
    const patch = reconcileCharacterRuntimeState({
      character,
      history: params.history,
      continuityMode: params.continuityMode,
      nowTimestamp: Date.now(),
      shortTermSummary: params.shortTermSummary,
      latestUserText: params.latestUserText,
      latestAssistantText: params.latestAssistantText,
    });

    if (onPatchCharacter) {
      onPatchCharacter(patch);
      return;
    }

    onUpdateCharacter({
      ...character,
      ...patch,
    });
  }, [character, onPatchCharacter, onUpdateCharacter]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const setError = useCallback((value: string | null) => {
    setErrorState(value);
  }, []);

  const getLatestModelReplySegment = useCallback((messages: ChatMessage[]) => {
    let end = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.isSystem || message.isRecalled) {
        continue;
      }
      if (message.role !== 'model') {
        return null;
      }
      end = index;
      break;
    }

    if (end < 0) {
      return null;
    }

    let start = end;
    for (let index = end - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== 'model' || message.isSystem || message.isRecalled) {
        break;
      }
      start = index;
    }

    return { start, end };
  }, []);

  const synthesizeCharacterReplyAudio = useCallback(async (
    text: string,
    fileNameBase: string,
  ): Promise<{
    audioUrl: string;
    audioMimeType: string;
    spokenText: string;
  } | null> => {
    const cleanText = text.trim();
    const spokenText = extractSpeechTextForAudio(cleanText);
    if (!cleanText || !spokenText || !shouldApplyCharacterTts(character) || !voiceRuntimeConfig) {
      return null;
    }

    const preferredVoiceId = resolveCharacterTtsVoiceId(character, defaultTtsVoiceId);
    if (!preferredVoiceId) {
      return null;
    }

    try {
      const audioResult = await synthesizeTtsAudio({
        config: voiceRuntimeConfig,
        text: spokenText,
        preferredVoiceId,
        fallbackVoiceId: defaultTtsVoiceId,
        fileNameBase,
      });
      return {
        ...audioResult,
        spokenText,
      };
    } catch (ttsError) {
      console.error('Character TTS synthesis failed', ttsError);
      return null;
    }
  }, [character, defaultTtsVoiceId, voiceRuntimeConfig]);

  const attachAudioToLatestModelReply = useCallback(async (
    messages: ChatMessage[],
    fileNamePrefix: string,
  ) => {
    if (!shouldAttachCharacterVoiceReply(character)) {
      return messages;
    }

    const latestReplySegment = getLatestModelReplySegment(messages);
    if (!latestReplySegment) {
      return messages;
    }

    const nextMessages = [...messages];
    for (let index = latestReplySegment.start; index <= latestReplySegment.end; index += 1) {
      const message = nextMessages[index];
      const cleanText = message?.text?.trim();
      if (!message || message.role !== 'model' || !cleanText || message.audioUrl) {
        continue;
      }

      const audioResult = await synthesizeCharacterReplyAudio(
        cleanText,
        `${fileNamePrefix}-${index - latestReplySegment.start + 1}`,
      );
      if (!audioResult) {
        continue;
      }

      nextMessages[index] = {
        ...message,
        audioUrl: audioResult.audioUrl,
        audioMimeType: audioResult.audioMimeType,
        audioTranscript: audioResult.spokenText,
      };
    }

    return nextMessages;
  }, [character, getLatestModelReplySegment, synthesizeCharacterReplyAudio]);

  const applyAvatarAction = useCallback((
    action: ParsedAvatarAction | null,
    sourceHistory: ChatMessage[],
  ) => {
    if (!action || (action.type !== 'change' && action.type !== 'save_only' && action.type !== 'reject')) {
      return;
    }

    const isAutonomousLibraryChange =
      action.type === 'change'
      && /^avatar_library:/i.test(action.source)
      && !latestUserMessageHasAvatarIntent(sourceHistory);
    if (isAutonomousLibraryChange) {
      const latestAvatarUseAt = Math.max(
        0,
        ...(character.avatarLibrary?.entries || [])
          .map((entry) => entry.lastUsedAt || 0),
      );
      if (latestAvatarUseAt > 0 && Date.now() - latestAvatarUseAt < 6 * 60 * 60 * 1000) {
        return;
      }
    }

    const candidate = resolveAvatarCandidateFromAction({
      character,
      action,
      messages: sourceHistory,
    });
    if (!candidate) {
      return;
    }

    const patch = buildCharacterAvatarPatchFromAction({
      character,
      action,
      candidate,
    });

    if (onPatchCharacter) {
      onPatchCharacter(patch);
      return;
    }

    onUpdateCharacter({
      ...character,
      ...patch,
    });
  }, [character, onPatchCharacter, onUpdateCharacter]);

  const generateDirectAssistantMessage = useCallback(async (
    historySnapshot: ChatMessage[],
    mode: DirectGenerationMode,
  ) => {
    await runGeneration(async ({ setRuntimeError: _setRuntimeError }) => {
        setErrorState(null);

        if (!activeConfig) {
          setErrorState('Missing API Key. Please configure it in API Center settings.');
          return;
        }

        const assistantMsgId = Date.now() + 1;
        activeAssistantMessageIdRef.current = assistantMsgId;
        activeAssistantRenderCountRef.current = 0;
        let currentResponseText = '';
        let latestHistory = historySnapshot;
        let renderedAssistantMessageCount = 0;
        const latestPendingUserBlock = getLatestPendingUserMessageBlock(historySnapshot);
        const latestPendingUserMessage = latestPendingUserBlock
          ? historySnapshot[latestPendingUserBlock.end]
          : null;
        const isInnerVoiceRequest = !!latestPendingUserMessage?.isInnerVoice;
        const replaceAssistantMessages = (messages: ChatMessage[], text: string): ChatMessage[] => {
          const displayText = parseAvatarActionBlock(text).displayText;
          const shouldRecallPrevious = hasDirectRecallCue(displayText, {
            assistantAliases: [character.name, character.remarkName?.trim() || ''],
            maxDirectReplyBubbles: resolveCharacterReplyBubbleLimit(character),
          });
          const nextAssistantMessages = splitStreamingModelResponseIntoMessages(displayText, assistantMsgId, {
            isInnerVoice: isInnerVoiceRequest,
            transferTargetLabel: userName,
            assistantAliases: [character.name, character.remarkName?.trim() || ''],
            availableStickers,
            maxDirectReplyBubbles: resolveCharacterReplyBubbleLimit(character),
            currentHistory: messages,
            userLabel: userName,
            modelLabel: character.name,
          });
          const baseMessages = messages.filter(msg =>
            !(msg.role === 'model' && msg.timestamp >= assistantMsgId && msg.timestamp < assistantMsgId + renderedAssistantMessageCount)
          );
          const nextMessages = shouldRecallPrevious
            ? markLatestVisibleModelMessageRecalled(baseMessages)
            : baseMessages;
          renderedAssistantMessageCount = nextAssistantMessages.length;
          activeAssistantRenderCountRef.current = renderedAssistantMessageCount;
          return [...nextMessages, ...nextAssistantMessages];
        };

        const updateAssistantMessage = (text: string) => {
          currentResponseText = text;
          latestHistory = replaceAssistantMessages(latestHistory, currentResponseText);
          setHistory(latestHistory);
        };

        try {
          const historyLimit = getDirectMemoryMessageLimit(character.memoryLimit);
          const characterTemporalState = buildCharacterTemporalState({
            characterId: character.id,
            perception,
            directChatHistory,
            groupMessages: [],
            coupleSpace,
          });
          const historyWindow = getDirectHistoryWindowByTemporalMode(
            historySnapshot,
            historyLimit,
            characterTemporalState.continuityMode,
          );
          const contextLayers = buildDirectContextLayers({
            messages: historySnapshot,
            liveMessages: historyWindow,
            continuityMode: characterTemporalState.continuityMode,
            nowTimestamp: characterTemporalState.temporalFacts.nowTimestamp,
          });

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
            mode: mode === 'proactive' ? 'chat' : 'autoReply',
            includeProtocolRules: mode !== 'proactive',
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
            worldBookQuery: latestPendingUserMessage?.text,
            latestUserText: latestPendingUserMessage?.text,
          });
          const directIntentAnalysis = mode === 'proactive'
            ? null
            : analyzeLatestDirectUserIntent(historySnapshot);
          const directCharacterDecision = mode === 'proactive'
            ? null
            : analyzeDirectCharacterDecision({
              character,
              messages: historySnapshot,
              intentAnalysis: directIntentAnalysis,
            });
          const directSpecialReplyPrompt = mode === 'proactive'
            ? ''
            : buildDirectSpecialReplyPrompt(latestPendingUserMessage);
          const systemPrompt = buildChatPrompt({
            ...chatSceneInput,
            sections: [
              buildDirectResumeModePrompt(characterTemporalState.continuityMode),
              ...(chatSceneInput.sections || []),
              buildDirectIntentPromptSection(directIntentAnalysis),
              buildDirectCharacterDecisionPromptSection(directCharacterDecision),
              directSpecialReplyPrompt,
              mode === 'proactive' ? DIRECT_PROACTIVE_SPEAKING_PROMPT : '',
              buildDirectActionDescriptionPrompt(character.actionDescriptionEnabled, character.characterActionDescriptionEnabled),
              'Optional lightweight action cues are allowed when useful: "[reply: 你] text", "[reply: 刚才那句] text", "[recall] text", or a separate line "[sticker] caption". Sticker cues can be a standalone reaction or follow a text line. Use them sparingly and only when they help the chat feel more alive.',
              buildOpenLoopRegistryPrompt({
                existingEntries: character.openLoopRegistry,
                shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
                recentMessages: contextLayers.memoryMessages,
                topicAnchors: chatSceneInput.recentContext?.topicAnchors,
                taskResidue: chatSceneInput.recentContext?.taskResidue,
              }),
              contextLayers.memoryContextPrompt,
              buildAvatarActionPromptSection(character, historySnapshot),
              buildAutonomousAvatarLibraryPromptSection(character),
              buildAssistantStickerPromptSection(availableStickers),
            ].filter(Boolean),
          });

          const runtimeMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...contextLayers.liveMessages.map(m => ({
              role: m.role === 'user' ? 'user' as const : 'assistant' as const,
              content: toPromptHistoryContent(m, {
                nowTimestamp: characterTemporalState.temporalFacts.nowTimestamp,
                continuityMode: characterTemporalState.continuityMode,
              }),
              ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
              ...(m.audioUrl ? { audioUrl: m.audioUrl, audioMimeType: m.audioMimeType } : {}),
            })).filter((message) => !!message.content.trim() || !!message.imageUrl || !!message.audioUrl),
            ...(mode === 'proactive'
              ? [{ role: 'user' as const, content: DIRECT_PROACTIVE_TRIGGER_MESSAGE }]
              : []),
          ];
          const qualityResult = await generateQualityCheckedAssistantReply({
            activeConfig,
            messages: runtimeMessages,
            allowBracketActions: shouldAllowBracketActions(character),
            onInvalid: (result) => {
              console.warn('[direct-chat] invalid generated reply, retrying', {
                reason: result.reason,
                preview: result.cleanedText.slice(0, 120),
              });
            },
          });

          if (!qualityResult.ok) {
            throw new Error(`模型返回无效内容：${qualityResult.reason || 'unknown'}`);
          }

          currentResponseText = applyDirectGameCardBridge({
            replyText: qualityResult.cleanedText,
            latestUserMessage: latestPendingUserMessage,
          });
          currentResponseText = applyDirectCoupleSpaceBridge({
            replyText: currentResponseText,
            latestUserMessage: latestPendingUserMessage,
          });
          currentResponseText = applyDirectTransferBridge({
            replyText: currentResponseText,
            intentAnalysis: directIntentAnalysis,
            decision: directCharacterDecision,
          });
          const avatarActionResult = parseAvatarActionBlock(currentResponseText);
          currentResponseText = avatarActionResult.displayText;
          latestHistory = replaceAssistantMessages(latestHistory, currentResponseText);
          latestHistory = await attachAudioToLatestModelReply(
            latestHistory,
            `direct-generate-${character.id}-${assistantMsgId}`,
          );
          setHistory(latestHistory);
          syncCharacterRuntimeState({
            history: latestHistory,
            continuityMode: characterTemporalState.continuityMode,
            shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
            latestUserText: latestPendingUserMessage?.text,
            latestAssistantText: currentResponseText,
          });
          applyAvatarAction(avatarActionResult.action, historySnapshot);
          activeAssistantMessageIdRef.current = null;
          activeAssistantRenderCountRef.current = 0;

        } catch (err) {
          console.error(err);
          setErrorState('Failed to generate reply. Please try again later.');
          activeAssistantMessageIdRef.current = null;
          activeAssistantRenderCountRef.current = 0;
        }
    });
  }, [activeConfig, applyAvatarAction, attachAudioToLatestModelReply, character, chatGroups, coupleSpace, directChatHistory, masks, perception, runGeneration, setHistory, syncCharacterRuntimeState, userName, worldBook]);

  useEffect(() => {
    const pendingUserBlock = getLatestPendingUserMessageBlock(history);
    const pendingReplyIndex = pendingUserBlock?.end;
    const pendingReplyMessage = typeof pendingReplyIndex === 'number' ? history[pendingReplyIndex] : undefined;
    if (pendingReplyMessage?.needsReply && !isLoading) {
      const reply = async () => {
        const historySnapshot = history.map((message, index) => (
          index === pendingReplyIndex ? { ...message, needsReply: false } : message
        ));
        setHistory(historySnapshot);
        await generateDirectAssistantMessage(historySnapshot, 'reply');
      };

      void reply();
    }
  }, [generateDirectAssistantMessage, history, isLoading, setHistory]);

  useEffect(() => {
    const translateHistory = async () => {
      if (!character.autoTranslate || !activeConfig) return;
      if (translationWorkerRunningRef.current) return;

      const isMostlyChinese = (text: string) => {
        const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
        if (!chineseChars) return false;
        const textLength = text.replace(/\s/g, '').length;
        return textLength > 0 && (chineseChars.length / textLength > 0.5);
      };

      const getMessageTranslationSource = (msg: ChatMessage) => {
        let textToTranslate = msg.audioTranscript?.trim() || msg.text;
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

        return {
          textToTranslate,
          isQnaAnswer,
          questionToTranslate,
          isGameCard: !!gameData,
        };
      };

      const canTranslateMessage = (msg: ChatMessage) => {
        if (msg.role !== 'model' || msg.isSystem || msg.translation || msg.text.includes('---TRANSLATION---')) return false;
        if (msg.imageUrl || msg.isInnerVoice) return false;
        if (msg.audioUrl && !msg.audioTranscript?.trim()) return false;
        if (msg.text.match(/^\[[^\]]*?转账[^\]]*?([\d\.]+)\]$/)) return false;

        const { textToTranslate } = getMessageTranslationSource(msg);
        const textToCheck = textToTranslate.replace(/\[[^\]]*?转账[^\]]*?([\d\.]+)\]/g, '').trim();
        return !!textToCheck && !isMostlyChinese(textToCheck);
      };

      const isBatchableWithNeighbors = (msg: ChatMessage) => {
        const { isGameCard, isQnaAnswer } = getMessageTranslationSource(msg);
        return !isGameCard && !isQnaAnswer;
      };

      const findNextTranslationBatch = () => {
        const latestHistory = historyRef.current;

        for (let index = latestHistory.length - 1; index >= 0; index -= 1) {
          const msg = latestHistory[index];
          if (!canTranslateMessage(msg)) {
            continue;
          }

          const batch = [{ msg, index }];
          if (!isBatchableWithNeighbors(msg)) {
            return batch;
          }

          let cursor = index - 1;
          while (cursor >= 0) {
            const candidate = latestHistory[cursor];
            if (!canTranslateMessage(candidate) || candidate.role !== 'model' || candidate.isSystem) {
              break;
            }
            if (!isBatchableWithNeighbors(candidate)) {
              break;
            }
            batch.unshift({ msg: candidate, index: cursor });
            cursor -= 1;
          }

          return batch;
        }

        return [];
      };

      const translateText = async (prompt: string) => {
        try {
          let responseText = '';
          await streamTextWithConfig({
            activeConfig,
            temperature: 0.1,
            messages: [{ role: 'user', content: prompt }],
            onTextChunk: (chunkText) => {
              responseText += chunkText;
            },
          });
          return responseText;
        } catch (streamError) {
          console.warn('Streaming translation failed, falling back to non-stream request.', streamError);
          return generateTextFromMessagesWithConfig({
            activeConfig,
            temperature: 0.1,
            messages: [{ role: 'user', content: prompt }],
          });
        }
      };

      translationWorkerRunningRef.current = true;
      try {
        while (true) {
          const batch = findNextTranslationBatch();
          if (batch.length === 0) {
            break;
          }

          try {
            const singleSource = batch.length === 1
              ? getMessageTranslationSource(batch[0].msg)
              : null;

            let translations: string[] = [];
            if (batch.length === 1 && singleSource) {
              const sourcePayload = singleSource.isQnaAnswer && singleSource.questionToTranslate
                ? `<question>\n${singleSource.questionToTranslate}\n</question>\n<answer>\n${singleSource.textToTranslate}\n</answer>`
                : `<source>\n${singleSource.textToTranslate}\n</source>`;
              const prompt = singleSource.isQnaAnswer && singleSource.questionToTranslate
                ? [
                    'Translate the content below into Simplified Chinese.',
                    'Return ONLY the Chinese translation.',
                    'Do not include the original text, labels, explanations, or code fences.',
                    'Translate the question first and the answer second, separated by a single line containing only ---.',
                    '',
                    sourcePayload,
                  ].join('\n')
                : [
                    'Translate the content below into Simplified Chinese.',
                    'Return ONLY the Chinese translation.',
                    'Do not include the original text, labels, explanations, or code fences.',
                    '',
                    sourcePayload,
                  ].join('\n');

              const translation = cleanAutoTranslationResult(
                await translateText(prompt),
                singleSource.isQnaAnswer && singleSource.questionToTranslate
                  ? `${singleSource.questionToTranslate}\n---\n${singleSource.textToTranslate}`
                  : singleSource.textToTranslate,
              );
              translations = translation ? [translation] : [];
            } else {
              const batchPrompt = [
                'Translate each item below into Simplified Chinese.',
                'Keep the original order exactly.',
                'Return ONLY the translations.',
                'Separate each translated item with a line containing exactly <<<ITEM_BREAK>>>.',
                'Do not include numbering, labels, explanations, the original text, or code fences.',
                '',
                ...batch.map(({ msg }, idx) => {
                  const source = getMessageTranslationSource(msg);
                  return `<item index="${idx + 1}">\n${source.textToTranslate}\n</item>`;
                }),
              ].join('\n');

              const rawBatchTranslation = await translateText(batchPrompt);
              const parsedTranslations = parseBatchTranslationResult(rawBatchTranslation, batch.length);
              translations = parsedTranslations.map((translation, idx) => cleanAutoTranslationResult(
                translation,
                getMessageTranslationSource(batch[idx].msg).textToTranslate,
              ));
            }

            if (translations.length > 0) {
              const latestHistory = historyRef.current;
              const allMessagesStillMatch = batch.every(({ msg, index }) => {
                const liveMessage = latestHistory[index];
                return !!liveMessage
                  && liveMessage.timestamp === msg.timestamp
                  && liveMessage.role === msg.role
                  && liveMessage.text === msg.text
                  && !liveMessage.translation;
              });

              if (allMessagesStillMatch) {
                const nextHistory = [...latestHistory];
                batch.forEach(({ index }, idx) => {
                  const translation = translations[idx]?.trim();
                  if (!translation) {
                    return;
                  }
                  nextHistory[index] = {
                    ...nextHistory[index],
                    translation,
                  };
                });
                setHistory(nextHistory);
                translationFailureNoticeShownRef.current = false;
              }
            }
          } catch (translationError) {
            console.error('Translation failed for message batch', batch.map(item => item.index), translationError);
            if (!translationFailureNoticeShownRef.current) {
              setErrorState('Auto-translation failed for some messages. Please check API/network settings.');
              translationFailureNoticeShownRef.current = true;
            }
            break;
          }
        }
      } finally {
        translationWorkerRunningRef.current = false;
      }
    };

    translateHistory();
  }, [activeConfig, character.autoTranslate, error, history, setHistory]);

  const handleVoiceCallAIResponse = useCallback(async (userText: string): Promise<{
    text: string;
    translation?: string;
    audioUrl?: string;
    audioMimeType?: string;
  } | null> => {
    if (!activeConfig) {
      setErrorState('Missing active API config.');
      return null;
    }

    try {
      const characterCorePersona = buildCharacterContext({
        character,
      }).corePersona ?? '';
      const languageRules = buildReplyLanguageRules({
        replyLanguageMode: character.replyLanguageMode,
        nativeLanguage: character.nativeLanguage,
        fixedReplyLanguage: character.fixedReplyLanguage,
      });
      const qualityResult = await generateQualityCheckedAssistantReply({
        activeConfig,
        messages: [
          {
            role: 'system',
            content: [
              '你正在与用户进行实时语音通话。',
              `你的核心人设是：${characterCorePersona || '自然、口语化、像真人聊天一样回复。'}`,
              languageRules,
              '请像电话里说话一样自然回应，尽量简短，控制在 50 字以内。',
              '不要输出动作括号、舞台提示、解释说明，也不要分点。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: userText,
          },
        ],
        allowBracketActions: false,
      });

      if (!qualityResult.ok) {
        throw new Error(`语音通话模型返回无效内容：${qualityResult.reason || 'unknown'}`);
      }

      const cleanResponseText = qualityResult.cleanedText.trim();
      if (!cleanResponseText) {
        return null;
      }

      let translation = '';
      if (shouldTranslateVoiceCallReply(cleanResponseText)) {
        try {
          const translationPrompt = [
            'Translate the content below into Simplified Chinese.',
            'Return ONLY the Chinese translation.',
            'Do not include the original text, labels, explanations, or code fences.',
            '',
            `<source>\n${cleanResponseText}\n</source>`,
          ].join('\n');

          translation = cleanAutoTranslationResult(
            await generateTextFromMessagesWithConfig({
              activeConfig,
              temperature: 0.1,
              messages: [{ role: 'user', content: translationPrompt }],
            }),
            cleanResponseText,
          );
        } catch (translationError) {
          console.warn('Voice call translation failed', translationError);
        }
      }

      let audioResult: Awaited<ReturnType<typeof synthesizeCharacterReplyAudio>> = null;
      try {
        audioResult = await synthesizeCharacterReplyAudio(
          cleanResponseText,
          `voice-call-${character.id}-${Date.now()}`,
        );
      } catch (ttsError) {
        console.error('Voice call TTS synthesis failed', ttsError);
      }

      return {
        text: cleanResponseText,
        ...(translation ? { translation } : {}),
        ...(audioResult ? {
          audioUrl: audioResult.audioUrl,
          audioMimeType: audioResult.audioMimeType,
        } : {}),
      };
    } catch (voiceCallError) {
      console.error('Voice call AI generation failed', voiceCallError);
      return null;
    }
  }, [activeConfig, character, synthesizeCharacterReplyAudio]);

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
      const staleAssistantRenderCount = Math.max(1, activeAssistantRenderCountRef.current);
      baseHistory = history.filter(msg =>
        !(msg.role === 'model' && msg.timestamp >= staleAssistantId && msg.timestamp < staleAssistantId + staleAssistantRenderCount)
      );
      setHistory(baseHistory);
      activeAssistantMessageIdRef.current = null;
      activeAssistantRenderCountRef.current = 0;
    }

    const shouldSuppressUserText = !!overridePayload?.suppressUserText && !!effectiveLocationData;
    const userMsg: ChatMessage = {
      role: 'user',
      text: shouldSuppressUserText
        ? ''
        : (overridePayload?.userText?.trim() || textToSend.trim() || (effectiveLocationData ? `[位置分享] ${effectiveLocationData.name}` : '')),
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

    if (!overridePayload) {
      setInput('');
    }

    setReplyingTo(null);

    if (!character.autoReplyEnabled && !overridePayload?.forceReply) {
      return;
    }

    const isInnerVoiceRequest = overridePayload?.isInnerVoice || textToSend.trim() === '[倾听心声]';
    const directSpecialReplyPrompt = buildDirectSpecialReplyPrompt(userMsg);
    const assistantMsgId = Date.now() + 1;
    activeAssistantMessageIdRef.current = assistantMsgId;
    let currentResponseText = '';
    let latestHistory = newHistory;
    let renderedAssistantMessageCount = 0;
    const stripPseudoMomentPrefix = (text: string) =>
      text.replace(/^\s*(动态|状态|朋友圈说说)[:：]\s*/u, '').trim();

    const replaceAssistantMessages = (messages: ChatMessage[], text: string): ChatMessage[] => {
      const displayText = parseAvatarActionBlock(stripPseudoMomentPrefix(text)).displayText;
      const shouldRecallPrevious = hasDirectRecallCue(displayText, {
        assistantAliases: [character.name, character.remarkName?.trim() || ''],
        maxDirectReplyBubbles: resolveCharacterReplyBubbleLimit(character),
      });
      const nextAssistantMessages = splitStreamingModelResponseIntoMessages(displayText, assistantMsgId, {
        isInnerVoice: isInnerVoiceRequest,
        transferTargetLabel: userName,
        assistantAliases: [character.name, character.remarkName?.trim() || ''],
        availableStickers,
        maxDirectReplyBubbles: resolveCharacterReplyBubbleLimit(character),
        currentHistory: messages,
        userLabel: userName,
        modelLabel: character.name,
      });
      const baseMessages = messages.filter(msg =>
        !(msg.role === 'model' && msg.timestamp >= assistantMsgId && msg.timestamp < assistantMsgId + renderedAssistantMessageCount)
      );
      const nextMessages = shouldRecallPrevious
        ? markLatestVisibleModelMessageRecalled(baseMessages)
        : baseMessages;
      renderedAssistantMessageCount = nextAssistantMessages.length;
      activeAssistantRenderCountRef.current = renderedAssistantMessageCount;
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
        activeConfig: forumConfig || activeConfig,
        character,
        masks,
        worldBook,
      });

      if (commandMomentResult.shouldPublish && commandMomentResult.momentContent) {
        const noticeTimestamp = Date.now();
        setHistory([
          ...newHistory,
          createMomentPublishedSystemMessage(character.name, noticeTimestamp),
        ]);
        activeAssistantMessageIdRef.current = null;
        activeAssistantRenderCountRef.current = 0;

        onPublishMoment?.({
          authorId: character.id,
          content: commandMomentResult.momentContent,
          imageCard: commandMomentResult.momentImageCard,
        });
        lastMomentPublishAtRef.current = Date.now();
        return;
      }

      const historyLimit = getDirectMemoryMessageLimit(character.memoryLimit);
      const characterTemporalState = buildCharacterTemporalState({
        characterId: character.id,
        perception,
        directChatHistory,
        groupMessages: [],
        coupleSpace,
      });
      const historyWindow = getDirectHistoryWindowByTemporalMode(
        newHistory,
        historyLimit,
        characterTemporalState.continuityMode,
      );
      const contextLayers = buildDirectContextLayers({
        messages: newHistory,
        liveMessages: historyWindow,
        continuityMode: characterTemporalState.continuityMode,
        nowTimestamp: characterTemporalState.temporalFacts.nowTimestamp,
      });

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
        worldBookQuery: userMsg.text,
        latestUserText: userMsg.text,
      });
      const directIntentAnalysis = analyzeLatestDirectUserIntent(newHistory);
      const directCharacterDecision = analyzeDirectCharacterDecision({
        character,
        messages: newHistory,
        intentAnalysis: directIntentAnalysis,
      });
      const inlineReplyTranslationEnabled = shouldInlineReplyTranslation(character);
      const systemPrompt = buildChatPrompt({
        ...chatSceneInput,
        sections: [
          buildDirectResumeModePrompt(characterTemporalState.continuityMode),
          ...(chatSceneInput.sections || []),
          buildDirectIntentPromptSection(directIntentAnalysis),
          buildDirectCharacterDecisionPromptSection(directCharacterDecision),
          directSpecialReplyPrompt,
          buildDirectActionDescriptionPrompt(character.actionDescriptionEnabled, character.characterActionDescriptionEnabled),
          'Optional lightweight action cues are allowed when useful: "[reply: 你] text", "[reply: 刚才那句] text", "[recall] text", or a separate line "[sticker] caption". Sticker cues can be a standalone reaction or follow a text line. Use them sparingly and only when they help the chat feel more alive.',
          buildOpenLoopRegistryPrompt({
            existingEntries: character.openLoopRegistry,
            shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
            recentMessages: contextLayers.memoryMessages,
            topicAnchors: chatSceneInput.recentContext?.topicAnchors,
            taskResidue: chatSceneInput.recentContext?.taskResidue,
          }),
          contextLayers.memoryContextPrompt,
          buildAvatarActionPromptSection(character, newHistory),
          buildAutonomousAvatarLibraryPromptSection(character),
          buildAssistantStickerPromptSection(availableStickers),
          inlineReplyTranslationEnabled ? buildInlineReplyTranslationPrompt(character) : '',
        ].filter(Boolean),
      });

      const runtimeMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...contextLayers.liveMessages.map(m => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: toPromptHistoryContent(m, {
            nowTimestamp: characterTemporalState.temporalFacts.nowTimestamp,
            continuityMode: characterTemporalState.continuityMode,
          }),
          ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
          ...(m.audioUrl ? { audioUrl: m.audioUrl, audioMimeType: m.audioMimeType } : {}),
        })).filter((message) => !!message.content.trim() || !!message.imageUrl || !!message.audioUrl),
      ];
      const qualityResult = await generateQualityCheckedAssistantReply({
        activeConfig,
        messages: runtimeMessages,
        allowBracketActions: shouldAllowBracketActions(character),
        onProgress: (streamingText) => {
          if (activeGenerationIdRef.current !== generationId) {
            return;
          }

          const previewText = stripPseudoMomentPrefix(getLegacyTranslationParts(streamingText).mainText);
          if (!previewText.trim()) {
            return;
          }

          updateAssistantMessage(previewText);
        },
        onInvalid: (result) => {
          console.warn('[direct-chat] invalid generated reply, retrying', {
            reason: result.reason,
            preview: result.cleanedText.slice(0, 120),
          });
        },
      });

      if (!qualityResult.ok && effectiveLocationData) {
        activeAssistantMessageIdRef.current = null;
        activeAssistantRenderCountRef.current = 0;
        setHistory(newHistory);
        return;
      }

      if (!qualityResult.ok) {
        throw new Error(`模型返回无效内容：${qualityResult.reason || 'unknown'}`);
      }
      if (activeGenerationIdRef.current !== generationId) {
        return;
      }

      currentResponseText = applyDirectGameCardBridge({
        replyText: qualityResult.cleanedText,
        latestUserMessage: userMsg,
      });
      currentResponseText = applyDirectCoupleSpaceBridge({
        replyText: currentResponseText,
        latestUserMessage: userMsg,
      });
      currentResponseText = applyDirectTransferBridge({
        replyText: currentResponseText,
        intentAnalysis: directIntentAnalysis,
        decision: directCharacterDecision,
      });
      currentResponseText = stripPseudoMomentPrefix(currentResponseText);
      const avatarActionResult = parseAvatarActionBlock(currentResponseText);
      currentResponseText = avatarActionResult.displayText;
      let finalHistory = replaceAssistantMessages(newHistory, currentResponseText);
      finalHistory = await attachAudioToLatestModelReply(
        finalHistory,
        `direct-send-${character.id}-${assistantMsgId}`,
      );
      setHistory(finalHistory);
      syncCharacterRuntimeState({
        history: finalHistory,
        continuityMode: characterTemporalState.continuityMode,
        shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
        latestUserText: userMsg.text,
        latestAssistantText: currentResponseText,
      });
      applyAvatarAction(avatarActionResult.action, finalHistory);
      activeAssistantMessageIdRef.current = null;
      activeAssistantRenderCountRef.current = 0;

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
          activeConfig: forumConfig || activeConfig,
          character,
          masks,
          worldBook,
        });

        if (autoMomentResult.shouldPublish && autoMomentResult.momentContent) {
          const noticeTimestamp = Date.now();
          const finalHistoryWithNotice = [
            ...finalHistory,
            createMomentPublishedSystemMessage(character.name, noticeTimestamp),
          ];
          setHistory(finalHistoryWithNotice);
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
          const summaryHistoryWindow = getSummaryHistoryWindow(finalHistory, clampDirectMemoryLimit(character.memoryLimit));
          const summarySourceLines = buildAutoSummarySourceLines({
            history: summaryHistoryWindow,
            assistantName: character.name,
          });

          if (summarySourceLines.length === 0) {
            return;
          }

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
            sections: [summarySourceLines.join('\n')],
          });

          let summaryText = '';
          try {
            await streamTextWithConfig({
              activeConfig,
              messages: [{ role: 'user', content: prompt }],
              onTextChunk: (chunkText) => {
                summaryText += chunkText;
              },
            });
          } catch (error) {
            if (!isRetryableSummaryStreamError(error)) {
              throw error;
            }

            summaryText = await generateTextFromMessagesWithConfig({
              activeConfig,
              messages: [{ role: 'user', content: prompt }],
            });
          }

          const safeSummaryText = sanitizeAutoSummaryText(summaryText);

          if (safeSummaryText) {
            const shortTermEntry = createMemoryLibraryEntry({
              kind: 'short-term',
              source: 'auto',
              content: safeSummaryText,
            });
            let nextMemoryLibraryEntries = appendMemoryLibraryEntry(character, shortTermEntry);
            let nextLongTermMemoryProfile: string | undefined;

            const autoLongTermPlan = buildAutoLongTermRefreshPlan({
              memoryLibraryEntries: character.memoryLibraryEntries,
              latestShortTermSummary: safeSummaryText,
              pendingEntries: nextMemoryLibraryEntries,
            });

            if (autoLongTermPlan.shouldRefresh) {
              const longTermPrompt = buildSummaryPrompt({
                mode: 'large',
                characterCore: {
                  characterSetting: characterCorePersona,
                },
                memoryContext: {
                  shortTermSummary: safeSummaryText,
                  longTermMemoryProfile,
                },
                sections: [summarySourceLines.join('\n')],
              });

              let longTermSummaryText = '';
              try {
                await streamTextWithConfig({
                  activeConfig,
                  messages: [{ role: 'user', content: longTermPrompt }],
                  onTextChunk: (chunkText) => {
                    longTermSummaryText += chunkText;
                  },
                });
              } catch (error) {
                if (!isRetryableSummaryStreamError(error)) {
                  throw error;
                }

                longTermSummaryText = await generateTextFromMessagesWithConfig({
                  activeConfig,
                  messages: [{ role: 'user', content: longTermPrompt }],
                });
              }

              const safeLongTermSummaryText = sanitizeAutoSummaryText(longTermSummaryText);

              if (safeLongTermSummaryText) {
                nextLongTermMemoryProfile = safeLongTermSummaryText;
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

            const nextShortTermSummary = nextLongTermMemoryProfile
              ? compressShortTermSummaryAfterLongTerm(safeSummaryText)
              : safeSummaryText;

            const runtimePatch = reconcileCharacterRuntimeState({
              character: {
                openLoopRegistry: character.openLoopRegistry,
                presenceState: character.presenceState,
                shortTermSummary: nextShortTermSummary,
              },
              history: finalHistory,
              continuityMode: characterTemporalState.continuityMode,
              nowTimestamp: Date.now(),
              shortTermSummary: nextShortTermSummary,
            });

            const patch: Partial<Character> = {
              shortTermSummary: nextShortTermSummary,
              memoryLibraryEntries: nextMemoryLibraryEntries,
              ...runtimePatch,
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
        activeAssistantRenderCountRef.current = 0;
      }
    }
    });
  }, [activeConfig, applyAvatarAction, attachAudioToLatestModelReply, character, chatGroups, coupleSpace, directChatHistory, history, input, masks, onPatchCharacter, onPublishMoment, onUpdateCharacter, perception, replyingTo, setHistory, setInput, setReplyingTo, syncCharacterRuntimeState, userName, worldBook]);

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

  const sendAudioMessage = useCallback((
    audioUrl: string,
    audioMimeType: string,
    durationSeconds?: number,
    audioTranscript?: string,
    options?: {
      promptText?: string;
      userText?: string;
      displayTranscript?: string;
    },
  ) => {
    const promptTranscript = audioTranscript?.trim() || '';
    const displayTranscript = options?.displayTranscript?.trim() || promptTranscript;
    void handleSendRef.current({
      promptText: options?.promptText?.trim()
        || (promptTranscript
          ? `[sent a voice message; transcript: ${promptTranscript}]`
          : '[sent a voice message]'),
      userText: options?.userText?.trim() || '[audio]',
      audioUrl,
      audioMimeType,
      ...(displayTranscript ? { audioTranscript: displayTranscript } : {}),
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
    void handleSendRef.current({
      promptText: text,
      suppressUserText: true,
      locationData,
    });
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
    void handleSendRef.current({
      promptText: '[倾听心声]',
      userText: '[使用道具：倾听Ta的心声]',
      isInnerVoice: true,
      forceReply: true,
    });
  }, []);

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
        const newTransactions = [newTransaction, ...(walletData?.transactions ?? [])];
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
    voiceCallHistory: { role: 'user' | 'model'; text: string; translation?: string }[];
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

  const editMessageAt = useCallback((index: number, text: string) => {
    const targetMessage = history[index];
    const nextText = text.trim();
    if (!targetMessage || !nextText) {
      return;
    }

    const nextHistory = [...history];
    nextHistory[index] = {
      ...targetMessage,
      text: nextText,
      isEdited: true,
    };
    setHistory(nextHistory);
  }, [history, setHistory]);

  const backtrackToMessageAt = useCallback((index: number) => {
    const latestHistory = historyRef.current;
    const targetMessage = latestHistory[index];
    if (!targetMessage || targetMessage.isSystem || isLoading) {
      return;
    }

    const nextHistory = latestHistory.slice(0, index + 1);
    const memorySnapshot = findNearestChatMemorySnapshot(latestHistory, index);
    const patch: Partial<Character> = {
      shortTermSummary: memorySnapshot?.shortTermSummary,
      longTermMemoryProfile: memorySnapshot?.longTermMemoryProfile,
      memoryLibraryEntries: memorySnapshot?.memoryLibraryEntries ?? [],
    };

    setHistory(nextHistory);
    setReplyingTo(null);
    setInput('');
    setError(null);

    if (onPatchCharacter) {
      onPatchCharacter(patch);
    } else {
      onUpdateCharacter({
        ...character,
        ...patch,
      });
    }
  }, [
    character,
    isLoading,
    onPatchCharacter,
    onUpdateCharacter,
    setError,
    setHistory,
    setInput,
    setReplyingTo,
  ]);

  const regenerateLatestReplyAt = useCallback(async (index: number) => {
    const latestHistory = historyRef.current;
    const segment = getLatestModelReplySegment(latestHistory);
    if (!segment || index < segment.start || index > segment.end || isLoading) {
      return false;
    }

    const baseHistory = latestHistory.slice(0, segment.start);
    setHistory(baseHistory);
    setReplyingTo(null);
    await generateDirectAssistantMessage(baseHistory, 'reply');
    return true;
  }, [generateDirectAssistantMessage, getLatestModelReplySegment, isLoading, setHistory, setReplyingTo]);

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
      const newTransactions = [newTransaction, ...(walletData?.transactions ?? [])];
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
        const newTransactions = [newTransaction, ...(walletData?.transactions ?? [])];
        onUpdateWalletData?.({ cards: newCards, transactions: newTransactions });
      }

      triggerTransferEventReaction({
        amount,
        direction: 'character_to_user_received',
      });
    }
  }, [activeConfig, character, character.name, history, onUpdateWalletData, setHistory, userName, walletData]);

  const requestManualReply = useCallback(() => {
    if (isLoading) {
      return;
    }

    const latestHistory = historyRef.current;
    const pendingUserBlock = getLatestPendingUserMessageBlock(latestHistory);

    if (!pendingUserBlock) {
      void generateDirectAssistantMessage(latestHistory, 'proactive');
      return;
    }

    setHistory(latestHistory.map((message, index) => (
      index === pendingUserBlock.end ? { ...message, needsReply: true } : message
    )));
  }, [generateDirectAssistantMessage, isLoading, setHistory]);

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
    requestManualReply,
    handleVoiceCallAIResponse,
    sendImageMessage,
    sendAudioMessage,
    sendStickerMessage,
    sendLocationMessage,
    sendCoupleSpaceInvitation,
    sendInnerVoiceProbe,
    sendSpeechTranscript,
    finalizeVoiceCall,
    editMessageAt,
    backtrackToMessageAt,
    regenerateLatestReplyAt,
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









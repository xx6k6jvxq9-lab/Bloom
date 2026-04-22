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
import { generateTextFromMessagesWithConfig, streamTextWithConfig } from '../../services/ai/runtimeClient';
import {
  generateQualityCheckedAssistantReply,
  shouldAllowBracketActions,
} from '../../services/ai/outputQuality';
import { buildChatPrompt } from '../../services/ai/prompts/builders/buildChatPrompt';
import { buildSummaryPrompt } from '../../services/ai/prompts/builders/buildSummaryPrompt';
import { buildChatSceneInput } from '../../services/scene-inputs/buildChatSceneInput';
import { buildAutoLongTermRefreshPlan } from '../../services/memory/autoLongTermRefreshPlan';
import { buildAutoSummarySourceLines, sanitizeAutoSummaryText } from '../../services/memory/autoSummaryHygiene';
import { buildLongTermMemoryProfile } from '../../services/memory/buildLongTermMemoryProfile';
import { compressShortTermSummaryAfterLongTerm } from '../../services/memory/buildShortTermSummary';
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
import { decideTransferOutcome, generateTransferEventReaction } from '../../services/chat/decideTransferOutcome';
import { handleCommandTriggeredMomentPublish, maybeAutoPublishMoment } from '../../services/moments/orchestrator';
import { getMessageMainText, getSummaryHistoryWindow } from '../../utils';
import { MOCK_CARDS, MOCK_TRANSACTIONS } from '../../components/wallet/WalletApp/mockData';
import { useSessionRuntimeCore } from './useSessionRuntimeCore';
import type { BaseSessionRuntimeState } from './types';

const TRANSFER_BRACKET_REGEX = /\[转账\s*([\d.]+)\]/i;
const TRANSFER_BLOCK_REGEX = /\[transfer\]\s*([\d.]+)\s*\[\/transfer\]/i;
const TRANSFER_PIPE_REGEX = /^TRANSFER\|([\d.]+)\|([\s\S]*)$/i;

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

function toPromptHistoryContent(message: ChatMessage): string {
  if (message.audioUrl) {
    const transcript = message.audioTranscript?.trim();
    return transcript
      ? `[sent a voice message; transcript: ${transcript}]`
      : '[sent a voice message]';
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

  return cappedWindow.slice(-Math.min(historyLimit, 6));
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
  const parts = splitDirectAssistantReplyText(mainText, options.maxDirectReplyBubbles);
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
      ...(index === parts.length - 1 && legacyTranslationParts.translation ? { translation: legacyTranslationParts.translation } : {}),
      timestamp: baseTimestamp + index,
    };
  });

  const visibleMessages = mappedMessages.filter((message) => (message.text || '').trim().length > 0 || !!message.imageUrl);
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
  requestManualReply: () => void;
  handleVoiceCallAIResponse: (userText: string) => Promise<string | null>;
  sendImageMessage: (base64String: string) => void;
  sendAudioMessage: (audioUrl: string, audioMimeType: string, durationSeconds?: number, audioTranscript?: string) => void;
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
  const activeAssistantRenderCountRef = useRef(0);
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
        const replaceAssistantMessages = (messages: ChatMessage[], text: string): ChatMessage[] => {
          const displayText = parseAvatarActionBlock(text).displayText;
          const shouldRecallPrevious = hasDirectRecallCue(displayText, {
            assistantAliases: [character.name, character.remarkName?.trim() || ''],
            maxDirectReplyBubbles: resolveCharacterReplyBubbleLimit(character),
          });
          const nextAssistantMessages = splitStreamingModelResponseIntoMessages(displayText, assistantMsgId, {
            transferTargetLabel: userName,
            assistantAliases: [character.name, character.remarkName?.trim() || ''],
            availableStickers: character.stickers || [],
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
          const historyLimit = character.memoryLimit || 20;
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
              buildDirectResumeModePrompt(characterTemporalState.continuityMode),
              ...(chatSceneInput.sections || []),
              mode === 'proactive' ? DIRECT_PROACTIVE_SPEAKING_PROMPT : '',
              buildDirectActionDescriptionPrompt(character.actionDescriptionEnabled, character.characterActionDescriptionEnabled),
              'Optional lightweight action cues are allowed when useful: "[reply: 你] text", "[reply: 刚才那句] text", "[recall] text", or a separate line "[sticker] caption". Sticker cues can be a standalone reaction or follow a text line. Use them sparingly and only when they help the chat feel more alive.',
              buildAvatarActionPromptSection(character, historySnapshot),
              buildAutonomousAvatarLibraryPromptSection(character),
              buildAssistantStickerPromptSection(character.stickers || []),
            ].filter(Boolean),
          });

          const runtimeMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...historyWindow.map(m => ({
              role: m.role === 'user' ? 'user' as const : 'assistant' as const,
              content: toPromptHistoryContent(m),
              ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
              ...(m.audioUrl ? { audioUrl: m.audioUrl, audioMimeType: m.audioMimeType } : {}),
            })),
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

          currentResponseText = qualityResult.cleanedText;
          const avatarActionResult = parseAvatarActionBlock(currentResponseText);
          currentResponseText = avatarActionResult.displayText;
          latestHistory = replaceAssistantMessages(latestHistory, currentResponseText);
          setHistory(latestHistory);
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
  }, [activeConfig, applyAvatarAction, character, chatGroups, coupleSpace, directChatHistory, masks, perception, runGeneration, setHistory, userName, worldBook]);

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

    if (typeof overrideText !== 'string' && !overridePayload) {
      setInput('');
    }

    setReplyingTo(null);

    if (!character.autoReplyEnabled && !overridePayload?.forceReply) {
      return;
    }

    const isInnerVoiceRequest = overridePayload?.isInnerVoice || textToSend.trim() === '[倾听心声]';
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
        availableStickers: character.stickers || [],
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
        activeAssistantRenderCountRef.current = 0;

        onPublishMoment?.({
          authorId: character.id,
          content: commandMomentResult.momentContent,
          imageCard: commandMomentResult.momentImageCard,
        });
        lastMomentPublishAtRef.current = Date.now();
        return;
      }

      const historyLimit = character.memoryLimit || 20;
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
          buildDirectResumeModePrompt(characterTemporalState.continuityMode),
          ...(chatSceneInput.sections || []),
          buildDirectActionDescriptionPrompt(character.actionDescriptionEnabled, character.characterActionDescriptionEnabled),
          'Optional lightweight action cues are allowed when useful: "[reply: 你] text", "[reply: 刚才那句] text", "[recall] text", or a separate line "[sticker] caption". Sticker cues can be a standalone reaction or follow a text line. Use them sparingly and only when they help the chat feel more alive.',
          buildAvatarActionPromptSection(character, newHistory),
          buildAutonomousAvatarLibraryPromptSection(character),
          buildAssistantStickerPromptSection(character.stickers || []),
        ].filter(Boolean),
      });

      const runtimeMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...historyWindow.map(m => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: toPromptHistoryContent(m),
          ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
          ...(m.audioUrl ? { audioUrl: m.audioUrl, audioMimeType: m.audioMimeType } : {}),
        })),
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

      currentResponseText = qualityResult.cleanedText;
      currentResponseText = stripPseudoMomentPrefix(currentResponseText);
      const avatarActionResult = parseAvatarActionBlock(currentResponseText);
      currentResponseText = avatarActionResult.displayText;
      const finalHistory = replaceAssistantMessages(newHistory, currentResponseText);
      setHistory(finalHistory);
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

            const patch: Partial<Character> = {
              shortTermSummary: nextShortTermSummary,
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
        activeAssistantRenderCountRef.current = 0;
      }
    }
    });
  }, [activeConfig, applyAvatarAction, character, chatGroups, coupleSpace, directChatHistory, history, input, masks, onPatchCharacter, onPublishMoment, onUpdateCharacter, perception, replyingTo, setHistory, setInput, setReplyingTo, userName, worldBook]);

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

  const sendAudioMessage = useCallback((audioUrl: string, audioMimeType: string, durationSeconds?: number, audioTranscript?: string) => {
    void handleSendRef.current({
      promptText: audioTranscript?.trim()
        ? `[sent a voice message; transcript: ${audioTranscript.trim()}]`
        : '[sent a voice message]',
      userText: '[audio]',
      audioUrl,
      audioMimeType,
      ...(audioTranscript?.trim() ? { audioTranscript: audioTranscript.trim() } : {}),
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









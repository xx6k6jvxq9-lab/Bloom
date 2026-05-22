import { useCallback, useEffect, useRef } from 'react';
import type {
  ApiConfig,
  AppSettings,
  AssistantReplyEnvelope,
  AssistantReplyEnvelopeTextItem,
  CallRecord,
  Character,
  ChatGroup,
  ChatHistory,
  ChatMessage,
  ChatMessageContentType,
  CoupleSpaceData,
  FavoriteMessage,
  FriendRequest,
  Mask,
  MomentImageCard,
  MomentSourceImageRef,
  PerceptionSettings,
  WalletData,
  WorldBookEntry,
} from '../../types';
import {
  evaluateAssistantOutput,
  generateQualityCheckedAssistantReply,
  shouldAllowBracketActions,
} from '../../services/ai/outputQuality';
import {
  STRUCTURED_ASSISTANT_REPLY_TOKEN,
  parseStructuredAssistantReplyEnvelope,
  normalizeStructuredAssistantReplyToLegacyFormat,
  serializeStructuredAssistantReplyEnvelope,
  streamStructuredAssistantReply,
} from '../../services/ai/assistantReplyEnvelope';
import type { RuntimeChatMessage } from '../../services/ai/runtimeClient';
import { buildChatPrompt } from '../../services/ai/prompts/builders/buildChatPrompt';
import { buildReplyLanguageRules } from '../../services/ai/prompts/base/languageRules';
import { buildChatSceneInput } from '../../services/scene-inputs/buildChatSceneInput';
import { findNearestChatMemorySnapshot } from '../../services/memory/chatMemoryTimeline';
import { getDirectMemoryMessageLimit } from '../../services/memory/memoryWindowLimits';
import { buildResolvedOpenLoopRegistry } from '../../services/memory/buildResolvedOpenLoopRegistry';
import { buildCharacterTemporalState } from '../../services/relationship-time/buildCharacterTemporalState';
import { buildTemporalContextPrompt } from '../../services/relationship-time/buildTemporalContextPrompt';
import { buildCharacterContext } from '../../services/relationship-context/buildCharacterContext';
import { buildPersistedSharedCharacterState } from '../../services/relationship-context/buildSharedCharacterState';
import { buildCoupleSpaceInviteContext } from '../../services/couple-space/invite/buildCoupleSpaceInviteContext';
import { generateCoupleSpaceInviteReply } from '../../services/couple-space/invite/generateCoupleSpaceInviteReply';
import {
  copyMessageText,
  createForwardText,
  getMessageActionText,
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
  type DirectUserIntentAnalysis,
} from '../../services/chat/intentAnalysis';
import {
  analyzeDirectCharacterDecision,
  applyDirectTransferBridge,
  buildDirectCharacterDecisionPromptSection,
  type DirectCharacterDecision,
} from '../../services/chat/directCharacterDecision';
import { buildDirectContextLayers } from '../../services/chat/buildDirectContextLayers';
import { buildOpenLoopRegistryPrompt } from '../../services/chat/buildOpenLoopRegistry';
import { reconcileCharacterRuntimeState } from '../../services/chat/reconcileCharacterRuntimeState';
import {
  isDisplayableAssistantBubbleText,
  splitDirectAssistantReplyText,
  stripAssistantSpeakerPrefix,
} from '../../services/chat/assistantText';
import {
  buildAssistantStickerPromptSection,
  pickAssistantSticker,
  resolveAssistantStickerCandidates,
  type AssistantStickerContext,
} from '../../services/chat/assistantStickerPicker';
import { getStickerMetadata } from '../../services/chat/stickerMetadata';
import {
  generateLightInteraction,
  parseLightInteractionResult,
} from '../../services/chat/generateLightInteraction';
import type { LightInteractionResult } from '../../services/chat/lightInteractionTypes';
import {
  extractTransferAmountText as extractTransferAmount,
  formatTransferMessageForContext,
} from '../../services/chat/transferContextText';
import {
  createRelationshipSystemMessage,
  getCharacterBlockState,
  supersedePendingCharacterRequests,
} from '../contacts/contactRelationship';
import {
  createBlockedDeliveryMessage,
  getDirectChatBlockedComposerError,
  getDirectChatBlockedManualReplyError,
} from './directChatDelivery';
import {
  buildCharacterAvatarPatchFromAction,
  parseAvatarActionPayload,
  resolveAvatarCandidateFromAction,
  shouldOfferAvatarActionForCharacter,
  type ParsedAvatarAction,
} from '../../services/chat/avatarActions';
import {
  buildAvatarOfferReplyPromptSection,
  evaluateDirectAvatarOfferDecision,
  type AvatarOfferDecisionReview,
} from '../../services/chat/avatarOfferDecision';
import {
  buildAvatarLibraryDecisionReplyPromptSection,
  evaluateAvatarLibraryDecision,
  type AvatarLibraryDecisionReview,
} from '../../services/chat/avatarLibraryDecision';
import {
  isPendingAvatarConfirmationExpired,
  resolveAvatarConfirmationFromMessages,
} from '../../services/chat/avatarConfirmation';
import { describeStickerMessageForPrompt, inferStickerSemanticLabel } from '../../services/chat/stickerSemantics';
import {
  analyzeDirectRelationshipBoundary,
  generateDirectRelationshipBoundaryReply,
} from '../../services/chat/directRelationshipBoundary';
import { getLegacyTranslationParts, normalizeBracketActionTextForPrompt, sanitizePipeMarkers } from '../../services/chat/messageText';
import { isUsableChatText, normalizeChatPunctuationNoise } from '../../services/chat/messageHygiene';
import { decideTransferOutcome, generateTransferEventReaction } from '../../services/chat/decideTransferOutcome';
import { collectRecentDirectPokeState } from '../../services/chat/lightInteractionHistory';
import {
  buildDirectProactivePokeProtocolPrompt,
  evaluateDirectProactivePokeGate,
  extractDirectProactiveLightInteractionPayload,
} from '../../services/chat/directProactiveLightInteraction';
import { handleCommandTriggeredMomentPublish, maybeAutoPublishMoment } from '../../services/moments/orchestrator';
import { extractRecentMomentImageReferences } from '../../services/moments/momentRecentImageReferences';
import { resolveSceneTextApiConfig, resolveSceneVoiceApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import { synthesizeTtsAudio } from '../../services/ai/apiCenter/synthesizeTtsAudio';
import { getMessageMainText } from '../../utils';
import { MOCK_CARDS } from '../../components/wallet/WalletApp/mockData';
import { cacheRemoteAsset, saveUploadedDataUrl } from '../persistence/persistentAssetService';
import {
  createRelationshipEventThreadEntry,
} from '../contacts/relationshipFlow';
import {
  markRelationshipRoundAbandoned,
  resolveRelationshipRoundForWrite,
} from '../contacts/friendRequestThreads';
import { useSessionRuntimeCore } from './useSessionRuntimeCore';
import { hasOpenedCoupleSpaceForCharacter } from './coupleSpaceInviteGuard';
import type { BaseSessionRuntimeState } from './types';

const TRANSFER_BRACKET_REGEX = /\[转账\s*([\d.]+)\]/i;
const TRANSFER_BLOCK_REGEX = /\[transfer\]\s*([\d.]+)\s*\[\/transfer\]/i;
const TRANSFER_PIPE_REGEX = /^TRANSFER\|([\d.]+)\|([\s\S]*)$/i;
const COUPLE_SPACE_INVITE_TOKEN = '[COUPLE_SPACE_INVITE]';
const COUPLE_SPACE_INVITE_ACCEPTED_TOKEN = '[COUPLE_SPACE_INVITE_ACCEPTED]';
const GAME_CARD_FAILURE_TOKEN = '[GAME_CARD_ERROR]';
const CJK_TEXT_REGEX = /[\u4e00-\u9fff]/u;
const LATIN_TOKEN_REGEX = /[A-Za-z]{2,}/g;
const VOICE_REPLY_INTENT_REGEX = /语音|声音|发语音|听你|听听|说话|语音消息|voice|audio|listen|speak|call/i;
const EXPRESSIVE_VOICE_REPLY_REGEX = /[!?？！~～…]/;
const VOICE_COMFORT_REGEX = /抱抱|乖|不哭|别怕|没事|慢慢|陪你|哄你|安慰|亲亲|摸摸|给你听|陪着你/i;
const VOICE_WARMTH_REGEX = /晚安|早安|想你|喜欢|爱你|梦里|快睡|早点睡|早点休息|困了|想抱|好乖|亲爱的/i;
const VOICE_FLIRTY_REGEX = /脸红|害羞|坏蛋|黏你|想亲|想抱|撒娇|听我|想听你|可爱死了/i;
const VOICE_FORMAL_BLOCK_REGEX = /(?:^|\n)(?:1\.|2\.|3\.|第一|第二|第三|步骤|总结|方案|注意事项|操作说明)/i;
const VOICE_EXPLANATORY_BLOCK_REGEX = /因为|所以|如果|但是|首先|其次|然后|另外|总之|总结一下/;
const MAX_MIXED_VOICE_REPLY_LENGTH = 96;
const RECENT_VOICE_WINDOW_MESSAGES = 6;

type DirectVoiceCadenceStats = {
  recentModelMessageCount: number;
  recentVoiceMessageCount: number;
  messagesSinceLastVoice: number | null;
  consecutiveRecentVoiceMessages: number;
};

function isGameCardText(value: string | null | undefined): boolean {
  return (value?.trim() || '').startsWith('[GAME_CARD]');
}

function resolveChatMessageContentType(params: {
  text?: string | null;
  isInnerVoice?: boolean;
  transferStatus?: ChatMessage['transferStatus'];
}): ChatMessageContentType | undefined {
  const trimmedText = params.text?.trim() || '';

  if (params.isInnerVoice) {
    return 'inner-voice';
  }

  if (trimmedText === GAME_CARD_FAILURE_TOKEN) {
    return 'game-card-error';
  }

  if (isGameCardText(trimmedText)) {
    return 'game-card';
  }

  if (trimmedText === COUPLE_SPACE_INVITE_TOKEN) {
    return 'couple-space-invite';
  }

  if (trimmedText === COUPLE_SPACE_INVITE_ACCEPTED_TOKEN) {
    return 'couple-space-invite-accepted';
  }

  if (params.transferStatus || parseTransferProtocol(trimmedText)) {
    return 'transfer';
  }

  return trimmedText ? 'text' : undefined;
}

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

  if (character.replyLanguageMode === 'follow-user') {
    return false;
  }

  if (character.replyLanguageMode === 'chinese-with-native-flavor') {
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
    '如果这轮使用了协议型输出（例如 `GAME_CARD`），也要把翻译放在协议正文之后，用 `---TRANSLATION---` 分隔，不要把翻译塞进 JSON 字段里。',
    '翻译部分只做自然中文转写，不要补充解释、注释、语言标签、括号说明或额外寒暄。',
    '如果正文被拆成多条短气泡，翻译部分也必须按完全相同的气泡顺序输出，并使用 `|||` 分隔每一条对应翻译。',
    '如果你不确定如何把翻译一一对应到多个气泡，请优先把正文控制成一个气泡，再给出一整段对应翻译，不要出现“正文拆开了但翻译只剩一部分”的情况。',
    '除 `---TRANSLATION---` 这条分隔线外，不要输出任何额外格式标记。',
  ].join('\n');
}

function buildStructuredAssistantReplyPrompt(character: Character): string {
  const targetLanguage = character.replyLanguageMode === 'fixed'
    ? (character.fixedReplyLanguage?.trim() || character.nativeLanguage?.trim() || '角色设定语言')
    : (character.nativeLanguage?.trim() || '角色母语');

  return [
    '## 统一回复协议',
    `如果本轮需要输出任何可显示内容，优先只输出一个可机读协议，格式固定为：${STRUCTURED_ASSISTANT_REPLY_TOKEN} {"items":[...]}`,
    `普通正文 item 的格式固定为：{"kind":"text","text":"${targetLanguage} 正文","translation":"对应的简体中文"}。`,
    'items 的顺序就是最终显示顺序；如果本轮需要多个聊天气泡，就写多个 text item，不要把多段正文硬塞进一个字段里。',
    `text 必须是角色真正会发出的 ${targetLanguage} 正文；translation 必须是与该 text 严格对应的简体中文。`,
    '如果需要 [reply: ...]、[recall] 或 [sticker] 这类轻量 cue，把 cue 写在 text 字段里，不要额外解释。',
    '如果需要 GAME_CARD，使用：{"kind":"game_card","payload":{...},"translation":"对应简体中文"}。game_card 是整轮唯一主体，不要再混入普通 text、transfer 或额外说明。',
    '如果需要转账，使用：{"kind":"transfer","amount":"88.00"}。金额只保留数字和小数点，不要再写旧的 TRANSFER|...|... 变体。',
    '如果需要情侣空间事件 token，使用：{"kind":"token","name":"COUPLE_SPACE_INVITE_ACCEPTED"}。',
    '不要输出 Markdown 代码块，不要输出解释、注释、语言标签或额外字段。',
    '只要本轮存在普通正文 text item，就必须给每个 text item 填 translation，不要改回旧的 ---TRANSLATION--- 写法。',
  ].join('\n');
}

function shouldRequireGameCardTranslation(text: string): boolean {
  const gameCard = parseGameCardData(text, { silent: true });
  if (!gameCard) {
    return false;
  }

  const combined = [
    typeof gameCard.question === 'string' ? gameCard.question.trim() : '',
    typeof gameCard.content === 'string' ? gameCard.content.trim() : '',
  ]
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!combined) {
    return false;
  }

  if (CJK_TEXT_REGEX.test(combined)) {
    return false;
  }

  return (combined.match(LATIN_TOKEN_REGEX)?.length ?? 0) > 0;
}

function hasRequiredDirectReplyTranslation(text: string): boolean {
  const normalizedText = normalizeStructuredAssistantReplyToLegacyFormat(text);
  const { mainText, translation } = getLegacyTranslationParts(normalizedText);
  const visibleMainText = stripCoupleSpaceTokens(stripTransferProtocolText(mainText)).trim();

  if (!visibleMainText) {
    return true;
  }

  if (
    visibleMainText.startsWith('[GAME_CARD]')
  ) {
    return !shouldRequireGameCardTranslation(visibleMainText) || translation.trim().length > 0;
  }

  if (
    visibleMainText === COUPLE_SPACE_INVITE_TOKEN
    || visibleMainText === COUPLE_SPACE_INVITE_ACCEPTED_TOKEN
  ) {
    return true;
  }

  return translation.trim().length > 0;
}

function buildStructuredTextReplyPayload(items: AssistantReplyEnvelopeTextItem[]): {
  mainText: string;
  translationText: string;
} {
  return {
    mainText: items.map((item) => item.text.trim()).filter(Boolean).join('\n').trim(),
    translationText: items.map((item) => item.translation?.trim() || '').filter(Boolean).join(' ||| ').trim(),
  };
}

function applyStructuredGameCardBridge(params: {
  envelope: AssistantReplyEnvelope;
  latestUserMessage: ChatMessage | null | undefined;
}): AssistantReplyEnvelope {
  const { envelope, latestUserMessage } = params;
  if (!latestUserMessage) {
    return envelope;
  }

  if (envelope.items.some((item) => item.kind === 'game_card')) {
    return envelope;
  }

  const shouldInspectGameCard =
    latestUserMessage.contentType === 'game-card'
    || isGameCardText(latestUserMessage.text || '');
  if (!shouldInspectGameCard) {
    return envelope;
  }

  const textItems = envelope.items.filter((item): item is AssistantReplyEnvelopeTextItem => item.kind === 'text');
  if (textItems.length === 0 || textItems.length !== envelope.items.length) {
    return envelope;
  }

  const { mainText, translationText } = buildStructuredTextReplyPayload(textItems);
  if (!mainText) {
    return envelope;
  }

  const gameData = parseGameCardData(latestUserMessage.text || '', { silent: true });
  const responseType = resolveGameCardReplyType(gameData);
  if (!gameData || !responseType) {
    return envelope;
  }

  const bridgedCard = {
    game: gameData.game,
    type: responseType,
    ...(typeof gameData.question === 'string' && gameData.question.trim()
      ? { question: gameData.question.trim() }
      : {}),
    content: mainText,
  };

  const latestCardTranslation = (
    latestUserMessage.translation?.trim()
    || getLegacyTranslationParts(latestUserMessage.text || '').translation.trim()
  );
  const combinedTranslation =
    responseType === 'answer' && latestCardTranslation && translationText
      ? `${latestCardTranslation}---${translationText}`
      : translationText;

  return {
    items: [{
      kind: 'game_card',
      payload: bridgedCard,
      ...(combinedTranslation ? { translation: combinedTranslation } : {}),
    }],
  };
}

function applyStructuredCoupleSpaceBridge(params: {
  envelope: AssistantReplyEnvelope;
  latestUserMessage: ChatMessage | null | undefined;
}): AssistantReplyEnvelope {
  const { envelope, latestUserMessage } = params;
  if ((latestUserMessage?.text || '').trim() !== COUPLE_SPACE_INVITE_TOKEN) {
    return envelope;
  }

  if (envelope.items.some((item) => item.kind === 'token' && item.name === 'COUPLE_SPACE_INVITE_ACCEPTED')) {
    return envelope;
  }

  return {
    items: [
      ...envelope.items,
      {
        kind: 'token',
        name: 'COUPLE_SPACE_INVITE_ACCEPTED',
      },
    ],
  };
}

function applyStructuredTransferBridge(params: {
  envelope: AssistantReplyEnvelope;
  intentAnalysis: DirectUserIntentAnalysis | null;
  decision: DirectCharacterDecision | null;
}): AssistantReplyEnvelope {
  const { envelope, intentAnalysis, decision } = params;
  if (!intentAnalysis || !decision || decision.requestedAmount == null) {
    return envelope;
  }

  if (envelope.items.some((item) => item.kind === 'transfer')) {
    return envelope;
  }

  const legacyText = normalizeStructuredAssistantReplyToLegacyFormat(
    serializeStructuredAssistantReplyEnvelope(envelope),
  );
  const bridgedLegacyText = applyDirectTransferBridge({
    replyText: legacyText,
    intentAnalysis,
    decision,
  });

  if (bridgedLegacyText === legacyText) {
    return envelope;
  }

  return {
    items: [
      ...envelope.items,
      {
        kind: 'transfer',
        amount: decision.requestedAmount.toFixed(2),
      },
    ],
  };
}

function applyStructuredDirectReplyBridges(params: {
  envelope: AssistantReplyEnvelope;
  latestUserMessage: ChatMessage | null | undefined;
  intentAnalysis: DirectUserIntentAnalysis | null;
  decision: DirectCharacterDecision | null;
}): AssistantReplyEnvelope {
  const gameCardBridged = applyStructuredGameCardBridge({
    envelope: params.envelope,
    latestUserMessage: params.latestUserMessage,
  });
  const coupleSpaceBridged = applyStructuredCoupleSpaceBridge({
    envelope: gameCardBridged,
    latestUserMessage: params.latestUserMessage,
  });
  return applyStructuredTransferBridge({
    envelope: coupleSpaceBridged,
    intentAnalysis: params.intentAnalysis,
    decision: params.decision,
  });
}

function resolveDirectReplyDisplayPayload(params: {
  replyText: string;
  latestUserMessage: ChatMessage | null | undefined;
  intentAnalysis: DirectUserIntentAnalysis | null;
  decision: DirectCharacterDecision | null;
}): {
  legacyText: string;
  structuredRawText: string | null;
} {
  const structuredEnvelope = parseStructuredAssistantReplyEnvelope(params.replyText);
  if (structuredEnvelope) {
    const bridgedEnvelope = applyStructuredDirectReplyBridges({
      envelope: structuredEnvelope,
      latestUserMessage: params.latestUserMessage,
      intentAnalysis: params.intentAnalysis,
      decision: params.decision,
    });
    const structuredRawText = serializeStructuredAssistantReplyEnvelope(bridgedEnvelope);
    return {
      legacyText: normalizeStructuredAssistantReplyToLegacyFormat(structuredRawText),
      structuredRawText,
    };
  }

  const gameCardBridgedText = applyDirectGameCardBridge({
    replyText: params.replyText,
    latestUserMessage: params.latestUserMessage,
  });
  const coupleSpaceBridgedText = applyDirectCoupleSpaceBridge({
    replyText: gameCardBridgedText,
    latestUserMessage: params.latestUserMessage,
  });
  return {
    legacyText: applyDirectTransferBridge({
      replyText: coupleSpaceBridgedText,
      intentAnalysis: params.intentAnalysis,
      decision: params.decision,
    }),
    structuredRawText: null,
  };
}

export type DirectReplyBubbleRange = {
  minReplies: number;
  maxReplies: number;
};

type DirectReplyBubbleInspectionOptions = {
  assistantAliases?: string[];
  availableStickers?: string[];
  stickerContext?: Pick<AssistantStickerContext, 'recentStickerRefs' | 'recentStickerLabels' | 'lastOwnMessageWasSticker' | 'stickerMetadataMap'>;
  currentHistory?: ChatMessage[];
  userLabel?: string;
  modelLabel?: string;
};

export function resolveCharacterReplyBubbleRange(
  character: Pick<Character, 'minReplies' | 'maxReplies'>,
): DirectReplyBubbleRange {
  const rawMin = Number.isFinite(character.minReplies) ? Math.floor(character.minReplies as number) : 1;
  const minReplies = Math.max(1, Math.min(rawMin, 10));
  const rawMax = Number.isFinite(character.maxReplies) ? Math.floor(character.maxReplies as number) : 3;
  const maxReplies = Math.max(minReplies, Math.min(rawMax, 10));
  return { minReplies, maxReplies };
}

function shouldEnforceDirectReplyBubbleMinimum(range: DirectReplyBubbleRange): boolean {
  return range.minReplies > 1;
}

function buildDirectReplyBubbleRangePrompt(range: DirectReplyBubbleRange): string {
  const rangeText = range.minReplies === range.maxReplies
    ? `${range.minReplies} 条`
    : `${range.minReplies} 到 ${range.maxReplies} 条`;

  const minimumRule = range.minReplies > 1
    ? `这不是风格建议，而是本轮必须满足的显示条数约束：至少 ${range.minReplies} 条。就算一句或两句已经能成立，也不要停在 1 到 2 条。`
    : '当前最少条数允许为 1 条；如果一句已经成立，不需要为了凑数硬拆。';

  return [
    '## 单次回复条数硬约束',
    `当前角色设置要求本轮可显示聊天气泡控制在 ${rangeText}。`,
    minimumRule,
    `最多不要超过 ${range.maxReplies} 条。`,
    '如果一句话本身可以自然拆成“先接一句、再补一句、再压一句情绪或再追一句问句”，就拆开成多个短气泡。',
    '如果使用统一回复协议，每个 text item 只对应一个最终显示气泡，不要把多条聊天内容塞进同一个 text item 里。',
  ].join('\n');
}

function buildDirectReplyBubbleRepairInstruction(params: {
  range: DirectReplyBubbleRange;
  currentBubbleCount: number;
  requireInlineTranslation: boolean;
}): string {
  const { range, currentBubbleCount, requireInlineTranslation } = params;
  const targetBubbleCount = currentBubbleCount < range.minReplies ? range.minReplies : range.maxReplies;

  return [
    '上一版回复的可显示聊天气泡数量不符合当前角色设置，请立刻重写。',
    `当前必须输出 ${targetBubbleCount} 条可显示聊天气泡。`,
    `允许范围是 ${range.minReplies} 到 ${range.maxReplies} 条，不要再回成 ${currentBubbleCount} 条。`,
    '保持同一角色、同一关系状态、同一事件推进和大致同一意思，不要改成解释文、总结文或说明文。',
    '优先输出 [ASSISTANT_REPLY] {"items":[...]}；每个 text item 只放一个最终气泡，不要把多条聊天内容塞进同一个 text item。',
    requireInlineTranslation
      ? '每个 text item 都必须保留对应的简体中文 translation，顺序要一一对应。'
      : '每个 text item 都必须像真实聊天里会单独发出去的一条短消息。',
  ].join('\n');
}

export function inspectDirectReplyBubbleCount(
  replyText: string,
  options: DirectReplyBubbleInspectionOptions = {},
): {
  bubbleCount: number;
  hasSpecialContent: boolean;
} {
  const messages = splitStreamingModelResponseIntoMessages(replyText, 0, {
    assistantAliases: options.assistantAliases,
    availableStickers: options.availableStickers,
    stickerContext: options.stickerContext,
    currentHistory: options.currentHistory,
    userLabel: options.userLabel,
    modelLabel: options.modelLabel,
    maxDirectReplyBubbles: 10,
  });

  let bubbleCount = 0;
  let hasSpecialContent = false;

  messages.forEach((message) => {
    if (
      message.contentType === 'game-card'
      || message.contentType === 'transfer'
      || message.contentType === 'couple-space-invite'
      || message.contentType === 'couple-space-invite-accepted'
    ) {
      hasSpecialContent = true;
      return;
    }

    bubbleCount += 1;
  });

  return {
    bubbleCount,
    hasSpecialContent,
  };
}

function createMomentPublishedSystemMessage(characterName: string, timestamp: number): ChatMessage {
  return {
    role: 'model',
    text: `${characterName} 更新了一条动态`,
    timestamp,
    isSystem: true,
  };
}

function appendSystemMessageIfNotDuplicate(messages: ChatMessage[], text: string): ChatMessage[] {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return messages;
  }

  const latestMessage = messages[messages.length - 1];
  if (
    latestMessage?.role === 'model'
    && latestMessage.isSystem
    && latestMessage.text.trim() === normalizedText
  ) {
    return messages;
  }

  return [
    ...messages,
    {
      role: 'model',
      text: normalizedText,
      timestamp: Date.now(),
      isSystem: true,
    },
  ];
}

function shouldApplyCharacterTts(character: Character) {
  return character.voiceProfile?.enabled === true;
}

function normalizeCharacterVoiceReplyMode(
  mode: Character['voiceProfile'] extends { replyMode?: infer Mode } ? Mode : 'text' | 'mixed' | 'voice' | undefined,
) : 'mixed' | 'voice' {
  return mode === 'text' || !mode ? 'mixed' : mode;
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

function isEligibleDirectReplyMessageForAudio(message: ChatMessage) {
  const cleanText = message.text?.trim() || '';
  if (
    !cleanText
    || message.role !== 'model'
    || message.isSystem
    || message.isRecalled
    || !!message.audioUrl
    || message.contentType === 'game-card'
    || message.contentType === 'game-card-error'
    || message.contentType === 'transfer'
    || message.contentType === 'couple-space-invite'
    || message.contentType === 'couple-space-invite-accepted'
    || cleanText.startsWith('[GAME_CARD]')
    || cleanText.startsWith('[COUPLE_SPACE_INVITE')
    || cleanText.startsWith('[transfer]')
    || /^\[转账\s*[\d.]+\]/.test(cleanText)
    || /^TRANSFER\|[\d.]+\|/i.test(cleanText)
  ) {
    return false;
  }

  return true;
}

function hashStringToUnitInterval(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 10000) / 10000;
}

function getDirectVoiceCadenceStats(
  messages: ChatMessage[],
  currentTimestamp: number,
): DirectVoiceCadenceStats {
  const recentModelMessages = messages
    .filter((message) => (
      message.role === 'model'
      && !message.isSystem
      && !message.isRecalled
      && message.timestamp < currentTimestamp
    ))
    .slice(-RECENT_VOICE_WINDOW_MESSAGES);

  const recentVoiceMessageCount = recentModelMessages.filter((message) => !!message.audioUrl).length;
  let messagesSinceLastVoice: number | null = null;
  for (let index = recentModelMessages.length - 1; index >= 0; index -= 1) {
    if (recentModelMessages[index].audioUrl) {
      messagesSinceLastVoice = recentModelMessages.length - 1 - index;
      break;
    }
  }

  let consecutiveRecentVoiceMessages = 0;
  for (let index = recentModelMessages.length - 1; index >= 0; index -= 1) {
    if (!recentModelMessages[index].audioUrl) {
      break;
    }
    consecutiveRecentVoiceMessages += 1;
  }

  return {
    recentModelMessageCount: recentModelMessages.length,
    recentVoiceMessageCount,
    messagesSinceLastVoice,
    consecutiveRecentVoiceMessages,
  };
}

function shouldAutoGenerateDirectReplyAudio(
  character: Character,
  message: ChatMessage,
  latestUserText: string,
  messages: ChatMessage[],
) {
  if (!shouldApplyCharacterTts(character) || !isEligibleDirectReplyMessageForAudio(message)) {
    return false;
  }

  const replyMode = normalizeCharacterVoiceReplyMode(character.voiceProfile?.replyMode);
  if (replyMode === 'voice') {
    return true;
  }

  const cleanReplyText = message.text.trim();
  const cleanUserText = latestUserText.trim();
  const cadenceStats = getDirectVoiceCadenceStats(messages, message.timestamp);
  const explicitVoiceRequest = VOICE_REPLY_INTENT_REGEX.test(cleanUserText);
  const comfortSignal = VOICE_COMFORT_REGEX.test(cleanUserText) || VOICE_COMFORT_REGEX.test(cleanReplyText);
  const warmSignal = VOICE_WARMTH_REGEX.test(cleanUserText) || VOICE_WARMTH_REGEX.test(cleanReplyText);
  const flirtySignal = VOICE_FLIRTY_REGEX.test(cleanUserText) || VOICE_FLIRTY_REGEX.test(cleanReplyText);
  const conciseReply = cleanReplyText.length <= 28;
  const replyHasTranslation = !!message.translation?.trim();
  const hasFormalStructure = VOICE_FORMAL_BLOCK_REGEX.test(cleanReplyText);
  const hasExplanatoryStructure = VOICE_EXPLANATORY_BLOCK_REGEX.test(cleanReplyText) && cleanReplyText.length >= 42;

  if (!explicitVoiceRequest && cleanReplyText.length > MAX_MIXED_VOICE_REPLY_LENGTH) {
    return false;
  }

  if (!explicitVoiceRequest && hasFormalStructure) {
    return false;
  }

  if (
    !explicitVoiceRequest
    && cadenceStats.consecutiveRecentVoiceMessages >= 2
    && !comfortSignal
    && !warmSignal
    && !flirtySignal
  ) {
    return false;
  }

  if (
    explicitVoiceRequest
    && cleanReplyText.length <= MAX_MIXED_VOICE_REPLY_LENGTH
    && cadenceStats.consecutiveRecentVoiceMessages < 3
  ) {
    return true;
  }

  if (
    conciseReply
    && (comfortSignal || warmSignal || flirtySignal)
    && cadenceStats.consecutiveRecentVoiceMessages === 0
  ) {
    return true;
  }

  let threshold = (
    character.voiceProfile?.replyFrequency === 'high'
      ? 0.72
      : character.voiceProfile?.replyFrequency === 'low'
        ? 0.2
        : 0.45
  );

  if (explicitVoiceRequest) {
    threshold = Math.max(threshold, 0.9);
  }
  if (comfortSignal) {
    threshold += 0.16;
  }
  if (warmSignal) {
    threshold += 0.14;
  }
  if (flirtySignal) {
    threshold += 0.1;
  }
  if (EXPRESSIVE_VOICE_REPLY_REGEX.test(cleanReplyText)) {
    threshold += 0.06;
  }
  if (conciseReply) {
    threshold += 0.06;
  }
  if (cleanReplyText.length >= 60) {
    threshold -= 0.08;
  }
  if (cleanReplyText.length >= 84) {
    threshold -= 0.12;
  }
  if (replyHasTranslation && cleanReplyText.length >= 36) {
    threshold -= 0.08;
  }
  if (hasExplanatoryStructure) {
    threshold -= 0.08;
  }

  if (cadenceStats.messagesSinceLastVoice === 0) {
    threshold -= 0.24;
  } else if (cadenceStats.messagesSinceLastVoice === 1) {
    threshold -= 0.14;
  } else if (cadenceStats.messagesSinceLastVoice !== null && cadenceStats.messagesSinceLastVoice >= 3) {
    threshold += 0.08;
  }

  if (
    cadenceStats.recentModelMessageCount >= 4
    && cadenceStats.recentVoiceMessageCount === 0
  ) {
    threshold += 0.12;
  } else if (
    cadenceStats.recentModelMessageCount >= 4
    && cadenceStats.recentVoiceMessageCount >= 3
  ) {
    threshold -= 0.14;
  }

  const normalizedThreshold = Math.max(0, Math.min(1, threshold));
  const decisionSeed = `${character.id}|${message.timestamp}|${cleanUserText}|${cleanReplyText}`;
  return hashStringToUnitInterval(decisionSeed) < normalizedThreshold;
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

function extractTrailingStickerCue(text: string): {
  mainText: string;
  stickerCue: string;
} | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(.*?)(?:\s+|\n+)\[(?:sticker|image|表情包|图片)\]\s*(.*)$/i);
  if (!match) {
    return null;
  }

  const mainText = match[1]?.trim() || '';
  if (!mainText) {
    return null;
  }

  return {
    mainText,
    stickerCue: match[2]?.trim() || '',
  };
}

function stripTrailingStickerCueFromTranslation(text: string | undefined): string {
  const normalized = sanitizePipeMarkers(text || '', '\n').trim();
  if (!normalized) {
    return '';
  }

  const extracted = extractTrailingStickerCue(normalized);
  if (extracted) {
    return extracted.mainText;
  }

  return normalized
    .replace(/\s*\[(?:sticker|image|表情包|图片|贴纸)\]\s*(?:sticker|image|表情包|图片|贴纸)?\s*$/i, '')
    .trim();
}

function expandDirectActionCues(
  segment: string,
  translationText?: string,
): Array<{
  kind: 'normal' | 'sticker' | 'reply' | 'recall';
  content: string;
  replyTargetName?: string;
  translation?: string;
}> {
  const cue = parseDirectActionCue(segment);
  const normalizedTranslation = translationText?.trim() || '';

  if (cue.kind === 'sticker' || cue.kind === 'recall') {
    return [{
      ...cue,
      ...(normalizedTranslation ? { translation: normalizedTranslation } : {}),
    }];
  }

  const trailingSticker = extractTrailingStickerCue(cue.content);
  if (!trailingSticker) {
    return [{
      ...cue,
      ...(normalizedTranslation ? { translation: normalizedTranslation } : {}),
    }];
  }

  const entries: Array<{
    kind: 'normal' | 'sticker' | 'reply' | 'recall';
    content: string;
    replyTargetName?: string;
    translation?: string;
  }> = [];
  const cleanedTranslation = stripTrailingStickerCueFromTranslation(normalizedTranslation);

  if (trailingSticker.mainText) {
    entries.push({
      ...cue,
      content: trailingSticker.mainText,
      ...(cleanedTranslation ? { translation: cleanedTranslation } : {}),
    });
  }

  entries.push({
    kind: 'sticker',
    content: trailingSticker.stickerCue,
  });

  return entries;
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
  return resolveCharacterReplyBubbleRange({
    minReplies: 1,
    maxReplies: character.maxReplies,
  }).maxReplies;
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
    userLabel: string;
    characterLabel: string;
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

  const transferContextText = formatTransferMessageForContext(message, {
    userLabel: options.userLabel,
    characterLabel: options.characterLabel,
  });
  if (transferContextText) {
    return `${prefix}${transferContextText}`;
  }

  const normalizedMessageText = message.location || message.sharedPost || message.sharedMallItem
    ? getMessageActionText(message)
    : message.text || '';

  if (message.role === 'user') {
    const userText = normalizeBracketActionTextForPrompt(normalizedMessageText);
    return isUsableChatText(userText) ? `${prefix}${normalizeChatPunctuationNoise(userText)}` : '';
  }

  return isUsableChatText(normalizedMessageText)
    ? `${prefix}${normalizeChatPunctuationNoise(normalizedMessageText)}`
    : '';
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
    && Boolean(message.text || message.imageUrl || message.audioUrl || message.location || message.sharedPost || message.sharedMallItem)
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
    .flatMap((part) => part.replace(/([。！？!?]+)/g, '$1\n').split(/\n+/))
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

export function splitStructuredAssistantReplyEnvelopeIntoMessages(
  text: string,
  baseTimestamp: number,
  options: {
    isInnerVoice?: boolean;
    transferTargetLabel?: string;
    assistantAliases?: string[];
    availableStickers?: string[];
    stickerContext?: Pick<AssistantStickerContext, 'recentStickerRefs' | 'recentStickerLabels' | 'lastOwnMessageWasSticker' | 'stickerMetadataMap'>;
    currentHistory?: ChatMessage[];
    userLabel?: string;
    modelLabel?: string;
  } = {},
): ChatMessage[] | null {
  const envelope = parseStructuredAssistantReplyEnvelope(text);
  if (!envelope) {
    return null;
  }

  if (options.isInnerVoice) {
    const textItems = envelope.items.filter((item): item is AssistantReplyEnvelopeTextItem => item.kind === 'text');
    const innerVoiceText = textItems.map((item) => item.text.trim()).filter(Boolean).join('\n').trim();
    const innerVoiceTranslation = textItems.map((item) => item.translation?.trim() || '').filter(Boolean).join(' ||| ').trim();
    const messages: ChatMessage[] = [];

    if (innerVoiceText) {
      messages.push({
        role: 'model',
        text: innerVoiceText,
        timestamp: baseTimestamp,
        isInnerVoice: true,
        contentType: 'inner-voice',
        ...(innerVoiceTranslation ? { translation: innerVoiceTranslation } : {}),
      });
    }

    envelope.items
      .filter((item): item is Extract<AssistantReplyEnvelope['items'][number], { kind: 'transfer' }> => item.kind === 'transfer')
      .forEach((item) => {
        messages.push({
          role: 'model',
          text: `[转账 ${item.amount}]`,
          timestamp: baseTimestamp + messages.length,
          transferStatus: 'pending',
          transferTargetLabel: options.transferTargetLabel,
          contentType: 'transfer',
        });
      });

    return messages;
  }

  const stagedStickerRefs: string[] = [];
  const stagedStickerLabels: string[] = [];
  const mappedMessages: ChatMessage[] = [];

  envelope.items.forEach((item) => {
    if (item.kind === 'text') {
      const normalizedMainText = stripAssistantSpeakerPrefix(
        sanitizePipeMarkers(item.text, '\n'),
        options.assistantAliases || [],
      );
      const expandedCues = expandDirectActionCues(normalizedMainText, item.translation);

      expandedCues.forEach((cue) => {
        const stickerContext = {
          ...(options.stickerContext || {}),
          recentStickerRefs: [...stagedStickerRefs].reverse().concat(options.stickerContext?.recentStickerRefs || []),
          recentStickerLabels: [...stagedStickerLabels].reverse().concat(options.stickerContext?.recentStickerLabels || []),
          lastOwnMessageWasSticker: stagedStickerRefs.length > 0 || !!options.stickerContext?.lastOwnMessageWasSticker,
        };
        const pickedSticker = cue.kind === 'sticker'
          ? pickAssistantSticker(cue.content, options.availableStickers || [], stickerContext)
          : null;
        const replyTo = cue.kind === 'reply'
          ? resolveDirectReplyTarget(
              cue.replyTargetName,
              options.currentHistory || [],
              options.userLabel || '你',
              options.modelLabel || '对方',
            )
          : undefined;
        const bodyText = cue.kind === 'sticker'
          ? cue.content.trim()
          : cue.kind === 'recall'
            ? cue.content
            : cue.kind === 'reply'
              ? cue.content || normalizedMainText
              : cue.content || normalizedMainText;

        if (pickedSticker) {
          stagedStickerRefs.push(pickedSticker.sticker);
          stagedStickerLabels.push(pickedSticker.label);
        }

        mappedMessages.push({
          role: 'model',
          text: cue.kind === 'sticker' ? (pickedSticker ? '[sticker]' : bodyText) : bodyText,
          contentType: 'text',
          ...(cue.kind === 'sticker' && pickedSticker ? { imageUrl: pickedSticker.sticker, stickerLabel: pickedSticker.label } : {}),
          ...(replyTo ? { replyTo } : {}),
          ...(cue.translation ? { translation: cue.translation } : {}),
          timestamp: baseTimestamp + mappedMessages.length,
        });
      });
      return;
    }

    if (item.kind === 'game_card') {
      mappedMessages.push({
        role: 'model',
        text: `[GAME_CARD] ${JSON.stringify(item.payload)}`,
        contentType: 'game-card',
        ...(item.translation ? { translation: item.translation } : {}),
        timestamp: baseTimestamp + mappedMessages.length,
      });
      return;
    }

    if (item.kind === 'transfer') {
      mappedMessages.push({
        role: 'model',
        text: `[转账 ${item.amount}]`,
        timestamp: baseTimestamp + mappedMessages.length,
        transferStatus: 'pending',
        transferTargetLabel: options.transferTargetLabel,
        contentType: 'transfer',
      });
      return;
    }

    if (item.name === 'COUPLE_SPACE_INVITE') {
      mappedMessages.push({
        role: 'model',
        text: COUPLE_SPACE_INVITE_TOKEN,
        timestamp: baseTimestamp + mappedMessages.length,
        contentType: 'couple-space-invite',
      });
      return;
    }

    mappedMessages.push({
      role: 'model',
      text: COUPLE_SPACE_INVITE_ACCEPTED_TOKEN,
      timestamp: baseTimestamp + mappedMessages.length,
      contentType: 'couple-space-invite-accepted',
    });
  });

  return mappedMessages.filter((message) => (
    !!message.imageUrl
    || message.contentType === 'game-card'
    || message.contentType === 'transfer'
    || message.contentType === 'couple-space-invite'
    || message.contentType === 'couple-space-invite-accepted'
    || isDisplayableAssistantBubbleText(message.text || '')
  ));
}

export function splitStreamingModelResponseIntoMessages(
  text: string,
  baseTimestamp: number,
  options: {
    isInnerVoice?: boolean;
    transferTargetLabel?: string;
    assistantAliases?: string[];
    availableStickers?: string[];
    stickerContext?: Pick<AssistantStickerContext, 'recentStickerRefs' | 'recentStickerLabels' | 'lastOwnMessageWasSticker' | 'stickerMetadataMap'>;
    maxDirectReplyBubbles?: number;
    currentHistory?: ChatMessage[];
    userLabel?: string;
    modelLabel?: string;
  } = {}
): ChatMessage[] {
  const trimmedText = text.trim();
  const structuredMessages = splitStructuredAssistantReplyEnvelopeIntoMessages(text, baseTimestamp, options);
  if (structuredMessages) {
    return structuredMessages;
  }
  const transferProtocol = parseTransferProtocol(trimmedText);

  if (options.isInnerVoice) {
    const innerVoiceParts = getLegacyTranslationParts(stripTransferProtocolText(text));
    const innerVoiceText = innerVoiceParts.mainText.trim();
    const innerVoiceTranslation = innerVoiceParts.translation.trim();
    const messages: ChatMessage[] = [];

    if (innerVoiceText) {
      messages.push({
        role: 'model',
        text: innerVoiceText,
        timestamp: baseTimestamp,
        isInnerVoice: true,
        contentType: 'inner-voice',
        ...(innerVoiceTranslation ? { translation: innerVoiceTranslation } : {}),
      });
    }

    if (transferProtocol) {
      messages.push({
        role: 'model',
        text: `[转账 ${transferProtocol.amount}]`,
        timestamp: baseTimestamp + messages.length,
        transferStatus: 'pending',
        transferTargetLabel: options.transferTargetLabel,
        contentType: 'transfer',
      });
    }

    return messages.length > 0 ? messages : [{
      role: 'model',
      text: innerVoiceText || text,
      timestamp: baseTimestamp,
      isInnerVoice: true,
      contentType: 'inner-voice',
      ...(innerVoiceTranslation ? { translation: innerVoiceTranslation } : {}),
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
      ...(trimmedText
        ? {
            contentType:
              trimmedText === GAME_CARD_FAILURE_TOKEN
                ? 'game-card-error' as const
                : 'game-card' as const,
          }
        : {}),
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
  const stagedStickerRefs: string[] = [];
  const stagedStickerLabels: string[] = [];
  const mappedMessages: ChatMessage[] = [];

  parts.forEach((part, index) => {
    const expandedCues = expandDirectActionCues(part, translationParts[index]);

    expandedCues.forEach((cue) => {
      const stickerContext = {
        ...(options.stickerContext || {}),
        recentStickerRefs: [...stagedStickerRefs].reverse().concat(options.stickerContext?.recentStickerRefs || []),
        recentStickerLabels: [...stagedStickerLabels].reverse().concat(options.stickerContext?.recentStickerLabels || []),
        lastOwnMessageWasSticker: stagedStickerRefs.length > 0 || !!options.stickerContext?.lastOwnMessageWasSticker,
      };
      const pickedSticker = cue.kind === 'sticker'
        ? pickAssistantSticker(cue.content, options.availableStickers || [], stickerContext)
        : null;
      const replyTo = cue.kind === 'reply'
        ? resolveDirectReplyTarget(
            cue.replyTargetName,
            options.currentHistory || [],
            options.userLabel || '你',
            options.modelLabel || '对方',
          )
        : undefined;
      const bodyText = cue.kind === 'sticker'
        ? cue.content.trim()
        : cue.kind === 'recall'
          ? cue.content
          : cue.kind === 'reply'
            ? cue.content || part
            : cue.content || part;

      if (pickedSticker) {
        stagedStickerRefs.push(pickedSticker.sticker);
        stagedStickerLabels.push(pickedSticker.label);
      }

      mappedMessages.push({
        role: 'model' as const,
        text: cue.kind === 'sticker' ? (pickedSticker ? '[sticker]' : bodyText) : bodyText,
        contentType: 'text' as const,
        ...(cue.kind === 'sticker' && pickedSticker ? { imageUrl: pickedSticker.sticker, stickerLabel: pickedSticker.label } : {}),
        ...(replyTo ? { replyTo } : {}),
        ...(cue.translation ? { translation: cue.translation } : {}),
        timestamp: baseTimestamp + mappedMessages.length,
      });
    });
  });

  const visibleMessages: ChatMessage[] = mappedMessages.filter((message) => (
    !!message.imageUrl
    || isDisplayableAssistantBubbleText(message.text || '')
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
        contentType: 'transfer',
      },
    ];
    if (hasCoupleSpaceAcceptedToken) {
      nextMessages.push({
        role: 'model' as const,
        text: COUPLE_SPACE_INVITE_ACCEPTED_TOKEN,
        timestamp: baseTimestamp + nextMessages.length,
        contentType: 'couple-space-invite-accepted',
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
        contentType: 'couple-space-invite-accepted',
      },
    ];
  }

  return visibleMessages;
}

type ParsedGameCardState =
  | { status: 'ok'; data: Record<string, unknown> }
  | { status: 'incomplete' }
  | { status: 'invalid'; error: unknown };

function parseGameCardState(text: string): ParsedGameCardState {
  if (!text.startsWith('[GAME_CARD]')) {
    return { status: 'invalid', error: new Error('Not a GAME_CARD payload.') };
  }

  try {
    let jsonString = text.replace(/^\[GAME_CARD\]\s*/, '').trim();

    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const jsonStart = jsonString.indexOf('{');
    const jsonEnd = jsonString.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
      return { status: 'incomplete' };
    }

    const gameData = JSON.parse(jsonString.substring(jsonStart, jsonEnd + 1));
    return gameData && typeof gameData === 'object'
      ? { status: 'ok', data: gameData as Record<string, unknown> }
      : { status: 'invalid', error: new Error('GAME_CARD payload is not an object.') };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (
      /unterminated string|unexpected end of json input|expected ',' or '}'/i.test(message)
      || text.trim().startsWith('[GAME_CARD]')
    ) {
      const trimmed = text.trim();
      if (!trimmed.endsWith('}') || message.toLowerCase().includes('unterminated')) {
        return { status: 'incomplete' };
      }
    }
    return { status: 'invalid', error };
  }
}

function parseGameCardData(text: string, options?: { silent?: boolean }) {
  const parsed = parseGameCardState(text);
  if (parsed.status === 'ok') {
    return parsed.data;
  }
  if (parsed.status === 'invalid' && !options?.silent && isGameCardText(text)) {
    console.warn('Ignoring invalid runtime game card payload.', parsed.error);
  }

  return null;
}

function buildStickerRecentTexts(messages: ChatMessage[]): string[] {
  return messages
    .slice(-6)
    .map((message) => {
      if (message.audioUrl) {
        return message.audioTranscript?.trim() || '[audio]';
      }

      if (message.imageUrl) {
        if (/^\[(?:sticker|表情包)\]/i.test(message.text || '')) {
          return message.stickerLabel?.trim() ? `[sticker] ${message.stickerLabel.trim()}` : '[sticker]';
        }

        return '[image]';
      }

      return getMessageMainText(message).trim();
    })
    .filter(Boolean);
}

function isStickerChatMessage(message: Pick<ChatMessage, 'imageUrl' | 'text'>): boolean {
  return !!message.imageUrl && /^\[(?:sticker|表情包)\]/i.test((message.text || '').trim());
}

function buildDirectStickerUsageContext(
  messages: ChatMessage[],
  options: {
    excludeAfterTimestamp?: number;
  } = {},
): Pick<AssistantStickerContext, 'recentStickerRefs' | 'recentStickerLabels' | 'lastOwnMessageWasSticker'> {
  const ownMessages = messages.filter((message) => (
    message.role === 'model'
    && !message.isSystem
    && !message.isRecalled
    && !message.isInnerVoice
    && (options.excludeAfterTimestamp == null || message.timestamp < options.excludeAfterTimestamp)
  ));

  const latestOwnVisibleMessage = [...ownMessages].reverse().find((message) => (
    isDisplayableAssistantBubbleText(message.text || '') || !!message.imageUrl
  ));
  const recentStickerMessages = [...ownMessages].reverse()
    .filter((message) => isStickerChatMessage(message))
    .slice(0, 6);

  return {
    recentStickerRefs: recentStickerMessages
      .map((message) => message.imageUrl?.trim() || '')
      .filter(Boolean),
    recentStickerLabels: recentStickerMessages
      .map((message) => (
        message.stickerLabel?.trim()
        || inferStickerSemanticLabel(message.imageUrl, message.text)
        || ''
      ))
      .filter(Boolean),
    lastOwnMessageWasSticker: !!latestOwnVisibleMessage && isStickerChatMessage(latestOwnVisibleMessage),
  };
}

function isIncompleteGameCardPayload(text: string) {
  return parseGameCardState(text).status === 'incomplete';
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
  const replyParts = getLegacyTranslationParts(replyText);
  const trimmedReply = replyParts.mainText.trim();
  if (!trimmedReply || trimmedReply.startsWith('[GAME_CARD]') || !latestUserMessage) {
    return replyText;
  }

  const shouldInspectGameCard =
    latestUserMessage.contentType === 'game-card'
    || isGameCardText(latestUserMessage.text || '');
  if (!shouldInspectGameCard) {
    return replyText;
  }

  const gameData = parseGameCardData(latestUserMessage.text || '', { silent: true });
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

  const latestCardTranslation = (
    latestUserMessage.translation?.trim()
    || getLegacyTranslationParts(latestUserMessage.text || '').translation.trim()
  );
  const responseTranslation = replyParts.translation.trim();
  const combinedTranslation =
    responseType === 'answer' && latestCardTranslation && responseTranslation
      ? `${latestCardTranslation}---${responseTranslation}`
      : responseTranslation;

  return combinedTranslation
    ? `[GAME_CARD] ${JSON.stringify(bridgedCard)}\n\n---TRANSLATION---\n${combinedTranslation}`
    : `[GAME_CARD] ${JSON.stringify(bridgedCard)}`;
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

function buildDirectSpecialReplyPrompt(
  message: ChatMessage | null | undefined,
  options: {
    structuredReplyEnabled?: boolean;
    requireInlineTranslation?: boolean;
  } = {},
): string {
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

  const shouldInspectGameCard =
    message.contentType === 'game-card'
    || isGameCardText(message.text || '');
  const gameCard = shouldInspectGameCard
    ? parseGameCardData(message.text || '', { silent: true })
    : null;
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
      options.structuredReplyEnabled
        ? `建议统一协议骨架： ${STRUCTURED_ASSISTANT_REPLY_TOKEN} {"items":[{"kind":"game_card","payload":{"game":"${gameCard.game}","type":"${cardType.responseType}","question":${JSON.stringify(typeof gameCard.question === 'string' ? gameCard.question : '')},"content":"角色真正会说的话"}}]}`
        : `建议协议骨架： [GAME_CARD] {"game":"${gameCard.game}","type":"${cardType.responseType}","question":${JSON.stringify(typeof gameCard.question === 'string' ? gameCard.question : '')},"content":"角色真正会说的话"}`,
      options.structuredReplyEnabled
        ? '要求：卡片内容要像这个角色本人说出来的，不要写成系统说明；最终输出优先给统一 reply envelope，不要先写普通文本再解释。'
        : '要求：卡片内容要像这个角色本人说出来的，不要写成系统说明；最终输出优先直接给出可解析的 GAME_CARD，不要先写普通文本再解释。',
      options.requireInlineTranslation
        ? (
          options.structuredReplyEnabled
            ? '如果卡片里的自然语言不是中文，并且当前回复需要双语展示，就在 game_card item 上填写 translation 字段，写对应的简体中文。'
            : '如果卡片里的自然语言不是中文，并且当前回复需要双语展示，那么必须在 GAME_CARD 协议正文后追加 `---TRANSLATION---`，写对应的简体中文翻译。'
        )
        : '',
    ].join('\n');
  }

  if ((message.text || '').trim() === COUPLE_SPACE_INVITE_TOKEN) {
    return [
      '## 本轮特殊回复要求',
      '用户最新消息是情侣空间邀请卡。',
      options.structuredReplyEnabled
        ? '这轮如果同意，请在统一 reply envelope 里追加 {"kind":"token","name":"COUPLE_SPACE_INVITE_ACCEPTED"}，让前端继续显示接受结果卡。'
        : `这轮回复如果同意，结尾必须补上 ${COUPLE_SPACE_INVITE_ACCEPTED_TOKEN}，让前端继续显示接受结果卡。`,
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
  characters?: Character[];
  sharedStickers?: string[];
  history: ChatMessage[];
  setHistory: (history: ChatMessage[]) => void;
  settings: Pick<AppSettings, 'activeConfigId' | 'configs' | 'apiCenterConfig' | 'sharedStickerMetadata'>;
  input: string;
  setInput: (value: string) => void;
  replyingTo: ChatMessage['replyTo'] | null;
  setReplyingTo: (value: ChatMessage['replyTo'] | null) => void;
  masks: Mask[];
  worldBook?: WorldBookEntry[];
  perception?: PerceptionSettings;
  coupleSpace?: CoupleSpaceData;
  isCoupleSpaceDismissed?: boolean;
  userName: string;
  directChatHistory?: ChatHistory;
  chatGroups?: ChatGroup[];
  favorites: FavoriteMessage[];
  setFavorites: (favorites: FavoriteMessage[]) => void;
  walletData?: WalletData;
  onUpdateWalletData?: (data: WalletData) => void;
  onUpdateCharacter: (character: Character) => void;
  onPatchCharacter?: (patch: Partial<Character>) => void;
  friendRequests?: FriendRequest[];
  setFriendRequests?: (friendRequests: FriendRequest[] | ((prev: FriendRequest[]) => FriendRequest[])) => void;
  onPublishMoment?: (moment: { authorId: string; content: string; translation?: string; images?: string[]; sourceImage?: MomentSourceImageRef; imageCard?: MomentImageCard }) => boolean | Promise<boolean>;
  onAddCallRecord?: (record: CallRecord) => void;
  onAcceptCoupleSpaceInvite?: (characterId: string) => void;
};

type UseDirectChatRuntimeResult = BaseSessionRuntimeState & {
  setError: (value: string | null) => void;
  sendText: () => Promise<void>;
  handleSend: (overrideText?: string | any, locationData?: { name: string; address?: string; isVirtual?: boolean }) => Promise<void>;
  handleSendRef: React.MutableRefObject<(overrideText?: string | any, locationData?: any) => Promise<void>>;
  sendPokeInteraction: () => Promise<void>;
  requestManualReply: () => void;
  handleVoiceCallAIResponse: (userText: string) => Promise<{
    text: string;
    translation?: string;
    audioUrl?: string;
    audioMimeType?: string;
  } | null>;
  sendImageMessage: (imageValue: string) => void;
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
  generateAudioForMessageAt: (index: number) => Promise<boolean>;
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
  audioTranscript?: string;
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
  '如果系统给了“角色主动带线参考”，把它当作可选方向，不是硬任务；挑一条最像你本人此刻会顺手提起的线就够了。',
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

function buildDirectFinalCharacterGuardPrompt(): string {
  return [
    '## 本轮角色锁定',
    '你最终只以你本人说话，不要像 AI 助手、客服、心理咨询师或设定解说。',
    '你的人设、说话手感、关系动态、当前状态和记忆优先；意图分析、通用聊天规则、功能提示只做辅助，不能把你改成温柔陪聊模板。',
    '保持活人感：你可以停顿、留白、反问、嘴硬、靠近、拒绝或转开，但不要机械复读人设，也不要丢掉自己的生活状态。',
  ].join('\n');
}

function buildDirectActionDescriptionPrompt(inputEnabled?: boolean, characterEnabled?: boolean): string {
  if (inputEnabled && characterEnabled) {
    return [
      '## 场景动作描述格式',
      '用户可能会用中文全角括号“（）”描述动作、神态、环境或场景，括号外是说出口的话。',
      '你必须同时理解括号内的动作/场景和括号外的对话内容。',
      '你也可以在自然需要时使用“（）”写简短动作、神态或场景，再在括号外写角色真正说出口的话。',
      '如果你主动使用“（）”，请尽量把括号动作单独放一行，真正说出口的话另起一行。',
      '不要每句话都强行加括号；括号内容要短、具体、贴合当前时间和关系，不要写成长篇旁白。',
    ].join('\n');
  }

  if (!inputEnabled && characterEnabled) {
    return [
      '## 场景动作描述格式',
      '如果用户消息里出现中文全角括号“（）”，括号内代表动作、神态、环境或场景，括号外代表说出口的话，你需要理解两部分。',
      '当前未开启用户侧动作输入入口，所以不要假设用户会频繁这样输入。',
      '但角色主动括号表达已开启；你可以在自然需要时使用“（）”写简短动作、神态或场景，再在括号外写角色真正说出口的话。',
      '如果你主动使用“（）”，请尽量把括号动作单独放一行，真正说出口的话另起一行。',
      '不要每句话都强行加括号；括号内容要短、具体、贴合当前时间和关系，不要写成长篇旁白。',
    ].join('\n');
  }

  if (!inputEnabled && characterEnabled) {
    return [
      '## 场景动作描述格式',
      '如果用户消息里出现中文全角括号“（）”，括号内代表动作、神态、环境或场景，括号外代表说出口的话，你需要理解两部分。',
      '当前未开启用户侧动作输入入口，所以不要假设用户会频繁这样输入。',
      '但角色主动括号表达已开启；你可以在自然需要时使用“（）”写简短动作、神态或场景，再在括号外写角色真正说出口的话。',
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

function getLatestVisibleDirectUserText(messages: ChatMessage[]): string {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => (
      message.role === 'user'
      && !message.isSystem
      && !message.isRecalled
      && getMessageMainText(message).trim()
    ));

  return latestUserMessage ? getMessageMainText(latestUserMessage).trim() : '';
}

export function useDirectChatRuntime({
  character,
  characters,
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
  isCoupleSpaceDismissed,
  userName,
  directChatHistory,
  chatGroups,
  favorites,
  setFavorites,
  walletData,
  onUpdateWalletData,
  onUpdateCharacter,
  onPatchCharacter,
  friendRequests = [],
  setFriendRequests,
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
  const availableStickerMetadata = {
    ...(settings.sharedStickerMetadata || {}),
    ...(character.stickerMetadata || {}),
  };
  const lastMomentPublishAtRef = useRef<number | null>(null);
  const { isLoading, error, setError: setErrorState, activeGenerationIdRef, runGeneration } = useSessionRuntimeCore();
  const activeAssistantMessageIdRef = useRef<number | null>(null);
  const activeAssistantRenderCountRef = useRef(0);
  const handleSendRef = useRef<(overrideText?: string | any, locationData?: any) => Promise<void>>(async () => {});
  const historyRef = useRef(history);
  const inputRef = useRef(input);
  const pendingCoupleSpaceInviteRef = useRef(false);
  const pendingTransferDecisionIdsRef = useRef<Set<string>>(new Set());

  const syncCharacterRuntimeState = useCallback((params: {
    history: ChatMessage[];
    continuityMode: 'continuous_scene' | 'same_day_resume' | 'resume_after_gap';
    shortTermSummary?: string;
    latestUserText?: string;
    latestAssistantText?: string;
    sharedState?: Character['sharedState'];
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
      onPatchCharacter({
        ...patch,
        ...(params.sharedState ? { sharedState: params.sharedState } : {}),
      });
      return;
    }

    onUpdateCharacter({
      ...character,
      ...patch,
      ...(params.sharedState ? { sharedState: params.sharedState } : {}),
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

  const commitHistory = useCallback((nextHistory: ChatMessage[]) => {
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, [setHistory]);

  const patchCurrentCharacter = useCallback((patch: Partial<Character>) => {
    if (onPatchCharacter) {
      onPatchCharacter(patch);
      return;
    }

    onUpdateCharacter({
      ...character,
      ...patch,
    });
  }, [character, onPatchCharacter, onUpdateCharacter]);

  const recordDirectBoundaryEvent = useCallback((params: {
    decision: 'warn' | 'block';
    reactionText: string;
    timestamp: number;
  }) => {
    if (params.decision === 'block') {
      patchCurrentCharacter({
        friendshipStatus: 'none',
        blockedByCharacter: true,
        relationshipStatusUpdatedAt: params.timestamp,
      });
    }

    if (!setFriendRequests) {
      return;
    }

    setFriendRequests((prevRequests) => {
      const requestList = Array.isArray(prevRequests) ? prevRequests : [];
      const relationshipRound = resolveRelationshipRoundForWrite(
        requestList,
        character.id,
        params.timestamp,
      );
      const nextRequests = params.decision === 'block'
        ? supersedePendingCharacterRequests(requestList, character.id, params.timestamp)
        : requestList;
      const displayName = character.remarkName?.trim() || character.name;

      const nextRoundRequests = [
        createRelationshipEventThreadEntry({
          characterId: character.id,
          characterName: displayName,
          characterAvatar: character.avatar,
          relationshipRoundId: relationshipRound.roundId,
          relationshipRoundNo: relationshipRound.roundNo,
          timestamp: params.timestamp,
          reactionText: params.reactionText,
          resolutionMessage: params.decision === 'block'
            ? `${displayName} 在聊天里把你拉黑了。`
            : `${displayName} 在聊天里明确跟你划了边界。`,
          eventKind: params.decision === 'block'
            ? 'character_blocked_user_from_chat'
            : 'character_warned_user_from_chat',
          isUnread: true,
        }),
        ...nextRequests,
      ];

      return params.decision === 'block'
        ? markRelationshipRoundAbandoned(nextRoundRequests, relationshipRound.roundId, params.timestamp)
        : nextRoundRequests;
    });
  }, [character.avatar, character.id, character.name, character.remarkName, patchCurrentCharacter, setFriendRequests]);

  const prepareBaseHistoryForOutgoingMessage = useCallback(() => {
    let baseHistory = historyRef.current;
    if (activeAssistantMessageIdRef.current !== null) {
      const staleAssistantId = activeAssistantMessageIdRef.current;
      const staleAssistantRenderCount = Math.max(1, activeAssistantRenderCountRef.current);
      baseHistory = baseHistory.filter((message) => (
        !(message.role === 'model'
          && message.timestamp >= staleAssistantId
          && message.timestamp < staleAssistantId + staleAssistantRenderCount)
      ));
      commitHistory(baseHistory);
      activeAssistantMessageIdRef.current = null;
      activeAssistantRenderCountRef.current = 0;
    }

    return baseHistory;
  }, [commitHistory]);

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
    if (!cleanText || !spokenText) {
      console.warn('Character TTS skipped because the reply text is empty or not suitable for speech.', {
        characterId: character.id,
        cleanText,
        spokenText,
      });
      return null;
    }

    if (!shouldApplyCharacterTts(character)) {
      console.warn('Character TTS skipped because role voice is disabled.', {
        characterId: character.id,
      });
      return null;
    }

    if (!voiceRuntimeConfig) {
      console.warn('Character TTS skipped because no voice runtime config is available.', {
        characterId: character.id,
      });
      return null;
    }

    const preferredVoiceId = resolveCharacterTtsVoiceId(character, defaultTtsVoiceId);
    if (!preferredVoiceId) {
      console.warn('Character TTS skipped because no voiceId could be resolved.', {
        characterId: character.id,
        mode: character.voiceProfile?.mode,
        fallbackVoiceId: defaultTtsVoiceId,
      });
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

  const attachAudioToModelMessageTimestamp = useCallback(async (messageTimestamp: number) => {
    const latestHistory = historyRef.current;
    const messageIndex = latestHistory.findIndex((message) => (
      message.timestamp === messageTimestamp
      && message.role === 'model'
      && !message.isSystem
      && !message.isRecalled
    ));

    if (messageIndex < 0) {
      return false;
    }

    const targetMessage = latestHistory[messageIndex];
    if (!isEligibleDirectReplyMessageForAudio(targetMessage) || !shouldApplyCharacterTts(character)) {
      return false;
    }

    const audioResult = await synthesizeCharacterReplyAudio(
      targetMessage.text?.trim() || '',
      `direct-auto-tts-${character.id}-${targetMessage.timestamp}`,
    );
    if (!audioResult) {
      return false;
    }

    const nextHistory = [...latestHistory];
    nextHistory[messageIndex] = {
      ...targetMessage,
      audioUrl: audioResult.audioUrl,
      audioMimeType: audioResult.audioMimeType,
      audioTranscript: audioResult.spokenText,
    };
    commitHistory(nextHistory);
    return true;
  }, [character, commitHistory, synthesizeCharacterReplyAudio]);

  const queueAutoAudioForLatestModelReply = useCallback((messages: ChatMessage[], latestUserText: string) => {
    const latestReplySegment = getLatestModelReplySegment(messages);
    if (!latestReplySegment) {
      return;
    }

    const targetMessageTimestamps = messages
      .slice(latestReplySegment.start, latestReplySegment.end + 1)
      .filter((message) => shouldAutoGenerateDirectReplyAudio(character, message, latestUserText, messages))
      .map((message) => message.timestamp);

    if (targetMessageTimestamps.length === 0) {
      return;
    }

    void (async () => {
      for (const messageTimestamp of targetMessageTimestamps) {
        await attachAudioToModelMessageTimestamp(messageTimestamp);
      }
    })();
  }, [attachAudioToModelMessageTimestamp, character, getLatestModelReplySegment]);

  function commitDirectPokeInteraction(params: {
    baseHistory: ChatMessage[];
    actorRole: 'user' | 'character';
    actorLabel: string;
    targetLabel: string;
    interactionResult: LightInteractionResult;
    upcomingStreak: number;
    continuityMode: 'continuous_scene' | 'same_day_resume' | 'resume_after_gap';
    shortTermSummary?: string;
  }) {
    const characterDisplayLabel = character.remarkName?.trim() || character.name;
    const baseTimestamp = Date.now();
    const interactionId = `poke:${character.id}:${baseTimestamp}`;
    const interactionMeta = {
      type: 'poke' as const,
      scene: 'direct' as const,
      interactionId,
      actorRole: params.actorRole,
      actorLabel: params.actorLabel,
      targetLabel: params.targetLabel,
      mood: params.interactionResult.interactionState?.mood,
      streak: params.interactionResult.interactionState?.streak ?? params.upcomingStreak,
      descriptors: params.interactionResult.interactionState?.recentDescriptors,
      nextActions: params.interactionResult.nextActions,
      counterActionType: params.actorRole === 'user'
        ? params.interactionResult.counterAction?.type ?? 'none'
        : 'none',
    };
    const normalizedCounterSystemLine = params.actorRole === 'user' && params.interactionResult.counterAction?.type === 'poke_back'
      ? (
          params.interactionResult.counterAction.systemLine?.trim().includes('拍')
            ? params.interactionResult.counterAction.systemLine.trim()
            : `${characterDisplayLabel}拍了拍你`
        )
      : '';
    const nextMessages: ChatMessage[] = [
      {
        role: 'model',
        text: params.interactionResult.systemLine,
        timestamp: baseTimestamp,
        isSystem: true,
        lightInteractionMeta: {
          ...interactionMeta,
          step: 'system',
        },
      },
      ...params.interactionResult.assistantBubbles.map((bubble, index) => ({
        role: 'model' as const,
        text: bubble,
        timestamp: baseTimestamp + index + 1,
        lightInteractionMeta: {
          ...interactionMeta,
          step: 'assistant' as const,
        },
      })),
      ...(normalizedCounterSystemLine
        ? [{
            role: 'model' as const,
            text: normalizedCounterSystemLine,
            timestamp: baseTimestamp + params.interactionResult.assistantBubbles.length + 1,
            isSystem: true,
            lightInteractionMeta: {
              ...interactionMeta,
              step: 'counter' as const,
            },
          }]
        : []),
    ];
    const finalHistory = [...params.baseHistory, ...nextMessages];
    commitHistory(finalHistory);

    if (params.interactionResult.assistantBubbles.length > 0) {
      queueAutoAudioForLatestModelReply(
        finalHistory,
        params.actorRole === 'character' ? '主动拍一拍' : '拍一拍',
      );
    }

    syncCharacterRuntimeState({
      history: finalHistory,
      continuityMode: params.continuityMode,
      shortTermSummary: params.shortTermSummary,
      latestAssistantText: params.interactionResult.assistantBubbles[params.interactionResult.assistantBubbles.length - 1],
    });

    return finalHistory;
  }

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
      && !shouldOfferAvatarActionForCharacter(character, sourceHistory);
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

  const reviewDirectAvatarOffer = useCallback(async (params: {
    history: ChatMessage[];
    shortTermSummary?: string;
    sharedRecentRelationshipSummary?: string;
  }) => {
    if (!activeConfig) {
      return null;
    }

    return evaluateDirectAvatarOfferDecision({
      activeConfig,
      character,
      messages: params.history,
      userName,
      shortTermSummary: params.shortTermSummary,
      sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
    });
  }, [activeConfig, character, userName]);

  const reviewAvatarLibraryDecision = useCallback(async (params: {
    trigger: 'user_request' | 'autonomous';
    history: ChatMessage[];
    latestUserText?: string;
    shortTermSummary?: string;
    sharedRecentRelationshipSummary?: string;
  }) => {
    if (!activeConfig) {
      return null;
    }

    return evaluateAvatarLibraryDecision({
      activeConfig,
      character,
      trigger: params.trigger,
      latestUserText: params.latestUserText?.trim() || '',
      userName,
      messages: params.history,
      shortTermSummary: params.shortTermSummary,
      sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
    });
  }, [activeConfig, character, userName]);

  const clearPendingAvatarConfirmation = useCallback(() => {
    patchCurrentCharacter({
      pendingAvatarConfirmation: undefined,
    });
  }, [patchCurrentCharacter]);

  useEffect(() => {
    const pending = character.pendingAvatarConfirmation;
    if (!pending) {
      return;
    }

    if (isPendingAvatarConfirmationExpired(pending)) {
      clearPendingAvatarConfirmation();
      return;
    }

    if (!pending.expiresAt || typeof window === 'undefined') {
      return;
    }

    const remainingMs = pending.expiresAt - Date.now();
    if (remainingMs <= 0) {
      clearPendingAvatarConfirmation();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearPendingAvatarConfirmation();
    }, Math.min(remainingMs, 0x7fffffff));

    return () => window.clearTimeout(timeoutId);
  }, [
    character.pendingAvatarConfirmation?.createdAt,
    character.pendingAvatarConfirmation?.expiresAt,
    character.pendingAvatarConfirmation?.source,
    clearPendingAvatarConfirmation,
  ]);

  const persistPendingAvatarConfirmation = useCallback((params: {
    avatarOfferReview?: AvatarOfferDecisionReview | null;
    avatarLibraryDecisionReview?: AvatarLibraryDecisionReview | null;
  }) => {
    if (params.avatarOfferReview?.action?.type === 'ask_confirm') {
      patchCurrentCharacter({
        pendingAvatarConfirmation: {
          kind: 'image-offer',
          source: 'pending_avatar_image',
          createdAt: Date.now(),
          expiresAt: Date.now() + 12 * 60 * 60 * 1000,
          candidateImage: params.avatarOfferReview.candidate.image,
          reason: params.avatarOfferReview.reason,
          replyHint: params.avatarOfferReview.replyHint,
          trigger: 'user_request',
        },
      });
      return;
    }

    if (params.avatarLibraryDecisionReview?.action?.type === 'ask_confirm' && params.avatarLibraryDecisionReview.selectedEntryId) {
      patchCurrentCharacter({
        pendingAvatarConfirmation: {
          kind: 'library-switch',
          source: `avatar_library:${params.avatarLibraryDecisionReview.selectedEntryId}`,
          createdAt: Date.now(),
          expiresAt: Date.now() + 12 * 60 * 60 * 1000,
          entryId: params.avatarLibraryDecisionReview.selectedEntryId,
          reason: params.avatarLibraryDecisionReview.reason,
          replyHint: params.avatarLibraryDecisionReview.replyHint,
          trigger: params.avatarLibraryDecisionReview.trigger,
        },
      });
    }
  }, [patchCurrentCharacter]);

  const repairDirectReplyBubbleRangeIfNeeded = useCallback(async (params: {
    replyText: string;
    runtimeMessages: RuntimeChatMessage[];
    traceLabel: string;
    assistantAliases: string[];
    availableStickers?: string[];
    stickerContext?: Pick<AssistantStickerContext, 'recentStickerRefs' | 'recentStickerLabels' | 'lastOwnMessageWasSticker' | 'stickerMetadataMap'>;
    currentHistory?: ChatMessage[];
    userLabel: string;
    modelLabel: string;
    requireInlineTranslation: boolean;
    allowBracketActions: boolean;
  }): Promise<string> => {
    if (!activeConfig) {
      return params.replyText;
    }

    const replyBubbleRange = resolveCharacterReplyBubbleRange(character);
    if (!shouldEnforceDirectReplyBubbleMinimum(replyBubbleRange)) {
      return params.replyText;
    }

    const inspectionOptions = {
      assistantAliases: params.assistantAliases,
      availableStickers: params.availableStickers,
      stickerContext: params.stickerContext,
      currentHistory: params.currentHistory,
      userLabel: params.userLabel,
      modelLabel: params.modelLabel,
    };
    const currentInspection = inspectDirectReplyBubbleCount(params.replyText, inspectionOptions);
    if (
      currentInspection.hasSpecialContent
      || (
        currentInspection.bubbleCount >= replyBubbleRange.minReplies
        && currentInspection.bubbleCount <= replyBubbleRange.maxReplies
      )
    ) {
      return params.replyText;
    }

    const rewriteSeedText = normalizeStructuredAssistantReplyToLegacyFormat(params.replyText).trim();
    if (!rewriteSeedText) {
      return params.replyText;
    }

    const repairedRawText = await streamStructuredAssistantReply({
      activeConfig: {
        ...activeConfig,
        temperature: Math.min(activeConfig.temperature ?? 0.7, 0.4),
      },
      messages: [
        ...params.runtimeMessages,
        {
          role: 'assistant',
          content: rewriteSeedText,
        },
        {
          role: 'user',
          content: buildDirectReplyBubbleRepairInstruction({
            range: replyBubbleRange,
            currentBubbleCount: currentInspection.bubbleCount,
            requireInlineTranslation: params.requireInlineTranslation,
          }),
        },
      ],
      traceLabel: `${params.traceLabel}:bubble-range-repair`,
    });

    const normalizedRepairedText = repairedRawText.trim();
    if (!parseStructuredAssistantReplyEnvelope(normalizedRepairedText)) {
      return params.replyText;
    }

    const repairedQuality = evaluateAssistantOutput(
      normalizeStructuredAssistantReplyToLegacyFormat(normalizedRepairedText),
      {
        allowBracketActions: params.allowBracketActions,
        allowStructuredProtocols: true,
      },
    );
    if (!repairedQuality.ok) {
      return params.replyText;
    }

    const repairedInspection = inspectDirectReplyBubbleCount(normalizedRepairedText, inspectionOptions);
    if (
      repairedInspection.hasSpecialContent
      || repairedInspection.bubbleCount < replyBubbleRange.minReplies
      || repairedInspection.bubbleCount > replyBubbleRange.maxReplies
    ) {
      return params.replyText;
    }

    return normalizedRepairedText;
  }, [activeConfig, character]);

  const generateDirectAssistantMessage = useCallback(async (
    historySnapshot: ChatMessage[],
    mode: DirectGenerationMode,
  ) => {
    await runGeneration(async ({ setRuntimeError: _setRuntimeError }) => {
        setErrorState(null);

        if (!activeConfig) {
          const missingConfigMessage = '错误: Missing API Key. Please configure it in API Center settings.';
          setErrorState(missingConfigMessage);
          commitHistory([
            ...historySnapshot,
            {
              role: 'model',
              text: missingConfigMessage,
              timestamp: Date.now(),
              isSystem: true,
            },
          ]);
          return;
        }

        const assistantMsgId = Date.now() + 1;
        activeAssistantMessageIdRef.current = assistantMsgId;
        activeAssistantRenderCountRef.current = 0;
        let currentResponseText = '';
        let latestHistory = historySnapshot;
        let renderedAssistantMessageCount = 0;
        let runtimeStickerPool = availableStickers;
        const latestPendingUserBlock = getLatestPendingUserMessageBlock(historySnapshot);
        const latestPendingUserMessage = latestPendingUserBlock
          ? historySnapshot[latestPendingUserBlock.end]
          : null;
        const proactiveReferenceText = mode === 'proactive'
          ? getLatestVisibleDirectUserText(historySnapshot)
          : (latestPendingUserMessage?.text || '');
        const isInnerVoiceRequest = !!latestPendingUserMessage?.isInnerVoice;
        const replaceAssistantMessages = (messages: ChatMessage[], text: string): ChatMessage[] => {
          const avatarActionParse = parseAvatarActionPayload(text);
          const displayText = avatarActionParse.structuredDisplayText || avatarActionParse.displayText;
          const shouldRecallPrevious = hasDirectRecallCue(
            normalizeStructuredAssistantReplyToLegacyFormat(displayText),
            {
            assistantAliases: [character.name, character.remarkName?.trim() || ''],
            maxDirectReplyBubbles: resolveCharacterReplyBubbleLimit(character),
            },
          );
          const stickerContext = buildDirectStickerUsageContext(messages, {
            excludeAfterTimestamp: assistantMsgId,
          });
          const nextAssistantMessages = splitStreamingModelResponseIntoMessages(displayText, assistantMsgId, {
            isInnerVoice: isInnerVoiceRequest,
            transferTargetLabel: userName,
            assistantAliases: [character.name, character.remarkName?.trim() || ''],
            availableStickers: runtimeStickerPool,
            stickerContext: {
              ...stickerContext,
              stickerMetadataMap: availableStickerMetadata,
            },
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
          commitHistory(latestHistory);
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

          const directReplyBubbleRange = resolveCharacterReplyBubbleRange(character);
          const chatSceneInput = buildChatSceneInput({
            mode: 'chat',
            includeProtocolRules: mode !== 'proactive',
            character,
            allCharacters: characters,
            userName,
            coupleSpace,
            activeMask,
            activeWorldBooks,
            worldBooks: worldBook,
            perception,
            perceptionPrompt,
            directChatHistory,
            chatGroups,
            worldBookQuery: proactiveReferenceText,
            latestUserText: proactiveReferenceText,
          });
          const directSharedState = chatSceneInput.recentContext
            ? buildPersistedSharedCharacterState({
                character: {
                  shortTermSummary: chatSceneInput.recentContext.shortTermSummary,
                },
                temporalState: characterTemporalState,
                sceneScopedSignals: {
                  relationshipResidue: chatSceneInput.recentContext.relationshipResidue,
                  sceneResidue: chatSceneInput.recentContext.sceneResidue,
                  topicAnchors: chatSceneInput.recentContext.topicAnchors,
                  taskResidue: chatSceneInput.recentContext.taskResidue,
                  sharedRecentRelationshipSummary: chatSceneInput.recentContext.sharedRecentRelationshipSummary,
                  publicAcquaintanceSummary: chatSceneInput.recentContext.publicAcquaintanceSummary,
                },
                sourceScene: 'direct_chat',
              })
            : undefined;
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
          const pendingAvatarConfirmationResolution = mode === 'proactive'
            ? null
            : resolveAvatarConfirmationFromMessages(character, historySnapshot);
          const avatarOfferReview = pendingAvatarConfirmationResolution || mode === 'proactive'
            ? null
            : await reviewDirectAvatarOffer({
              history: historySnapshot,
              shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
              sharedRecentRelationshipSummary: chatSceneInput.recentContext?.sharedRecentRelationshipSummary,
            });
          const avatarLibraryDecisionReview = pendingAvatarConfirmationResolution || avatarOfferReview
            ? null
            : await reviewAvatarLibraryDecision({
              trigger: mode === 'proactive' ? 'autonomous' : 'user_request',
              history: historySnapshot,
              latestUserText: proactiveReferenceText,
              shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
              sharedRecentRelationshipSummary: chatSceneInput.recentContext?.sharedRecentRelationshipSummary,
            });
          const inlineReplyTranslationEnabled = shouldInlineReplyTranslation(character);
          const isSpecialProtocolReply = !!latestPendingUserMessage && (
            latestPendingUserMessage.isInnerVoice
            || latestPendingUserMessage.contentType === 'game-card'
            || isGameCardText(latestPendingUserMessage.text || '')
            || (latestPendingUserMessage.text || '').trim() === COUPLE_SPACE_INVITE_TOKEN
            || (latestPendingUserMessage.text || '').trim() === COUPLE_SPACE_INVITE_ACCEPTED_TOKEN
          );
          const structuredAssistantReplyEnabled =
            inlineReplyTranslationEnabled
            || isSpecialProtocolReply
            || directIntentAnalysis?.actionIntent === 'request_transfer'
            || (
              mode !== 'proactive'
              && shouldEnforceDirectReplyBubbleMinimum(directReplyBubbleRange)
            );
          const directSpecialReplyPrompt = mode === 'proactive'
            ? ''
            : buildDirectSpecialReplyPrompt(latestPendingUserMessage, {
              structuredReplyEnabled: structuredAssistantReplyEnabled,
              requireInlineTranslation: inlineReplyTranslationEnabled,
            });
          const recentPokeState = collectRecentDirectPokeState(historySnapshot);
          const proactivePokeGate = mode === 'proactive'
            ? evaluateDirectProactivePokeGate({
              character,
              messages: historySnapshot,
              recentContext: chatSceneInput.recentContext,
              recentPokeState,
            })
            : null;
          const directStickerContext = {
            ...buildDirectStickerUsageContext(historySnapshot),
            stickerMetadataMap: availableStickerMetadata,
          };
          runtimeStickerPool = resolveAssistantStickerCandidates(availableStickers, {
            character,
            scene: 'direct',
            latestUserText: proactiveReferenceText,
            recentTexts: buildStickerRecentTexts(contextLayers.liveMessages),
            sceneHints: chatSceneInput.sections || [],
            ...directStickerContext,
          }).map((candidate) => candidate.sticker);
          const systemPrompt = buildChatPrompt({
            ...chatSceneInput,
            sections: [
              buildDirectResumeModePrompt(characterTemporalState.continuityMode),
              ...(chatSceneInput.sections || []),
              buildDirectIntentPromptSection(directIntentAnalysis),
              buildDirectCharacterDecisionPromptSection(directCharacterDecision),
              directSpecialReplyPrompt,
              mode === 'proactive' ? DIRECT_PROACTIVE_SPEAKING_PROMPT : '',
              mode === 'proactive' && proactivePokeGate?.shouldOffer
                ? buildDirectProactivePokeProtocolPrompt({
                  characterLabel: character.remarkName?.trim() || character.name,
                  gate: proactivePokeGate,
                })
                : '',
              buildDirectActionDescriptionPrompt(character.actionDescriptionEnabled, character.characterActionDescriptionEnabled),
              'Optional lightweight action cues are allowed when useful: "[reply: 你] text", "[reply: 刚才那句] text", "[recall] text", or a separate line "[sticker] caption". Only use [sticker] when this turn has available imported stickers, and keep the sticker cue on its own line instead of appending it after normal dialogue. If one of the available stickers clearly fits a short emotional beat, using exactly one sticker is encouraged; just do not force a sticker every turn.',
              buildOpenLoopRegistryPrompt({
                existingEntries: buildResolvedOpenLoopRegistry(character),
                shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
                recentMessages: contextLayers.memoryMessages,
                topicAnchors: chatSceneInput.recentContext?.topicAnchors,
                taskResidue: chatSceneInput.recentContext?.taskResidue,
              }),
              contextLayers.memoryContextPrompt,
              pendingAvatarConfirmationResolution
                ? pendingAvatarConfirmationResolution.promptSection
                : avatarOfferReview
                ? buildAvatarOfferReplyPromptSection(avatarOfferReview)
                : avatarLibraryDecisionReview
                  ? buildAvatarLibraryDecisionReplyPromptSection(avatarLibraryDecisionReview)
                  : '',
              buildAssistantStickerPromptSection(runtimeStickerPool, {
                character,
                scene: 'direct',
                latestUserText: proactiveReferenceText,
                recentTexts: buildStickerRecentTexts(contextLayers.liveMessages),
                sceneHints: chatSceneInput.sections || [],
                ...directStickerContext,
              }),
              mode !== 'proactive' && !isSpecialProtocolReply
                ? buildDirectReplyBubbleRangePrompt(directReplyBubbleRange)
                : '',
              buildDirectFinalCharacterGuardPrompt(),
              structuredAssistantReplyEnabled ? buildStructuredAssistantReplyPrompt(character) : '',
            ].filter(Boolean),
          });

          const runtimeMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...contextLayers.liveMessages.map(m => ({
              role: m.role === 'user' ? 'user' as const : 'assistant' as const,
              content: toPromptHistoryContent(m, {
                nowTimestamp: characterTemporalState.temporalFacts.nowTimestamp,
                continuityMode: characterTemporalState.continuityMode,
                userLabel: userName,
                characterLabel: character.name,
              }),
              ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
              ...(m.audioUrl ? { audioUrl: m.audioUrl, audioMimeType: m.audioMimeType } : {}),
            })).filter((message) => !!message.content.trim() || !!message.imageUrl || !!message.audioUrl),
            ...(mode === 'proactive'
              ? [{ role: 'user' as const, content: DIRECT_PROACTIVE_TRIGGER_MESSAGE }]
              : []),
          ];
          const runtimeTraceLabel = mode === 'proactive'
            ? 'direct-chat:proactive-reply'
            : 'direct-chat:assistant-reply';
          let structuredResponseText: string | null = null;
          let finalQualityResult;
          if (structuredAssistantReplyEnabled) {
            const structuredConfig: ApiConfig = {
              ...activeConfig,
              temperature: Math.min(activeConfig.temperature ?? 0.7, 0.35),
            };
            const responseText = await streamStructuredAssistantReply({
              activeConfig: structuredConfig,
              messages: runtimeMessages,
              traceLabel: `${runtimeTraceLabel}:structured`,
            });
            structuredResponseText = parseStructuredAssistantReplyEnvelope(responseText) ? responseText : null;
            const normalizedText = normalizeStructuredAssistantReplyToLegacyFormat(responseText);
            finalQualityResult = evaluateAssistantOutput(normalizedText, {
              allowBracketActions: shouldAllowBracketActions(character),
              allowStructuredProtocols: true,
            });
            if (!finalQualityResult.ok) {
              console.warn('[direct-chat] invalid structured reply rejected', {
                reason: finalQualityResult.reason,
                preview: finalQualityResult.cleanedText.slice(0, 120),
              });
              structuredResponseText = null;
              finalQualityResult = await generateQualityCheckedAssistantReply({
                activeConfig,
                messages: runtimeMessages,
                traceLabel: `${runtimeTraceLabel}:quality`,
                allowBracketActions: shouldAllowBracketActions(character),
                allowStructuredProtocols: true,
                toneGuardMode: 'character_chat',
                softRecoveryMode: 'character_chat',
                retryTemperature: Math.min(Math.max(activeConfig.temperature ?? 0.7, 0.72) + 0.08, 0.95),
                onInvalid: (result) => {
                  console.warn('[direct-chat] invalid structured fallback reply rejected', {
                    reason: result.reason,
                    preview: result.cleanedText.slice(0, 120),
                  });
                },
              });
              if (!structuredResponseText && parseStructuredAssistantReplyEnvelope(finalQualityResult.cleanedText)) {
                structuredResponseText = finalQualityResult.cleanedText;
              }
            }
          } else {
            finalQualityResult = await generateQualityCheckedAssistantReply({
              activeConfig,
              messages: runtimeMessages,
              traceLabel: `${runtimeTraceLabel}:quality`,
              allowBracketActions: shouldAllowBracketActions(character),
              allowStructuredProtocols: true,
              toneGuardMode: 'character_chat',
              softRecoveryMode: 'character_chat',
              retryTemperature: Math.min(Math.max(activeConfig.temperature ?? 0.7, 0.72) + 0.08, 0.95),
              onInvalid: (result) => {
                console.warn('[direct-chat] invalid generated reply rejected', {
                  reason: result.reason,
                  preview: result.cleanedText.slice(0, 120),
                });
              },
            });
          }

          if (!finalQualityResult.ok) {
            throw new Error(`模型返回无效内容：${finalQualityResult.reason || 'unknown'}`);
          }

          const rangeCheckedReplyText = mode === 'proactive'
            ? (structuredResponseText || finalQualityResult.cleanedText)
            : await repairDirectReplyBubbleRangeIfNeeded({
              replyText: structuredResponseText || finalQualityResult.cleanedText,
              runtimeMessages,
              traceLabel: runtimeTraceLabel,
              assistantAliases: [character.name, character.remarkName?.trim() || ''].filter(Boolean),
              availableStickers: runtimeStickerPool,
              stickerContext: directStickerContext,
              currentHistory: latestHistory,
              userLabel: userName,
              modelLabel: character.name,
              requireInlineTranslation: inlineReplyTranslationEnabled,
              allowBracketActions: shouldAllowBracketActions(character),
            });

          const proactiveLightInteractionPayload = mode === 'proactive'
            ? extractDirectProactiveLightInteractionPayload(rangeCheckedReplyText)
            : null;

          if (mode === 'proactive') {
            if (proactiveLightInteractionPayload) {
              const characterDisplayLabel = character.remarkName?.trim() || character.name;
              const interactionResult = parseLightInteractionResult(proactiveLightInteractionPayload, {
                activeConfig,
                type: 'poke',
                scene: 'direct',
                actor: {
                  role: 'character',
                  label: characterDisplayLabel,
                  characterId: character.id,
                },
                responderCharacter: character,
                target: {
                  character,
                  label: '你',
                },
                sceneInput: chatSceneInput,
                recentMessages: contextLayers.liveMessages,
                recentSystemLines: recentPokeState.recentSystemLines,
                recentDescriptors: recentPokeState.recentDescriptors,
                latestMood: recentPokeState.latestMood,
                latestNextActions: recentPokeState.latestNextActions,
                latestCounterActionType: recentPokeState.latestCounterActionType,
                upcomingStreak: recentPokeState.upcomingStreak,
              });

              commitDirectPokeInteraction({
                baseHistory: historySnapshot,
                actorRole: 'character',
                actorLabel: characterDisplayLabel,
                targetLabel: '你',
                interactionResult,
                upcomingStreak: recentPokeState.upcomingStreak,
                continuityMode: characterTemporalState.continuityMode,
                shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
              });
              activeAssistantMessageIdRef.current = null;
              activeAssistantRenderCountRef.current = 0;
              return;
            }
          }

          const resolvedDisplayPayload = resolveDirectReplyDisplayPayload({
            replyText: rangeCheckedReplyText,
            latestUserMessage: latestPendingUserMessage,
            intentAnalysis: directIntentAnalysis,
            decision: directCharacterDecision,
          });
          if (
            inlineReplyTranslationEnabled
            && !proactiveLightInteractionPayload
            && !hasRequiredDirectReplyTranslation(resolvedDisplayPayload.structuredRawText || resolvedDisplayPayload.legacyText)
          ) {
            throw new Error('模型未按双语协议返回可显示的中文翻译。');
          }
          currentResponseText = resolvedDisplayPayload.legacyText;
          let finalStructuredDisplayText = resolvedDisplayPayload.structuredRawText;
          if (isIncompleteGameCardPayload(currentResponseText)) {
            currentResponseText = GAME_CARD_FAILURE_TOKEN;
            finalStructuredDisplayText = null;
          }
          const avatarActionResult = parseAvatarActionPayload(finalStructuredDisplayText || currentResponseText);
          const resolvedAvatarAction = pendingAvatarConfirmationResolution?.action
            || avatarOfferReview?.action
            || avatarLibraryDecisionReview?.action
            || avatarActionResult.action;
          currentResponseText = avatarActionResult.displayText;
          finalStructuredDisplayText = avatarActionResult.structuredDisplayText || null;
          if (!finalStructuredDisplayText && currentResponseText.trim() !== resolvedDisplayPayload.legacyText.trim()) {
            finalStructuredDisplayText = null;
          }
          latestHistory = replaceAssistantMessages(
            latestHistory,
            finalStructuredDisplayText || currentResponseText,
          );
          commitHistory(latestHistory);
          queueAutoAudioForLatestModelReply(latestHistory, latestPendingUserMessage?.text || '');
          syncCharacterRuntimeState({
            history: latestHistory,
            continuityMode: characterTemporalState.continuityMode,
            shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
            latestUserText: latestPendingUserMessage?.text,
            latestAssistantText: currentResponseText,
            sharedState: directSharedState,
          });
          applyAvatarAction(resolvedAvatarAction, historySnapshot);
          if (pendingAvatarConfirmationResolution?.clearPending) {
            clearPendingAvatarConfirmation();
          }
          persistPendingAvatarConfirmation({
            avatarOfferReview,
            avatarLibraryDecisionReview,
          });
          activeAssistantMessageIdRef.current = null;
          activeAssistantRenderCountRef.current = 0;

        } catch (err) {
          console.error(err);
          const formattedError = formatChatApiError(err);
          const stabilizedHistory = latestHistory.filter(msg =>
            !(msg.role === 'model' && msg.timestamp >= assistantMsgId && msg.timestamp < assistantMsgId + renderedAssistantMessageCount)
          );
          commitHistory(
            latestPendingUserMessage
              ? appendSystemMessageIfNotDuplicate(stabilizedHistory, formattedError)
              : stabilizedHistory,
          );
          setErrorState(formattedError);
          activeAssistantMessageIdRef.current = null;
          activeAssistantRenderCountRef.current = 0;
        }
    });
  }, [activeConfig, applyAvatarAction, character, chatGroups, clearPendingAvatarConfirmation, commitHistory, coupleSpace, directChatHistory, masks, perception, persistPendingAvatarConfirmation, queueAutoAudioForLatestModelReply, repairDirectReplyBubbleRangeIfNeeded, reviewAvatarLibraryDecision, reviewDirectAvatarOffer, runGeneration, syncCharacterRuntimeState, userName, worldBook]);

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
      const inlineReplyTranslationEnabled = shouldInlineReplyTranslation(character);
      const qualityResult = await generateQualityCheckedAssistantReply({
        activeConfig,
        traceLabel: 'direct-chat:voice-call',
        messages: [
          {
            role: 'system',
            content: [
              '你正在与用户进行实时语音通话。',
              `你的核心人设是：${characterCorePersona || '自然、口语化、像真人聊天一样回复。'}`,
              languageRules,
              '请像电话里说话一样自然回应，尽量简短，控制在 50 字以内。',
              '不要输出动作括号、舞台提示、解释说明，也不要分点。',
              inlineReplyTranslationEnabled ? buildInlineReplyTranslationPrompt(character) : '',
            ].join('\n'),
          },
          {
            role: 'user',
            content: userText,
          },
        ],
        allowBracketActions: false,
        allowStructuredProtocols: true,
      });

      if (!qualityResult.ok) {
        throw new Error(`语音通话模型返回无效内容：${qualityResult.reason || 'unknown'}`);
      }

      const responseParts = getLegacyTranslationParts(qualityResult.cleanedText.trim());
      const cleanResponseText = responseParts.mainText.trim();
      if (!cleanResponseText) {
        return null;
      }

      const translation = responseParts.translation.trim();

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
      : (overridePayload?.promptText ?? inputRef.current);
    if ((!textToSend.trim() && !effectiveLocationData) || !activeConfig) {
      if (!activeConfig) {
        setErrorState('Missing active API config.');
      }
      return;
    }


    setErrorState(null);

    const blockState = getCharacterBlockState(character);
    const blockedComposerError = getDirectChatBlockedComposerError(character);
    if (blockedComposerError) {
      setErrorState(blockedComposerError);
      return;
    }

    const baseHistory = prepareBaseHistoryForOutgoingMessage();
    const shouldSuppressUserText = !!overridePayload?.suppressUserText && !!effectiveLocationData;
    const userMessageText = shouldSuppressUserText
      ? ''
      : (overridePayload?.userText?.trim() || textToSend.trim() || (effectiveLocationData ? `[位置分享] ${effectiveLocationData.name}` : ''));
    const isInnerVoiceOverride = overridePayload?.isInnerVoice || textToSend.trim() === '[倾听心声]';
    const userMessageContentType = resolveChatMessageContentType({
      text: userMessageText,
      isInnerVoice: isInnerVoiceOverride,
    });
    const userMsg: ChatMessage = {
      role: 'user',
      text: userMessageText,
      ...(userMessageContentType ? { contentType: userMessageContentType } : {}),
      timestamp: Date.now(),
      ...(replyingTo ? { replyTo: replyingTo } : {}),
      ...(effectiveLocationData ? { location: effectiveLocationData } : {}),
      ...(overridePayload?.imageUrl ? { imageUrl: overridePayload.imageUrl } : {}),
      ...(overridePayload?.audioUrl ? { audioUrl: overridePayload.audioUrl, audioMimeType: overridePayload.audioMimeType } : {}),
      ...(overridePayload?.audioTranscript ? { audioTranscript: overridePayload.audioTranscript } : {}),
      ...(typeof overridePayload?.duration === 'number' ? { duration: overridePayload.duration } : {}),
      ...(overridePayload?.stickerLabel ? { stickerLabel: overridePayload.stickerLabel } : {}),
      ...(isInnerVoiceOverride ? { isInnerVoice: true } : {}),
    };

    if (blockState === 'character') {
      commitHistory([
        ...baseHistory,
        createBlockedDeliveryMessage(userMsg),
      ]);
      if (!overridePayload) {
        setInput('');
      }
      setReplyingTo(null);
      return;
    }

    await runGeneration(async ({ generationId }) => {
    const newHistory = [...baseHistory, userMsg];
    commitHistory(newHistory);

    if (!overridePayload) {
      setInput('');
    }

    setReplyingTo(null);

    if (!character.autoReplyEnabled && !overridePayload?.forceReply) {
      return;
    }

    const isInnerVoiceRequest = isInnerVoiceOverride;
    const assistantMsgId = Date.now() + 1;
    activeAssistantMessageIdRef.current = assistantMsgId;
      let currentResponseText = '';
      let latestHistory = newHistory;
      let renderedAssistantMessageCount = 0;
      let runtimeStickerPool = availableStickers;
      const stripPseudoMomentPrefix = (text: string) =>
        text.replace(/^\s*(动态|状态|朋友圈说说)[:：]\s*/u, '').trim();

      const replaceAssistantMessages = (messages: ChatMessage[], text: string): ChatMessage[] => {
      const avatarActionParse = parseAvatarActionPayload(stripPseudoMomentPrefix(text));
      const displayText = avatarActionParse.structuredDisplayText || avatarActionParse.displayText;
      const shouldRecallPrevious = hasDirectRecallCue(
        normalizeStructuredAssistantReplyToLegacyFormat(displayText),
        {
          assistantAliases: [character.name, character.remarkName?.trim() || ''],
          maxDirectReplyBubbles: resolveCharacterReplyBubbleLimit(character),
        },
      );
      const stickerContext = buildDirectStickerUsageContext(messages, {
        excludeAfterTimestamp: assistantMsgId,
      });
      const nextAssistantMessages = splitStreamingModelResponseIntoMessages(displayText, assistantMsgId, {
        isInnerVoice: isInnerVoiceRequest,
        transferTargetLabel: userName,
        assistantAliases: [character.name, character.remarkName?.trim() || ''],
        availableStickers: runtimeStickerPool,
        stickerContext: {
          ...stickerContext,
          stickerMetadataMap: availableStickerMetadata,
        },
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
      commitHistory(latestHistory);
    };

    try {
      const recentMomentContext = {
        recentMessages: baseHistory.slice(-6).map(message => ({
          role: message.role,
          text: message.text,
          timestamp: message.timestamp,
        })),
        recentImageReferences: extractRecentMomentImageReferences(baseHistory, 2),
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
        const published = onPublishMoment
          ? await onPublishMoment({
              authorId: character.id,
              content: commandMomentResult.momentContent,
              translation: commandMomentResult.momentTranslation,
              images: commandMomentResult.momentImages,
              sourceImage: commandMomentResult.momentSourceImage,
              imageCard: commandMomentResult.momentImageCard,
            })
          : false;
        if (published) {
          commitHistory([
            ...newHistory,
            createMomentPublishedSystemMessage(character.name, noticeTimestamp),
          ]);
          activeAssistantMessageIdRef.current = null;
          activeAssistantRenderCountRef.current = 0;
          lastMomentPublishAtRef.current = noticeTimestamp;
          return;
        }
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

      const directReplyBubbleRange = resolveCharacterReplyBubbleRange(character);
      const chatSceneInput = buildChatSceneInput({
        mode: 'chat',
        character,
        allCharacters: characters,
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
      const directSharedState = chatSceneInput.recentContext
        ? buildPersistedSharedCharacterState({
            character: {
              shortTermSummary: chatSceneInput.recentContext.shortTermSummary,
            },
            temporalState: characterTemporalState,
            sceneScopedSignals: {
              relationshipResidue: chatSceneInput.recentContext.relationshipResidue,
              sceneResidue: chatSceneInput.recentContext.sceneResidue,
              topicAnchors: chatSceneInput.recentContext.topicAnchors,
              taskResidue: chatSceneInput.recentContext.taskResidue,
              sharedRecentRelationshipSummary: chatSceneInput.recentContext.sharedRecentRelationshipSummary,
              publicAcquaintanceSummary: chatSceneInput.recentContext.publicAcquaintanceSummary,
            },
            sourceScene: 'direct_chat',
          })
        : undefined;
      const directIntentAnalysis = analyzeLatestDirectUserIntent(newHistory);
      const directCharacterDecision = analyzeDirectCharacterDecision({
        character,
        messages: newHistory,
        intentAnalysis: directIntentAnalysis,
      });
      const pendingAvatarConfirmationResolution = resolveAvatarConfirmationFromMessages(character, newHistory);
      const avatarOfferReview = pendingAvatarConfirmationResolution
        ? null
        : await reviewDirectAvatarOffer({
        history: newHistory,
        shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
        sharedRecentRelationshipSummary: chatSceneInput.recentContext?.sharedRecentRelationshipSummary,
      });
      const avatarLibraryDecisionReview = pendingAvatarConfirmationResolution || avatarOfferReview
        ? null
        : await reviewAvatarLibraryDecision({
          trigger: 'user_request',
          history: newHistory,
          latestUserText: userMsg.text,
          shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
          sharedRecentRelationshipSummary: chatSceneInput.recentContext?.sharedRecentRelationshipSummary,
        });
      const inlineReplyTranslationEnabled = shouldInlineReplyTranslation(character);
      const isSpecialProtocolReply =
        userMsg.isInnerVoice
        || userMsg.contentType === 'game-card'
        || isGameCardText(userMsg.text || '')
        || (userMsg.text || '').trim() === COUPLE_SPACE_INVITE_TOKEN
        || (userMsg.text || '').trim() === COUPLE_SPACE_INVITE_ACCEPTED_TOKEN;
      const structuredAssistantReplyEnabled =
        inlineReplyTranslationEnabled
        || isSpecialProtocolReply
        || directIntentAnalysis?.actionIntent === 'request_transfer'
        || shouldEnforceDirectReplyBubbleMinimum(directReplyBubbleRange);
      const directSpecialReplyPrompt = buildDirectSpecialReplyPrompt(userMsg, {
        structuredReplyEnabled: structuredAssistantReplyEnabled,
        requireInlineTranslation: inlineReplyTranslationEnabled,
      });
      const directStickerContext = {
        ...buildDirectStickerUsageContext(newHistory),
        stickerMetadataMap: availableStickerMetadata,
      };
      runtimeStickerPool = resolveAssistantStickerCandidates(availableStickers, {
        character,
        scene: 'direct',
        latestUserText: userMsg.text,
        recentTexts: buildStickerRecentTexts(contextLayers.liveMessages),
        sceneHints: chatSceneInput.sections || [],
        ...directStickerContext,
      }).map((candidate) => candidate.sticker);
      const systemPrompt = buildChatPrompt({
        ...chatSceneInput,
        sections: [
          buildDirectResumeModePrompt(characterTemporalState.continuityMode),
          ...(chatSceneInput.sections || []),
          buildDirectIntentPromptSection(directIntentAnalysis),
          buildDirectCharacterDecisionPromptSection(directCharacterDecision),
          directSpecialReplyPrompt,
          buildDirectActionDescriptionPrompt(character.actionDescriptionEnabled, character.characterActionDescriptionEnabled),
          'Optional lightweight action cues are allowed when useful: "[reply: 你] text", "[reply: 刚才那句] text", "[recall] text", or a separate line "[sticker] caption". Only use [sticker] when this turn has available imported stickers, and keep the sticker cue on its own line instead of appending it after normal dialogue. If one of the available stickers clearly fits a short emotional beat, using exactly one sticker is encouraged; just do not force a sticker every turn.',
          buildOpenLoopRegistryPrompt({
            existingEntries: buildResolvedOpenLoopRegistry(character),
            shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
            recentMessages: contextLayers.memoryMessages,
            topicAnchors: chatSceneInput.recentContext?.topicAnchors,
            taskResidue: chatSceneInput.recentContext?.taskResidue,
          }),
          contextLayers.memoryContextPrompt,
          pendingAvatarConfirmationResolution
            ? pendingAvatarConfirmationResolution.promptSection
            : avatarOfferReview
            ? buildAvatarOfferReplyPromptSection(avatarOfferReview)
            : avatarLibraryDecisionReview
              ? buildAvatarLibraryDecisionReplyPromptSection(avatarLibraryDecisionReview)
              : '',
          buildAssistantStickerPromptSection(runtimeStickerPool, {
            character,
            scene: 'direct',
            latestUserText: userMsg.text,
            recentTexts: buildStickerRecentTexts(contextLayers.liveMessages),
            sceneHints: chatSceneInput.sections || [],
            ...directStickerContext,
          }),
          !isSpecialProtocolReply ? buildDirectReplyBubbleRangePrompt(directReplyBubbleRange) : '',
          buildDirectFinalCharacterGuardPrompt(),
          structuredAssistantReplyEnabled ? buildStructuredAssistantReplyPrompt(character) : '',
        ].filter(Boolean),
      });

      const runtimeMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...contextLayers.liveMessages.map(m => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: toPromptHistoryContent(m, {
            nowTimestamp: characterTemporalState.temporalFacts.nowTimestamp,
            continuityMode: characterTemporalState.continuityMode,
            userLabel: userName,
            characterLabel: character.name,
          }),
          ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
          ...(m.audioUrl ? { audioUrl: m.audioUrl, audioMimeType: m.audioMimeType } : {}),
        })).filter((message) => !!message.content.trim() || !!message.imageUrl || !!message.audioUrl),
      ];
      const runtimeTraceLabel = 'direct-chat:assistant-reply-live';
      let structuredResponseText: string | null = null;
      let qualityResult;
      if (structuredAssistantReplyEnabled) {
        const structuredConfig: ApiConfig = {
          ...activeConfig,
          temperature: Math.min(activeConfig.temperature ?? 0.7, 0.35),
        };
        const responseText = await streamStructuredAssistantReply({
          activeConfig: structuredConfig,
          messages: runtimeMessages,
          traceLabel: `${runtimeTraceLabel}:structured`,
          onPreview: (previewText) => {
            if (activeGenerationIdRef.current !== generationId) {
              return;
            }

            const visiblePreview = stripPseudoMomentPrefix(previewText);
            if (!visiblePreview.trim()) {
              return;
            }

            updateAssistantMessage(visiblePreview);
          },
        });
        structuredResponseText = parseStructuredAssistantReplyEnvelope(responseText) ? responseText : null;
        const normalizedText = normalizeStructuredAssistantReplyToLegacyFormat(responseText);
        qualityResult = evaluateAssistantOutput(normalizedText, {
          allowBracketActions: shouldAllowBracketActions(character),
          allowStructuredProtocols: true,
        });
        if (!qualityResult.ok) {
          console.warn('[direct-chat] invalid structured reply rejected', {
            reason: qualityResult.reason,
            preview: qualityResult.cleanedText.slice(0, 120),
          });
          structuredResponseText = null;
          qualityResult = await generateQualityCheckedAssistantReply({
            activeConfig,
            messages: runtimeMessages,
            traceLabel: `${runtimeTraceLabel}:quality`,
            allowBracketActions: shouldAllowBracketActions(character),
            allowStructuredProtocols: true,
            toneGuardMode: 'character_chat',
            softRecoveryMode: 'character_chat',
            retryTemperature: Math.min(Math.max(activeConfig.temperature ?? 0.7, 0.72) + 0.08, 0.95),
            onInvalid: (result) => {
              console.warn('[direct-chat] invalid structured fallback reply rejected', {
                reason: result.reason,
                preview: result.cleanedText.slice(0, 120),
              });
            },
          });
          if (!structuredResponseText && parseStructuredAssistantReplyEnvelope(qualityResult.cleanedText)) {
            structuredResponseText = qualityResult.cleanedText;
          }
        }
      } else {
        qualityResult = await generateQualityCheckedAssistantReply({
          activeConfig,
          messages: runtimeMessages,
          traceLabel: `${runtimeTraceLabel}:quality`,
          allowBracketActions: shouldAllowBracketActions(character),
          allowStructuredProtocols: true,
          toneGuardMode: 'character_chat',
          softRecoveryMode: 'character_chat',
          retryTemperature: Math.min(Math.max(activeConfig.temperature ?? 0.7, 0.72) + 0.08, 0.95),
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
            console.warn('[direct-chat] invalid generated reply rejected', {
              reason: result.reason,
              preview: result.cleanedText.slice(0, 120),
            });
          },
        });
      }

      if (!qualityResult.ok && effectiveLocationData) {
        activeAssistantMessageIdRef.current = null;
        activeAssistantRenderCountRef.current = 0;
        commitHistory(newHistory);
        return;
      }

      if (!qualityResult.ok) {
        throw new Error(`模型返回无效内容：${qualityResult.reason || 'unknown'}`);
      }
      if (activeGenerationIdRef.current !== generationId) {
        return;
      }

      const rangeCheckedReplyText = await repairDirectReplyBubbleRangeIfNeeded({
        replyText: structuredResponseText || qualityResult.cleanedText,
        runtimeMessages,
        traceLabel: runtimeTraceLabel,
        assistantAliases: [character.name, character.remarkName?.trim() || ''].filter(Boolean),
        availableStickers: runtimeStickerPool,
        stickerContext: directStickerContext,
        currentHistory: newHistory,
        userLabel: userName,
        modelLabel: character.name,
        requireInlineTranslation: inlineReplyTranslationEnabled,
        allowBracketActions: shouldAllowBracketActions(character),
      });

      const resolvedDisplayPayload = resolveDirectReplyDisplayPayload({
        replyText: rangeCheckedReplyText,
        latestUserMessage: userMsg,
        intentAnalysis: directIntentAnalysis,
        decision: directCharacterDecision,
      });
      if (inlineReplyTranslationEnabled && !hasRequiredDirectReplyTranslation(resolvedDisplayPayload.structuredRawText || resolvedDisplayPayload.legacyText)) {
        throw new Error('模型未按双语协议返回可显示的中文翻译。');
      }
      currentResponseText = resolvedDisplayPayload.legacyText;
      let finalStructuredDisplayText = resolvedDisplayPayload.structuredRawText;
      if (isIncompleteGameCardPayload(currentResponseText)) {
        currentResponseText = GAME_CARD_FAILURE_TOKEN;
        finalStructuredDisplayText = null;
      }
      currentResponseText = stripPseudoMomentPrefix(currentResponseText);
      const avatarActionResult = parseAvatarActionPayload(finalStructuredDisplayText || currentResponseText);
      const resolvedAvatarAction = pendingAvatarConfirmationResolution?.action
        || avatarOfferReview?.action
        || avatarLibraryDecisionReview?.action
        || avatarActionResult.action;
      currentResponseText = avatarActionResult.displayText;
      finalStructuredDisplayText = avatarActionResult.structuredDisplayText || null;
      if (!finalStructuredDisplayText && currentResponseText.trim() !== resolvedDisplayPayload.legacyText.trim()) {
        finalStructuredDisplayText = null;
      }
      const boundaryAnalysis = analyzeDirectRelationshipBoundary({
        character,
        messages: newHistory,
        intentAnalysis: directIntentAnalysis,
        directCharacterDecision,
      });
      const boundaryReply = boundaryAnalysis.allowedDecisions.length > 1
        ? await generateDirectRelationshipBoundaryReply({
            activeConfig,
            character,
            allCharacters: characters,
            userName,
            history: newHistory,
            directChatHistory,
            chatGroups,
            masks,
            worldBook,
            perception,
            coupleSpace,
            latestUserText: userMsg.text,
            draftReplyText: currentResponseText,
            boundary: boundaryAnalysis,
            structuredReplyPrompt: structuredAssistantReplyEnabled ? buildStructuredAssistantReplyPrompt(character) : undefined,
          })
        : null;
      const appliedBoundaryDecision = boundaryReply?.decision && boundaryAnalysis.allowedDecisions.includes(boundaryReply.decision)
        ? boundaryReply.decision
        : boundaryAnalysis.suggestedDecision !== 'none' && boundaryAnalysis.allowedDecisions.length > 1
          ? boundaryAnalysis.suggestedDecision
          : 'none';
      if (boundaryReply?.reactionText?.trim()) {
        const boundaryStructuredText = parseStructuredAssistantReplyEnvelope(boundaryReply.reactionText.trim())
          ? boundaryReply.reactionText.trim()
          : null;
        currentResponseText = boundaryStructuredText
          ? normalizeStructuredAssistantReplyToLegacyFormat(boundaryStructuredText)
          : boundaryReply.reactionText.trim();
        finalStructuredDisplayText = boundaryStructuredText;
      }
      const baseFinalHistory = replaceAssistantMessages(
        newHistory,
        finalStructuredDisplayText || currentResponseText,
      );
      const boundaryTimestamp = Date.now();
      const finalHistory = appliedBoundaryDecision === 'block'
        ? [
            ...baseFinalHistory,
            createRelationshipSystemMessage(
              `${character.remarkName?.trim() || character.name} 已拒收普通消息。`,
              boundaryTimestamp + 1,
              { tone: 'danger' },
            ),
          ]
        : baseFinalHistory;
      commitHistory(finalHistory);
      queueAutoAudioForLatestModelReply(baseFinalHistory, userMsg.text);
      if (appliedBoundaryDecision === 'warn' || appliedBoundaryDecision === 'block') {
        recordDirectBoundaryEvent({
          decision: appliedBoundaryDecision,
          reactionText: currentResponseText,
          timestamp: boundaryTimestamp,
        });
      }
      syncCharacterRuntimeState({
        history: finalHistory,
        continuityMode: characterTemporalState.continuityMode,
        shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
        latestUserText: userMsg.text,
        latestAssistantText: currentResponseText,
        sharedState: directSharedState,
      });
      if (appliedBoundaryDecision === 'none') {
        applyAvatarAction(resolvedAvatarAction, finalHistory);
      }
      if (pendingAvatarConfirmationResolution?.clearPending) {
        clearPendingAvatarConfirmation();
      }
      persistPendingAvatarConfirmation({
        avatarOfferReview,
        avatarLibraryDecisionReview,
      });
      if (onPublishMoment && appliedBoundaryDecision === 'none') {
        const autoMomentResult = await maybeAutoPublishMoment({
          userText: userMsg.text,
          assistantText: currentResponseText,
          finalHistory,
          recentContext: {
            recentMessages: finalHistory
              .filter((message) => !message.isSystem)
              .slice(-8)
              .map((message) => ({
                role: message.role,
                text: message.text,
                timestamp: message.timestamp,
              })),
            recentImageReferences: extractRecentMomentImageReferences(finalHistory, 2),
            recentMomentPublishedAt: lastMomentPublishAtRef.current,
            now: Date.now(),
          },
          activeConfig: forumConfig || activeConfig,
          character,
          masks,
          worldBook,
        });

        if (autoMomentResult.shouldPublish && autoMomentResult.momentContent && onPublishMoment) {
          const noticeTimestamp = Date.now();
          const published = await onPublishMoment({
            authorId: character.id,
            content: autoMomentResult.momentContent,
            translation: autoMomentResult.momentTranslation,
            images: autoMomentResult.momentImages,
            sourceImage: autoMomentResult.momentSourceImage,
            imageCard: autoMomentResult.momentImageCard,
          });
          if (published) {
            commitHistory([
              ...finalHistory,
              createMomentPublishedSystemMessage(character.name, noticeTimestamp),
            ]);
            lastMomentPublishAtRef.current = noticeTimestamp;
          }
        }
      }
      activeAssistantMessageIdRef.current = null;
      activeAssistantRenderCountRef.current = 0;
    } catch (sendError: any) {
      if (activeGenerationIdRef.current !== generationId) {
        return;
      }
      console.error('Chat error:', sendError);
      commitHistory(appendSystemMessageIfNotDuplicate(newHistory, formatChatApiError(sendError)));
    } finally {
      if (activeGenerationIdRef.current === generationId) {
        activeAssistantMessageIdRef.current = null;
        activeAssistantRenderCountRef.current = 0;
      }
    }
    });
  }, [activeConfig, applyAvatarAction, character, characters, chatGroups, clearPendingAvatarConfirmation, commitHistory, coupleSpace, directChatHistory, masks, onPublishMoment, perception, persistPendingAvatarConfirmation, prepareBaseHistoryForOutgoingMessage, queueAutoAudioForLatestModelReply, recordDirectBoundaryEvent, repairDirectReplyBubbleRangeIfNeeded, replyingTo, reviewAvatarLibraryDecision, reviewDirectAvatarOffer, setInput, setReplyingTo, syncCharacterRuntimeState, userName, worldBook]);

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const persistImageValueIfNeeded = useCallback(async (imageValue: string) => {
    const trimmedImageValue = imageValue.trim();
    if (!trimmedImageValue) {
      return trimmedImageValue;
    }

    if (/^data:image\//i.test(trimmedImageValue)) {
      try {
        return await saveUploadedDataUrl(
          trimmedImageValue,
          `direct-chat-image-${Date.now()}.png`,
        );
      } catch (error) {
        console.error('Failed to persist direct chat image payload before send', error);
        return trimmedImageValue;
      }
    }

    if (/^https?:\/\//i.test(trimmedImageValue)) {
      try {
        return await cacheRemoteAsset(trimmedImageValue, `direct-chat-image-${Date.now()}`);
      } catch (error) {
        console.error('Failed to cache direct chat remote image before send', error);
      }
    }

    return trimmedImageValue;
  }, []);

  const sendImageMessage = useCallback((imageValue: string) => {
    void (async () => {
      const persistedImageValue = await persistImageValueIfNeeded(imageValue);
      await handleSendRef.current({
        promptText: '[sent an image]',
        userText: '[image]',
        imageUrl: persistedImageValue,
      });
    })();
  }, [persistImageValueIfNeeded]);

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
    void (async () => {
      const stickerMetadata = getStickerMetadata(availableStickerMetadata, sticker);
      const stickerLabel = inferStickerSemanticLabel(sticker, undefined, stickerMetadata);
      const persistedSticker = await persistImageValueIfNeeded(sticker);
      await handleSendRef.current({
        promptText: describeStickerMessageForPrompt({
          imageUrl: persistedSticker,
          text: '[sticker]',
          stickerLabel,
        }),
        userText: '[sticker]',
        imageUrl: persistedSticker,
        stickerLabel,
      });
    })();
  }, [availableStickerMetadata, persistImageValueIfNeeded]);

  const sendLocationMessage = useCallback((text: string, locationData: { name: string; address?: string; isVirtual?: boolean }) => {
    void handleSendRef.current({
      promptText: text,
      suppressUserText: true,
      locationData,
    });
  }, []);

  const runDirectPokeInteraction = useCallback(async (actorRole: 'user' | 'character') => {
    if (isLoading) {
      return;
    }

    const blockedInteractionError = getDirectChatBlockedManualReplyError(character);
    if (blockedInteractionError) {
      setErrorState(blockedInteractionError);
      return;
    }

    const baseHistory = prepareBaseHistoryForOutgoingMessage();
    if (!activeConfig) {
      const missingConfigMessage = '错误: 当前未选择有效的 API 配置。';
      setErrorState(missingConfigMessage);
      commitHistory(appendSystemMessageIfNotDuplicate(baseHistory, missingConfigMessage));
      return;
    }

    await runGeneration(async ({ generationId, isCurrent }) => {
      try {
        const characterDisplayLabel = character.remarkName?.trim() || character.name;
        const actorLabel = actorRole === 'character' ? characterDisplayLabel : '你';
        const targetLabel = actorRole === 'character' ? '你' : characterDisplayLabel;
        const recentPokeState = collectRecentDirectPokeState(baseHistory);
        const historyLimit = getDirectMemoryMessageLimit(character.memoryLimit);
        const characterTemporalState = buildCharacterTemporalState({
          characterId: character.id,
          perception,
          directChatHistory,
          groupMessages: [],
          coupleSpace,
        });
        const historyWindow = getDirectHistoryWindowByTemporalMode(
          baseHistory,
          historyLimit,
          characterTemporalState.continuityMode,
        );
        const contextLayers = buildDirectContextLayers({
          messages: baseHistory,
          liveMessages: historyWindow,
          continuityMode: characterTemporalState.continuityMode,
          nowTimestamp: characterTemporalState.temporalFacts.nowTimestamp,
        });
        const activeMask = masks.find((mask) => mask.isActive && mask.linkedCharacters.includes(character.id));
        const activeWorldBooks = worldBook.filter((entry) => {
          const isManuallySelected = !!character.activeWorldBookIds?.includes(entry.id);
          if (isManuallySelected) {
            return true;
          }

          return !!entry.isActive && (entry.isGlobal || entry.characterIds?.includes(character.id));
        });
        const latestVisibleUserText = getLatestVisibleDirectUserText(baseHistory) || (
          actorRole === 'character' ? '角色主动拍一拍' : '拍一拍互动'
        );

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
          allCharacters: characters,
          userName,
          coupleSpace,
          activeMask,
          activeWorldBooks,
          worldBooks: worldBook,
          perception,
          perceptionPrompt,
          directChatHistory,
          chatGroups,
          worldBookQuery: latestVisibleUserText,
          latestUserText: latestVisibleUserText,
        });

        const interactionResult = await generateLightInteraction({
          activeConfig,
          type: 'poke',
          scene: 'direct',
          actor: actorRole === 'character'
            ? {
                role: 'character',
                label: actorLabel,
                characterId: character.id,
              }
            : {
                role: 'user',
                label: actorLabel,
              },
          responderCharacter: character,
          target: {
            character,
            label: targetLabel,
          },
          sceneInput: chatSceneInput,
          recentMessages: contextLayers.liveMessages,
          recentSystemLines: recentPokeState.recentSystemLines,
          recentDescriptors: recentPokeState.recentDescriptors,
          latestMood: recentPokeState.latestMood,
          latestNextActions: recentPokeState.latestNextActions,
          latestCounterActionType: recentPokeState.latestCounterActionType,
          upcomingStreak: recentPokeState.upcomingStreak,
        });

        if (activeGenerationIdRef.current !== generationId || !isCurrent()) {
          return;
        }

        commitDirectPokeInteraction({
          baseHistory,
          actorRole,
          actorLabel,
          targetLabel,
          interactionResult,
          upcomingStreak: recentPokeState.upcomingStreak,
          continuityMode: characterTemporalState.continuityMode,
          shortTermSummary: chatSceneInput.recentContext?.shortTermSummary,
        });
      } catch (interactionError) {
        if (activeGenerationIdRef.current !== generationId || !isCurrent()) {
          return;
        }

        console.error('Poke interaction error:', interactionError);
        const formattedError = formatChatApiError(interactionError);
        setErrorState(formattedError);
        commitHistory(appendSystemMessageIfNotDuplicate(baseHistory, formattedError));
      }
    });
  }, [
    activeConfig,
    character,
    characters,
    chatGroups,
    coupleSpace,
    directChatHistory,
    isLoading,
    masks,
    perception,
    prepareBaseHistoryForOutgoingMessage,
    queueAutoAudioForLatestModelReply,
    runGeneration,
    syncCharacterRuntimeState,
    userName,
    worldBook,
  ]);

  const sendPokeInteraction = useCallback(async () => {
    await runDirectPokeInteraction('user');
  }, [runDirectPokeInteraction]);

  const sendCoupleSpaceInvitation = useCallback(() => {
    if (pendingCoupleSpaceInviteRef.current) {
      alert('情侣空间邀请发送中，请稍候。');
      return;
    }

    if (hasOpenedCoupleSpaceForCharacter({
      characterId: character.id,
      coupleSpace,
      history: historyRef.current,
      isDismissed: isCoupleSpaceDismissed,
    })) {
      alert(`${character.name} 的情侣空间已经开通，不能重复邀请。`);
      return;
    }

    pendingCoupleSpaceInviteRef.current = true;

    void (async () => {
      try {
        if (activeConfig) {
          const inviteStartedAt = Date.now();
          await handleSendRef.current(COUPLE_SPACE_INVITE_TOKEN);
          const acceptedMessage = historyRef.current.find((message) => (
            message.contentType === 'couple-space-invite-accepted'
            && message.timestamp >= inviteStartedAt
          ));
          if (acceptedMessage) {
            onAcceptCoupleSpaceInvite?.(character.id);
          }
          return;
        }

        const userMsg: ChatMessage = {
          role: 'user',
          text: COUPLE_SPACE_INVITE_TOKEN,
          contentType: 'couple-space-invite',
          timestamp: Date.now(),
        };
        const nextHistory = [...historyRef.current, userMsg];
        setHistory(nextHistory);

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
        const inviteReplyContentType = resolveChatMessageContentType({ text: replyText });
        const modelReply: ChatMessage = {
          role: 'model',
          text: replyText,
          ...(inviteReplyContentType ? { contentType: inviteReplyContentType } : {}),
          timestamp: Date.now(),
        };
        const acceptedCard: ChatMessage = {
          role: 'model',
          text: COUPLE_SPACE_INVITE_ACCEPTED_TOKEN,
          contentType: 'couple-space-invite-accepted',
          timestamp: Date.now() + 1,
        };
        setHistory([...latestHistory, modelReply, acceptedCard]);
        onAcceptCoupleSpaceInvite?.(character.id);
      } finally {
        pendingCoupleSpaceInviteRef.current = false;
      }
    })();
  }, [activeConfig, character, coupleSpace, isCoupleSpaceDismissed, onAcceptCoupleSpaceInvite, setHistory, userName]);

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
    const settledAt = Date.now();
    const nextHistory = [...latestHistory];
    nextHistory[transferIndex] = {
      ...transferMessage,
      transferStatus: status,
      transferSettledAt: settledAt,
    };

    nextHistory.push({
      role: 'model',
      text: `[转账 ${amountStr}]`,
      contentType: 'transfer',
      timestamp: settledAt,
      transferStatus: status,
      transferDisplayLabel: status === 'received' ? '已收款' : '已退回',
      transferTargetLabel: character.name,
      transferSettledAt: settledAt,
    });

    if (replyText) {
      nextHistory.push({
        role: 'model',
        text: replyText,
        timestamp: settledAt + 1,
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

    commitHistory(nextHistory);
  }, [character.name, commitHistory, onUpdateWalletData, walletData]);

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

  const triggerTransferEventReaction = useCallback((params: {
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
        commitHistory([
          ...historyRef.current,
          ...reactionMessages,
        ]);
      })
      .catch(error => {
        console.error('Transfer reaction failed:', error);
      });
  }, [activeConfig, character, commitHistory, userName]);

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

  const generateAudioForMessageAt = useCallback(async (index: number) => {
    const latestHistory = historyRef.current;
    const targetMessage = latestHistory[index];
    if (
      !targetMessage
      || !shouldApplyCharacterTts(character)
    ) {
      return false;
    }

    return attachAudioToModelMessageTimestamp(targetMessage.timestamp);
  }, [attachAudioToModelMessageTimestamp, character]);

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
        contentType: 'transfer',
        timestamp: Date.now(),
        transferStatus: 'pending',
        transferId,
        transferCardId: selectedCardId,
      };
      const nextHistory = [...historyRef.current, transferMessage];
      commitHistory(nextHistory);
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
      contentType: 'transfer',
      timestamp: Date.now(),
      transferStatus: 'pending',
      transferId: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    commitHistory([...historyRef.current, modelMsg]);
    return true;
  }, [activeConfig, character.name, commitHistory, onUpdateWalletData, queueTransferDecision, walletData]);

  const handleReceiveTransfer = useCallback((index: number) => {
    const msg = history[index];
    if (!msg || msg.transferStatus === 'received' || msg.transferStatus === 'rejected') return;

    const newHistory = [...history];
    const settledAt = Date.now();
    newHistory[index] = {
      ...msg,
      transferStatus: 'received',
      transferSettledAt: settledAt,
    };

    const amountStr = extractTransferAmount(msg.text) || '0.00';
    const amount = parseFloat(amountStr);
    const receiptCard: ChatMessage = {
      role: 'user',
      text: `[转账 ${amountStr}]`,
      contentType: 'transfer',
      timestamp: settledAt,
      transferStatus: 'received',
      transferDisplayLabel: '已收款',
      transferTargetLabel: userName,
      transferSettledAt: settledAt,
    };

    commitHistory([...newHistory, receiptCard]);

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
  }, [activeConfig, character, character.name, commitHistory, history, onUpdateWalletData, triggerTransferEventReaction, userName, walletData]);

  const requestManualReply = useCallback(() => {
    if (isLoading) {
      return;
    }

    const blockState = getCharacterBlockState(character);
    const blockedManualReplyError = getDirectChatBlockedManualReplyError(character);
    if (blockedManualReplyError) {
      setErrorState(blockedManualReplyError);
      return;
    }

    const latestHistory = historyRef.current;
    const pendingUserBlock = getLatestPendingUserMessageBlock(latestHistory);

    if (!pendingUserBlock) {
      void generateDirectAssistantMessage(latestHistory, 'proactive');
      return;
    }

    void generateDirectAssistantMessage(latestHistory, 'reply');
  }, [character, generateDirectAssistantMessage, isLoading, setErrorState]);

  const handleRejectTransfer = useCallback((index: number) => {
    const msg = history[index];
    if (!msg || msg.role !== 'model' || msg.transferStatus === 'received' || msg.transferStatus === 'rejected') return;

    const amountStr = extractTransferAmount(msg.text) || '0.00';
    const amount = parseFloat(amountStr);
    const nextHistory = [...history];
    const settledAt = Date.now();
    nextHistory[index] = {
      ...msg,
      transferStatus: 'rejected',
      transferSettledAt: settledAt,
    };
    nextHistory.push({
      role: 'user',
      text: `[转账 ${amountStr}]`,
      contentType: 'transfer',
      timestamp: settledAt,
      transferStatus: 'rejected',
      transferDisplayLabel: '已退回',
      transferTargetLabel: character.name,
      transferSettledAt: settledAt,
    });

    commitHistory(nextHistory);

    if (!Number.isNaN(amount) && amount > 0) {
      triggerTransferEventReaction({
        amount,
        direction: 'character_to_user_rejected',
      });
    }
  }, [character.name, commitHistory, history, triggerTransferEventReaction]);

  return {
    isLoading,
    error,
    setError,
    sendText: () => handleSend(),
    handleSend,
    handleSendRef,
    sendPokeInteraction,
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
    generateAudioForMessageAt,
    submitTransfer,
    handleReceiveTransfer,
    handleRejectTransfer,
  };
}









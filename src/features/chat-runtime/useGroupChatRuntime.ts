import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ApiConfig, AppSettings, Character, ChatGroup, ChatMessage, PerceptionSettings, StickerMetadata, WorldBookEntry } from '../../types';
import type { ChatHistory } from '../../types';
import type { RuntimeChatMessage } from '../../services/ai/runtimeClient';
import {
  STRUCTURED_ASSISTANT_REPLY_TOKEN,
  extractStructuredAssistantReplyPreviewText,
  normalizeStructuredAssistantReplyToLegacyFormat,
  parseStructuredAssistantReplyEnvelope,
  streamStructuredAssistantReply,
} from '../../services/ai/assistantReplyEnvelope';
import {
  evaluateAssistantOutput,
  generateQualityCheckedAssistantReply,
  shouldAllowBracketActions,
} from '../../services/ai/outputQuality';
import { buildGroupChatPrompt } from '../../services/ai/prompts/builders/buildGroupChatPrompt';
import { buildGroupContextLayers } from '../../services/chat/buildGroupContextLayers';
import { buildOpenLoopRegistryPrompt } from '../../services/chat/buildOpenLoopRegistry';
import { splitDirectAssistantReplyText, stripAssistantSpeakerPrefix } from '../../services/chat/assistantText';
import { generateLightInteraction } from '../../services/chat/generateLightInteraction';
import { collectRecentGroupPokeState } from '../../services/chat/lightInteractionHistory';
import { isUsableChatText, normalizeChatPunctuationNoise } from '../../services/chat/messageHygiene';
import { extractTransferAmountText } from '../../services/chat/transferContextText';
import {
  buildTransferSettlementEventLine,
  resolveTransferReplyTextForEvent,
  type TransferSettlementEvent,
} from '../../services/chat/transferEventSemantics';
import {
  buildAssistantStickerPromptSection,
  pickAssistantSticker,
  resolveAssistantStickerCandidates,
  type AssistantStickerContext,
} from '../../services/chat/assistantStickerPicker';
import { getStickerMetadata } from '../../services/chat/stickerMetadata';
import { describeStickerMessageForPrompt, inferStickerSemanticLabel } from '../../services/chat/stickerSemantics';
import { buildGroupChatSceneInput, type GroupChatSceneInput } from '../../services/scene-inputs/buildGroupChatSceneInput';
import { buildPersistedSharedCharacterState } from '../../services/relationship-context/buildSharedCharacterState';
import { buildTemporalContextPrompt } from '../../services/relationship-time/buildTemporalContextPrompt';
import { buildCharacterTemporalState } from '../../services/relationship-time/buildCharacterTemporalState';
import { buildCharacterContext } from '../../services/relationship-context/buildCharacterContext';
import { createCharacterDirectory } from '../character-domain/useCharacterDirectory';
import { selectActiveGroupWorldBooks } from '../group-world-book/selectActiveGroupWorldBooks';
import { computeGroupParticipationBonus, shouldUseActivityFloor } from './groupParticipationHeuristics';
import {
  buildGroupSpeechActInstruction,
  computeGroupPresenceParticipationWeight,
  computePerspectiveReactionWeight,
  createGroupConversationPlan,
  getGroupSpeechActForPlanPosition,
} from './groupConversationPlan';
import { resolveGroupReplyIntent, type GroupReplyIntent } from './groupIntentResolver';
import { useSessionRuntimeCore } from './useSessionRuntimeCore';
import { resolveSceneTextApiConfig, resolveSceneVoiceApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import { synthesizeTtsAudio } from '../../services/ai/apiCenter/synthesizeTtsAudio';
import { buildGroupChatSharedSettlement } from '../../services/group-chat/buildGroupChatSharedSettlement';
import { buildResolvedOpenLoopRegistry } from '../../services/memory/buildResolvedOpenLoopRegistry';
import { persistSceneSettlement } from '../../services/memory/sceneSettlement';
import { cacheRemoteAsset, saveUploadedDataUrl } from '../persistence/persistentAssetService';

type UseGroupChatRuntimeArgs = {
  members: Character[];
  groupMeta?: {
    lastMessage?: string;
    lastTime?: number;
    groupStage?: ChatGroup['groupStage'];
    activeWorldBookIds?: ChatGroup['activeWorldBookIds'];
    memberRelationSeeds?: ChatGroup['memberRelationSeeds'];
    backgroundSummary?: ChatGroup['backgroundSummary'];
    memberRelationshipState?: ChatGroup['memberRelationshipState'];
    memberRelationshipNote?: ChatGroup['memberRelationshipNote'];
    currentScene?: ChatGroup['currentScene'];
    publicFacts?: ChatGroup['publicFacts'];
    manualReplyEnabled?: ChatGroup['manualReplyEnabled'];
    voiceRepliesEnabled?: ChatGroup['voiceRepliesEnabled'];
    voiceReplyMemberIds?: ChatGroup['voiceReplyMemberIds'];
    mutedMemberIds?: string[];
    topicState?: ChatGroup['topicState'];
    groupShortTermSummary?: ChatGroup['groupShortTermSummary'];
    groupMemberPerspectiveSummaries?: ChatGroup['groupMemberPerspectiveSummaries'];
    groupLongTermMemory?: ChatGroup['groupLongTermMemory'];
    relationshipWaves?: ChatGroup['relationshipWaves'];
    factTraces?: ChatGroup['factTraces'];
  };
  history: ChatMessage[];
  setHistory: Dispatch<SetStateAction<ChatMessage[]>>;
  input: string;
  setInput: (value: string) => void;
  replyingTo: ChatMessage['replyTo'] | null;
  setReplyingTo: (value: ChatMessage['replyTo'] | null) => void;
  userName: string;
  directChatHistory: ChatHistory;
  patchCharacter: (characterId: string, patch: Partial<Character>) => void;
  availableStickers?: string[];
  sharedStickers?: string[];
  worldBooks?: WorldBookEntry[];
  perception?: PerceptionSettings;
  settings: Pick<AppSettings, 'activeConfigId' | 'configs' | 'apiCenterConfig' | 'sharedStickerMetadata'>;
};

type UseGroupChatRuntimeResult = {
  isLoading: boolean;
  error: string | null;
  pendingMessage: {
    speakerId: string;
    speakerName: string;
    speakerAvatar?: string;
    timestamp: number;
    text: string;
  } | null;
  sendText: () => Promise<void>;
  sendSpeechTranscript: (transcript: string) => Promise<void>;
  sendImageMessage: (imageValue: string) => Promise<void>;
  sendAudioMessage: (audioUrl: string, audioMimeType: string, durationSeconds?: number, audioTranscript?: string) => Promise<void>;
  sendStickerMessage: (sticker: string) => Promise<void>;
  sendLocationMessage: (location: { name: string; address?: string; isVirtual?: boolean }) => Promise<void>;
  sendPokeInteraction: (memberId: string) => Promise<void>;
  regenerateLatestReplyAt: (index: number) => Promise<boolean>;
  requestManualReply: () => Promise<void>;
  maybeOpenScene: () => Promise<void>;
  reactToNoticeUpdate: (params: {
    noticeText: string;
    currentHistory: ChatMessage[];
  }) => Promise<void>;
  handleReceiveTransfer: (index: number) => Promise<void>;
  handleRejectTransfer: (index: number) => Promise<void>;
};

const COUPLE_SPACE_INVITE_TOKEN = '[COUPLE_SPACE_INVITE]';
const COUPLE_SPACE_INVITE_ACCEPTED_TOKEN = '[COUPLE_SPACE_INVITE_ACCEPTED]';
const TRANSFER_BRACKET_REGEX = /\[转账\s*[\d.]+\]/ig;
const TRANSFER_BLOCK_REGEX = /\[transfer\]\s*[\d.]+\s*\[\/transfer\]/ig;

const EXTRA_SPEAKER_KEYWORDS = [
  '\u5176\u4ed6\u4eba',
  '\u522b\u4eba',
  '\u6362\u4e2a\u4eba',
  '\u53e6\u4e00\u4e2a\u4eba',
  '\u518d\u6765\u4e00\u4e2a',
  '\u518d\u8bf4\u4e00\u53e5',
];

const MENTION_REGEX = new RegExp('@([^\\s@,\\uFF0C\\u3002\\uFF01\\uFF1F!?]+)', 'g');

function wantsAnotherSpeaker(text: string): boolean {
  return EXTRA_SPEAKER_KEYWORDS.some((keyword) => text.includes(keyword));
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

function normalizeStickerPool(stickers: string[]): string[] {
  return Array.from(new Set(
    stickers
      .filter((sticker): sticker is string => typeof sticker === 'string' && sticker.trim().length > 0)
      .map((sticker) => sticker.trim()),
  ));
}

function collectSummaryTexts(items?: Array<{ summary: string }>): string[] {
  return (items || [])
    .map((item) => item.summary?.trim() || '')
    .filter(Boolean);
}

function buildStickerRecentTexts(messages: ChatMessage[]): string[] {
  return messages
    .slice(-8)
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

      return (getMessageMainText(message) || message.text || '').trim();
    })
    .filter(Boolean);
}

function isStickerChatMessage(message: Pick<ChatMessage, 'imageUrl' | 'text'>): boolean {
  return !!message.imageUrl && /^\[(?:sticker|表情包)\]/i.test((message.text || '').trim());
}

function buildSpeakerStickerUsageContext(
  messages: ChatMessage[],
  speakerId: string,
): Pick<AssistantStickerContext, 'recentStickerRefs' | 'recentStickerLabels' | 'lastOwnMessageWasSticker'> {
  const ownMessages = messages.filter((message) => (
    message.role === 'model'
    && message.senderCharacterId === speakerId
    && !message.isSystem
    && !message.isRecalled
    && !message.isInnerVoice
  ));

  const latestOwnVisibleMessage = [...ownMessages].reverse().find((message) => (
    isUsableChatText((message.text || '').trim()) || !!message.imageUrl
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

function buildGroupStickerSceneHints(sceneInput: GroupChatSceneInput): string[] {
  return [
    sceneInput.relationshipSummary,
    sceneInput.groupBehaviorGuide || '',
    ...sceneInput.peerAwareness,
    sceneInput.recentContext?.shortTermSummary || '',
    sceneInput.recentContext?.longTermMemoryProfile || '',
    sceneInput.recentContext?.temporalContext || '',
    sceneInput.recentContext?.activeDatingSummary || '',
    sceneInput.recentContext?.groupSceneHint || '',
    sceneInput.recentContext?.groupShortTermSummary || '',
    sceneInput.recentContext?.groupMemberPerspectiveSummary || '',
    sceneInput.recentContext?.groupLongTermAtmosphere || '',
    sceneInput.recentContext?.groupRecurringDynamics || '',
    sceneInput.recentContext?.groupSharedHistory || '',
    sceneInput.recentContext?.speakerLongTermGroupRole || '',
    sceneInput.recentContext?.backgroundSummary || '',
    sceneInput.recentContext?.memberRelationshipState || '',
    sceneInput.recentContext?.currentScene || '',
    sceneInput.recentContext?.publicFacts || '',
    sceneInput.recentContext?.topicStatePrompt || '',
    sceneInput.recentContext?.worldBookPrompt || '',
    sceneInput.recentContext?.expressionStyle || '',
    sceneInput.recentContext?.boundaryPack || '',
    sceneInput.recentContext?.publicAcquaintanceSummary || '',
    sceneInput.recentContext?.sharedRecentRelationshipSummary || '',
    sceneInput.recentContext?.relationshipTensionSummary || '',
    sceneInput.recentContext?.sharedCharacterStatePrompt || '',
    ...collectSummaryTexts(sceneInput.recentContext?.relationshipResidue),
    ...collectSummaryTexts(sceneInput.recentContext?.topicAnchors),
    ...collectSummaryTexts(sceneInput.recentContext?.taskResidue),
  ].filter(Boolean);
}

function buildGroupAudioMessageKey(message: Pick<ChatMessage, 'timestamp' | 'senderCharacterId' | 'text'>) {
  return `${message.timestamp}::${message.senderCharacterId || ''}::${message.text}`;
}

export function buildGroupHistoryMessageKey(message: Pick<
  ChatMessage,
  'timestamp' | 'role' | 'senderCharacterId' | 'text' | 'imageUrl' | 'contentType' | 'isSystem' | 'isRecalled'
>) {
  return [
    message.timestamp,
    message.role,
    message.senderCharacterId || '',
    message.text || '',
    message.imageUrl || '',
    message.contentType || '',
    message.isSystem ? 'system' : 'normal',
    message.isRecalled ? 'recalled' : 'visible',
  ].join('::');
}

export function appendUniqueGroupHistoryMessages(
  history: ChatMessage[],
  nextMessages: ChatMessage[],
): ChatMessage[] {
  if (nextMessages.length === 0) {
    return history;
  }

  const seenKeys = new Set(history.map((message) => buildGroupHistoryMessageKey(message)));
  const mergedHistory = [...history];

  nextMessages.forEach((message) => {
    const key = buildGroupHistoryMessageKey(message);
    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    mergedHistory.push(message);
  });

  return mergedHistory;
}

function buildCharacterEvidence(character: Character): string {
  const corePersona = buildCharacterContext({ character }).corePersona;

  return [
    corePersona,
    character.expressionStyle,
    character.signature,
    character.sceneHints?.groupChat,
  ]
    .filter((value): value is string => !!value?.trim())
    .join('\n')
    .toLowerCase();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveCharacterByPublicName(name: string, members: Character[]): Character | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return members.find((member) => {
    const aliases = [member.name, member.remarkName]
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => !!value);
    return aliases.includes(normalized);
  }) || null;
}

function matchesExplicitTargetAlias(text: string, alias: string): boolean {
  const trimmedAlias = alias.trim();
  if (!trimmedAlias) {
    return false;
  }

  const escapedAlias = escapeRegExp(trimmedAlias);
  const patterns = [
    new RegExp(`(?:^|[\\s,，。！？!?])@${escapedAlias}(?=$|[\\s,，。！？!?])`, 'i'),
    new RegExp(`(?:^|[\\s,，。！？!?])${escapedAlias}(?:你|你们|来|来说|先来|先说|说下|说说|回|回答|回下|接|接一下)(?=$|[\\s,，。！？!?])`, 'i'),
    new RegExp(`(?:^|[\\s,，。！？!?])(?:让|叫)${escapedAlias}(?:来|先来|回答|说|说下|回)(?=$|[\\s,，。！？!?])`, 'i'),
    new RegExp(`(?:^|[\\s,，。！？!?])${escapedAlias}(?=[\\s,，。！？!?]|$)`, 'i'),
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function inferGroupSpeakerWeight(character: Character, userText: string): number {
  const evidence = buildCharacterEvidence(character);
  const normalizedUserText = userText.toLowerCase();
  let score = 1;

  if (includesAny(evidence, ['带头', '主导', '组织', '安排', '掌控'])) {
    score += 1.2;
  }

  if (includesAny(evidence, ['毒舌', '爱接梗', '起哄', '嘴硬', '爱逗', '插嘴'])) {
    score += 1;
  }

  if (includesAny(evidence, ['护短', '护着', '偏心', '占有'])) {
    score += includesAny(normalizedUserText, ['你们', '他', '她']) ? 0.9 : 0.4;
  }

  if (includesAny(evidence, ['话少', '冷淡', '克制', '安静', '沉默'])) {
    score -= 0.5;
  }

  return Math.max(score, 0.2);
}

function inferReadableSpeakerWeight(character: Character, userText: string): number {
  const evidence = buildCharacterEvidence(character);
  const normalizedUserText = userText.toLowerCase();
  let score = 1;

  if (includesAny(evidence, ['带头', '主导', '组织', '安排', '掌控'])) {
    score += 1.2;
  }

  if (includesAny(evidence, ['毒舌', '爱接梗', '起哄', '嘴硬', '爱逗', '插嘴', '吐槽'])) {
    score += 1;
  }

  if (includesAny(evidence, ['护短', '护着', '偏心', '占有'])) {
    score += includesAny(normalizedUserText, ['你们', '他', '她']) ? 0.9 : 0.4;
  }

  if (includesAny(evidence, ['话少', '冷淡', '克制', '安静', '沉默'])) {
    score -= 0.5;
  }

  return Math.max(score, 0.2);
}

function buildRuntimeMessages(params: {
  systemPrompt: string;
  liveHistory: ChatMessage[];
  mode: 'reply' | 'invited' | 'opening';
  replyTarget?: ChatMessage['replyTo'] | null;
  speechActInstruction?: string;
  continuityMode: 'continuous_scene' | 'same_day_resume' | 'resume_after_gap';
  nowTimestamp: number;
}): RuntimeChatMessage[] {
  const historyMessages = params.liveHistory
    .filter((message) => !message.isSystem)
    .map<RuntimeChatMessage>((message) => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: getGroupPromptTextForMessage(message, {
        continuityMode: params.continuityMode,
        nowTimestamp: params.nowTimestamp,
      }),
      ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
      ...(message.audioUrl ? { audioUrl: message.audioUrl, audioMimeType: message.audioMimeType } : {}),
    }))
    .filter((message) => !!message.content.trim() || !!message.imageUrl || !!message.audioUrl);

  const latestVisibleMessage = [...params.liveHistory]
    .reverse()
    .find((message) => !message.isSystem) || null;
  const latestMessageFromUser = latestVisibleMessage?.role === 'user';

  const instructionByMode: Record<'reply' | 'invited' | 'opening', string> = {
    reply: latestMessageFromUser
      ? 'Reply as the current speaker using short live group-chat beats. Do not answer the whole topic too completely. Prefer 1 to 3 short bubbles that leave a natural hook, angle, tease, doubt, or small opening that other people in the group could naturally pick up.'
      : 'Reply as the current speaker using short live group-chat beats. Prefer 1 to 3 short bubbles and keep the exchange open enough that someone else in the group could naturally continue it.',
    invited: 'Reply as the current speaker using short live group-chat beats. You were just invited or @mentioned to speak, so you may answer briefly, selectively, and in 1 to 3 short bubbles instead of one full answer. Avoid wrapping up the whole topic by yourself.',
    opening: 'Send a brief opening as the current speaker using short live group-chat beats. Keep it natural, brief, and closer to short bubbles than one complete paragraph.',
  };

  const replyTargetInstruction = params.replyTarget
    ? `You are replying to ${params.replyTarget.authorLabel}: "${params.replyTarget.preview}". Keep your message aligned with that target, and do not drift to a different person or topic while keeping the reply marker.${params.replyTarget.role === 'model' ? ' Treat this like live back-and-forth with that person in the group, not a fresh answer to the user.' : ''}`
    : '';

  return [
    { role: 'system', content: params.systemPrompt },
    ...historyMessages,
    { role: 'user', content: [instructionByMode[params.mode], params.speechActInstruction || '', replyTargetInstruction].filter(Boolean).join('\n') },
  ];
}

function buildStructuredGroupAssistantReplyPrompt(): string {
  return [
    '## 群聊统一回复协议',
    `如果本轮有可显示的群聊正文，优先只输出一个可机读协议，格式固定为：${STRUCTURED_ASSISTANT_REPLY_TOKEN} {"items":[{"kind":"text","text":"第一条群聊消息"}]}`,
    'items 的顺序就是最终群聊气泡顺序；普通群聊主回复只使用 text item，最多 3 个。',
    '每个 text item 的 text 都必须是一条最终可显示的群聊消息，不要再写说话人前缀，不要写解释、注释、代码块或额外字段。',
    '如果需要 [reply: Name]、[notice]、[recall] 或 [sticker] 这类轻量 cue，把 cue 直接写进对应 text 字段里。',
    '除非后续系统另行要求，不要输出 game_card、transfer、token 等其他 item。',
  ].join('\n');
}

function normalizeGeneratedReply(text: string, speaker: Character): string {
  const structuredPreview = extractStructuredAssistantReplyPreviewText(text);
  if (structuredPreview) {
    return structuredPreview;
  }

  return stripAssistantSpeakerPrefix(text, [
    speaker.name,
    speaker.remarkName?.trim() || '',
  ]);
}

function buildFailureText(detail: string): string {
  return `[\u7cfb\u7edf\u63d0\u793a] \u7fa4\u804a\u56de\u590d\u5931\u8d25\uff1a${detail}`;
}

function stripTransferProtocolText(text: string): string {
  return text
    .replace(TRANSFER_BLOCK_REGEX, '')
    .replace(TRANSFER_BRACKET_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getMessageMainText(message: ChatMessage): string {
  const text = message.text || '';
  if (message.role === 'model') {
    let normalized = text.trim();
    // Strip only the outer speaker label. Reply cues like "[reply: Name]" are part of the content,
    // not a second sender prefix.
    const senderPrefix = /^(?!\[)[^:：\n]{1,24}[:：]\s*/u;
    if (senderPrefix.test(normalized)) {
      normalized = normalized.replace(senderPrefix, '').trim();
    }
    return normalized;
  }
  return text.trim();
}

function getPromptTextForMessage(message: ChatMessage): string {
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

  const text = getMessageMainText(message);
  return isUsableChatText(text) ? normalizeChatPunctuationNoise(text) : '';
}

function formatGroupPromptTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function formatGroupPromptAge(timestamp: number, nowTimestamp: number): string {
  const diffMinutes = Math.max(0, Math.floor((nowTimestamp - timestamp) / 60000));
  if (diffMinutes < 60) return diffMinutes < 1 ? '刚刚' : `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${Math.floor(diffHours / 24)} 天前`;
}

function getGroupPromptTextForMessage(
  message: ChatMessage,
  options: {
    continuityMode: 'continuous_scene' | 'same_day_resume' | 'resume_after_gap';
    nowTimestamp: number;
  },
): string {
  const baseText = getPromptTextForMessage(message);
  if (!baseText) {
    return '';
  }

  if (options.continuityMode === 'continuous_scene') {
    return baseText;
  }

  return `[发送时间 ${formatGroupPromptTimestamp(message.timestamp)} / 相对现在 ${formatGroupPromptAge(message.timestamp, options.nowTimestamp)}] ${baseText}`;
}

function buildReplyPreviewPayload(message: ChatMessage, fallbackAuthor: string): NonNullable<ChatMessage['replyTo']> {
  const mainText = getMessageMainText(message);
  return {
    text: mainText || message.text,
    role: message.role,
    timestamp: message.timestamp,
    authorLabel: fallbackAuthor,
    preview: mainText.replace(/\r?\n+/g, ' ').trim().slice(0, 120) || '[消息]',
  };
}

function isSameReplyTarget(
  left: ChatMessage['replyTo'] | null | undefined,
  right: ChatMessage['replyTo'] | null | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return left.timestamp === right.timestamp
    && left.role === right.role
    && left.preview === right.preview
    && left.authorLabel === right.authorLabel;
}

function buildReplyTargetKey(replyTo: ChatMessage['replyTo'] | null | undefined): string | null {
  if (!replyTo) {
    return null;
  }

  return [replyTo.timestamp, replyTo.role, replyTo.authorLabel, replyTo.preview].join('::');
}

function getGroupStageMultiplier(stage: ChatGroup['groupStage'] | undefined): number {
  if (stage === 'familiar') return 1.2;
  if (stage === 'warming') return 1;
  return 0.8;
}

function hasSenderCharacterId(message: ChatMessage): message is ChatMessage & { senderCharacterId: string } {
  return typeof message.senderCharacterId === 'string' && message.senderCharacterId.trim().length > 0;
}

export function parseGroupActionCue(segment: string): {
  kind: 'normal' | 'reply' | 'notice' | 'sticker' | 'recall';
  content: string;
  replyTargetName?: string;
} {
  const trimmed = segment.trim();
  const normalized = trimmed.replace(/^[\s"'`“”‘’?!？！,，。.…·:：;；]+/, '');
  const replyMatch = normalized.match(/^\[(?:quote|reply|reply to|回复)\s*[:：]\s*([^\]]+)\]\s*(.*)$/i);
  if (replyMatch) {
    return {
      kind: 'reply',
      replyTargetName: replyMatch[1].trim(),
      content: replyMatch[2].trim(),
    };
  }

  const relaxedReplyMatch = normalized.match(/^\[(?:quote|reply(?:\s+to)?|\u56de\u590d)\s*(?:[:：]|\s)\s*@?([^\]]+?)\]\s*(.*)$/i);
  if (relaxedReplyMatch) {
    return {
      kind: 'reply',
      replyTargetName: relaxedReplyMatch[1].trim(),
      content: relaxedReplyMatch[2].trim(),
    };
  }

  const normalizedReplyCueFallback = normalized.match(/^\[(?:quote|reply(?:\s+to)?|\u56de\u590d)\s*(?:[:：]|\s)\s*@?([^\]]+?)\]\s*(.*)$/i);
  if (normalizedReplyCueFallback) {
    return {
      kind: 'reply',
      replyTargetName: normalizedReplyCueFallback[1].trim(),
      content: normalizedReplyCueFallback[2].trim(),
    };
  }

  const noticeMatch = normalized.match(/^\[(?:notice|system)\]\s*(.*)$/i);
  if (noticeMatch) {
    return {
      kind: 'notice',
      content: noticeMatch[1].trim(),
    };
  }

  const recallMatch = normalized.match(/^\[(?:recall|withdraw)\]\s*(.*)$/i);
  if (recallMatch) {
    return {
      kind: 'recall',
      content: recallMatch[1].trim(),
    };
  }

  const stickerMatch = normalized.match(/^\[(?:sticker|image|表情包|图片)\]\s*(.*)$/i);
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

function splitLongChatClause(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= 22) {
    return [normalized];
  }

  const commaParts = normalized
    .replace(/([\uFF0C,])/g, '$1\n')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (commaParts.length <= 1) {
    return [normalized];
  }

  const chunks: string[] = [];
  let current = '';

  for (const part of commaParts) {
    const nextValue = current ? `${current}${part}` : part;
    if (current && nextValue.length > 24) {
      chunks.push(current.trim());
      current = part;
      continue;
    }

    current = nextValue;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 1 ? chunks : [normalized];
}

function splitRhythmicChatClause(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const parts = normalized
    .replace(/([\uFF0C,])/g, '$1\n')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return [normalized];
  }

  const chunks: string[] = [];
  let current = '';

  for (const part of parts) {
    const cleanPart = part.trim();
    const currentLength = current.replace(/[\uFF0C,\s]/g, '').length;
    const partLength = cleanPart.replace(/[\uFF0C,\s]/g, '').length;
    const shouldBreak =
      !!current && (
        currentLength >= 7
        || partLength >= 9
        || /[?？!！]$/.test(current)
        || /^(快|先|那|行|走|别|要不|不然|不过|所以|然后|哥哥|搭档|行吧|等等|哦|欸|诶)/.test(cleanPart)
      );

    if (shouldBreak) {
      chunks.push(current.trim());
      current = cleanPart;
      continue;
    }

    current = current ? `${current}${cleanPart}` : cleanPart;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 1 ? chunks : [normalized];
}

function splitReadableRhythmicChatClause(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const parts = normalized
    .replace(/([\uFF0C,])/g, '$1\n')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return [normalized];
  }

  const chunks: string[] = [];
  let current = '';

  for (const part of parts) {
    const cleanPart = part.trim();
    const currentLength = current.replace(/[\uFF0C,\s]/g, '').length;
    const partLength = cleanPart.replace(/[\uFF0C,\s]/g, '').length;
    const shouldBreak =
      !!current && (
        currentLength >= 7
        || partLength >= 9
        || /[?？!！]$/.test(current)
        || /^(快|先|那|行|走|别|要不|不然|不过|所以|然后|哥哥|搭档|行吧|等等|哦|欸|诶|不是|得了|行了)/.test(cleanPart)
      );

    if (shouldBreak) {
      chunks.push(current.trim());
      current = cleanPart;
      continue;
    }

    current = current ? `${current}${cleanPart}` : cleanPart;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 1 ? chunks : [normalized];
}

function splitByChatActionBeats(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const candidateParts = normalized
    .replace(/([。！？!?；;…]+|[，,])/gu, '$1\n')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (candidateParts.length <= 1) {
    return [normalized];
  }

  const isShortReactionBubble = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^(嗯|嗯嗯|嗯哼|哦|喔|哈|呵|欸|诶|哎|行|滚|操|草|？|\?|……|…)$/.test(trimmed)) {
      return true;
    }
    return trimmed.length <= 6 && /[?？!！…]+$/.test(trimmed);
  };

  const isShortEvaluationBubble = (value: string) => {
    const trimmed = value.trim().replace(/[。！？!?，,；;…]+$/u, '');
    if (!trimmed || trimmed.length > 10) return false;
    return /^(你正常点|真服了|我觉得很可爱|没眼看|你有病吧|别太离谱|差不多得了|少来这套|还.+呢)$/.test(trimmed);
  };

  const isShortAddressingBubble = (value: string) => {
    const trimmed = value.trim().replace(/[。！？!?，,；;…]+$/u, '');
    if (!trimmed || trimmed.length > 12) return false;
    return /^(小回|张白|大鹅|搭档|哥|姐姐|哥哥|你)[^，。！？!?]*$/.test(trimmed);
  };

  const chunks: string[] = [];
  let current = '';

  for (const part of candidateParts) {
    const cleanPart = part.trim();
    const currentLength = current.replace(/\s/g, '').length;
    const partLength = cleanPart.replace(/\s/g, '').length;
    const actionFirst = isShortReactionBubble(cleanPart) || isShortEvaluationBubble(cleanPart) || isShortAddressingBubble(cleanPart);
    const currentIsAction = isShortReactionBubble(current) || isShortEvaluationBubble(current) || isShortAddressingBubble(current);
    const shouldBreak =
      !!current && (
        actionFirst
        || currentIsAction
        || currentLength >= 16
        || (currentLength >= 9 && partLength >= 9)
      );

    if (shouldBreak) {
      chunks.push(current.trim());
      current = cleanPart;
      continue;
    }

    current = current ? `${current}${cleanPart}` : cleanPart;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 1 ? chunks : [normalized];
}

function splitByNaturalChatBeats(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const candidateParts = normalized
    .replace(/([\u3002\uFF01\uFF1F!?\uFF1B;…]+)/gu, '$1\n')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (candidateParts.length <= 1) {
    return [normalized];
  }

  const stripEndingPunctuation = (value: string) => value.trim().replace(/[\u3002\uFF01\uFF1F!?\uFF0C,\uFF1B;…]+$/u, '');

  const isShortReactionBubble = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^(?:\u55ef|\u55ef\u55ef|\u55ef\u54fc|\u54e6|\u5594|\u54c8|\u5475|\u6b38|\u8bf6|\u54ce|\u884c|\u6eda|\u64cd|\u8349|\uFF1F|\?|\u2026\u2026|\u2026)$/.test(trimmed)) {
      return true;
    }
    return trimmed.length <= 6 && /[\uFF1F?!\u2026]+$/.test(trimmed);
  };

  const isShortEvaluationBubble = (value: string) => {
    const trimmed = stripEndingPunctuation(value);
    if (!trimmed || trimmed.length > 10) return false;
    return /^(?:\u4f60\u6b63\u5e38\u70b9|\u771f\u670d\u4e86|\u6211\u89c9\u5f97\u5f88\u53ef\u7231|\u6ca1\u773c\u770b|\u4f60\u6709\u75c5\u5427|\u522b\u592a\u79bb\u8c31|\u5dee\u4e0d\u591a\u5f97\u4e86|\u5c11\u6765\u8fd9\u5957|\u8fd8.+\u5462)$/.test(trimmed);
  };

  const isShortAddressingBubble = (value: string) => {
    const trimmed = stripEndingPunctuation(value);
    if (!trimmed || trimmed.length > 12) return false;
    return /^(?:\u5c0f\u56de|\u5f20\u767d|\u5927\u9e45|\u642d\u6863|\u54e5|\u59d0\u59d0|\u54e5\u54e5|\u4f60)[^\uFF0C,\u3002\uFF01\uFF1F!?]*$/.test(trimmed);
  };

  const chunks: string[] = [];
  let current = '';

  for (const part of candidateParts) {
    const cleanPart = part.trim();
    const currentLength = current.replace(/\s/g, '').length;
    const partLength = cleanPart.replace(/\s/g, '').length;
    const actionFirst = isShortReactionBubble(cleanPart) || isShortEvaluationBubble(cleanPart) || isShortAddressingBubble(cleanPart);
    const currentIsAction = isShortReactionBubble(current) || isShortEvaluationBubble(current) || isShortAddressingBubble(current);
    const shouldBreak =
      !!current && (
        actionFirst
        || currentIsAction
        || currentLength >= 16
        || (currentLength >= 9 && partLength >= 9)
      );

    if (shouldBreak) {
      chunks.push(current.trim());
      current = cleanPart;
      continue;
    }

    current = current ? `${current}${cleanPart}` : cleanPart;
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 1 ? chunks : [normalized];
}

function normalizeInnerCommaSpacing(value: string): string {
  let normalized = '';

  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    const previous = index > 0 ? value[index - 1] : '';
    const next = index < value.length - 1 ? value[index + 1] : '';
    const isInnerComma = (current === ',' || current === '，')
      && /[\u4e00-\u9fffA-Za-z0-9]/.test(previous)
      && /[\u4e00-\u9fffA-Za-z0-9]/.test(next);

    normalized += isInnerComma ? ' ' : current;
  }

  return normalized;
}

function normalizeShortBubbleEnding(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return normalized;
  }

  const stripped = normalized.replace(/[\u3002\uFF01\uFF1F!?\uFF0C,\uFF1B;…]+$/u, '');
  const bareLength = stripped.length;
  const isShortChatBeat = bareLength <= 12;
  const looksLikeNaturalShortMessage =
    /^(?:[\u4e00-\u9fffA-Za-z0-9]+(?:[\u4e00-\u9fffA-Za-z0-9\s]+)?|[\u4e00-\u9fffA-Za-z0-9]+[\u2026]+)$/.test(stripped)
    && !/^(?:为什么|凭什么|怎么|谁|哪|什么|真的假的|是不是|要不要|行不行)/.test(stripped);

  const shouldDropEnding =
    isShortChatBeat
    && looksLikeNaturalShortMessage
    && (
      /^(?:我在|你继续|行啊|来啊|不是吧|真服了|你正常点|还奖励呢|小回别真信她|大鹅你少拱火|没眼看|我觉得很可爱|滚|行|呵|哈|嗯|嗯嗯|哦|喔|诶|欸)/.test(stripped)
      || bareLength <= 6
    );

  if (shouldDropEnding) {
    return stripped;
  }

  return normalized;
}

function normalizeChatMessageEnding(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return normalized;
  }

  const stripped = normalized.replace(/[\u3002\uFF01\uFF1F!?\uFF0C,\uFF1B;\u2026]+$/u, '');
  if (!stripped) {
    return normalized;
  }

  const normalizedInnerPunctuation = normalizeInnerCommaSpacing(stripped)
    .replace(/\s+/g, ' ')
    .trim();

  const bareLength = normalizedInnerPunctuation.length;
  const endsWithQuestionLike = /[\uFF1F?]$/.test(normalized);
  const endsWithExclaimLike = /[\uFF01!]$/.test(normalized);
  const hasPauseDots = /[\u2026]+$/.test(normalized);

  const isChallengeOrQuestion =
    /^(?:\u4e3a\u4ec0\u4e48|\u51ed\u4ec0\u4e48|\u600e\u4e48|\u8c01|\u54ea|\u4ec0\u4e48|\u771f\u7684\u5047\u7684|\u662f\u4e0d\u662f|\u8981\u4e0d\u8981|\u884c\u4e0d\u884c|\u51ed\u5565)/.test(normalizedInnerPunctuation);

  const isStrongEmotion =
    /^(?:\u5475|\u54c8|\u7b11\u6b7b|\u6eda|\u64cd|\u8349|\u4f60\u6709\u75c5\u5427|\u771f\u79bb\u8c31|\u79bb\u8c31)/.test(normalizedInnerPunctuation);

  const looksLikeChatMessage =
    /^(?:[\u4e00-\u9fffA-Za-z0-9]+(?:[\u4e00-\u9fffA-Za-z0-9\s]+)*)$/.test(normalizedInnerPunctuation)
    && bareLength <= 30;

  const isNaturalStatementLead =
    /^(?:\u90a3|\u8fd9|\u963f\u59e8|\u6211\u4eec|\u5979|\u4ed6|\u4f60|\u6211|\u8fd9\u4e2a|\u8fd9\u79cd|\u5176\u5b9e|\u53cd\u6b63|\u8981\u6211\u8bf4|\u770b\u8d77\u6765|\u542c\u8d77\u6765|\u611f\u89c9|\u90a3\u5c31|\u662f\u8fd9\u6837|\u8bf4\u767d\u4e86|\u6211\u89c9\u5f97|\u6211\u770b|\u6211\u60f3)/.test(normalizedInnerPunctuation);

  const isNaturalConversationalStatement =
    /^(?:\u90a3\u5c31|\u8fd9\u4e2a|\u6211\u4eec|\u5979\u53ef\u80fd|\u4ed6\u53ef\u80fd|\u6211\u5148|\u6211\u770b|\u6211\u89c9\u5f97|\u6211\u60f3|\u5176\u5b9e|\u53cd\u6b63|\u5c31\u662f|\u672c\u6765|\u5e94\u8be5|\u53ef\u80fd\u662f|\u542c\u8d77\u6765|\u770b\u8d77\u6765|\u8bf4\u767d\u4e86|\u6211\u4eec\u7fa4\u91cc|\u7fa4\u91cc\u6709\u4e2a|\u8fd9\u4e8b|\u8fd9\u8bdd|\u8fd9\u79cd\u8bdd|\u8fd9\u5c31|\u8fd9\u4e0b|\u6211\u5148\u6536\u4e0b\u4e86|\u6211\u4eec\u90fd\u662f|\u8bf4\u5b9a\u4e86|\u5728\u7b49|\u987a\u4fbf\u786e\u8ba4|\u6bd5\u7adf|\u6211\u5728\u770b)/.test(normalizedInnerPunctuation);

  const isLightTeaseOrJealousLine =
    /^(?:\u8fd9\u4e00\u53e3|\u4f60\u73b0\u5728|\u773c\u91cc|\u5012\u662f|\u521a\u624d\u4e0d\u662f|\u8fd8\u633a\u4f1a|\u8fd8\u771f\u662f|\u8fd9\u5c31\u5f00\u59cb|\u4e00\u53e3\u4e00\u4e2a|\u8001\u5b9e\u5f85\u7740|\u65e2\u7136.+\u8fd8\u8981\u5fd9)/.test(normalizedInnerPunctuation);

  const isLightConfirmation =
    /^(?:\u77e5\u9053\u4e86|\u8fd8\u6ca1|\u5728\u5462|\u6765\u4e86|\u6536\u5230|\u53ef\u4ee5|\u884c|\u884c\u554a|\u884c\u5427|\u6ca1\u4e8b|\u5148\u653e\u7740|\u8001\u5b9e\u5f85\u7740)$/.test(normalizedInnerPunctuation);

  const isLightQuestion =
    /^(?:\u73b0\u5728|\u4f60|\u5907\u6ce8|\u6539\u6210|\u521a\u624d|\u8fd8\u6ca1|\u8fd8\u6ca1\u600e\u4e48|\u6539\u4e86|\u4fee\u597d|\u641e\u5b9a|\u773c\u91cc|\u8fd8\u6709\u6ca1\u6709|\u4f60\u8fd8|\u5728\u7b49|\u987a\u4fbf\u786e\u8ba4)/.test(normalizedInnerPunctuation)
    && bareLength <= 20
    && !isChallengeOrQuestion;

  const hasSarcasmOrPressureTone =
    /(?:\u5462|\u5427|\u54e6|\u5466)$/.test(normalizedInnerPunctuation)
    && /^(?:\u4f60|\u521a\u624d|\u8fd8|\u5c31|\u600e\u4e48|\u539f\u6765|\u90a3\u4f60)/.test(normalizedInnerPunctuation);

  const needsPauseFeeling =
    /(?:\u7136\u540e|\u4e0d\u8fc7|\u4f46\u662f|\u800c\u4e14|\u6240\u4ee5).{8,}$/.test(normalizedInnerPunctuation);

  const isCompactChatBeat =
    bareLength <= 12
    && /^(?:\u6211\u5728|\u4f60\u7ee7\u7eed|\u884c\u554a|\u6765\u554a|\u4e0d\u662f\u5427|\u771f\u670d\u4e86|\u4f60\u6b63\u5e38\u70b9|\u8fd8\u5956\u52b1\u5462|\u5c0f\u56de\u522b\u771f\u4fe1\u5979|\u5927\u9e45\u4f60\u5c11\u62f1\u706b|\u6ca1\u773c\u770b|\u6211\u89c9\u5f97\u5f88\u53ef\u7231|\u4f60\u8bf4|\u4f60\u6765)$/.test(normalizedInnerPunctuation);

  const shouldDropQuestionMark =
    endsWithQuestionLike
    && isLightQuestion
    && !hasSarcasmOrPressureTone
    && !isStrongEmotion
    && !needsPauseFeeling;

  const shouldDropEnding =
    (!endsWithQuestionLike || shouldDropQuestionMark)
    && !endsWithExclaimLike
    && !hasPauseDots
    && !isChallengeOrQuestion
    && !isStrongEmotion
    && !hasSarcasmOrPressureTone
    && !needsPauseFeeling
    && (
      isCompactChatBeat
      || isLightConfirmation
      || (looksLikeChatMessage && isNaturalStatementLead)
      || (looksLikeChatMessage && isNaturalConversationalStatement)
      || (looksLikeChatMessage && isLightTeaseOrJealousLine)
      || (looksLikeChatMessage && bareLength <= 6)
      || (
        looksLikeChatMessage
        && bareLength <= 24
        && /(?:\u8bf4\u5b9a\u4e86|\u6709\u4e2a\u68d7|\u5f00\u73a9\u7b11\u7684|\u5148\u6536\u4e0b\u4e86|\u90fd\u662f.+\u670b\u53cb)$/.test(normalizedInnerPunctuation)
      )
    );

  if (shouldDropEnding) {
    return normalizedInnerPunctuation;
  }

  return normalized;
}

function normalizeConversationalParticleLead(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const particleMatch = normalized.match(/^(啧|啊|哟|得了|不是吧|行啊|诶|欸|喂)[，,\s]+(.+)$/);
  if (!particleMatch) {
    return [normalized];
  }

  const [, particle, tail] = particleMatch;
  const trimmedTail = normalizeChatMessageEnding(tail.trim());
  if (!trimmedTail) {
    return [particle];
  }

  const tailLength = trimmedTail.replace(/\s/g, '').length;
  const particlePrefersStandalone =
    /^(啧|哟|不是吧)$/.test(particle);
  const tailLooksLikeStandaloneMessage =
    particlePrefersStandalone
    && tailLength >= 7
    && /^(这一口|你这|我在|毕竟|顺便|现在|眼里|还真|那就|我们|她|他|你|我)/.test(trimmedTail);

  if (tailLooksLikeStandaloneMessage) {
    return [particle, trimmedTail];
  }

  return [`${particle} ${trimmedTail}`.trim()];
}

const GROUP_MAX_BUBBLES = 3;

function splitStructuredGroupReplyEnvelopeIntoMessages(
  text: string,
  speaker: Character,
  baseTimestamp = Date.now(),
): ChatMessage[] | null {
  const envelope = parseStructuredAssistantReplyEnvelope(text);
  if (!envelope) {
    return null;
  }

  const messages: ChatMessage[] = [];
  for (const item of envelope.items.slice(0, GROUP_MAX_BUBBLES)) {
    if (item.kind === 'text') {
      const normalizedText = item.text.trim();
      if (!normalizedText) {
        continue;
      }

      const cue = parseGroupActionCue(normalizedText);
      messages.push({
        role: 'model',
        text: cue.kind === 'notice' ? `[notice] ${cue.content || normalizedText}` : `${speaker.name}: ${normalizedText}`,
        timestamp: baseTimestamp + messages.length,
        senderCharacterId: speaker.id,
        ...(item.translation?.trim() ? { translation: item.translation.trim() } : {}),
        isSystem: cue.kind === 'notice' ? true : undefined,
      });
      continue;
    }

    if (item.kind === 'game_card') {
      messages.push({
        role: 'model',
        text: `[GAME_CARD] ${JSON.stringify(item.payload)}`,
        contentType: 'game-card',
        senderCharacterId: speaker.id,
        timestamp: baseTimestamp + messages.length,
        ...(item.translation?.trim() ? { translation: item.translation.trim() } : {}),
      });
      continue;
    }

    if (item.kind === 'transfer') {
      messages.push({
        role: 'model',
        text: `[转账 ${item.amount}]`,
        contentType: 'transfer',
        transferStatus: 'pending',
        senderCharacterId: speaker.id,
        timestamp: baseTimestamp + messages.length,
      });
      continue;
    }

    messages.push({
      role: 'model',
      text: item.name === 'COUPLE_SPACE_INVITE' ? COUPLE_SPACE_INVITE_TOKEN : COUPLE_SPACE_INVITE_ACCEPTED_TOKEN,
      contentType: item.name === 'COUPLE_SPACE_INVITE' ? 'couple-space-invite' : 'couple-space-invite-accepted',
      senderCharacterId: speaker.id,
      timestamp: baseTimestamp + messages.length,
    });
  }

  return messages;
}

export function splitGroupReplyIntoMessages(text: string, speaker: Character, baseTimestamp = Date.now()): ChatMessage[] {
  const structuredMessages = splitStructuredGroupReplyEnvelopeIntoMessages(text, speaker, baseTimestamp);
  if (structuredMessages) {
    return structuredMessages;
  }

  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const paragraphParts = normalized
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const sourceSegments = paragraphParts.length > 1 ? paragraphParts : [normalized];
  const parts: string[] = [];

  for (const segment of sourceSegments) {
    if (parts.length >= GROUP_MAX_BUBBLES) {
      break;
    }

    const cue = parseGroupActionCue(segment);
    if (cue.kind !== 'normal') {
      parts.push(segment);
      continue;
    }

    const remainingBubbleSlots = GROUP_MAX_BUBBLES - parts.length;
    const splitParts = splitDirectAssistantReplyText(segment, remainingBubbleSlots)
      .map((part) => normalizeChatPunctuationNoise(part).trim())
      .filter(Boolean);

    if (splitParts.length === 0) {
      continue;
    }

    parts.push(...splitParts.slice(0, remainingBubbleSlots));
  }

  console.info('[group-chat] split reply parts', {
    speakerId: speaker.id,
    speakerName: speaker.name,
    original: normalized,
    partCount: parts.length,
    parts,
  });

  return parts.map((part, index) => {
    const cue = parseGroupActionCue(part);
    return {
      role: 'model' as const,
      text: cue.kind === 'notice' ? `[notice] ${cue.content}` : `${speaker.name}: ${part}`,
      timestamp: baseTimestamp + index,
      senderCharacterId: speaker.id,
      isSystem: cue.kind === 'notice' ? true : undefined,
    };
  });
}

export function useGroupChatRuntime({
  members,
  groupMeta,
  history,
  setHistory,
  input,
  setInput,
  replyingTo,
  setReplyingTo,
  userName,
  directChatHistory,
  patchCharacter,
  availableStickers = [],
  sharedStickers = [],
  worldBooks = [],
  perception,
  settings,
}: UseGroupChatRuntimeArgs): UseGroupChatRuntimeResult {
  const activeConfig = resolveSceneTextApiConfig({
    settings,
    scene: 'group-chat',
  }).runtimeConfig;
  const resolvedVoiceConfig = resolveSceneVoiceApiConfig({
    settings,
    mode: 'tts',
  });
  const voiceRuntimeConfig = resolvedVoiceConfig.runtimeConfig;
  const defaultTtsVoiceId = resolvedVoiceConfig.defaultVoiceId;
  const { isLoading, error, setError, activeGenerationIdRef, runGeneration } = useSessionRuntimeCore();
  const hasActiveConfig = !!activeConfig?.apiKey?.trim();
  const [pendingMessage, setPendingMessage] = useState<UseGroupChatRuntimeResult['pendingMessage']>(null);
  const delayedSpeakerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const activeInteractionIdRef = useRef(0);
  const openingRequestIdRef = useRef(0);
  const secondarySpeakerRequestIdRef = useRef(0);
  const historyRef = useRef(history);
  const manualReplyModeEnabled = groupMeta?.manualReplyEnabled !== false;
  const runtimeSharedStickers = normalizeStickerPool(
    (sharedStickers.length > 0 ? sharedStickers : availableStickers),
  );
  const runtimeSharedStickerMetadata = settings.sharedStickerMetadata || {};
  const runtimeAllStickerMetadata = members.reduce<Record<string, StickerMetadata>>((accumulator, member) => ({
    ...accumulator,
    ...(member.stickerMetadata || {}),
  }), {
    ...runtimeSharedStickerMetadata,
  });

  const getSpeakerStickerPool = (speaker: Character) => normalizeStickerPool([
    ...runtimeSharedStickers,
    ...(speaker.stickers || []),
  ]);
  const getSpeakerStickerMetadataMap = (speaker: Character) => ({
    ...runtimeSharedStickerMetadata,
    ...(speaker.stickerMetadata || {}),
  });

  const recordGroupSpeakerSettlement = useCallback(async (
    speaker: Character,
    messages: ChatMessage[],
    sharedState?: Character['sharedState'],
  ) => {
    const mainText = messages
      .filter((message) => !message.isSystem)
      .map((message) => getMessageMainText(message))
      .map((text) => text.trim())
      .filter(Boolean)
      .join(' ');
    const latestTimestamp = messages[messages.length - 1]?.timestamp ?? Date.now();
    if (!mainText) {
      return;
    }

    const settlement = buildGroupChatSharedSettlement(speaker, {
      speakerName: speaker.name,
      content: mainText,
      timestamp: latestTimestamp,
    });
    try {
      const result = await persistSceneSettlement({
        characterId: speaker.id,
        sourceScene: 'group_chat',
        settlement: {
          ...settlement,
          sharedState,
        },
        timestamp: latestTimestamp,
      });
      patchCharacter(speaker.id, result.characterPatch);
    } catch (error) {
      console.error('[group-chat] Failed to persist settlement memory snapshots', error);
      setError(error instanceof Error ? error.message : '群聊记忆结算失败，请稍后重试。');
    }
  }, [patchCharacter, setError]);

  const clearDelayedSpeakerTimer = useCallback(() => {
    if (delayedSpeakerTimerRef.current) {
      clearTimeout(delayedSpeakerTimerRef.current);
      delayedSpeakerTimerRef.current = null;
    }
  }, []);

  const getUsableGroupTopicState = useCallback((currentHistory: ChatMessage[]) => {
    const topicState = groupMeta?.topicState;
    if (!topicState?.anchor.trim() || topicState.phase === 'closing') {
      return undefined;
    }

    const latestVisibleTimestamp = [...currentHistory]
      .reverse()
      .find((message) => !message.isSystem && !message.isRecalled && (message.text || message.imageUrl || message.audioUrl))
      ?.timestamp ?? Date.now();
    const gapMs = latestVisibleTimestamp - topicState.lastUpdatedAt;
    const crossedDay = new Date(latestVisibleTimestamp).toDateString() !== new Date(topicState.lastUpdatedAt).toDateString();
    if (crossedDay || gapMs > 3 * 60 * 60 * 1000) {
      return undefined;
    }

    return topicState;
  }, [groupMeta?.topicState]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const commitHistory = useCallback((nextHistory: ChatMessage[]) => {
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, [setHistory]);

  const activeSpeakerMembers = useMemo(() => {
    const mutedMemberIds = new Set(groupMeta?.mutedMemberIds || []);
    return members.filter((member) => !mutedMemberIds.has(member.id));
  }, [groupMeta?.mutedMemberIds, members]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearDelayedSpeakerTimer();
    };
  }, [clearDelayedSpeakerTimer]);

  const pickWeightedMember = useCallback((
    weightedMembers: Array<{ member: Character; weight: number }>,
  ): Character | null => {
    const totalWeight = weightedMembers.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) {
      return weightedMembers[0]?.member ?? null;
    }

    let cursor = Math.random() * totalWeight;
    for (const item of weightedMembers) {
      cursor -= item.weight;
      if (cursor <= 0) {
        return item.member;
      }
    }

    return weightedMembers[weightedMembers.length - 1]?.member ?? null;
  }, []);

  const getPresenceParticipationWeight = useCallback((member: Character, currentHistory: ChatMessage[]): number => {
    const temporalState = buildCharacterTemporalState({
      characterId: member.id,
      perception,
      directChatHistory,
      groupMessages: currentHistory,
      sceneScope: 'group',
    });

    return computeGroupPresenceParticipationWeight(temporalState);
  }, [directChatHistory, perception]);

  const buildSpeakerSceneContext = useCallback((params: {
    speaker: Character;
    currentHistory: ChatMessage[];
    mode?: 'reply' | 'invited' | 'opening';
    requestTimestamp?: number;
  }) => {
    const requestTimestamp = params.requestTimestamp ?? Date.now();
    const temporalState = buildCharacterTemporalState({
      characterId: params.speaker.id,
      perception,
      directChatHistory,
      groupMessages: params.currentHistory,
      sceneScope: 'group',
    });
    const contextLayers = buildGroupContextLayers({
      messages: params.currentHistory,
      continuityMode: temporalState.continuityMode,
      nowTimestamp: requestTimestamp,
    });
    const sceneInput = buildGroupChatSceneInput({
      speaker: params.speaker,
      members,
      group: groupMeta
        ? {
            id: 'runtime-group-meta',
            name: '',
            memberIds: members.map((member) => member.id),
            creatorId: 'user',
            createdAt: 0,
            groupStage: groupMeta.groupStage,
            activeWorldBookIds: groupMeta.activeWorldBookIds,
            memberRelationSeeds: groupMeta.memberRelationSeeds,
            backgroundSummary: groupMeta.backgroundSummary,
            memberRelationshipState: groupMeta.memberRelationshipState,
            memberRelationshipNote: groupMeta.memberRelationshipNote,
            currentScene: groupMeta.currentScene,
            publicFacts: groupMeta.publicFacts,
            topicState: groupMeta.topicState,
            groupShortTermSummary: groupMeta.groupShortTermSummary,
            groupMemberPerspectiveSummaries: groupMeta.groupMemberPerspectiveSummaries,
            groupLongTermMemory: groupMeta.groupLongTermMemory,
            relationshipWaves: groupMeta.relationshipWaves,
            factTraces: groupMeta.factTraces,
          }
        : undefined,
      userName,
      history: contextLayers.liveMessages,
      mode: params.mode ?? 'reply',
      directChatHistory,
      activeWorldBooks: selectActiveGroupWorldBooks({
        speaker: params.speaker,
        group: groupMeta,
        worldBooks,
      }),
      perception,
      temporalContext: buildTemporalContextPrompt({
        perception,
        now: requestTimestamp,
      }),
    });
    const sharedState = sceneInput.recentContext
      ? buildPersistedSharedCharacterState({
          character: {
            shortTermSummary: sceneInput.recentContext.shortTermSummary,
          },
          temporalState,
          sceneScopedSignals: {
            relationshipResidue: sceneInput.recentContext.relationshipResidue,
            sceneResidue: undefined,
            topicAnchors: sceneInput.recentContext.topicAnchors,
            taskResidue: sceneInput.recentContext.taskResidue,
            sharedRecentRelationshipSummary: sceneInput.recentContext.sharedRecentRelationshipSummary,
            publicAcquaintanceSummary: sceneInput.recentContext.publicAcquaintanceSummary,
          },
          sourceScene: 'group_chat',
        })
      : undefined;

    return {
      temporalState,
      contextLayers,
      sceneInput,
      sharedState,
    };
  }, [
    directChatHistory,
    groupMeta?.activeWorldBookIds,
    groupMeta?.backgroundSummary,
    groupMeta?.currentScene,
    groupMeta?.groupLongTermMemory,
    groupMeta?.groupMemberPerspectiveSummaries,
    groupMeta?.groupShortTermSummary,
    groupMeta?.relationshipWaves,
    groupMeta?.factTraces,
    groupMeta?.groupStage,
    groupMeta?.memberRelationSeeds,
    groupMeta?.memberRelationshipNote,
    groupMeta?.memberRelationshipState,
    groupMeta?.publicFacts,
    groupMeta?.topicState,
    members,
    perception,
    userName,
    worldBooks,
  ]);

  const generateMessageForSpeaker = useCallback(async (params: {
    speaker: Character;
    currentHistory: ChatMessage[];
    mode: 'reply' | 'invited' | 'opening';
    replyTarget?: ChatMessage['replyTo'] | null;
    speechActInstruction?: string;
  }): Promise<{ text: string; timestamp: number; sharedState?: Character['sharedState']; stickerPool: string[] }> => {
    if (!activeConfig) {
      throw new Error('Missing active API config.');
    }

    const requestTimestamp = Date.now();
    const temporalState = buildCharacterTemporalState({
      characterId: params.speaker.id,
      perception,
      directChatHistory,
      groupMessages: params.currentHistory,
      sceneScope: 'group',
    });
    const contextLayers = buildGroupContextLayers({
      messages: params.currentHistory,
      continuityMode: temporalState.continuityMode,
      nowTimestamp: requestTimestamp,
    });
    const sceneInput = buildGroupChatSceneInput({
      speaker: params.speaker,
      members,
      group: groupMeta
        ? {
            id: 'runtime-group-meta',
            name: '',
            memberIds: members.map((member) => member.id),
            creatorId: 'user',
            createdAt: 0,
            groupStage: groupMeta.groupStage,
            activeWorldBookIds: groupMeta.activeWorldBookIds,
            memberRelationSeeds: groupMeta.memberRelationSeeds,
            backgroundSummary: groupMeta.backgroundSummary,
            memberRelationshipState: groupMeta.memberRelationshipState,
            memberRelationshipNote: groupMeta.memberRelationshipNote,
            currentScene: groupMeta.currentScene,
            publicFacts: groupMeta.publicFacts,
            topicState: groupMeta.topicState,
            groupShortTermSummary: groupMeta.groupShortTermSummary,
            groupMemberPerspectiveSummaries: groupMeta.groupMemberPerspectiveSummaries,
            groupLongTermMemory: groupMeta.groupLongTermMemory,
            relationshipWaves: groupMeta.relationshipWaves,
            factTraces: groupMeta.factTraces,
          }
        : undefined,
      userName,
      history: contextLayers.liveMessages,
      mode: params.mode,
      directChatHistory,
      activeWorldBooks: selectActiveGroupWorldBooks({
        speaker: params.speaker,
        group: groupMeta,
        worldBooks,
      }),
      perception,
      temporalContext: buildTemporalContextPrompt({
        perception,
        now: requestTimestamp,
      }),
    });
    const speakerStickerContext = {
      ...buildSpeakerStickerUsageContext(contextLayers.liveMessages, params.speaker.id),
      stickerMetadataMap: getSpeakerStickerMetadataMap(params.speaker),
    };
    const runtimeStickerPool = resolveAssistantStickerCandidates(getSpeakerStickerPool(params.speaker), {
      character: params.speaker,
      scene: 'group',
      latestUserText: [...contextLayers.liveMessages]
        .reverse()
        .find((message) => message.role === 'user' && getMessageMainText(message).trim())
        ?.text
        ?.trim(),
      recentTexts: buildStickerRecentTexts(contextLayers.liveMessages),
      sceneHints: buildGroupStickerSceneHints(sceneInput),
      ...speakerStickerContext,
    }).map((candidate) => candidate.sticker);
    const systemPrompt = [
      buildGroupChatPrompt({
        sceneInput,
      }),
      buildOpenLoopRegistryPrompt({
        existingEntries: buildResolvedOpenLoopRegistry(params.speaker),
        shortTermSummary: params.speaker.shortTermSummary,
        recentMessages: contextLayers.memoryMessages,
      }),
      contextLayers.memoryContextPrompt,
      buildAssistantStickerPromptSection(runtimeStickerPool, {
        character: params.speaker,
        scene: 'group',
        latestUserText: [...contextLayers.liveMessages]
          .reverse()
          .find((message) => message.role === 'user' && getMessageMainText(message).trim())
          ?.text
          ?.trim(),
        recentTexts: buildStickerRecentTexts(contextLayers.liveMessages),
        sceneHints: buildGroupStickerSceneHints(sceneInput),
        ...speakerStickerContext,
      }),
      buildStructuredGroupAssistantReplyPrompt(),
    ]
      .filter(Boolean)
      .join('\n\n');
    console.info('[group-chat] generating message', {
      mode: params.mode,
      speakerId: params.speaker.id,
      speakerName: params.speaker.name,
      memberCount: members.length,
      historyLength: params.currentHistory.length,
    });

    const pendingTimestamp = requestTimestamp;
    setPendingMessage({
      speakerId: params.speaker.id,
      speakerName: params.speaker.name,
      speakerAvatar: params.speaker.avatar,
      timestamp: pendingTimestamp,
      text: '',
    });
    let lastPreviewUpdateAt = 0;
    let lastPreviewText = '';
    const updatePendingPreview = (rawText: string) => {
      const normalizedPreview = normalizeGeneratedReply(rawText, params.speaker).trim();
      if (!normalizedPreview || normalizedPreview === lastPreviewText) {
        return;
      }

      const now = Date.now();
      const shouldFlush =
        lastPreviewUpdateAt === 0
        || now - lastPreviewUpdateAt >= 80
        || normalizedPreview.length - lastPreviewText.length >= 24;
      if (!shouldFlush) {
        return;
      }

      lastPreviewUpdateAt = now;
      lastPreviewText = normalizedPreview;
      setPendingMessage((previous) => (
        previous
        && previous.speakerId === params.speaker.id
        && previous.timestamp === pendingTimestamp
          ? {
              ...previous,
              text: normalizedPreview,
            }
          : previous
      ));
    };

    const runtimeMessages = buildRuntimeMessages({
      systemPrompt,
      liveHistory: contextLayers.liveMessages,
      mode: params.mode,
      replyTarget: params.replyTarget,
      speechActInstruction: params.speechActInstruction,
      continuityMode: temporalState.continuityMode,
      nowTimestamp: requestTimestamp,
    });
    const runtimeTraceLabel = `group-chat:${params.mode}:assistant-reply`;
    const structuredAssistantReplyEnabled = true;
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
          updatePendingPreview(previewText);
        },
      });
      structuredResponseText = parseStructuredAssistantReplyEnvelope(responseText) ? responseText : null;
      const normalizedText = normalizeStructuredAssistantReplyToLegacyFormat(responseText);
      qualityResult = evaluateAssistantOutput(normalizedText, {
        allowBracketActions: shouldAllowBracketActions(params.speaker),
        allowStructuredProtocols: true,
        toneGuardMode: 'character_chat',
      });
      if (!qualityResult.ok) {
        console.warn('[group-chat] invalid structured reply rejected', {
          mode: params.mode,
          speakerId: params.speaker.id,
          speakerName: params.speaker.name,
          reason: qualityResult.reason,
          preview: qualityResult.cleanedText.slice(0, 120),
        });
        structuredResponseText = null;
        qualityResult = await generateQualityCheckedAssistantReply({
          activeConfig,
          messages: runtimeMessages,
          traceLabel: `${runtimeTraceLabel}:quality`,
          temperature: 0.7,
          allowBracketActions: shouldAllowBracketActions(params.speaker),
          allowStructuredProtocols: true,
          toneGuardMode: 'character_chat',
          retryTemperature: 0.82,
          onInvalid: (result) => {
            console.warn('[group-chat] invalid structured fallback reply rejected', {
              mode: params.mode,
              speakerId: params.speaker.id,
              speakerName: params.speaker.name,
              reason: result.reason,
              preview: result.cleanedText.slice(0, 120),
            });
          },
          onProgress: (streamingText) => {
            updatePendingPreview(streamingText);
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
        temperature: 0.7,
        allowBracketActions: shouldAllowBracketActions(params.speaker),
        allowStructuredProtocols: true,
        toneGuardMode: 'character_chat',
        retryTemperature: 0.82,
        onInvalid: (result) => {
          console.warn('[group-chat] invalid generated reply rejected', {
            mode: params.mode,
            speakerId: params.speaker.id,
            speakerName: params.speaker.name,
            reason: result.reason,
            preview: result.cleanedText.slice(0, 120),
          });
        },
        onProgress: (streamingText) => {
          updatePendingPreview(streamingText);
        },
      });
    }

    if (!qualityResult.ok) {
      throw new Error(`\u6a21\u578b\u8fd4\u56de\u65e0\u6548\u5185\u5bb9\uff1a${qualityResult.reason || 'unknown'}`);
    }

    const responseText = structuredResponseText || qualityResult.cleanedText;
    const normalizedResponse = normalizeGeneratedReply(responseText, params.speaker);
    if (!normalizedResponse) {
      throw new Error('\u6a21\u578b\u8fd4\u56de\u4e3a\u7a7a');
    }
    setPendingMessage((previous) => (
      previous && previous.speakerId === params.speaker.id
        ? {
            ...previous,
            text: normalizedResponse,
          }
        : previous
    ));

    console.info('[group-chat] raw model output', {
      mode: params.mode,
      speakerId: params.speaker.id,
      speakerName: params.speaker.name,
      rawText: responseText,
    });
    console.info('[group-chat] normalized model output', {
      mode: params.mode,
      speakerId: params.speaker.id,
      speakerName: params.speaker.name,
      normalizedText: normalizedResponse,
    });
    console.info('[group-chat] generation completed', {
      mode: params.mode,
      speakerId: params.speaker.id,
      speakerName: params.speaker.name,
      rawLength: responseText.length,
      normalizedLength: normalizedResponse.length,
      preview: normalizedResponse.slice(0, 80),
    });
    return {
      text: normalizedResponse,
      timestamp: pendingTimestamp,
      stickerPool: runtimeStickerPool,
      sharedState: sceneInput.recentContext
        ? buildPersistedSharedCharacterState({
            character: {
              shortTermSummary: sceneInput.recentContext.shortTermSummary,
            },
            temporalState,
            sceneScopedSignals: {
              relationshipResidue: sceneInput.recentContext.relationshipResidue,
              sceneResidue: undefined,
              topicAnchors: sceneInput.recentContext.topicAnchors,
              taskResidue: sceneInput.recentContext.taskResidue,
              sharedRecentRelationshipSummary: sceneInput.recentContext.sharedRecentRelationshipSummary,
              publicAcquaintanceSummary: sceneInput.recentContext.publicAcquaintanceSummary,
            },
            sourceScene: 'group_chat',
          })
        : undefined,
    };
  }, [
    activeConfig,
    runtimeSharedStickers,
    groupMeta?.backgroundSummary,
    groupMeta?.currentScene,
    groupMeta?.groupStage,
    groupMeta?.activeWorldBookIds,
    groupMeta?.memberRelationSeeds,
    groupMeta?.memberRelationshipNote,
    groupMeta?.memberRelationshipState,
    groupMeta?.publicFacts,
    groupMeta?.topicState,
    groupMeta?.groupShortTermSummary,
    groupMeta?.groupMemberPerspectiveSummaries,
    groupMeta?.groupLongTermMemory,
    groupMeta?.relationshipWaves,
    groupMeta?.factTraces,
    members,
    userName,
    directChatHistory,
    worldBooks,
    perception,
  ]);

  const appendSystemFailure = useCallback((detail: string) => {
    setError(detail);
    setHistory((prevHistory) => [
      ...prevHistory,
      {
        role: 'model',
        text: buildFailureText(detail),
        timestamp: Date.now(),
        isSystem: true,
      },
    ]);
  }, [setError, setHistory]);

  const resolveReplyTarget = useCallback((targetName: string, currentHistory: ChatMessage[]) => {
    const normalizedTarget = targetName.trim().replace(/^@+/, '').toLowerCase();
    if (!normalizedTarget) {
      return null;
    }

    for (let index = currentHistory.length - 1; index >= 0; index -= 1) {
      const message: ChatMessage | undefined = currentHistory[index];
      if (!message) {
        continue;
      }

      if (message.isSystem) {
        continue;
      }

      if (message.role === 'user' && userName.toLowerCase() === normalizedTarget) {
        return buildReplyPreviewPayload(message, userName);
      }

      if (hasSenderCharacterId(message)) {
        const sender = members.find((member) => member.id === message.senderCharacterId);
        const aliases = [sender?.name, sender?.remarkName?.trim()].filter((value): value is string => !!value?.trim());
        if (aliases.some((alias) => alias.trim().toLowerCase() === normalizedTarget)) {
          return buildReplyPreviewPayload(message, sender?.remarkName?.trim() || sender?.name || targetName);
        }
      }
    }

    return null;
  }, [members, userName]);

  const synthesizeSpeakerReplyAudio = useCallback(async (
    speaker: Character,
    text: string,
    fileNameBase: string,
  ): Promise<{
    audioUrl: string;
    audioMimeType: string;
  } | null> => {
    const cleanText = text.trim();
    if (!cleanText || !voiceRuntimeConfig || groupMeta?.voiceRepliesEnabled !== true) {
      return null;
    }

    if (speaker.voiceProfile?.enabled !== true) {
      return null;
    }

    const enabledMemberIds = groupMeta?.voiceReplyMemberIds || [];
    if (enabledMemberIds.length > 0 && !enabledMemberIds.includes(speaker.id)) {
      return null;
    }

    const preferredVoiceId = resolveCharacterTtsVoiceId(speaker, defaultTtsVoiceId);
    if (!preferredVoiceId) {
      return null;
    }

    try {
      return await synthesizeTtsAudio({
        config: voiceRuntimeConfig,
        text: cleanText,
        preferredVoiceId,
        fallbackVoiceId: defaultTtsVoiceId,
        fileNameBase,
      });
    } catch (ttsError) {
      console.error('[group-chat] speaker TTS synthesis failed', {
        speakerId: speaker.id,
        speakerName: speaker.name,
        error: ttsError,
      });
      return null;
    }
  }, [defaultTtsVoiceId, groupMeta?.voiceRepliesEnabled, groupMeta?.voiceReplyMemberIds, voiceRuntimeConfig]);

  const attachAudioToSpeakerMessages = useCallback(async (
    speaker: Character,
    messages: ChatMessage[],
  ) => {
    const nextMessages = [...messages];
    let hasAudioUpdate = false;

    for (let index = 0; index < nextMessages.length; index += 1) {
      const message = nextMessages[index];
      const cleanText = message?.isSystem ? '' : getMessageMainText(message).trim();
      if (!message || message.role !== 'model' || !cleanText || message.audioUrl || message.imageUrl) {
        continue;
      }

      const audioResult = await synthesizeSpeakerReplyAudio(
        speaker,
        cleanText,
        `group-voice-${speaker.id}-${message.timestamp}-${index + 1}`,
      );
      if (!audioResult) {
        continue;
      }

      nextMessages[index] = {
        ...message,
        audioUrl: audioResult.audioUrl,
        audioMimeType: audioResult.audioMimeType,
        audioTranscript: cleanText,
      };
      hasAudioUpdate = true;
    }

    if (!hasAudioUpdate) {
      return;
    }

    const updatedMessagesByKey = new Map(
      nextMessages.map((message) => [buildGroupAudioMessageKey(message), message]),
    );

    setHistory((prevHistory) => prevHistory.map((message) => {
      const key = buildGroupAudioMessageKey(message);
      return updatedMessagesByKey.get(key) || message;
    }));
  }, [setHistory, synthesizeSpeakerReplyAudio]);

  const appendSpeakerMessage = useCallback(async (
    speaker: Character,
    text: string,
    timestamp = Date.now(),
    currentHistory: ChatMessage[] = historyRef.current,
    forcedReplyTo?: ChatMessage['replyTo'] | null,
    allowReplyOnFirstMessageOnly = false,
    sharedState?: Character['sharedState'],
    resolvedStickerPool?: string[],
    lightInteractionMeta?: ChatMessage['lightInteractionMeta'],
  ): Promise<ChatMessage[]> => {
    const messages = splitGroupReplyIntoMessages(text, speaker, timestamp);
    if (messages.length === 0) {
      return [];
    }

    const previousMessageBySpeaker = [...currentHistory]
      .reverse()
      .find((message) => message.role === 'model' && message.senderCharacterId === speaker.id && !message.isRecalled) || null;
    const quotedReplyKeysBySpeaker = new Set(
      currentHistory
        .filter((message) => message.role === 'model' && message.senderCharacterId === speaker.id)
        .map((message) => buildReplyTargetKey(message.replyTo))
        .filter((key): key is string => !!key),
    );

    const shouldRecallPrevious = messages.some((message) => parseGroupActionCue(getMessageMainText(message)).kind === 'recall');
    const historyAfterRecall = shouldRecallPrevious
      ? currentHistory.map((message) => (
          previousMessageBySpeaker && message.timestamp === previousMessageBySpeaker.timestamp
            ? { ...message, isRecalled: true }
            : message
        ))
      : currentHistory;
    const speakerStickerContext = {
      ...buildSpeakerStickerUsageContext(currentHistory, speaker.id),
      stickerMetadataMap: getSpeakerStickerMetadataMap(speaker),
    };
    const stagedStickerRefs: string[] = [];
    const stagedStickerLabels: string[] = [];

    const structuredMessages = messages.map((message, index) => {
      const rawContent = getMessageMainText(message);
      if (
        message.contentType === 'game-card'
        || message.contentType === 'transfer'
        || message.contentType === 'couple-space-invite'
        || message.contentType === 'couple-space-invite-accepted'
      ) {
        return {
          ...message,
          ...(message.contentType === 'transfer' && !message.transferTargetLabel ? { transferTargetLabel: userName } : {}),
          ...(lightInteractionMeta ? { lightInteractionMeta } : {}),
        };
      }

      const cue = parseGroupActionCue(rawContent);
      const effectiveStickerPool = resolvedStickerPool?.length
        ? resolvedStickerPool
        : getSpeakerStickerPool(speaker);
      const stickerContext = {
        ...speakerStickerContext,
        recentStickerRefs: [...stagedStickerRefs].reverse().concat(speakerStickerContext.recentStickerRefs || []),
        recentStickerLabels: [...stagedStickerLabels].reverse().concat(speakerStickerContext.recentStickerLabels || []),
        lastOwnMessageWasSticker: stagedStickerRefs.length > 0 || !!speakerStickerContext.lastOwnMessageWasSticker,
      };
      const pickedSticker = cue.kind === 'sticker'
        ? pickAssistantSticker(
            cue.content,
            effectiveStickerPool,
            {
              character: speaker,
              scene: 'group',
              recentTexts: buildStickerRecentTexts(currentHistory),
              sceneHints: [
                groupMeta?.backgroundSummary || '',
                groupMeta?.memberRelationshipNote || '',
                groupMeta?.currentScene || '',
                groupMeta?.publicFacts || '',
                groupMeta?.groupShortTermSummary || '',
              ].filter(Boolean),
              ...stickerContext,
            },
          )
        : null;
      if (pickedSticker) {
        stagedStickerRefs.push(pickedSticker.sticker);
        stagedStickerLabels.push(pickedSticker.label);
      }
      const cleanedText = cue.kind === 'sticker'
        ? cue.content.trim()
        : cue.kind === 'reply'
          ? cue.content || rawContent
          : cue.kind === 'recall'
            ? cue.content
          : cue.content || rawContent;

      const candidateReplyPayload = forcedReplyTo
        || (cue.replyTargetName ? resolveReplyTarget(cue.replyTargetName, historyAfterRecall) : null);
      const candidateReplyKey = buildReplyTargetKey(candidateReplyPayload);
      const shouldDropRepeatedReply =
        (allowReplyOnFirstMessageOnly && index > 0)
        ||
        (index === 0
          && previousMessageBySpeaker
          && isSameReplyTarget(previousMessageBySpeaker.replyTo, candidateReplyPayload))
        || (!!candidateReplyKey && quotedReplyKeysBySpeaker.has(candidateReplyKey));
      const replyPayload = shouldDropRepeatedReply ? null : candidateReplyPayload;

      return {
        ...message,
        text: cue.kind === 'notice'
          ? `[notice] ${cue.content || rawContent}`
          : `${speaker.name}: ${cue.kind === 'sticker' ? (pickedSticker ? '[sticker]' : cleanedText) : cleanedText}`,
        ...(cue.kind === 'sticker' && pickedSticker ? { imageUrl: pickedSticker.sticker, stickerLabel: pickedSticker.label } : {}),
        isSystem: cue.kind === 'notice' ? true : undefined,
        replyTo: replyPayload || undefined,
        ...(lightInteractionMeta ? { lightInteractionMeta } : {}),
      };
    }).filter((message) => {
      if (
        message.isSystem
        || message.imageUrl
        || message.contentType === 'game-card'
        || message.contentType === 'transfer'
        || message.contentType === 'couple-space-invite'
        || message.contentType === 'couple-space-invite-accepted'
      ) {
        return true;
      }

      const mainText = getMessageMainText(message);
      return isUsableChatText(mainText);
    });

    console.info('[group-chat] append speaker messages', {
      speakerId: speaker.id,
      speakerName: speaker.name,
      appendedCount: structuredMessages.length,
      previews: structuredMessages.map((message) => ({
        preview: getMessageMainText(message).slice(0, 80),
        isSystem: !!message.isSystem,
        hasReplyTo: !!message.replyTo,
      })),
    });
    const nextHistory = [...historyAfterRecall, ...structuredMessages];
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    if (structuredMessages.length > 0) {
      await recordGroupSpeakerSettlement(speaker, structuredMessages, sharedState);
    }
    void attachAudioToSpeakerMessages(speaker, structuredMessages);
    return structuredMessages;
  }, [
    attachAudioToSpeakerMessages,
    recordGroupSpeakerSettlement,
    resolveReplyTarget,
    runtimeSharedStickers,
    groupMeta?.backgroundSummary,
    groupMeta?.memberRelationshipNote,
    groupMeta?.currentScene,
    groupMeta?.publicFacts,
    groupMeta?.groupShortTermSummary,
    setHistory,
    userName,
  ]);

  const triggerAISpeaker = useCallback(async (
    speaker: Character,
    currentHistory: ChatMessage[],
    interactionId: number,
    forcedReplyTo?: ChatMessage['replyTo'] | null,
    speechActInstruction?: string,
  ): Promise<ChatMessage[]> => {
    try {
      const response = await generateMessageForSpeaker({
        speaker,
        currentHistory,
        mode: 'invited',
        replyTarget: forcedReplyTo,
        speechActInstruction,
      });

      if (
        response.text
        && isMountedRef.current
        && activeInteractionIdRef.current === interactionId
      ) {
        const appendedMessages = await appendSpeakerMessage(
          speaker,
          response.text,
          response.timestamp,
          currentHistory,
          forcedReplyTo,
          true,
          response.sharedState,
          response.stickerPool,
        );
        setPendingMessage(null);
        return appendedMessages;
      }
    } catch (runtimeError) {
      console.error('Triggered speaker error:', runtimeError);
      setPendingMessage(null);
      if (isMountedRef.current && activeInteractionIdRef.current === interactionId) {
        const detail = runtimeError instanceof Error ? runtimeError.message : '\u7fa4\u6210\u5458\u63a5\u8bdd\u5931\u8d25';
        setHistory((prevHistory) => [...prevHistory, {
          role: 'model',
          text: buildFailureText(detail),
          timestamp: Date.now(),
          isSystem: true,
        }]);
        setError(detail);
      }
    }
    return [];
  }, [appendSpeakerMessage, generateMessageForSpeaker, setHistory]);

  const maybeOpenScene = useCallback(async () => {
    if (manualReplyModeEnabled) {
      console.info('[group-chat] skip opening scene', {
        reason: 'manual_reply_mode',
      });
      return;
    }

    if (!hasActiveConfig || activeSpeakerMembers.length === 0) {
      console.info('[group-chat] skip opening scene', {
        reason: !hasActiveConfig ? 'missing_active_config' : 'missing_members',
        memberCount: activeSpeakerMembers.length,
      });
      return;
    }

    const hasExistingSession = history.length > 0 || !!groupMeta?.lastMessage || !!groupMeta?.lastTime;
    if (hasExistingSession) {
      console.info('[group-chat] skip opening scene', {
        reason: 'existing_session',
        historyLength: history.length,
        lastMessage: groupMeta?.lastMessage || '',
        lastTime: groupMeta?.lastTime || null,
      });
      return;
    }

    const openerCandidates = activeSpeakerMembers.filter(
      (member) => !!member.sceneHints?.groupChat || !!member.corePersona?.trim() || !!member.signature?.trim(),
    );
    const openerPool = openerCandidates.length > 0 ? openerCandidates : activeSpeakerMembers;
    const opener = openerPool[Math.floor(Math.random() * openerPool.length)];

    const requestId = openingRequestIdRef.current + 1;
    openingRequestIdRef.current = requestId;
    const interactionId = activeInteractionIdRef.current;
    console.info('[group-chat] opening scene started', {
      speakerId: opener.id,
      speakerName: opener.name,
      requestId,
      interactionId,
    });

    try {
      const response = await generateMessageForSpeaker({
        speaker: opener,
        currentHistory: history,
        mode: 'opening',
      });

      if (
        response.text
        && isMountedRef.current
        && activeInteractionIdRef.current === interactionId
      ) {
        console.info('[group-chat] opening scene append message', {
          speakerId: opener.id,
          speakerName: opener.name,
          requestId,
        });
        await appendSpeakerMessage(opener, response.text, response.timestamp, historyRef.current, null, false, response.sharedState, response.stickerPool);
        setPendingMessage(null);
      }
    } catch (runtimeError) {
      console.error('Opening speaker error:', runtimeError);
      setPendingMessage(null);
      if (
        isMountedRef.current
        && activeInteractionIdRef.current === interactionId
      ) {
        const detail = runtimeError instanceof Error ? runtimeError.message : '\u7fa4\u804a\u5f00\u573a\u5931\u8d25';
        setHistory((prevHistory) => [...prevHistory, {
          role: 'model',
          text: buildFailureText(detail),
          timestamp: Date.now(),
          isSystem: true,
        }]);
        setError(detail);
      }
    }
  }, [activeSpeakerMembers, appendSpeakerMessage, generateMessageForSpeaker, groupMeta?.lastMessage, groupMeta?.lastTime, hasActiveConfig, history, manualReplyModeEnabled, setHistory]);

  const reactToNoticeUpdate = useCallback(async (params: {
    noticeText: string;
    currentHistory: ChatMessage[];
  }) => {
    if (manualReplyModeEnabled) {
      return;
    }

    const trimmedNotice = params.noticeText.trim();
    if (!trimmedNotice || !hasActiveConfig || activeSpeakerMembers.length === 0) {
      return;
    }

    const reactionPrompt = `群公告刚更新为：${trimmedNotice}\n请你像在真实群聊里看到新公告后那样，自然接一句短反应。不要总结，不要长篇解释，不要像客服通知。`;
    const weightedMembers = activeSpeakerMembers.map((member) => ({
      member,
      weight: Math.max(
        0.2,
        inferReadableSpeakerWeight(member, reactionPrompt) * getGroupStageMultiplier(groupMeta?.groupStage),
      ),
    }));

    const selectedMembers: Character[] = [];
    const primarySpeaker = pickWeightedMember(weightedMembers);
    if (!primarySpeaker) {
      return;
    }
    selectedMembers.push(primarySpeaker);

    if (activeSpeakerMembers.length >= 2) {
      const secondaryPool = weightedMembers
        .filter((item) => item.member.id !== primarySpeaker.id)
        .map((item) => ({
          member: item.member,
          weight: Math.max(0.1, item.weight - 0.15),
        }));
      const secondaryChance = Math.min(0.72, activeSpeakerMembers.length >= 5 ? 0.62 : 0.46);
      if (secondaryPool.length > 0 && Math.random() < secondaryChance) {
        const secondarySpeaker = pickWeightedMember(secondaryPool);
        if (secondarySpeaker) {
          selectedMembers.push(secondarySpeaker);
        }
      }
    }

    clearDelayedSpeakerTimer();
    const interactionId = activeInteractionIdRef.current + 1;
    activeInteractionIdRef.current = interactionId;

    let workingHistory = params.currentHistory;
    for (const speaker of selectedMembers) {
      const generationHistory = [
        ...workingHistory,
        {
          role: 'user' as const,
          text: reactionPrompt,
          timestamp: Date.now(),
        },
      ];

      try {
        const response = await generateMessageForSpeaker({
          speaker,
          currentHistory: generationHistory,
          mode: 'invited',
        });

        if (
          response.text
          && isMountedRef.current
          && activeInteractionIdRef.current === interactionId
        ) {
          const appendedMessages = await appendSpeakerMessage(
            speaker,
            response.text,
            response.timestamp,
            workingHistory,
            null,
            true,
            response.sharedState,
            response.stickerPool,
          );
          setPendingMessage(null);
          if (appendedMessages.length > 0) {
            workingHistory = [...workingHistory, ...appendedMessages];
          }
        }
      } catch (runtimeError) {
        console.error('Notice reaction error:', runtimeError);
        setPendingMessage(null);
        break;
      }
    }
  }, [
    appendSpeakerMessage,
    clearDelayedSpeakerTimer,
    generateMessageForSpeaker,
    getPresenceParticipationWeight,
    groupMeta?.groupStage,
    hasActiveConfig,
    manualReplyModeEnabled,
    activeSpeakerMembers,
    pickWeightedMember,
  ]);

  const runTransferSettlementReaction = useCallback(async (params: {
    sender: Character;
    event: TransferSettlementEvent;
    currentHistory: ChatMessage[];
  }): Promise<ChatMessage[]> => {
    if (!hasActiveConfig) {
      return [];
    }

    const reactionPrompt = [
      '群里刚发生了一笔转账互动。',
      `已发生事实：${buildTransferSettlementEventLine(params.event)}`,
      '请你只按这个已发生事实，在群里自然接一句短消息。',
      '不要再次输出转账协议，不要把结果说反，不要总结流程，也不要长篇解释。',
    ].join('\n');

    try {
      const response = await generateMessageForSpeaker({
        speaker: params.sender,
        currentHistory: [
          ...params.currentHistory,
          {
            role: 'user',
            text: reactionPrompt,
            timestamp: Date.now(),
          },
        ],
        mode: 'reply',
        speechActInstruction: '这是一条群聊里的转账结果反应。只发 1 到 2 句短促群聊消息，不要再次发起转账，也不要解释规则。',
      });
      const safeReplyText = resolveTransferReplyTextForEvent(
        params.event,
        stripTransferProtocolText(response.text),
      );
      if (!safeReplyText) {
        setPendingMessage(null);
        return [];
      }

      const appendedMessages = await appendSpeakerMessage(
        params.sender,
        safeReplyText,
        response.timestamp,
        params.currentHistory,
        null,
        true,
        response.sharedState,
        response.stickerPool,
      );
      setPendingMessage(null);
      if (appendedMessages.length > 0) {
        historyRef.current = [...params.currentHistory, ...appendedMessages];
      }
      return appendedMessages;
    } catch (error) {
      console.error('[group-chat] transfer settlement reaction failed', error);
      setPendingMessage(null);
      return [];
    }
  }, [
    appendSpeakerMessage,
    generateMessageForSpeaker,
    hasActiveConfig,
  ]);

  const handleReceiveTransfer = useCallback(async (index: number) => {
    const latestHistory = historyRef.current;
    const transferMessage = latestHistory[index];
    if (
      !transferMessage
      || transferMessage.role !== 'model'
      || transferMessage.transferStatus === 'received'
      || transferMessage.transferStatus === 'rejected'
    ) {
      return;
    }

    const amountText = extractTransferAmountText(transferMessage.text) || '0.00';
    const amount = Number.parseFloat(amountText);
    const settledAt = Date.now();
    const nextHistory = [...latestHistory];
    nextHistory[index] = {
      ...transferMessage,
      transferStatus: 'received',
      transferSettledAt: settledAt,
      transferTargetLabel: transferMessage.transferTargetLabel || userName,
    };
    nextHistory.push({
      role: 'user',
      text: `[转账 ${amountText}]`,
      contentType: 'transfer',
      timestamp: settledAt,
      transferStatus: 'received',
      transferDisplayLabel: '已收款',
      transferTargetLabel: userName,
      transferSettledAt: settledAt,
    });
    commitHistory(nextHistory);

    const sender = transferMessage.senderCharacterId
      ? members.find((member) => member.id === transferMessage.senderCharacterId) || null
      : null;
    if (!sender || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    await runTransferSettlementReaction({
      sender,
      event: {
        direction: 'character_to_user',
        status: 'received',
        amount,
        userName,
        characterName: sender.remarkName?.trim() || sender.name,
      },
      currentHistory: nextHistory,
    });
  }, [commitHistory, members, runTransferSettlementReaction, userName]);

  const handleRejectTransfer = useCallback(async (index: number) => {
    const latestHistory = historyRef.current;
    const transferMessage = latestHistory[index];
    if (
      !transferMessage
      || transferMessage.role !== 'model'
      || transferMessage.transferStatus === 'received'
      || transferMessage.transferStatus === 'rejected'
    ) {
      return;
    }

    const amountText = extractTransferAmountText(transferMessage.text) || '0.00';
    const amount = Number.parseFloat(amountText);
    const settledAt = Date.now();
    const nextHistory = [...latestHistory];
    nextHistory[index] = {
      ...transferMessage,
      transferStatus: 'rejected',
      transferSettledAt: settledAt,
      transferTargetLabel: transferMessage.transferTargetLabel || userName,
    };
    nextHistory.push({
      role: 'user',
      text: `[转账 ${amountText}]`,
      contentType: 'transfer',
      timestamp: settledAt,
      transferStatus: 'rejected',
      transferDisplayLabel: '已退回',
      transferTargetLabel: userName,
      transferSettledAt: settledAt,
    });
    commitHistory(nextHistory);

    const sender = transferMessage.senderCharacterId
      ? members.find((member) => member.id === transferMessage.senderCharacterId) || null
      : null;
    if (!sender || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    await runTransferSettlementReaction({
      sender,
      event: {
        direction: 'character_to_user',
        status: 'rejected',
        amount,
        userName,
        characterName: sender.remarkName?.trim() || sender.name,
      },
      currentHistory: nextHistory,
    });
  }, [commitHistory, members, runTransferSettlementReaction, userName]);

  const sendPokeInteraction = useCallback(async (memberId: string) => {
    if (!hasActiveConfig || isLoading || members.length === 0 || pendingMessage) {
      return;
    }

    const targetMember = members.find((member) => member.id === memberId);
    if (!targetMember || !activeSpeakerMembers.some((member) => member.id === memberId)) {
      return;
    }

    clearDelayedSpeakerTimer();
    const interactionId = activeInteractionIdRef.current + 1;
    activeInteractionIdRef.current = interactionId;
    openingRequestIdRef.current += 1;
    secondarySpeakerRequestIdRef.current += 1;

    const currentHistory = historyRef.current;
    const recentPokeState = collectRecentGroupPokeState(currentHistory);
    const targetDisplayLabel = targetMember.remarkName?.trim() || targetMember.name;
    const requestTimestamp = Date.now();
    setPendingMessage({
      speakerId: targetMember.id,
      speakerName: targetDisplayLabel,
      speakerAvatar: targetMember.avatar,
      timestamp: requestTimestamp,
      text: '',
    });

    try {
      await runGeneration(async ({ generationId, isCurrent }) => {
        const targetContext = buildSpeakerSceneContext({
          speaker: targetMember,
          currentHistory,
          mode: 'reply',
          requestTimestamp,
        });
        const spectatorCandidates = members
          .filter((member) => member.id !== targetMember.id)
          .map((member) => ({
            character: member,
            label: member.remarkName?.trim() || member.name,
          }));
        const interactionResult = await generateLightInteraction({
          activeConfig,
          type: 'poke',
          scene: 'group',
          actor: {
            role: 'user',
            label: '你',
          },
          target: {
            character: targetMember,
            label: targetDisplayLabel,
          },
          spectatorCandidates,
          sceneInput: targetContext.sceneInput,
          recentMessages: targetContext.contextLayers.liveMessages,
          recentSystemLines: recentPokeState.recentSystemLines,
          recentDescriptors: recentPokeState.recentDescriptors,
          latestMood: recentPokeState.latestMood,
          latestCounterActionType: recentPokeState.latestCounterActionType,
          upcomingStreak: recentPokeState.upcomingStreak,
        });

        if (!isMountedRef.current || activeInteractionIdRef.current !== interactionId || activeGenerationIdRef.current !== generationId || !isCurrent()) {
          return;
        }

        setPendingMessage(null);
        const baseTimestamp = Date.now();
        const interactionTraceId = `group-poke:${targetMember.id}:${baseTimestamp}`;
        const lightInteractionMetaBase: NonNullable<ChatMessage['lightInteractionMeta']> = {
          type: 'poke',
          scene: 'group',
          interactionId: interactionTraceId,
          step: 'system',
          actorRole: 'user',
          actorLabel: '你',
          targetLabel: targetDisplayLabel,
          mood: interactionResult.interactionState?.mood,
          streak: interactionResult.interactionState?.streak ?? recentPokeState.upcomingStreak,
          descriptors: interactionResult.interactionState?.recentDescriptors,
          nextActions: interactionResult.nextActions,
          counterActionType: interactionResult.counterAction?.type ?? 'none',
        };
        const systemMessage: ChatMessage = {
          role: 'model',
          text: interactionResult.systemLine,
          timestamp: baseTimestamp,
          isSystem: true,
          lightInteractionMeta: {
            ...lightInteractionMetaBase,
            step: 'system',
          },
        };

        let workingHistory = appendUniqueGroupHistoryMessages(currentHistory, [systemMessage]);
        historyRef.current = workingHistory;
        setHistory((prevHistory) => appendUniqueGroupHistoryMessages(prevHistory, [systemMessage]));

        const targetAppendedMessages = await appendSpeakerMessage(
          targetMember,
          interactionResult.assistantBubbles.join('\n'),
          baseTimestamp + 1,
          workingHistory,
          null,
          true,
          targetContext.sharedState,
          undefined,
          {
            ...lightInteractionMetaBase,
            step: 'assistant',
          },
        );
        if (targetAppendedMessages.length > 0) {
          workingHistory = appendUniqueGroupHistoryMessages(workingHistory, targetAppendedMessages);
          historyRef.current = workingHistory;
        }

        if (interactionResult.spectatorReply?.speakerLabel && interactionResult.spectatorReply.bubbles.length > 0) {
          const spectator = resolveCharacterByPublicName(interactionResult.spectatorReply.speakerLabel, members);
          if (spectator && spectator.id !== targetMember.id) {
            const spectatorContext = buildSpeakerSceneContext({
              speaker: spectator,
              currentHistory: workingHistory,
              mode: 'reply',
              requestTimestamp: baseTimestamp + 2,
            });
            const spectatorAppendedMessages = await appendSpeakerMessage(
              spectator,
              interactionResult.spectatorReply.bubbles.join('\n'),
              baseTimestamp + 1 + targetAppendedMessages.length,
              workingHistory,
              null,
              true,
              spectatorContext.sharedState,
              undefined,
              {
                ...lightInteractionMetaBase,
                step: 'spectator',
              },
            );
            if (spectatorAppendedMessages.length > 0) {
              workingHistory = appendUniqueGroupHistoryMessages(workingHistory, spectatorAppendedMessages);
              historyRef.current = workingHistory;
            }
          }
        }

        if (interactionResult.counterAction?.type === 'poke_back') {
          const counterSystemLine = interactionResult.counterAction.systemLine?.trim().includes('拍')
            ? interactionResult.counterAction.systemLine.trim()
            : `${targetDisplayLabel}拍了拍你`;
          const counterMessage: ChatMessage = {
            role: 'model',
            text: counterSystemLine,
            timestamp: baseTimestamp + 1 + targetAppendedMessages.length + (interactionResult.spectatorReply ? 1 : 0),
            isSystem: true,
            lightInteractionMeta: {
              ...lightInteractionMetaBase,
              step: 'counter',
            },
          };
          workingHistory = appendUniqueGroupHistoryMessages(workingHistory, [counterMessage]);
          historyRef.current = workingHistory;
          setHistory((prevHistory) => appendUniqueGroupHistoryMessages(prevHistory, [counterMessage]));
        }
      });
    } catch (runtimeError) {
      console.error('Group poke interaction error:', runtimeError);
      setPendingMessage(null);
      appendSystemFailure(runtimeError instanceof Error ? runtimeError.message : '\u7fa4\u804a\u62cd\u4e00\u62cd\u5931\u8d25');
    }
  }, [
    activeGenerationIdRef,
    activeInteractionIdRef,
    activeConfig,
    appendSpeakerMessage,
    appendSystemFailure,
    buildSpeakerSceneContext,
    clearDelayedSpeakerTimer,
    hasActiveConfig,
    isLoading,
    members,
    pendingMessage,
    runGeneration,
    setHistory,
  ]);

  const submitUserMessage = useCallback(async (params: {
    message: ChatMessage;
    promptText: string;
  }) => {
    const countRecentMessagesBySpeaker = (characterId: string) =>
      historyRef.current
        .filter((message) => message.role === 'model' && message.senderCharacterId === characterId)
        .slice(-6)
        .length;

    const getMemberAliases = (member: Character) =>
      Array.from(
        new Set(
          [member.name, member.remarkName]
            .map((value) => value?.trim())
            .filter((value): value is string => !!value),
        ),
      );

    const hasExplicitAliasCallout = (text: string, alias: string) => {
      if (!alias.trim()) return false;

      const escapedAlias = escapeRegExp(alias.trim());
      const patterns = [
        new RegExp(`(?:^|[\\s，。！？,.!?])@${escapedAlias}(?=$|[\\s，。！？,.!?])`, 'i'),
        new RegExp(`(?:^|[\\s，。！？,.!?])${escapedAlias}(?:你|你们|先|来说|说下|回答|回下|回一句|接一下|来一下|出来|出列|先说)(?=$|[\\s，。！？,.!?])`, 'i'),
        new RegExp(`(?:^|[\\s，。！？,.!?])让${escapedAlias}(?:来|先来|回答|说|回)(?=$|[\\s，。！？,.!?])`, 'i'),
      ];

      return patterns.some((pattern) => pattern.test(text));
    };

    const getExplicitMentionedMembers = (text: string, excludedIds: string[] = []) => {
      const normalized = text.trim();
      if (!normalized) return [];

      const results: Character[] = [];
      const seenIds = new Set(excludedIds);
      const atMatches = Array.from(normalized.matchAll(MENTION_REGEX));

      for (const match of atMatches) {
        const candidate = resolveCharacterByPublicName(match[1], members);
        if (candidate && !seenIds.has(candidate.id)) {
          seenIds.add(candidate.id);
          results.push(candidate);
        }
      }

      for (const member of members) {
        if (seenIds.has(member.id)) continue;
        const aliases = getMemberAliases(member);
        if (aliases.some((alias) => matchesExplicitTargetAlias(normalized, alias))) {
          seenIds.add(member.id);
          results.push(member);
        }
      }

      return results;
    };

    const extractMentionedMember = (text: string, excludedIds: string[] = []) => {
      return getExplicitMentionedMembers(text, excludedIds)[0] || null;
    };

    const extractMentionedMembers = (text: string, excludedIds: string[] = []) => {
      return getExplicitMentionedMembers(text, excludedIds);
    };

    const isDirectedInterruption = (text: string) => /(?:^|[\s，。！？,.!?])(?:你(?:先|先别|别|不要)?(?:说话|别说话|闭嘴|停|先停|别接|别回|别说)|别复读了|先停一下|先别接)/.test(text.trim());

    const resolveReplyTargetMember = () => {
      if (!replyingTo || replyingTo.role !== 'model') {
        return null;
      }

      return resolveCharacterByPublicName(replyingTo.authorLabel, members);
    };

    const getRecentDominantSpeaker = () => {
      const recentModelMessages = [...historyRef.current]
        .filter((message) => message.role === 'model' && !message.isSystem && !!message.senderCharacterId)
        .slice(-3);

      if (recentModelMessages.length === 0) {
        return null;
      }

      const latestSpeakerId = recentModelMessages[recentModelMessages.length - 1]?.senderCharacterId;
      if (!latestSpeakerId) {
        return null;
      }

      const latestSpeakerCount = recentModelMessages.filter((message) => message.senderCharacterId === latestSpeakerId).length;
      if (latestSpeakerCount < 2 && recentModelMessages.length < 2) {
        return null;
      }

      return activeSpeakerMembers.find((member) => member.id === latestSpeakerId) || null;
    };

    const resolveUserTargetCandidates = (
      userText: string,
      excludedIds: string[] = [],
    ) => {
      const targets: Character[] = [];
      const seenIds = new Set(excludedIds);
      const pushTarget = (member: Character | null) => {
        if (!member || seenIds.has(member.id) || !activeSpeakerMembers.some((item) => item.id === member.id)) return;
        seenIds.add(member.id);
        targets.push(member);
      };

      if (replyingTo?.role === 'model') {
        pushTarget(resolveCharacterByPublicName(replyingTo.authorLabel, members));
      }

      extractMentionedMembers(userText, Array.from(seenIds)).forEach((member) => {
        pushTarget(member);
      });

      if (targets.length === 0 && isDirectedInterruption(userText)) {
        pushTarget(resolveReplyTargetMember());
        pushTarget(getRecentDominantSpeaker());
      }

      return targets;
    };

    const pickPrimaryResponder = (
      userText: string,
      intent: GroupReplyIntent,
      preferredSpeakerIds: string[],
    ) => {
      const preferredSet = new Set(preferredSpeakerIds);
      const explicitTargets = resolveUserTargetCandidates(userText);
      if (explicitTargets.length > 0) {
        const explicitPrimary = explicitTargets.find((member) => (
          intent.kind !== 'force_targets' || preferredSet.has(member.id)
        )) || explicitTargets[0];
        if (explicitPrimary) {
          return explicitPrimary;
        }
      }

      if (isDirectedInterruption(userText)) {
        const replyTargetMember = resolveReplyTargetMember();
        if (replyTargetMember) {
          return replyTargetMember;
        }

        const recentDominantSpeaker = getRecentDominantSpeaker();
        if (recentDominantSpeaker) {
          return recentDominantSpeaker;
        }
      }

      const latestModelSpeakerId = [...historyRef.current]
        .reverse()
        .find((message) => message.role === 'model')
        ?.senderCharacterId;

      const weightedMembers = activeSpeakerMembers.map((member) => {
        const baseWeight = inferReadableSpeakerWeight(member, userText) * getGroupStageMultiplier(groupMeta?.groupStage);
        let weight = baseWeight;
        const aliases = getMemberAliases(member);
        const mentionHit = aliases.some((alias) => userText.includes(alias));
        const evidence = buildCharacterEvidence(member);
        const recentCount = countRecentMessagesBySpeaker(member.id);
        const isReplyTarget = !!replyingTo
          && replyingTo.role === 'model'
          && getMemberAliases(member).some((alias) => alias.trim().toLowerCase() === replyingTo.authorLabel.trim().toLowerCase());

        const participationBonus = computeGroupParticipationBonus({
          character: member,
          userText,
          characterEvidence: evidence,
          aliases,
          intentKind: intent.kind,
          isExplicitTarget: preferredSet.has(member.id) || mentionHit,
          isReplyTarget,
          recentCount,
          latestModelSpeakerId,
        });
        weight += participationBonus;
        const perspectiveWeight = computePerspectiveReactionWeight({
          perspectiveSummary: groupMeta?.groupMemberPerspectiveSummaries?.[member.id],
          latestSpeakerId: latestModelSpeakerId,
          memberId: member.id,
          latestText: userText,
        });
        weight += perspectiveWeight;
        const presenceWeight = getPresenceParticipationWeight(member, historyRef.current);
        weight += presenceWeight;

        if (mentionHit) {
          weight += 3;
        }

        if (intent.kind === 'force_all_members') {
          weight += 1.8;
        }

        if (preferredSet.has(member.id)) {
          weight += 2.6;
        } else if (intent.kind === 'force_targets') {
          weight -= 1.25;
        }

        if (member.id === latestModelSpeakerId) {
          weight -= wantsAnotherSpeaker(userText) ? 1.2 : 0.6;
        }

        weight -= recentCount * 0.45;

        if (intent.kind === 'force_all_members' && recentCount === 0) {
          weight += 1.4;
        }

        if (wantsAnotherSpeaker(userText) && member.id !== latestModelSpeakerId) {
          weight += 0.8;
        }

        return {
          member,
          weight: Math.max(weight, 0.2),
          reasons: {
            base: baseWeight,
            participation: participationBonus,
            perspective: perspectiveWeight,
            presence: presenceWeight,
            recentPenalty: -recentCount * 0.45,
            latestSpeakerPenalty: member.id === latestModelSpeakerId ? (wantsAnotherSpeaker(userText) ? -1.2 : -0.6) : 0,
            mention: mentionHit ? 3 : 0,
            preferred: preferredSet.has(member.id) ? 2.6 : 0,
          },
        };
      });

      const totalWeight = weightedMembers.reduce((sum, item) => sum + item.weight, 0);
      let cursor = Math.random() * totalWeight;
      for (const item of weightedMembers) {
        cursor -= item.weight;
        if (cursor <= 0) {
          return item.member;
        }
      }

      return weightedMembers[weightedMembers.length - 1]?.member ?? activeSpeakerMembers[0];
    };

    const resolveSecondarySpeaker = (userText: string, primarySpeaker: Character, primaryResponse: string) => {
      const explicitSecondary = resolveUserTargetCandidates(userText, [primarySpeaker.id])[0] || null;
      if (explicitSecondary) {
        return explicitSecondary;
      }

      const responseMention = extractMentionedMember(primaryResponse, [primarySpeaker.id]);
      if (responseMention) {
        return responseMention;
      }

      const candidateMembers = activeSpeakerMembers.filter((member) => member.id !== primarySpeaker.id);
      if (candidateMembers.length === 0) {
        return null;
      }

      const vibeAllowsFollowUp = wantsAnotherSpeaker(userText)
        || primaryResponse.includes('?')
        || primaryResponse.includes('？')
        || primaryResponse.includes('!')
        || primaryResponse.includes('！')
        || primaryResponse.length <= 18;

      if (!vibeAllowsFollowUp) {
        return null;
      }

      const weightedCandidates = candidateMembers.map((member) => {
        let weight = inferReadableSpeakerWeight(member, `${userText}\n${primaryResponse}`) * getGroupStageMultiplier(groupMeta?.groupStage);
        const aliases = getMemberAliases(member);
        const evidence = buildCharacterEvidence(member);
        const recentCount = countRecentMessagesBySpeaker(member.id);
        weight += computeGroupParticipationBonus({
          character: member,
          userText: `${userText}\n${primaryResponse}`,
          characterEvidence: evidence,
          aliases,
          intentKind: 'open_floor',
          isExplicitTarget: false,
          isReplyTarget: false,
          recentCount,
          latestModelSpeakerId: primarySpeaker.id,
        });
        weight += computePerspectiveReactionWeight({
          perspectiveSummary: groupMeta?.groupMemberPerspectiveSummaries?.[member.id],
          latestSpeakerId: primarySpeaker.id,
          memberId: member.id,
          latestText: primaryResponse,
        });
        weight += getPresenceParticipationWeight(member, historyRef.current);
        weight -= recentCount * 0.4;

        if (includesAny(buildCharacterEvidence(member), ['话少', '冷淡', '克制', '沉默']) && !wantsAnotherSpeaker(userText)) {
          weight -= 0.8;
        }

        return {
          member,
          weight: Math.max(weight, 0.1),
        };
      });

      const totalWeight = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight <= 0) {
        return null;
      }

      const followUpChance = explicitSecondary || responseMention
        ? 1
        : Math.min(
            0.82,
            0.46
              + (wantsAnotherSpeaker(userText) ? 0.18 : 0)
              + (/[?!？！]/.test(primaryResponse) ? 0.14 : 0)
              + (primaryResponse.length <= 18 ? 0.12 : 0),
          );

      if (Math.random() > followUpChance) {
        return null;
      }

      let cursor = Math.random() * totalWeight;
      for (const item of weightedCandidates) {
        cursor -= item.weight;
        if (cursor <= 0) {
          return item.member;
        }
      }

      return weightedCandidates[weightedCandidates.length - 1]?.member ?? null;
    };

    const shouldContinueFollowUp = (
      intent: GroupReplyIntent,
      contextText: string,
      latestResponse: string,
      usedSpeakerCount: number,
      chainDepth: number,
      conversationHeat: number,
      conversationMomentum: number,
    ) => {
      const isTopicClosing = /(?:差不多得了|行了|够了|别说了|别提了|先停|停一下|打住|收一收|没有\d+|没有[^\s，。！？,.!?]+|不是这个|别聊这个|换个话题)/.test(contextText.trim());
      const memberCount = members.length;
      const isFirstFollowUp = usedSpeakerCount <= 1;
      const isSecondFollowUp = usedSpeakerCount === 2;
      const explicitFollowUpAsk =
        wantsAnotherSpeaker(contextText)
        || intent.kind === 'open_floor'
        || intent.kind === 'force_targets'
        || intent.kind === 'force_all_members';
      const liveTopicContinuation =
        intent.kind === 'group_topic'
        && conversationHeat >= 1.2
        && conversationMomentum >= 0.72
        && !isTopicClosing;
      const hasStrongHook =
        explicitFollowUpAsk
        || /[?!\uFF1F\uFF01]/.test(latestResponse)
        || latestResponse.trim().length <= 14
        || /@/.test(latestResponse);

      if (!hasStrongHook && !liveTopicContinuation) {
        return false;
      }

      if (chainDepth > 0 && !explicitFollowUpAsk && conversationMomentum < 0.95) {
        return false;
      }
      const hotFloorTarget = conversationHeat >= 1.8
        ? (memberCount >= 7 ? 4 : memberCount >= 4 ? 3 : 2)
        : conversationHeat >= 1.2
          ? (memberCount >= 5 ? 3 : 2)
          : 1;
      const baseChance = isFirstFollowUp
        ? (memberCount >= 5 ? 0.56 : memberCount >= 3 ? 0.48 : 0.34)
        : isSecondFollowUp
          ? (memberCount >= 8 ? 0.28 : memberCount >= 5 ? 0.22 : 0.15)
          : 0.08;
      const followUpEnergy =
        (explicitFollowUpAsk ? 0.16 : 0)
        + (/[?!\uFF1F\uFF01]/.test(latestResponse) ? 0.1 : 0)
        + (latestResponse.length <= 18 ? 0.08 : 0)
        + (usedSpeakerCount < hotFloorTarget ? 0.12 : 0)
        + (chainDepth === 0 ? 0.04 : -0.12)
        + conversationHeat * 0.1
        + conversationMomentum * 0.08
        + (liveTopicContinuation ? 0.12 : 0);

      const followUpChance = Math.max(0.02, Math.min(0.72, baseChance + followUpEnergy - (isTopicClosing ? 0.3 : 0)));
      if (Math.random() <= followUpChance) {
        return true;
      }

      return (explicitFollowUpAsk || liveTopicContinuation) && shouldUseActivityFloor({
        memberCount,
        conversationHeat,
        conversationMomentum,
        chainDepth,
        usedSpeakerCount,
        latestResponse,
        contextText,
      });
    };

    const computeConversationHeat = (intent: GroupReplyIntent, contextText: string, latestResponse: string) => {
      const isTopicClosing = /(?:差不多得了|行了|够了|别说了|别提了|先停|停一下|打住|收一收|没有\d+|没有[^\s，。！？,.!?]+|不是这个|别聊这个|换个话题)/.test(contextText.trim());
      let heat = 0;

      if (wantsAnotherSpeaker(contextText)) {
        heat += 1;
      }

      if (/(?:继续|还有谁|都说|一起说|别停|接着聊|热闹点|怎么就你们几个|怎么只有你们)/.test(contextText)) {
        heat += 1;
      }

      if (/[?!\uFF1F\uFF01]/.test(latestResponse)) {
        heat += 0.5;
      }

      if (latestResponse.length <= 18) {
        heat += 0.4;
      }

      if (members.length >= 6) {
        heat += 0.3;
      }

      if (intent.kind === 'group_topic') {
        heat += members.length >= 8 ? 0.6 : members.length >= 5 ? 0.8 : 0.95;
      }

      return Math.max(0, Math.min(2.2, heat - (isTopicClosing ? 1.1 : 0)));
    };

    const resolveFollowUpSpeaker = (followUpParams: {
      intent: GroupReplyIntent;
      contextText: string;
      previousSpeaker: Character;
      latestResponse: string;
      latestHistory: ChatMessage[];
      usedSpeakerIds: string[];
    }) => {
      const explicitMention = followUpParams.intent.kind === 'stop_followups'
        ? null
        : resolveUserTargetCandidates(followUpParams.contextText, followUpParams.usedSpeakerIds)[0] || null;
      if (explicitMention) {
        return explicitMention;
      }

      const responseMention = followUpParams.intent.kind === 'stop_followups'
        ? null
        : extractMentionedMember(followUpParams.latestResponse, []);
      if (responseMention) {
        return responseMention;
      }

      const unusedCandidates = activeSpeakerMembers.filter((member) => !followUpParams.usedSpeakerIds.includes(member.id));
      const candidateMembers = unusedCandidates.length > 0 ? activeSpeakerMembers : activeSpeakerMembers;
      if (candidateMembers.length === 0) {
        return null;
      }

      const weightedCandidates = candidateMembers.map((member) => {
        const baseWeight =
          inferReadableSpeakerWeight(member, `${followUpParams.contextText}\n${followUpParams.latestResponse}`)
          * getGroupStageMultiplier(groupMeta?.groupStage);
        let weight = baseWeight;
        const aliases = getMemberAliases(member);
        const evidence = buildCharacterEvidence(member);
        const recentCount = countRecentMessagesBySpeaker(member.id);
        const participationBonus = computeGroupParticipationBonus({
          character: member,
          userText: `${followUpParams.contextText}\n${followUpParams.latestResponse}`,
          characterEvidence: evidence,
          aliases,
          intentKind: followUpParams.intent.kind,
          isExplicitTarget: false,
          isReplyTarget: false,
          recentCount,
          latestModelSpeakerId: followUpParams.previousSpeaker.id,
        });
        weight += participationBonus;
        const perspectiveWeight = computePerspectiveReactionWeight({
          perspectiveSummary: groupMeta?.groupMemberPerspectiveSummaries?.[member.id],
          latestSpeakerId: followUpParams.previousSpeaker.id,
          memberId: member.id,
          latestText: followUpParams.latestResponse,
        });
        weight += perspectiveWeight;
        const presenceWeight = getPresenceParticipationWeight(member, historyRef.current);
        weight += presenceWeight;
        weight -= recentCount * 0.42;

        if (member.id === followUpParams.previousSpeaker.id) {
          weight -= 1.8;
        }

        const topicState = getUsableGroupTopicState(followUpParams.latestHistory);
        if (topicState?.lastSpeaker === 'character' && topicState.lastSpeakerId && member.id !== topicState.lastSpeakerId) {
          weight += 0.18;
        }

        if (
          topicState?.replyTargetRole === 'model'
          && topicState.replyTargetLabel
          && getMemberAliases(member).some((alias) => alias.trim().toLowerCase() === topicState.replyTargetLabel?.trim().toLowerCase())
        ) {
          weight += 1.15;
        }

        if (followUpParams.intent.kind === 'stop_followups' && member.id !== followUpParams.previousSpeaker.id) {
          weight += 0.55;
        }

        if (!followUpParams.usedSpeakerIds.includes(member.id)) {
          weight += 1.15;
        } else if (unusedCandidates.length > 0) {
          weight -= 0.35;
        }

        if (followUpParams.intent.kind === 'force_all_members') {
          if (!followUpParams.usedSpeakerIds.includes(member.id)) {
            weight += 1.45;
          } else {
            weight -= 0.55;
          }

          if (recentCount === 0) {
            weight += 0.75;
          }
        }

        if (followUpParams.latestResponse.length <= 20 && member.id !== followUpParams.previousSpeaker.id) {
          weight += 0.2;
        }

        if (
          includesAny(buildCharacterEvidence(member), ['\u8bdd\u5c11', '\u51b7\u6de1', '\u514b\u5236', '\u6c89\u9ed8'])
          && !wantsAnotherSpeaker(followUpParams.contextText)
        ) {
          weight -= 0.7;
        }

        if (followUpParams.latestResponse.length <= 16) {
          weight += 0.18;
        }

        return {
          member,
          weight: Math.max(weight, 0.1),
          reasons: {
            base: baseWeight,
            participation: participationBonus,
            perspective: perspectiveWeight,
            presence: presenceWeight,
            recentPenalty: -recentCount * 0.42,
            previousSpeakerPenalty: member.id === followUpParams.previousSpeaker.id ? -1.8 : 0,
            topicReplyTarget: topicState?.replyTargetRole === 'model'
              && topicState.replyTargetLabel
              && getMemberAliases(member).some((alias) => alias.trim().toLowerCase() === topicState.replyTargetLabel?.trim().toLowerCase())
              ? 1.15
              : 0,
            unused: !followUpParams.usedSpeakerIds.includes(member.id) ? 1.15 : 0,
          },
        };
      });

      const totalWeight = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight <= 0) {
        return null;
      }

      let cursor = Math.random() * totalWeight;
      for (const item of weightedCandidates) {
        cursor -= item.weight;
        if (cursor <= 0) {
          return item.member;
        }
      }

      return weightedCandidates[weightedCandidates.length - 1]?.member ?? null;
    };

    const buildFollowUpReplyPayload = (
      intent: GroupReplyIntent,
      sourceMessage: ChatMessage | undefined,
      fallbackAuthor: string,
      contextText: string,
      latestResponse: string,
      previousSpeaker: Character,
      currentHistory: ChatMessage[],
    ) => {
      if (intent.kind === 'stop_followups') {
        return null;
      }

      if (!sourceMessage) {
        return null;
      }

      const isTopicClosing = /(?:差不多得了|行了|够了|别说了|别提了|先停|停一下|打住|收一收|没有\d+|没有[^\s，。！？,.!?]+|不是这个|别聊这个|换个话题)/.test(contextText.trim());
      const explicitReply = resolveUserTargetCandidates(contextText, [previousSpeaker.id])[0] || null;
      const responseReply = extractMentionedMember(latestResponse, []);
      const referencesPreviousSpeaker =
        latestResponse.includes(previousSpeaker.name)
        || contextText.includes(previousSpeaker.name);
      const topicState = getUsableGroupTopicState(currentHistory);
      const shouldKeepLatestCharacterBeat =
        topicState?.lastSpeaker === 'character'
        && topicState.lastSpeakerId === previousSpeaker.id
        && topicState.phase !== 'closing';
      const shouldAttachReply =
        !!explicitReply
        || !!responseReply
        || referencesPreviousSpeaker
        || shouldKeepLatestCharacterBeat;
      if (!shouldAttachReply) {
        return null;
      }

      return buildReplyPreviewPayload(sourceMessage, fallbackAuthor);
    };

    const computeConversationMomentum = (currentHistory: ChatMessage[]) => {
      const recentModelMessages = currentHistory
        .filter((message) => message.role === 'model' && !message.isSystem)
        .slice(-4);

      if (recentModelMessages.length <= 1) {
        return 0;
      }

      const distinctSpeakers = new Set(
        recentModelMessages
          .map((message) => message.senderCharacterId)
          .filter((value): value is string => !!value),
      );
      const replyToModelCount = recentModelMessages.filter((message) => message.replyTo?.role === 'model').length;

      let momentum = 0;
      if (distinctSpeakers.size >= 2) {
        momentum += 0.8;
      }
      if (distinctSpeakers.size >= 3) {
        momentum += 0.45;
      }
      if (replyToModelCount >= 1) {
        momentum += 0.5;
      }
      if (replyToModelCount >= 2) {
        momentum += 0.25;
      }

      return Math.max(0, Math.min(1.8, momentum));
    };

    const scheduleFollowUpSpeakers = (followUpParams: {
      intent: GroupReplyIntent;
      contextText: string;
      latestHistory: ChatMessage[];
      previousSpeaker: Character;
      latestResponse: string;
      interactionId: number;
      chainDepth: number;
      maxFollowUpDepth: number;
      usedSpeakerIds: string[];
      conversationHeat: number;
      forcedSpeakerIds?: string[];
    }) => {
      if (followUpParams.chainDepth >= followUpParams.maxFollowUpDepth) {
        return;
      }

      const pendingForcedSpeakerIds = (followUpParams.forcedSpeakerIds || []).filter(
        (speakerId) => !followUpParams.usedSpeakerIds.includes(speakerId),
      );

      if (
        pendingForcedSpeakerIds.length === 0
        &&
        (
          followUpParams.intent.kind === 'stop_followups'
            ? followUpParams.chainDepth > 0
            : !shouldContinueFollowUp(
                followUpParams.intent,
                followUpParams.contextText,
                followUpParams.latestResponse,
                followUpParams.usedSpeakerIds.length,
                followUpParams.chainDepth,
                followUpParams.conversationHeat,
                computeConversationMomentum(followUpParams.latestHistory),
              )
        )
      ) {
        return;
      }

      const forcedSpeakerId = pendingForcedSpeakerIds[0];
      const nextSpeaker = forcedSpeakerId
        ? members.find((member) => member.id === forcedSpeakerId) || null
        : resolveFollowUpSpeaker({
            intent: followUpParams.intent,
            contextText: followUpParams.contextText,
            previousSpeaker: followUpParams.previousSpeaker,
            latestResponse: followUpParams.latestResponse,
            latestHistory: followUpParams.latestHistory,
            usedSpeakerIds: followUpParams.usedSpeakerIds,
          });
      if (!nextSpeaker) {
        return;
      }

      console.info('[group-chat] follow-up responder scheduled', {
        responderId: nextSpeaker.id,
        responderName: nextSpeaker.name,
        interactionId: followUpParams.interactionId,
        chainDepth: followUpParams.chainDepth,
        maxFollowUpDepth: followUpParams.maxFollowUpDepth,
      });

      delayedSpeakerTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current || activeInteractionIdRef.current !== followUpParams.interactionId) {
          return;
        }

        const latestReplySource = followUpParams.latestHistory[followUpParams.latestHistory.length - 1];
        const replyPayload = buildFollowUpReplyPayload(
          followUpParams.intent,
          latestReplySource,
          followUpParams.previousSpeaker.name,
          followUpParams.contextText,
          followUpParams.latestResponse,
          followUpParams.previousSpeaker,
          followUpParams.latestHistory,
        );

        const speechActInstruction = buildGroupSpeechActInstruction({
          trigger: 'auto',
          act: getGroupSpeechActForPlanPosition({
            index: followUpParams.usedSpeakerIds.length,
            totalCount: followUpParams.maxFollowUpDepth + 1,
            hasExistingTopic: true,
          }),
        });

        void triggerAISpeaker(
          nextSpeaker,
          followUpParams.latestHistory,
          followUpParams.interactionId,
          replyPayload,
          speechActInstruction,
        )
          .then((appendedMessages) => {
            if (
              appendedMessages.length === 0
              || !isMountedRef.current
              || activeInteractionIdRef.current !== followUpParams.interactionId
            ) {
              return;
            }

            const updatedHistory = [...followUpParams.latestHistory, ...appendedMessages];
            const latestMessage = appendedMessages[appendedMessages.length - 1];
            const latestMainText = latestMessage ? getMessageMainText(latestMessage) : followUpParams.latestResponse;

            scheduleFollowUpSpeakers({
              intent: followUpParams.intent,
              contextText: `${followUpParams.contextText}\n${latestMainText}`,
              latestHistory: updatedHistory,
              previousSpeaker: nextSpeaker,
              latestResponse: latestMainText,
              interactionId: followUpParams.interactionId,
              chainDepth: followUpParams.chainDepth + 1,
              maxFollowUpDepth: followUpParams.maxFollowUpDepth,
              usedSpeakerIds: [...followUpParams.usedSpeakerIds, nextSpeaker.id],
              conversationHeat: Math.max(
                followUpParams.conversationHeat,
                computeConversationHeat(followUpParams.intent, `${followUpParams.contextText}\n${latestMainText}`, latestMainText),
              ),
              forcedSpeakerIds: followUpParams.forcedSpeakerIds,
            });
          });
      }, 0);
    };

    clearDelayedSpeakerTimer();
    const interactionId = activeInteractionIdRef.current + 1;
    activeInteractionIdRef.current = interactionId;
    openingRequestIdRef.current += 1;
    secondarySpeakerRequestIdRef.current += 1;

    const messageText = params.message.text;
    const promptText = params.promptText;
    const mentionedMembers = extractMentionedMembers(promptText);
    const intent = resolveGroupReplyIntent({
      text: promptText,
      mentionedMemberIds: mentionedMembers.map((member) => member.id),
      memberIds: members.map((member) => member.id),
    });
    const preferredSpeakerIds =
      intent.kind === 'force_all_members'
        ? members.map((member) => member.id)
        : intent.kind === 'force_targets'
          ? intent.targetIds
          : mentionedMembers.map((member) => member.id);

    const newHistory = [...historyRef.current, {
      ...params.message,
      text: messageText,
    }];
    setHistory(newHistory);
    setInput('');
    setReplyingTo(null);
    console.info('[group-chat] user message appended', {
      text: messageText,
      historyLength: newHistory.length,
      memberCount: members.length,
      intent: intent.kind,
    });

    if (manualReplyModeEnabled) {
      console.info('[group-chat] auto response skipped by manual reply mode', {
        historyLength: newHistory.length,
        intent: intent.kind,
      });
      return;
    }

    try {
      await runGeneration(async ({ generationId }) => {
        const responder = pickPrimaryResponder(promptText, intent, preferredSpeakerIds);

        if (!responder) {
          throw new Error('\u7fa4\u804a\u4e2d\u6ca1\u6709\u53ef\u7528\u7684\u56de\u590d\u89d2\u8272');
        }
        console.info('[group-chat] primary responder selected', {
          responderId: responder.id,
          responderName: responder.name,
          generationId,
          interactionId,
        });

        try {
          const response = await generateMessageForSpeaker({
            speaker: responder,
            currentHistory: newHistory,
            mode: 'reply',
            replyTarget: replyingTo,
            speechActInstruction: buildGroupSpeechActInstruction({
              trigger: 'auto',
              act: getGroupSpeechActForPlanPosition({
                index: 0,
                totalCount: 1,
                hasExistingTopic: true,
              }),
            }),
          });

          if (!isMountedRef.current || activeInteractionIdRef.current !== interactionId || activeGenerationIdRef.current !== generationId) {
            console.info('[group-chat] primary response ignored due to stale interaction', {
              generationId,
              interactionId,
              activeInteractionId: activeInteractionIdRef.current,
              activeGenerationId: activeGenerationIdRef.current,
            });
            return;
          }

          const resolvedMessages = await appendSpeakerMessage(
            responder,
            response.text,
            response.timestamp,
            newHistory,
            undefined,
            false,
            response.sharedState,
            response.stickerPool,
          );
          setPendingMessage(null);
          const latestHistory = [...newHistory, ...resolvedMessages];

          const conversationHeat = computeConversationHeat(intent, promptText, response.text);
          const forcedSpeakerIds = preferredSpeakerIds.filter((speakerId) => speakerId !== responder.id);
          const conversationPlan = createGroupConversationPlan({
            trigger: 'auto',
            intent,
            memberCount: members.length,
            conversationHeat,
            forcedSpeakerCount: forcedSpeakerIds.length,
          });
          scheduleFollowUpSpeakers({
            intent,
            contextText: promptText,
            latestHistory,
            previousSpeaker: responder,
            latestResponse: response.text,
            interactionId,
            chainDepth: 0,
            maxFollowUpDepth: conversationPlan.maxFollowUpDepth,
            usedSpeakerIds: [responder.id],
            conversationHeat,
            forcedSpeakerIds,
          });
        } catch (runtimeError) {
          console.error('Group chat error:', runtimeError);
          setPendingMessage(null);
          if (!isMountedRef.current || activeInteractionIdRef.current !== interactionId || activeGenerationIdRef.current !== generationId) {
            return;
          }

          appendSystemFailure(runtimeError instanceof Error ? runtimeError.message : '\u672a\u77e5\u9519\u8bef');
        }
      });
    } catch (runtimeError) {
      console.error('Group chat fatal error:', runtimeError);
      setPendingMessage(null);
      appendSystemFailure(runtimeError instanceof Error ? runtimeError.message : '\u672a\u77e5\u9519\u8bef');
    }
  }, [
    activeGenerationIdRef,
    clearDelayedSpeakerTimer,
    appendSpeakerMessage,
    appendSystemFailure,
    generateMessageForSpeaker,
    getPresenceParticipationWeight,
    getUsableGroupTopicState,
    groupMeta?.groupStage,
    groupMeta?.groupMemberPerspectiveSummaries,
    manualReplyModeEnabled,
    members,
    runGeneration,
    setError,
    setHistory,
    setInput,
    setPendingMessage,
    setReplyingTo,
    triggerAISpeaker,
  ]);

  const requestManualReply = useCallback(async () => {
    if (!hasActiveConfig || isLoading || activeSpeakerMembers.length === 0 || pendingMessage) {
      return;
    }

    clearDelayedSpeakerTimer();
    const interactionId = activeInteractionIdRef.current + 1;
    activeInteractionIdRef.current = interactionId;
    openingRequestIdRef.current += 1;
    secondarySpeakerRequestIdRef.current += 1;

    const currentHistory = historyRef.current;
    const recentVisibleMessages = currentHistory.filter((message) => !message.isSystem);
    const latestVisibleMessage = recentVisibleMessages[recentVisibleMessages.length - 1] || null;
    const latestText = latestVisibleMessage ? getMessageMainText(latestVisibleMessage) : '';
    try {
      await runGeneration(async ({ generationId }) => {
        let workingHistory = currentHistory;
        let latestReplyText = latestText;
        const selectedSpeakerIds: string[] = [];
        const activeSpeakerIdSet = new Set(activeSpeakerMembers.map((member) => member.id));
        const manualMentionedMemberIds = Array.from(
          new Set(
            Array.from(latestText.matchAll(MENTION_REGEX))
              .map((match) => resolveCharacterByPublicName(match[1], members))
              .filter((member): member is Character => !!member && activeSpeakerIdSet.has(member.id))
              .map((member) => member.id),
          ),
        );
        const manualIntent = resolveGroupReplyIntent({
          text: latestText,
          mentionedMemberIds: manualMentionedMemberIds,
          memberIds: activeSpeakerMembers.map((member) => member.id),
        });
        const manualPlan = createGroupConversationPlan({
          trigger: 'manual',
          intent: manualIntent,
          memberCount: activeSpeakerMembers.length,
          conversationHeat: manualIntent.kind === 'group_topic' || manualIntent.kind === 'open_floor' ? 1.4 : 0.7,
        });
        const targetCount = manualPlan.targetCount;
        for (let index = 0; index < targetCount; index += 1) {
          const latestSpeakerId = [...workingHistory]
            .reverse()
            .find((message) => message.role === 'model' && !message.isSystem)
            ?.senderCharacterId;
          const weightedMembers = activeSpeakerMembers
            .filter((member) => !selectedSpeakerIds.includes(member.id))
            .map((member) => {
              const recentCount = workingHistory
                .filter((message) => message.role === 'model' && message.senderCharacterId === member.id)
                .slice(-6)
                .length;
              let weight = inferReadableSpeakerWeight(
                member,
                latestReplyText || member.sceneHints?.groupChat || member.corePersona || member.name,
              ) * getGroupStageMultiplier(groupMeta?.groupStage);

              if (latestSpeakerId === member.id) {
                weight -= 1.2;
              }
              weight += computePerspectiveReactionWeight({
                perspectiveSummary: groupMeta?.groupMemberPerspectiveSummaries?.[member.id],
                latestSpeakerId,
                memberId: member.id,
                latestText: latestReplyText,
              });
              weight += getPresenceParticipationWeight(member, workingHistory);

              if (index > 0) {
                weight += 0.65;
              }

              weight -= recentCount * 0.35;

              return {
                member,
                weight: Math.max(weight, 0.2),
              };
            });
          const responder = pickWeightedMember(weightedMembers);
          if (!responder) {
            break;
          }

          const response = await generateMessageForSpeaker({
            speaker: responder,
            currentHistory: workingHistory,
            mode: latestVisibleMessage || index > 0 ? 'reply' : 'opening',
            replyTarget: index === 0 ? replyingTo : null,
            speechActInstruction: buildGroupSpeechActInstruction({
              trigger: 'manual',
              act: getGroupSpeechActForPlanPosition({
                index,
                totalCount: targetCount,
                hasExistingTopic: !!latestVisibleMessage,
              }),
            }),
          });

          if (!isMountedRef.current || activeInteractionIdRef.current !== interactionId || activeGenerationIdRef.current !== generationId) {
            return;
          }

          const appendedMessages = await appendSpeakerMessage(
            responder,
            response.text,
            response.timestamp,
            workingHistory,
            index === 0 ? replyingTo : null,
            true,
            response.sharedState,
            response.stickerPool,
          );
          setPendingMessage(null);
          if (appendedMessages.length === 0) {
            break;
          }

          selectedSpeakerIds.push(responder.id);
          workingHistory = [...workingHistory, ...appendedMessages];
          const latestAppendedMessage = appendedMessages[appendedMessages.length - 1];
          latestReplyText = latestAppendedMessage ? getMessageMainText(latestAppendedMessage) : response.text;
        }
      });
    } catch (runtimeError) {
      console.error('Manual group reply error:', runtimeError);
      setPendingMessage(null);
      appendSystemFailure(runtimeError instanceof Error ? runtimeError.message : '\u624b\u52a8\u7fa4\u804a\u56de\u590d\u5931\u8d25');
    }
  }, [
    activeGenerationIdRef,
    activeSpeakerMembers,
    appendSpeakerMessage,
    appendSystemFailure,
    clearDelayedSpeakerTimer,
    generateMessageForSpeaker,
    getPresenceParticipationWeight,
    groupMeta?.groupStage,
    groupMeta?.groupMemberPerspectiveSummaries,
    hasActiveConfig,
    isLoading,
    members,
    pendingMessage,
    pickWeightedMember,
    replyingTo,
    runGeneration,
  ]);

  const regenerateLatestReplyAt = useCallback(async (index: number) => {
    if (!hasActiveConfig || isLoading || members.length === 0 || pendingMessage) {
      return false;
    }

    const currentHistory = historyRef.current;
    let end = -1;
    for (let cursor = currentHistory.length - 1; cursor >= 0; cursor -= 1) {
      const message = currentHistory[cursor];
      if (message.isSystem || message.isRecalled) {
        continue;
      }
      if (message.role !== 'model') {
        return false;
      }
      end = cursor;
      break;
    }
    if (end < 0) {
      return false;
    }

    const endMessage = currentHistory[end];
    const speakerId = endMessage.senderCharacterId;
    if (!speakerId) {
      return false;
    }

    let start = end;
    for (let cursor = end - 1; cursor >= 0; cursor -= 1) {
      const message = currentHistory[cursor];
      if (
        message.role !== 'model'
        || message.isSystem
        || message.isRecalled
        || message.senderCharacterId !== speakerId
      ) {
        break;
      }
      start = cursor;
    }

    if (index < start || index > end) {
      return false;
    }

    const speaker = members.find((member) => member.id === speakerId);
    if (!speaker) {
      return false;
    }

    clearDelayedSpeakerTimer();
    const interactionId = activeInteractionIdRef.current + 1;
    activeInteractionIdRef.current = interactionId;
    openingRequestIdRef.current += 1;
    secondarySpeakerRequestIdRef.current += 1;

    const baseHistory = currentHistory.slice(0, start);
    const replyTarget = currentHistory[start]?.replyTo ?? null;
    let didRegenerate = false;

    try {
      await runGeneration(async ({ generationId }) => {
        const response = await generateMessageForSpeaker({
          speaker,
          currentHistory: baseHistory,
          mode: replyTarget ? 'reply' : 'invited',
          replyTarget,
        });

        if (!isMountedRef.current || activeInteractionIdRef.current !== interactionId || activeGenerationIdRef.current !== generationId) {
          return;
        }

        const appendedMessages = await appendSpeakerMessage(
          speaker,
          response.text,
          response.timestamp,
          baseHistory,
          replyTarget,
          true,
          response.sharedState,
          response.stickerPool,
        );
        didRegenerate = appendedMessages.length > 0;
        setPendingMessage(null);
      });
      return didRegenerate;
    } catch (runtimeError) {
      console.error('Regenerate latest group reply error:', runtimeError);
      setPendingMessage(null);
      appendSystemFailure(runtimeError instanceof Error ? runtimeError.message : '重回失败');
      return false;
    }
  }, [
    activeGenerationIdRef,
    appendSpeakerMessage,
    appendSystemFailure,
    clearDelayedSpeakerTimer,
    generateMessageForSpeaker,
    hasActiveConfig,
    isLoading,
    members,
    pendingMessage,
    runGeneration,
    setHistory,
  ]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    if (!hasActiveConfig) {
      setError('\u8bf7\u5148\u5728\u8bbe\u7f6e\u4e2d\u914d\u7f6e\u53ef\u7528\u7684 API');
      return;
    }

    await submitUserMessage({
      message: {
        role: 'user',
        text: input.trim(),
        timestamp: Date.now(),
        ...(replyingTo ? { replyTo: replyingTo } : {}),
      },
      promptText: input.trim(),
    });
  }, [hasActiveConfig, input, replyingTo, setError, submitUserMessage]);

  const sendSpeechTranscript = useCallback(async (transcript: string) => {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) return;
    if (!hasActiveConfig) {
      setError('\u8bf7\u5148\u5728\u8bbe\u7f6e\u4e2d\u914d\u7f6e\u53ef\u7528\u7684 API');
      return;
    }

    setInput('');
    await submitUserMessage({
      message: {
        role: 'user',
        text: trimmedTranscript,
        timestamp: Date.now(),
        ...(replyingTo ? { replyTo: replyingTo } : {}),
      },
      promptText: trimmedTranscript,
    });
  }, [hasActiveConfig, replyingTo, setError, setInput, submitUserMessage]);

  const persistImageValueIfNeeded = useCallback(async (imageValue: string) => {
    const trimmedImageValue = imageValue.trim();
    if (!trimmedImageValue) {
      return trimmedImageValue;
    }

    if (/^data:image\//i.test(trimmedImageValue)) {
      try {
        return await saveUploadedDataUrl(
          trimmedImageValue,
          `group-chat-image-${Date.now()}.png`,
        );
      } catch (error) {
        console.error('Failed to persist group chat image payload before send', error);
        return trimmedImageValue;
      }
    }

    if (/^https?:\/\//i.test(trimmedImageValue)) {
      try {
        return await cacheRemoteAsset(trimmedImageValue, `group-chat-image-${Date.now()}`);
      } catch (error) {
        console.error('Failed to cache group chat remote image before send', error);
      }
    }

    return trimmedImageValue;
  }, []);

  const sendImageMessage = useCallback(async (imageValue: string) => {
    if (!hasActiveConfig) return;
    const persistedImageValue = await persistImageValueIfNeeded(imageValue);

    await submitUserMessage({
      message: {
        role: 'user',
        text: '[image]',
        imageUrl: persistedImageValue,
        timestamp: Date.now(),
        ...(replyingTo ? { replyTo: replyingTo } : {}),
      },
      promptText: '[sent an image]',
    });
  }, [hasActiveConfig, persistImageValueIfNeeded, replyingTo, submitUserMessage]);

  const sendAudioMessage = useCallback(async (audioUrl: string, audioMimeType: string, durationSeconds?: number, audioTranscript?: string) => {
    if (!hasActiveConfig) return;

    await submitUserMessage({
      message: {
        role: 'user',
        text: '[audio]',
        audioUrl,
        audioMimeType,
        ...(audioTranscript?.trim() ? { audioTranscript: audioTranscript.trim() } : {}),
        ...(typeof durationSeconds === 'number' ? { duration: durationSeconds } : {}),
        timestamp: Date.now(),
        ...(replyingTo ? { replyTo: replyingTo } : {}),
      },
      promptText: audioTranscript?.trim()
        ? `[sent a voice message; transcript: ${audioTranscript.trim()}]`
        : '[sent a voice message]',
    });
  }, [hasActiveConfig, replyingTo, submitUserMessage]);

  const sendStickerMessage = useCallback(async (sticker: string) => {
    if (!hasActiveConfig) return;

    const stickerMetadata = getStickerMetadata(runtimeAllStickerMetadata, sticker);
    const stickerLabel = inferStickerSemanticLabel(sticker, undefined, stickerMetadata);
    const persistedSticker = await persistImageValueIfNeeded(sticker);

    await submitUserMessage({
      message: {
        role: 'user',
        text: '[sticker]',
        imageUrl: persistedSticker,
        ...(stickerLabel ? { stickerLabel } : {}),
        timestamp: Date.now(),
        ...(replyingTo ? { replyTo: replyingTo } : {}),
      },
      promptText: describeStickerMessageForPrompt({
        imageUrl: persistedSticker,
        text: '[sticker]',
        stickerLabel,
      }),
    });
  }, [hasActiveConfig, persistImageValueIfNeeded, replyingTo, runtimeAllStickerMetadata, submitUserMessage]);

  const sendLocationMessage = useCallback(async (location: { name: string; address?: string; isVirtual?: boolean }) => {
    if (!hasActiveConfig) return;

    await submitUserMessage({
      message: {
        role: 'user',
        text: `[location] ${location.name}`,
        location,
        timestamp: Date.now(),
        ...(replyingTo ? { replyTo: replyingTo } : {}),
      },
      promptText: `[sent location] ${location.name}${location.address ? `, ${location.address}` : ''}`,
    });
  }, [hasActiveConfig, replyingTo, submitUserMessage]);

  return {
    isLoading,
    error,
    pendingMessage,
    sendText: handleSend,
    sendSpeechTranscript,
    sendImageMessage,
    sendAudioMessage,
    sendStickerMessage,
    sendLocationMessage,
    sendPokeInteraction,
    regenerateLatestReplyAt,
    requestManualReply,
    maybeOpenScene,
    reactToNoticeUpdate,
    handleReceiveTransfer,
    handleRejectTransfer,
  };
}

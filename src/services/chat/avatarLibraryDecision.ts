import type { ApiConfig, Character, ChatMessage, CharacterAvatarPreferenceAffinity } from '../../types';
import { getMessageMainText } from '../../utils';
import { streamTextWithConfig, type RuntimeChatMessage } from '../ai/runtimeClient';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import {
  getLatestVisibleUserMessage,
  hasAvatarAppearanceReference,
  hasAvatarChangeIntent,
  hasAvatarFollowUpIntent,
  resolveLatestAvatarCandidateForUserTurn,
  type ParsedAvatarAction,
} from './avatarActions';
import { pickPreferredAvatarLibraryEntry } from './avatarPreference';

export type AvatarLibraryDecisionTrigger = 'user_request' | 'autonomous';
export type AvatarLibraryDecisionType = 'ignore' | 'ask_confirm' | 'change' | 'reject';
export type AvatarLibraryDecisionConfidence = 'low' | 'medium' | 'high';

export type AvatarLibraryDecisionReview = {
  trigger: AvatarLibraryDecisionTrigger;
  decision: AvatarLibraryDecisionType;
  confidence: AvatarLibraryDecisionConfidence;
  selectedEntryId?: string;
  reason: string;
  replyHint: string;
  action: ParsedAvatarAction | null;
  origin: 'model' | 'fallback';
};

type RawAvatarLibraryDecisionProtocol = {
  decision?: unknown;
  confidence?: unknown;
  entry_id?: unknown;
  reason?: unknown;
  reply_hint?: unknown;
};

const AVATAR_LIBRARY_DECISION_PROTOCOL_TOKEN = '[AVATAR_LIBRARY_DECISION]';
const TEXT_ONLY_LIBRARY_SWITCH_TRIGGER_REGEX = /(?:头像|样子|形象|风格|造型|版本|哥哥|姐姐|弟弟|妹妹)|(?:再?换(?:一|个|张|套|版|种))/u;

function resolveAvatarAutonomyConfig(mode: Character['avatarAutonomyMode']) {
  switch (mode) {
    case 'conservative':
      return {
        mode: 'conservative' as const,
        minScore: 10,
        cooldownMs: 18 * 60 * 60 * 1000,
        dailyLimit: 1,
      };
    case 'frequent':
      return {
        mode: 'frequent' as const,
        minScore: 5,
        cooldownMs: 2 * 60 * 60 * 1000,
        dailyLimit: 4,
      };
    case 'natural':
    default:
      return {
        mode: 'natural' as const,
        minScore: 7,
        cooldownMs: 6 * 60 * 60 * 1000,
        dailyLimit: 2,
      };
  }
}

function normalizeProtocolString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\r?\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeDecisionType(value: unknown): AvatarLibraryDecisionType | null {
  const normalized = normalizeProtocolString(value).toLowerCase();
  if (normalized === 'ignore' || normalized === 'ask_confirm' || normalized === 'change' || normalized === 'reject') {
    return normalized;
  }
  return null;
}

function normalizeDecisionConfidence(value: unknown): AvatarLibraryDecisionConfidence | null {
  const normalized = normalizeProtocolString(value).toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return null;
}

function summarizeText(value: string | undefined) {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  return normalized.length > 96 ? `${normalized.slice(0, 96)}...` : normalized;
}

function formatRecentMessages(messages: ChatMessage[], characterName: string, userName: string) {
  return messages
    .filter((message) => !message.isSystem && !message.isRecalled)
    .slice(-6)
    .map((message) => {
      const label = message.role === 'user' ? (userName || '用户') : characterName;
      const parts: string[] = [];
      if (message.imageUrl) parts.push('[图片]');
      if (message.audioUrl) parts.push('[语音]');
      const mainText = getMessageMainText(message);
      if (mainText) parts.push(mainText);
      return `${label}: ${parts.join(' ').trim() || '[空消息]'}`;
    })
    .join('\n');
}

function formatAffinityLabel(value: CharacterAvatarPreferenceAffinity | undefined) {
  switch (value) {
    case 'love':
      return '很喜欢';
    case 'like':
      return '偏喜欢';
    case 'neutral':
      return '一般';
    case 'avoid':
      return '会回避';
    default:
      return '未知';
  }
}

function formatLibraryEntriesForPrompt(params: {
  character: Character;
  latestUserText?: string;
  shortTermSummary?: string;
  sharedRecentRelationshipSummary?: string;
  trigger: AvatarLibraryDecisionTrigger;
}) {
  const picked = pickPreferredAvatarLibraryEntry({
    character: params.character,
    latestUserText: params.latestUserText,
    shortTermSummary: params.shortTermSummary,
    sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
    trigger: params.trigger,
  });

  return picked.entries.slice(0, 8).map(({ entry, score }, index) => {
    const parts = [
      `${index + 1}. id=${entry.id}`,
      `score=${score}`,
      `status=${entry.status}`,
      entry.preference?.affinity ? `affinity=${formatAffinityLabel(entry.preference.affinity)}` : '',
      entry.preference?.selfFit ? `selfFit=${entry.preference.selfFit}` : '',
      entry.characterChoiceCount ? `chosenByCharacter=${entry.characterChoiceCount}` : '',
      entry.preference?.moodTags?.length ? `moodTags=${entry.preference.moodTags.join(',')}` : '',
      entry.preference?.sceneTags?.length ? `sceneTags=${entry.preference.sceneTags.join(',')}` : '',
      entry.preference?.note ? `note=${entry.preference.note}` : '',
      entry.reason ? `reason=${entry.reason}` : '',
      entry.reaction ? `reaction=${entry.reaction}` : '',
    ].filter(Boolean);
    return parts.join(' / ');
  }).join('\n');
}

function parseAvatarLibraryDecisionProtocol(text: string): RawAvatarLibraryDecisionProtocol | null {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return null;
  }

  const tokenIndex = trimmedText.indexOf(AVATAR_LIBRARY_DECISION_PROTOCOL_TOKEN);
  const body = tokenIndex >= 0
    ? trimmedText.slice(tokenIndex + AVATAR_LIBRARY_DECISION_PROTOCOL_TOKEN.length).trim()
    : trimmedText;

  const jsonStart = body.indexOf('{');
  const jsonEnd = body.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    return null;
  }

  try {
    return JSON.parse(body.slice(jsonStart, jsonEnd + 1)) as RawAvatarLibraryDecisionProtocol;
  } catch {
    return null;
  }
}

function isImageDrivenAvatarOfferPresent(messages: ChatMessage[]) {
  return !!resolveLatestAvatarCandidateForUserTurn(messages);
}

function hasBroadTextOnlyLibrarySwitchIntent(text: string) {
  const normalized = text.trim();
  if (!normalized) return false;
  return TEXT_ONLY_LIBRARY_SWITCH_TRIGGER_REGEX.test(normalized);
}

export function shouldReviewTextOnlyAvatarLibraryDecision(character: Character, messages: ChatMessage[]) {
  if ((character.avatarLibrary?.entries || []).filter((entry) => entry.image && entry.image !== character.avatar).length === 0) {
    return false;
  }

  if (isImageDrivenAvatarOfferPresent(messages)) {
    return false;
  }

  const latestUserMessage = getLatestVisibleUserMessage(messages);
  const latestText = latestUserMessage ? getMessageMainText(latestUserMessage) : '';
  if (!latestText) {
    return false;
  }

  return hasAvatarChangeIntent(latestText)
    || hasAvatarAppearanceReference(latestText)
    || hasAvatarFollowUpIntent(latestText)
    || hasBroadTextOnlyLibrarySwitchIntent(latestText);
}

export function shouldReviewAutonomousAvatarLibraryDecision(params: {
  character: Character;
  messages: ChatMessage[];
  latestUserText?: string;
  shortTermSummary?: string;
  sharedRecentRelationshipSummary?: string;
}): boolean {
  if ((params.character.avatarLibrary?.entries || []).filter((entry) => entry.image && entry.image !== params.character.avatar).length === 0) {
    return false;
  }

  if (isImageDrivenAvatarOfferPresent(params.messages)) {
    return false;
  }

  const picked = pickPreferredAvatarLibraryEntry({
    character: params.character,
    latestUserText: params.latestUserText,
    shortTermSummary: params.shortTermSummary,
    sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
    trigger: 'autonomous',
  });

  if (!picked.best) {
    return false;
  }

  const autonomyConfig = resolveAvatarAutonomyConfig(params.character.avatarAutonomyMode);

  const recentCharacterChoiceAt = Math.max(
    0,
    ...(params.character.avatarLibrary?.entries || []).map((entry) => entry.lastCharacterChoiceAt || entry.lastUsedAt || 0),
  );
  if (recentCharacterChoiceAt > 0 && Date.now() - recentCharacterChoiceAt < autonomyConfig.cooldownMs) {
    return false;
  }

  const characterChoiceCountToday = (params.character.avatarLibrary?.entries || [])
    .reduce((count, entry) => (
      entry.lastCharacterChoiceAt && Date.now() - entry.lastCharacterChoiceAt < 24 * 60 * 60 * 1000
        ? count + 1
        : count
    ), 0);
  if (characterChoiceCountToday >= autonomyConfig.dailyLimit) {
    return false;
  }

  return picked.best.score >= autonomyConfig.minScore;
}

function buildDefaultReplyHint(trigger: AvatarLibraryDecisionTrigger, decision: AvatarLibraryDecisionType) {
  if (decision === 'change') {
    return trigger === 'autonomous'
      ? '如果你提到头像，就像自己一时兴起换了个更顺眼的样子，轻轻带过，不要像系统通知。'
      : '自然告诉用户你已经从头像库里挑了更顺眼的一张换上，口吻要像角色自己。';
  }

  if (decision === 'ask_confirm') {
    return '自然确认一下这次是不是想让你从头像库里换一张，不要说成设置项。';
  }

  if (decision === 'reject') {
    return '按角色口吻自然表示这轮不想换头像，不要像在执行规则。';
  }

  return trigger === 'autonomous'
    ? '不要主动提头像，按普通聊天或主动开口继续。'
    : '如果用户不是在说头像，就不要主动把话题扯到头像库。';
}

function buildDefaultReason(params: {
  trigger: AvatarLibraryDecisionTrigger;
  latestUserText: string;
  bestScore?: number;
}) {
  if (params.trigger === 'autonomous') {
    return typeof params.bestScore === 'number' && params.bestScore >= 7
      ? '当前状态和偏好都足够支持角色自己从头像库里换一张喜欢的头像。'
      : '当前还不到角色会主动折腾头像的时机。';
  }

  if (hasAvatarChangeIntent(params.latestUserText) || hasBroadTextOnlyLibrarySwitchIntent(params.latestUserText)) {
    return '用户这轮更像是在让角色从已有头像库里换一张。';
  }

  if (hasAvatarAppearanceReference(params.latestUserText)) {
    return '这轮更像在聊形象或气质，需要先确认是不是要从头像库里换头像。';
  }

  return '当前文字还不够像明确的头像库切换请求。';
}

export function deriveFallbackAvatarLibraryDecision(params: {
  character: Character;
  trigger: AvatarLibraryDecisionTrigger;
  latestUserText: string;
  shortTermSummary?: string;
  sharedRecentRelationshipSummary?: string;
}): AvatarLibraryDecisionReview {
  const picked = pickPreferredAvatarLibraryEntry({
    character: params.character,
    latestUserText: params.latestUserText,
    shortTermSummary: params.shortTermSummary,
    sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
    trigger: params.trigger,
  });
  const best = picked.best;
  const explicitRequest = hasAvatarChangeIntent(params.latestUserText) || hasBroadTextOnlyLibrarySwitchIntent(params.latestUserText);
  const appearanceReference = hasAvatarAppearanceReference(params.latestUserText);

  let decision: AvatarLibraryDecisionType = 'ignore';
  let confidence: AvatarLibraryDecisionConfidence = 'low';

  if (params.trigger === 'autonomous') {
    const autonomyConfig = resolveAvatarAutonomyConfig(params.character.avatarAutonomyMode);
    if (best && best.score >= autonomyConfig.minScore) {
      decision = 'change';
      confidence = best.score >= autonomyConfig.minScore + 3 ? 'high' : 'medium';
    }
  } else if (explicitRequest) {
    if (best && best.score >= 2) {
      decision = 'change';
      confidence = best.score >= 6 ? 'high' : 'medium';
    } else {
      decision = 'ask_confirm';
      confidence = 'medium';
    }
  } else if (appearanceReference) {
    decision = 'ask_confirm';
    confidence = 'medium';
  }

  const reason = buildDefaultReason({
    trigger: params.trigger,
    latestUserText: params.latestUserText,
    bestScore: best?.score,
  });
  const replyHint = buildDefaultReplyHint(params.trigger, decision);

  return {
    trigger: params.trigger,
    decision,
    confidence,
    ...(best?.entry?.id && decision !== 'ignore' ? { selectedEntryId: best.entry.id } : {}),
    reason,
    replyHint,
    action: best?.entry?.id && decision === 'change'
      ? {
          type: 'change',
          source: `avatar_library:${best.entry.id}`,
          reason,
        }
      : decision === 'ask_confirm'
        ? {
            type: 'ask_confirm',
            source: best?.entry?.id ? `avatar_library:${best.entry.id}` : 'current_avatar',
            reason,
          }
        : null,
    origin: 'fallback',
  };
}

function normalizeAvatarLibraryDecision(params: {
  character: Character;
  trigger: AvatarLibraryDecisionTrigger;
  latestUserText: string;
  shortTermSummary?: string;
  sharedRecentRelationshipSummary?: string;
  raw: RawAvatarLibraryDecisionProtocol | null;
}): AvatarLibraryDecisionReview {
  const fallback = deriveFallbackAvatarLibraryDecision({
    character: params.character,
    trigger: params.trigger,
    latestUserText: params.latestUserText,
    shortTermSummary: params.shortTermSummary,
    sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
  });
  if (!params.raw) {
    return fallback;
  }

  const selectedEntryId = normalizeProtocolString(params.raw.entry_id);
  const decision = normalizeDecisionType(params.raw.decision) || fallback.decision;
  const confidence = normalizeDecisionConfidence(params.raw.confidence) || fallback.confidence;
  const reason = normalizeProtocolString(params.raw.reason) || fallback.reason;
  const replyHint = normalizeProtocolString(params.raw.reply_hint) || fallback.replyHint;
  const selectedEntry = selectedEntryId
    ? (params.character.avatarLibrary?.entries || []).find((entry) => entry.id === selectedEntryId && entry.image !== params.character.avatar)
    : undefined;

  let normalizedDecision = decision;
  if ((normalizedDecision === 'change' || normalizedDecision === 'reject' || normalizedDecision === 'ask_confirm') && !selectedEntry) {
    normalizedDecision = fallback.decision;
  }
  if (params.trigger === 'autonomous' && normalizedDecision === 'ask_confirm') {
    normalizedDecision = 'ignore';
  }

  return {
    trigger: params.trigger,
    decision: normalizedDecision,
    confidence,
    ...(selectedEntry?.id && normalizedDecision !== 'ignore' ? { selectedEntryId: selectedEntry.id } : {}),
    reason,
    replyHint,
    action: selectedEntry?.id && normalizedDecision === 'change'
      ? {
          type: 'change',
          source: `avatar_library:${selectedEntry.id}`,
          reason,
        }
      : selectedEntry?.id && normalizedDecision === 'reject'
        ? {
            type: 'reject',
            source: `avatar_library:${selectedEntry.id}`,
            reason,
          }
        : selectedEntry?.id && normalizedDecision === 'ask_confirm'
          ? {
              type: 'ask_confirm',
              source: `avatar_library:${selectedEntry.id}`,
              reason,
            }
          : null,
    origin: 'model',
  };
}

function buildDecisionPrompts(params: {
  character: Character;
  trigger: AvatarLibraryDecisionTrigger;
  latestUserText: string;
  userName: string;
  messages: ChatMessage[];
  shortTermSummary?: string;
  sharedRecentRelationshipSummary?: string;
}) {
  const characterContext = buildCharacterContext({
    character: params.character,
  });
  const characterLabel = params.character.remarkName?.trim() || params.character.name;
  const systemPrompt = [
    '你不是在回复用户，而是在做一次“头像库切换决策”。',
    '任务：判断这轮是否应该从已有头像库里切换头像，以及如果要换，选哪一张。',
    'decision 只能填：ignore | ask_confirm | change | reject',
    'confidence 只能填：low | medium | high',
    '如果 decision 不是 ignore，就必须填写 entry_id，且必须从给定头像库 id 里选。',
    '规则：',
    '1. user_request 表示用户这轮像是在让角色从头像库里换头像；先判断是不是真的在说这个。',
    '2. autonomous 表示用户没有下命令，只有在角色按自己性格和当前状态，真的会主动换头像时，才允许 change。',
    '3. 不要因为用户随便聊到“哥哥”“样子”就机械换头像。',
    '4. autonomous 模式下，如果不够自然就用 ignore，不要勉强找一张换。',
    '5. 优先参考角色自己过去更喜欢、自己选过、或者更符合当前状态的头像。',
    `最后只输出一行：${AVATAR_LIBRARY_DECISION_PROTOCOL_TOKEN} {"decision":"...","confidence":"...","entry_id":"...","reason":"...","reply_hint":"..."}`,
  ].join('\n');

  const userMessage = [
    `触发模式：${params.trigger}`,
    `角色：${characterLabel}`,
    characterContext.corePersona ? `核心人设：${characterContext.corePersona}` : '',
    characterContext.expressionStyle ? `表达风格：${characterContext.expressionStyle}` : '',
    characterContext.boundaryPack ? `边界底色：${characterContext.boundaryPack}` : '',
    params.shortTermSummary ? `最近状态摘要：${params.shortTermSummary}` : '',
    params.sharedRecentRelationshipSummary ? `最近关系余波：${params.sharedRecentRelationshipSummary}` : '',
    `当前头像是否已有：${params.character.avatar ? '有' : '无'}`,
    `最新用户话：${params.latestUserText || '[无，当前是角色主动开口]'}`,
    formatRecentMessages(params.messages, characterLabel, params.userName)
      ? `最近聊天：\n${formatRecentMessages(params.messages, characterLabel, params.userName)}`
      : '',
    `头像库候选：\n${formatLibraryEntriesForPrompt({
      character: params.character,
      latestUserText: params.latestUserText,
      shortTermSummary: params.shortTermSummary,
      sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
      trigger: params.trigger,
    })}`,
  ].filter(Boolean).join('\n');

  return { systemPrompt, userMessage };
}

function formatDecisionLabel(decision: AvatarLibraryDecisionType) {
  switch (decision) {
    case 'change':
      return '从头像库里直接换头像';
    case 'ask_confirm':
      return '先确认再换';
    case 'reject':
      return '这轮明确不想换';
    case 'ignore':
    default:
      return '按普通聊天处理';
  }
}

export function buildAvatarLibraryDecisionReplyPromptSection(review: AvatarLibraryDecisionReview | null): string {
  if (!review) {
    return '';
  }

  return [
    '## 本轮头像库切换结论',
    '这部分已经先判好了，不要重新分析，只需要按这个结论自然说话。',
    `触发模式：${review.trigger === 'autonomous' ? '角色自己在想要不要换头像' : '用户可能在让你从头像库里换头像'}`,
    `结论：${formatDecisionLabel(review.decision)}`,
    `内部理由：${review.reason}`,
    `回复要求：${review.replyHint}`,
  ].join('\n');
}

export async function evaluateAvatarLibraryDecision(params: {
  activeConfig: ApiConfig;
  character: Character;
  trigger: AvatarLibraryDecisionTrigger;
  latestUserText: string;
  userName: string;
  messages: ChatMessage[];
  shortTermSummary?: string;
  sharedRecentRelationshipSummary?: string;
}): Promise<AvatarLibraryDecisionReview | null> {
  if (params.trigger === 'user_request' && !shouldReviewTextOnlyAvatarLibraryDecision(params.character, params.messages)) {
    return null;
  }
  if (params.trigger === 'autonomous' && !shouldReviewAutonomousAvatarLibraryDecision({
    character: params.character,
    messages: params.messages,
    latestUserText: params.latestUserText,
    shortTermSummary: params.shortTermSummary,
    sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
  })) {
    return null;
  }

  const { systemPrompt, userMessage } = buildDecisionPrompts({
    character: params.character,
    trigger: params.trigger,
    latestUserText: params.latestUserText,
    userName: params.userName,
    messages: params.messages,
    shortTermSummary: params.shortTermSummary,
    sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
  });

  const runtimeMessages: RuntimeChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  try {
    let rawText = '';
    await streamTextWithConfig({
      activeConfig: params.activeConfig,
      messages: runtimeMessages,
      temperature: Math.min(params.activeConfig.temperature ?? 0.7, 0.22),
      onTextChunk: (chunkText) => {
        rawText += chunkText;
      },
    });

    return normalizeAvatarLibraryDecision({
      character: params.character,
      trigger: params.trigger,
      latestUserText: params.latestUserText,
      shortTermSummary: params.shortTermSummary,
      sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
      raw: parseAvatarLibraryDecisionProtocol(rawText),
    });
  } catch (error) {
    console.warn('[avatar-library] decision review failed, falling back to local scoring.', {
      characterId: params.character.id,
      trigger: params.trigger,
      error: error instanceof Error ? error.message : String(error),
    });
    return deriveFallbackAvatarLibraryDecision({
      character: params.character,
      trigger: params.trigger,
      latestUserText: params.latestUserText,
      shortTermSummary: params.shortTermSummary,
      sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
    });
  }
}

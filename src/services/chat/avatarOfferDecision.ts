import type { ApiConfig, Character, ChatMessage } from '../../types';
import { getMessageMainText } from '../../utils';
import { streamTextWithConfig, type RuntimeChatMessage } from '../ai/runtimeClient';
import { canUseMomentImageInputs } from '../moments/momentRecentImageReferences';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import {
  getLatestVisibleUserMessage,
  hasAvatarAppearanceReference,
  hasAvatarChangeIntent,
  hasAvatarFollowUpIntent,
  resolveLatestAvatarCandidateForUserTurn,
  type AvatarCandidate,
  type AvatarActionType,
  type ParsedAvatarAction,
} from './avatarActions';

export type AvatarOfferIntent =
  | 'share_life'
  | 'avatar_offer'
  | 'appearance_reference'
  | 'sticker_or_meme'
  | 'unclear';

export type AvatarOfferDecisionType =
  | 'ignore'
  | 'save_only'
  | 'ask_confirm'
  | 'change'
  | 'reject';

export type AvatarOfferDecisionConfidence = 'low' | 'medium' | 'high';

export type AvatarOfferDecisionReview = {
  intent: AvatarOfferIntent;
  decision: AvatarOfferDecisionType;
  confidence: AvatarOfferDecisionConfidence;
  reason: string;
  replyHint: string;
  candidate: AvatarCandidate;
  action: ParsedAvatarAction | null;
  origin: 'model' | 'fallback';
  usedImageInput: boolean;
};

type RawAvatarOfferDecisionProtocol = {
  intent?: unknown;
  decision?: unknown;
  confidence?: unknown;
  reason?: unknown;
  reply_hint?: unknown;
};

type AvatarOfferFallbackContext = {
  explicitAvatarRequest: boolean;
  appearanceReference: boolean;
  followUpReference: boolean;
  imageOnly: boolean;
  usedImageInput: boolean;
};

const AVATAR_OFFER_DECISION_PROTOCOL_TOKEN = '[AVATAR_OFFER_DECISION]';
const STICKER_MESSAGE_REGEX = /^\[(?:sticker|表情包)\]/i;
const IMAGE_PLACEHOLDER_REGEX = /^\[(?:image|图片)\]$/i;

function normalizeProtocolString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\r?\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeDecisionIntent(value: unknown): AvatarOfferIntent | null {
  const normalized = normalizeProtocolString(value).toLowerCase();
  if (
    normalized === 'share_life'
    || normalized === 'avatar_offer'
    || normalized === 'appearance_reference'
    || normalized === 'sticker_or_meme'
    || normalized === 'unclear'
  ) {
    return normalized;
  }
  return null;
}

function normalizeDecisionType(value: unknown): AvatarOfferDecisionType | null {
  const normalized = normalizeProtocolString(value).toLowerCase();
  if (
    normalized === 'ignore'
    || normalized === 'save_only'
    || normalized === 'ask_confirm'
    || normalized === 'change'
    || normalized === 'reject'
  ) {
    return normalized;
  }
  return null;
}

function normalizeDecisionConfidence(value: unknown): AvatarOfferDecisionConfidence | null {
  const normalized = normalizeProtocolString(value).toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return null;
}

function describeMessageForIntentReview(message: ChatMessage, characterName: string, userName: string) {
  const label = message.role === 'user' ? (userName || '用户') : characterName;
  const mainText = getMessageMainText(message);
  const parts: string[] = [];

  if (message.imageUrl) {
    parts.push(STICKER_MESSAGE_REGEX.test((message.text || '').trim()) ? '[表情包]' : '[图片]');
  }
  if (message.audioUrl) {
    parts.push('[语音]');
  }
  if (message.location) {
    parts.push('[位置]');
  }
  if (mainText) {
    parts.push(mainText);
  }

  return `${label}: ${parts.join(' ').trim() || '[空消息]'}`;
}

function formatRecentMessagesForIntentReview(messages: ChatMessage[], characterName: string, userName: string) {
  return messages
    .filter((message) => !message.isSystem && !message.isRecalled)
    .slice(-6)
    .map((message) => describeMessageForIntentReview(message, characterName, userName))
    .join('\n');
}

function buildAvatarLibraryPreview(character: Character) {
  return (character.avatarLibrary?.entries || [])
    .slice(0, 6)
    .map((entry) => [
      `id=${entry.id}`,
      `status=${entry.status}`,
      `source=${entry.source}`,
      entry.reaction ? `reaction=${entry.reaction}` : '',
      entry.reason ? `reason=${entry.reason}` : '',
    ].filter(Boolean).join(' / '))
    .join('\n');
}

function buildAvatarOfferDecisionPrompts(params: {
  character: Character;
  userName: string;
  messages: ChatMessage[];
  candidate: AvatarCandidate;
  latestUserText: string;
  shortTermSummary?: string;
  sharedRecentRelationshipSummary?: string;
  usedImageInput: boolean;
}) {
  const characterContext = buildCharacterContext({
    character: params.character,
  });
  const characterLabel = params.character.remarkName?.trim() || params.character.name;
  const libraryPreview = buildAvatarLibraryPreview(params.character);
  const recentMessages = formatRecentMessagesForIntentReview(
    params.messages,
    characterLabel,
    params.userName,
  );

  const systemPrompt = [
    '你不是在回复用户，而是在做一次“单聊图片意图判断 + 头像处理决策”。',
    '你要先判断这张图更像什么，再决定是否影响头像。',
    '绝对不要把普通生活分享误判成“让我换头像”。',
    'intent 只能填：share_life | avatar_offer | appearance_reference | sticker_or_meme | unclear',
    'decision 只能填：ignore | save_only | ask_confirm | change | reject',
    'confidence 只能填：low | medium | high',
    '规则：',
    '1. 普通生活分享、随手自拍、饭图、风景图、宠物图、截图、日常记录，默认更偏 share_life，不要主动扯到头像。',
    '2. 只有当用户真的像在递头像候选，或者图本身非常像头像候选，才考虑 avatar_offer。',
    '3. “像你 / 像不像 / 看起来 / 气质 / 形象”更偏 appearance_reference；没有明确头像意图时，不要直接 change。',
    '4. sticker_or_meme 一律不要换头像。',
    '5. 如果不确定，就用 unclear + ignore，宁可保守。',
    '6. 如果当前没有图片视觉输入，不能假装看见图内容；此时除非用户明确提头像，否则不要给 change。',
    '7. change 只允许在 avatar_offer 且把握高时出现。',
    '8. reply_hint 请写成一句中文内部提示，告诉聊天回复该怎么自然处理，不要像系统面板。',
    `最后只输出一行：${AVATAR_OFFER_DECISION_PROTOCOL_TOKEN} {"intent":"...","decision":"...","confidence":"...","reason":"...","reply_hint":"..."}`,
  ].join('\n');

  const userMessage = [
    `角色：${characterLabel}`,
    characterContext.corePersona ? `核心人设：${characterContext.corePersona}` : '',
    characterContext.expressionStyle ? `表达风格：${characterContext.expressionStyle}` : '',
    characterContext.boundaryPack ? `边界底色：${characterContext.boundaryPack}` : '',
    params.shortTermSummary ? `最近状态摘要：${params.shortTermSummary}` : '',
    params.sharedRecentRelationshipSummary ? `最近关系余波：${params.sharedRecentRelationshipSummary}` : '',
    `当前头像：${params.character.avatar ? '已有' : '暂无'}`,
    libraryPreview ? `头像库近况：\n${libraryPreview}` : '头像库近况：空',
    params.usedImageInput
      ? '本次会同时给你这张图片本身，请结合图片里直接可见的内容判断。'
      : '本次没有图片视觉输入，请不要假装看见图内容；只能依据文本和上下文保守判断。',
    recentMessages ? `最近相关聊天：\n${recentMessages}` : '',
    `最新用户话：${params.latestUserText || '[只发了一张图片，没有额外文字]'}`,
    '现在请判断：这轮更像普通分享，还是在递头像候选？',
  ].filter(Boolean).join('\n');

  return { systemPrompt, userMessage };
}

function parseAvatarOfferDecisionProtocol(text: string): RawAvatarOfferDecisionProtocol | null {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return null;
  }

  const tokenIndex = trimmedText.indexOf(AVATAR_OFFER_DECISION_PROTOCOL_TOKEN);
  const body = tokenIndex >= 0
    ? trimmedText.slice(tokenIndex + AVATAR_OFFER_DECISION_PROTOCOL_TOKEN.length).trim()
    : trimmedText;

  let jsonBody = body;
  if (jsonBody.startsWith('```json')) {
    jsonBody = jsonBody.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (jsonBody.startsWith('```')) {
    jsonBody = jsonBody.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }

  const jsonStart = jsonBody.indexOf('{');
  const jsonEnd = jsonBody.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    return null;
  }

  try {
    return JSON.parse(jsonBody.slice(jsonStart, jsonEnd + 1)) as RawAvatarOfferDecisionProtocol;
  } catch {
    return null;
  }
}

function buildDefaultReplyHint(intent: AvatarOfferIntent, decision: AvatarOfferDecisionType) {
  if (decision === 'change') {
    return '自然告诉用户你已经把这张换成头像了，口吻要像角色自己，不要像设置面板。';
  }

  if (decision === 'save_only') {
    return intent === 'appearance_reference'
      ? '把重点放在“像不像、气质像不像你”上，自然表示你先把这张收着，不急着换头像。'
      : '自然表示你会先把这张收着，当成头像候选，不要立刻切换。';
  }

  if (decision === 'ask_confirm') {
    return intent === 'appearance_reference'
      ? '先顺着“像不像你、气质像不像你”这个点接，再轻轻确认这是不是想给你当头像。'
      : '自然确认一下，问用户这张是不是想让你拿来当头像。';
  }

  if (decision === 'reject') {
    return '按角色口吻自然表示这张不适合做你的头像，但不要说成系统拒绝。';
  }

  if (intent === 'share_life') {
    return '把这张当普通生活分享回复，不要主动提头像。';
  }

  if (intent === 'sticker_or_meme') {
    return '把这张当表情包或梗图接话，不要提头像。';
  }

  if (intent === 'appearance_reference') {
    return '把重点放在形象和气质联想上，先不要直接换头像。';
  }

  return '先按普通图片回复，不要主动提头像。';
}

function buildDefaultReason(intent: AvatarOfferIntent, decision: AvatarOfferDecisionType, context: AvatarOfferFallbackContext) {
  if (!context.usedImageInput && context.imageOnly) {
    return '当前没有图片视觉输入，而且用户只发了图，没有足够证据把它当成头像请求。';
  }

  if (decision === 'ask_confirm' && context.explicitAvatarRequest) {
    return '用户确实在提头像，但当前需要更稳妥地确认一下，而不是直接改。';
  }

  if (intent === 'appearance_reference') {
    return '这轮更像在聊形象和像不像，不够像直接递头像候选。';
  }

  if (intent === 'share_life') {
    return '这轮更像普通生活分享，不应该主动上升到换头像。';
  }

  if (intent === 'sticker_or_meme') {
    return '这张更像表情包或梗图，不适合进入头像流程。';
  }

  if (decision === 'change') {
    return '这张图和上下文都很像在递头像候选，而且角色此刻会接这个动作。';
  }

  return '当前线索不够稳定，先按保守方式处理。';
}

export function deriveFallbackAvatarOfferDecision(params: {
  candidate: AvatarCandidate;
  latestUserText: string;
  usedImageInput: boolean;
}): AvatarOfferDecisionReview {
  const normalizedText = params.latestUserText.trim();
  const explicitAvatarRequest = hasAvatarChangeIntent(normalizedText);
  const appearanceReference = hasAvatarAppearanceReference(normalizedText);
  const followUpReference = hasAvatarFollowUpIntent(normalizedText);
  const imageOnly = !normalizedText || IMAGE_PLACEHOLDER_REGEX.test(normalizedText);

  let intent: AvatarOfferIntent = 'unclear';
  let decision: AvatarOfferDecisionType = 'ignore';
  let confidence: AvatarOfferDecisionConfidence = 'low';

  if (explicitAvatarRequest) {
    intent = 'avatar_offer';
    decision = params.usedImageInput ? 'ask_confirm' : 'ask_confirm';
    confidence = 'medium';
  } else if (appearanceReference || followUpReference) {
    intent = appearanceReference ? 'appearance_reference' : 'unclear';
    decision = 'ask_confirm';
    confidence = appearanceReference ? 'medium' : 'low';
  } else if (imageOnly) {
    intent = params.usedImageInput ? 'unclear' : 'unclear';
    decision = 'ignore';
    confidence = 'low';
  } else {
    intent = 'share_life';
    decision = 'ignore';
    confidence = 'medium';
  }

  const fallbackContext: AvatarOfferFallbackContext = {
    explicitAvatarRequest,
    appearanceReference,
    followUpReference,
    imageOnly,
    usedImageInput: params.usedImageInput,
  };

  const reason = buildDefaultReason(intent, decision, fallbackContext);
  const replyHint = buildDefaultReplyHint(intent, decision);

  return {
    intent,
    decision,
    confidence,
    reason,
    replyHint,
    candidate: params.candidate,
    action: decision === 'ignore'
      ? null
      : {
          type: decision as AvatarActionType,
          source: 'latest_user_image',
          reason,
        },
    origin: 'fallback',
    usedImageInput: params.usedImageInput,
  };
}

function normalizeAvatarOfferDecision(params: {
  raw: RawAvatarOfferDecisionProtocol | null;
  candidate: AvatarCandidate;
  latestUserText: string;
  usedImageInput: boolean;
}): AvatarOfferDecisionReview {
  const fallback = deriveFallbackAvatarOfferDecision({
    candidate: params.candidate,
    latestUserText: params.latestUserText,
    usedImageInput: params.usedImageInput,
  });
  if (!params.raw) {
    return fallback;
  }

  const explicitAvatarRequest = hasAvatarChangeIntent(params.latestUserText);
  const appearanceReference = hasAvatarAppearanceReference(params.latestUserText);
  const followUpReference = hasAvatarFollowUpIntent(params.latestUserText);
  const imageOnly = !params.latestUserText.trim() || IMAGE_PLACEHOLDER_REGEX.test(params.latestUserText.trim());
  const context: AvatarOfferFallbackContext = {
    explicitAvatarRequest,
    appearanceReference,
    followUpReference,
    imageOnly,
    usedImageInput: params.usedImageInput,
  };

  let intent = normalizeDecisionIntent(params.raw.intent) || fallback.intent;
  let decision = normalizeDecisionType(params.raw.decision) || fallback.decision;
  let confidence = normalizeDecisionConfidence(params.raw.confidence) || fallback.confidence;
  let reason = normalizeProtocolString(params.raw.reason) || buildDefaultReason(intent, decision, context);
  let replyHint = normalizeProtocolString(params.raw.reply_hint) || buildDefaultReplyHint(intent, decision);

  if (intent === 'share_life' || intent === 'sticker_or_meme') {
    decision = 'ignore';
  }

  if (intent === 'appearance_reference' && decision === 'change' && !explicitAvatarRequest) {
    decision = 'ask_confirm';
  }

  if (intent === 'avatar_offer' && explicitAvatarRequest && decision === 'ignore') {
    decision = 'ask_confirm';
  }

  if (!params.usedImageInput && decision === 'change') {
    decision = explicitAvatarRequest ? 'ask_confirm' : 'ignore';
  }

  if (intent === 'unclear' && decision === 'change') {
    decision = explicitAvatarRequest ? 'ask_confirm' : 'ignore';
  }

  if (decision === 'ignore' && intent === 'avatar_offer' && !explicitAvatarRequest && imageOnly) {
    intent = 'unclear';
  }

  reason = reason || buildDefaultReason(intent, decision, context);
  replyHint = replyHint || buildDefaultReplyHint(intent, decision);

  return {
    intent,
    decision,
    confidence,
    reason,
    replyHint,
    candidate: params.candidate,
    action: decision === 'ignore'
      ? null
      : {
          type: decision as AvatarActionType,
          source: 'latest_user_image',
          reason,
        },
    origin: 'model',
    usedImageInput: params.usedImageInput,
  };
}

function formatIntentLabel(intent: AvatarOfferIntent) {
  switch (intent) {
    case 'share_life':
      return '普通生活分享';
    case 'avatar_offer':
      return '明确或高度可疑的头像候选';
    case 'appearance_reference':
      return '在聊像不像、气质或形象';
    case 'sticker_or_meme':
      return '表情包 / 梗图';
    case 'unclear':
    default:
      return '意图不够明确';
  }
}

function formatDecisionLabel(decision: AvatarOfferDecisionType) {
  switch (decision) {
    case 'change':
      return '直接换头像';
    case 'save_only':
      return '先收进头像候选';
    case 'ask_confirm':
      return '先确认，再决定';
    case 'reject':
      return '明确不接这张头像';
    case 'ignore':
    default:
      return '按普通图片处理';
  }
}

export function buildAvatarOfferReplyPromptSection(review: AvatarOfferDecisionReview | null): string {
  if (!review) {
    return '';
  }

  return [
    '## 本轮图片意图 / 头像处理结论',
    '这部分结论已经先判好了，不要重新做系统分析，只需要按这个结论自然说话。',
    `图片意图：${formatIntentLabel(review.intent)}`,
    `头像处理：${formatDecisionLabel(review.decision)}`,
    `内部理由：${review.reason}`,
    `回复要求：${review.replyHint}`,
  ].join('\n');
}

export async function evaluateDirectAvatarOfferDecision(params: {
  activeConfig: ApiConfig;
  character: Character;
  messages: ChatMessage[];
  userName: string;
  shortTermSummary?: string;
  sharedRecentRelationshipSummary?: string;
}): Promise<AvatarOfferDecisionReview | null> {
  const candidate = resolveLatestAvatarCandidateForUserTurn(params.messages);
  if (!candidate) {
    return null;
  }

  const latestVisibleUserMessage = getLatestVisibleUserMessage(params.messages);
  if (!latestVisibleUserMessage) {
    return null;
  }

  const latestUserText = getMessageMainText(latestVisibleUserMessage);
  const usedImageInput = canUseMomentImageInputs(params.activeConfig);
  const { systemPrompt, userMessage } = buildAvatarOfferDecisionPrompts({
    character: params.character,
    userName: params.userName,
    messages: params.messages,
    candidate,
    latestUserText,
    shortTermSummary: params.shortTermSummary,
    sharedRecentRelationshipSummary: params.sharedRecentRelationshipSummary,
    usedImageInput,
  });

  const runtimeMessages: RuntimeChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: userMessage,
      ...(usedImageInput ? { imageUrl: candidate.image } : {}),
    },
  ];

  try {
    let rawText = '';
    await streamTextWithConfig({
      activeConfig: params.activeConfig,
      messages: runtimeMessages,
      temperature: Math.min(params.activeConfig.temperature ?? 0.7, 0.2),
      onTextChunk: (chunkText) => {
        rawText += chunkText;
      },
    });

    return normalizeAvatarOfferDecision({
      raw: parseAvatarOfferDecisionProtocol(rawText),
      candidate,
      latestUserText,
      usedImageInput,
    });
  } catch (error) {
    console.warn('[avatar-offer] image intent review failed, falling back to conservative local logic.', {
      characterId: params.character.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return deriveFallbackAvatarOfferDecision({
      candidate,
      latestUserText,
      usedImageInput: false,
    });
  }
}

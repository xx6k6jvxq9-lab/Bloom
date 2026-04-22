import type { ChatMessage, GroupTopicState } from '../../types';
import { isUsableChatText, normalizeChatPunctuationNoise } from '../chat/messageHygiene';

const MAX_RECENT_MESSAGES = 8;
const MAX_SUMMARY_ITEMS = 4;
const MAX_TEXT_LENGTH = 42;
const MAX_MEMBER_PERSPECTIVE_LENGTH = 220;
const MEDIA_MARKERS = new Set(['[image]', '[audio]', '[sticker]']);

const LEGACY_PERSPECTIVE_PATTERN = /(Private group perspective|Use it as bias|Latest public beat|What you just heard|Choose naturally|Avoid repeating|React from your own stance|Your recent public stance|You just spoke about)/i;

export function cleanLegacyGroupMemberPerspectiveText(text: string): string {
  if (!text || LEGACY_PERSPECTIVE_PATTERN.test(text)) {
    return '';
  }

  return text.replace(/\s+/g, ' ').trim();
}

function getMessageMainText(message: ChatMessage): string {
  const rawText = message.text || '';
  const colonIndex = rawText.indexOf(':');
  if (message.role === 'model' && colonIndex >= 0) {
    return rawText.slice(colonIndex + 1).trim();
  }
  return rawText.trim();
}

function getSpeakerLabel(message: ChatMessage): string {
  if (message.role === 'user') {
    return '用户';
  }

  const rawText = message.text || '';
  const colonIndex = rawText.indexOf(':');
  if (colonIndex > 0) {
    return rawText.slice(0, colonIndex).trim() || '群成员';
  }

  return '群成员';
}

function stripActionCues(text: string): string {
  return text
    .replace(/^\[(?:reply|quote|recall|notice|sticker)[^\]]*\]\s*/i, '')
    .replace(/^\[[^\]]+\]\s*/i, '')
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .trim();
}

function compactText(text: string): string {
  const normalized = normalizeChatPunctuationNoise(stripActionCues(text))
    .replace(/\s+/g, ' ')
    .replace(/^["'`\u201c\u201d\u2018\u2019]+|["'`\u201c\u201d\u2018\u2019]+$/g, '')
    .trim();

  if (!normalized || MEDIA_MARKERS.has(normalized.toLowerCase()) || !isUsableChatText(normalized)) {
    return '';
  }

  return normalized.length > MAX_TEXT_LENGTH
    ? `${normalized.slice(0, MAX_TEXT_LENGTH).trim()}...`
    : normalized;
}

function isPublicGroupMessage(message: ChatMessage): boolean {
  return !message.isSystem
    && !message.isRecalled
    && !message.groupPollCard
    && !message.groupRelayCard
    && !message.groupTaskCard;
}

export function deriveGroupShortTermSummaryFromHistory(params: {
  topicState?: GroupTopicState;
  nextHistory: ChatMessage[];
}): string | undefined {
  const recentItems = params.nextHistory
    .filter(isPublicGroupMessage)
    .slice(-MAX_RECENT_MESSAGES)
    .map((message) => {
      const text = compactText(getMessageMainText(message));
      if (!text) {
        return '';
      }
      return `${getSpeakerLabel(message)}说“${text}”`;
    })
    .filter(Boolean)
    .slice(-MAX_SUMMARY_ITEMS);

  const topicAnchor = compactText(params.topicState?.anchor || '');
  const lines = [
    topicAnchor ? `当前公开话题：${topicAnchor}` : '',
    recentItems.length > 0 ? `最近公开发言：${recentItems.join('；')}` : '',
    recentItems.length > 0 ? '使用方式：只当作群内连续性背景，接着聊，不要逐字复述。' : '',
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : undefined;
}

export function sanitizeGroupMemberPerspectiveSummaries(
  value: unknown,
  allowedMemberIds?: string[],
): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const allowed = allowedMemberIds ? new Set(allowedMemberIds) : null;
  const result: Record<string, string> = {};

  Object.entries(value as Record<string, unknown>).forEach(([memberId, summary]) => {
    if (allowed && !allowed.has(memberId)) {
      return;
    }

    if (typeof summary !== 'string') {
      return;
    }

    const compacted = cleanLegacyGroupMemberPerspectiveText(summary)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_MEMBER_PERSPECTIVE_LENGTH);

    if (compacted && isUsableChatText(compacted)) {
      result[memberId] = compacted;
    }
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

function buildRecentStance(ownRecent: ChatMessage[]): string {
  const ownLines = ownRecent
    .map((message) => compactText(getMessageMainText(message)))
    .filter(Boolean);

  if (ownLines.length === 0) {
    return '最近还没明显表态。';
  }

  const latestOwn = ownLines[ownLines.length - 1];
  return `最近自己的态度落点在“${latestOwn}”。`;
}

function buildAttentionSummary(otherRecent: ChatMessage[]): string {
  const otherLines = otherRecent
    .map((message) => {
      const text = compactText(getMessageMainText(message));
      if (!text) {
        return '';
      }
      return `${getSpeakerLabel(message)}提到“${text}”`;
    })
    .filter(Boolean)
    .slice(-2);

  if (otherLines.length === 0) {
    return '现在更像是在看大家怎么接。';
  }

  return `眼下最在意的是：${otherLines.join('；')}。`;
}

function buildReactionBias(latestMessage: ChatMessage | undefined, memberId: string, ownRecentCount: number): string {
  if (!latestMessage) {
    return '可以先轻轻观察，再决定要不要接。';
  }

  if (latestMessage.senderCharacterId === memberId) {
    return ownRecentCount >= 2
      ? '刚表达过，下一句更适合收一点，别重复同一个点。'
      : '刚表达过，如果没人接住，可以顺着补半句。';
  }

  if (latestMessage.role === 'user') {
    return '用户刚抛了球，可以从自己的立场接，不必像统一回答。';
  }

  return '别把自己当全群发言人，更适合从个人立场接上一句。';
}

function buildInteractionTendency(ownRecent: ChatMessage[]): string {
  const replyTargets = ownRecent
    .map((message) => message.replyTo?.authorLabel?.trim())
    .filter((value): value is string => !!value);

  if (replyTargets.length === 0) {
    return '近期没有固定接话对象。';
  }

  const uniqueTargets = Array.from(new Set(replyTargets)).slice(0, 2);
  return `最近更容易接${uniqueTargets.join('、')}的话。`;
}

export function deriveGroupMemberPerspectiveSummariesFromHistory(params: {
  memberIds: string[];
  nextHistory: ChatMessage[];
}): Record<string, string> | undefined {
  const recentMessages = params.nextHistory
    .filter(isPublicGroupMessage)
    .slice(-MAX_RECENT_MESSAGES);

  if (recentMessages.length === 0) {
    return undefined;
  }

  const result: Record<string, string> = {};
  const latestMessage = recentMessages[recentMessages.length - 1];

  params.memberIds.forEach((memberId) => {
    const ownRecent = recentMessages
      .filter((message) => message.senderCharacterId === memberId)
      .slice(-2);
    const otherRecent = recentMessages
      .filter((message) => message.senderCharacterId !== memberId)
      .slice(-3);

    const lines = [
      buildRecentStance(ownRecent),
      buildAttentionSummary(otherRecent),
      buildInteractionTendency(ownRecent),
      buildReactionBias(latestMessage, memberId, ownRecent.length),
    ];

    const summary = lines
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_MEMBER_PERSPECTIVE_LENGTH);

    if (summary && isUsableChatText(summary)) {
      result[memberId] = summary;
    }
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

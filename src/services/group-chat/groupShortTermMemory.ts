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

  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

function summarizeTopicToken(text: string): string {
  if (!text) {
    return '刚刚那轮话题';
  }

  if (/(手机|消息|错过|漏看|通知|重要)/.test(text)) {
    return '别漏消息这件事';
  }
  if (/(半夜|熬夜|睡|困|夜里)/.test(text)) {
    return '半夜还在耗神这件事';
  }
  if (/(工作|任务|上班|职业病|忙)/.test(text)) {
    return '工作和任务感带来的紧绷';
  }
  if (/(开玩笑|逗|起哄|笑|乐)/.test(text)) {
    return '这轮偏调侃的气氛';
  }

  return '刚刚那轮话题';
}

function inferStanceLabel(text: string): string {
  if (!text) {
    return '暂时还没明显表态';
  }

  if (/(别|不能|要不|记得|重要|小心|注意|得|最好)/.test(text)) {
    return '偏认真提醒';
  }
  if (/(笑|职业病|离谱|行啊|啧|还挺|真有你的)/.test(text)) {
    return '偏吐槽调侃';
  }
  if (/(没事|别慌|缓缓|慢点|先休息|不用)/.test(text)) {
    return '偏安抚缓和';
  }
  if (/(好啊|来啊|行吧|那就|嗯)/.test(text)) {
    return '偏顺势接话';
  }

  return '偏观察后再接';
}

function inferNextBeat(
  latestMessage: ChatMessage | undefined,
  memberId: string,
  ownRecentCount: number,
): string {
  if (!latestMessage) {
    return '先看看别人怎么接，再决定要不要出声';
  }

  if (latestMessage.senderCharacterId === memberId) {
    return ownRecentCount >= 2
      ? '刚表达过，下一句更适合收一点'
      : '刚表达过，如果有人接住，可以补半句';
  }

  if (latestMessage.role === 'user') {
    return '更适合从自己的立场回应，不用像统一答题';
  }

  return '更适合接上一位成员的话，不必把话题强行拉回用户';
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
      return `- ${getSpeakerLabel(message)}：${text}`;
    })
    .filter(Boolean)
    .slice(-MAX_SUMMARY_ITEMS);

  const topicAnchor = compactText(params.topicState?.anchor || '');
  const lines = [
    topicAnchor ? `当前话题\n- ${topicAnchor}` : '',
    recentItems.length > 0 ? `最近发言\n${recentItems.join('\n')}` : '',
    recentItems.length > 0 ? '使用方式\n- 只当作群内连续背景\n- 接着聊，不要逐字复述' : '',
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n\n') : undefined;
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
      .slice(0, MAX_MEMBER_PERSPECTIVE_LENGTH);

    if (compacted && isUsableChatText(compacted)) {
      result[memberId] = compacted;
    }
  });

  return Object.keys(result).length > 0 ? result : undefined;
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

    const ownLatestText = compactText(getMessageMainText(ownRecent[ownRecent.length - 1] || { text: '' } as ChatMessage));
    const topicTokens = otherRecent
      .map((message) => summarizeTopicToken(compactText(getMessageMainText(message))))
      .filter(Boolean);
    const topicFocus = Array.from(new Set(topicTokens)).slice(0, 2);

    const replyTargets = ownRecent
      .map((message) => message.replyTo?.authorLabel?.trim())
      .filter((value): value is string => !!value);
    const uniqueTargets = Array.from(new Set(replyTargets)).slice(0, 2);

    const lines = [
      `立场\n- ${inferStanceLabel(ownLatestText)}`,
      `关注点\n- ${topicFocus.length > 0 ? topicFocus.join('、') : '更关注群里这一轮怎么继续'}`,
      `接话倾向\n- ${uniqueTargets.length > 0 ? `最近更容易接${uniqueTargets.join('、')}的话` : '近期没有固定接话对象'}`,
      `下一拍\n- ${inferNextBeat(latestMessage, memberId, ownRecent.length)}`,
    ];

    const summary = lines
      .join('\n')
      .trim()
      .slice(0, MAX_MEMBER_PERSPECTIVE_LENGTH);

    if (summary && isUsableChatText(summary)) {
      result[memberId] = summary;
    }
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

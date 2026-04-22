import type { ChatMessage, GroupTopicState } from '../../types';
import { isUsableChatText, normalizeChatPunctuationNoise } from '../chat/messageHygiene';

const MAX_RECENT_MESSAGES = 8;
const MAX_SUMMARY_ITEMS = 4;
const MAX_TEXT_LENGTH = 42;
const MEDIA_MARKERS = new Set(['[image]', '[audio]', '[sticker]']);

function getMessageMainText(message: ChatMessage): string {
  const rawText = message.text || '';
  const colonIndex = rawText.indexOf(':');
  if (message.role === 'model' && colonIndex >= 0) {
    return rawText.slice(colonIndex + 1).trim();
  }
  return rawText.trim();
}

function getSpeakerLabel(message: ChatMessage): string {
  if (message.senderCharacterName?.trim()) {
    return message.senderCharacterName.trim();
  }
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

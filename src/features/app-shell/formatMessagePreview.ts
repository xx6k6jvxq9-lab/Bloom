import type { ChatMessage } from '../../types';
import { getLegacyTranslationParts } from '../../services/chat/messageText';

const HTML_BLOCK_TAG_REGEX = /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_LINEBREAK_TAG_REGEX = /<(br|\/p|\/div|\/li|\/summary|\/h[1-6])\b[^>]*>/gi;
const HTML_TAG_REGEX = /<[^>]+>/g;
const MARKDOWN_FENCE_REGEX = /```[a-zA-Z0-9_-]*|```/g;
const HTML_ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
};

export const looksLikeStructuredCardText = (text: string | undefined): boolean => {
  if (!text) return false;
  return /<\/?[a-z][\w-]*\b[^>]*>/i.test(text) || /```[a-zA-Z0-9_-]*/.test(text);
};

export const sanitizePreviewText = (text: string | undefined): string => {
  if (!text) return '';

  const normalized = text
    .replace(HTML_BLOCK_TAG_REGEX, ' ')
    .replace(HTML_LINEBREAK_TAG_REGEX, '\n')
    .replace(HTML_TAG_REGEX, ' ')
    .replace(MARKDOWN_FENCE_REGEX, ' ');

  const decoded = normalized.replace(/&(nbsp|lt|gt|amp|quot|#39);/g, (entity) => HTML_ENTITY_MAP[entity] || entity);
  return decoded
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
};

export const formatMessagePreview = (text: string | undefined): string => {
  if (!text) return '';

  const trimmedText = text.trim();
  if (trimmedText === '[COUPLE_SPACE_INVITE]') {
    return '[情侣空间邀请]';
  }
  if (trimmedText === '[COUPLE_SPACE_INVITE_ACCEPTED]') {
    return '[情侣空间已建立]';
  }
  if (/^\[transfer\]/i.test(trimmedText) || /^TRANSFER\|/i.test(trimmedText) || /^\[转账[:：]?\s*[\d.]+\]/.test(trimmedText)) {
    return '[转账消息]';
  }
  if (text.startsWith('[notice]')) {
    return sanitizePreviewText(text.replace(/^\[notice\]\s*/i, '').trim());
  }
  if (text.startsWith('[audio]')) {
    return '[语音]';
  }
  if (text.startsWith('[image]')) {
    return '[图片]';
  }
  if (text.startsWith('[sticker]')) {
    return '[表情]';
  }
  if (text.startsWith('[group-poll]')) {
    return '[群投票]';
  }
  if (text.startsWith('[group-relay]')) {
    return '[群接龙]';
  }
  if (text.startsWith('[group-task]')) {
    return '[群任务]';
  }
  if (text.startsWith('[group-join-request]')) {
    return '[入群申请]';
  }
  if (text.startsWith('[group-admin-nomination]')) {
    return '[管理员提名]';
  }
  if (text.startsWith('[group-offline]')) {
    return '[群线下进行中]';
  }
  if (text.startsWith('[group-offline-ended]')) {
    return '[群线下已结束]';
  }
  if (text.startsWith('[GAME_CARD]')) {
    return '[游戏卡片]';
  }

  return sanitizePreviewText(text);
};

export function formatChatMessagePreview(
  message: Pick<ChatMessage, 'role' | 'text' | 'contentType' | 'isInnerVoice' | 'transferDisplayLabel'> | null | undefined,
): string {
  if (!message) {
    return '';
  }

  if (message.contentType === 'inner-voice' || message.isInnerVoice) {
    return message.role === 'user' ? '[倾听心声]' : '[对方的心声]';
  }

  if (message.contentType === 'game-card-error') {
    return '[卡片生成失败]';
  }

  if (message.contentType === 'game-card') {
    return '[游戏卡片]';
  }

  if (message.contentType === 'transfer') {
    return message.transferDisplayLabel?.trim()
      ? `[${message.transferDisplayLabel.trim()}]`
      : '[转账消息]';
  }

  if (message.contentType === 'couple-space-invite') {
    return '[情侣空间邀请]';
  }

  if (message.contentType === 'couple-space-invite-accepted') {
    return '[情侣空间已建立]';
  }

  const mainText = getLegacyTranslationParts(message.text || '').mainText;
  return formatMessagePreview(mainText || message.text || '');
}

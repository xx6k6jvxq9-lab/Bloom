import type { ApiConfig, ChatMessage } from '../../types';
import { canUseVisionInputs } from '../ai/runtimeClient';

export type MomentRecentImageReference = {
  imageUrl: string;
  characterId?: string;
  relatedText?: string;
  messageText?: string;
  timestamp?: number;
};

const STICKER_MESSAGE_REGEX = /^\[(?:sticker|表情包)\]/i;
const ATTACH_RECENT_IMAGE_MARKER_REGEX = /^\[attach_recent_image:(\d+)\]\s*/i;

function summarizeText(text: string | undefined) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  return normalized.length > 90 ? `${normalized.slice(0, 90)}...` : normalized;
}

export function canUseMomentImageInputs(activeConfig: ApiConfig): boolean {
  return canUseVisionInputs(activeConfig);
}

export function buildRecentMomentImageReferenceMessage(
  reference: MomentRecentImageReference,
  index: number,
) {
  return [
    `这是角色最近在和用户聊天时收到的图片素材 ${index + 1}。`,
    reference.relatedText ? `同轮文字上下文：${reference.relatedText}` : '',
    '你可以把它当成可选素材。只有当这张图真的自然适合这条动态时，才考虑让这条动态带上它。',
    '只能依据图片里能直接看到的内容辅助判断，不要虚构图片外的新事实。',
  ].filter(Boolean).join('\n');
}

export function extractRecentMomentImageReferences(
  messages: ChatMessage[] | undefined,
  maxItems = 2,
): MomentRecentImageReference[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const references: MomentRecentImageReference[] = [];
  for (const message of [...messages].reverse()) {
    if (message.role !== 'user' || !message.imageUrl || STICKER_MESSAGE_REGEX.test((message.text || '').trim())) {
      continue;
    }

    references.push({
      imageUrl: message.imageUrl,
      characterId: typeof message.senderCharacterId === 'string' ? message.senderCharacterId : undefined,
      relatedText: summarizeText(message.text),
      messageText: message.text,
      timestamp: message.timestamp,
    });

    if (references.length >= maxItems) {
      break;
    }
  }

  return references;
}

export function parseRecentMomentImageAttachmentMarker(text: string): number | null {
  const match = text.match(ATTACH_RECENT_IMAGE_MARKER_REGEX);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return parsed - 1;
}

export function stripRecentMomentImageAttachmentMarker(text: string) {
  return text.replace(ATTACH_RECENT_IMAGE_MARKER_REGEX, '').trim();
}

export function selectRecentMomentImageAttachment(
  text: string,
  references: MomentRecentImageReference[] | undefined,
) {
  const selectedIndex = parseRecentMomentImageAttachmentMarker(text);
  const selectedReference = selectedIndex != null
    ? (references || [])[selectedIndex] || null
    : null;

  return {
    text: stripRecentMomentImageAttachmentMarker(text),
    selectedIndex,
    selectedReference: selectedReference || undefined,
    images: selectedReference?.imageUrl ? [selectedReference.imageUrl] : undefined,
  };
}

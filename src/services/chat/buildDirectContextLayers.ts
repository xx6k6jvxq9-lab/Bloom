import type { ChatMessage } from '../../types';
import { getMessageMainText } from '../../utils';

export type DirectContinuityMode = 'continuous_scene' | 'same_day_resume' | 'resume_after_gap';

export type DirectContextLayers = {
  liveMessages: ChatMessage[];
  memoryMessages: ChatMessage[];
  memoryContextPrompt: string;
};

type BuildDirectContextLayersInput = {
  messages: ChatMessage[];
  liveMessages: ChatMessage[];
  continuityMode: DirectContinuityMode;
  nowTimestamp: number;
};

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function formatAge(timestamp: number, nowTimestamp: number): string {
  const diffMinutes = Math.max(0, Math.floor((nowTimestamp - timestamp) / 60000));
  if (diffMinutes < 60) {
    return diffMinutes < 1 ? '刚刚' : `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  return `${Math.floor(diffHours / 24)} 天前`;
}

function getMessagePromptPreview(message: ChatMessage): string {
  if (message.audioUrl) {
    return message.audioTranscript?.trim()
      ? `[语音] ${message.audioTranscript.trim()}`
      : '[语音]';
  }

  if (message.imageUrl) {
    return /^\[(?:sticker|表情包)\]/i.test(message.text || '')
      ? '[表情包]'
      : '[图片]';
  }

  return getMessageMainText(message).replace(/\s+/g, ' ').trim();
}

function getMemoryMessages(
  messages: ChatMessage[],
  liveMessages: ChatMessage[],
  continuityMode: DirectContinuityMode,
): ChatMessage[] {
  if (continuityMode === 'continuous_scene') {
    return [];
  }

  const liveTimestamps = new Set(liveMessages.map((message) => message.timestamp));
  const visibleMessages = messages.filter((message) => !message.isSystem && !message.isRecalled);
  const memoryCandidates = visibleMessages.filter((message) => !liveTimestamps.has(message.timestamp));

  if (continuityMode === 'same_day_resume') {
    return memoryCandidates.slice(-4);
  }

  return memoryCandidates.slice(-6);
}

export function buildDirectContextLayers(
  input: BuildDirectContextLayersInput,
): DirectContextLayers {
  const memoryMessages = getMemoryMessages(input.messages, input.liveMessages, input.continuityMode);

  const memoryContextPrompt = memoryMessages.length === 0
    ? ''
    : [
        '## Memory Context Layer',
        '[说明] 以下内容属于旧记忆层，不是当前现场。它们可以影响熟悉度、关系余波、语气和判断，但不要默认按眼前正在发生来续写。',
        ...memoryMessages.map((message) => {
          const preview = getMessagePromptPreview(message);
          if (!preview) {
            return '';
          }

          const speaker = message.role === 'user' ? '用户' : '角色';
          return `[${speaker} / ${formatTimestamp(message.timestamp)} / ${formatAge(message.timestamp, input.nowTimestamp)}] ${preview}`;
        }).filter(Boolean),
      ].join('\n');

  return {
    liveMessages: input.liveMessages,
    memoryMessages,
    memoryContextPrompt,
  };
}

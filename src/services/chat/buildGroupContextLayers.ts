import type { ChatMessage } from '../../types';

export type GroupContinuityMode = 'continuous_scene' | 'same_day_resume' | 'resume_after_gap';

export type GroupContextLayers = {
  liveMessages: ChatMessage[];
  memoryMessages: ChatMessage[];
  memoryContextPrompt: string;
};

type BuildGroupContextLayersInput = {
  messages: ChatMessage[];
  continuityMode: GroupContinuityMode;
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
  if (diffMinutes < 60) return diffMinutes < 1 ? '刚刚' : `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${Math.floor(diffHours / 24)} 天前`;
}

function getGroupLiveWindow(messages: ChatMessage[], continuityMode: GroupContinuityMode): ChatMessage[] {
  const visibleMessages = messages.filter((message) => !message.isSystem && !message.isRecalled);
  if (continuityMode === 'continuous_scene') {
    return visibleMessages.slice(-14);
  }
  if (continuityMode === 'same_day_resume') {
    return visibleMessages.slice(-8);
  }
  return visibleMessages.slice(-4);
}

function getMessagePreview(message: ChatMessage): string {
  if (message.audioUrl) {
    return message.audioTranscript?.trim()
      ? `[语音] ${message.audioTranscript.trim()}`
      : '[语音]';
  }
  if (message.imageUrl) {
    return /^\[(?:sticker|表情包)\]/i.test(message.text || '') ? '[表情包]' : '[图片]';
  }
  return (message.text || '').replace(/\s+/g, ' ').trim();
}

export function buildGroupContextLayers(
  input: BuildGroupContextLayersInput,
): GroupContextLayers {
  const liveMessages = getGroupLiveWindow(input.messages, input.continuityMode);
  const liveTimestamps = new Set(liveMessages.map((message) => message.timestamp));
  const memoryMessages = input.messages
    .filter((message) => !message.isSystem && !message.isRecalled && !liveTimestamps.has(message.timestamp))
    .slice(-6);

  const memoryContextPrompt = memoryMessages.length === 0
    ? ''
    : [
        '## Group Memory Context',
        '[说明] 以下是较早的群聊记忆层，只影响熟悉度、旧话题余波和接话判断，不代表当前群现场还停在那一刻。',
        ...memoryMessages.map((message) => {
          const preview = getMessagePreview(message);
          if (!preview) {
            return '';
          }
          const speaker = message.role === 'user'
            ? '用户'
            : (message.replyTo?.authorLabel || message.senderCharacterId || '角色');
          return `[${speaker} / ${formatTimestamp(message.timestamp)} / ${formatAge(message.timestamp, input.nowTimestamp)}] ${preview}`;
        }).filter(Boolean),
      ].join('\n');

  return {
    liveMessages,
    memoryMessages,
    memoryContextPrompt,
  };
}

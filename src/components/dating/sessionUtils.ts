import type { DateMessage, DateSession, DatingGeneratedContent } from '../../types';
import { extractSingleImageUrl } from '../../utils';

export function resolveDateBackgroundInput(options: {
  localBackground?: string;
  backgroundUrl?: string;
  characterAvatar: string;
}) {
  const normalizedBackgroundUrl = extractSingleImageUrl(options.backgroundUrl || '').trim();
  const image = options.localBackground || normalizedBackgroundUrl || options.characterAvatar;
  const source: NonNullable<DateSession['backgroundSource']> = options.localBackground
    ? 'local-upload'
    : normalizedBackgroundUrl
      ? 'url'
      : 'character-avatar';

  return { image, source };
}

export function resolveDateSessionBackground(session: DateSession, characterAvatar: string) {
  return {
    image: session.backgroundImage || characterAvatar,
    source: session.backgroundSource || 'character-avatar',
  };
}

export function createDateMessageId(prefix: 'user' | 'scene') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSceneMessage(content: DatingGeneratedContent, timestamp = Date.now()): DateMessage {
  const text = content.narrative.segments.map(segment => segment.text).join('\n\n').trim();

  return {
    id: createDateMessageId('scene'),
    role: 'model',
    kind: 'scene',
    text,
    timestamp,
    generatedContent: content,
  };
}

export function normalizeDateSessionMessages(session: DateSession): DateMessage[] {
  const normalized = (session.messages || []).map((message, index) => ({
    id: message.id || `${message.role}-${session.id}-${index}`,
    timestamp: message.timestamp || session.timestamp || Date.now(),
    kind: message.kind || (message.role === 'user' ? 'user' : message.generatedContent ? 'scene' : 'scene'),
    ...message,
  }));

  if (normalized.length > 0) {
    return normalized;
  }

  if (session.generatedContent) {
    return [createSceneMessage(session.generatedContent, session.timestamp)];
  }

  return [];
}

export function getLatestGeneratedContent(messages: DateMessage[], fallback?: DatingGeneratedContent) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].generatedContent) {
      return messages[i].generatedContent;
    }
  }

  return fallback;
}

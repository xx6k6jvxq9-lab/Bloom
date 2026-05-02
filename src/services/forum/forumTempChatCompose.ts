import type { ForumTempChatMessage, ForumTempChatSession } from '../../types';
import { buildForumTempPendingReply } from './forumTempChatState';

export function createForumTempUserMessage(text: string, now = Date.now()): ForumTempChatMessage {
  return {
    id: `forum-temp-user-${now}`,
    role: 'user',
    text,
    timestamp: now,
  };
}

export function queueForumTempUserMessage(input: {
  session: ForumTempChatSession;
  userMessage: ForumTempChatMessage;
  userText: string;
  behavior: 'instant' | 'delayed' | 'ghost';
  readDelayMs: number;
  replyDelayMs?: number;
  relatedPostId?: string | null;
  now?: number;
}): ForumTempChatSession {
  const now = input.now || Date.now();
  const pendingReply = buildForumTempPendingReply({
    userMessage: input.userMessage,
    userText: input.userText,
    behavior: input.behavior,
    readDelayMs: input.readDelayMs,
    replyDelayMs: input.replyDelayMs,
    relatedPostId: input.relatedPostId,
  });

  return {
    ...input.session,
    messages: [...input.session.messages, input.userMessage],
    updatedAt: now,
    pendingReply,
  };
}


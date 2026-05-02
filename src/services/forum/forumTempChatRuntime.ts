import type {
  AppDataExtended,
  ForumNotification,
  ForumPost,
  ForumTempChatMessage,
  ForumTempChatSession,
} from '../../types';
import type { ApiConfig } from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';
import { createForumFriendRequest, hasPendingForumFriendRequest } from './forumFriendRequests';
import {
  appendForumTempNpcReply,
  createEmptyForumTempChatSession,
  markForumFriendRequestSent,
  markForumTempChatGhosted,
  shouldCreateForumFriendRequest,
} from './forumTempChatState';
import { createForumNotification } from './forumNotifications';
import { generateForumTempReply } from './generateForumTempReply';

type RuntimeAuthor = {
  id: string;
  name: string;
  bio?: string;
  description?: string;
  avatar: string;
  handle?: string;
  persona?: string;
};

type ProcessPendingForumTempReplyInput = {
  appData: AppDataExtended;
  currentUserId: string;
  allowNpcFriendRequest?: boolean;
  activeTempChatUserId: string | null;
  currentView: 'temp-chat' | string;
  forumConfig: ApiConfig;
  session: ForumTempChatSession;
  author: RuntimeAuthor;
  relatedPost: ForumPost | null;
  resolveRecentForumPostForAuthor: (authorId: string) => ForumPost | null;
  inferForumChannelFromCategory: (category: string) => ForumChannel;
};

type ProcessPendingForumTempReplyResult =
  | { kind: 'idle' }
  | { kind: 'mark-read'; nextSession: ForumTempChatSession }
  | { kind: 'ghosted'; nextSession: ForumTempChatSession }
  | { kind: 'typing'; nextSession: ForumTempChatSession }
  | { kind: 'replied'; nextSession: ForumTempChatSession; nextNotifications: ForumNotification[]; nextFriendRequests: AppDataExtended['friendRequests']; friendRequestNotice?: string }
  | { kind: 'cleared'; nextSession: ForumTempChatSession };

export function markForumTempChatMessageRead(
  session: ForumTempChatSession,
  messageId: string,
  readAt: number,
): ForumTempChatSession {
  return {
    ...session,
    messages: session.messages.map((message) => (
      message.id === messageId
        ? { ...message, readAt }
        : message
    )),
    updatedAt: readAt,
  };
}

export function markForumTempChatTyping(
  session: ForumTempChatSession,
  now = Date.now(),
): ForumTempChatSession {
  return {
    ...session,
    pendingReply: session.pendingReply
      ? { ...session.pendingReply, status: 'typing' }
      : session.pendingReply,
    updatedAt: now,
  };
}

export function clearForumTempChatPendingReply(
  session: ForumTempChatSession,
  now = Date.now(),
): ForumTempChatSession {
  return {
    ...session,
    pendingReply: undefined,
    updatedAt: now,
  };
}

function buildNpcTempMessage(text: string, now = Date.now()): ForumTempChatMessage {
  return {
    id: `forum-temp-npc-${now}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'npc',
    text,
    timestamp: now,
  };
}

export async function processPendingForumTempReply(
  input: ProcessPendingForumTempReplyInput,
): Promise<ProcessPendingForumTempReplyResult> {
  const pendingReply = input.session.pendingReply;
  if (!pendingReply) return { kind: 'idle' };

  const now = Date.now();
  const shouldMarkRead = now >= pendingReply.readAt;
  const userMessage = input.session.messages.find((message) => message.id === pendingReply.userMessageId);

  if (shouldMarkRead && userMessage && !userMessage.readAt) {
    return {
      kind: 'mark-read',
      nextSession: markForumTempChatMessageRead(input.session, pendingReply.userMessageId, pendingReply.readAt),
    };
  }

  if (pendingReply.behavior === 'ghost') {
    if (shouldMarkRead && pendingReply.status !== 'ghosted') {
      return {
        kind: 'ghosted',
        nextSession: markForumTempChatGhosted(input.session, now),
      };
    }
    return { kind: 'idle' };
  }

  if (!pendingReply.replyAt || now < pendingReply.replyAt) {
    return { kind: 'idle' };
  }

  if (pendingReply.status !== 'typing') {
    return {
      kind: 'typing',
      nextSession: markForumTempChatTyping(input.session, now),
    };
  }

  const relatedPost = pendingReply.relatedPostId
    ? input.relatedPost
    : input.resolveRecentForumPostForAuthor(input.author.id);

  const replyText = await generateForumTempReply({
    activeConfig: input.forumConfig,
    authorName: input.author.name,
    authorPersona: input.author.description || input.author.bio || '',
    channel: relatedPost ? input.inferForumChannelFromCategory(relatedPost.category) : undefined,
    recentForumPost: relatedPost,
    history: input.session.messages,
    userMessage: pendingReply.userText,
  });

  const trimmed = replyText.trim();
  if (!trimmed) {
    return {
      kind: 'cleared',
      nextSession: clearForumTempChatPendingReply(input.session, now),
    };
  }

  const npcMessage = buildNpcTempMessage(trimmed, now);
  const nextSession = appendForumTempNpcReply(input.session, npcMessage, {
    viewerLastSeenAt: input.currentView === 'temp-chat' && input.activeTempChatUserId === input.author.id
      ? now
      : input.session.viewerLastSeenAt,
  });

  const shouldSendFriendRequest = !!input.allowNpcFriendRequest
    && shouldCreateForumFriendRequest(nextSession)
    && !hasPendingForumFriendRequest(input.appData.friendRequests || [], input.author.id);
  const friendRequest = shouldSendFriendRequest
    ? createForumFriendRequest({
        author: input.author,
        session: nextSession,
        relatedPost: relatedPost || input.resolveRecentForumPostForAuthor(input.author.id),
      })
    : null;
  const finalSession = friendRequest ? markForumFriendRequestSent(nextSession, now) : nextSession;
  const nextNotifications = friendRequest
    ? [
        createForumNotification({
          userId: input.currentUserId,
          type: 'friend_request',
          sourceUserId: input.author.id,
          postId: relatedPost?.id || '',
          timestamp: now,
        }),
        ...(input.appData.forumData?.notifications || []),
      ]
    : (input.appData.forumData?.notifications || []);

  return {
    kind: 'replied',
    nextSession: finalSession,
    nextNotifications,
    nextFriendRequests: friendRequest
      ? [friendRequest, ...(input.appData.friendRequests || [])]
      : input.appData.friendRequests,
    friendRequestNotice: friendRequest
      ? `${input.author.name} 想正式加你为好友，已经进“新的朋友”了。`
      : undefined,
  };
}

export function resolveForumTempSession(
  tempChats: Record<string, ForumTempChatSession> | undefined,
  authorId: string,
) {
  return (tempChats || {})[authorId] || createEmptyForumTempChatSession(authorId);
}

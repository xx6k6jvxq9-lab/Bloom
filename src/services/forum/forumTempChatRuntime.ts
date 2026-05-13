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
  onProgress?: (text: string) => void;
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
  let workingSession = input.session;
  const userMessage = workingSession.messages.find((message) => message.id === pendingReply.userMessageId);

  if (shouldMarkRead && userMessage && !userMessage.readAt) {
    workingSession = markForumTempChatMessageRead(workingSession, pendingReply.userMessageId, pendingReply.readAt);
  }

  const activePendingReply = workingSession.pendingReply;
  if (!activePendingReply) {
    return {
      kind: 'cleared',
      nextSession: clearForumTempChatPendingReply(workingSession, now),
    };
  }

  if (activePendingReply.behavior === 'ghost') {
    if (shouldMarkRead && activePendingReply.status !== 'ghosted') {
      return {
        kind: 'ghosted',
        nextSession: markForumTempChatGhosted(workingSession, now),
      };
    }

    if (workingSession !== input.session) {
      return {
        kind: 'mark-read',
        nextSession: workingSession,
      };
    }

    return { kind: 'idle' };
  }

  if (!activePendingReply.replyAt || now < activePendingReply.replyAt) {
    if (workingSession !== input.session) {
      return {
        kind: 'mark-read',
        nextSession: workingSession,
      };
    }

    return { kind: 'idle' };
  }

  if (activePendingReply.status !== 'typing') {
    workingSession = markForumTempChatTyping(workingSession, now);
  }

  const readyPendingReply = workingSession.pendingReply;
  if (!readyPendingReply) {
    return {
      kind: 'cleared',
      nextSession: clearForumTempChatPendingReply(workingSession, now),
    };
  }

  const relatedPost = readyPendingReply.relatedPostId
    ? input.relatedPost
    : input.resolveRecentForumPostForAuthor(input.author.id);

  const replyText = await generateForumTempReply({
    activeConfig: input.forumConfig,
    authorName: input.author.name,
    authorPersona: input.author.description || input.author.bio || '',
    channel: relatedPost ? input.inferForumChannelFromCategory(relatedPost.category) : undefined,
    recentForumPost: relatedPost,
    history: workingSession.messages,
    userMessage: readyPendingReply.userText,
    onProgress: input.onProgress,
  });

  const trimmed = replyText.trim();
  if (!trimmed) {
    return {
      kind: 'cleared',
      nextSession: clearForumTempChatPendingReply(workingSession, now),
    };
  }

  const npcMessage = buildNpcTempMessage(trimmed, now);
  const nextSession = appendForumTempNpcReply(workingSession, npcMessage, {
    viewerLastSeenAt: input.currentView === 'temp-chat' && input.activeTempChatUserId === input.author.id
      ? now
      : workingSession.viewerLastSeenAt,
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

import type { ForumTempChatMessage, ForumTempChatPendingReply, ForumTempChatSession } from '../../types';

export const FORUM_FRIEND_REQUEST_MIN_EXCHANGE_ROUNDS = 10;
const FORUM_FRIEND_REQUEST_GHOST_COOLDOWN_MS = 30 * 60 * 1000;
const FORUM_MIN_MEANINGFUL_TEXT_LENGTH = 4;

export function createEmptyForumTempChatSession(authorId: string, now = Date.now()): ForumTempChatSession {
  return {
    authorId,
    createdAt: now,
    updatedAt: now,
    messages: [],
    sessionOrigin: 'user_opened',
    canAddFriend: false,
    addedAsFriend: false,
    completedExchangeRounds: 0,
    meaningfulReplyCount: 0,
    proactiveNpcTurnCount: 0,
    friendRequestState: 'none',
  };
}

export function hasMeaningfulForumTempText(value?: string) {
  const normalized = (value || '').replace(/\s+/g, '').trim();
  return normalized.length >= FORUM_MIN_MEANINGFUL_TEXT_LENGTH;
}

export function isProactiveForumTempReply(value?: string) {
  const text = (value || '').trim();
  if (!text) return false;
  return /[?？]$/.test(text)
    || /要不要|要不|不如|继续|展开说|多说点|细说|加个|认识一下|再聊|方便的话|你觉得呢/u.test(text);
}

export function buildForumTempPendingReply(input: {
  userMessage: ForumTempChatMessage;
  userText: string;
  behavior: ForumTempChatPendingReply['behavior'];
  readDelayMs: number;
  replyDelayMs?: number;
  relatedPostId?: string | null;
}): ForumTempChatPendingReply {
  return {
    userMessageId: input.userMessage.id,
    userText: input.userText,
    behavior: input.behavior,
    readAt: input.userMessage.timestamp + input.readDelayMs,
    replyAt: input.behavior === 'ghost'
      ? undefined
      : input.userMessage.timestamp + (input.replyDelayMs || 0),
    status: 'waiting',
    relatedPostId: input.relatedPostId || null,
  };
}

export function appendForumTempNpcReply(
  session: ForumTempChatSession,
  npcMessage: ForumTempChatMessage,
  options?: {
    viewerLastSeenAt?: number;
  },
): ForumTempChatSession {
  const messages = [...session.messages, npcMessage];
  const pendingUserText = session.pendingReply?.userText || '';
  const userTurnMeaningful = hasMeaningfulForumTempText(pendingUserText);
  const npcTurnMeaningful = hasMeaningfulForumTempText(npcMessage.text);
  const completedExchangeRounds = (session.completedExchangeRounds || 0) + (userTurnMeaningful && npcTurnMeaningful ? 1 : 0);
  const meaningfulReplyCount = (session.meaningfulReplyCount || 0) + (npcTurnMeaningful ? 1 : 0);
  const proactiveNpcTurnCount = (session.proactiveNpcTurnCount || 0) + (isProactiveForumTempReply(npcMessage.text) ? 1 : 0);
  const friendRequestState = session.friendRequestState || 'none';
  const requestReady = friendRequestState === 'none'
    && completedExchangeRounds >= FORUM_FRIEND_REQUEST_MIN_EXCHANGE_ROUNDS
    && proactiveNpcTurnCount >= 1;

  return {
    ...session,
    messages,
    pendingReply: undefined,
    updatedAt: npcMessage.timestamp,
    viewerLastSeenAt: options?.viewerLastSeenAt ?? session.viewerLastSeenAt,
    completedExchangeRounds,
    meaningfulReplyCount,
    proactiveNpcTurnCount,
    canAddFriend: false,
    friendRequestState: requestReady ? 'ready' : friendRequestState,
  };
}

export function markForumTempChatGhosted(session: ForumTempChatSession, now = Date.now()): ForumTempChatSession {
  return {
    ...session,
    pendingReply: session.pendingReply
      ? { ...session.pendingReply, status: 'ghosted' }
      : session.pendingReply,
    updatedAt: now,
    lastGhostedAt: now,
  };
}

export function markForumFriendRequestSent(session: ForumTempChatSession, now = Date.now()): ForumTempChatSession {
  return {
    ...session,
    friendRequestState: 'sent',
    friendRequestSentAt: now,
    updatedAt: now,
  };
}

export function markForumFriendRequestResolved(
  session: ForumTempChatSession,
  status: 'accepted' | 'rejected',
  now = Date.now(),
): ForumTempChatSession {
  return {
    ...session,
    friendRequestState: status,
    addedAsFriend: status === 'accepted' ? true : session.addedAsFriend,
    updatedAt: now,
  };
}

export function shouldCreateForumFriendRequest(session: ForumTempChatSession, now = Date.now()) {
  if (session.addedAsFriend) return false;
  if ((session.friendRequestState || 'none') !== 'ready') return false;
  if ((session.completedExchangeRounds || 0) < FORUM_FRIEND_REQUEST_MIN_EXCHANGE_ROUNDS) return false;
  if ((session.meaningfulReplyCount || 0) < FORUM_FRIEND_REQUEST_MIN_EXCHANGE_ROUNDS) return false;
  if ((session.proactiveNpcTurnCount || 0) < 1) return false;
  if (session.pendingReply) return false;
  if (session.lastGhostedAt && now - session.lastGhostedAt < FORUM_FRIEND_REQUEST_GHOST_COOLDOWN_MS) return false;
  return true;
}

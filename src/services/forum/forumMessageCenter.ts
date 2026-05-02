import type { CSSProperties } from 'react';
import type { ForumNotification, ForumPost, ForumTempChatSession } from '../../types';

export type ForumMessageCenterAuthor = {
  id: string;
  name: string;
  avatar: string;
};

export type ForumMessageChatSessionItem = {
  session: ForumTempChatSession;
  author: ForumMessageCenterAuthor;
  handleText: string;
  lastMessage: ForumTempChatSession['messages'][number] | null;
  relatedPost: ForumPost | null;
  isUnread: boolean;
  isMutual: boolean;
  sortTimestamp: number;
};

export type ForumMessageNotificationItem = {
  notification: ForumNotification;
  sourceUser: ForumMessageCenterAuthor;
  post: ForumPost | undefined;
  actionText: string;
};

export type ForumMessageCenterData = {
  myNotifications: ForumNotification[];
  mutualChatSessions: ForumMessageChatSessionItem[];
  strangerChatSessions: ForumMessageChatSessionItem[];
  mutualUnreadCount: number;
  strangerUnreadCount: number;
  unreadNotificationCount: number;
  unreadChatCount: number;
};

type BuildForumMessageCenterDataInput = {
  currentUserId: string;
  notifications: ForumNotification[];
  tempChats: Record<string, ForumTempChatSession>;
  pinnedChatAuthorIds: string[];
  getAuthor: (authorId: string) => ForumMessageCenterAuthor;
  isMutualForumFollow: (authorId: string) => boolean;
  resolveRecentForumPostForAuthor: (authorId: string) => ForumPost | null;
  formatHandleText: (authorId: string) => string;
};

function sortChatSessionGroup(
  items: ForumMessageChatSessionItem[],
  pinnedChatAuthorIds: string[],
) {
  return [...items].sort((a, b) => {
    const aPinned = pinnedChatAuthorIds.includes(a.session.authorId);
    const bPinned = pinnedChatAuthorIds.includes(b.session.authorId);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;
    if (!!a.session.pendingReply !== !!b.session.pendingReply) return a.session.pendingReply ? -1 : 1;
    return b.sortTimestamp - a.sortTimestamp;
  });
}

export function buildForumMessageCenterData(
  input: BuildForumMessageCenterDataInput,
): ForumMessageCenterData {
  const myNotifications = input.notifications
    .filter((notification) => notification.userId === input.currentUserId)
    .sort((a, b) => b.timestamp - a.timestamp);

  const chatSessions = Object.values(input.tempChats).map((session) => {
    const author = input.getAuthor(session.authorId);
    const lastMessage = session.messages[session.messages.length - 1] || null;
    const relatedPost = input.resolveRecentForumPostForAuthor(session.authorId);
    const isUnread = !!lastMessage
      && lastMessage.role === 'npc'
      && lastMessage.timestamp > (session.viewerLastSeenAt || 0);

    return {
      session,
      author,
      handleText: input.formatHandleText(session.authorId),
      lastMessage,
      relatedPost,
      isUnread,
      isMutual: input.isMutualForumFollow(session.authorId),
      sortTimestamp: lastMessage?.timestamp || session.updatedAt || session.createdAt,
    };
  });

  const mutualChatSessions = sortChatSessionGroup(
    chatSessions.filter((item) => item.isMutual),
    input.pinnedChatAuthorIds,
  );
  const strangerChatSessions = sortChatSessionGroup(
    chatSessions.filter((item) => !item.isMutual),
    input.pinnedChatAuthorIds,
  );

  return {
    myNotifications,
    mutualChatSessions,
    strangerChatSessions,
    mutualUnreadCount: mutualChatSessions.filter((item) => item.isUnread).length,
    strangerUnreadCount: strangerChatSessions.filter((item) => item.isUnread).length,
    unreadNotificationCount: myNotifications.filter((item) => !item.read).length,
    unreadChatCount: [
      ...mutualChatSessions,
      ...strangerChatSessions,
    ].filter((item) => item.isUnread).length,
  };
}

export type ForumMessageCenterInsetStyles = {
  topInsetStyle?: CSSProperties;
  bottomInsetStyle?: CSSProperties;
};


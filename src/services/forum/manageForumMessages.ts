import type { ForumData, ForumNotification, ForumTempChatSession } from '../../types';

export function markAllForumNotificationsRead(notifications: ForumNotification[]) {
  return notifications.map((notification) => ({
    ...notification,
    read: true,
  }));
}

export function markAllForumChatsRead(tempChats: Record<string, ForumTempChatSession>) {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(tempChats).map(([authorId, session]) => [
      authorId,
      {
        ...session,
        viewerLastSeenAt: now,
      },
    ]),
  );
}

export function clearStrangerForumChats(
  tempChats: Record<string, ForumTempChatSession>,
  isMutualFollow: (authorId: string) => boolean,
) {
  return Object.fromEntries(
    Object.entries(tempChats).filter(([authorId]) => isMutualFollow(authorId)),
  );
}

export function clearAllForumNotifications() {
  return [] as ForumNotification[];
}

export function removeSingleForumChat(
  tempChats: Record<string, ForumTempChatSession>,
  authorId: string,
) {
  return Object.fromEntries(
    Object.entries(tempChats).filter(([id]) => id !== authorId),
  );
}

function looksLegacyAutoNpcChat(session: ForumTempChatSession) {
  return !session.addedAsFriend
    && (session.messages?.length || 0) === 1
    && session.messages?.[0]?.role === 'npc'
    && !session.viewerLastSeenAt;
}

export function clearForumAutoNpcChats(
  tempChats: Record<string, ForumTempChatSession>,
) {
  return Object.fromEntries(
    Object.entries(tempChats).filter(([, session]) => (
      session.sessionOrigin !== 'npc_auto'
      && !looksLegacyAutoNpcChat(session)
    )),
  );
}

export function removeSingleForumNotification(
  notifications: ForumNotification[],
  notificationId: string,
) {
  return notifications.filter((notification) => notification.id !== notificationId);
}

export function applyForumNotificationsRead(
  forumData: ForumData,
) {
  return {
    ...forumData,
    notifications: markAllForumNotificationsRead(forumData.notifications || []),
  };
}

export function applyForumChatsRead(
  forumData: ForumData,
) {
  return {
    ...forumData,
    tempChats: markAllForumChatsRead(forumData.tempChats || {}),
  };
}

export function applyForumStrangerChatsCleared(
  forumData: ForumData,
  isMutualFollow: (authorId: string) => boolean,
) {
  return {
    ...forumData,
    tempChats: clearStrangerForumChats(forumData.tempChats || {}, isMutualFollow),
  };
}

export function applyForumNotificationsCleared(
  forumData: ForumData,
) {
  return {
    ...forumData,
    notifications: clearAllForumNotifications(),
  };
}

export function applyForumAutoNpcChatsCleared(
  forumData: ForumData,
) {
  return {
    ...forumData,
    tempChats: clearForumAutoNpcChats(forumData.tempChats || {}),
  };
}

export function applySingleForumChatRemoved(
  forumData: ForumData,
  authorId: string,
) {
  return {
    ...forumData,
    tempChats: removeSingleForumChat(forumData.tempChats || {}, authorId),
  };
}

export function applySingleForumNotificationRemoved(
  forumData: ForumData,
  notificationId: string,
) {
  return {
    ...forumData,
    notifications: removeSingleForumNotification(forumData.notifications || [], notificationId),
  };
}

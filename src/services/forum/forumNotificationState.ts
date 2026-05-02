import type { ForumNotification } from '../../types';
import { createForumNotification } from './forumNotifications';

type AppendForumNotificationInput = {
  notifications: ForumNotification[];
  userId: string;
  type: ForumNotification['type'];
  sourceUserId: string;
  postId: string;
  commentId?: string;
};

export function appendForumNotification(
  input: AppendForumNotificationInput,
): ForumNotification[] {
  const notification = createForumNotification({
    userId: input.userId,
    type: input.type,
    sourceUserId: input.sourceUserId,
    postId: input.postId,
    commentId: input.commentId,
  });

  return [notification, ...input.notifications];
}


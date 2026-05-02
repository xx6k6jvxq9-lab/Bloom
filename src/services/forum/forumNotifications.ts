import type { ForumNotification } from '../../types';

type CreateForumNotificationInput = {
  userId: string;
  type: ForumNotification['type'];
  sourceUserId: string;
  postId: string;
  commentId?: string;
  timestamp?: number;
};

export function createForumNotification(input: CreateForumNotificationInput): ForumNotification {
  const timestamp = input.timestamp || Date.now();

  return {
    id: `forum-notice-${input.type}-${input.sourceUserId}-${timestamp}`,
    userId: input.userId,
    type: input.type,
    sourceUserId: input.sourceUserId,
    postId: input.postId,
    commentId: input.commentId,
    timestamp,
    read: false,
  };
}

export function getForumNotificationActionText(notification: ForumNotification) {
  switch (notification.type) {
    case 'reply_to_comment':
      return '回复了你的评论';
    case 'reply_to_post':
      return '回复了你的帖子';
    case 'like_comment':
      return '喜欢了你的评论';
    case 'like_post':
      return '喜欢了你的帖子';
    case 'follow':
      return '关注了你';
    case 'friend_request':
      return '向你发来好友申请';
    default:
      return '回复了你';
  }
}

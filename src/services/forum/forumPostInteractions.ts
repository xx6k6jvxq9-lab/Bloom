import type { ForumComment, ForumNotification, ForumPost } from '../../types';
import { appendForumNotification } from './forumNotificationState';

type InteractionCommonInput = {
  posts: ForumPost[];
  currentUserId: string;
  notifications: ForumNotification[];
};

type AddCommentInput = InteractionCommonInput & {
  postId: string;
  content: string;
  replyToId?: string;
  rootCommentId?: string;
  identity?: 'self' | 'anonymous';
  maskId?: string;
  anonymousAuthorId: string;
  isCurrentUserPostAuthor: (authorId: string, post?: ForumPost) => boolean;
  isCurrentUserCommentAuthor: (authorId: string, comment?: ForumComment) => boolean;
};

type TogglePostLikeInput = InteractionCommonInput & {
  postId: string;
  isCurrentUserPostAuthor: (authorId: string, post?: ForumPost) => boolean;
};

type ToggleCommentLikeInput = InteractionCommonInput & {
  postId: string;
  commentId: string;
};

export function addForumComment(input: AddCommentInput): {
  posts: ForumPost[];
  notifications: ForumNotification[];
  createdComment: ForumComment | null;
} {
  const identity = input.identity || 'self';
  let createdComment: ForumComment | null = null;
  let nextNotifications = input.notifications;

  const nextPosts = input.posts.map((post) => {
    if (post.id !== input.postId) return post;

    const commentId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const authorId = identity === 'anonymous'
      ? input.anonymousAuthorId
      : input.currentUserId;
    const newComment: ForumComment = {
      id: commentId,
      postId: input.postId,
      authorId,
      authorIdentity: identity,
      authorMaskId: identity === 'self' ? input.maskId : undefined,
      ownerUserId: input.currentUserId,
      content: input.content,
      timestamp: Date.now(),
      likes: [],
      replyToId: input.replyToId,
      rootCommentId: input.rootCommentId || (input.replyToId ? undefined : commentId),
    };

    if (!input.replyToId) {
      newComment.rootCommentId = newComment.id;
    }

    createdComment = newComment;

    if (input.replyToId) {
      const parentComment = post.comments.find((comment) => comment.id === input.replyToId);
      if (parentComment && !input.isCurrentUserCommentAuthor(parentComment.authorId, parentComment)) {
        nextNotifications = appendForumNotification({
          notifications: nextNotifications,
          userId: parentComment.authorId,
          type: 'reply_to_comment',
          sourceUserId: authorId,
          postId: input.postId,
          commentId: newComment.id,
        });
      }
    } else if (!input.isCurrentUserPostAuthor(post.authorId, post)) {
      nextNotifications = appendForumNotification({
        notifications: nextNotifications,
        userId: post.authorId,
        type: 'reply_to_post',
        sourceUserId: authorId,
        postId: input.postId,
        commentId: newComment.id,
      });
    }

    return {
      ...post,
      comments: [...post.comments, newComment],
    };
  });

  return {
    posts: nextPosts,
    notifications: nextNotifications,
    createdComment,
  };
}

export function toggleForumPostLike(input: TogglePostLikeInput): {
  posts: ForumPost[];
  notifications: ForumNotification[];
} {
  let nextNotifications = input.notifications;

  const nextPosts = input.posts.map((post) => {
    if (post.id !== input.postId) return post;
    const isLiked = post.likes.includes(input.currentUserId);
    const nextLikes = isLiked
      ? post.likes.filter((id) => id !== input.currentUserId)
      : [...post.likes, input.currentUserId];

    if (!isLiked && !input.isCurrentUserPostAuthor(post.authorId, post)) {
      nextNotifications = appendForumNotification({
        notifications: nextNotifications,
        userId: post.authorId,
        type: 'like_post',
        sourceUserId: input.currentUserId,
        postId: input.postId,
      });
    }

    return {
      ...post,
      likes: nextLikes,
    };
  });

  return {
    posts: nextPosts,
    notifications: nextNotifications,
  };
}

export function toggleForumCommentLike(input: ToggleCommentLikeInput): {
  posts: ForumPost[];
  notifications: ForumNotification[];
} {
  let nextNotifications = input.notifications;

  const nextPosts = input.posts.map((post) => {
    if (post.id !== input.postId) return post;

    const nextComments = post.comments.map((comment) => {
      if (comment.id !== input.commentId) return comment;
      const isLiked = comment.likes.includes(input.currentUserId);
      const nextLikes = isLiked
        ? comment.likes.filter((id) => id !== input.currentUserId)
        : [...comment.likes, input.currentUserId];

      if (!isLiked && comment.authorId !== input.currentUserId) {
        nextNotifications = appendForumNotification({
          notifications: nextNotifications,
          userId: comment.authorId,
          type: 'like_comment',
          sourceUserId: input.currentUserId,
          postId: input.postId,
          commentId: input.commentId,
        });
      }

      return {
        ...comment,
        likes: nextLikes,
      };
    });

    return {
      ...post,
      comments: nextComments,
    };
  });

  return {
    posts: nextPosts,
    notifications: nextNotifications,
  };
}


import type { ForumComment, ForumPost } from '../../types';
import { FORUM_CHANNEL_LABELS } from './constants';
import type {
  ForumAuthorType,
  ForumChannel,
  ForumCommentV2,
  ForumLifecycleStage,
  ForumThreadType,
  ForumThreadV2,
} from './types';

const FORUM_LABEL_TO_CHANNEL = Object.entries(FORUM_CHANNEL_LABELS).reduce<Record<string, ForumChannel>>((acc, [channel, label]) => {
  acc[label] = channel as ForumChannel;
  return acc;
}, {});

function inferAuthorType(authorId?: string): Extract<ForumAuthorType, 'user' | 'anonymous' | 'forumNpc'> {
  if (!authorId) return 'anonymous';
  if (authorId.startsWith('user_')) return 'user';
  if (authorId.startsWith('seed-anon-') || authorId.includes('-mask-')) return 'anonymous';
  return 'forumNpc';
}

function inferLifecycleStage(threadType: ForumThreadType, commentCount: number): ForumLifecycleStage {
  if (threadType === 'reversal') return 'reversal';
  if (threadType === 'ownerUpdate') return 'ownerUpdated';
  if (commentCount >= 6) return 'heated';
  if (commentCount > 0) return 'initialReplies';
  return 'new';
}

function createSyntheticLikes(prefix: string, count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => `${prefix}-${index + 1}`);
}

type LegacyForumPostToThreadV2Options = {
  authorNameResolver?: (authorId: string) => string | undefined;
  threadType?: ForumThreadType;
  tags?: string[];
  lifecycleStage?: ForumLifecycleStage;
};

export function inferForumChannelFromLegacyCategory(category: string): ForumChannel {
  return FORUM_LABEL_TO_CHANNEL[category] || 'junction';
}

export function legacyForumPostToThreadV2(
  post: ForumPost,
  options: LegacyForumPostToThreadV2Options = {},
): ForumThreadV2 {
  const sortedComments = [...post.comments].sort((a, b) => a.timestamp - b.timestamp);
  const floorMap = new Map<string, number>();
  sortedComments.forEach((comment, index) => {
    floorMap.set(comment.id, index + 1);
  });

  const threadType = options.threadType ?? post.threadType ?? 'normal';
  const channel = post.board === 'spectator'
    ? 'junction'
    : inferForumChannelFromLegacyCategory(post.category);
  const comments: ForumCommentV2[] = sortedComments.map((comment) => ({
    id: comment.id,
    threadId: post.id,
    parentId: comment.replyToId,
    floor: floorMap.get(comment.id) || 0,
    authorType: inferAuthorType(comment.authorId),
    authorId: comment.authorId,
    authorDisplayName: options.authorNameResolver?.(comment.authorId) || comment.authorId || '匿名网友',
    body: comment.content,
    likes: comment.likes.length,
    createdAt: comment.timestamp,
  }));

  return {
    id: post.id,
    title: post.title,
    body: post.content,
    channel,
    threadType,
    contentTier: post.contentTier,
    discourseAxis: post.discourseAxis,
    authorType: inferAuthorType(post.authorId),
    authorId: post.authorId,
    authorDisplayName: options.authorNameResolver?.(post.authorId) || post.authorId || '匿名楼主',
    tags: options.tags ?? [],
    comments,
    lifecycleStage: options.lifecycleStage ?? inferLifecycleStage(threadType, comments.length),
    stats: {
      likes: post.likes.length,
      favorites: post.collections.length,
      comments: comments.length,
      views: post.viewCount,
    },
    source: post.source ?? 'cached',
    createdAt: post.timestamp,
    updatedAt: post.aiLastReplyAt || post.aiLastExpandedAt || post.timestamp,
  };
}

export function forumThreadV2ToLegacyPost(thread: ForumThreadV2): ForumPost {
  const commentsById = new Map(thread.comments.map((comment) => [comment.id, comment]));
  const resolveRootCommentId = (comment: ForumCommentV2): string => {
    let cursor: ForumCommentV2 | undefined = comment;
    while (cursor?.parentId) {
      const parent = commentsById.get(cursor.parentId);
      if (!parent) break;
      cursor = parent;
    }
    return cursor?.id || comment.id;
  };

  const sortedComments = [...thread.comments].sort((a, b) => {
    if (a.floor !== b.floor) return a.floor - b.floor;
    return a.createdAt - b.createdAt;
  });

  const comments: ForumComment[] = sortedComments.map((comment) => ({
    id: comment.id,
    postId: thread.id,
    authorId: comment.authorId || `forum-v2-anon-${comment.id}`,
    content: comment.body,
    timestamp: comment.createdAt,
    likes: createSyntheticLikes(`forum-v2-comment-like-${comment.id}`, comment.likes),
    replyToId: comment.parentId,
    rootCommentId: resolveRootCommentId(comment),
    isAiGenerated: thread.source === 'generated',
  }));

  return {
    id: thread.id,
    authorId: thread.authorId || `forum-v2-anon-${thread.id}`,
    title: thread.title,
    content: thread.body,
    category: FORUM_CHANNEL_LABELS[thread.channel],
    threadType: thread.threadType,
    contentTier: thread.contentTier,
    discourseAxis: thread.discourseAxis,
    timestamp: thread.createdAt,
    viewCount: thread.stats.views,
    likes: createSyntheticLikes(`forum-v2-like-${thread.id}`, thread.stats.likes),
    collections: createSyntheticLikes(`forum-v2-favorite-${thread.id}`, thread.stats.favorites),
    comments,
    source: thread.source === 'cached' ? undefined : thread.source,
  };
}

type AppendReplyDraftInput = {
  authorId: string;
  authorDisplayName: string;
  content: string;
  replyToId?: string;
};

export function appendRepliesToForumThreadV2(
  thread: ForumThreadV2,
  replies: AppendReplyDraftInput[],
  createdAt = Date.now(),
): ForumThreadV2 {
  if (!replies.length) return thread;

  const existingComments = [...thread.comments].sort((a, b) => {
    if (a.floor !== b.floor) return a.floor - b.floor;
    return a.createdAt - b.createdAt;
  });
  const existingById = new Map(existingComments.map((comment) => [comment.id, comment]));
  let nextFloor = existingComments.length + 1;

  const nextComments: ForumCommentV2[] = replies.map((reply, index) => ({
    id: `forum-v2-reply-${thread.id}-${createdAt}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
    threadId: thread.id,
    parentId: reply.replyToId,
    floor: nextFloor++,
    authorType: inferAuthorType(reply.authorId),
    authorId: reply.authorId,
    authorDisplayName: reply.authorDisplayName,
    body: reply.content,
    likes: 0,
    createdAt: createdAt + index,
    isOwnerReply: reply.authorId === thread.authorId,
    isHighlighted: reply.replyToId ? existingById.get(reply.replyToId)?.authorId === thread.authorId : false,
  }));

  const mergedComments = [...existingComments, ...nextComments];

  return {
    ...thread,
    comments: mergedComments,
    lifecycleStage: inferLifecycleStage(thread.threadType, mergedComments.length),
    stats: {
      ...thread.stats,
      comments: mergedComments.length,
    },
    updatedAt: createdAt + nextComments.length - 1,
  };
}

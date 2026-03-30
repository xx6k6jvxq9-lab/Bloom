import type {
  CouplePost,
  CoupleSpaceData,
  LoveLetterComment,
  MessageBoardEntry,
} from '../../../../types';
import type { CoupleSpaceInitiativeExecutorArtifact } from './coupleSpaceInitiativeExecutor';

export type CoupleSpaceDirectWriteSinkInput = {
  artifact: CoupleSpaceInitiativeExecutorArtifact | null;
  coupleSpace: CoupleSpaceData;
  authorId: string;
  targetRefs?: {
    reply_love_letter?: {
      letterId: string;
    };
    reply_daily_comment?: {
      postId: string;
      commentId: string;
    };
    react_to_existing_post?: {
      postId: string;
    };
  };
  now?: number;
};

export type CoupleSpaceDirectWriteSinkResult = {
  status: 'applied' | 'rejected' | 'unsupported';
  reason: string;
  nextCoupleSpace: CoupleSpaceData;
  writtenPost?: CouplePost;
  writtenMessageBoardEntry?: MessageBoardEntry;
  writtenLoveLetterCommentId?: string;
  writtenPostCommentId?: string;
};

function createCouplePostId(now: number): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) {
    return randomId;
  }

  return `couple-post-${now}-${Math.random().toString(36).slice(2, 8)}`;
}

export function applyCoupleSpaceDirectWriteArtifact(
  input: CoupleSpaceDirectWriteSinkInput,
): CoupleSpaceDirectWriteSinkResult {
  const { artifact, coupleSpace, authorId } = input;
  const now = input.now ?? Date.now();

  if (!artifact) {
    return {
      status: 'rejected',
      reason: 'No execution artifact was provided to the direct-write sink.',
      nextCoupleSpace: coupleSpace,
    };
  }

  if (artifact.kind !== 'generated_text') {
    return {
      status: 'unsupported',
      reason: `Direct-write sink does not support artifact kind ${artifact.kind}.`,
      nextCoupleSpace: coupleSpace,
    };
  }

  if (artifact.commitMode !== 'auto') {
    return {
      status: 'rejected',
      reason: `Direct-write sink only accepts auto commit artifacts, received ${artifact.commitMode}.`,
      nextCoupleSpace: coupleSpace,
    };
  }

  if (
    artifact.actionType !== 'post_couple_daily' &&
    artifact.actionType !== 'post_message_board_entry' &&
    artifact.actionType !== 'reply_love_letter' &&
    artifact.actionType !== 'reply_message_board' &&
    artifact.actionType !== 'reply_daily_comment' &&
    artifact.actionType !== 'react_to_existing_post'
  ) {
    return {
      status: 'unsupported',
      reason: `Direct-write sink currently supports only post_couple_daily, post_message_board_entry, reply_love_letter, reply_message_board, reply_daily_comment, and react_to_existing_post, received ${artifact.actionType}.`,
      nextCoupleSpace: coupleSpace,
    };
  }

  const content = artifact.content.trim();
  if (!content) {
    return {
      status: 'rejected',
      reason: 'Generated artifact content is empty, so no couple post can be written.',
      nextCoupleSpace: coupleSpace,
    };
  }

  if (artifact.actionType === 'post_couple_daily') {
    const nextPost: CouplePost = {
      id: createCouplePostId(now),
      authorId,
      content,
      timestamp: now,
      likes: [],
      comments: [],
    };

    return {
      status: 'applied',
      reason: 'Direct-write sink converted the generated artifact into a couple-space daily post.',
      nextCoupleSpace: {
        ...coupleSpace,
        posts: [nextPost, ...(coupleSpace.posts ?? [])],
      },
      writtenPost: nextPost,
    };
  }

  if (
    artifact.actionType === 'react_to_existing_post' ||
    artifact.actionType === 'reply_daily_comment'
  ) {
    const postId =
      artifact.actionType === 'react_to_existing_post'
        ? input.targetRefs?.react_to_existing_post?.postId
        : input.targetRefs?.reply_daily_comment?.postId;
    if (!postId) {
      return {
        status: 'rejected',
        reason:
          artifact.actionType === 'react_to_existing_post'
            ? 'Direct-write sink needs a target postId to apply a post reaction.'
            : 'Direct-write sink needs a target postId to apply a daily-comment reply.',
        nextCoupleSpace: coupleSpace,
      };
    }

    if (
      artifact.actionType === 'reply_daily_comment' &&
      !input.targetRefs?.reply_daily_comment?.commentId
    ) {
      return {
        status: 'rejected',
        reason: 'Direct-write sink needs a target commentId to apply a daily-comment reply.',
        nextCoupleSpace: coupleSpace,
      };
    }

    const posts = coupleSpace.posts ?? [];
    const targetPost = posts.find((post) => post.id === postId);
    if (!targetPost) {
      return {
        status: 'rejected',
        reason: `Direct-write sink could not find target post ${postId} for reaction write.`,
        nextCoupleSpace: coupleSpace,
      };
    }

    const nextCommentId = createCouplePostId(now);
    const nextPosts = posts.map((post) =>
      post.id !== postId
        ? post
        : {
            ...post,
            comments: [
              ...post.comments,
              {
                id: nextCommentId,
                authorId,
                content,
                timestamp: now,
              },
            ],
          },
    );

    return {
      status: 'applied',
      reason:
        artifact.actionType === 'react_to_existing_post'
          ? 'Direct-write sink converted the generated artifact into a comment on an existing couple post.'
          : 'Direct-write sink converted the generated artifact into a reply-style comment on an existing couple post.',
      nextCoupleSpace: {
        ...coupleSpace,
        posts: nextPosts,
      },
      writtenPostCommentId: nextCommentId,
    };
  }

  if (artifact.actionType === 'reply_love_letter') {
    const letterId = input.targetRefs?.reply_love_letter?.letterId;
    if (!letterId) {
      return {
        status: 'rejected',
        reason: 'Direct-write sink needs a target letterId to apply a love-letter reply.',
        nextCoupleSpace: coupleSpace,
      };
    }

    const loveLetters = coupleSpace.loveLetters ?? [];
    const targetLetter = loveLetters.find((letter) => letter.id === letterId);
    if (!targetLetter) {
      return {
        status: 'rejected',
        reason: `Direct-write sink could not find target love letter ${letterId} for reply write.`,
        nextCoupleSpace: coupleSpace,
      };
    }

    const nextCommentId = createCouplePostId(now);
    const nextComment: LoveLetterComment = {
      id: nextCommentId,
      authorId,
      content,
      timestamp: now,
    };

    const nextLoveLetters = loveLetters.map((letter) =>
      letter.id !== letterId
        ? letter
        : {
            ...letter,
            comments: [...letter.comments, nextComment],
          },
    );

    return {
      status: 'applied',
      reason: 'Direct-write sink converted the generated artifact into a love-letter reply comment.',
      nextCoupleSpace: {
        ...coupleSpace,
        loveLetters: nextLoveLetters,
      },
      writtenLoveLetterCommentId: nextCommentId,
    };
  }

  const nextEntry: MessageBoardEntry = {
    id: createCouplePostId(now),
    authorId,
    content,
    timestamp: now,
  };

  return {
    status: 'applied',
    reason:
      artifact.actionType === 'post_message_board_entry'
        ? 'Direct-write sink converted the generated artifact into a message-board entry.'
        : 'Direct-write sink converted the generated artifact into a message-board reply entry.',
    nextCoupleSpace: {
      ...coupleSpace,
      messageBoard: [nextEntry, ...(coupleSpace.messageBoard ?? [])],
    },
    writtenMessageBoardEntry: nextEntry,
  };
}

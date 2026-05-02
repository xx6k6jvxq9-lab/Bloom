import type { ForumComment, ForumPost } from '../../types';

type GeneratedForumReplyLike = {
  authorId: string;
  content: string;
  replyToId?: string;
  rootCommentId?: string;
};

type ReplyTargetCandidate = {
  commentId: string;
  floor: number;
  authorId: string;
  content: string;
  rootCommentId: string;
};

function buildCommentFloorMap(comments: ForumComment[]) {
  const sorted = [...comments].sort((a, b) => a.timestamp - b.timestamp);
  const floorMap = new Map<string, number>();
  sorted.forEach((comment, index) => {
    floorMap.set(comment.id, index + 1);
  });
  return { sorted, floorMap };
}

export function buildReplyTargetBundle(post: ForumPost, userNewComment?: ForumComment) {
  const { sorted, floorMap } = buildCommentFloorMap(post.comments);
  const floorToCommentId = new Map<number, string>();
  sorted.forEach((comment) => {
    const floor = floorMap.get(comment.id);
    if (floor) floorToCommentId.set(floor, comment.id);
  });

  const recentCandidates: ReplyTargetCandidate[] = [];
  if (userNewComment) {
    recentCandidates.push({
      commentId: userNewComment.id,
      floor: floorMap.get(userNewComment.id) || sorted.length,
      authorId: userNewComment.authorId,
      content: userNewComment.content,
      rootCommentId: userNewComment.rootCommentId || userNewComment.id,
    });
  }

  [...sorted]
    .reverse()
    .filter((comment) => comment.id !== userNewComment?.id)
    .slice(0, 5)
    .forEach((comment) => {
      recentCandidates.push({
        commentId: comment.id,
        floor: floorMap.get(comment.id) || 0,
        authorId: comment.authorId,
        content: comment.content,
        rootCommentId: comment.rootCommentId || comment.id,
      });
    });

  return {
    sorted,
    floorMap,
    floorToCommentId,
    recentCandidates,
  };
}

export function repairGeneratedForumReplies(params: {
  drafts: GeneratedForumReplyLike[];
  post: ForumPost;
  replyMode: 'mixed' | 'independent_only' | 'threaded_only';
  userNewComment?: ForumComment;
}) {
  const { drafts, post, replyMode, userNewComment } = params;
  const { recentCandidates } = buildReplyTargetBundle(post, userNewComment);
  const commentMap = new Map(post.comments.map((comment) => [comment.id, comment]));

  const normalized = drafts
    .filter((draft) => draft.content.trim())
    .map((draft) => {
      const target = draft.replyToId ? commentMap.get(draft.replyToId) : null;
      return {
        ...draft,
        content: draft.content.trim(),
        rootCommentId: target ? (target.rootCommentId || target.id) : draft.rootCommentId,
      };
    });

  if (!normalized.length) return normalized;

  if (userNewComment && !normalized.some((draft) => draft.replyToId === userNewComment.id)) {
    normalized[0] = {
      ...normalized[0],
      replyToId: userNewComment.id,
      rootCommentId: userNewComment.rootCommentId || userNewComment.id,
    };
  }

  if (replyMode === 'threaded_only' && recentCandidates.length > 0) {
    let candidateIndex = 0;
    for (let index = 0; index < normalized.length; index += 1) {
      if (normalized[index].replyToId) continue;
      const candidate = recentCandidates[candidateIndex % recentCandidates.length];
      candidateIndex += 1;
      normalized[index] = {
        ...normalized[index],
        replyToId: candidate.commentId,
        rootCommentId: candidate.rootCommentId,
      };
    }
  }

  if (userNewComment) {
    const prioritized = normalized.filter((draft) => draft.replyToId === userNewComment.id);
    const remainder = normalized.filter((draft) => draft.replyToId !== userNewComment.id);
    return [...prioritized, ...remainder];
  }

  return normalized;
}

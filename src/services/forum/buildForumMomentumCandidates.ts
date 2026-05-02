import type { ForumPost, ForumRuntimeAuthorProfile } from '../../types';

type CandidateAuthor = Pick<ForumRuntimeAuthorProfile, 'id' | 'name' | 'handle' | 'avatar' | 'bio'> & {
  interactionScore?: number;
  isCharacter?: boolean;
};

type BuildForumMomentumCandidatesInput = {
  post: ForumPost;
  recentPosts: ForumPost[];
  currentUserId: string;
  resolveAuthor: (authorId: string) => CandidateAuthor;
  isCharacterAuthor?: (authorId: string) => boolean;
};

export function buildForumMomentumCandidates(input: BuildForumMomentumCandidatesInput): CandidateAuthor[] {
  const scoreMap = new Map<string, number>();
  const push = (authorId: string, score: number) => {
    if (!authorId || authorId === input.currentUserId) return;
    scoreMap.set(authorId, (scoreMap.get(authorId) || 0) + score);
  };

  push(input.post.authorId, 5);
  input.post.comments.forEach((comment) => {
    push(comment.authorId, comment.replyToId ? 4 : 3);
  });

  input.recentPosts
    .filter((post) => post.id !== input.post.id)
    .slice(0, 12)
    .forEach((post, index) => {
      const weight = Math.max(1, 4 - Math.floor(index / 4));
      push(post.authorId, weight);
      post.comments.slice(-3).forEach((comment) => push(comment.authorId, Math.max(1, weight - 1)));
    });

  return Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([authorId, interactionScore]) => {
      const author = input.resolveAuthor(authorId);
      return {
        ...author,
        interactionScore,
        isCharacter: input.isCharacterAuthor?.(authorId) || false,
      };
    });
}

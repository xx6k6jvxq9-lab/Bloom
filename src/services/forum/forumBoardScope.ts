import type { ForumPost } from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';

export type ForumBoardScope = 'public' | 'spectator';

export function getForumBoardScope(post: Pick<ForumPost, 'board' | 'category'>): ForumBoardScope {
  return post.board === 'spectator' || post.category === '镜间' ? 'spectator' : 'public';
}

export function isSpectatorScopedPost(post: Pick<ForumPost, 'board' | 'category'>) {
  return getForumBoardScope(post) === 'spectator';
}

export function isSameForumBoard(left: Pick<ForumPost, 'board' | 'category'>, right: Pick<ForumPost, 'board' | 'category'>) {
  return getForumBoardScope(left) === getForumBoardScope(right);
}

export function canForumPostsInteract(
  left: Pick<ForumPost, 'board' | 'category'>,
  right: Pick<ForumPost, 'board' | 'category'>,
  inferChannel: (category: string) => ForumChannel,
) {
  const leftBoard = getForumBoardScope(left);
  const rightBoard = getForumBoardScope(right);
  if (leftBoard !== rightBoard) return false;
  if (leftBoard === 'spectator') return true;
  return inferChannel(left.category) === inferChannel(right.category);
}

export function matchesForumBoardScope(
  post: Pick<ForumPost, 'board' | 'category'>,
  board: ForumBoardScope,
) {
  return getForumBoardScope(post) === board;
}

import type { ForumPost } from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';
import { canContinueHotForumPost, getForumHotScore } from './forumHotState';
import { canForumPostsInteract, matchesForumBoardScope } from './forumBoardScope';

type PickForumRefreshContinuationTargetsInput = {
  posts: ForumPost[];
  channel: ForumChannel;
  inferChannel: (category: string) => ForumChannel;
  board?: 'public' | 'spectator';
  now?: number;
};

export function pickForumRefreshContinuationTargets(input: PickForumRefreshContinuationTargetsInput) {
  const now = input.now || Date.now();
  const board = input.board || 'public';

  return input.posts
    .filter((post) => {
      if (!matchesForumBoardScope(post, board)) return false;
      if (board === 'public' && input.inferChannel(post.category) !== input.channel) return false;
      if (post.comments.length < 2) return false;
      if (!canContinueHotForumPost(post, now)) return false;
      if (!canForumPostsInteract(post, { ...post, board }, input.inferChannel)) return false;
      return true;
    })
    .map((post) => {
      const freshnessBonus = Math.max(0, 36 - Math.floor((now - post.timestamp) / (60 * 60 * 1000)));
      const tierBonus = post.contentTier === 'highlight'
        ? 18
        : post.contentTier === 'ferment'
          ? 12
          : post.contentTier === 'fragment'
            ? 4
            : 0;
      const heatScore = Math.max(
        getForumHotScore(post, now),
        post.comments.length * 12 + post.likes.length * 6 + post.viewCount * 0.06 + freshnessBonus + tierBonus,
      );
      return { post, heatScore };
    })
    .sort((a, b) => b.heatScore - a.heatScore)
    .slice(0, 6)
    .sort(() => Math.random() - 0.5)
    .map((item) => item.post);
}

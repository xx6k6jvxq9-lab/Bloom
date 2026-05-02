import type { ForumPost } from '../../types';
import { getForumTrendScore, resolveForumTrendState } from './forumPostActivity';

export const FORUM_HOT_CONTINUATION_COOLDOWN_MS = 20 * 60 * 1000;
export const FORUM_HOT_CONTINUATION_LIMIT = 3;

export function getForumHotScore(post: ForumPost, now = Date.now()) {
  return getForumTrendScore(post, now);
}

export function resolveForumHotState(post: ForumPost, now = Date.now()) {
  const { score, state } = resolveForumTrendState(post, now);
  return { score, state };
}

export function isHotForumPost(post: ForumPost, now = Date.now()) {
  return (post.hotState ?? resolveForumHotState(post, now).state) === 'hot';
}

export function getForumHotBadgeLabel(post: ForumPost, now = Date.now()) {
  const state = post.hotState ?? resolveForumHotState(post, now).state;
  if (state === 'hot') return 'HOT';
  if (state === 'warm') return '在热';
  return '';
}

export function canContinueHotForumPost(post: ForumPost, now = Date.now()) {
  const continuationCount = post.hotContinuationCount || 0;
  const lastContinuationAt = post.lastHotContinuationAt || 0;
  if (continuationCount >= FORUM_HOT_CONTINUATION_LIMIT) return false;
  if (lastContinuationAt > 0 && (now - lastContinuationAt) < FORUM_HOT_CONTINUATION_COOLDOWN_MS) return false;
  return (post.hotState || resolveForumHotState(post, now).state) !== 'none';
}

export function applyForumHotState(post: ForumPost, now = Date.now()): ForumPost {
  const { score, state } = resolveForumHotState(post, now);
  return {
    ...post,
    hotScore: score,
    hotState: state,
  };
}

export function markForumHotContinuation(
  post: ForumPost,
  source: 'feed_refresh' | 'detail_refresh',
  now = Date.now(),
): ForumPost {
  return applyForumHotState({
    ...post,
    hotContinuationCount: (post.hotContinuationCount || 0) + 1,
    lastHotContinuationAt: now,
    lastHotContinuationSource: source,
    aiLastExpandedAt: now,
  }, now);
}

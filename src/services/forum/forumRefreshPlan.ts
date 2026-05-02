import type { ForumPost } from '../../types';
import type { ForumChannel } from '../../features/forum-domain/types';
import { buildForumRecurringAuthorSelection } from './forumRecurringAuthorPolicy';
import type { GeneratedForumAuthorDraft } from './generateForumThreads';
import { canContinueHotForumPost } from './forumHotState';

export const MIN_FORUM_REFRESH_POST_COUNT = 8;
export const MAX_FORUM_REFRESH_HOT_CONTINUATIONS = 2;

type BuildForumRefreshPlanInput = {
  channel: ForumChannel;
  candidateRecurringAuthors: GeneratedForumAuthorDraft[];
  continuationTargets: ForumPost[];
  now?: number;
};

export type ForumRefreshPlan = {
  postCount: number;
  recurringAuthors: GeneratedForumAuthorDraft[];
  continuationTargets: ForumPost[];
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function buildForumRefreshPlan(input: BuildForumRefreshPlanInput): ForumRefreshPlan {
  const now = input.now || Date.now();
  const batchSeed = `${input.channel}:${Math.floor(now / 60000)}`;
  const extraPosts = hashString(batchSeed) % 3;

  const recurringAuthors = buildForumRecurringAuthorSelection({
    authors: input.candidateRecurringAuthors,
    seed: `${batchSeed}:recurring`,
  });

  const continuationTargets = input.continuationTargets
    .filter((post) => canContinueHotForumPost(post, now))
    .slice(0, MAX_FORUM_REFRESH_HOT_CONTINUATIONS);

  return {
    postCount: MIN_FORUM_REFRESH_POST_COUNT + extraPosts,
    recurringAuthors,
    continuationTargets,
  };
}

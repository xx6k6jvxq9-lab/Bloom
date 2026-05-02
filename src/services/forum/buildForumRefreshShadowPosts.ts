import { FORUM_CHANNEL_LABELS } from '../../features/forum-domain/constants';
import type { ForumChannel } from '../../features/forum-domain/types';
import type { ForumPost } from '../../types';
import type { GeneratedForumAuthorDraft } from './generateForumThreads';
import { buildForumInitialEngagement } from './buildForumInitialEngagement';
import { applyForumHotState } from './forumHotState';
import { buildForumShadowFollowupPost } from './buildForumShadowFollowupPost';

type BuildForumRefreshShadowPostsInput = {
  channel: ForumChannel;
  continuationTargets: ForumPost[];
  recurringAuthors: GeneratedForumAuthorDraft[];
  currentUserId: string;
  now?: number;
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function buildForumRefreshShadowPosts(input: BuildForumRefreshShadowPostsInput) {
  if (!input.continuationTargets.length || !input.recurringAuthors.length) {
    return { posts: [] as ForumPost[], shadowCount: 0 };
  }

  const baseNow = input.now || Date.now();
  const shadowDrafts = input.continuationTargets.flatMap((sourcePost, index) => {
    const candidates = input.recurringAuthors.filter((author) => (
      author.id !== sourcePost.authorId
      && author.displayName
      && author.id !== input.currentUserId
    ));
    if (!candidates.length) return [];

    const seed = hashString(`${sourcePost.id}:${baseNow}:${index}`);
    const pickedAuthor = candidates[seed % candidates.length];
    const draft = buildForumShadowFollowupPost({
      sourcePost,
      channel: input.channel,
      authorId: pickedAuthor.id,
      authorName: pickedAuthor.displayName,
      categoryLabel: sourcePost.category,
      now: baseNow + index * 2_000,
    });

    return [{
      id: draft.id,
      authorId: draft.authorId,
      title: draft.title,
      content: draft.content,
      images: [],
      category: draft.category,
      threadType: draft.threadType,
      timestamp: draft.timestamp,
      viewCount: 24 + (seed % 36),
      likes: [],
      collections: [],
      comments: [],
      source: 'generated' as const,
    }];
  });

  if (!shadowDrafts.length) {
    return { posts: [] as ForumPost[], shadowCount: 0 };
  }

  const engagedShadowPosts = buildForumInitialEngagement({
    posts: shadowDrafts,
    authors: input.recurringAuthors,
    boardLabel: FORUM_CHANNEL_LABELS[input.channel],
  }).map((post) => applyForumHotState({
    ...post,
    board: 'public',
  }));

  return {
    posts: engagedShadowPosts,
    shadowCount: engagedShadowPosts.length,
  };
}

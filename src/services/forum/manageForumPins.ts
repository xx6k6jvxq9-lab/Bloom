import type { ForumPost } from '../../types';

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

export function togglePinnedForumChat(pinnedChatAuthorIds: string[], authorId: string) {
  if (pinnedChatAuthorIds.includes(authorId)) {
    return pinnedChatAuthorIds.filter((id) => id !== authorId);
  }
  return [authorId, ...pinnedChatAuthorIds];
}

export function togglePinnedForumPost(pinnedPostIds: string[], postId: string) {
  if (pinnedPostIds.includes(postId)) {
    return pinnedPostIds.filter((id) => id !== postId);
  }
  return [postId, ...pinnedPostIds];
}

export function sortForumPostsWithPins(posts: ForumPost[], pinnedPostIds: string[]) {
  const pinnedSet = new Set(unique(pinnedPostIds));
  return [...posts].sort((left, right) => {
    const leftPinned = pinnedSet.has(left.id);
    const rightPinned = pinnedSet.has(right.id);
    if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
    return right.timestamp - left.timestamp;
  });
}

export function sortForumIdsWithPins(ids: string[], pinnedIds: string[]) {
  const pinnedSet = new Set(unique(pinnedIds));
  return [...ids].sort((left, right) => {
    const leftPinned = pinnedSet.has(left);
    const rightPinned = pinnedSet.has(right);
    if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
    return 0;
  });
}

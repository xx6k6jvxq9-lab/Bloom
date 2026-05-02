import type { Character, ForumComment, ForumPost } from '../../types';

export type ForumIdentity = 'self' | 'mask' | 'anonymous' | 'character';

export type ForumIdentityBadgeMeta = {
  label: string;
  className: string;
} | null;

export function getForumIdentityBadgeMeta(identity?: ForumIdentity): ForumIdentityBadgeMeta {
  if (identity === 'anonymous') {
    return {
      label: '匿名',
      className: 'border border-zinc-200 bg-zinc-50 text-zinc-500',
    };
  }

  if (identity === 'mask') {
    return {
      label: '面具',
      className: 'border border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  return null;
}

export function resolveForumPostIdentity(
  post: ForumPost,
  getCharacterById: (characterId: string) => Character | undefined,
): ForumIdentity {
  if (post.authorMaskId) return 'mask';
  if (post.authorIdentity) return post.authorIdentity;
  if (getCharacterById(post.authorId)) return 'character';
  if (post.authorId.startsWith('seed-anon-')) return 'anonymous';
  return 'self';
}

export function resolveForumCommentIdentity(
  comment: ForumComment,
  getCharacterById: (characterId: string) => Character | undefined,
): ForumIdentity {
  if (comment.authorMaskId) return 'mask';
  if (comment.authorIdentity) return comment.authorIdentity;
  if (getCharacterById(comment.authorId)) return 'character';
  if (comment.authorId.startsWith('seed-anon-')) return 'anonymous';
  return 'self';
}

export function isCurrentUserPostAuthor(currentUserId: string, authorId: string, post?: ForumPost) {
  return (
    post?.ownerUserId === currentUserId
    || authorId === currentUserId
    || authorId.startsWith(`seed-anon-${currentUserId}-`)
  );
}

export function isCurrentUserCommentAuthor(currentUserId: string, authorId: string, comment?: ForumComment) {
  return (
    comment?.ownerUserId === currentUserId
    || authorId === currentUserId
    || authorId.startsWith(`seed-anon-${currentUserId}-comment-`)
  );
}

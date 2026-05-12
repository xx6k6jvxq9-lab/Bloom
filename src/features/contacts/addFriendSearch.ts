import type { Character, ForumData, ForumPost, ForumRuntimeAuthorProfile, ForumTempChatSession } from '../../types';
import { getForumSeedAuthorProfile } from '../forum-domain/seedThreadsCatalog';
import {
  getCharacterNumericId,
  getForumRuntimeAuthorNumericId,
  isStableNumericId,
} from '../../services/social-id/stableNumericId';

export type SearchableForumAuthor = {
  id: string;
  numericId: string;
  name: string;
  avatar: string;
  handle?: string;
  bio?: string;
  persona?: string;
  relatedPost?: ForumPost | null;
  session?: ForumTempChatSession;
};

export type AddFriendSearchTarget =
  | {
      kind: 'character';
      character: Character;
    }
  | {
      kind: 'forum_author';
      author: SearchableForumAuthor;
    };

export type AddFriendQueryKind = 'numeric_id' | 'forum_handle';

export type AddFriendLookupResult = {
  target: AddFriendSearchTarget;
  sourceLabel: '角色' | '论坛网友';
  displayName: string;
  avatar: string;
  identifierText: string;
  secondaryText: string;
  noteText?: string;
  canAdd: boolean;
  blockedReason?: string;
};

function isAnonymousForumAuthorId(authorId: string) {
  return authorId.startsWith('seed-anon-') || authorId.includes('-mask-');
}

function canSearchForumAuthor(
  authorId: string,
  currentUserId: string,
  runtimeProfile?: ForumRuntimeAuthorProfile,
) {
  if (!authorId || authorId === currentUserId) {
    return false;
  }
  if (isAnonymousForumAuthorId(authorId)) {
    return false;
  }
  if (runtimeProfile?.boardScope === 'spectator') {
    return false;
  }
  return true;
}

function normalizeHandleQuery(value: string) {
  return value.trim().replace(/^@/, '').trim().toLowerCase();
}

function normalizeNumericIdQuery(value: string) {
  return value.trim().replace(/^@/, '').trim();
}

function buildRecentForumPostMap(posts: ForumPost[] | null | undefined) {
  const recentPostMap = new Map<string, ForumPost>();

  (posts || []).forEach((post) => {
    const authorIds = new Set<string>([
      post.authorId,
      ...post.comments.map((comment) => comment.authorId),
    ]);

    authorIds.forEach((authorId) => {
      const current = recentPostMap.get(authorId);
      if (!current || current.timestamp < post.timestamp) {
        recentPostMap.set(authorId, post);
      }
    });
  });

  return recentPostMap;
}

function collectSearchableForumAuthorIds(forumData: ForumData) {
  const ids = new Set<string>();

  Object.keys(forumData.runtimeAuthorProfiles || {}).forEach((authorId) => ids.add(authorId));
  Object.keys(forumData.tempChats || {}).forEach((authorId) => ids.add(authorId));
  (forumData.posts || []).forEach((post) => {
    ids.add(post.authorId);
    post.comments.forEach((comment) => ids.add(comment.authorId));
  });

  return [...ids];
}

function buildForumAuthorTarget(input: {
  authorId: string;
  runtimeProfile?: ForumRuntimeAuthorProfile;
  seedProfile?: ReturnType<typeof getForumSeedAuthorProfile>;
  recentPostMap: Map<string, ForumPost>;
  tempChats: Record<string, ForumTempChatSession>;
}): AddFriendSearchTarget {
  const { authorId, runtimeProfile, seedProfile, recentPostMap, tempChats } = input;
  const candidateNumericId = runtimeProfile
    ? getForumRuntimeAuthorNumericId(runtimeProfile)
    : seedProfile?.numericId;

  return {
    kind: 'forum_author',
    author: {
      id: authorId,
      numericId: candidateNumericId || '',
      name: runtimeProfile?.name || seedProfile?.name || `网友${authorId.slice(-4)}`,
      avatar: runtimeProfile?.avatar || seedProfile?.avatar || '',
      handle: runtimeProfile?.handle || seedProfile?.handle,
      bio: runtimeProfile?.bio || seedProfile?.bio,
      persona: runtimeProfile?.persona,
      relatedPost: recentPostMap.get(authorId) || null,
      session: tempChats[authorId],
    },
  };
}

export function findAddFriendTargetByNumericId(input: {
  numericId: string;
  characters: Character[];
  forumData: ForumData;
  currentUserId: string;
}): AddFriendSearchTarget | null {
  const normalizedId = normalizeNumericIdQuery(input.numericId);
  if (!isStableNumericId(normalizedId)) {
    return null;
  }

  const matchedCharacter = input.characters.find((character) => getCharacterNumericId(character) === normalizedId);
  if (matchedCharacter) {
    return {
      kind: 'character',
      character: matchedCharacter,
    };
  }

  const runtimeAuthorProfiles = input.forumData.runtimeAuthorProfiles || {};
  const tempChats = input.forumData.tempChats || {};
  const recentPostMap = buildRecentForumPostMap(input.forumData.posts || []);

  for (const authorId of collectSearchableForumAuthorIds(input.forumData)) {
    const runtimeProfile = runtimeAuthorProfiles[authorId];
    if (!canSearchForumAuthor(authorId, input.currentUserId, runtimeProfile)) {
      continue;
    }

    const seedProfile = getForumSeedAuthorProfile(authorId);
    const candidateNumericId = runtimeProfile
      ? getForumRuntimeAuthorNumericId(runtimeProfile)
      : seedProfile?.numericId;

    if (candidateNumericId !== normalizedId) {
      continue;
    }

    return buildForumAuthorTarget({
      authorId,
      runtimeProfile,
      seedProfile,
      recentPostMap,
      tempChats,
    });
  }

  return null;
}

export function findAddFriendTargetByHandle(input: {
  handle: string;
  characters: Character[];
  forumData: ForumData;
  currentUserId: string;
}): AddFriendSearchTarget | null {
  const normalizedHandle = normalizeHandleQuery(input.handle);
  if (!normalizedHandle) {
    return null;
  }

  const runtimeAuthorProfiles = input.forumData.runtimeAuthorProfiles || {};
  const tempChats = input.forumData.tempChats || {};
  const recentPostMap = buildRecentForumPostMap(input.forumData.posts || []);

  for (const authorId of collectSearchableForumAuthorIds(input.forumData)) {
    const runtimeProfile = runtimeAuthorProfiles[authorId];
    if (!canSearchForumAuthor(authorId, input.currentUserId, runtimeProfile)) {
      continue;
    }

    const seedProfile = getForumSeedAuthorProfile(authorId);
    const candidateHandle = normalizeHandleQuery(runtimeProfile?.handle || seedProfile?.handle || '');
    if (!candidateHandle || candidateHandle !== normalizedHandle) {
      continue;
    }

    const matchedCharacter = input.characters.find((character) => character.id === authorId) || null;
    if (matchedCharacter) {
      return {
        kind: 'character',
        character: matchedCharacter,
      };
    }

    return buildForumAuthorTarget({
      authorId,
      runtimeProfile,
      seedProfile,
      recentPostMap,
      tempChats,
    });
  }

  return null;
}

export function resolveAddFriendQueryKind(query: string): AddFriendQueryKind | null {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return null;
  }
  if (isStableNumericId(normalizeNumericIdQuery(normalizedQuery))) {
    return 'numeric_id';
  }
  if (normalizedQuery.startsWith('@') && normalizeHandleQuery(normalizedQuery)) {
    return 'forum_handle';
  }
  return null;
}

export function findAddFriendTargetByQuery(input: {
  query: string;
  characters: Character[];
  forumData: ForumData;
  currentUserId: string;
}): AddFriendSearchTarget | null {
  const kind = resolveAddFriendQueryKind(input.query);
  if (kind === 'forum_handle') {
    return findAddFriendTargetByHandle({
      handle: input.query,
      characters: input.characters,
      forumData: input.forumData,
      currentUserId: input.currentUserId,
    });
  }
  if (kind === 'numeric_id') {
    return findAddFriendTargetByNumericId({
      numericId: input.query,
      characters: input.characters,
      forumData: input.forumData,
      currentUserId: input.currentUserId,
    });
  }
  return null;
}

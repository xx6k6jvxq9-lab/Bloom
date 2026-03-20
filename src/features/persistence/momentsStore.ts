import { loadJson, remove as removeStoredJson, saveJson } from './localConfigStore';
import { STORAGE_KEYS } from './storageKeys';

export type PersistedMomentComment = {
  id: string;
  authorId: string;
  content: string;
  timestamp: number;
  replyToCommentId?: string;
  replyToAuthorId?: string;
  replyToAuthorName?: string;
};

export type PersistedMoment = {
  id: string;
  authorId: string;
  content: string;
  images?: string[];
  timestamp: number;
  likes: number;
  likedBy?: string[];
  isLiked?: boolean;
  isCollected?: boolean;
  comments: PersistedMomentComment[];
};

function normalizeLegacyActorId(actorId: string | undefined): string | undefined {
  if (!actorId) return actorId;
  if (actorId === 'user') return actorId;

  if (/^char_\d+$/.test(actorId)) {
    return actorId.replace('char_', 'char-');
  }

  if (actorId === 'char_zhou_jibai') {
    return 'char-zhou-jibai';
  }

  return actorId;
}

export function hydrateMoments(source: PersistedMoment[] | null | undefined, fallback: PersistedMoment[]): PersistedMoment[] {
  if (!Array.isArray(source)) {
    return fallback;
  }

  return source.map((moment) => ({
    id: moment.id,
    authorId: normalizeLegacyActorId(moment.authorId) || moment.authorId,
    content: moment.content,
    images: Array.isArray(moment.images) ? moment.images : undefined,
    timestamp: moment.timestamp,
    likes: moment.likes ?? 0,
    likedBy: Array.isArray(moment.likedBy)
      ? moment.likedBy.map(actorId => normalizeLegacyActorId(actorId) || actorId)
      : undefined,
    isLiked: moment.isLiked,
    isCollected: moment.isCollected,
    comments: Array.isArray(moment.comments)
      ? moment.comments.map((comment) => ({
          id: comment.id,
          authorId: normalizeLegacyActorId(comment.authorId) || comment.authorId,
          content: comment.content,
          timestamp: comment.timestamp,
          replyToCommentId: comment.replyToCommentId,
          replyToAuthorId: normalizeLegacyActorId(comment.replyToAuthorId) || comment.replyToAuthorId,
          replyToAuthorName: comment.replyToAuthorName,
        }))
      : [],
  }));
}

export function loadPersistedMoments(fallback: PersistedMoment[]): PersistedMoment[] {
  const persisted = loadJson<PersistedMoment[] | null>(STORAGE_KEYS.moments, null);
  return hydrateMoments(persisted, fallback);
}

export function persistMoments(moments: PersistedMoment[]): void {
  saveJson(STORAGE_KEYS.moments, moments);
}

export function clearPersistedMoments(): void {
  removeStoredJson(STORAGE_KEYS.moments);
}

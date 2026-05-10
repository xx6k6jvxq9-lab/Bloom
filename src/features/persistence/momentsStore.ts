import { loadJsonRecord, removeJsonRecord, saveJsonRecord } from './browserJsonStore';
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
  translation?: string;
  images?: string[];
  imageCard?: {
    title: string;
    description: string;
    theme: 'polaroid' | 'film' | 'note' | 'poster';
    layout?: 'card' | 'described-photo' | 'inner-voice';
    overlayText?: string;
    translatedOverlayText?: string;
    frameCaptions?: string[];
    translatedFrameCaptions?: string[];
  };
  sourceChatMessage?: {
    characterId: string;
    timestamp: number;
  };
  timestamp: number;
  likes: number;
  likedBy?: string[];
  isLiked?: boolean;
  isCollected?: boolean;
  isPinned?: boolean;
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
    translation: typeof moment.translation === 'string' ? moment.translation : undefined,
    images: Array.isArray(moment.images) ? moment.images : undefined,
    imageCard: moment.imageCard && typeof moment.imageCard === 'object'
      ? {
          title: typeof moment.imageCard.title === 'string' ? moment.imageCard.title : '',
          description: typeof moment.imageCard.description === 'string' ? moment.imageCard.description : '',
          theme:
            moment.imageCard.theme === 'film'
            || moment.imageCard.theme === 'note'
            || moment.imageCard.theme === 'poster'
              ? moment.imageCard.theme
              : 'polaroid',
          layout:
            moment.imageCard.layout === 'described-photo'
            || moment.imageCard.layout === 'inner-voice'
            || moment.imageCard.layout === 'card'
              ? moment.imageCard.layout
              : undefined,
          overlayText: typeof moment.imageCard.overlayText === 'string' ? moment.imageCard.overlayText : undefined,
          translatedOverlayText:
            typeof moment.imageCard.translatedOverlayText === 'string'
              ? moment.imageCard.translatedOverlayText
              : undefined,
          frameCaptions: Array.isArray(moment.imageCard.frameCaptions)
            ? moment.imageCard.frameCaptions.filter((caption): caption is string => typeof caption === 'string' && caption.trim().length > 0)
            : undefined,
          translatedFrameCaptions: Array.isArray(moment.imageCard.translatedFrameCaptions)
            ? moment.imageCard.translatedFrameCaptions.filter((caption): caption is string => typeof caption === 'string' && caption.trim().length > 0)
            : undefined,
        }
      : undefined,
    sourceChatMessage:
      moment.sourceChatMessage
      && typeof moment.sourceChatMessage === 'object'
      && typeof moment.sourceChatMessage.characterId === 'string'
      && typeof moment.sourceChatMessage.timestamp === 'number'
        ? {
            characterId: moment.sourceChatMessage.characterId,
            timestamp: moment.sourceChatMessage.timestamp,
          }
        : undefined,
    timestamp: moment.timestamp,
    likes: moment.likes ?? 0,
    likedBy: Array.isArray(moment.likedBy)
      ? moment.likedBy.map(actorId => normalizeLegacyActorId(actorId) || actorId)
      : undefined,
    isLiked: moment.isLiked,
    isCollected: moment.isCollected,
    isPinned: moment.isPinned,
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

export async function loadPreferredMoments(fallback: PersistedMoment[]): Promise<PersistedMoment[]> {
  try {
    const persisted = await loadJsonRecord<PersistedMoment[]>(STORAGE_KEYS.moments);
    if (Array.isArray(persisted)) {
      return hydrateMoments(persisted, fallback);
    }
  } catch (error) {
    console.error('[momentsStore] Failed to load moments from IndexedDB', error);
  }

  return loadPersistedMoments(fallback);
}

export function persistMoments(moments: PersistedMoment[]): Promise<void> {
  saveJson(STORAGE_KEYS.moments, moments);

  return saveJsonRecord(STORAGE_KEYS.moments, moments).catch((error) => {
    console.error('[momentsStore] Failed to persist moments into IndexedDB', error);
  });
}

export function clearPersistedMoments(): void {
  removeStoredJson(STORAGE_KEYS.moments);
  void removeJsonRecord(STORAGE_KEYS.moments).catch((error) => {
    console.error('[momentsStore] Failed to remove moments from IndexedDB', error);
  });
}

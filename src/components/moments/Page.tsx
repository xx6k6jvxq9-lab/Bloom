import React, { useEffect, useRef, useState } from 'react';
import { Heart, Link2, MessageCircle, MoreHorizontal, Pin, Plus, RefreshCw, Star, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createCharacterDirectory } from '../../features/character-domain/useCharacterDirectory';
import { useAppKeyboard } from '../../features/app-shell/AppKeyboardContext';
import { useKeyboardSafeViewport } from '../../features/app-shell/useKeyboardSafeViewport';
import { InnerVoiceUnlockCard, parseInnerVoiceCardContent } from '../../features/chat-session/InnerVoiceUnlockCard';
import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import {
  runMomentCommentReplySequence,
  runMomentPublishCommentSequence,
} from '../../services/moments/commentOrchestrator';
import { resolveSceneTextApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import { extractImageUrls, showInAppConfirm } from '../../utils';
import { AppData, AppSettings, Character, FavoriteMessage, MomentComment, MomentItem, UserProfileExtended } from '../../types';

type UserProfile = UserProfileExtended;
type Comment = MomentComment;
type Moment = MomentItem;

function ResolvedMomentsAssetImage({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt?: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl);

  if (!src) return null;

  return <img src={src} alt={alt} className={className} />;
}

function getMomentImageCardStyle(theme: 'polaroid' | 'film' | 'note' | 'poster') {
  switch (theme) {
    case 'film':
      return 'bg-[linear-gradient(135deg,#1f2937,#0f172a_55%,#334155)] text-white';
    case 'note':
      return 'bg-[linear-gradient(135deg,#fff7d6,#ffe9a8)] text-zinc-900';
    case 'poster':
      return 'bg-[linear-gradient(135deg,#111827,#4b5563_45%,#d1d5db)] text-white';
    case 'polaroid':
    default:
      return 'bg-[linear-gradient(135deg,#fdf2f8,#fbcfe8_45%,#ffffff)] text-zinc-900';
  }
}

function shouldRenderMomentDescriptionPhoto(theme: 'polaroid' | 'film' | 'note' | 'poster') {
  return theme === 'film' || theme === 'poster';
}

function getMomentDescriptionPhotoStyle(theme: 'polaroid' | 'film' | 'note' | 'poster') {
  switch (theme) {
    case 'poster':
      return 'bg-[linear-gradient(180deg,#e5e7eb,#d4d4d8_52%,#f4f4f5)] text-zinc-700';
    case 'film':
    default:
      return 'bg-[linear-gradient(180deg,#eef2f6,#dbe4ee_56%,#f8fafc)] text-zinc-700';
  }
}

function getMomentDescriptionOverlayText(moment: Moment) {
  return moment.imageCard?.overlayText?.trim()
    || moment.imageCard?.description?.trim()
    || '一些安静的光影停在眼前';
}

function isInnerVoiceMomentCard(moment: Moment) {
  return moment.imageCard?.layout === 'inner-voice';
}

function getInnerVoiceMomentSourceText(moment: Moment) {
  const normalized = (moment.content || '').replace(/\r/g, '').trim();
  if (!normalized) {
    return [
      moment.imageCard?.overlayText || '',
      '',
      moment.imageCard?.description || '',
    ].filter(Boolean).join('\n');
  }

  const lines = normalized.split('\n');
  const firstLine = lines[0]?.trim() || '';
  const withoutMarker = /^["'「『]?\s*对方的心声\s*["'」』]?$/u.test(firstLine)
    ? lines.slice(1).join('\n').trim()
    : normalized;

  const blocks = withoutMarker.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length > 0 && blocks[0].includes(' / ')) {
    blocks[0] = blocks[0].split(' / ').map((item) => item.trim()).filter(Boolean).join('\n');
  }

  return blocks.join('\n\n').trim() || withoutMarker;
}

function getLinkedChatFavoriteState(appData: AppData, moment: Moment) {
  const source = moment.sourceChatMessage;
  if (!source) return undefined;
  const history = appData.chatHistory?.[source.characterId] || [];
  const linkedMessage = history.find((message) => message.timestamp === source.timestamp);
  return linkedMessage?.isFavorited;
}

export function MomentsApp({
  appData,
  setAppData,
  settings,
}: {
  appData: AppData;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  settings: AppSettings;
}) {
  const publishRef = useRef<HTMLDivElement | null>(null);
  const commentComposerRef = useRef<HTMLDivElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{
    momentId: string;
    commentId: string;
    authorId: string;
    authorName: string;
  } | null>(null);
  const [publishContent, setPublishContent] = useState('');
  const [publishImages, setPublishImages] = useState<string[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [activeInnerVoiceMomentId, setActiveInnerVoiceMomentId] = useState<string | null>(null);
  const { keyboardInset, keyboardVisible: appKeyboardVisible, manualKeyboardAvoidanceEnabled } = useAppKeyboard();
  const { keyboardVisible: publishKeyboardVisible } = useKeyboardSafeViewport({
    containerRef: publishRef,
    enabled: showPublish,
  });
  const { keyboardVisible: commentKeyboardVisible } = useKeyboardSafeViewport({
    containerRef: commentComposerRef,
    enabled: !!commentingOn,
  });

  const { userProfile, moments, characters } = appData;
  const forumConfig = resolveSceneTextApiConfig({
    settings,
    scene: 'forum',
  }).runtimeConfig;
  const { getCharacterById, getCharacterDisplayName } = createCharacterDirectory({ characters });
  const { resolvedUrl: resolvedMomentsBackgroundUrl } = useResolvedPersistentValue(appData.visualSettings?.momentsBackground);
  const isKnownMomentActorId = (actorId: string | undefined) =>
    !actorId || actorId === 'user' || !!getCharacterById(actorId);
  const resolveMomentAuthor = (authorId: string): UserProfile | Character | undefined => {
    if (authorId === 'user') {
      return userProfile;
    }

    return getCharacterById(authorId) || undefined;
  };

  const sanitizedMoments = (moments || [])
    .filter((moment) => isKnownMomentActorId(moment.authorId))
    .map((moment) => ({
      ...moment,
      likedBy: moment.likedBy?.filter((likerId) => isKnownMomentActorId(likerId)),
      likes: (moment.likedBy?.filter((likerId) => isKnownMomentActorId(likerId)).length) ?? moment.likes,
      comments: moment.comments.filter((comment) => isKnownMomentActorId(comment.authorId)).map((comment) => ({
        ...comment,
        replyToAuthorId: isKnownMomentActorId(comment.replyToAuthorId) ? comment.replyToAuthorId : undefined,
        replyToAuthorName: isKnownMomentActorId(comment.replyToAuthorId) ? comment.replyToAuthorName : undefined,
      })),
    }));
  const displayMoments = [...sanitizedMoments].sort((left, right) => {
    if (!!left.isPinned !== !!right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    return right.timestamp - left.timestamp;
  });
  const serializedMoments = JSON.stringify(moments || []);
  const serializedSanitizedMoments = JSON.stringify(sanitizedMoments);

  const missingMomentAuthorIds = (moments || [])
    .map((moment) => moment.authorId)
    .filter((authorId) => authorId !== 'user' && !getCharacterById(authorId));
  const missingMomentLikerIds = (moments || [])
    .flatMap((moment) => moment.likedBy || [])
    .filter((likerId) => likerId !== 'user' && !getCharacterById(likerId));

  useEffect(() => {
    if (missingMomentAuthorIds.length === 0) return;

    console.warn('[moments][missing-authors]', {
      missingAuthorIds: Array.from(new Set(missingMomentAuthorIds)),
      availableCharacterIds: characters.map((character) => character.id),
      momentsCount: moments?.length || 0,
    });
  }, [characters, missingMomentAuthorIds, moments]);

  useEffect(() => {
    if (missingMomentLikerIds.length === 0) return;

    console.warn('[moments][missing-likers]', {
      missingLikerIds: Array.from(new Set(missingMomentLikerIds)),
      availableCharacterIds: characters.map((character) => character.id),
      momentsCount: moments?.length || 0,
    });
  }, [characters, missingMomentLikerIds, moments]);

  useEffect(() => {
    if (serializedMoments === serializedSanitizedMoments) return;

    console.warn('[moments][cleanup-orphans]', {
      beforeCount: moments?.length || 0,
      afterCount: sanitizedMoments.length,
    });

    setAppData((prev) => ({
      ...prev,
      moments: sanitizedMoments,
    }));
  }, [moments, sanitizedMoments, serializedMoments, serializedSanitizedMoments, setAppData]);

  useEffect(() => {
    if (!commentingOn) {
      return;
    }

    requestAnimationFrame(() => {
      commentInputRef.current?.focus();
    });
  }, [commentingOn]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(async () => {
      setRefreshing(false);
    }, 1000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setPublishImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const appendLikeToMoment = (momentId: string, likerId: string) => {
    setAppData((prev) => ({
      ...prev,
      moments: prev.moments.map((m) => {
        if (m.id !== momentId) return m;

        const likedBy = m.likedBy || [];
        if (likedBy.includes(likerId)) {
          return m;
        }

        const nextLikedBy = [...likedBy, likerId];
        return {
          ...m,
          likedBy: nextLikedBy,
          likes: nextLikedBy.length,
        };
      }),
    }));
  };

  const appendCommentToMoment = (momentId: string, comment: Comment) => {
    setAppData((prev) => ({
      ...prev,
      moments: prev.moments.map((m) =>
        m.id === momentId ? { ...m, comments: [...m.comments, comment] } : m,
      ),
    }));
  };

  const toggleCommentComposer = (momentId: string, nextReplyTarget: typeof replyTarget) => {
    const isSameMoment = commentingOn === momentId;
    const currentTargetId = replyTarget?.momentId === momentId ? replyTarget.commentId : null;
    const nextTargetId = nextReplyTarget?.momentId === momentId ? nextReplyTarget.commentId : null;
    const isSameReplyTarget = currentTargetId === nextTargetId;

    if (isSameMoment && isSameReplyTarget) {
      setCommentingOn(null);
      setReplyTarget(null);
      setCommentText('');
      return;
    }

    setCommentingOn(momentId);
    setReplyTarget(nextReplyTarget);
  };

  const handlePublish = () => {
    const newMoment: Moment = {
      id: Date.now().toString(),
      authorId: 'user',
      content: publishContent,
      images: publishImages,
      timestamp: Date.now(),
      likes: 0,
      comments: [],
    };
    setAppData((prev) => ({ ...prev, moments: [newMoment, ...(prev.moments || [])] }));
    setShowPublish(false);
    setPublishContent('');
    setPublishImages([]);

    const activeConfig = forumConfig;
    const shuffledCharacters = [...characters].sort(() => Math.random() - 0.5);
    const replyCount = Math.min(
      shuffledCharacters.length,
      shuffledCharacters.length <= 2 ? shuffledCharacters.length : (Math.random() < 0.5 ? 2 : 3),
    );
    const replyCharacters = shuffledCharacters.slice(0, replyCount);
    const autoLikerIds = shuffledCharacters
      .filter((character) => {
        const isCommenter = replyCharacters.some((replyCharacter) => replyCharacter.id === character.id);
        const likeChance = isCommenter ? 0.75 : 0.4;
        return Math.random() < likeChance;
      })
      .map((character) => character.id)
      .slice(0, Math.min(shuffledCharacters.length, 3));

    if (autoLikerIds.length > 0) {
      void (async () => {
        for (const likerId of autoLikerIds) {
          await new Promise((resolve) => setTimeout(resolve, 150 + Math.floor(Math.random() * 500)));
          appendLikeToMoment(newMoment.id, likerId);
        }
      })();
    }

    if (activeConfig && replyCharacters.length > 0) {
      void runMomentPublishCommentSequence({
        activeConfig,
        moment: newMoment,
        characters,
        userName: userProfile.name,
        appendComment: (comment) => appendCommentToMoment(newMoment.id, comment),
      });
    }
  };

  const handleLike = (momentId: string) => {
    setAppData((prev) => ({
      ...prev,
      moments: prev.moments.map((m) => {
        if (m.id === momentId) {
          const userId = 'user';
          const likedBy = m.likedBy || [];
          const isLiked = likedBy.includes(userId);

          let newLikedBy;
          if (isLiked) {
            newLikedBy = likedBy.filter((id) => id !== userId);
          } else {
            newLikedBy = [...likedBy, userId];
          }

          return {
            ...m,
            likedBy: newLikedBy,
            likes: newLikedBy.length,
            isLiked: !isLiked,
          };
        }
        return m;
      }),
    }));
    setActiveMenuId(null);
  };

  const handleCollect = (momentId: string) => {
    setAppData((prev) => {
      const targetMoment = (prev.moments || []).find((moment) => moment.id === momentId);
      if (!targetMoment) {
        return prev;
      }

      const linkedFavoriteState = getLinkedChatFavoriteState(prev, targetMoment);
      const nextCollected = !(linkedFavoriteState ?? targetMoment.isCollected);
      const linkedSource = targetMoment.sourceChatMessage;

      let nextFavorites = prev.favorites || [];
      let nextChatHistory = prev.chatHistory;

      if (linkedSource) {
        const linkedCharacter = characters.find((character) => character.id === linkedSource.characterId);
        const sourceHistory = prev.chatHistory?.[linkedSource.characterId] || [];
        const linkedMessage = sourceHistory.find((message) => message.timestamp === linkedSource.timestamp);

        nextChatHistory = {
          ...prev.chatHistory,
          [linkedSource.characterId]: sourceHistory.map((message) => (
            message.timestamp === linkedSource.timestamp
              ? { ...message, isFavorited: nextCollected }
              : message
          )),
        };

        if (linkedMessage && linkedCharacter) {
          const exists = nextFavorites.some((favorite) => (
            favorite.timestamp === linkedMessage.timestamp && favorite.characterId === linkedCharacter.id
          ));

          if (nextCollected && !exists) {
            const nextFavorite: FavoriteMessage = {
              id: `${linkedCharacter.id}-${linkedMessage.timestamp}`,
              characterId: linkedCharacter.id,
              characterName: linkedCharacter.name,
              text: linkedMessage.text,
              timestamp: linkedMessage.timestamp,
              category: 'chat',
            };
            nextFavorites = [...nextFavorites, nextFavorite];
          } else if (!nextCollected && exists) {
            nextFavorites = nextFavorites.filter((favorite) => !(
              favorite.timestamp === linkedMessage.timestamp && favorite.characterId === linkedCharacter.id
            ));
          }
        }
      }

      return {
        ...prev,
        chatHistory: nextChatHistory,
        favorites: nextFavorites,
        moments: prev.moments.map((m) => (
          m.id === momentId ? { ...m, isCollected: nextCollected } : m
        )),
      };
    });
    setActiveMenuId(null);
  };

  const handleDelete = async (momentId: string) => {
    if (await showInAppConfirm('确定要删除这条动态吗？')) {
      setAppData((prev) => ({
        ...prev,
        moments: prev.moments.filter((m) => m.id !== momentId),
      }));
    }
    setActiveMenuId(null);
  };

  const handleTogglePin = (momentId: string) => {
    setAppData((prev) => ({
      ...prev,
      moments: prev.moments.map((moment) => (
        moment.id === momentId
          ? { ...moment, isPinned: !moment.isPinned }
          : moment
      )),
    }));
    setActiveMenuId(null);
  };

  const activeInnerVoiceMoment = (moments || []).find((moment) => moment.id === activeInnerVoiceMomentId) || null;
  const activeInnerVoiceAuthor = activeInnerVoiceMoment ? resolveMomentAuthor(activeInnerVoiceMoment.authorId) : null;
  const activeCommentMoment = commentingOn ? (moments || []).find((moment) => moment.id === commentingOn) || null : null;
  const activeReplyTarget = replyTarget?.momentId === commentingOn ? replyTarget : null;
  const handleComment = async (momentId: string) => {
    if (!commentText.trim()) return;
    const activeReplyTarget = replyTarget?.momentId === momentId ? replyTarget : null;

    const newComment: Comment = {
      id: Date.now().toString(),
      authorId: 'user',
      content: commentText,
      timestamp: Date.now(),
      replyToCommentId: activeReplyTarget?.commentId,
      replyToAuthorId: activeReplyTarget?.authorId,
      replyToAuthorName: activeReplyTarget?.authorName,
    };

    appendCommentToMoment(momentId, newComment);

    setCommentingOn(null);
    setCommentText('');
    setReplyTarget(null);

    const moment = moments.find((m) => m.id === momentId);
    if (!moment) return;

    if (forumConfig) {
      void runMomentCommentReplySequence({
        activeConfig: forumConfig,
        moment,
        characters,
        userName: userProfile.name,
        triggerComment: newComment,
        appendComment: (comment) => appendCommentToMoment(momentId, comment),
      });
    }
  };

  if (showPublish) {
    return (
      <div
        ref={publishRef}
        className="absolute inset-0 z-[100] flex min-h-0 flex-col bg-white/80 backdrop-blur-xl"
      >
        <div
          className="flex items-center justify-between border-b border-white/20 bg-white/50 px-4 pb-3 backdrop-blur-md"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}
        >
          <button onClick={() => setShowPublish(false)} className="text-zinc-600">取消</button>
          <button
            onClick={handlePublish}
            disabled={!publishContent.trim() && publishImages.length === 0}
            className="rounded-full border border-zinc-200 bg-zinc-100 px-4 py-1.5 font-medium text-zinc-600 shadow-sm transition-all hover:bg-zinc-200 disabled:border-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-300"
          >
            发表
          </button>
        </div>
        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] pt-4"
          style={{
            paddingBottom: manualKeyboardAvoidanceEnabled && publishKeyboardVisible && appKeyboardVisible && keyboardInset > 0
              ? `${keyboardInset + 16}px`
              : undefined,
            transition: 'padding-bottom 180ms ease',
          }}
        >
          <textarea
            value={publishContent}
            onChange={(e) => setPublishContent(e.target.value)}
            placeholder="这一刻的想法..."
            className="h-32 w-full resize-none bg-transparent text-[15px] outline-none placeholder-zinc-400"
          />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {publishImages.map((img, i) => (
              <div key={i} className="group relative aspect-square">
                <ResolvedMomentsAssetImage value={img} className="h-full w-full rounded-xl object-cover shadow-sm" />
                <button
                  onClick={() => setPublishImages(publishImages.filter((_, idx) => idx !== i))}
                  className="absolute -right-2 -top-2 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {publishImages.length < 9 && (
              <div className="flex flex-col gap-2">
                <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-100/50 text-zinc-400 transition-colors hover:bg-zinc-100">
                  <Plus size={24} />
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                <button
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 transition-colors hover:text-zinc-900"
                >
                  <Link2 size={10} />
                  添加链接
                </button>
              </div>
            )}
          </div>

          {showUrlInput && (
            <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500">添加图片链接</span>
                <button onClick={() => setShowUrlInput(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="支持输入图片链接、Markdown图片格式、HTML img标签"
                className="h-24 w-full resize-none rounded-lg border border-zinc-200 bg-white p-2 text-xs outline-none transition-all focus:border-zinc-900/30"
              />
              <button
                onClick={() => {
                  const urls = extractImageUrls(urlInput);
                  if (urls.length > 0) {
                    setPublishImages((prev) => [...prev, ...urls].slice(0, 9));
                    setUrlInput('');
                    setShowUrlInput(false);
                  }
                }}
                className="mt-2 w-full rounded-lg border border-[#d9e6f7] bg-[#eef5ff] py-1.5 text-xs font-bold text-[#4b6788]"
              >
                添加这些链接
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0">
      <div
        className="h-full overflow-y-auto pb-[calc(var(--app-safe-area-bottom-ui,0px)+4rem)]"
        style={{
          backgroundImage: resolvedMomentsBackgroundUrl ? `url(${resolvedMomentsBackgroundUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: resolvedMomentsBackgroundUrl ? 'transparent' : '#fafafa',
          paddingBottom: commentingOn
            ? 'calc(var(--app-safe-area-bottom-ui, 0px) + 10rem)'
            : undefined,
        }}
      >
      <div className="relative pb-4">
        <div className="relative h-40 overflow-hidden">
          {!resolvedMomentsBackgroundUrl && <div className="absolute inset-0 bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-600" />}
          <div
            className="absolute right-4 z-10 flex gap-3"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 52px)' }}
          >
            <button
              onClick={handleRefresh}
              className="rounded-full border border-white/20 bg-white/20 p-2 text-zinc-800 shadow-sm backdrop-blur-md transition-all hover:bg-white/30"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowPublish(true)}
              className="rounded-full border border-white/20 bg-white/20 p-2 text-zinc-800 shadow-sm backdrop-blur-md transition-all hover:bg-white/30"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div className="relative -mt-10 flex items-end justify-start gap-3 px-5">
          <div className="relative flex-1 min-w-0 flex-col gap-1">
            <div className="absolute inset-0 translate-y-1 rounded-2xl bg-black/5 blur-sm" />
            <ResolvedMomentsAssetImage value={userProfile.avatar} className="relative z-10 h-20 w-20 rounded-2xl border-[3px] border-white bg-white object-cover shadow-md" />
          </div>
          <div className="mb-1.5 flex-1 text-left">
            <div className="flex items-center justify-start gap-2">
              <h2 className="text-[20px] font-bold text-zinc-900">{userProfile.name}</h2>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                {userProfile.mood || '在线'}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-zinc-500">{userProfile.bio || '这个人很懒，什么都没写~'}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 bg-transparent px-0 pt-4">
        {displayMoments.map((moment) => {
          const author = resolveMomentAuthor(moment.authorId);
          if (!author) return null;
          const effectiveCollected = getLinkedChatFavoriteState(appData, moment) ?? !!moment.isCollected;

          return (
            <div
              key={moment.id}
              className="mx-4 flex gap-3 border border-white/50 p-4 shadow-sm backdrop-blur-md transition-colors hover:bg-white"
              style={{
                borderRadius: appData.visualSettings?.dynamics?.cardBorderRadius ?? 24,
                backgroundColor: `rgba(255, 255, 255, ${appData.visualSettings?.dynamics?.cardOpacity ?? 0.9})`,
              }}
            >
              <ResolvedMomentsAssetImage value={author.avatar} className="h-10 w-10 shrink-0 rounded-full border border-zinc-100 object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-bold text-zinc-900">{author.name}</h3>
                      {moment.isPinned && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#D8D8DE] bg-[#F2F2F7] px-2 py-0.5 text-[10px] font-medium text-[#6B7280] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                          <Pin size={10} className="text-[#7B8190]" />
                          置顶
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[12px] text-zinc-400">
                    {new Date(moment.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {!isInnerVoiceMomentCard(moment) && (
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800">{moment.content}</p>
                )}

                {moment.imageCard && (
                  isInnerVoiceMomentCard(moment) ? (() => {
                    const sharedCard = parseInnerVoiceCardContent(
                      getInnerVoiceMomentSourceText(moment),
                    );
                    const titleLines = sharedCard.headline.split('\n').filter(Boolean).slice(0, 3);
                    const previewParagraphs = sharedCard.body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean).slice(0, 2);

                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveInnerVoiceMomentId(moment.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setActiveInnerVoiceMomentId(moment.id);
                          }
                        }}
                        className="mt-3 overflow-hidden rounded-[22px] border border-[rgba(160,140,120,0.12)]"
                        style={{
                          backgroundColor: '#FAF8F4',
                          backgroundImage: 'repeating-linear-gradient(transparent 31px, rgba(160,140,120,0.055) 31px, rgba(160,140,120,0.055) 32px)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-[rgba(160,140,120,0.1)] px-4 py-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#FEF0F2] text-[#C87880]">
                              <Heart size={14} fill="currentColor" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-semibold text-[#1E1610]" style={{ fontFamily: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif' }}>对方的心声</div>
                              <div className="mt-0.5 text-[10px] text-[#B0A090]">分享自心声卡片</div>
                            </div>
                          </div>
                          <div className="rounded-full border border-[rgba(200,120,128,0.18)] bg-[#FEF0F2] px-2.5 py-1 text-[10px] font-medium text-[#C87880]">心声</div>
                        </div>

                        <div className="px-5 pb-5 pt-5">
                          <div className="space-y-0.5">
                            {titleLines.map((line, lineIndex) => (
                              <div
                                key={`${line}-${lineIndex}`}
                                className={`text-[18px] font-semibold leading-[1.55] ${lineIndex === titleLines.length - 1 ? 'text-[#C87880]' : 'text-[#1E1610]'}`}
                                style={{ fontFamily: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif' }}
                              >
                                {line}
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 space-y-3">
                            {previewParagraphs.map((paragraph, paragraphIndex) => (
                              <p
                                key={`${paragraph}-${paragraphIndex}`}
                                className="whitespace-pre-wrap break-words text-[13px] leading-[1.95] text-[#7A6A5A]"
                                style={{ fontFamily: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif' }}
                              >
                                {paragraph.trim()}
                              </p>
                            ))}
                          </div>

                          {sharedCard.ps ? (
                            <p
                              className="mt-3 text-[12px] italic text-[#C0B0A0]"
                              style={{ fontFamily: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif' }}
                            >
                              P.S. {sharedCard.ps}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between border-t border-[rgba(160,140,120,0.1)] px-5 pb-4 pt-3 text-[11px] text-[#B0A090]">
                          <span style={{ fontFamily: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif' }}>- {author.name} · {new Date(moment.timestamp).toLocaleDateString([], { month: '2-digit', day: '2-digit' })}</span>
                          <span>点击展开查看</span>
                        </div>
                      </div>
                    );
                  })() : ((moment.imageCard.layout === 'described-photo') || shouldRenderMomentDescriptionPhoto(moment.imageCard.theme)) ? (
                    <div className="mt-3 overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white p-2 shadow-sm">
                      <div className={`relative aspect-[4/5] overflow-hidden rounded-[18px] border border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ${getMomentDescriptionPhotoStyle(moment.imageCard.theme)}`}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.42),transparent_46%),linear-gradient(180deg,transparent,rgba(255,255,255,0.2))]" />
                        <div className="absolute left-3 top-3 rounded-full bg-black/8 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-zinc-600 backdrop-blur-sm">
                          图片描述
                        </div>
                        <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-[22px] border border-white/65 bg-white/55 px-5 py-6 text-center shadow-[0_16px_32px_rgba(148,163,184,0.18)] backdrop-blur-md">
                          <p className="text-[19px] font-medium leading-[1.7] tracking-[0.04em] text-zinc-700">
                            {getMomentDescriptionOverlayText(moment)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`mt-3 overflow-hidden rounded-[22px] border border-zinc-200/70 p-3 shadow-sm ${getMomentImageCardStyle(moment.imageCard.theme)}`}>
                      <div className="mb-3 rounded-[18px] border border-white/30 bg-white/10 px-4 py-10 text-center backdrop-blur-sm">
                        <p className="text-[18px] font-semibold tracking-[0.08em]">{moment.imageCard.title}</p>
                      </div>
                      <p className="text-[13px] leading-relaxed opacity-90">{moment.imageCard.description}</p>
                    </div>
                  )
                )}

                {moment.images && moment.images.length > 0 && (
                  <div className={`mt-3 grid gap-1.5 ${moment.images.length === 1 ? 'grid-cols-1 w-2/3' : 'grid-cols-3'}`}>
                    {moment.images.map((img, i) => (
                      <ResolvedMomentsAssetImage key={i} value={img} className="aspect-square w-full rounded-xl border border-zinc-100 object-cover" />
                    ))}
                  </div>
                )}

                <div className="relative mt-2 flex h-8 items-center justify-end">
                  <button
                    onClick={() => setActiveMenuId(activeMenuId === moment.id ? null : moment.id)}
                    className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-blue-50 hover:text-blue-500"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  <AnimatePresence>
                    {activeMenuId === moment.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, x: 10 }}
                        className="absolute right-8 top-0 z-20 flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white/95 px-1 py-1 shadow-lg backdrop-blur-md"
                      >
                        <button
                          onClick={() => handleLike(moment.id)}
                          className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] text-zinc-800 transition-colors hover:bg-zinc-100"
                        >
                          <Heart size={14} className={(moment.likedBy?.includes('user') || moment.isLiked) ? 'fill-red-500 text-red-500' : ''} />
                          {(moment.likedBy?.includes('user') || moment.isLiked) ? '取消' : '赞'}
                        </button>
                        <button
                          onClick={() => {
                            toggleCommentComposer(moment.id, null);
                            setActiveMenuId(null);
                          }}
                          className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] text-zinc-800 transition-colors hover:bg-zinc-100"
                        >
                          <MessageCircle size={14} />
                          评论
                        </button>
                        <button
                          onClick={() => handleCollect(moment.id)}
                          className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] text-zinc-800 transition-colors hover:bg-zinc-100"
                        >
                          <Star size={14} className={effectiveCollected ? 'fill-yellow-400 text-yellow-400' : ''} />
                          {effectiveCollected ? '已收藏' : '收藏'}
                        </button>
                        <button
                          onClick={() => handleTogglePin(moment.id)}
                          className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] transition-colors ${
                            moment.isPinned
                              ? 'bg-[#F2F2F7] text-[#5F6572] hover:bg-[#EAEAEE]'
                              : 'text-zinc-800 hover:bg-zinc-100'
                          }`}
                        >
                          <Pin size={14} className={moment.isPinned ? 'fill-[#C7CCD6] text-[#7B8190]' : 'text-zinc-500'} />
                          {moment.isPinned ? '取消置顶' : '置顶'}
                        </button>
                        <button
                            onClick={() => handleDelete(moment.id)}
                            className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] text-zinc-800 transition-colors hover:bg-zinc-100"
                          >
                            <Trash2 size={14} />
                            删除
                          </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {(moment.likes > 0 || moment.comments.length > 0) && (
                  <div className="mt-2 rounded-xl bg-zinc-50 p-3">
                    {moment.likes > 0 && (
                      <div className="mb-1.5 flex items-center gap-1.5 border-b border-zinc-200/50 pb-1.5 text-[13px] font-medium text-zinc-600">
                        <Heart size={12} className="fill-red-500 text-red-500" />
                        {(() => {
                          if (moment.likedBy && moment.likedBy.length > 0) {
                            const names = moment.likedBy.map((id) => {
                              if (id === 'user') return userProfile.name;
                              return getCharacterDisplayName(id);
                            }).filter((name): name is string => Boolean(name));

                            if (names.length === 0) return `${moment.likes} 人觉得很赞`;
                            if (names.length <= 3) return names.join('、');
                            return `${names.slice(0, 3).join('、')} 等 ${names.length} 人`;
                          }
                          return `${moment.likes} 人觉得很赞`;
                        })()}
                      </div>
                    )}
                    {moment.comments.map((comment) => {
                      const commentAuthor = resolveMomentAuthor(comment.authorId);
                      if (!commentAuthor) return null;
                      return (
                        <button
                          key={comment.id}
                          type="button"
                          onClick={() => {
                            toggleCommentComposer(moment.id, {
                              momentId: moment.id,
                              commentId: comment.id,
                              authorId: comment.authorId,
                              authorName: commentAuthor.name,
                            });
                          }}
                          className="mt-1 block w-full rounded-lg px-1 py-0.5 text-left text-[13px] leading-relaxed transition-colors hover:bg-zinc-100/80"
                        >
                          <span className="font-bold text-zinc-900">{commentAuthor.name}</span>
                          {comment.replyToAuthorName ? (
                            <>
                              <span className="mx-1 text-zinc-500">回复</span>
                              <span className="font-bold text-zinc-700">{comment.replyToAuthorName}</span>
                              <span className="text-zinc-500">：</span>
                            </>
                          ) : (
                            <span className="mx-1 text-zinc-500">·</span>
                          )}
                          <span className="text-zinc-700">{comment.content}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

              </div>
            </div>
          );
        })}

        <div className="h-4" />
      </div>
      </div>

      {commentingOn && activeCommentMoment && (
        <div
          ref={commentComposerRef}
          className="absolute inset-0 z-[60] flex flex-col pointer-events-none"
        >
          <div
            className="mt-auto w-full pointer-events-auto border-t border-zinc-200 bg-white/96 px-4 pb-[calc(var(--app-safe-area-bottom-ui,0px)+12px)] pt-3 backdrop-blur-xl shadow-[0_-12px_28px_rgba(15,23,42,0.08)]"
            style={{
              transform: manualKeyboardAvoidanceEnabled && commentKeyboardVisible && appKeyboardVisible && keyboardInset > 0
                ? `translateY(-${keyboardInset}px)`
                : 'translateY(0)',
              transition: 'transform 180ms ease',
            }}
          >
            <div className="mx-auto flex max-w-[560px] flex-col gap-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="min-w-0 text-[12px] text-zinc-500">
                {activeReplyTarget
                  ? `回复 ${activeReplyTarget.authorName}`
                  : `评论 ${resolveMomentAuthor(activeCommentMoment.authorId)?.name || '这条动态'}`}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCommentingOn(null);
                  setReplyTarget(null);
                  setCommentText('');
                }}
                className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="关闭评论输入"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={commentInputRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={activeReplyTarget ? `回复 ${activeReplyTarget.authorName}` : '发布你的回复'}
                className="flex-1 rounded-full border border-transparent bg-zinc-100 px-4 py-3 text-[14px] outline-none transition-all focus:border-zinc-900/20 focus:bg-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleComment(commentingOn);
                  }
                }}
              />
              <button
                onClick={() => void handleComment(commentingOn)}
                className="shrink-0 whitespace-nowrap rounded-full border border-zinc-900 bg-white px-4 py-2 text-[13px] font-bold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-900 hover:text-white"
              >
                回复
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {activeInnerVoiceMoment && activeInnerVoiceAuthor && (
        (() => {
          const expandedCard = parseInnerVoiceCardContent(
            getInnerVoiceMomentSourceText(activeInnerVoiceMoment),
          );

          return (
            <>
              <div
                className="fixed inset-0 z-[40] bg-white/42 backdrop-blur-[6px]"
                onClick={() => setActiveInnerVoiceMomentId(null)}
              />
              <div className="fixed inset-0 z-[41] flex items-center justify-center px-4 py-8">
                <div className="relative max-h-full overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setActiveInnerVoiceMomentId(null)}
                    className="absolute right-2 top-3 z-10 flex h-7 w-7 items-center justify-center text-zinc-500 active:scale-95"
                    aria-label="关闭心声动态卡片"
                  >
                    <X size={16} />
                  </button>
                  <InnerVoiceUnlockCard
                    showShareButton={false}
                    characterName={activeInnerVoiceAuthor.name}
                    date={new Date(activeInnerVoiceMoment.timestamp).toLocaleDateString([], {
                      month: '2-digit',
                      day: '2-digit',
                    })}
                    headline={expandedCard.headline}
                    body={expandedCard.body}
                    ps={expandedCard.ps}
                    isSaved={(activeInnerVoiceMoment ? (getLinkedChatFavoriteState(appData, activeInnerVoiceMoment) ?? !!activeInnerVoiceMoment.isCollected) : false)}
                    onSave={() => handleCollect(activeInnerVoiceMoment.id)}
                    onShare={() => setActiveInnerVoiceMomentId(null)}
                  />
                </div>
              </div>
            </>
          );
        })()
      )}
    </div>
  );
}

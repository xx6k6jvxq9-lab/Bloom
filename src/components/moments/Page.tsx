import React, { useEffect, useState } from 'react';
import { Heart, Link2, MessageCircle, MoreHorizontal, Plus, RefreshCw, Star, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createCharacterDirectory } from '../../features/character-domain/useCharacterDirectory';
import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import {
  buildFallbackMomentCommentReply,
  generateMomentAutoComment,
  generateMomentCommentReply,
} from '../../services/moments/generators';
import { getRecentMomentReplyContext } from '../../services/moments/triggers';
import { extractImageUrls, showInAppConfirm } from '../../utils';
import { AppData, AppSettings, Character, MomentComment, MomentItem, UserProfileExtended } from '../../types';

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

export function MomentsApp({
  appData,
  setAppData,
  settings,
}: {
  appData: AppData;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  settings: AppSettings;
}) {
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

  const { userProfile, moments, characters } = appData;
  const { getCharacterById, getCharacterDisplayName } = createCharacterDirectory({ characters });
  const { resolvedUrl: resolvedMomentsBackgroundUrl } = useResolvedPersistentValue(appData.visualSettings?.momentsBackground);
  const isKnownMomentActorId = (actorId: string | undefined) =>
    !actorId || actorId === 'user' || !!getCharacterById(actorId);
  const resolveMomentAuthor = (authorId: string): UserProfile | Character | undefined => {
    if (authorId === 'user') {
      return userProfile;
    }

    return getCharacterById(authorId);
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

    const activeConfig = settings.configs.find((c) => c.id === settings.activeConfigId) || settings.configs[0];
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

    if (replyCharacters.length > 0) {
      const generatedComments: Comment[] = [];

      void (async () => {
        for (const replyCharacter of replyCharacters) {
          try {
            const generatedCommentText = await generateMomentAutoComment({
              activeConfig,
              replyCharacter,
              moment: {
                ...newMoment,
                comments: generatedComments,
              },
              characters,
              userName: userProfile.name,
            });

            const normalizedContent = generatedCommentText.trim();
            if (!normalizedContent) continue;

            const aiComment: Comment = {
              id: `${Date.now()}_${replyCharacter.id}_auto`,
              authorId: replyCharacter.id,
              content: normalizedContent,
              timestamp: Date.now(),
            };

            generatedComments.push(aiComment);
            appendCommentToMoment(newMoment.id, aiComment);

            await new Promise((resolve) => setTimeout(resolve, 250 + Math.floor(Math.random() * 500)));
          } catch (err) {
            console.error('AI auto moment comment failed', err);
          }
        }
      })();
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
    setAppData((prev) => ({
      ...prev,
      moments: prev.moments.map((m) => {
        if (m.id === momentId) {
          const isCollected = !m.isCollected;
          return { ...m, isCollected };
        }
        return m;
      }),
    }));
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

    let replyCharacter: Character | undefined;
    if (moment.authorId !== 'user') {
      replyCharacter = getCharacterById(moment.authorId) || undefined;
    } else if (characters.length > 0) {
      replyCharacter = characters[Math.floor(Math.random() * characters.length)];
    }

    if (replyCharacter) {
      const recentCommentReplies = getRecentMomentReplyContext(moment, characters, userProfile.name);

      const appendReplyComment = (content: string) => {
        const normalizedContent = content.trim();
        if (!normalizedContent) return;

        const aiComment: Comment = {
          id: `${Date.now()}_ai`,
          authorId: replyCharacter.id,
          content: normalizedContent,
          timestamp: Date.now(),
          replyToCommentId: newComment.id,
          replyToAuthorId: newComment.authorId,
          replyToAuthorName: userProfile.name,
        };
        appendCommentToMoment(momentId, aiComment);
      };

      try {
        const activeConfig = settings.configs.find((c) => c.id === settings.activeConfigId) || settings.configs[0];
        const replyText = await generateMomentCommentReply({
          activeConfig,
          replyCharacter,
          moment,
          userComment: newComment.content,
          characters,
          userName: userProfile.name,
        });
        appendReplyComment(replyText);
      } catch (err) {
        console.error('AI reply failed', err);
        appendReplyComment(buildFallbackMomentCommentReply(replyCharacter, moment, newComment.content, recentCommentReplies));
      }
    }
  };

  if (showPublish) {
    return (
      <div className="absolute inset-0 z-[100] flex flex-col bg-white/80 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/20 bg-white/50 px-4 py-3 backdrop-blur-md">
          <button onClick={() => setShowPublish(false)} className="text-zinc-600">取消</button>
          <button
            onClick={handlePublish}
            disabled={!publishContent.trim() && publishImages.length === 0}
            className="rounded-full bg-zinc-900 px-4 py-1.5 font-medium text-white shadow-lg shadow-black/20 transition-all hover:bg-black disabled:opacity-50"
          >
            发表
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
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
                className="mt-2 w-full rounded-lg bg-zinc-900 py-1.5 text-xs font-bold text-white"
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
    <div
      className="relative flex-1 overflow-y-auto pb-24"
      style={{
        backgroundImage: resolvedMomentsBackgroundUrl ? `url(${resolvedMomentsBackgroundUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: resolvedMomentsBackgroundUrl ? 'transparent' : '#fafafa',
      }}
    >
      <div className="relative pb-4">
        <div className="relative h-40 overflow-hidden">
          {!resolvedMomentsBackgroundUrl && <div className="absolute inset-0 bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-600" />}
          <div className="absolute right-4 top-4 z-10 flex gap-3">
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
        {(moments || []).map((moment) => {
          const author = resolveMomentAuthor(moment.authorId);
          if (!author) return null;

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
                <div className="flex items-start justify-between">
                  <h3 className="text-[15px] font-bold text-zinc-900">{author.name}</h3>
                  <span className="text-[12px] text-zinc-400">
                    {new Date(moment.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800">{moment.content}</p>

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
                            setCommentingOn(moment.id);
                            setReplyTarget(null);
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
                          <Star size={14} className={moment.isCollected ? 'fill-yellow-400 text-yellow-400' : ''} />
                          {moment.isCollected ? '已收藏' : '收藏'}
                        </button>
                        {moment.authorId === 'user' && (
                          <button
                            onClick={() => handleDelete(moment.id)}
                            className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] text-zinc-800 transition-colors hover:bg-zinc-100"
                          >
                            <Trash2 size={14} />
                            删除
                          </button>
                        )}
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
                            setCommentingOn(moment.id);
                            setReplyTarget({
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

                {commentingOn === moment.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={replyTarget?.momentId === moment.id ? `回复 ${replyTarget.authorName}` : '发布你的回复'}
                      className="flex-1 rounded-full border border-transparent bg-zinc-100 px-4 py-2 text-[13px] outline-none transition-all focus:border-zinc-900/30 focus:bg-white"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleComment(moment.id);
                      }}
                    />
                    <button
                      onClick={() => handleComment(moment.id)}
                      className="shrink-0 whitespace-nowrap rounded-full bg-zinc-900 px-3 py-1.5 text-[12px] font-bold text-white shadow-sm"
                    >
                      回复
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="h-4" />
      </div>
    </div>
  );
}

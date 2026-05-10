import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, Link2, MessageCircle, MoreHorizontal, Pin, Plus, RefreshCw, Star, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createCharacterDirectory } from '../../features/character-domain/useCharacterDirectory';
import { focusTextEntryElement } from '../../features/app-shell/keyboardUtils';
import { useKeyboardSafeViewport } from '../../features/app-shell/useKeyboardSafeViewport';
import { InnerVoiceUnlockCard, parseInnerVoiceCardContent } from '../../features/chat-session/InnerVoiceUnlockCard';
import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import {
  runMomentCommentReplySequence,
  runMomentPublishCommentSequence,
} from '../../services/moments/commentOrchestrator';
import {
  type AutoMomentSchedulerTrigger,
} from '../../services/moments/autoScheduler';
import { resolveSceneTextApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import {
  publishGeneratedCharacterMomentToFeed,
  runAutoMomentSchedulerPass,
} from '../../services/moments/autoRuntime';
import { extractImageUrls, showInAppConfirm } from '../../utils';
import { AppData, AppSettings, Character, FavoriteMessage, MomentComment, MomentItem, UserProfileExtended } from '../../types';

type UserProfile = UserProfileExtended;
type Comment = MomentComment;
type Moment = MomentItem;
type FloatingMenuPosition = { top: number; left: number; maxHeight: number };

const CHAT_RUNTIME_BUSY_COUNT_KEY = '__bloomChatRuntimeBusyCount';
const CHAT_RUNTIME_LAST_ACTIVE_AT_KEY = '__bloomChatRuntimeLastActiveAt';
const CHAT_RUNTIME_IDLE_GRACE_MS = 4000;
const MOMENT_AI_RETRY_DELAY_MS = 1800;
const PROFILE_NAME_COLOR_PRESETS = [
  '#18181b',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#db2777',
];

function isChatRuntimeBusyNow() {
  const scope = globalThis as typeof globalThis & Record<string, unknown>;
  const activeCount = typeof scope[CHAT_RUNTIME_BUSY_COUNT_KEY] === 'number'
    ? Math.max(0, scope[CHAT_RUNTIME_BUSY_COUNT_KEY] as number)
    : 0;
  if (activeCount > 0) {
    return true;
  }

  const lastActiveAt = typeof scope[CHAT_RUNTIME_LAST_ACTIVE_AT_KEY] === 'number'
    ? scope[CHAT_RUNTIME_LAST_ACTIVE_AT_KEY] as number
    : 0;
  return lastActiveAt > 0 && Date.now() - lastActiveAt < CHAT_RUNTIME_IDLE_GRACE_MS;
}

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
  const translatedOverlayText = moment.imageCard?.translatedOverlayText?.trim();
  if (translatedOverlayText) {
    return translatedOverlayText;
  }

  const overlayText = moment.imageCard?.overlayText?.trim() || '';
  const description = moment.imageCard?.description?.trim() || '';
  const looksLikeEnglishOnly = /[A-Za-z]/.test(overlayText) && !/[\u4e00-\u9fff]/u.test(overlayText);

  return (looksLikeEnglishOnly ? description : overlayText)
    || description
    || overlayText
    || '一些安静的光影停在眼前';
}

function getMomentImageFrameCaptions(moment: Moment) {
  const translatedFrameCaptions = (moment.imageCard?.translatedFrameCaptions || [])
    .map((caption) => caption.trim())
    .filter(Boolean)
    .slice(0, 9);

  if (translatedFrameCaptions.length > 0) {
    return translatedFrameCaptions;
  }

  return (moment.imageCard?.frameCaptions || [])
    .map((caption) => caption.trim())
    .filter(Boolean)
    .slice(0, 9);
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

function buildOptionalTextStyle(
  color?: string | null,
  fontFamily?: string | null,
): React.CSSProperties | undefined {
  const nextStyle: React.CSSProperties = {};
  const normalizedColor = color?.trim();
  const normalizedFontFamily = fontFamily?.trim();

  if (normalizedColor) {
    nextStyle.color = normalizedColor;
  }

  if (normalizedFontFamily) {
    nextStyle.fontFamily = normalizedFontFamily;
  }

  return Object.keys(nextStyle).length > 0 ? nextStyle : undefined;
}

function resolveColorPickerValue(value: string | null | undefined, fallback: string) {
  const normalizedValue = value?.trim() || '';
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalizedValue) ? normalizedValue : fallback;
}

function buildFloatingMenuPosition(
  rootRect: DOMRect,
  anchorRect: DOMRect,
  menuWidth: number,
): FloatingMenuPosition {
  const viewportPadding = 12;
  const nextTop = anchorRect.bottom - rootRect.top + 8;
  const nextLeft = Math.min(
    Math.max(viewportPadding, anchorRect.left - rootRect.left),
    Math.max(viewportPadding, rootRect.width - menuWidth - viewportPadding),
  );
  const nextMaxHeight = Math.max(180, Math.min(rootRect.height - nextTop - viewportPadding, 320));

  return {
    top: nextTop,
    left: nextLeft,
    maxHeight: nextMaxHeight,
  };
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
  const momentsRootRef = useRef<HTMLDivElement | null>(null);
  const publishRef = useRef<HTMLDivElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const nameButtonRef = useRef<HTMLButtonElement | null>(null);
  const moodButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingMomentAiTasksRef = useRef<Array<() => Promise<void>>>([]);
  const momentAiRunningRef = useRef(false);
  const momentAiDrainTimerRef = useRef<number | null>(null);
  const appDataRef = useRef(appData);
  const [showPublish, setShowPublish] = useState(false);
  const [showNameColorMenu, setShowNameColorMenu] = useState(false);
  const [showMoodMenu, setShowMoodMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [customProfileNameColor, setCustomProfileNameColor] = useState('');
  const [customMoodInput, setCustomMoodInput] = useState('');
  const [nameColorMenuPosition, setNameColorMenuPosition] = useState<FloatingMenuPosition | null>(null);
  const [moodMenuPosition, setMoodMenuPosition] = useState<FloatingMenuPosition | null>(null);
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
  const [activeMomentVisualPreview, setActiveMomentVisualPreview] = useState<{
    captions?: string[];
    singleText?: string;
  } | null>(null);
  useKeyboardSafeViewport({
    containerRef: publishRef,
    enabled: showPublish,
    clampViewportHeight: true,
  });
  useKeyboardSafeViewport({
    containerRef: momentsRootRef,
    enabled: !!commentingOn,
    clampViewportHeight: true,
  });

  const { userProfile, moments, characters } = appData;
  const moodOptions = Array.from(new Set([
    '(^_^)', '(*^▽^*)', '(≧▽≦)', '(⌒▽⌒)', '(๑˃̵ᴗ˂̵)ﻭ', '(｡•̀ᴗ-)✧', '(´｡• ᵕ •｡)', '(=^･ω･^=)',
    '( ˘⌣˘)♡', '(๑•̀ㅂ•́)و', '(´▽ʃ♡ƪ)', '(￣▽￣)', '(•̀ω•́)✧', '(｡◕‿◕｡)', '(ง •̀_•́)ง', '(๑• . •๑)',
    '(╯▽╰ )', '(｡･ω･｡)', '(´∀)', '(＾▽＾)', '(≧ω≦)', '(●ˇ∀ˇ●)', '(๑¯ω¯๑)', '(o^ ^o)',
    '(¬‿¬)', '(￣︶￣)', '(๑˘︶˘๑)', '(>ω<)', '(≧∇≦)ﾉ', '(´-ω-)', '(｡•́︿•̀｡)', '(╥﹏╥)',
    '(╯︵╰,)', '(；′⌒)', '(っ °Д °;)っ', '(⊙_⊙;)', '(•ˋ _ ˊ•)', '(╯°□°）╯', '(￣o￣) . z Z',
    '(－ω－) zzZ', '(｡•́ωก̀｡)', '(๑•﹏•)', '(╯︿╰)', '(っ- ‸ -ς)', '(＞﹏＜)', '(｡ŏ﹏ŏ)', '(´；ω；)',
  ]));
  const defaultMood = '(^_^)';
  const forumConfig = resolveSceneTextApiConfig({
    settings,
    scene: 'forum',
  }).runtimeConfig;

  useEffect(() => {
    appDataRef.current = appData;
  }, [appData]);
  const { getCharacterById, getCharacterDisplayName } = createCharacterDirectory({ characters });
  const { resolvedUrl: resolvedMomentsBackgroundUrl } = useResolvedPersistentValue(appData.visualSettings?.momentsBackground);
  const dynamicsBackgroundMode = appData.visualSettings?.dynamics?.backgroundMode ?? 'fullscreen';
  const useFullScreenMomentsBackground = Boolean(resolvedMomentsBackgroundUrl) && dynamicsBackgroundMode === 'fullscreen';
  const useHeaderMomentsBackground = Boolean(resolvedMomentsBackgroundUrl) && dynamicsBackgroundMode === 'header';
  const profileNameTextStyle = buildOptionalTextStyle(
    appData.visualSettings?.dynamics?.profileNameColor,
    appData.visualSettings?.dynamics?.profileNameFontFamily,
  );
  const profileMoodTextStyle = buildOptionalTextStyle(
    appData.visualSettings?.dynamics?.profileMoodColor,
    appData.visualSettings?.dynamics?.profileMoodFontFamily,
  );
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
      focusTextEntryElement(commentInputRef.current);
      commentInputRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }, [commentingOn]);

  useEffect(() => {
    setCustomMoodInput(userProfile.mood || '');
  }, [userProfile.mood]);

  useEffect(() => {
    setCustomProfileNameColor(
      appData.visualSettings?.dynamics?.profileNameColor
      || appData.visualSettings?.themeTypography?.textColor
      || '#18181b',
    );
  }, [
    appData.visualSettings?.dynamics?.profileNameColor,
    appData.visualSettings?.themeTypography?.textColor,
  ]);

  useEffect(() => {
    setBioDraft(userProfile.bio || '');
  }, [userProfile.bio]);

  useEffect(() => {
    if (!showNameColorMenu) {
      setNameColorMenuPosition(null);
      return;
    }

    const updateNameColorMenuPosition = () => {
      if (!momentsRootRef.current || !nameButtonRef.current) return;
      const rootRect = momentsRootRef.current.getBoundingClientRect();
      const buttonRect = nameButtonRef.current.getBoundingClientRect();
      setNameColorMenuPosition(buildFloatingMenuPosition(rootRect, buttonRect, 224));
    };

    updateNameColorMenuPosition();
    window.addEventListener('resize', updateNameColorMenuPosition);
    return () => window.removeEventListener('resize', updateNameColorMenuPosition);
  }, [showNameColorMenu]);

  useEffect(() => {
    if (!showMoodMenu) {
      setMoodMenuPosition(null);
      return;
    }

    const updateMoodMenuPosition = () => {
      if (!momentsRootRef.current || !moodButtonRef.current) return;
      const rootRect = momentsRootRef.current.getBoundingClientRect();
      const buttonRect = moodButtonRef.current.getBoundingClientRect();
      const position = buildFloatingMenuPosition(rootRect, buttonRect, 256);
      setMoodMenuPosition({
        ...position,
        left: Math.min(
          Math.max(12, buttonRect.right - rootRect.left - 256),
          Math.max(12, rootRect.width - 256 - 12),
        ),
      });
    };

    updateMoodMenuPosition();
    window.addEventListener('resize', updateMoodMenuPosition);
    return () => window.removeEventListener('resize', updateMoodMenuPosition);
  }, [showMoodMenu]);

  const applyProfileNameColor = (nextColor: string) => {
    const normalizedColor = nextColor.trim();
    setAppData((prev) => ({
      ...prev,
      visualSettings: {
        ...prev.visualSettings,
        dynamics: {
          ...prev.visualSettings.dynamics,
          profileNameColor: normalizedColor,
        },
      },
    }));
    setCustomProfileNameColor(
      normalizedColor
      || appData.visualSettings?.themeTypography?.textColor
      || '#18181b',
    );
  };

  const applyMoodSelection = (nextMood: string) => {
    const normalizedMood = nextMood.trim() || defaultMood;
    setAppData((prev) => ({
      ...prev,
      userProfile: {
        ...prev.userProfile,
        mood: normalizedMood,
      },
    }));
    setCustomMoodInput(normalizedMood);
  };

  const saveBioDraft = () => {
    setAppData((prev) => ({
      ...prev,
      userProfile: {
        ...prev.userProfile,
        bio: bioDraft.trim(),
      },
    }));
    setIsEditingBio(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const startedAt = Date.now();
    try {
      await triggerAutoMomentScheduler('manual_refresh');
    } finally {
      const remaining = Math.max(260, 900 - (Date.now() - startedAt));
      window.setTimeout(() => {
        setRefreshing(false);
      }, remaining);
    }
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

  const scheduleMomentAiDrain = useCallback((delayMs = MOMENT_AI_RETRY_DELAY_MS) => {
    if (typeof window === 'undefined' || momentAiDrainTimerRef.current !== null) {
      return;
    }

    momentAiDrainTimerRef.current = window.setTimeout(() => {
      momentAiDrainTimerRef.current = null;

      if (momentAiRunningRef.current) {
        scheduleMomentAiDrain(MOMENT_AI_RETRY_DELAY_MS);
        return;
      }

      const nextTask = pendingMomentAiTasksRef.current[0];
      if (!nextTask) {
        return;
      }

      if (isChatRuntimeBusyNow()) {
        scheduleMomentAiDrain(MOMENT_AI_RETRY_DELAY_MS);
        return;
      }

      pendingMomentAiTasksRef.current.shift();
      momentAiRunningRef.current = true;
      void nextTask()
        .catch((error) => {
          console.error('Moment AI task failed', error);
        })
        .finally(() => {
          momentAiRunningRef.current = false;
          if (pendingMomentAiTasksRef.current.length > 0) {
            scheduleMomentAiDrain(600);
          }
        });
    }, delayMs);
  }, []);

  const enqueueMomentAiTask = useCallback((task: () => Promise<void>) => {
    pendingMomentAiTasksRef.current.push(task);
    scheduleMomentAiDrain();
  }, [scheduleMomentAiDrain]);

  const runQueuedMomentAiTask = useCallback((task: () => Promise<void>) => (
    new Promise<void>((resolve, reject) => {
      enqueueMomentAiTask(async () => {
        try {
          await task();
          resolve();
        } catch (error) {
          reject(error);
          throw error;
        }
      });
    })
  ), [enqueueMomentAiTask]);

  useEffect(() => (
    () => {
      if (momentAiDrainTimerRef.current !== null) {
        window.clearTimeout(momentAiDrainTimerRef.current);
        momentAiDrainTimerRef.current = null;
      }
      pendingMomentAiTasksRef.current = [];
      momentAiRunningRef.current = false;
    }
  ), []);

  const publishGeneratedCharacterMoment = useCallback(async (payload: {
    authorId: string;
    content: string;
    imageCard?: import('../../types').MomentImageCard;
  }) => {
    await publishGeneratedCharacterMomentToFeed({
      payload,
      snapshot: appDataRef.current,
      setAppData,
      forumConfig,
    });
  }, [forumConfig, setAppData]);

  const triggerAutoMomentScheduler = useCallback(async (trigger: AutoMomentSchedulerTrigger) => {
    return runAutoMomentSchedulerPass({
      trigger,
      forumConfig,
      getSnapshot: () => appDataRef.current,
      publishGeneratedCharacterMoment,
      executeTask: trigger === 'manual_refresh' ? undefined : runQueuedMomentAiTask,
    });
  }, [forumConfig, publishGeneratedCharacterMoment, runQueuedMomentAiTask]);

  useEffect(() => {
    void triggerAutoMomentScheduler('moments_open');
  }, [triggerAutoMomentScheduler]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        void triggerAutoMomentScheduler('app_foreground');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityRefresh);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, [triggerAutoMomentScheduler]);

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

  const handlePublish = useCallback(() => {
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
      enqueueMomentAiTask(async () => {
        await runMomentPublishCommentSequence({
          activeConfig,
          moment: newMoment,
          characters,
          chatGroups: appData.chatGroups || [],
          userName: userProfile.name,
          appendComment: (comment) => appendCommentToMoment(newMoment.id, comment),
        });
      });
    }
  }, [appendCommentToMoment, characters, enqueueMomentAiTask, forumConfig, publishContent, publishImages, setAppData, userProfile.name]);

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
  const handleComment = useCallback(async (momentId: string) => {
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
      enqueueMomentAiTask(async () => {
        await runMomentCommentReplySequence({
          activeConfig: forumConfig,
          moment,
          characters,
          chatGroups: appData.chatGroups || [],
          userName: userProfile.name,
          triggerComment: newComment,
          appendComment: (comment) => appendCommentToMoment(momentId, comment),
        });
      });
    }
  }, [appendCommentToMoment, characters, commentText, enqueueMomentAiTask, forumConfig, moments, replyTarget, userProfile.name]);

  if (showPublish) {
    return (
      <div
        ref={publishRef}
        className="absolute inset-0 z-[100] flex min-h-0 flex-col bg-white/80 backdrop-blur-xl"
      >
        <div
          className="flex min-h-[64px] shrink-0 items-center justify-between border-b border-white/20 bg-white/50 px-4 pb-3 backdrop-blur-md"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
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
            paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 16px)',
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
    <div ref={momentsRootRef} className="relative flex-1 min-h-0">
      <div
        data-swipe-ignore="true"
        className="h-full overflow-y-auto pb-[calc(var(--app-safe-area-bottom-ui,0px)+4rem)]"
        style={{
          backgroundImage: useFullScreenMomentsBackground ? `url(${resolvedMomentsBackgroundUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: useFullScreenMomentsBackground ? 'transparent' : '#fafafa',
        }}
      >
      <div className="relative pb-4">
        <div className="relative h-40 overflow-hidden">
          {useHeaderMomentsBackground ? (
            <div
              className="absolute inset-0 bg-zinc-200"
              style={{
                backgroundImage: `url(${resolvedMomentsBackgroundUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          ) : !useFullScreenMomentsBackground ? (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-600" />
          ) : null}
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
              <button
                ref={nameButtonRef}
                type="button"
                onClick={() => {
                  setShowMoodMenu(false);
                  setShowNameColorMenu((prev) => !prev);
                }}
                className="truncate text-[20px] font-bold text-zinc-900 transition-opacity hover:opacity-80"
                style={profileNameTextStyle}
              >
                {userProfile.name}
              </button>
              <button
                ref={moodButtonRef}
                type="button"
                onClick={() => {
                  setShowNameColorMenu(false);
                  setShowMoodMenu((prev) => !prev);
                }}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 transition-colors hover:bg-zinc-200"
                style={profileMoodTextStyle}
              >
                {userProfile.mood?.trim() || defaultMood}
              </button>
            </div>
            {isEditingBio ? (
              <input
                type="text"
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                onBlur={saveBioDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveBioDraft();
                  }
                  if (e.key === 'Escape') {
                    setBioDraft(userProfile.bio || '');
                    setIsEditingBio(false);
                  }
                }}
                placeholder="输入朋友圈简介"
                autoFocus
                className="mt-0.5 w-full rounded-lg border border-zinc-200 bg-white/80 px-2 py-1 text-[13px] text-zinc-500 outline-none focus:border-zinc-300"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingBio(true)}
                className="mt-0.5 block text-left text-[13px] text-zinc-500 transition-colors hover:text-zinc-700"
              >
                {userProfile.bio || '这个人很懒，什么都没写~'}
              </button>
            )}
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
                  <div className="mt-1 space-y-2">
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800">{moment.content}</p>
                    {moment.translation?.trim() ? (
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-500">
                        翻译：{moment.translation.trim()}
                      </p>
                    ) : null}
                  </div>
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
                  })() : (() => {
                    const frameCaptions = getMomentImageFrameCaptions(moment);
                    if (frameCaptions.length > 1) {
                      return (
                        <button
                          type="button"
                          onClick={() => setActiveMomentVisualPreview({ captions: frameCaptions })}
                          className={`mt-3 grid w-full gap-2 text-left ${frameCaptions.length >= 3 ? 'grid-cols-3' : 'grid-cols-2 max-w-[78%]'}`}
                        >
                          {frameCaptions.map((caption, frameIndex) => (
                            <div
                              key={`${caption}-${frameIndex}`}
                              className="relative aspect-square overflow-hidden rounded-[18px] border border-zinc-200 bg-white"
                            >
                              <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(244,244,245,0.92)_54%,rgba(228,228,231,0.88))]" />
                              <div className="absolute left-2.5 top-2 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-zinc-400 shadow-sm">
                                图片
                              </div>
                              <div className="relative z-10 flex h-full items-center justify-center px-4">
                                <p className="text-center text-[13px] font-medium leading-[1.55] text-black">
                                  {caption}
                                </p>
                              </div>
                            </div>
                          ))}
                        </button>
                      );
                    }

                    const pseudoImageText = getMomentDescriptionOverlayText(moment);
                    if (!pseudoImageText.trim()) {
                      return null;
                    }

                    return (
                      <button
                        type="button"
                        onClick={() => setActiveMomentVisualPreview({ singleText: pseudoImageText })}
                        className="mt-3 block w-full overflow-hidden rounded-[22px] border border-zinc-200 bg-white text-left"
                      >
                        <div className="relative aspect-[4/5]">
                          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(244,244,245,0.9)_56%,rgba(228,228,231,0.86))]" />
                          <div className="absolute left-4 top-4 z-10 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] text-zinc-400 shadow-sm">
                            图片
                          </div>
                          <div className="relative z-10 flex h-full items-center justify-center px-8">
                            <p className="text-center text-[18px] leading-[1.7] text-black">
                              {pseudoImageText}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })()
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
                        className="absolute right-10 top-1/2 z-20 grid w-[min(calc(100vw-2.5rem),18rem)] -translate-y-1/2 grid-cols-3 gap-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 p-1 shadow-lg backdrop-blur-md sm:right-8 sm:top-0 sm:w-auto sm:min-w-max sm:translate-y-0 sm:flex sm:items-center sm:gap-0 sm:px-1 sm:py-1"
                      >
                        <button
                          onClick={() => handleLike(moment.id)}
                          className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] text-zinc-800 transition-colors hover:bg-zinc-100 sm:justify-start"
                        >
                          <Heart size={14} className={(moment.likedBy?.includes('user') || moment.isLiked) ? 'fill-red-500 text-red-500' : ''} />
                          {(moment.likedBy?.includes('user') || moment.isLiked) ? '取消' : '赞'}
                        </button>
                        <button
                          onClick={() => {
                            toggleCommentComposer(moment.id, null);
                            setActiveMenuId(null);
                          }}
                          className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] text-zinc-800 transition-colors hover:bg-zinc-100 sm:justify-start"
                        >
                          <MessageCircle size={14} />
                          评论
                        </button>
                        <button
                          onClick={() => handleCollect(moment.id)}
                          className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] text-zinc-800 transition-colors hover:bg-zinc-100 sm:justify-start"
                        >
                          <Star size={14} className={effectiveCollected ? 'fill-yellow-400 text-yellow-400' : ''} />
                          {effectiveCollected ? '已收藏' : '收藏'}
                        </button>
                        <button
                          onClick={() => handleTogglePin(moment.id)}
                          className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] transition-colors sm:justify-start ${
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
                            className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] text-zinc-800 transition-colors hover:bg-zinc-100 sm:justify-start"
                          >
                            <Trash2 size={14} />
                            删除
                          </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {(moment.likes > 0 || moment.comments.length > 0 || commentingOn === moment.id) && (
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
                    {commentingOn === moment.id && (
                      <div className="mt-3 flex w-full min-w-0 items-center gap-2">
                        <input
                          ref={commentingOn === moment.id ? commentInputRef : undefined}
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder={replyTarget?.momentId === moment.id ? `回复 ${replyTarget.authorName}` : '发一条评论'}
                          className="min-w-0 w-full flex-1 rounded-full border border-transparent bg-white px-4 py-2 text-[13px] outline-none transition-all focus:border-zinc-900/20"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleComment(moment.id);
                          }}
                        />
                        <button
                          onClick={() => void handleComment(moment.id)}
                          className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-bold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-100"
                        >
                          发送
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          );
        })}

        <div className="h-4" />
      </div>
      </div>

      <AnimatePresence>
        {showNameColorMenu && nameColorMenuPosition && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[55] cursor-default bg-transparent"
              onClick={() => setShowNameColorMenu(false)}
              aria-label="Close profile name color menu"
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="absolute z-[56] flex w-56 flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white p-3 shadow-xl"
              style={{
                top: nameColorMenuPosition.top,
                left: nameColorMenuPosition.left,
                maxHeight: nameColorMenuPosition.maxHeight,
              }}
            >
              <div className="text-[11px] font-medium text-zinc-400">名字颜色</div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {PROFILE_NAME_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      applyProfileNameColor(color);
                      setShowNameColorMenu(false);
                    }}
                    className="h-9 rounded-xl border border-zinc-200 shadow-sm transition-transform active:scale-95"
                    style={{ backgroundColor: color }}
                    aria-label={`选择名字颜色 ${color}`}
                  />
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-2">
                <div className="mb-2 text-[11px] text-zinc-400">自定义颜色</div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={resolveColorPickerValue(customProfileNameColor, '#18181b')}
                    onChange={(e) => {
                      setCustomProfileNameColor(e.target.value);
                      applyProfileNameColor(e.target.value);
                    }}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-200 bg-white p-1"
                  />
                  <input
                    type="text"
                    value={customProfileNameColor}
                    onChange={(e) => setCustomProfileNameColor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        applyProfileNameColor(customProfileNameColor);
                        setShowNameColorMenu(false);
                      }
                    }}
                    placeholder="#18181b"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-zinc-400"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      applyProfileNameColor(customProfileNameColor);
                      setShowNameColorMenu(false);
                    }}
                    className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      applyProfileNameColor('');
                      setShowNameColorMenu(false);
                    }}
                    className="flex-1 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
                  >
                    跟随全局
                  </button>
                </div>
              </div>
              <div className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                这里只改动态页顶部这个名字，不会影响外面的全局文字颜色。
              </div>
            </motion.div>
          </>
        )}

        {showMoodMenu && moodMenuPosition && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[55] cursor-default bg-transparent"
              onClick={() => setShowMoodMenu(false)}
              aria-label="Close mood menu"
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="absolute z-[56] flex w-64 flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white p-2 shadow-xl"
              style={{
                top: moodMenuPosition.top,
                left: moodMenuPosition.left,
                maxHeight: moodMenuPosition.maxHeight,
              }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                {moodOptions.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => {
                      applyMoodSelection(mood);
                      setShowMoodMenu(false);
                    }}
                    className="block w-full whitespace-nowrap rounded-lg px-2 py-2 text-left text-[13px] transition-colors hover:bg-zinc-50"
                  >
                    {mood}
                  </button>
                ))}
              </div>
              <div className="mt-1 border-t border-zinc-100 pt-2">
                <div className="px-2 pb-1 text-[11px] text-zinc-400">自定义颜文字</div>
                <div className="flex gap-2 px-2">
                  <input
                    type="text"
                    value={customMoodInput}
                    onChange={(e) => setCustomMoodInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        applyMoodSelection(customMoodInput);
                        setShowMoodMenu(false);
                      }
                    }}
                    maxLength={24}
                    placeholder="自己输入"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] outline-none focus:border-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      applyMoodSelection(customMoodInput);
                      setShowMoodMenu(false);
                    }}
                    className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
                  >
                    保存
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

      {activeMomentVisualPreview && (
        <>
          <div
            className="fixed inset-0 z-[40] bg-white/50 backdrop-blur-[6px]"
            onClick={() => setActiveMomentVisualPreview(null)}
          />
          <div className="fixed inset-0 z-[41] flex items-center justify-center px-4 py-8">
            <div
              className="relative max-h-full w-full max-w-[26rem] overflow-y-auto rounded-[28px] border border-zinc-200 bg-white p-4 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveMomentVisualPreview(null);
                }}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 active:scale-95"
                aria-label="关闭图片预览"
              >
                <X size={16} />
              </button>

              {activeMomentVisualPreview.captions && activeMomentVisualPreview.captions.length > 1 ? (
                <div className={`grid gap-3 ${activeMomentVisualPreview.captions.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {activeMomentVisualPreview.captions.map((caption, frameIndex) => (
                    <div
                      key={`${caption}-${frameIndex}`}
                      className="relative aspect-square overflow-hidden rounded-[18px] border border-zinc-200 bg-white"
                    >
                      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(244,244,245,0.9)_56%,rgba(228,228,231,0.86))]" />
                      <div className="absolute left-3 top-3 z-10 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] text-zinc-400 shadow-sm">
                        图片
                      </div>
                      <div className="relative z-10 flex h-full items-center justify-center px-4">
                        <p className="text-center text-[13px] font-medium leading-[1.55] text-black">
                          {caption}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-[22px] border border-zinc-200 bg-white">
                  <div className="relative aspect-[4/5]">
                    <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(244,244,245,0.9)_56%,rgba(228,228,231,0.86))]" />
                    <div className="absolute left-4 top-4 z-10 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] text-zinc-400 shadow-sm">
                      图片
                    </div>
                    <div className="relative z-10 flex h-full items-center justify-center px-8">
                      <p className="text-center text-[18px] leading-[1.7] text-black">
                        {activeMomentVisualPreview.singleText || ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


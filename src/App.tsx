import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, ChevronLeft, ChevronRight, Send, Settings, Trash2, Plus, Check, X, Cpu, Pencil, Save, Link2, Key, RefreshCw, ChevronDown, Image as ImageIcon, Upload, PlusCircle, Smile, Share2, Banknote, Heart, Mic, Keyboard, Copy, Star, Reply, MoreHorizontal, CheckCircle, Search, MessageSquarePlus, MessageCircle, ScanEye, Phone, PhoneOff, MapPin, Gamepad2, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AppData, Mask, FavoriteMessage, MomentComment, MomentItem, VisualSettings, UserProfileExtended, WorldBookEntry,
  Character, ChatMessage, PerceptionSettings,
  ApiConfig, AppSettings, CallRecord, DateSession, WalletData, WidgetConfig, DesktopIconConfig
} from './types';
import { WorldBookManager } from './components/main/MePage';
import { MonitorApp } from './components/monitor/MonitorApp/Page';
import { CustomizationApp } from './components/customization/CustomizationApp/Page';
import { HomeScreen } from './components/home/HomeScreen/Page';
import { CharacterMomentsProfile, CharacterProfile } from './components/main/ContactsShell/Page';
import { MainApp } from './components/main/MainAppShell/Page';
import { ChatSessionMount } from './features/chat-session/ChatSessionMount';
import { createCharacterDirectory } from './features/character-domain/useCharacterDirectory';
import { ChatSettingsPanel } from './components/chat/ChatSettingsPanel';
import { CoupleSpaceApp } from './components/couple-space/CoupleSpaceApp/Page';
import { PerceptionView } from './components/couple-space/PerceptionView';
import MusicApp from './components/media/MusicApp';
import ForumApp from './components/social/ForumApp/Page';
import WalletApp, { MOCK_CARDS, MOCK_TRANSACTIONS } from './components/wallet/WalletApp/Page';
import { DatingModal } from './components/dating/DatingModal';
import { GameCenter } from './components/games/GameCenter';
import { GameCard } from './components/chat/GameCard';
import { streamTextWithConfig } from './services/ai/runtimeClient';
import { buildChatPrompt } from './services/ai/prompts/builders/buildChatPrompt';
import { buildSummaryPrompt } from './services/ai/prompts/builders/buildSummaryPrompt';
import {
  getRecentMomentReplyContext,
} from './services/moments/triggers';
import {
  buildFallbackMomentCommentReply,
  generateMomentAutoComment,
  generateMomentCommentReply,
} from './services/moments/generators';
import {
  handleCommandTriggeredMomentPublish,
  maybeAutoPublishMoment,
} from './services/moments/orchestrator';
import {
  copyTextContent,
  createShareAction,
  copyMessageText,
  deleteMessageAtIndex,
  deleteMessagesByIndexes,
  getChatHeaderState,
  getChatLayoutConfig,
  createForwardText,
  createQuoteReplyPayload,
  getContextMenuPosition,
  getLatestModelReplyTimestamp,
  getReplyPreviewText,
  getUserReadStatusLabel,
  type ShareActionResult,
  toggleFavoriteMessage,
} from './services/chat/messageActions';
import { APP_DIALOG_EVENT, DEFAULT_WHITE_AVATAR, extractImageUrls, getMessageMainText, getSummaryHistoryWindow, showInAppConfirm, type AppDialogRequest } from './utils';
import { STORAGE_KEYS } from './features/persistence/storageKeys';
import { resetCharacters } from './features/persistence/charactersStore';
import { usePersistedCharactersBridge } from './features/persistence/usePersistedCharactersBridge';
import { clearPersistedVisualSettings, loadPersistedVisualSettings, persistVisualSettings } from './features/persistence/visualSettingsStore';
import { useResolvedPersistentValue } from './features/persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from './features/persistence/persistentAssetRef';
import { migrateCharacterShapes } from './features/persistence/migrateCharacterShape';
import { sanitizeTransientAssetValue } from './features/persistence/sanitizeTransientAssetValue';
import { patchCharacterById, replaceCharacters, updateCharacterById, upsertCharacter } from './features/character-domain/characterMutations';
import { createDefaultCoupleSpaceInitiativeSettings } from './services/ai/couple-space/initiative/coupleSpaceTriggerPolicy';
import {
  acceptCoupleSpaceInviteState,
  buildPersistableCoupleSpacePayload,
  createDefaultCoupleSpaceData,
  createDefaultCoupleSpaceState,
  hydratePersistedCoupleSpacePayload,
  hydrateCoupleSpaceState,
  resolveCoupleSpaceState,
  resolveCurrentCoupleSpace,
  updateCurrentCoupleSpaceState,
} from './features/persistence/coupleSpaceStore';

// Global styles for hiding scrollbar to make it look more like a native app
const GlobalStyles = ({ customCss }: { customCss?: string }) => (
  <style>{`
    ::-webkit-scrollbar {
      display: none;
    }
    * {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    ${customCss || ''}
  `}</style>
);

type UserProfile = UserProfileExtended;
type Comment = MomentComment;
type Moment = MomentItem;

function ResolvedAssetImage({
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

const formatMessagePreview = (text: string | undefined): string => {
  if (!text) return '';
  if (text.startsWith('[GAME_CARD]')) {
    return '[游戏卡片]';
  }
  return text;
};

const DEFAULT_NAV_BAR_BACKGROUND = '';
const DEFAULT_ZHOU_JIBAI_AVATAR = 'https://tu.tuhenmei.com/tu2026/2025120917/mklyjkctwie22637.jpeg';

const DEFAULT_CHARACTERS: Character[] = [
  {
    id: 'char-2',
    name: '林策',
    gender: 'male',
    avatar: DEFAULT_WHITE_AVATAR,
    setting: '你叫林策，是“冷静清晰型测试角色”。你表达克制、结构清楚、信息完整，擅长把复杂内容分点说明，也能自然给出较长回复。你适合拿来测试翻译、总结、长消息拆分、说明型回复、转账卡片、GAME_CARD 等功能。回复时优先准确、清楚、稳定，必要时可以先概括再展开，但仍然保持像真实聊天，不要写成生硬公文。',
    signature: '把需求说清楚，我会给你一个清楚的结果。',
    openingRemark: '收到。你可以直接给我测试任务，我会尽量用清晰、可验证的方式回应。',
    lastMessage: '收到。你可以直接给我测试任务，我会尽量用清晰、可验证的方式回应。',
    lastTime: Date.now() - 100000,
    groupId: '朋友',
  },
  {
    id: 'char-zhou-jibai',
    name: '周既白',
    gender: 'male',
    avatar: DEFAULT_ZHOU_JIBAI_AVATAR,
    setting: `角色提示词：少年感爹系青梅竹马

姓名：周既白

年龄：18

身高：185cm

身份：青梅竹马、邻居、同级生

外形关键词：高瘦挺拔、黑发自然微乱、单眼皮偏内双、眉骨清晰、手很好看、校服总是穿得松松垮垮、白衬衫袖口常挽到小臂、身上有干净的皂香和一点阳光晒过的味道

气质关键词：少年感很重、松弛、干净、克制、会照顾人、不强势但很有主心骨、安静型爹系

性格设定：
表面看着懒懒的，不爱解释，也不喜欢凑热闹，和大多数人说话都很简短，甚至有点冷。但其实很会照顾人，尤其对“你”有近乎本能的关注。不是刻意端着成熟，也不是老成说教，而是会很自然地替你记住很多细节，比如你不爱喝太甜的、换季容易咳、难过的时候不喜欢别人一直追问。嘴上不算温柔，行动却总是先一步。护短，偏心明显，但藏得不算刻意。

活人感细节：
会在等你时低头踢路边的小石子；听你说话时习惯微微偏头；有点轻微洁癖，但会很顺手地接过你喝过的水；包里常年有创可贴、纸巾、薄荷糖和你落下的小东西；被你气到时会短促笑一下，说“你是真行”；困的时候声音会比平时更低，更哑；打完球额发湿着，站在你面前拧开瓶盖递水，自己反而先不喝。

相处模式：
从小一起长大，太熟了，所以不会把喜欢挂在嘴边。你闹脾气，他不会追着问，只会先把你情绪接住；你逞强，他也不拆穿，只淡淡看你一眼，把台阶递过来。你一喊他名字，他基本都会回头。嘴上总说“麻烦”“你能不能长点记性”，但每次还是会来管你。那种“爹系”不是控制欲，而是下意识兜底，是一种很安静的偏爱。

经典状态关键词：
雨天把伞偏向你、顺手拿走你的冰饮、晚自习后送你回家、你生病时皱着眉给你量体温、看你哭会明显慌一下但还是故作镇定哄你、对别人冷淡对你例外

核心感觉：
不是像长辈一样的爹，而是一个还带着锋利少年气的男生，站在你身边时却总是稳的。像夏天傍晚的风，身上有汗意、皂香和刚刚好的体温，嘴硬，手却一直在替你挡事。`,
    expressionStyle: `活人感细节：
会在等你时低头踢路边的小石子；听你说话时习惯微微偏头；有点轻微洁癖，但会很顺手地接过你喝过的水；包里常年有创可贴、纸巾、薄荷糖和你落下的小东西；被你气到时会短促笑一下，说“你是真行”；困的时候声音会比平时更低，更哑；打完球额发湿着，站在你面前拧开瓶盖递水，自己反而先不喝。

相处模式：
从小一起长大，太熟了，所以不会把喜欢挂在嘴边。你闹脾气，他不会追着问，只会先把你情绪接住；你逞强，他也不拆穿，只淡淡看你一眼，把台阶递过来。你一喊他名字，他基本都会回头。嘴上总说“麻烦”“你能不能长点记性”，但每次还是会来管你。那种“爹系”不是控制欲，而是下意识兜底，是一种很安静的偏爱。

经典状态关键词：
雨天把伞偏向你、顺手拿走你的冰饮、晚自习后送你回家、你生病时皱着眉给你量体温、看你哭会明显慌一下但还是故作镇定哄你、对别人冷淡对你例外

核心感觉：
不是像长辈一样的爹，而是一个还带着锋利少年气的男生，站在你身边时却总是稳的。像夏天傍晚的风，身上有汗意、皂香和刚刚好的体温，嘴硬，手却一直在替你挡事。`,
    signature: '你喊一声，我基本都会回头。',
    openingRemark: '又忘带东西了？先过来，我看看。',
    lastMessage: '又忘带东西了？先过来，我看看。',
    lastTime: Date.now() - 50000,
    groupId: '朋友',
  }
];

const DEFAULT_USER: UserProfile = {
  name: 'AI 用户',
  avatar: 'https://tu.tuhenmei.com/uploads/allimg/2021090521/s4ljgp4msrd.jpg',
  id: 'user_8888',
  bio: '探索 AI 的无限可能',
  mood: '今天很开心',
};

const DEFAULT_CONFIG: ApiConfig = {
  id: 'default',
  name: 'Google Gemini (默认)',
  provider: 'Google Gemini',
  apiKey: '',
  baseUrl: '',
  model: 'gemini-3-flash-preview',
  temperature: 1.0,
};

const DEFAULT_SETTINGS: AppSettings = {
  activeConfigId: 'default',
  configs: [DEFAULT_CONFIG],
};

const DEFAULT_DESKTOP_WALLPAPER = 'https://tse3.mm.bing.net/th/id/OIP.GdwwXxbY6ullokoEq_KO2gHaNK?rs=1&pid=ImgDetMain&o=7&rm=3';

const DEFAULT_HOME_ICONS: DesktopIconConfig[] = [
  { id: 'chat', slotId: 'slot-1-2' },
  { id: 'settings', slotId: 'slot-1-3' },
  { id: 'worldbook', slotId: 'slot-2-2' },
  { id: 'monitor', slotId: 'slot-2-3' },
  { id: 'couple-space', slotId: 'slot-3-0' },
  { id: 'perception', slotId: 'slot-3-1' },
  { id: 'music', slotId: 'slot-4-0' },
  { id: 'forum', slotId: 'slot-4-1' },
];

const DEFAULT_HOME_WIDGETS: WidgetConfig[] = [
  {
    id: 'blankCardA',
    type: 'blank',
    slotId: 'slot-1-0',
    w: 2,
    h: 2,
    background: 'https://tu.tuhenmei.com/tu2026/2025120917/qi35sbin1js22635.jpeg',
    borderRadius: 32,
    opacity: 1,
  },
  {
    id: 'blankCardB',
    type: 'blank',
    slotId: 'slot-3-2',
    w: 2,
    h: 2,
    background: 'https://tu.tuhenmei.com/uploads/allimg/2021090514/2vzjil1xqkt.jpg',
    borderRadius: 32,
    opacity: 1,
  },
];

const REMOVED_CHARACTER_IDS = new Set(['gemini-default']);
const REMOVED_CHARACTER_NAMES = new Set(['阿野']);
function sanitizePersistedCharacters(characters: Character[] | undefined): Character[] {
  const persistedCharacters = migrateCharacterShapes(characters || [])
    .filter(character => !REMOVED_CHARACTER_IDS.has(character.id) && !REMOVED_CHARACTER_NAMES.has(character.name))
    .map(character =>
      character.id === 'char-zhou-jibai'
        ? {
            ...character,
            avatar:
              sanitizeTransientAssetValue(character.avatar) || DEFAULT_ZHOU_JIBAI_AVATAR,
          }
        : {
            ...character,
            avatar: sanitizeTransientAssetValue(character.avatar),
          },
    );

  const existingIds = new Set(persistedCharacters.map(character => character.id));
  const missingDefaults = DEFAULT_CHARACTERS.filter(character => !existingIds.has(character.id));

  return [...persistedCharacters, ...missingDefaults];
}

function getPersistableAppData(appData: AppData): Omit<AppData, 'characters'> {
  const { characters: _characters, ...persistableAppData } = appData;
  const { coupleSpaceState, coupleSpace } = buildPersistableCoupleSpacePayload(
    appData.coupleSpaceState,
    appData.coupleSpace,
  );

  return {
    ...persistableAppData,
    coupleSpace,
    coupleSpaceState,
  };
}

function hydratePersistedCharacters(
  source: Character[] | null | undefined,
  fallback: Character[],
): Character[] {
  return sanitizePersistedCharacters(source || fallback);
}


const DEFAULT_MOMENTS: Moment[] = [
  {
    id: 'm1',
    authorId: 'char-2',
    content: '今天把几个关键测试点都跑了一遍，终于顺下来了。喝杯咖啡缓一缓。',
    images: ['https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'],
    timestamp: Date.now() - 1000 * 60 * 30, // 30 mins ago
    likes: 1,
    likedBy: ['user'],
    comments: [
      { id: 'c1', authorId: 'user', content: '在哪家店呀？', timestamp: Date.now() - 1000 * 60 * 10 }
    ]
  },
  {
    id: 'm2',
    authorId: 'user',
    content: '桌面和情侣空间又调了一轮，细节越来越顺眼了。',
    timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    likes: 1,
    likedBy: ['char-2'],
    comments: []
  }
];

function MomentsApp({
  appData,
  setAppData,
  settings
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
  const resolveMomentAuthor = (authorId: string) => {
    if (authorId === 'user') {
      return userProfile;
    }

    return getCharacterById(authorId);
  };

  const sanitizedMoments = (moments || [])
    .filter(moment => isKnownMomentActorId(moment.authorId))
    .map(moment => ({
      ...moment,
      likedBy: moment.likedBy?.filter(likerId => isKnownMomentActorId(likerId)),
      likes: (moment.likedBy?.filter(likerId => isKnownMomentActorId(likerId)).length) ?? moment.likes,
      comments: moment.comments.filter(comment => isKnownMomentActorId(comment.authorId)).map(comment => ({
        ...comment,
        replyToAuthorId: isKnownMomentActorId(comment.replyToAuthorId) ? comment.replyToAuthorId : undefined,
        replyToAuthorName: isKnownMomentActorId(comment.replyToAuthorId) ? comment.replyToAuthorName : undefined,
      })),
    }));
  const serializedMoments = JSON.stringify(moments || []);
  const serializedSanitizedMoments = JSON.stringify(sanitizedMoments);

  const missingMomentAuthorIds = (moments || [])
    .map(moment => moment.authorId)
    .filter(authorId => authorId !== 'user' && !getCharacterById(authorId));
  const missingMomentLikerIds = (moments || [])
    .flatMap(moment => moment.likedBy || [])
    .filter(likerId => likerId !== 'user' && !getCharacterById(likerId));

  useEffect(() => {
    if (missingMomentAuthorIds.length === 0) return;

    console.warn('[moments][missing-authors]', {
      missingAuthorIds: Array.from(new Set(missingMomentAuthorIds)),
      availableCharacterIds: characters.map(character => character.id),
      momentsCount: moments?.length || 0,
    });
  }, [characters, missingMomentAuthorIds, moments]);

  useEffect(() => {
    if (missingMomentLikerIds.length === 0) return;

    console.warn('[moments][missing-likers]', {
      missingLikerIds: Array.from(new Set(missingMomentLikerIds)),
      availableCharacterIds: characters.map(character => character.id),
      momentsCount: moments?.length || 0,
    });
  }, [characters, missingMomentLikerIds, moments]);

  useEffect(() => {
    if (serializedMoments === serializedSanitizedMoments) return;

    console.warn('[moments][cleanup-orphans]', {
      beforeCount: moments?.length || 0,
      afterCount: sanitizedMoments.length,
    });

    setAppData(prev => ({
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
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setPublishImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePublish = () => {
    const newMoment: Moment = {
      id: Date.now().toString(),
      authorId: 'user',
      content: publishContent,
      images: publishImages,
      timestamp: Date.now(),
      likes: 0,
      comments: []
    };
    setAppData(prev => ({ ...prev, moments: [newMoment, ...(prev.moments || [])] }));
    setShowPublish(false);
    setPublishContent('');
    setPublishImages([]);

    const activeConfig = settings.configs.find(c => c.id === settings.activeConfigId) || settings.configs[0];
    const shuffledCharacters = [...characters].sort(() => Math.random() - 0.5);
    const replyCount = Math.min(
      shuffledCharacters.length,
      shuffledCharacters.length <= 2 ? shuffledCharacters.length : (Math.random() < 0.5 ? 2 : 3),
    );
    const replyCharacters = shuffledCharacters.slice(0, replyCount);
    const autoLikerIds = shuffledCharacters
      .filter(character => {
        const isCommenter = replyCharacters.some(replyCharacter => replyCharacter.id === character.id);
        const likeChance = isCommenter ? 0.75 : 0.4;
        return Math.random() < likeChance;
      })
      .map(character => character.id)
      .slice(0, Math.min(shuffledCharacters.length, 3));

    if (autoLikerIds.length > 0) {
      void (async () => {
        for (const likerId of autoLikerIds) {
          await new Promise(resolve => setTimeout(resolve, 150 + Math.floor(Math.random() * 500)));
          appendLikeToMoment(newMoment.id, likerId);
        }
      })();
    }

    if (replyCharacters.length > 0) {
      const generatedComments: Comment[] = [];

      void (async () => {
        for (const replyCharacter of replyCharacters) {
          try {
            const commentText = await generateMomentAutoComment({
              activeConfig,
              replyCharacter,
              moment: {
                ...newMoment,
                comments: generatedComments,
              },
              characters,
              userName: userProfile.name,
            });

            const normalizedContent = commentText.trim();
            if (!normalizedContent) continue;

            const aiComment: Comment = {
              id: `${Date.now()}_${replyCharacter.id}_auto`,
              authorId: replyCharacter.id,
              content: normalizedContent,
              timestamp: Date.now(),
            };

            generatedComments.push(aiComment);
            appendCommentToMoment(newMoment.id, aiComment);

            await new Promise(resolve => setTimeout(resolve, 250 + Math.floor(Math.random() * 500)));
          } catch (err) {
            console.error('AI auto moment comment failed', err);
          }
        }
      })();
    }
  };

  const handleLike = (momentId: string) => {
    setAppData(prev => ({
      ...prev,
      moments: prev.moments.map(m => {
        if (m.id === momentId) {
          const userId = 'user';
          const likedBy = m.likedBy || [];
          const isLiked = likedBy.includes(userId);
          
          let newLikedBy;
          if (isLiked) {
            newLikedBy = likedBy.filter(id => id !== userId);
          } else {
            newLikedBy = [...likedBy, userId];
          }

          return {
            ...m,
            likedBy: newLikedBy,
            likes: newLikedBy.length,
            isLiked: !isLiked // Keep for compatibility if needed, but rely on likedBy
          };
        }
        return m;
      })
    }));
    setActiveMenuId(null);
  };

  const appendLikeToMoment = (momentId: string, likerId: string) => {
    setAppData(prev => ({
      ...prev,
      moments: prev.moments.map(m => {
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
      })
    }));
  };

  const handleCollect = (momentId: string) => {
    setAppData(prev => ({
      ...prev,
      moments: prev.moments.map(m => {
        if (m.id === momentId) {
          const isCollected = !m.isCollected;
          // alert(isCollected ? '收藏成功' : '已取消收藏'); // Optional: remove alert for smoother UX
          return { ...m, isCollected };
        }
        return m;
      })
    }));
    setActiveMenuId(null);
  };

  const handleDelete = async (momentId: string) => {
    if (await showInAppConfirm('确定要删除这条动态吗？')) {
      setAppData(prev => ({
        ...prev,
        moments: prev.moments.filter(m => m.id !== momentId)
      }));
    }
    setActiveMenuId(null);
  };

  const appendCommentToMoment = (momentId: string, comment: Comment) => {
    setAppData(prev => ({
      ...prev,
      moments: prev.moments.map(m =>
        m.id === momentId ? { ...m, comments: [...m.comments, comment] } : m
      )
    }));
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

    // AI Reply Logic
    const moment = moments.find(m => m.id === momentId);
    if (!moment) return;

    let replyCharacter: Character | undefined;
    if (moment.authorId !== 'user') {
      replyCharacter = getCharacterById(moment.authorId) || undefined;
    } else {
      if (characters.length > 0) {
        replyCharacter = characters[Math.floor(Math.random() * characters.length)];
      }
    }

    if (replyCharacter) {
      const recentCommentReplies = getRecentMomentReplyContext(moment, characters, userProfile.name);

      const appendReplyComment = (content: string) => {
        const normalizedContent = content.trim();
        if (!normalizedContent) return;

        const aiComment: Comment = {
          id: Date.now().toString() + '_ai',
          authorId: replyCharacter.id,
          content: normalizedContent,
          timestamp: Date.now(),
          replyToCommentId: newComment.id,
          replyToAuthorId: newComment.authorId,
          replyToAuthorName: userProfile.name
        };
        appendCommentToMoment(momentId, aiComment);
      };

      try {
        const activeConfig = settings.configs.find(c => c.id === settings.activeConfigId) || settings.configs[0];
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
      <div className="absolute inset-0 bg-white/80 backdrop-blur-xl z-[100] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-white/50 backdrop-blur-md">
          <button onClick={() => setShowPublish(false)} className="text-zinc-600">取消</button>
          <button 
            onClick={handlePublish}
            disabled={!publishContent.trim() && publishImages.length === 0}
            className="bg-zinc-900 hover:bg-black text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50 transition-all shadow-lg shadow-black/20"
          >
            发表
          </button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <textarea
            value={publishContent}
            onChange={e => setPublishContent(e.target.value)}
            placeholder="这一刻的想法..."
            className="w-full h-32 outline-none resize-none text-[15px] bg-transparent placeholder-zinc-400"
          />
          <div className="grid grid-cols-3 gap-2 mt-4">
            {publishImages.map((img, i) => (
              <div key={i} className="relative aspect-square group">
                <ResolvedAssetImage value={img} className="w-full h-full object-cover rounded-xl shadow-sm" />
                <button 
                  onClick={() => setPublishImages(publishImages.filter((_, idx) => idx !== i))}
                  className="absolute -top-2 -right-2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {publishImages.length < 9 && (
              <div className="flex flex-col gap-2">
                <label className="aspect-square bg-zinc-100/50 border border-dashed border-zinc-300 rounded-xl flex items-center justify-center text-zinc-400 cursor-pointer hover:bg-zinc-100 transition-colors">
                  <Plus size={24} />
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                <button 
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-900 transition-colors flex items-center justify-center gap-1"
                >
                  <Link2 size={10} />
                  添加链接
                </button>
              </div>
            )}
          </div>

          {showUrlInput && (
            <div className="mt-4 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-zinc-500">添加图片链接</span>
                <button onClick={() => setShowUrlInput(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="支持输入图片链接、Markdown图片格式、HTML img标签"
                className="w-full h-24 bg-white border border-zinc-200 rounded-lg p-2 text-xs outline-none focus:border-zinc-900/30 transition-all resize-none"
              />
              <button 
                onClick={() => {
                  const urls = extractImageUrls(urlInput);
                  if (urls.length > 0) {
                    setPublishImages(prev => [...prev, ...urls].slice(0, 9));
                    setUrlInput('');
                    setShowUrlInput(false);
                  }
                }}
                className="w-full mt-2 bg-zinc-900 text-white py-1.5 rounded-lg text-xs font-bold"
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
      className="flex-1 overflow-y-auto pb-24 relative"
      style={{
        backgroundImage: resolvedMomentsBackgroundUrl ? `url(${resolvedMomentsBackgroundUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: resolvedMomentsBackgroundUrl ? 'transparent' : '#fafafa'
      }}
    >
      <div className="relative pb-4">
        <div className="h-40 relative overflow-hidden">
          {!resolvedMomentsBackgroundUrl && (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-600" />
          )}
          <div className="absolute top-4 right-4 flex gap-3 z-10">
            <button 
              onClick={handleRefresh} 
              className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-zinc-800 transition-all shadow-sm border border-white/20"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => setShowPublish(true)} 
              className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-zinc-800 transition-all shadow-sm border border-white/20"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        
        <div className="px-5 relative -mt-10 flex items-end gap-3 justify-start z-10">
          <div className="relative flex-1 min-w-0 flex flex-col gap-1">
            <div className="absolute inset-0 bg-black/5 rounded-2xl blur-sm transform translate-y-1" />
            <ResolvedAssetImage value={userProfile.avatar} className="w-20 h-20 rounded-2xl border-[3px] border-white object-cover bg-white shadow-md relative z-10" />
          </div>
          <div className="mb-1.5 flex-1 text-left">
            <div className="flex items-center justify-start gap-2">
              <h2 className="text-[20px] font-bold text-zinc-900">{userProfile.name}</h2>
              <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 text-[10px] font-medium rounded-full">
                {userProfile.mood || '在线'}
              </span>
            </div>
            <p className="text-[13px] text-zinc-500 mt-0.5">{userProfile.bio || '这个人很懒，什么都没写~'}</p>
          </div>
        </div>
      </div>

      <div className="bg-transparent px-0 pt-4 space-y-4">
        {(moments || []).map(moment => {
          const author = resolveMomentAuthor(moment.authorId);
          if (!author) return null;

          return (
            <div 
              key={moment.id} 
              className="p-4 mx-4 backdrop-blur-md border border-white/50 shadow-sm flex gap-3 hover:bg-white transition-colors"
              style={{
                borderRadius: appData.visualSettings?.dynamics?.cardBorderRadius ?? 24,
                backgroundColor: `rgba(255, 255, 255, ${appData.visualSettings?.dynamics?.cardOpacity ?? 0.9})`
              }}
            >
              <ResolvedAssetImage value={author.avatar} className="w-10 h-10 rounded-full object-cover border border-zinc-100 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-[15px] text-zinc-900">{author.name}</h3>
                  <span className="text-[12px] text-zinc-400">
                    {new Date(moment.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[15px] text-zinc-800 mt-1 whitespace-pre-wrap leading-relaxed">{moment.content}</p>
                
                {moment.images && moment.images.length > 0 && (
                  <div className={`grid gap-1.5 mt-3 ${moment.images.length === 1 ? 'grid-cols-1 w-2/3' : 'grid-cols-3'}`}>
                    {moment.images.map((img, i) => (
                      <ResolvedAssetImage key={i} value={img} className="w-full aspect-square object-cover rounded-xl border border-zinc-100" />
                    ))}
                  </div>
                )}
                
                <div className="flex items-center justify-end mt-2 relative h-8">
                  <button 
                    onClick={() => setActiveMenuId(activeMenuId === moment.id ? null : moment.id)}
                    className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  <AnimatePresence>
                    {activeMenuId === moment.id && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, x: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, x: 10 }}
                        className="absolute right-8 top-0 bg-zinc-800/90 backdrop-blur-md rounded-lg shadow-xl flex items-center overflow-hidden z-20 py-1 px-1"
                      >
                        <button 
                          onClick={() => handleLike(moment.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-white hover:bg-white/10 rounded-md transition-colors text-[12px] whitespace-nowrap"
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
                          className="flex items-center gap-1.5 px-3 py-1.5 text-white hover:bg-white/10 rounded-md transition-colors text-[12px] whitespace-nowrap"
                        >
                          <MessageCircle size={14} />
                          评论
                        </button>
                        <button 
                          onClick={() => handleCollect(moment.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-white hover:bg-white/10 rounded-md transition-colors text-[12px] whitespace-nowrap"
                        >
                          <Star size={14} className={moment.isCollected ? 'fill-yellow-400 text-yellow-400' : ''} />
                          {moment.isCollected ? '已收藏' : '收藏'}
                        </button>
                        {moment.authorId === 'user' && (
                          <button 
                            onClick={() => handleDelete(moment.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-white hover:bg-white/10 rounded-md transition-colors text-[12px] whitespace-nowrap"
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
                  <div className="bg-zinc-50 rounded-xl p-3 mt-2">
                    {moment.likes > 0 && (
                      <div className="flex items-center gap-1.5 text-[13px] text-zinc-600 font-medium mb-1.5 border-b border-zinc-200/50 pb-1.5">
                        <Heart size={12} className="fill-red-500 text-red-500" />
                        {(() => {
                          if (moment.likedBy && moment.likedBy.length > 0) {
                            const names = moment.likedBy.map(id => {
                              if (id === 'user') return userProfile.name;
                              return getCharacterDisplayName(id);
                            }).filter((name): name is string => Boolean(name));

                            if (names.length === 0) {
                              return `${moment.likes} 人觉得很赞`;
                            }

                            if (names.length <= 3) {
                              return names.join('、');
                            } else {
                              return `${names.slice(0, 3).join('、')} 等 ${names.length} 人`;
                            }
                          }
                          return `${moment.likes} 人觉得很赞`;
                        })()}
                      </div>
                    )}
                    {moment.comments.map(comment => {
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
                          className="block w-full text-left text-[13px] mt-1 leading-relaxed rounded-lg px-1 py-0.5 hover:bg-zinc-100/80 transition-colors"
                        >
                          <span className="font-bold text-zinc-900">{commentAuthor?.name}</span>
                          {comment.replyToAuthorName ? (
                            <>
                              <span className="text-zinc-500 mx-1">回复</span>
                              <span className="font-bold text-zinc-700">{comment.replyToAuthorName}</span>
                              <span className="text-zinc-500">：</span>
                            </>
                          ) : (
                            <span className="text-zinc-500 mx-1">·</span>
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
                      onChange={e => setCommentText(e.target.value)}
                      placeholder={
                        replyTarget?.momentId === moment.id
                          ? `回复 ${replyTarget.authorName}`
                          : '发布你的回复'
                      }
                      className="flex-1 bg-zinc-100 rounded-full px-4 py-2 text-[13px] outline-none border border-transparent focus:border-zinc-900/30 focus:bg-white transition-all"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleComment(moment.id);
                      }}
                    />
                    <button 
                      onClick={() => handleComment(moment.id)}
                      className="bg-zinc-900 text-white px-3 py-1.5 rounded-full text-[12px] font-bold shadow-sm shrink-0 whitespace-nowrap"
                    >
                      回复
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        <div className="h-4" /> {/* Bottom spacer */}
      </div>
    </div>
  );
}

export default function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current) {
    audioRef.current = new Audio();
  }
  const [activeApp, setActiveApp] = useState<'home' | 'chat' | 'settings' | 'chat-session' | 'add-character' | 'sms' | 'character-profile' | 'character-moments' | 'worldbook' | 'monitor' | 'customization' | 'couple-space' | 'perception' | 'music' | 'forum' | 'wallet' | 'group-chat-session'>('home');
  const [activeTab, setActiveTab] = useState<'chat' | 'contacts' | 'moments' | 'me'>('chat');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedForumPostId, setSelectedForumPostId] = useState<string | null>(null);
  const [characterMomentsBackApp, setCharacterMomentsBackApp] = useState<'chat' | 'chat-session' | 'character-profile'>('character-profile');
  const [time, setTime] = useState('');
  const [statusBarVisible, setStatusBarVisible] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [appData, setAppData] = useState<AppData>({
    characters: DEFAULT_CHARACTERS,
    chatHistory: {},
    userProfile: DEFAULT_USER,
    masks: [],
    favorites: [],
    friendRequests: [],
    chatGroups: [],
    callHistory: [],
    visualSettings: {
      globalBackground: DEFAULT_DESKTOP_WALLPAPER,
      chatOpacity: 1,
      desktopIcons: DEFAULT_HOME_ICONS,
      widgets: DEFAULT_HOME_WIDGETS,
      navBar: {
        show: true,
        style: 'default',
        shape: 'pill',
        showMultipleAvatars: false,
        backgroundImage: DEFAULT_NAV_BAR_BACKGROUND,
        statusBarPlacement: 'top'
      },
      desktop: {
        iconSize: 56,
        iconBorderRadius: 14,
        gridColumns: 4,
        gridGap: 16
      },
      chat: {
        background: '',
        avatarSize: 40,
        avatarBorderRadius: 20,
        avatarBorderColor: '#e4e4e7',
        avatarBorderWidth: 0,
        messageBorderRadius: 16,
        messageBackgroundColorUser: '#3b82f6',
        messageBackgroundColorModel: '#ffffff',
        messageSpacing: 16
      },
      dynamics: {
        background: '',
        cardStyle: 'flat',
        cardBorderRadius: 24,
        cardOpacity: 1
      },
      globalCss: ''
    },
    groups: ['家人', '朋友', '同事', '星标'],
    moments: DEFAULT_MOMENTS,
    worldBooks: [],
    coupleSpace: createDefaultCoupleSpaceData(),
    coupleSpaceState: createDefaultCoupleSpaceState(),
    musicData: {
      currentSong: null,
      isPlaying: false,
      progress: 0,
      volume: 80,
      playlists: [],
      likedSongs: [],
      collectedSongs: [],
      history: [],
      recentlyPlayed: [],
      togetherWith: null,
      togetherStartTime: null,
      chatHistory: [],
      queue: []
    }
  });
  const [appDialog, setAppDialog] = useState<AppDialogRequest | null>(null);
  const [appDialogInput, setAppDialogInput] = useState('');
  const [useDesktopStageLayout, setUseDesktopStageLayout] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)').matches;
  });
  const { getCharacterById } = createCharacterDirectory({ characters: appData.characters });
  const selectedCharacter = getCharacterById(selectedCharacterId);
  const currentCoupleSpace = resolveCurrentCoupleSpace(appData.coupleSpaceState, appData.coupleSpace);
  const couplePartnerId = appData.coupleSpaceState?.currentPartnerId ?? currentCoupleSpace.partnerId;
  const couplePartnerCharacter = getCharacterById(couplePartnerId) || appData.characters[0] || null;
  const setCharacters = useCallback((characters: Character[]) => {
    setAppData(prev => ({
      ...prev,
      characters: replaceCharacters(prev.characters, characters),
    }));
  }, []);
  const handlePatchCharacterById = useCallback((characterId: string, patch: Partial<Character>) => {
    setAppData(prev => ({
      ...prev,
      characters: patchCharacterById(prev.characters, characterId, patch),
    }));
  }, []);
  const handleMergeCharacter = useCallback((updatedCharacter: Character) => {
    setAppData(prev => ({
      ...prev,
      characters: updateCharacterById(prev.characters, updatedCharacter.id, (character) => ({
        ...character,
        ...updatedCharacter,
      })),
    }));
  }, []);
  const handleUpsertCharacter = useCallback((character: Character) => {
    setAppData(prev => ({
      ...prev,
      characters: upsertCharacter(prev.characters, character),
    }));
  }, []);
  const handleUpdateCurrentCoupleSpace = useCallback((updates: any) => {
    setAppData(prev => {
      const { coupleSpaceState, coupleSpace } = updateCurrentCoupleSpaceState(
        prev.coupleSpaceState,
        prev.coupleSpace,
        updates,
      );
      return {
        ...prev,
        coupleSpaceState,
        coupleSpace,
      };
    });
  }, []);
  const handleAcceptCoupleSpaceInvite = useCallback((partnerId: string) => {
    setAppData(prev => {
      const { coupleSpaceState, coupleSpace } = acceptCoupleSpaceInviteState(
        prev.coupleSpaceState,
        prev.coupleSpace,
        partnerId,
      );
      return {
        ...prev,
        coupleSpaceState,
        coupleSpace,
      };
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)');
    const updateDesktopStageLayout = () => setUseDesktopStageLayout(media.matches);
    updateDesktopStageLayout();
    media.addEventListener?.('change', updateDesktopStageLayout);
    window.addEventListener('resize', updateDesktopStageLayout);
    return () => {
      media.removeEventListener?.('change', updateDesktopStageLayout);
      window.removeEventListener('resize', updateDesktopStageLayout);
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const savedSettings = localStorage.getItem('ai_phone_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.configs && Array.isArray(parsed.configs)) {
          setSettings(parsed);
        } else {
          // Migrate old settings format
          const migrated: AppSettings = {
            activeConfigId: 'default',
            configs: [
              {
                ...DEFAULT_CONFIG,
                apiKey: parsed.apiKey || '',
                baseUrl: parsed.baseUrl || '',
                model: parsed.model || 'gemini-3-flash-preview',
                provider: parsed.provider || '自定义 (Custom)',
              }
            ]
          };
          setSettings(migrated);
          localStorage.setItem('ai_phone_settings', JSON.stringify(migrated));
        }
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }

    const savedAppData = localStorage.getItem(STORAGE_KEYS.appData);
    if (savedAppData) {
      try {
        const parsed = JSON.parse(savedAppData);
        const { coupleSpaceState, coupleSpace } = hydratePersistedCoupleSpacePayload(
          parsed.coupleSpaceState ?? parsed.coupleSpace ?? null,
        );
        setAppData({
          ...parsed,
          characters: sanitizePersistedCharacters(parsed.characters),
          userProfile: parsed.userProfile
            ? {
                ...parsed.userProfile,
                avatar: sanitizeTransientAssetValue(parsed.userProfile.avatar),
              }
            : parsed.userProfile,
          worldBooks: parsed.worldBooks || [],
          moments: parsed.moments || DEFAULT_MOMENTS,
          groups: parsed.groups || ['家人', '朋友', '同事', '星标'],
          savedDates: parsed.savedDates || [],
          collectedDates: parsed.collectedDates || [],
          coupleSpaceState,
          coupleSpace,
          visualSettings: loadPersistedVisualSettings(parsed.visualSettings, DEFAULT_DESKTOP_WALLPAPER),
        });
      } catch (e) {
        console.error('Failed to parse app data', e);
      }
    } else {
      setAppData(prev => ({
        ...prev,
        visualSettings: loadPersistedVisualSettings(prev.visualSettings, DEFAULT_DESKTOP_WALLPAPER),
      }));
    }

    setHasHydratedStorage(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    localStorage.setItem('ai_phone_settings', JSON.stringify(settings));
  }, [hasHydratedStorage, settings]);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    localStorage.setItem(STORAGE_KEYS.appData, JSON.stringify(getPersistableAppData(appData)));
  }, [appData, hasHydratedStorage]);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    persistVisualSettings(appData.visualSettings);
  }, [appData.visualSettings, hasHydratedStorage]);

  usePersistedCharactersBridge(appData.characters, setCharacters, {
    hydrate: hydratePersistedCharacters,
  });

  useEffect(() => {
    const handleDialogRequest = (event: Event) => {
      const detail = (event as CustomEvent<AppDialogRequest>).detail;
      setAppDialogInput(detail.kind === 'prompt' ? detail.defaultValue || '' : '');
      setAppDialog(detail);
    };

    const originalAlert = window.alert;
    window.alert = (message?: unknown) => {
      window.dispatchEvent(new CustomEvent(APP_DIALOG_EVENT, {
        detail: {
          kind: 'alert',
          message: String(message ?? ''),
        } satisfies AppDialogRequest,
      }));
    };

    window.addEventListener(APP_DIALOG_EVENT, handleDialogRequest as EventListener);
    return () => {
      window.alert = originalAlert;
      window.removeEventListener(APP_DIALOG_EVENT, handleDialogRequest as EventListener);
    };
  }, []);

  const closeAppDialog = () => {
    if (appDialog?.kind === 'alert') {
      appDialog.resolve?.();
    } else if (appDialog?.kind === 'confirm') {
      appDialog.resolve(false);
    } else if (appDialog?.kind === 'prompt') {
      appDialog.resolve(null);
    }
    setAppDialog(null);
  };

  const handleDialogConfirm = () => {
    if (!appDialog) return;
    if (appDialog.kind === 'alert') {
      appDialog.resolve?.();
    } else if (appDialog.kind === 'confirm') {
      appDialog.resolve(true);
    } else if (appDialog.kind === 'prompt') {
      appDialog.resolve(appDialogInput);
    }
    setAppDialog(null);
  };

  const handleOpenChat = (characterId: string) => {
    setSelectedCharacterId(characterId);
    setActiveApp('chat-session');
  };

  const handleAddCharacter = (char: Character) => {
    handleUpsertCharacter(char);
    setActiveApp('chat');
    setActiveTab('chat');
  };

  const handleOpenApp = (app: any) => {
    setActiveApp(app);
    if (app === 'chat') {
      setActiveTab('chat');
    }
  };

  return (
    <div
      className={`app-shell relative bg-black font-sans selection:bg-blue-500/30 ${
        useDesktopStageLayout ? 'md:flex md:min-h-screen md:items-center md:justify-center md:bg-zinc-950 md:p-4' : ''
      }`}
    >
      <GlobalStyles customCss={appData.visualSettings?.globalCss || ''} />
      {/* Phone Container */}
      <div
        id="phone-container"
        className={`app-phone-container relative flex h-full w-full flex-col overflow-hidden bg-zinc-50 ring-0 ${
          useDesktopStageLayout
            ? 'md:h-[720px] md:w-[360px] md:rounded-[50px] md:border-[8px] md:border-white md:bg-black md:shadow-2xl md:ring-1 md:ring-black/5'
            : ''
        }`}
      >
        
        {/* Status Bar */}
        {statusBarVisible && activeApp !== 'wallet' && activeApp !== 'forum' && activeApp !== 'monitor' && (
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-[44px] flex justify-between items-center px-7 z-50 text-white">
            <span className="text-[15px] font-bold tracking-tight">{time}</span>
            <div className="flex items-center gap-1.5">
              {/* Signal Bars */}
              <div className="flex items-end gap-[2px] h-[10px] mb-[1px]">
                <div className="w-[3px] h-[3px] bg-current rounded-[0.5px]" />
                <div className="w-[3px] h-[5px] bg-current rounded-[0.5px]" />
                <div className="w-[3px] h-[7.5px] bg-current rounded-[0.5px]" />
                <div className="w-[3px] h-[10px] bg-current rounded-[0.5px]" />
              </div>
              {/* Wifi Icon */}
              <Wifi size={16} strokeWidth={3.8} className="opacity-100" />
              {/* Battery Icon */}
              <div className="flex items-center gap-[1px]">
                <div className="relative w-[22px] h-[11.5px] border border-current rounded-[3px] p-[1.5px]">
                  <div className="w-full h-full bg-current rounded-[1px]" />
                </div>
                <div className="w-[1.5px] h-[4px] bg-current rounded-r-[1px] opacity-50" />
              </div>
            </div>
          </div>
        )}
        
        {/* Screen Content */}
        <div className="phone-screen-root flex-1 relative bg-zinc-50 overflow-hidden">
          {activeApp === 'home' && (
            <HomeScreen 
              key="home" 
              onOpenApp={handleOpenApp} 
              userProfile={appData.userProfile}
              setUserProfile={(profile) => setAppData(prev => ({ ...prev, userProfile: profile }))}
              visualSettings={appData.visualSettings}
              setVisualSettings={(s) => setAppData(prev => ({ ...prev, visualSettings: s }))}
              appData={appData}
              setAppData={setAppData}
            />
          )}
          {activeApp === 'chat' && (
            <MainApp 
              key="chat"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              appData={appData}
              setAppData={setAppData}
              onOpenChat={handleOpenChat}
              onOpenGroupChat={(id) => {
                setSelectedGroupId(id);
                setActiveApp('group-chat-session');
              }}
              onOpenProfile={(id) => {
                setSelectedCharacterId(id);
                setActiveApp('character-profile');
              }}
              onAddCharacter={() => setActiveApp('add-character')}
              onBack={() => setActiveApp('home')}
              settings={settings}
              MomentsAppComponent={MomentsApp}
              formatMessagePreview={formatMessagePreview}
            />
          )}
          {activeApp === 'character-profile' && selectedCharacter && (
            <CharacterProfile
              character={selectedCharacter}
              onBack={() => setActiveApp('chat')}
              onChat={() => {
                setActiveApp('chat-session');
              }}
              onOpenMoments={() => {
                setCharacterMomentsBackApp('character-profile');
                setActiveApp('character-moments');
              }}
              onAddFriend={() => {
                alert('已发送好友请求');
              }}
              isFriend={true}
              groups={appData.groups}
              onUpdateGroup={(groupId) => {
                if (!selectedCharacterId) return;
                handlePatchCharacterById(selectedCharacterId, { groupId });
              }}
              onTogglePin={() => {
                if (!selectedCharacterId || !selectedCharacter) return;
                handlePatchCharacterById(selectedCharacterId, { isPinned: !selectedCharacter.isPinned });
              }}
            />
          )}
          {activeApp === 'character-moments' && selectedCharacter && (
            <CharacterMomentsProfile
              character={selectedCharacter}
              moments={appData.moments || []}
              onBack={() => setActiveApp(characterMomentsBackApp)}
            />
          )}
          <ChatSessionMount
            activeApp={activeApp}
            selectedCharacterId={selectedCharacterId}
            selectedGroupId={selectedGroupId}
            characters={appData.characters}
            chatGroups={appData.chatGroups || []}
            setChatGroups={(chatGroups) => setAppData(prev => ({ ...prev, chatGroups }))}
            chatHistory={appData.chatHistory}
            setChatHistory={(chatHistory) => setAppData(prev => ({ ...prev, chatHistory }))}
            settings={settings}
            userAvatar={appData.userProfile.avatar}
            userName={appData.userProfile.name}
            masks={appData.masks}
            favorites={appData.favorites}
            setFavorites={(f) => setAppData(prev => ({ ...prev, favorites: f }))}
            visualSettings={appData.visualSettings}
            setVisualSettings={(visualSettings) => setAppData(prev => ({ ...prev, visualSettings }))}
            groups={appData.groups}
            worldBook={appData.worldBooks || []}
            perception={currentCoupleSpace.perception}
            coupleSpace={currentCoupleSpace}
            callHistory={appData.callHistory || []}
            setCallHistory={(callHistory) => setAppData(prev => ({ ...prev, callHistory }))}
            savedDates={appData.savedDates || []}
            collectedDates={appData.collectedDates || []}
            setDatingRecords={({ savedDates, collectedDates }) =>
              setAppData(prev => ({
                ...prev,
                savedDates,
                collectedDates,
              }))
            }
            walletData={appData.walletData}
            setWalletData={(data) => setAppData(prev => ({ ...prev, walletData: data }))}
            updateCharacter={handleMergeCharacter}
            patchCharacter={handlePatchCharacterById}
            onBackToChat={() => setActiveApp('chat')}
            onViewForumPost={(postId) => {
              setSelectedForumPostId(postId);
              setActiveApp('forum');
            }}
            onPublishMoment={({ authorId, content, images }) => {
              console.info('[moment-special] onPublishMoment called', {
                authorId,
                content,
                imagesCount: images?.length || 0,
              });
              setAppData(prev => ({
                ...(console.info('[moment-special] moments latest', {
                  length: (prev.moments?.length || 0) + 1,
                  latestContent: content,
                }), prev),
                moments: [{
                  id: Date.now().toString(),
                  authorId,
                  content,
                  images,
                  timestamp: Date.now(),
                  likes: 0,
                  comments: []
                }, ...(prev.moments || [])]
              }));
            }}
            onOpenCharacterMoments={() => {
              setCharacterMomentsBackApp('chat-session');
              setActiveApp('character-moments');
            }}
            onStatusBarVisibilityChange={setStatusBarVisible}
            onAcceptCoupleSpaceInvite={handleAcceptCoupleSpaceInvite}
          />
          {activeApp === 'add-character' && (
            <AddCharacter
              key="add-character"
              onSave={handleAddCharacter}
              onBack={() => setActiveApp('chat')}
              groups={appData.groups}
            />
          )}
          {activeApp === 'settings' && (
            <SettingsApp 
              key="settings" 
              onBack={() => setActiveApp('home')} 
              settings={settings}
              setSettings={(s) => {
                setSettings(s);
                localStorage.setItem('ai_phone_settings', JSON.stringify(s));
              }}
            />
          )}
          {activeApp === 'sms' && (
            <SMSApp key="sms" onBack={() => setActiveApp('home')} />
          )}
          {activeApp === 'worldbook' && (
            <WorldBookManager 
              worldBooks={appData.worldBooks || []}
              characters={appData.characters}
              setWorldBooks={(wb) => setAppData(prev => ({ ...prev, worldBooks: wb }))}
              onBack={() => setActiveApp('home')}
              globalBackground={appData.visualSettings?.globalBackground || ''}
              onAddCharacter={(char) => {
                const newChar: Character = {
                  id: Date.now().toString(),
                  ...char,
                  lastTime: Date.now()
                };
                handleUpsertCharacter(newChar);
              }}
            />
          )}
          {activeApp === 'monitor' && (
            <MonitorApp 
              characters={appData.characters}
              onBack={() => setActiveApp('home')}
              visualSettings={appData.visualSettings}
            />
          )}
          {activeApp === 'customization' && (
            <CustomizationApp
              visualSettings={appData.visualSettings}
              setVisualSettings={(s) => setAppData(prev => ({ ...prev, visualSettings: s }))}
              onBack={() => setActiveApp('home')}
              onResetData={() => {
                localStorage.removeItem(STORAGE_KEYS.appData);
                resetCharacters();
                clearPersistedVisualSettings();
                window.location.reload();
              }}
              onExportData={() => {
                const data = JSON.stringify(appData);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'ai_phone_backup.json';
                a.click();
              }}
              onImportData={(data) => {
                try {
                  const parsed = JSON.parse(data);
                  setAppData({
                    ...parsed,
                    characters: sanitizePersistedCharacters(parsed.characters),
                    userProfile: parsed.userProfile
                      ? {
                          ...parsed.userProfile,
                          avatar: sanitizeTransientAssetValue(parsed.userProfile.avatar),
                        }
                      : parsed.userProfile,
                  });
                  alert('导入成功！');
                } catch (e) {
                  alert('导入失败，请检查数据格式。');
                }
              }}
              appData={appData}
              setAppData={setAppData}
              settings={settings}
              setSettings={setSettings}
            />
          )}
          {activeApp === 'couple-space' && (
            <CoupleSpaceApp
              appData={appData}
              setAppData={setAppData}
              onBack={() => setActiveApp('home')}
              settings={settings}
            />
          )}
          {activeApp === 'perception' && (
            <PerceptionView
              coupleSpace={currentCoupleSpace}
              updateSpace={handleUpdateCurrentCoupleSpace}
              onBack={() => setActiveApp('home')}
            />
          )}
          {activeApp === 'music' && (
            <MusicApp
              musicData={appData.musicData!}
              onUpdateMusicData={(data) => setAppData(prev => ({ ...prev, musicData: data }))}
              userAvatar={appData.userProfile.avatar}
              userName={appData.userProfile.name}
              character={couplePartnerCharacter}
              allCharacters={appData.characters}
              onBack={() => setActiveApp('home')}
              audioRef={audioRef}
            />
          )}
          {activeApp === 'forum' && (
            <ForumApp
              appData={appData}
              onUpdateAppData={(newData) => setAppData(prev => ({ ...prev, ...newData }))}
              onClose={() => setActiveApp('home')}
              onOpenChat={(characterId) => {
                setSelectedCharacterId(characterId);
                setActiveApp('chat-session');
              }}
              initialPostId={selectedForumPostId}
            />
          )}
          {activeApp === 'wallet' && (
            <WalletApp
              appData={appData}
              onUpdateAppData={(newData) => setAppData(prev => ({ ...prev, ...newData }))}
              onClose={() => setActiveApp('home')}
            />
          )}
        </div>

        <AnimatePresence>
          {appDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[200] flex items-center justify-center bg-black/35 p-5"
              onClick={() => {
                if (appDialog.kind === 'alert') {
                  closeAppDialog();
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="w-full max-w-[320px] overflow-hidden rounded-[28px] bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 pt-5 text-center">
                  <div className="text-[17px] font-semibold text-zinc-900">
                    {appDialog.kind === 'confirm' ? '确认操作' : appDialog.kind === 'prompt' ? '请输入内容' : '提示'}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-zinc-600">
                    {appDialog.message}
                  </div>
                </div>
                {appDialog.kind === 'prompt' && (
                  <div className="px-5 pt-4">
                    <input
                      autoFocus
                      value={appDialogInput}
                      onChange={(e) => setAppDialogInput(e.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-[15px] outline-none focus:border-zinc-900"
                    />
                  </div>
                )}
                <div className="mt-5 flex border-t border-zinc-100">
                  {(appDialog.kind === 'confirm' || appDialog.kind === 'prompt') && (
                    <button type="button" onClick={closeAppDialog} className="flex-1 px-4 py-3 text-[16px] font-medium text-zinc-500">
                      取消
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDialogConfirm}
                    className="flex-1 border-l border-zinc-100 px-4 py-3 text-[16px] font-semibold text-blue-500"
                  >
                    {appDialog.kind === 'confirm' ? '确定' : appDialog.kind === 'prompt' ? '完成' : '我知道了'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Home Indicator */}
        <div 
          className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[100px] h-[4px] bg-white/80 rounded-full cursor-pointer z-50 hover:bg-white transition-colors" 
          onClick={() => setActiveApp('home')} 
        />
      </div>
    </div>
  );
}

function AddCharacter({ onSave, onBack, groups }: { onSave: (char: Character) => void; onBack: () => void; groups: string[]; key?: string }) {
  const [view, setView] = useState<'edit' | 'import'>('edit');
  const [name, setName] = useState('');
  const [remarkName, setRemarkName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
  const [avatar, setAvatar] = useState(`https://picsum.photos/seed/${Math.random()}/200`);
  const [avatarDraft, setAvatarDraft] = useState('');
  const [setting, setSetting] = useState('');
  const [signature, setSignature] = useState('');
  const [openingRemark, setOpeningRemark] = useState('');
  const [groupId, setGroupId] = useState<string>('');
  const [importJson, setImportJson] = useState('');

  const handleSave = () => {
    if (!name.trim()) return alert('请输入角色姓名');
    onSave({
      id: Date.now().toString(),
      name,
      remarkName: remarkName.trim() || undefined,
      gender,
      avatar,
      setting,
      signature: signature.trim() || undefined,
      openingRemark,
      groupId: groupId || undefined,
    });
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(importJson);
      if (!data.name) throw new Error('缺少角色姓名');
      onSave({
        id: Date.now().toString(),
        name: data.name,
        remarkName: data.remarkName || undefined,
        gender: data.gender || 'other',
        avatar: data.avatar || DEFAULT_WHITE_AVATAR,
        setting: data.setting || '',
        signature: data.signature || undefined,
        openingRemark: data.openingRemark || '',
        groupId: data.groupId || undefined,
      });
    } catch (e: any) {
      alert('导入失败: ' + e.message);
    }
  };

  return (
    <motion.div 
      className="absolute inset-0 bg-white flex flex-col z-50"
    >
      <div className="min-h-[64px] pt-12 pb-3 px-4 border-b border-zinc-100 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={view === 'import' ? () => setView('edit') : onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold text-zinc-900">
            {view === 'edit' ? '创建角色' : '导入角色'}
          </h1>
        </div>
        <button 
          onClick={view === 'edit' ? handleSave : handleImport}
          className="text-zinc-900 font-semibold text-[15px] active:opacity-70"
        >
          {view === 'edit' ? '保存' : '导入'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {view === 'edit' ? (
          <div className="space-y-6">
            {/* Avatar */}
            <div className="bg-white rounded-[28px] border border-zinc-100 shadow-sm p-5 flex flex-col items-center gap-4">
              <ResolvedAssetImage value={avatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover bg-zinc-100 border-4 border-zinc-50 shadow-sm" />

              <div className="w-full max-w-[320px] space-y-3">
                <p className="text-[12px] text-zinc-400 text-center">支持链接、Markdown或HTML图片</p>
                <input
                  type="text"
                  placeholder="输入头像链接..."
                  value={avatarDraft}
                  onChange={e => setAvatarDraft(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2.5 text-[12px] outline-none focus:border-zinc-900"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const nextAvatar = avatarDraft.trim();
                      if (!nextAvatar) return;
                      setAvatar(extractImageUrls(nextAvatar)[0] || nextAvatar);
                      setAvatarDraft('');
                    }}
                    className="bg-zinc-900 text-white text-[14px] py-3 rounded-xl font-semibold active:opacity-90"
                  >
                    确认
                  </button>
                  <label className="bg-white text-zinc-700 text-[14px] py-3 rounded-xl font-medium text-center cursor-pointer border border-zinc-100 active:opacity-80">
                    上传文件
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setAvatar(reader.result as string);
                            setAvatarDraft('');
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="w-full flex flex-col items-center gap-0.5">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="角色姓名"
                  className="text-[15px] font-bold text-zinc-900 text-center bg-transparent border-none outline-none focus:ring-1 focus:ring-zinc-100 rounded px-2"
                />
                <span className="text-[10px] text-zinc-400">点击名称可修改</span>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">备注</label>
                <input
                  type="text"
                  value={remarkName}
                  onChange={e => setRemarkName(e.target.value)}
                  placeholder="例如：阿白、学长、小周"
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-zinc-900 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">性别</label>
                <div className="flex gap-2">
                  {(['male', 'female', 'other'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                    className={`flex-1 py-2.5 rounded-xl text-[14px] font-medium border transition-all ${gender === g ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}
                    >
                      {g === 'male' ? '男' : g === 'female' ? '女' : '其他'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">角色设定</label>
                <textarea 
                  value={setting}
                  onChange={e => setSetting(e.target.value)}
                  placeholder="写这个角色是谁、怎么说话、关系气质和核心设定..."
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-zinc-900 transition-colors min-h-[120px] resize-none"
                />
                <p className="text-[12px] text-zinc-400 ml-1">先写完整设定，后续可在设置里细化。</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">个性签名</label>
                <textarea
                  value={signature}
                  onChange={e => setSignature(e.target.value)}
                  placeholder="这个角色在资料页里显示的一句签名..."
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-zinc-900 transition-colors min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">开场白</label>
                <textarea 
                  value={openingRemark}
                  onChange={e => setOpeningRemark(e.target.value)}
                  placeholder="角色对你说的第一句话..."
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-zinc-900 transition-colors min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">分组</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setGroupId('')}
                    className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${!groupId ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}
                  >
                    无分组
                  </button>
                  {groups.map(g => (
                    <button
                      key={g}
                      onClick={() => setGroupId(g)}
                      className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${groupId === g ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => setView('import')}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-zinc-200 text-zinc-500 text-[14px] font-medium active:bg-zinc-50"
                >
                  <Upload size={18} />
                  从 JSON 导入角色
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500 ml-1">JSON 数据</label>
              <textarea 
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
                placeholder='{"name": "角色名", "setting": "角色设定", ...}'
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[13px] font-mono outline-none focus:border-blue-500 transition-colors min-h-[300px] resize-none"
              />
            </div>
            <p className="text-[12px] text-zinc-400 px-1">
              请粘贴符合格式的角色 JSON 数据。
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SMSApp({ onBack }: { onBack: () => void; key?: string }) {
  const [view, setView] = useState<'list' | 'chat'>('list');
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [input, setInput] = useState('');

  const [threads, setThreads] = useState([
    { id: 1, name: '10086', lastMsg: '您的话费余额不足，请及时充值。', time: '10:30', avatar: 'https://picsum.photos/seed/10086/200' },
    { id: 2, name: 'Apple 苹果', lastMsg: '您的 Apple ID 已在新的设备上登录。', time: '昨天', avatar: 'https://picsum.photos/seed/apple/200' },
    { id: 3, name: '快递助手', lastMsg: '您的快递已由菜鸟驿站代收，请凭码取件。', time: '星期五', avatar: 'https://picsum.photos/seed/kd/200' },
  ]);

  const [messages, setMessages] = useState<Record<number, any[]>>({
    1: [
      { id: 1, text: '您的话费余额不足，请及时充值。', role: 'other', time: '10:30' },
    ],
    2: [
      { id: 1, text: '您的 Apple ID 已在新的设备上登录。', role: 'other', time: '昨天' },
    ],
    3: [
      { id: 1, text: '您的快递已由菜鸟驿站代收，请凭码取件。', role: 'other', time: '星期五' },
    ]
  });

  const handleSend = () => {
    if (!input.trim() || !selectedThread) return;
    
    const newMsg = {
      id: Date.now(),
      text: input.trim(),
      role: 'me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => ({
      ...prev,
      [selectedThread.id]: [...(prev[selectedThread.id] || []), newMsg]
    }));
    
    setThreads(prev => prev.map(t => 
      t.id === selectedThread.id 
        ? { ...t, lastMsg: input.trim(), time: newMsg.time }
        : t
    ));
    
    setInput('');
  };

  return (
    <motion.div 
      className="absolute inset-0 bg-white flex flex-col"
    >
      {view === 'list' ? (
        <>
          <div className="pt-12 pb-4 px-4 border-b border-zinc-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <button onClick={onBack} className="text-blue-500 flex items-center -ml-2 p-1 active:opacity-70">
              <ChevronLeft size={26} />
              <span className="text-[17px]">编辑</span>
            </button>
            <h1 className="text-[17px] font-bold">信息</h1>
            <button className="text-blue-500 p-1 active:opacity-70">
              <Pencil size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2">
              <div className="bg-zinc-100/80 rounded-[10px] px-2 py-1.5 flex items-center gap-1.5 mb-4">
                <Search size={16} className="text-zinc-400 ml-1" />
                <input type="text" placeholder="搜索" className="bg-transparent outline-none text-[15px] w-full placeholder:text-zinc-500" />
              </div>
              {threads.map(thread => (
                <div 
                  key={thread.id} 
                  onClick={() => {
                    setSelectedThread(thread);
                    setView('chat');
                  }}
                  className="flex gap-3 py-2.5 border-b border-zinc-100/60 last:border-0 active:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <div className="w-[46px] h-[46px] rounded-full overflow-hidden bg-zinc-100 shrink-0">
                    <ResolvedAssetImage value={thread.avatar} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-[16px] text-zinc-900">{thread.name}</span>
                      <span className="text-zinc-400 text-[14px]">{thread.time}</span>
                    </div>
                    <p className="text-zinc-500 text-[14px] truncate">{thread.lastMsg}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="pt-12 pb-2 px-4 border-b border-zinc-100 flex items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <button onClick={() => setView('list')} className="text-blue-500 flex items-center gap-1">
              <ChevronLeft size={24} />
              <span className="text-[17px]">信息</span>
            </button>
            <div className="flex-1 flex flex-col items-center">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-100 mb-0.5">
                <ResolvedAssetImage value={selectedThread?.avatar} className="w-full h-full object-cover" />
              </div>
              <span className="text-[12px] font-medium">{selectedThread?.name}</span>
            </div>
            <div className="w-12" /> {/* Spacer */}
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#f2f2f7]">
            <div className="text-center py-4">
              <span className="text-[12px] text-zinc-400 font-medium">今天 10:30</span>
            </div>
            {(messages[selectedThread?.id] || []).map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2 rounded-[20px] text-[16px] ${
                  msg.role === 'me' 
                    ? 'bg-[#34C759] text-white rounded-br-none' 
                    : 'bg-[#e9e9eb] text-black rounded-bl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 bg-white border-t border-zinc-100 flex items-center gap-2">
            <button className="text-zinc-400"><ImageIcon size={24} /></button>
            <button className="text-zinc-400"><PlusCircle size={24} /></button>
            <div className="flex-1 bg-zinc-100 rounded-full px-4 py-1.5 border border-zinc-200">
              <input 
                type="text" 
                placeholder="iMessage" 
                className="bg-transparent outline-none text-[15px] w-full"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSend();
                  }
                }}
              />
            </div>
            <button 
              onClick={handleSend}
              className="bg-[#34C759] text-white rounded-full p-1.5 active:opacity-80"
            >
              <Send size={18} />
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}

function SettingsApp({ 
  onBack, 
  settings, 
  setSettings 
}: { 
  onBack: () => void; 
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  key?: string;
}) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ApiConfig>(DEFAULT_CONFIG);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Sync back to parent whenever localSettings changes
  useEffect(() => {
    setSettings(localSettings);
  }, [localSettings, setSettings]);

  const handleAddClick = () => {
    setEditingConfigId(null);
    setEditForm({
      id: Date.now().toString(),
      name: '',
      provider: '自定义 (Custom)',
      apiKey: '',
      baseUrl: '',
      model: '',
      temperature: 0.7,
    });
    setAvailableModels([]);
    setView('edit');
  };

  const handleEditClick = (config: ApiConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConfigId(config.id);
    setEditForm(config);
    setAvailableModels([]);
    setView('edit');
  };

  const handleSaveConfig = () => {
    if (editingConfigId) {
      setLocalSettings({
        ...localSettings,
        configs: localSettings.configs.map(c => c.id === editingConfigId ? editForm : c)
      });
    } else {
      setLocalSettings({
        ...localSettings,
        configs: [...localSettings.configs, editForm],
        activeConfigId: editForm.id
      });
    }
    setView('list');
  };

  const handleDeleteConfig = async () => {
    if (editingConfigId === 'default') return;
    if (await showInAppConfirm('确定要删除此配置吗？')) {
      const newConfigs = localSettings.configs.filter(c => c.id !== editingConfigId);
      setLocalSettings({
        ...localSettings,
        configs: newConfigs,
        activeConfigId: localSettings.activeConfigId === editingConfigId ? 'default' : localSettings.activeConfigId
      });
      setView('list');
    }
  };

  const handleFetchModels = async () => {
    if (isFetchingModels) return;
    setIsFetchingModels(true);
    setAvailableModels([]);
    try {
      let models: string[] = [];
      const isGemini = editForm.provider === 'Google Gemini' || (!editForm.baseUrl && editForm.provider === '自定义 (Custom)');
      
      if (isGemini) {
        const key = editForm.apiKey || process.env.GEMINI_API_KEY;
        if (!key) throw new Error('未配置 API Key，无法拉取模型');
        
        let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!res.ok) {
          res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
        }

        if (!res.ok) {
          throw new Error(`获取失败 (${res.status})，请检查 API Key 是否有效`);
        }

        const data = await res.json();
        const rawList = data.models || data.data || data;
        if (Array.isArray(rawList)) {
          models = rawList.map((m: any) => {
            const name = typeof m === 'string' ? m : m.name || m.id;
            return name ? name.replace('models/', '') : '';
          }).filter(m => m && (m.includes('gemini') || m.includes('learnlm')));
        }
      } else {
        if (!editForm.baseUrl) throw new Error('请先填写 Base URL');
        let baseUrl = editForm.baseUrl.replace(/\/$/, '');
        const headers: HeadersInit = { 'Accept': 'application/json' };
        if (editForm.apiKey) {
          headers['Authorization'] = `Bearer ${editForm.apiKey}`;
        }
        
        let res = await fetch(`${baseUrl}/models`, { headers });
        let contentType = res.headers.get('content-type');

        if ((!res.ok || (contentType && contentType.includes('text/html'))) && !baseUrl.endsWith('/v1')) {
          const retryUrl = `${baseUrl}/v1/models`;
          try {
            const retryRes = await fetch(retryUrl, { headers });
            const retryContentType = retryRes.headers.get('content-type');
            if (retryRes.ok && retryContentType && retryContentType.includes('application/json')) {
              res = retryRes;
              baseUrl = `${baseUrl}/v1`;
              setEditForm(prev => ({ ...prev, baseUrl: baseUrl }));
              contentType = retryContentType;
            }
          } catch (e) {}
        }

        if (!res.ok) {
          throw new Error(`获取失败 (${res.status})，请检查 Base URL 和 API Key`);
        }

        const data = await res.json();
        const rawList = data.data || data.models || data;
        if (Array.isArray(rawList)) {
          models = rawList.map((m: any) => {
            if (typeof m === 'string') return m;
            return m.id || m.name || m.model || String(m);
          }).filter(m => typeof m === 'string' && m.length > 0);
        } else if (typeof rawList === 'object' && rawList !== null) {
          models = Object.keys(rawList).filter(k => k !== 'object');
        } else {
          throw new Error('返回的数据格式不正确 (未找到模型列表)');
        }
      }

      // Remove duplicates and sort
      models = [...new Set(models)].sort();

      if (models.length === 0) throw new Error('未找到可用模型');

      setAvailableModels(models);
      alert(`成功拉取 ${models.length} 个模型！\n提示：清空输入框可查看完整列表。`);
    } catch (error: any) {
      console.error('Fetch models error:', error);
      alert(`拉取失败: ${error.message}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const isGemini = editForm.provider === 'Google Gemini' || (!editForm.baseUrl && editForm.provider === '自定义 (Custom)');
      
      if (isGemini) {
        const key = editForm.apiKey || process.env.GEMINI_API_KEY;
        if (!key) throw new Error('需要 API Key');
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!res.ok) throw new Error('连接失败，请检查 API Key');
        alert('连接成功！');
      } else {
        if (!editForm.baseUrl) throw new Error('请先填写 Base URL');
        let baseUrl = editForm.baseUrl.replace(/\/$/, '');
        const headers: HeadersInit = { 'Accept': 'application/json' };
        if (editForm.apiKey) {
          headers['Authorization'] = `Bearer ${editForm.apiKey}`;
        }
        
        let res = await fetch(`${baseUrl}/models`, { headers });
        let contentType = res.headers.get('content-type');

        // Auto-fix: If HTML response and URL doesn't end with /v1, try appending it
        if ((!res.ok || (contentType && contentType.includes('text/html'))) && !baseUrl.endsWith('/v1')) {
          const retryUrl = `${baseUrl}/v1/models`;
          try {
            const retryRes = await fetch(retryUrl, { headers });
            const retryContentType = retryRes.headers.get('content-type');
            if (retryRes.ok && retryContentType && retryContentType.includes('application/json')) {
              res = retryRes;
              baseUrl = `${baseUrl}/v1`;
              setEditForm(prev => ({ ...prev, baseUrl: baseUrl }));
              contentType = retryContentType;
            }
          } catch (e) {
            // Ignore retry error
          }
        }

        if (!res.ok) throw new Error('连接失败，请检查 Base URL 和 API Key');
        
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('服务器返回了非 JSON 格式的数据，请检查 Base URL 是否正确。');
        }
        
        alert('连接成功！');
      }
    } catch (error: any) {
      alert(`测试连接失败: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <motion.div 
      className="absolute inset-0 bg-[#f7f7f9] flex flex-col"
    >
      {view === 'list' ? (
        <>
          {/* List Header */}
          <div className="min-h-[64px] pt-12 pb-3 px-4 flex items-center justify-between z-10 bg-[#f7f7f9]">
            <button onClick={onBack} className="text-black active:opacity-70 p-1 -ml-1 flex items-center">
              <ChevronLeft size={26} />
            </button>
            <span className="text-black font-semibold text-[16px]">API 设置</span>
            <button onClick={handleAddClick} className="text-black active:opacity-70 p-1">
              <Plus size={26} />
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto px-4 py-2 pb-20">
            <p className="text-[13px] text-zinc-500 mb-4 leading-relaxed">
              配置大语言模型 API，角色将使用选中的 API 进行回复。
            </p>
            <div className="space-y-3">
              {localSettings.configs.map(config => (
                <div 
                  key={config.id}
                  onClick={() => setLocalSettings({...localSettings, activeConfigId: config.id})}
                  className={`relative bg-white rounded-2xl p-4 border-2 transition-all cursor-pointer ${localSettings.activeConfigId === config.id ? 'border-zinc-900 shadow-md' : 'border-transparent shadow-sm'}`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 shrink-0">
                      <Cpu size={28} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[16px] font-bold text-zinc-900 truncate">{config.name}</h3>
                        {localSettings.activeConfigId === config.id && (
                          <div className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center text-white shrink-0">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p className="text-[12px] text-zinc-400 truncate mt-0.5">
                        {config.baseUrl || 'https://generativelanguage.googleapis.com'}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-zinc-50 pt-3 flex items-end justify-between">
                    <div className="space-y-1">
                      <p className="text-[12px] text-zinc-400">
                        模型: {config.model || '未设置'}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => handleEditClick(config, e)}
                      className="text-zinc-300 active:text-zinc-500 p-1 shrink-0"
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Edit Header */}
          <div className="min-h-[64px] pt-12 pb-3 px-4 flex items-center justify-between z-10 bg-white">
            <button onClick={() => setView('list')} className="text-black active:opacity-70 p-1 -ml-1 flex items-center">
              <ChevronLeft size={26} />
            </button>
            <span className="text-black font-semibold text-[16px]">{editingConfigId ? '编辑 API' : '添加 API'}</span>
            <div className="flex items-center gap-2">
              {editingConfigId && editingConfigId !== 'default' && (
                <button onClick={handleDeleteConfig} className="text-red-500 p-1.5 active:opacity-70">
                  <Trash2 size={20} />
                </button>
              )}
              <button onClick={handleSaveConfig} className="text-zinc-900 bg-zinc-100 rounded-full p-1.5 active:opacity-70">
                <Save size={20} />
              </button>
            </div>
          </div>

          {/* Edit Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-white pb-20">
            {/* Provider */}
            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">提供商 (Provider)</label>
              <div className="relative">
                <select 
                  value={editForm.provider || '自定义 (Custom)'}
                  onChange={e => setEditForm({...editForm, provider: e.target.value})}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-[15px] text-zinc-900 appearance-none outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="自定义 (Custom)">自定义 (Custom)</option>
                  <option value="Google Gemini">Google Gemini</option>
                  <option value="OpenAI">OpenAI</option>
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">配置名称</label>
              <input 
                type="text"
                value={editForm.name}
                onChange={e => setEditForm({...editForm, name: e.target.value})}
                placeholder="例如：我的 OpenAI 接口"
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-[15px] text-zinc-900 outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-400"
              />
            </div>

            {/* Base URL */}
            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">Base URL 基础网址</label>
              <div className="relative flex items-center">
                <Link2 size={18} className="absolute left-3 text-zinc-400" />
                <input 
                  type="text"
                  value={editForm.baseUrl}
                  onChange={e => setEditForm({...editForm, baseUrl: e.target.value})}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl pl-10 pr-3 py-3 text-[15px] text-zinc-900 outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-400"
                />
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">API Key API 密钥</label>
              <div className="relative flex items-center">
                <Key size={18} className="absolute left-3 text-zinc-400" />
                <input 
                  type="password"
                  value={editForm.apiKey}
                  onChange={e => setEditForm({...editForm, apiKey: e.target.value})}
                  placeholder="sk-..."
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl pl-10 pr-3 py-3 text-[15px] text-zinc-900 outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-400"
                />
              </div>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[13px] text-zinc-500">默认模型 (Model)</label>
                <button 
                  onClick={handleFetchModels}
                  disabled={isFetchingModels}
                  className="text-blue-500 text-[13px] flex items-center gap-1 active:opacity-70 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isFetchingModels ? "animate-spin" : ""} />
                  {isFetchingModels ? '拉取中...' : '拉取模型'}
                </button>
              </div>
              <div className="relative">
                <input 
                  type="text"
                  value={editForm.model}
                  onChange={e => setEditForm({...editForm, model: e.target.value})}
                  placeholder="例如：gpt-4o"
                  list="model-list"
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-[15px] text-zinc-900 outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-400"
                />
                {availableModels.length > 0 && (
                  <div className="mt-1 flex justify-between items-center px-1">
                    <span className="text-[11px] text-zinc-400">已拉取 {availableModels.length} 个模型</span>
                    <button 
                      onClick={() => setEditForm({...editForm, model: ''})}
                      className="text-[11px] text-zinc-900 active:opacity-70"
                    >
                      清空以查看全部
                    </button>
                  </div>
                )}
                {availableModels.length > 0 && (
                  <datalist id="model-list">
                    {availableModels.map(m => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                )}
              </div>
            </div>

            {/* Temperature */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <label className="text-[13px] text-zinc-500">温度参数 (Temperature)</label>
                <span className="text-[14px] text-zinc-900 font-medium">{editForm.temperature?.toFixed(1) || '0.7'}</span>
              </div>
              <input 
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={editForm.temperature ?? 0.7}
                onChange={e => setEditForm({...editForm, temperature: parseFloat(e.target.value)})}
                className="w-full accent-zinc-900 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>精确 (0.0)</span>
                <span>创造性 (2.0)</span>
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="pt-4 pb-8">
              <button 
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full bg-zinc-50 text-zinc-600 border border-zinc-200 font-medium text-[15px] py-3.5 rounded-xl active:bg-zinc-100 transition-colors disabled:opacity-50"
              >
                {isTesting ? '测试中...' : '测试连接'}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}






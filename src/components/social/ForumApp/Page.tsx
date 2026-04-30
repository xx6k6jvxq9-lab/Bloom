import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Bell, User, PenSquare, Heart, MessageCircle, Share2, 
  MoreHorizontal, Image as ImageIcon, Send, X, 
  ThumbsUp, Flag, Trash2, Edit2, MessageSquare, Flame, Clock,
  Camera, Check, LogOut, Key, Settings, Repeat, BarChart2, Feather,
  CheckCircle2, ArrowLeft, Home, Mail, Plus, Bookmark, Link2, AlertTriangle
} from 'lucide-react';
import { AppDataExtended, ForumPost, ForumComment, ForumNotification, UserProfileExtended, Character, ForumData, AppSettings, ForumTempChatSession, ForumTempChatMessage, ForumTempChatPendingReply, ForumRuntimeAuthorProfile, ForumSpectatorSettings } from '../../../types';
import { usePersistentFieldActions } from '../../../features/persistence/usePersistentFieldActions';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';
import { createCharacterDirectory } from '../../../features/character-domain/useCharacterDirectory';
import { buildInitialForumSeedPosts, FORUM_SEED_NPC_PROFILES, getForumSeedAuthorProfile, registerForumRuntimeAuthorProfile } from '../../../features/forum-domain/seedThreadsCatalog';
import { appendRepliesToForumThreadV2, legacyForumPostToThreadV2, forumThreadV2ToLegacyPost } from '../../../features/forum-domain/adapters';
import { FORUM_CHANNEL_LABELS, FORUM_THREAD_TYPE_LABELS } from '../../../features/forum-domain/constants';
import type { ForumChannel, ForumThreadType } from '../../../features/forum-domain/types';
import { buildCharacterForumHabit, buildForumCharacterHandle, buildForumCharacterPostTitle, buildReadableForumHandle } from '../../../features/forum-domain/characterForumPersona';
import { getForumIdentityBadgeMeta, isCurrentUserCommentAuthor as isCurrentUserCommentOwner, isCurrentUserPostAuthor as isCurrentUserPostOwner, resolveForumCommentIdentity, resolveForumPostIdentity } from '../../../features/forum-domain/forumIdentity';
import { buildDefaultSpectatorSettings, buildSpectatorPostDrafts, SPECTATOR_BOARD_AUTHOR_PREFIX, SPECTATOR_BOARD_CATEGORY } from '../../../features/forum-domain/spectatorBoard';
import { SpectatorSettingsView } from './SpectatorSettingsView';
import { ForumResolvedImage as ResolvedImage } from './ForumResolvedImage';
import { ForumCommentItem } from './ForumCommentItem';
import { ForumPostCard } from './ForumPostCard';
import { ForumHomeHeader } from './ForumHomeHeader';
import { ForumTempChatView } from './ForumTempChatView';
import { resolveSceneTextApiConfig } from '../../../services/ai/apiCenter/resolveSceneApiConfig';
import { generateForumReplies } from '../../../services/forum/generateForumReplies';
import { generateForumThreads, type GeneratedForumAuthorDraft } from '../../../services/forum/generateForumThreads';
import { generateForumTempReply } from '../../../services/forum/generateForumTempReply';
import { generateMomentPostContent } from '../../../services/moments/generators';
import { extractImageUrls, showInAppConfirm } from '../../../utils';

type ForumAppProps = {
  appData: AppDataExtended;
  onUpdateAppData: (newData: AppDataExtended) => void;
  onClose: () => void;
  settings: AppSettings;
  onOpenChat?: (characterId: string) => void;
  initialPostId?: string | null;
};

type ForumAuthor = {
  id: string;
  name: string;
  avatar: string;
  handle?: string;
  bio?: string;
  description?: string;
  persona?: string;
  speakingStyle?: string;
  preferredMove?: string;
};

type ForumNotice = {
  tone: 'info' | 'error';
  message: string;
};

const FORUM_CHANNEL_TABS = [
  { id: 'junction', label: '交界', blurb: '跨世界公共区' },
  { id: 'present', label: '今世', blurb: '校园打工和现实树洞' },
  { id: 'oldDynasty', label: '旧朝', blurb: '名分礼法和宅院弯话' },
  { id: 'xianmen', label: '仙门', blurb: '情劫心魔和破戒现场' },
  { id: 'otherworld', label: '异域', blurb: '冒险队和种族误读' },
  { id: 'starSea', label: '星海', blurb: '权限白名单和高冷越界' },
  { id: 'weird', label: '怪谈', blurb: '规则异常和目击记录' },
  { id: 'cyber', label: '赛博城', blurb: '日志监控和越权关系' },
] as const;

type ForumChannelTabId = typeof FORUM_CHANNEL_TABS[number]['id'];

const ANIME_AVATAR_STYLES = ['lorelei', 'adventurer'] as const;

function buildAnimeAvatar(seed: string, label?: string) {
  const style = ANIME_AVATAR_STYLES[hashString(seed) % ANIME_AVATAR_STYLES.length];
  const safeSeed = `${label || seed}-${hashString(seed).toString(36).slice(0, 4)}`;
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(safeSeed)}&backgroundType=gradientLinear&backgroundColor=fce7f3,dbeafe,e9d5ff,ccfbf1`;
}

function looksMachineGeneratedHandle(value?: string) {
  if (!value) return true;
  return !/\p{Script=Han}/u.test(value)
    || /forum_runtime|generated-post|seed-|[_]{1,}|^\w+\d{3,}$/i.test(value)
    || value.length > 12;
}

const formatForumHandle = (author: ForumAuthor) => {
  if (author.handle && !looksMachineGeneratedHandle(author.handle)) return `@${author.handle}`;
  if (author.id.startsWith('forum_runtime_') || author.id.startsWith('generated-') || !author.handle) {
    return `@${buildReadableForumHandle({ id: author.id, name: author.name })}`;
  }
  return `@${author.id.replace('user_', 'u').replace('char_', 'c')}`;
};

function formatCurrentUserForumHandle(userId: string) {
  if (!userId.trim()) return '@未设置ID';
  return `@${userId.replace(/^@/, '').trim()}`;
}

const VALID_THREAD_TYPE_SET = new Set<ForumThreadType>(['normal', 'rift', 'sameTopic', 'commission', 'reversal', 'ownerUpdate']);

function getForumThreadTypeMeta(threadType?: string) {
  const normalized = typeof threadType === 'string' && VALID_THREAD_TYPE_SET.has(threadType as ForumThreadType)
    ? threadType as ForumThreadType
    : 'normal';

  return {
    label: FORUM_THREAD_TYPE_LABELS[normalized],
    className: 'border border-zinc-200 bg-white text-zinc-700',
  };
}

const resolveSeedFallbackTheme = (seedId: string) => {
  if (seedId.includes('present')) return 'notionists-neutral';
  if (seedId.includes('old')) return 'lorelei-neutral';
  if (seedId.includes('xian')) return 'adventurer';
  if (seedId.includes('other')) return 'adventurer-neutral';
  if (seedId.includes('star')) return 'bottts-neutral';
  if (seedId.includes('weird')) return 'croodles-neutral';
  if (seedId.includes('cyber')) return 'pixel-art';
  return 'thumbs';
};

const seedFallbackAvatar = (seed: string, label?: string) =>
  buildAnimeAvatar(seed, label);

const FORUM_CHANNEL_LABEL_TO_ID = Object.entries(FORUM_CHANNEL_LABELS).reduce<Record<string, ForumChannel>>((acc, [channel, label]) => {
  acc[label] = channel as ForumChannel;
  return acc;
}, {});

const inferForumChannelFromCategory = (category: string): ForumChannel =>
  FORUM_CHANNEL_LABEL_TO_ID[category] || 'junction';

const buildLegacySeedFallback = (id: string): ForumAuthor | null => {
  if (!id.startsWith('seed-')) return null;

  const friendlyName = id.includes('-mask-') ? '匿名路过' : '匿名楼主';
  const suffixPool = ['先看后评', '别急我路过', '今天不掉马', '瓜先吃一口', '只看不站队', '装作普通网友'];
  const pick = id.length % suffixPool.length;

  return {
    id,
    name: friendlyName,
    handle: suffixPool[pick],
    avatar: seedFallbackAvatar(id, friendlyName),
    description: '界隙匿名马甲',
  };
};

function formatRelativeTime(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function normalizeForumPostFingerprint(value: string) {
  return value
    .replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, '')
    .slice(0, 24)
    .toLowerCase();
}

const DEFAULT_SPECTATOR_SETTINGS = buildDefaultSpectatorSettings();

function areStringListsEqual(left: string[] = [], right: string[] = []) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function isLegacyTempChatGreeting(text: string) {
  const normalized = text.trim();
  return [
    '你点进来了？那就在这说。',
    '说吧，我看着。',
    '你点进来了？要说什么就说。',
    '你找我有事？',
  ].includes(normalized) || normalized.includes('你要接着“') || normalized.includes('帖子那边我看到了。');
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildTempChatReplyPolicy(author: ForumAuthor, session: ForumTempChatSession) {
  const seed = hashString(`${author.id}:${session.messages.length}:${session.updatedAt}`);
  const fingerprint = `${author.name} ${author.bio || ''} ${author.description || ''}`;
  const coldBias = /高冷|权限|监控|规则|冷|已读不回|不想上班|怪谈|赛博/.test(fingerprint);
  const ghostBias = /momo|门口吃瓜|已读乱回/.test(fingerprint);
  const roll = seed % 100;

  if (coldBias && roll < 18) {
    return {
      behavior: 'ghost' as const,
      readDelayMs: 4000 + (seed % 5000),
    };
  }

  if ((coldBias && roll < 58) || (!coldBias && roll < 25)) {
    return {
      behavior: 'delayed' as const,
      readDelayMs: 3000 + (seed % 4000),
      replyDelayMs: 12000 + (seed % 18000),
    };
  }

  if (ghostBias && roll < 10) {
    return {
      behavior: 'ghost' as const,
      readDelayMs: 3000 + (seed % 4000),
    };
  }

  return {
    behavior: 'instant' as const,
    readDelayMs: 1200 + (seed % 1800),
    replyDelayMs: 2200 + (seed % 2800),
  };
}

function buildForumNpcBridgeCharacter(author: ForumAuthor): Character {
  const profileText = author.description || author.bio || `${author.name}是在界隙论坛长期活跃的 AI 网友。`;
  return {
    id: author.id,
    name: author.name,
    gender: 'other',
    avatar: author.avatar,
    setting: profileText,
    corePersona: profileText,
    signature: author.bio || author.description || `${author.name}常驻论坛，回帖风格很稳定。`,
    openingRemark: '你来得挺快。现在我们换个地方继续聊。',
    lastMessage: '你来得挺快。现在我们换个地方继续聊。',
    lastTime: Date.now(),
    groupId: '论坛网友',
    maxReplies: 3,
    autoReplyEnabled: true,
    postFrequency: 'medium',
    showTime: true,
  };
}

export default function ForumApp({ appData, onUpdateAppData, onClose, settings, onOpenChat, initialPostId }: ForumAppProps) {
  const forumTopInsetStyle = { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' };
  const forumBottomInsetStyle = { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' };
  const forumBottomNavStyle = { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' };
  const [activeTab, setActiveTab] = useState<'home' | 'hot' | 'notification' | 'profile'>('home');
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'editor' | 'edit-profile' | 'user-profile' | 'temp-chat' | 'follow-list' | 'spectator-settings'>('list');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [followListMode, setFollowListMode] = useState<'following' | 'followers'>('following');
  const [followListUserId, setFollowListUserId] = useState<string | null>(null);
  const [followListSearch, setFollowListSearch] = useState('');

  useEffect(() => {
    if (initialPostId) {
      setSelectedPostId(initialPostId);
      setCurrentView('detail');
    }
  }, [initialPostId]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [activeTempChatUserId, setActiveTempChatUserId] = useState<string | null>(null);
  const [homeFilter, setHomeFilter] = useState<'latest' | 'hot'>('latest');
  const [forumBoard, setForumBoard] = useState<'public' | 'spectator'>('public');
  const [threadTypeFilter, setThreadTypeFilter] = useState<'all' | ForumThreadType>('all');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [activeChannel, setActiveChannel] = useState<ForumChannelTabId>('junction');
  const [profileTab, setProfileTab] = useState<'posts' | 'replies' | 'likes'>('posts');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Editor State
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorImages, setEditorImages] = useState<string[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [editId, setEditId] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editAvatarUrlInput, setEditAvatarUrlInput] = useState('');
  const [editorIdentity, setEditorIdentity] = useState<'self' | 'anonymous'>('self');
  const [commentIdentity, setCommentIdentity] = useState<'self' | 'anonymous'>('self');

  // Post Detail State
  const [mainReplyText, setMainReplyText] = useState('');
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);
  const [forumAiLoadingPostId, setForumAiLoadingPostId] = useState<string | null>(null);
  const [feedRefreshLoading, setFeedRefreshLoading] = useState(false);
  const [tempChatInput, setTempChatInput] = useState('');
  const [tempChatLoading, setTempChatLoading] = useState(false);
  const [forumNotice, setForumNotice] = useState<ForumNotice | null>(null);
  const [spectatorSubjectName, setSpectatorSubjectName] = useState('');
  const [spectatorRelationshipSummary, setSpectatorRelationshipSummary] = useState('');
  const [spectatorTone, setSpectatorTone] = useState<ForumSpectatorSettings['tone']>('吃瓜围观');
  const [spectatorAutoGenerate, setSpectatorAutoGenerate] = useState(false);
  const [spectatorCharacterIds, setSpectatorCharacterIds] = useState<string[]>([]);

  // Share State
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [messageTab, setMessageTab] = useState<'chats' | 'activity'>('chats');
  const [chatListTab, setChatListTab] = useState<'mutual' | 'strangers'>('strangers');

  const currentUser = appData.userProfile;
  const forumData: ForumData = appData.forumData || {
    posts: [],
    notifications: [],
    followedUsers: [],
    followerMap: {},
    tempChats: {},
    runtimeAuthorProfiles: {},
    composerDraft: null,
    spectatorSettings: DEFAULT_SPECTATOR_SETTINGS,
  };
  const posts = forumData.posts || [];
  const notifications = forumData.notifications || [];
  const followedUsers = forumData.followedUsers || [];
  const followerMap = forumData.followerMap || {};
  const tempChats = forumData.tempChats || {};
  const runtimeAuthorProfiles = forumData.runtimeAuthorProfiles || {};
  const composerDraft = forumData.composerDraft || null;
  const spectatorSettings = forumData.spectatorSettings || DEFAULT_SPECTATOR_SETTINGS;
  const resolvePostIdentity = (post: ForumPost) => resolveForumPostIdentity(post, getCharacterById);
  const resolveCommentIdentity = (comment: ForumComment) => resolveForumCommentIdentity(comment, getCharacterById);
  const isCurrentUserPostAuthor = (authorId: string, post?: ForumPost) => isCurrentUserPostOwner(currentUser.id, authorId, post);
  const isCurrentUserCommentAuthor = (authorId: string, comment?: ForumComment) => isCurrentUserCommentOwner(currentUser.id, authorId, comment);
  const buildAnonymousPostAuthorId = () => `seed-anon-${currentUser.id}-${activeChannel}-${Date.now()}`;
  const buildAnonymousCommentAuthorId = () => `seed-anon-${currentUser.id}-comment-${activeChannel}-${Date.now()}`;
  const appDataRef = useRef(appData);
  const forumDataRef = useRef(forumData);
  const postsRef = useRef(posts);
  const attemptedDetailExpansionRef = useRef<Set<string>>(new Set());
  const feedRefreshLockRef = useRef(false);
  const tempReplyProcessingRef = useRef<Set<string>>(new Set());
  const profileAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const { setRemoteUrl, setUploadedFile } = usePersistentFieldActions();
  const { resolvedUrl: resolvedCurrentUserAvatarUrl } = useResolvedPersistentValue(currentUser.avatar);
  const { resolvedUrl: resolvedEditAvatarUrl } = useResolvedPersistentValue(editAvatar || currentUser.avatar);
  const { getCharacterById } = createCharacterDirectory({ characters: appData.characters });
  const activeChannelMeta = FORUM_CHANNEL_TABS.find((item) => item.id === activeChannel) || FORUM_CHANNEL_TABS[0];
  const activeThreadTypeLabel = threadTypeFilter === 'all' ? '全部帖型' : FORUM_THREAD_TYPE_LABELS[threadTypeFilter];
  const forumConfig = resolveSceneTextApiConfig({
    settings,
    scene: 'forum',
  }).runtimeConfig;
  const hasUnreadForumMessages = Object.values(tempChats).some((session) => {
    const lastMessage = session.messages[session.messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'npc') return false;
    return lastMessage.timestamp > (session.viewerLastSeenAt || 0);
  });
  const showForumNotice = (message: string, tone: ForumNotice['tone'] = 'info') => {
    setForumNotice({ message, tone });
  };

  useEffect(() => {
    appDataRef.current = appData;
    forumDataRef.current = forumData;
    postsRef.current = posts;
  }, [appData, forumData, posts]);

  useEffect(() => {
    if (!forumNotice) return undefined;
    const timer = window.setTimeout(() => {
      setForumNotice((current) => (current?.message === forumNotice.message ? null : current));
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [forumNotice]);

  useEffect(() => {
    Object.values(runtimeAuthorProfiles).forEach((profile) => {
      registerForumRuntimeAuthorProfile(profile);
    });
  }, [runtimeAuthorProfiles]);

  useEffect(() => {
    const nextSubjectName = spectatorSettings.subjectName || '';
    const nextRelationshipSummary = spectatorSettings.relationshipSummary || '';
    const nextTone = spectatorSettings.tone || '吃瓜围观';
    const nextAutoGenerate = !!spectatorSettings.autoGenerate;
    const nextCharacterIds = spectatorSettings.selectedCharacterIds || [];

    setSpectatorSubjectName((current) => current === nextSubjectName ? current : nextSubjectName);
    setSpectatorRelationshipSummary((current) => current === nextRelationshipSummary ? current : nextRelationshipSummary);
    setSpectatorTone((current) => current === nextTone ? current : nextTone);
    setSpectatorAutoGenerate((current) => current === nextAutoGenerate ? current : nextAutoGenerate);
    setSpectatorCharacterIds((current) => areStringListsEqual(current, nextCharacterIds) ? current : nextCharacterIds);
  }, [spectatorSettings.subjectName, spectatorSettings.relationshipSummary, spectatorSettings.tone, spectatorSettings.autoGenerate, spectatorSettings.selectedCharacterIds]);

  const buildForumDataState = (overrides: Partial<ForumData> = {}): ForumData => ({
    posts: overrides.posts ?? postsRef.current,
    notifications: overrides.notifications ?? (forumDataRef.current.notifications || []),
    followedUsers: overrides.followedUsers ?? (forumDataRef.current.followedUsers || []),
    followerMap: overrides.followerMap ?? (forumDataRef.current.followerMap || {}),
    tempChats: overrides.tempChats ?? (forumDataRef.current.tempChats || {}),
    runtimeAuthorProfiles: overrides.runtimeAuthorProfiles ?? (forumDataRef.current.runtimeAuthorProfiles || {}),
    composerDraft: overrides.composerDraft ?? (forumDataRef.current.composerDraft || null),
    spectatorSettings: overrides.spectatorSettings ?? (forumDataRef.current.spectatorSettings || DEFAULT_SPECTATOR_SETTINGS),
  });

  const mergeRuntimeAuthorProfiles = (profiles: ForumRuntimeAuthorProfile[]) => {
    const nextProfiles = {
      ...(forumDataRef.current.runtimeAuthorProfiles || {}),
    };

    profiles.forEach((profile) => {
      registerForumRuntimeAuthorProfile(profile);
      nextProfiles[profile.id] = profile;
    });

    return nextProfiles;
  };

  useEffect(() => {
    if (posts.length > 0) return;

    const initialSeedPosts = buildInitialForumSeedPosts(currentUser.id, 24);
    onUpdateAppData({
      ...appData,
      forumData: buildForumDataState({
        posts: initialSeedPosts,
      })
    });
  }, [posts.length, currentUser.id]);

  useEffect(() => {
    if (currentView !== 'detail' || !selectedPostId || !forumConfig) return;
    if (forumAiLoadingPostId === selectedPostId) return;

    const post = posts.find((item) => item.id === selectedPostId);
    if (!post || post.aiDetailExpanded || attemptedDetailExpansionRef.current.has(post.id)) return;

    attemptedDetailExpansionRef.current.add(post.id);
    const targetReplyCount = Math.max(20 - post.comments.length, 12);
    void triggerForumAiReplies(post.id, {
      replyCount: targetReplyCount,
      replyMode: post.comments.length > 0 ? 'mixed' : 'independent_only',
      markDetailExpanded: true,
    });
  }, [currentView, selectedPostId, posts, forumConfig, forumAiLoadingPostId]);

  const getAuthor = (id: string): ForumAuthor => {
    if (id === currentUser.id) {
      return {
        ...currentUser,
        handle: currentUser.id.replace(/^@/, '').trim(),
      };
    }
    const runtimeProfile = runtimeAuthorProfiles[id];
    const seedProfile = getForumSeedAuthorProfile(id);
    const character = getCharacterById(id);
    if (character) {
      const forumHabit = buildCharacterForumHabit(character);
      return {
        id: character.id,
        name: character.name,
        avatar: runtimeProfile?.avatar || seedProfile?.avatar || character.avatar,
        handle: runtimeProfile?.handle || seedProfile?.handle || buildForumCharacterHandle(character),
        bio: runtimeProfile?.bio || seedProfile?.bio || character.signature || '',
        description: runtimeProfile?.bio || seedProfile?.bio || character.signature || character.corePersona || character.openingRemark || '',
        persona: runtimeProfile?.persona || forumHabit.persona,
        speakingStyle: runtimeProfile?.speakingStyle || forumHabit.speakingStyle,
        preferredMove: runtimeProfile?.preferredMove || forumHabit.preferredMove,
      };
    }

    if (runtimeProfile) {
      return {
        id: runtimeProfile.id,
        name: runtimeProfile.name,
        avatar: runtimeProfile.avatar,
        handle: runtimeProfile.handle,
        bio: runtimeProfile.bio,
        description: runtimeProfile.bio,
        persona: runtimeProfile.persona,
        speakingStyle: runtimeProfile.speakingStyle,
        preferredMove: runtimeProfile.preferredMove,
      };
    }

    if (seedProfile) {
      return {
        id: seedProfile.id,
        name: seedProfile.name,
        avatar: seedProfile.avatar,
        handle: seedProfile.handle,
        description: seedProfile.bio,
      };
    }

  const seedFallback = buildLegacySeedFallback(id);
  if (seedFallback) {
    return seedFallback;
  }

    if (id.startsWith(SPECTATOR_BOARD_AUTHOR_PREFIX)) {
      return {
        id,
        name: '围观群众',
        avatar: seedFallbackAvatar(id, '围观'),
        handle: '楼里吃瓜',
        description: '围观板块常驻发帖人',
      };
    }
    
    return {
      id,
      name: id.startsWith('forum_runtime_') ? `网友${id.slice(-4)}` : `用户${id.slice(-4)}`,
      avatar: seedFallbackAvatar(id, id.startsWith('forum_runtime_') ? id.slice(-2).toUpperCase() : id.slice(-2)),
      handle: id.startsWith('forum_runtime_') ? buildReadableForumHandle({
        id,
        name: `网友${id.slice(-4)}`,
      }) : undefined,
    };
  };

  const canOpenForumPrivateChat = (authorId: string) => {
    if (authorId === currentUser.id) return false;
    return !!runtimeAuthorProfiles[authorId] || !!getForumSeedAuthorProfile(authorId);
  };

  const resolveRecentForumPostForAuthor = (authorId: string) => (
    [...postsRef.current]
      .filter((post) => post.authorId === authorId || post.comments.some((comment) => comment.authorId === authorId))
      .sort((a, b) => b.timestamp - a.timestamp)[0] || null
  );

  const inferAuthorPreferredMove = (authorId: string) => {
    const recentComments = [...postsRef.current]
      .flatMap((post) => post.comments.filter((comment) => comment.authorId === authorId))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 4);

    if (recentComments.some((comment) => /笑死|哈哈|吃瓜|围观|看戏/.test(comment.content))) {
      return '常常边看戏边接梗';
    }
    if (recentComments.some((comment) => /不一定|未必|先别|我不信|存疑/.test(comment.content))) {
      return '更爱泼冷水和提怀疑';
    }
    if (recentComments.some((comment) => /建议|先去|最好|可以|别硬撑/.test(comment.content))) {
      return '习惯认真给建议';
    }
    if (recentComments.some((comment) => /就是|明显|本来就|我就说/.test(comment.content))) {
      return '喜欢站队补刀';
    }
    return undefined;
  };

  const pickSupplementalForumCharacters = (channel: ForumChannel) => {
    const now = Date.now();

    return appDataRef.current.characters
      .filter((character) => {
        const frequency = character.postFrequency || 'medium';
        if (frequency === 'none') return false;

        const recentPosts = postsRef.current.filter((post) => post.authorId === character.id);
        const latestPost = recentPosts.sort((a, b) => b.timestamp - a.timestamp)[0];
        if (latestPost && now - latestPost.timestamp > 7 * 24 * 60 * 60 * 1000) {
          return false;
        }

        const sameChannelActivity = postsRef.current.some((post) => (
          post.authorId === character.id
          && inferForumChannelFromCategory(post.category) === channel
          && now - post.timestamp < 3 * 24 * 60 * 60 * 1000
        ));

        const habit = buildCharacterForumHabit(character, channel);
        return sameChannelActivity || frequency === 'high' || habit.affinity.includes(channel);
      })
      .sort((a, b) => {
        const aHabit = buildCharacterForumHabit(a, channel);
        const bHabit = buildCharacterForumHabit(b, channel);
        const aScore = (aHabit.affinity.includes(channel) ? 3 : 0) + ((a.postFrequency || 'medium') === 'high' ? 2 : 0);
        const bScore = (bHabit.affinity.includes(channel) ? 3 : 0) + ((b.postFrequency || 'medium') === 'high' ? 2 : 0);
        return bScore - aScore;
      })
      .slice(0, 3);
  };

  const openForumPrivateChat = (authorId: string) => {
    if (authorId === currentUser.id) return;
    if (!canOpenForumPrivateChat(authorId)) return;
    const existingSession = tempChats[authorId];
    const initialSession: ForumTempChatSession = existingSession
      ? {
          ...existingSession,
          messages: existingSession.messages.filter((message, index) => !(
            message.role === 'npc'
            && index === 0
            && isLegacyTempChatGreeting(message.text)
          )),
          viewerLastSeenAt: Date.now(),
        }
      : {
          authorId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
          canAddFriend: false,
          addedAsFriend: false,
          viewerLastSeenAt: Date.now(),
        };

    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        tempChats: {
          ...(forumDataRef.current.tempChats || {}),
          [authorId]: initialSession,
        },
      }),
    } as AppDataExtended);
    setActiveTempChatUserId(authorId);
    setCurrentView('temp-chat');
  };

  const selectForumReplyAuthorPool = (post: ForumPost) => {
    const threadAuthorIds = Array.from(new Set([
      post.authorId,
      ...post.comments.map((comment) => comment.authorId),
    ])).filter((authorId) => authorId !== currentUser.id);

    const knownAuthors = threadAuthorIds.map((authorId) => {
      const author = getAuthor(authorId);
      return {
        id: authorId,
        displayName: author.name,
        persona: author.persona || author.description || author.bio || '',
        speakingStyle: author.speakingStyle,
        preferredMove: author.preferredMove || inferAuthorPreferredMove(authorId),
      };
    });

    const category = inferForumChannelFromCategory(post.category);
    const channelKeyword = category === 'oldDynasty'
      ? 'old'
      : category === 'otherworld'
        ? 'other'
        : category === 'starSea'
          ? 'star'
          : category;

    const supplementalAuthors = FORUM_SEED_NPC_PROFILES
      .filter((profile) => profile.id.includes(channelKeyword) || category === 'junction')
      .filter((profile) => !knownAuthors.some((author) => author.id === profile.id))
      .slice(0, 4)
      .map((profile) => ({
        id: profile.id,
        displayName: profile.name,
        persona: profile.bio,
      }));

    const supplementalCharacters = pickSupplementalForumCharacters(category)
      .filter((character) => !knownAuthors.some((author) => author.id === character.id))
      .map((character) => {
        const habit = buildCharacterForumHabit(character, category);
        return {
          id: character.id,
          displayName: character.name,
          persona: habit.persona,
          speakingStyle: habit.speakingStyle,
          preferredMove: habit.preferredMove,
        };
      });

    const pool = [...knownAuthors, ...supplementalCharacters, ...supplementalAuthors].slice(0, 6);
    return {
      knownAuthors: pool.map(({ id, displayName }) => ({ id, displayName })),
      participants: pool.map(({ displayName, persona, speakingStyle, preferredMove }) => ({
        displayName,
        persona,
        speakingStyle,
        preferredMove,
      })),
    };
  };

  const pruneForumFeed = (items: ForumPost[]) => {
    const deduped = items.filter((post, index, collection) => {
      const titleKey = normalizeForumPostFingerprint(post.title || '');
      const bodyKey = normalizeForumPostFingerprint(post.content || '');
      return collection.findIndex((candidate) => (
        normalizeForumPostFingerprint(candidate.title || '') === titleKey
        || normalizeForumPostFingerprint(candidate.content || '') === bodyKey
      )) === index;
    });

    const pinned = deduped.filter((post) => (
      isCurrentUserPostAuthor(post.authorId, post)
      || post.likes.includes(currentUser.id)
      || post.collections.includes(currentUser.id)
      || post.comments.some((comment) => isCurrentUserCommentAuthor(comment.authorId, comment))
    ));
    const pinnedIds = new Set(pinned.map((post) => post.id));
    const remainder = deduped
      .filter((post) => !pinnedIds.has(post.id))
      .sort((a, b) => b.timestamp - a.timestamp);

    return [...pinned, ...remainder]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);
  };

  const updateTempChatSession = (authorId: string, updater: (session: ForumTempChatSession) => ForumTempChatSession) => {
    const existingSession = (forumDataRef.current.tempChats || {})[authorId] || {
      authorId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      canAddFriend: false,
      addedAsFriend: false,
    };
    const nextSession = updater(existingSession);

    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        tempChats: {
          ...(forumDataRef.current.tempChats || {}),
          [authorId]: nextSession,
        },
      }),
    } as AppDataExtended);
  };

  useEffect(() => {
    if (!forumConfig) return undefined;

    const timer = window.setInterval(() => {
      const sessions = forumDataRef.current.tempChats || {};
      const now = Date.now();

      Object.values(sessions).forEach((session) => {
        const pendingReply = session.pendingReply;
        if (!pendingReply) return;

        const { authorId } = session;
        const author = getAuthor(authorId);

        if (!author) return;

        const shouldMarkRead = now >= pendingReply.readAt;
        const userMessage = session.messages.find((message) => message.id === pendingReply.userMessageId);

        if (shouldMarkRead && userMessage && !userMessage.readAt) {
          updateTempChatSession(authorId, (currentSession) => ({
            ...currentSession,
            messages: currentSession.messages.map((message) => (
              message.id === pendingReply.userMessageId
                ? { ...message, readAt: pendingReply.readAt }
                : message
            )),
            updatedAt: Date.now(),
          }));
        }

        if (pendingReply.behavior === 'ghost') {
          if (shouldMarkRead && pendingReply.status !== 'ghosted') {
            updateTempChatSession(authorId, (currentSession) => ({
              ...currentSession,
              pendingReply: currentSession.pendingReply
                ? { ...currentSession.pendingReply, status: 'ghosted' }
                : currentSession.pendingReply,
              updatedAt: Date.now(),
            }));
          }
          return;
        }

        if (!pendingReply.replyAt || now < pendingReply.replyAt) return;
        if (tempReplyProcessingRef.current.has(authorId)) return;

        tempReplyProcessingRef.current.add(authorId);

      updateTempChatSession(authorId, (currentSession) => ({
        ...currentSession,
        pendingReply: currentSession.pendingReply
          ? { ...currentSession.pendingReply, status: 'typing' }
          : currentSession.pendingReply,
          updatedAt: Date.now(),
        }));

        const relatedPost = pendingReply.relatedPostId
          ? postsRef.current.find((post) => post.id === pendingReply.relatedPostId) || null
          : resolveRecentForumPostForAuthor(authorId);

        const currentHistory = (forumDataRef.current.tempChats || {})[authorId]?.messages || [];

        generateForumTempReply({
          activeConfig: forumConfig,
          authorName: author.name,
          authorPersona: author.description || author.bio || '',
          channel: relatedPost ? inferForumChannelFromCategory(relatedPost.category) : undefined,
          recentForumPost: relatedPost,
          history: currentHistory,
          userMessage: pendingReply.userText,
        })
          .then((replyText) => {
            const trimmed = replyText.trim();
            if (!trimmed) {
              updateTempChatSession(authorId, (currentSession) => ({
                ...currentSession,
                pendingReply: undefined,
                updatedAt: Date.now(),
              }));
              return;
            }

            const npcMessage: ForumTempChatMessage = {
              id: `forum-temp-npc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              role: 'npc',
              text: trimmed,
              timestamp: Date.now(),
            };

            updateTempChatSession(authorId, (currentSession) => {
              const messages = [...currentSession.messages, npcMessage];
              const npcReplyCount = messages.filter((message) => message.role === 'npc').length;
              return {
                ...currentSession,
                messages,
                pendingReply: undefined,
                updatedAt: Date.now(),
                canAddFriend: currentSession.canAddFriend || npcReplyCount >= 3,
                viewerLastSeenAt: currentView === 'temp-chat' && activeTempChatUserId === authorId
                  ? Date.now()
                  : currentSession.viewerLastSeenAt,
              };
            });
          })
          .catch((error) => {
            console.error('[forum] temporary chat reply failed', error);
            showForumNotice('论坛临时单聊回复失败了，这次先没有接上。', 'error');
            updateTempChatSession(authorId, (currentSession) => ({
              ...currentSession,
              pendingReply: undefined,
              updatedAt: Date.now(),
            }));
          })
          .finally(() => {
            tempReplyProcessingRef.current.delete(authorId);
          });
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [forumConfig]);

  const handleShareToChat = (postId: string, characterId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const shareContent = `[分享动态] ${post.content.slice(0, 50)}${post.content.length > 50 ? '...' : ''}`;

    // Cast appData to access chatHistory which is present in AppData but not AppDataExtended
    const fullAppData = appData as any;
    const currentHistory = fullAppData.chatHistory?.[characterId] || [];
    
    const newMessage = {
      role: 'user',
      text: shareContent,
      timestamp: Date.now(),
      needsReply: true,
      sharedPost: {
        id: post.id,
        title: post.title || post.content.slice(0, 20),
        content: post.content,
        images: post.images,
        authorName: getAuthor(post.authorId).name,
        authorAvatar: getAuthor(post.authorId).avatar
      }
    };

    const newHistory = [...currentHistory, newMessage];

    // Update appData to trigger state change and update last message
    const updatedCharacters = appData.characters.map(c => {
      if (c.id === characterId) {
        return {
          ...c,
          lastMessage: shareContent,
          lastTime: Date.now()
        };
      }
      return c;
    });

    onUpdateAppData({
      ...appData,
      // @ts-ignore - chatHistory is not in AppDataExtended but is in AppData
      chatHistory: {
        ...fullAppData.chatHistory,
        [characterId]: newHistory
      },
      characters: updatedCharacters
    });
    
    if (onOpenChat) {
      onOpenChat(characterId);
      setShowShareModal(null);
    }
  };

  const handleRepost = (postId: string) => {
    const originalPost = posts.find(p => p.id === postId);
    if (!originalPost) return;

    const newPost: ForumPost = {
      id: `post-${Date.now()}`,
      authorId: currentUser.id,
      title: '',
      content: `转发动态：\n${originalPost.content.slice(0, 50)}${originalPost.content.length > 50 ? '...' : ''}`,
      images: [], // Usually reposts might reference the original, but for simplicity we just quote text
      category: activeChannelMeta.label,
      threadType: 'normal',
      timestamp: Date.now(),
      viewCount: 0,
      likes: [],
      collections: [],
      comments: [],
      source: 'user',
    };
    
    // Increment collection count on original post as a proxy for "repost" count in this data model
    const newPosts = posts.map(p => {
        if (p.id === postId) {
            return { ...p, collections: [...p.collections, currentUser.id] };
        }
        return p;
    });
    
    updatePosts([newPost, ...newPosts]);
    setShowShareModal(null);
    alert('转发成功');
  };

  const handleLikePost = (postId: string) => {
    const newPosts = posts.map(p => {
      if (p.id === postId) {
        const isLiked = p.likes.includes(currentUser.id);
        const newLikes = isLiked 
          ? p.likes.filter(id => id !== currentUser.id)
          : [...p.likes, currentUser.id];
        
        // Notify author if liked
        if (!isLiked && !isCurrentUserPostAuthor(p.authorId, p)) {
          addNotification(p.authorId, 'like_post', currentUser.id, postId);
        }
        
        return { ...p, likes: newLikes };
      }
      return p;
    });
    updatePosts(newPosts);
  };

  const handleCollectPost = (postId: string) => {
    const newPosts = posts.map(p => {
      if (p.id === postId) {
        const isCollected = p.collections.includes(currentUser.id);
        const newCollections = isCollected
          ? p.collections.filter(id => id !== currentUser.id)
          : [...p.collections, currentUser.id];
        return { ...p, collections: newCollections };
      }
      return p;
    });
    updatePosts(newPosts);
  };

  const handleDeletePost = async (postId: string) => {
    if (await showInAppConfirm('确定要删除这篇帖子吗？')) {
      const newPosts = posts.filter(p => p.id !== postId);
      updatePosts(newPosts);
      if (selectedPostId === postId) {
        setCurrentView('list');
        setSelectedPostId(null);
      }
    }
  };

  const handleReport = () => {
    alert('已举报，感谢您的反馈！');
  };

  const handlePublish = () => {
    if (!editorTitle.trim() || !editorContent.trim()) return;
    let publishedPostId: string | null = null;

    if (editingPostId) {
      // Update existing post
      const newPosts = posts.map(p => {
        if (p.id === editingPostId) {
          return {
            ...p,
            title: editorTitle,
            content: editorContent,
            images: editorImages,
            category: activeChannelMeta.label,
            timestamp: Date.now() // Update timestamp or keep original? Usually keep original or add edited time.
          };
        }
        return p;
      });
      updatePosts(newPosts);
    } else {
      // Create new post
      const authorId = editorIdentity === 'anonymous'
        ? buildAnonymousPostAuthorId()
        : currentUser.id;
      const postId = `post-${Date.now()}`;
      const newPost: ForumPost = {
        id: postId,
        authorId,
        authorIdentity: editorIdentity,
        ownerUserId: currentUser.id,
        title: editorTitle,
        content: editorContent,
        images: editorImages,
        category: activeChannelMeta.label,
        threadType: 'normal',
        timestamp: Date.now(),
        viewCount: 0,
        likes: [],
        collections: [],
        comments: [],
        source: 'user',
      };
      updatePosts([newPost, ...posts]);
      publishedPostId = postId;
    }
    
    setCurrentView('list');
    setEditingPostId(null);
    setEditorTitle('');
    setEditorContent('');
    setEditorImages([]);
    setEditorIdentity('self');
    setShowUrlInput(false);
    setUrlInput('');
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        composerDraft: null,
      }),
    } as AppDataExtended);

    if (publishedPostId && forumConfig) {
      window.setTimeout(() => {
        void triggerForumAiReplies(publishedPostId!, {
          replyCount: 3,
          replyMode: 'independent_only',
        });
      }, 300);
    } else if (publishedPostId) {
      showForumNotice('帖子已经发出。当前论坛 AI 未启用，所以这次不会自动出现网友互动。');
    }
  };

  const saveForumComposerDraft = () => {
    if (!editorTitle.trim() && !editorContent.trim() && editorImages.length === 0) {
      showForumNotice('草稿没有内容，这次就不保存了。');
      return;
    }

    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        composerDraft: {
          title: editorTitle,
          content: editorContent,
          images: editorImages,
          identity: editorIdentity,
          channel: activeChannel,
          updatedAt: Date.now(),
        },
      }),
    } as AppDataExtended);
    showForumNotice('草稿已保存。');
  };

  const openForumComposer = () => {
    const draft = composerDraft;
    setEditingPostId(null);
    setEditorTitle(draft?.title || '');
    setEditorContent(draft?.content || '');
    setEditorImages(draft?.images || []);
    setEditorIdentity(draft?.identity || 'self');
    setShowUrlInput(false);
    setUrlInput('');
    if (draft?.channel && FORUM_CHANNEL_TABS.some((item) => item.id === draft.channel)) {
      setActiveChannel(draft.channel as ForumChannelTabId);
    }
    setCurrentView('editor');
    if (draft) {
      showForumNotice('已带入上次保存的草稿。');
    }
  };

  const handleUserClick = (userId: string) => {
    if (userId !== currentUser.id) {
      setViewingUserId(userId);
      setCurrentView('user-profile');
    } else {
      setActiveTab('profile');
    }
  };

  const handleFollow = (userId: string) => {
    const isFollowed = followedUsers.includes(userId);
    const newFollowed = isFollowed 
      ? followedUsers.filter(id => id !== userId)
      : [...followedUsers, userId];
    const nextFollowerMap = {
      ...(forumDataRef.current.followerMap || {}),
    };
    const currentFollowers = nextFollowerMap[userId] || [];
    nextFollowerMap[userId] = isFollowed
      ? currentFollowers.filter((id) => id !== currentUser.id)
      : Array.from(new Set([...currentFollowers, currentUser.id]));
    
    onUpdateAppData({
      ...appData,
      forumData: buildForumDataState({
        followedUsers: newFollowed,
        followerMap: nextFollowerMap,
      })
    });
  };

  const collectFollowerIdsForUser = (userId: string) => {
    const scoreMap = new Map<string, { score: number; lastAt: number }>();
    const pushScore = (sourceUserId: string, score: number, timestamp: number) => {
      if (!sourceUserId || sourceUserId === userId) return;
      if (sourceUserId.startsWith(`seed-anon-${userId}-`)) return;
      const current = scoreMap.get(sourceUserId);
      if (!current) {
        scoreMap.set(sourceUserId, { score, lastAt: timestamp });
        return;
      }
      scoreMap.set(sourceUserId, {
        score: current.score + score,
        lastAt: Math.max(current.lastAt, timestamp),
      });
    };

    posts.forEach((post) => {
      if (post.authorId !== userId) return;

      post.comments.forEach((comment) => {
        pushScore(comment.authorId, comment.replyToId ? 4 : 5, comment.timestamp);
        comment.likes.forEach((likerId) => pushScore(likerId, 2, comment.timestamp));
      });

      post.likes.forEach((likerId) => pushScore(likerId, 3, post.timestamp));
      post.collections.forEach((collectorId) => pushScore(collectorId, 2, post.timestamp));
    });

    notifications.forEach((notification) => {
      if (notification.userId === userId) {
        const scoreByType = notification.type === 'reply' ? 4 : 2;
        pushScore(notification.sourceUserId, scoreByType, notification.timestamp);
      }
    });

    if (userId !== currentUser.id && followedUsers.includes(userId)) {
      pushScore(currentUser.id, 6, Date.now());
    }

    const persistedFollowers = followerMap[userId] || [];
    persistedFollowers.forEach((followerId) => {
      pushScore(followerId, 10, Date.now());
    });

    return Array.from(scoreMap.entries())
      .sort((a, b) => {
        if (b[1].score !== a[1].score) return b[1].score - a[1].score;
        return b[1].lastAt - a[1].lastAt;
      })
      .map(([id]) => id);
  };

  const resolveFollowingIdsForUser = (userId: string) => {
    if (userId === currentUser.id) {
      return followedUsers.filter((id) => id !== currentUser.id);
    }
    return [];
  };

  const isMutualForumFollow = (userId: string) => {
    if (!userId || userId === currentUser.id) return false;
    const iFollowThem = followedUsers.includes(userId);
    const theyFollowMe = collectFollowerIdsForUser(currentUser.id).includes(userId);
    return iFollowThem && theyFollowMe;
  };

  const openFollowList = (mode: 'following' | 'followers', userId: string) => {
    setFollowListMode(mode);
    setFollowListUserId(userId);
    setFollowListSearch('');
    setCurrentView('follow-list');
  };

  const handleComment = (postId: string, content: string, replyToId?: string, rootCommentId?: string, identity: 'self' | 'anonymous' = 'self') => {
    let createdComment: ForumComment | null = null;
    const newPosts = posts.map(p => {
      if (p.id === postId) {
        const commentId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const authorId = identity === 'anonymous'
          ? buildAnonymousCommentAuthorId()
          : currentUser.id;
        const newComment: ForumComment = {
          id: commentId,
          postId,
          authorId,
          authorIdentity: identity,
          ownerUserId: currentUser.id,
          content,
          timestamp: Date.now(),
          likes: [],
          replyToId,
          rootCommentId: rootCommentId || (replyToId ? undefined : commentId) // If reply, use passed root, else self is root
        };
        
        // Fix rootCommentId for top-level comment
        if (!replyToId) {
            newComment.rootCommentId = newComment.id;
        }

        createdComment = newComment;

        // Notify
        if (replyToId) {
           // Notify comment author
           const parentComment = p.comments.find(c => c.id === replyToId);
           if (parentComment && !isCurrentUserCommentAuthor(parentComment.authorId)) {
             addNotification(parentComment.authorId, 'reply', currentUser.id, postId, newComment.id);
           }
        } else {
           // Notify post author
           if (!isCurrentUserPostAuthor(p.authorId, p)) {
             addNotification(p.authorId, 'reply', currentUser.id, postId, newComment.id);
           }
        }

        return { ...p, comments: [...p.comments, newComment] };
      }
      return p;
    });
    updatePosts(newPosts);
    return createdComment;
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (await showInAppConfirm('确定要删除这条评论吗？')) {
      const newPosts = posts.map(p => {
        if (p.id === postId) {
          return { ...p, comments: p.comments.filter(c => c.id !== commentId) };
        }
        return p;
      });
      updatePosts(newPosts);
    }
  };

  const handleLikeComment = (postId: string, commentId: string) => {
    const newPosts = posts.map(p => {
      if (p.id === postId) {
        const newComments = p.comments.map(c => {
          if (c.id === commentId) {
            const isLiked = c.likes.includes(currentUser.id);
            const newLikes = isLiked
              ? c.likes.filter(id => id !== currentUser.id)
              : [...c.likes, currentUser.id];
            
            if (!isLiked && c.authorId !== currentUser.id) {
                addNotification(c.authorId, 'like_comment', currentUser.id, postId, commentId);
            }

            return { ...c, likes: newLikes };
          }
          return c;
        });
        return { ...p, comments: newComments };
      }
      return p;
    });
    updatePosts(newPosts);
  };

  const updatePosts = (
    newPosts: ForumPost[],
    nextRuntimeAuthorProfiles = forumDataRef.current.runtimeAuthorProfiles || {},
  ) => {
    postsRef.current = newPosts;
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        posts: newPosts,
        runtimeAuthorProfiles: nextRuntimeAuthorProfiles,
      })
    });
  };

  const updateSinglePost = (postId: string, updater: (post: ForumPost) => ForumPost) => {
    const nextPosts = postsRef.current.map((post) => (
      post.id === postId ? updater(post) : post
    ));
    updatePosts(nextPosts);
  };

  const appendGeneratedReplies = (postId: string, replies: Array<{
    authorId: string;
    content: string;
    replyToId?: string;
    rootCommentId?: string;
  }>) => {
    if (!replies.length) return;

    updateSinglePost(postId, (post) => {
      const baseTimestamp = Date.now();
      const thread = legacyForumPostToThreadV2(post, {
        authorNameResolver: (authorId) => getAuthor(authorId).name,
      });
      const nextThread = appendRepliesToForumThreadV2(
        thread,
        replies.map((reply) => ({
          authorId: reply.authorId,
          authorDisplayName: getAuthor(reply.authorId).name,
          content: reply.content,
          replyToId: reply.replyToId,
        })),
        baseTimestamp,
      );
      const nextPost = forumThreadV2ToLegacyPost(nextThread);
      const pendingIdentityReplies = [...replies];
      const nextComments = nextPost.comments.map((comment) => {
        const matchIndex = pendingIdentityReplies.findIndex((reply) => (
          reply.authorId === comment.authorId
          && reply.content === comment.content
          && reply.replyToId === comment.replyToId
        ));
        if (matchIndex === -1) return comment;

        const matchedReply = pendingIdentityReplies.splice(matchIndex, 1)[0];
        const isCharacterReply = !!getCharacterById(matchedReply.authorId);
        return {
          ...comment,
          authorIdentity: isCharacterReply ? 'character' : comment.authorIdentity,
          authorCharacterId: isCharacterReply ? matchedReply.authorId : comment.authorCharacterId,
        };
      });

      return {
        ...post,
        ...nextPost,
        comments: nextComments,
        aiDetailExpanded: true,
        aiLastReplyAt: baseTimestamp,
        aiLastExpandedAt: post.aiLastExpandedAt || baseTimestamp,
      };
    });
  };

  const pickRefreshContinuationTargets = (channel: ForumChannel) => {
    const now = Date.now();
    return postsRef.current
      .filter((post) => {
        if (inferForumChannelFromCategory(post.category) !== channel) return false;
        if (post.comments.length < 2) return false;
        const lastReplyAt = post.aiLastReplyAt || post.aiLastExpandedAt || post.timestamp;
        if (now - lastReplyAt < 15 * 60 * 1000) return false;
        return true;
      })
      .map((post) => {
        const freshnessBonus = Math.max(0, 36 - Math.floor((now - post.timestamp) / (60 * 60 * 1000)));
        const heatScore = post.comments.length * 12 + post.likes.length * 6 + post.viewCount * 0.06 + freshnessBonus;
        return { post, heatScore };
      })
      .sort((a, b) => b.heatScore - a.heatScore)
      .slice(0, 4)
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.random() < 0.65 ? 1 : 2)
      .map((item) => item.post);
  };

  const pickRecurringForumAuthorsForChannel = (channel: ForumChannel): GeneratedForumAuthorDraft[] => {
    const scoreMap = new Map<string, number>();
    const bump = (authorId: string, score: number) => {
      if (!authorId || authorId === currentUser.id) return;
      if (authorId.startsWith(`seed-anon-${currentUser.id}-`)) return;
      scoreMap.set(authorId, (scoreMap.get(authorId) || 0) + score);
    };

    postsRef.current.forEach((post) => {
      if (inferForumChannelFromCategory(post.category) !== channel) return;
      bump(post.authorId, 5);
      post.comments.forEach((comment) => bump(comment.authorId, comment.replyToId ? 2 : 3));
    });

    return Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([authorId]) => {
        const author = getAuthor(authorId);
        return {
          id: authorId,
          displayName: author.name,
          bio: author.bio || author.description || '',
          handle: author.handle || '',
          avatarSeed: `${author.name}${author.handle || authorId}`,
        };
      })
      .filter((author) => !!author.displayName);
  };

  const pickForumCharacterAuthor = (channel: ForumChannel) => {
    const now = Date.now();
    const candidates = appDataRef.current.characters.filter((character) => {
      const frequency = character.postFrequency || 'medium';
      if (frequency === 'none') return false;

      const recentCharacterPosts = postsRef.current
        .filter((post) => post.authorId === character.id)
        .sort((a, b) => b.timestamp - a.timestamp);
      const latestCharacterPost = recentCharacterPosts[0];
      const cooldownMs = frequency === 'high'
        ? 3 * 60 * 60 * 1000
        : frequency === 'low'
          ? 18 * 60 * 60 * 1000
          : 8 * 60 * 60 * 1000;

      if (latestCharacterPost && now - latestCharacterPost.timestamp < cooldownMs) {
        return false;
      }

      const sameChannelRecentCount = recentCharacterPosts.filter((post) => (
        inferForumChannelFromCategory(post.category) === channel
        && now - post.timestamp < 24 * 60 * 60 * 1000
      )).length;

      return sameChannelRecentCount < 2;
    });

    if (candidates.length === 0) return null;

    const weightedPool = candidates.flatMap((character) => {
      const frequency = character.postFrequency || 'medium';
      const habit = buildCharacterForumHabit(character, channel);
      const weight = (frequency === 'high' ? 4 : frequency === 'low' ? 1 : 2)
        + (habit.affinity.includes(channel) ? 3 : 0);
      return Array.from({ length: weight }, () => character);
    });
    const picked = weightedPool[Math.floor(Math.random() * weightedPool.length)];
    const frequency = picked.postFrequency || 'medium';
    const triggerChance = frequency === 'high' ? 0.55 : frequency === 'low' ? 0.18 : 0.32;

    return Math.random() <= triggerChance ? picked : null;
  };

  const maybeGenerateCharacterForumPost = async (channel: ForumChannel) => {
    if (!forumConfig) return null;

    const pickedCharacter = pickForumCharacterAuthor(channel);
    if (!pickedCharacter) return null;
    const forumHabit = buildCharacterForumHabit(pickedCharacter, channel);

    const generated = await generateMomentPostContent({
      activeConfig: forumConfig,
      character: pickedCharacter,
      masks: appDataRef.current.masks || [],
      worldBook: appDataRef.current.worldBooks || [],
      requestText: `论坛角色自主发帖：频道=${FORUM_CHANNEL_LABELS[channel]}；氛围=${activeChannelMeta.blurb}；角色论坛偏好=${forumHabit.persona}；写成角色本人会发在公共论坛的一条短帖。`,
    });

    const content = generated.content.trim();
    if (!content) return null;

    const runtimeProfile: ForumRuntimeAuthorProfile = {
      id: pickedCharacter.id,
      name: pickedCharacter.name,
      handle: buildForumCharacterHandle(pickedCharacter),
      avatar: pickedCharacter.avatar,
      bio: pickedCharacter.signature?.trim() || pickedCharacter.corePersona?.trim() || pickedCharacter.openingRemark?.trim() || '',
      persona: forumHabit.persona,
      speakingStyle: forumHabit.speakingStyle,
      preferredMove: forumHabit.preferredMove,
    };

    const post: ForumPost = {
      id: `forum-character-post-${pickedCharacter.id}-${Date.now()}`,
      authorId: pickedCharacter.id,
      authorIdentity: 'character',
      authorCharacterId: pickedCharacter.id,
      title: buildForumCharacterPostTitle(content),
      content,
      images: [],
      category: FORUM_CHANNEL_LABELS[channel],
      threadType: 'normal',
      timestamp: Date.now(),
      viewCount: 0,
      likes: [],
      collections: [],
      comments: [],
      source: 'generated',
    };

    return {
      post,
      runtimeProfile,
      characterName: pickedCharacter.name,
    };
  };

  const addNotification = (userId: string, type: ForumNotification['type'], sourceUserId: string, postId: string, commentId?: string) => {
    const newNotification: ForumNotification = {
      id: `n-${Date.now()}`,
      userId,
      type,
      sourceUserId,
      postId,
      commentId,
      timestamp: Date.now(),
      read: false
    };
    const currentNotifications = forumDataRef.current.notifications || [];
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        notifications: [newNotification, ...currentNotifications],
      })
    });
  };

  const triggerForumAiReplies = async (postId: string, options: {
    userNewComment?: ForumComment;
    replyCount?: number;
    replyMode?: 'mixed' | 'independent_only' | 'threaded_only';
    markDetailExpanded?: boolean;
  } = {}) => {
    if (!forumConfig) {
      if (options.userNewComment) {
        showForumNotice('评论已发出，但论坛 AI 还没启用，所以这次不会自动跟帖。');
      }
      return;
    }
    if (forumAiLoadingPostId === postId) return;

    const latestPost = postsRef.current.find((item) => item.id === postId);
    if (!latestPost) return;

    const { knownAuthors, participants } = selectForumReplyAuthorPool(latestPost);
    if (!knownAuthors.length || !participants.length) return;

    setForumAiLoadingPostId(postId);
    try {
      const generatedReplies = await generateForumReplies({
        activeConfig: forumConfig,
        post: latestPost,
        channel: inferForumChannelFromCategory(latestPost.category),
        knownAuthors,
        participants,
        replyCount: options.replyCount ?? 3,
        replyMode: options.replyMode ?? 'mixed',
        userNewComment: options.userNewComment,
      });

      if (generatedReplies.length > 0) {
        appendGeneratedReplies(postId, generatedReplies);
      } else if (options.markDetailExpanded) {
        updateSinglePost(postId, (post) => ({
          ...post,
          aiDetailExpanded: true,
          aiLastExpandedAt: Date.now(),
        }));
      }
    } catch (error) {
      console.error('[forum] failed to generate replies', error);
      showForumNotice('论坛自动回帖失败了，这次先没接上。可以稍后再试一次。', 'error');
    } finally {
      setForumAiLoadingPostId((current) => current === postId ? null : current);
    }
  };

  const handleCommentWithAi = async (postId: string, content: string, replyToId?: string, rootCommentId?: string, identity: 'self' | 'anonymous' = 'self') => {
    const createdComment = handleComment(postId, content, replyToId, rootCommentId, identity);
    if (!createdComment) return;
    if (!forumConfig) {
      showForumNotice('评论已发出。当前论坛 AI 未启用，所以还不会自动回复。');
      return;
    }

    await triggerForumAiReplies(postId, {
      userNewComment: createdComment,
      replyCount: replyToId ? 2 : 3,
      replyMode: replyToId ? 'threaded_only' : 'mixed',
    });
  };

  const handleRefreshFeed = async () => {
    if (!forumConfig) {
      showForumNotice('当前论坛 AI 未启用，暂时不能补新帖。', 'error');
      return;
    }
    if (feedRefreshLoading || feedRefreshLockRef.current) return;

    feedRefreshLockRef.current = true;
    setFeedRefreshLoading(true);
    try {
      const channel = activeChannel as ForumChannel;
      const generationCount = 5 + Math.floor(Math.random() * 4);
      const channelPosts = postsRef.current.filter((post) => inferForumChannelFromCategory(post.category) === channel);
      const recurringAuthors = pickRecurringForumAuthorsForChannel(channel);
      const continuationTargets = pickRefreshContinuationTargets(channel);
      const generatedBatch = await generateForumThreads({
        activeConfig: forumConfig,
        channel,
        existingPosts: channelPosts,
        count: generationCount,
        recurringAuthors,
      });
      const characterPostResult = await maybeGenerateCharacterForumPost(channel);

      const generatedRuntimeProfiles = generatedBatch.authors.map((author) => ({
            id: author.id,
            name: author.displayName,
            handle: author.handle || buildReadableForumHandle({
              id: author.id,
              name: author.displayName,
            }),
            avatar: seedFallbackAvatar(author.avatarSeed || `${author.displayName}${author.handle || ''}`, author.displayName),
            bio: author.bio || '',
            persona: author.persona || author.bio || '',
            speakingStyle: author.speakingStyle,
            preferredMove: author.speakingStyle ? `说话常带 ${author.speakingStyle}` : undefined,
          }));
      const nextRuntimeAuthorProfiles = (generatedRuntimeProfiles.length > 0 || characterPostResult?.runtimeProfile)
        ? mergeRuntimeAuthorProfiles([
            ...generatedRuntimeProfiles,
            ...(characterPostResult?.runtimeProfile ? [characterPostResult.runtimeProfile] : []),
          ])
        : (forumDataRef.current.runtimeAuthorProfiles || {});

      const refreshedPosts = [
        ...(characterPostResult ? [characterPostResult.post] : []),
        ...generatedBatch.posts,
      ];

      if (refreshedPosts.length > 0) {
        const merged = pruneForumFeed([...refreshedPosts, ...postsRef.current]);
        updatePosts(merged, nextRuntimeAuthorProfiles);
      }

      let continuedCount = 0;
      for (const post of continuationTargets) {
        try {
          await triggerForumAiReplies(post.id, {
            replyCount: post.comments.length >= 8 ? 2 : 3,
            replyMode: post.comments.length >= 4 ? 'mixed' : 'independent_only',
          });
          continuedCount += 1;
        } catch (error) {
          console.error('[forum] failed to continue hot thread', { postId: post.id, error });
        }
      }

      if (!refreshedPosts.length && !continuedCount) {
        console.warn('[forum] refresh produced no posts', {
          channel,
          generationCount,
        });
      } else {
        const summaryBits = [
          generatedBatch.posts.length > 0 ? `补了 ${generatedBatch.posts.length} 条新帖` : '',
          characterPostResult ? `${characterPostResult.characterName} 来发了一条帖` : '',
          continuedCount > 0 ? `续了 ${continuedCount} 个热帖` : '',
        ].filter(Boolean);
        if (summaryBits.length > 0) {
          showForumNotice(summaryBits.join('，') + '。');
        }
      }
    } catch (error) {
      console.error('[forum] failed to refresh feed', error);
      showForumNotice('补新帖失败了，可能是接口暂时没接上。', 'error');
    } finally {
      setFeedRefreshLoading(false);
      feedRefreshLockRef.current = false;
    }
  };

  const handleUpgradeForumFriend = (authorId: string) => {
    const author = getAuthor(authorId);
    if (getCharacterById(authorId)) {
      if (onOpenChat) onOpenChat(authorId);
      return;
    }

    const bridgeCharacter = buildForumNpcBridgeCharacter(author);
    const fullAppData = appDataRef.current as any;
    const existingHistory = fullAppData.chatHistory?.[authorId];
    const initialHistory = existingHistory && existingHistory.length > 0
      ? existingHistory
      : [{
          role: 'model' as const,
          text: `${bridgeCharacter.openingRemark} 现在如果你愿意，我们可以换到正式聊天里继续。`,
          timestamp: Date.now(),
        }];

    updateTempChatSession(authorId, (session) => ({
      ...session,
      addedAsFriend: true,
      updatedAt: Date.now(),
    }));

    onUpdateAppData({
      ...appDataRef.current,
      characters: [...appDataRef.current.characters, bridgeCharacter],
      chatHistory: {
        ...(fullAppData.chatHistory || {}),
        [authorId]: initialHistory,
      },
      forumData: buildForumDataState({
        tempChats: {
          ...(forumDataRef.current.tempChats || {}),
          [authorId]: {
            ...(forumDataRef.current.tempChats || {})[authorId],
            addedAsFriend: true,
            updatedAt: Date.now(),
          },
        },
      }),
    } as AppDataExtended);

    if (onOpenChat) {
      onOpenChat(authorId);
    }
  };

  const handleSendTempChatMessage = async () => {
    if (!activeTempChatUserId || !tempChatInput.trim() || tempChatLoading) return;
    if (!forumConfig) {
      showForumNotice('论坛临时单聊当前未启用，暂时还不能发出消息。', 'error');
      return;
    }
    const author = getAuthor(activeTempChatUserId);
    const session = (forumDataRef.current.tempChats || {})[activeTempChatUserId];
    if (session?.pendingReply) return;
    const userText = tempChatInput.trim();
    const userMessage: ForumTempChatMessage = {
      id: `forum-temp-user-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    setTempChatInput('');
    setTempChatLoading(true);

    const relatedPost = resolveRecentForumPostForAuthor(activeTempChatUserId);
    const replyPolicy = buildTempChatReplyPolicy(author, session || {
      authorId: activeTempChatUserId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    });
    const pendingReply: ForumTempChatPendingReply = {
      userMessageId: userMessage.id,
      userText,
      behavior: replyPolicy.behavior,
      readAt: userMessage.timestamp + replyPolicy.readDelayMs,
      replyAt: replyPolicy.behavior === 'ghost'
        ? undefined
        : userMessage.timestamp + (replyPolicy.replyDelayMs || 0),
      status: 'waiting',
      relatedPostId: relatedPost?.id || null,
    };

    updateTempChatSession(activeTempChatUserId, (currentSession) => {
      const messages = [...currentSession.messages, userMessage];
      return {
        ...currentSession,
        messages,
        updatedAt: Date.now(),
        pendingReply,
      };
    });

    window.setTimeout(() => {
      setTempChatLoading(false);
    }, 250);
  };

  const markNotificationsRead = () => {
    const newNotifications = notifications.map(n => 
      n.userId === currentUser.id ? { ...n, read: true } : n
    );
    onUpdateAppData({
      ...appData,
      forumData: buildForumDataState({
        posts,
        notifications: newNotifications,
      })
    });
  };

  // Mark notifications as read when switching to notification tab
  useEffect(() => {
    if (activeTab === 'notification' && messageTab === 'activity') {
      markNotificationsRead();
    }
  }, [activeTab, messageTab]);

  const handleUpdateProfile = () => {
    const normalizedNextId = editId.trim().replace(/^@/, '');
    const previousUserId = currentUser.id;
    const nextUserId = normalizedNextId || previousUserId;
    const nextAvatar = editAvatar || currentUser.avatar;
    const nextForumPosts = posts.map((post) => ({
      ...post,
      authorId: post.authorId === previousUserId ? nextUserId : post.authorId,
      ownerUserId: post.ownerUserId === previousUserId ? nextUserId : post.ownerUserId,
      likes: post.likes.map((id) => id === previousUserId ? nextUserId : id),
      collections: post.collections.map((id) => id === previousUserId ? nextUserId : id),
      comments: post.comments.map((comment) => ({
        ...comment,
        authorId: comment.authorId === previousUserId ? nextUserId : comment.authorId,
        ownerUserId: comment.ownerUserId === previousUserId ? nextUserId : comment.ownerUserId,
        likes: comment.likes.map((id) => id === previousUserId ? nextUserId : id),
      })),
    }));
    const nextForumNotifications = notifications.map((notification) => ({
      ...notification,
      userId: notification.userId === previousUserId ? nextUserId : notification.userId,
      sourceUserId: notification.sourceUserId === previousUserId ? nextUserId : notification.sourceUserId,
    }));
    const nextFollowerMap = Object.entries(followerMap).reduce<Record<string, string[]>>((acc, [key, value]) => {
      const nextKey = key === previousUserId ? nextUserId : key;
      acc[nextKey] = (value || []).map((id) => id === previousUserId ? nextUserId : id);
      return acc;
    }, {});

    onUpdateAppData({
      ...appData,
      userProfile: {
        ...currentUser,
        name: editName,
        bio: editBio,
        avatar: nextAvatar,
        id: nextUserId,
      },
      forumData: buildForumDataState({
        posts: nextForumPosts,
        notifications: nextForumNotifications,
        followerMap: nextFollowerMap,
      }),
    });
    setEditAvatarUrlInput('');
    setCurrentView('list');
    setActiveTab('profile');
  };

  const saveSpectatorSettings = () => {
    const nextSettings: ForumSpectatorSettings = {
      subjectName: spectatorSubjectName.trim(),
      relationshipSummary: spectatorRelationshipSummary.trim(),
      tone: spectatorTone,
      autoGenerate: spectatorAutoGenerate,
      selectedCharacterIds: spectatorCharacterIds,
    };

    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        spectatorSettings: nextSettings,
      }),
    } as AppDataExtended);
    showForumNotice('围观板块设置已保存。');
    setCurrentView('list');
  };

  const generateSpectatorPostsFromSettings = () => {
    const settingsPayload: ForumSpectatorSettings = {
      subjectName: spectatorSubjectName.trim(),
      relationshipSummary: spectatorRelationshipSummary.trim(),
      tone: spectatorTone,
      autoGenerate: spectatorAutoGenerate,
      selectedCharacterIds: spectatorCharacterIds,
    };
    const selectedCharacters = appData.characters.filter((character) => settingsPayload.selectedCharacterIds.includes(character.id));
    if (!settingsPayload.subjectName && selectedCharacters.length === 0) {
      showForumNotice('先在围观设置里选角色或填一个围观对象。', 'error');
      return;
    }

    const drafts = buildSpectatorPostDrafts({
      settings: settingsPayload,
      currentUserName: currentUser.name,
      selectedCharacters,
    });

    const spectatorPosts: ForumPost[] = drafts.map((draft, index) => ({
      id: `spectator-post-${Date.now()}-${index}`,
      authorId: `${SPECTATOR_BOARD_AUTHOR_PREFIX}${index}`,
      board: 'spectator',
      title: draft.title,
      content: draft.content,
      category: SPECTATOR_BOARD_CATEGORY,
      threadType: index % 2 === 0 ? 'normal' : 'sameTopic',
      timestamp: Date.now() - index * 60 * 1000,
      viewCount: 12 + index * 8,
      likes: [],
      collections: [],
      comments: [],
      source: 'generated',
    }));

    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        posts: pruneForumFeed([...spectatorPosts, ...postsRef.current]),
        spectatorSettings: settingsPayload,
      }),
    } as AppDataExtended);
    showForumNotice(`围观板块补了 ${spectatorPosts.length} 条新帖。`);
    setCurrentView('list');
    setForumBoard('spectator');
  };

  const toggleSpectatorCharacter = (characterId: string) => {
    setSpectatorCharacterIds((current) => (
      current.includes(characterId)
        ? current.filter((id) => id !== characterId)
        : [...current, characterId]
    ));
  };

  // --- Render Components ---

  const renderShareModal = () => {
    if (!showShareModal) return null;
    return (
      <>
        <div className="absolute inset-0 bg-black/50 z-50" onClick={() => setShowShareModal(null)} />
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-4 animate-in slide-in-from-bottom duration-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-zinc-900">分享至</h3>
            <button onClick={() => setShowShareModal(null)} className="p-1 bg-zinc-100 rounded-full">
              <X size={20} className="text-zinc-500" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <button 
              onClick={() => handleRepost(showShareModal)}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <Repeat size={24} />
              </div>
              <span className="text-xs text-zinc-600">转发动态</span>
            </button>
            {appData.characters.map(char => (
              <button 
                key={char.id}
                onClick={() => handleShareToChat(showShareModal, char.id)}
                className="flex flex-col items-center gap-2"
              >
                <ResolvedImage value={char.avatar} className="w-12 h-12 rounded-full object-cover border border-zinc-100" />
                <span className="text-xs text-zinc-600 truncate w-full text-center">{char.name}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  };

  const renderPostList = () => {
    let displayPosts = posts.filter((p) => {
      if (forumBoard === 'spectator') return p.board === 'spectator' || p.category === SPECTATOR_BOARD_CATEGORY;
      return (p.board ?? 'public') !== 'spectator'
        && (p.category === activeChannelMeta.label || (activeChannel === 'junction' && p.category === '全部'));
    });

    if (forumBoard === 'public' && threadTypeFilter !== 'all') {
      displayPosts = displayPosts.filter((post) => {
        const threadTypeMeta = getForumThreadTypeMeta(post.threadType);
        return (post.threadType || 'normal') === threadTypeFilter || threadTypeMeta.label === FORUM_THREAD_TYPE_LABELS[threadTypeFilter];
      });
    }
    
    if (searchQuery.trim()) {
      displayPosts = displayPosts.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getAuthor(p.authorId).name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      if (homeFilter === 'hot') {
        displayPosts.sort((a, b) => (b.comments.length + b.likes.length) - (a.comments.length + a.likes.length));
      } else {
        displayPosts.sort((a, b) => b.timestamp - a.timestamp);
      }
    }

    return (
      <div className="forum-app-scroll h-full min-h-0 overflow-y-auto bg-white" style={forumBottomInsetStyle}>
        {displayPosts.map(post => {
          const author = getAuthor(post.authorId);
          const handle = formatForumHandle(author);
          const isOwner = isCurrentUserPostAuthor(post.authorId, post);
          const identityMeta = getForumIdentityBadgeMeta(resolvePostIdentity(post));
          const threadTypeMeta = getForumThreadTypeMeta(post.threadType);
          
          // Format time like Twitter (e.g., "2h", "Oct 24")
          const postDate = new Date(post.timestamp);
          const now = new Date();
          const diffMs = now.getTime() - postDate.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);
          let timeStr = '';
          if (diffMins < 1) timeStr = '刚刚';
          else if (diffMins < 60) timeStr = `${diffMins}分钟`;
          else if (diffHours < 24) timeStr = `${diffHours}小时`;
          else if (diffDays < 365) timeStr = postDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
          else timeStr = postDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });

          return (
            <ForumPostCard
              key={post.id}
              post={post}
              author={author}
              handle={handle}
              identityMeta={identityMeta}
              isOwner={isOwner}
              threadTypeLabel={threadTypeMeta.label}
              threadTypeClassName={threadTypeMeta.className}
              timeStr={timeStr}
              currentUserId={currentUser.id}
              showMenu={showPostMenu === post.id}
              onOpen={(postId) => {
                setSelectedPostId(postId);
                setCurrentView('detail');
                const newPosts = posts.map((item) => item.id === postId ? { ...item, viewCount: item.viewCount + 1 } : item);
                updatePosts(newPosts);
              }}
              onOpenAuthor={(authorId) => {
                if (authorId !== currentUser.id && !authorId.startsWith(`seed-anon-${currentUser.id}-`)) {
                  setViewingUserId(authorId);
                  setCurrentView('user-profile');
                } else {
                  setActiveTab('profile');
                }
              }}
              onToggleMenu={(postId) => setShowPostMenu(showPostMenu === postId ? null : postId)}
              onCloseMenu={() => setShowPostMenu(null)}
              onCollect={handleCollectPost}
              onDelete={(postId) => { void handleDeletePost(postId); }}
              onReport={handleReport}
              onLike={handleLikePost}
              onShare={setShowShareModal}
            />
          );
        })}
        {displayPosts.length === 0 && (
          <div className="px-8 py-14 text-center text-zinc-500">
            <div className="text-[18px] font-bold text-zinc-900 mb-2">{activeChannelMeta.label}还没有帖子</div>
            <div className="text-[13px] leading-6 text-zinc-500">{activeChannelMeta.blurb}</div>
          </div>
        )}
      </div>
    );
  };

  const renderFilterSheet = () => {
    if (!showFilterSheet) return null;

    return (
      <>
        <div
          className="absolute inset-0 z-40 bg-black/35"
          onClick={() => setShowFilterSheet(false)}
        />
        <div className="absolute inset-x-0 bottom-0 z-50 rounded-t-[28px] bg-white px-4 pb-6 pt-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-200" />
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[17px] font-bold text-zinc-900">筛选</h3>
              <p className="mt-1 text-[12px] text-zinc-500">把区域和帖型收在这里，首页保持干净一点。</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveChannel('junction');
                setThreadTypeFilter('all');
              }}
              className="rounded-full bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-600 transition-colors hover:bg-zinc-200"
            >
              重置
            </button>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-[13px] font-semibold text-zinc-900">区域</div>
            <div className="flex flex-wrap gap-2">
              {FORUM_CHANNEL_TABS.map((channel) => {
                const selected = channel.id === activeChannel;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setActiveChannel(channel.id)}
                    className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${
                      selected
                        ? 'border-sky-200 bg-sky-50 text-zinc-900'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    {channel.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-[13px] font-semibold text-zinc-900">帖型</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setThreadTypeFilter('all')}
                className={`rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
                  threadTypeFilter === 'all'
                    ? 'border border-sky-200 bg-sky-50 text-zinc-900'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                全部帖型
              </button>
              {(['normal', 'commission', 'sameTopic', 'rift', 'reversal', 'ownerUpdate'] as ForumThreadType[]).map((threadType) => {
                const meta = getForumThreadTypeMeta(threadType);
                const selected = threadTypeFilter === threadType;
                return (
                  <button
                    key={threadType}
                    type="button"
                    onClick={() => setThreadTypeFilter(threadType)}
                    className={`rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
                      selected
                        ? 'border border-sky-200 bg-sky-50 text-zinc-900'
                        : `${meta.className} hover:bg-zinc-50`
                    }`}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowFilterSheet(false)}
            className="mt-6 w-full rounded-full border border-zinc-200 bg-white py-3 text-[14px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            完成
          </button>
        </div>
      </>
    );
  };

  const renderPostDetail = () => {
    const post = posts.find(p => p.id === selectedPostId);
    if (!post) return null;
    const author = getAuthor(post.authorId);
    const handle = formatForumHandle(author);
    const isOwner = isCurrentUserPostAuthor(post.authorId, post);
    const identityMeta = getForumIdentityBadgeMeta(resolvePostIdentity(post));
    const threadTypeMeta = getForumThreadTypeMeta(post.threadType);
    const sortedComments = [...post.comments].sort((a, b) => a.timestamp - b.timestamp);
    const floorMap = sortedComments.reduce<Record<string, number>>((acc, item, index) => {
      acc[item.id] = index + 1;
      return acc;
    }, {});

    const postDate = new Date(post.timestamp);
    const timeStr = postDate.toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: false });
    const dateStr = postDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
      <div className="bg-white h-full min-h-0 flex flex-col relative">
        {/* Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 px-4 pb-2 flex items-center gap-6" style={forumTopInsetStyle}>
          <button onClick={() => setCurrentView('list')} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-bold text-lg text-zinc-900">帖子</h2>
        </div>

        {/* Content */}
        <div className="px-4 pt-2 flex-1 min-h-0 overflow-y-auto pb-24">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button
                className="shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  if (author.id !== currentUser.id && !author.id.startsWith(`seed-anon-${currentUser.id}-`)) {
                    setViewingUserId(author.id);
                    setCurrentView('user-profile');
                  } else {
                    setActiveTab('profile');
                  }
                }}
              >
                <ResolvedImage value={author.avatar} className="w-9 h-9 rounded-full object-cover cursor-pointer" />
              </button>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-[14px] text-zinc-900 hover:underline">{author.name}</span>
                  {identityMeta && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${identityMeta.className}`}>{identityMeta.label}</span>}
                  {author.id !== 'user_8888' && <CheckCircle2 size={14} className="text-zinc-900 fill-zinc-900" />}
                </div>
                <span className="text-[13px] text-zinc-500">{handle}</span>
              </div>
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowPostMenu(showPostMenu === post.id ? null : post.id)}
                className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <MoreHorizontal size={18} />
              </button>
              {showPostMenu === post.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPostMenu(null)} />
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-50 overflow-hidden">
                    <button 
                      onClick={() => {
                        handleCollectPost(post.id);
                        setShowPostMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left text-[13px] hover:bg-zinc-50 flex items-center gap-2"
                    >
                      <Bookmark size={14} />
                      {post.collections.includes(currentUser.id) ? '取消收藏' : '收藏'}
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        alert('链接已复制');
                        setShowPostMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left text-[13px] hover:bg-zinc-50 flex items-center gap-2"
                    >
                      <Link2 size={14} />
                      复制链接
                    </button>
                    {isOwner ? (
                      <button 
                        onClick={() => {
                          handleDeletePost(post.id);
                          setShowPostMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          handleReport();
                          setShowPostMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                      >
                        <AlertTriangle size={14} />
                        举报
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${threadTypeMeta.className}`}>
              {threadTypeMeta.label}
            </span>
            {post.title && <h1 className="text-base font-bold text-zinc-900">{post.title}</h1>}
          </div>
          <p className="text-[15px] text-zinc-900 leading-normal whitespace-pre-wrap mb-2">{post.content}</p>
          
          {post.images && post.images.length > 0 && (
            <div className={`mb-2 grid gap-0.5 overflow-hidden rounded-2xl border border-zinc-100 ${post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : post.images.length === 3 ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {post.images.map((img, i) => (
                <ResolvedImage
                  key={i}
                  value={img}
                  className={`w-full object-cover ${post.images!.length === 1 ? 'max-h-80' : 'h-32'} ${post.images!.length === 3 && i === 0 ? 'row-span-2 h-full' : ''}`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 text-[13px] text-zinc-500 py-2 border-b border-zinc-100">
            <span>{timeStr}</span>
            <span>·</span>
            <span>{dateStr}</span>
            <span>·</span>
            <span className="font-bold text-zinc-900">{post.viewCount}</span>
            <span>查看</span>
          </div>

          <div className="flex items-center gap-6 py-2 border-b border-zinc-100 text-[13px]">
            <div className="flex items-center gap-1">
              <span className="font-bold text-zinc-900">{post.comments.length}</span>
              <span className="text-zinc-500">回复</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-zinc-900">{post.collections.length}</span>
              <span className="text-zinc-500">转发</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-zinc-900">{post.likes.length}</span>
              <span className="text-zinc-500">喜欢</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-around py-1 border-b border-zinc-100 text-zinc-500">
            <button className="p-1.5 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
              <MessageCircle size={20} />
            </button>
            <button className="p-1.5 hover:text-green-500 hover:bg-green-50 rounded-full transition-colors">
              <Repeat size={20} />
            </button>
            <button 
              onClick={() => handleLikePost(post.id)}
              className={`p-1.5 rounded-full transition-colors ${post.likes.includes(currentUser.id) ? 'text-pink-500' : 'hover:text-pink-500 hover:bg-pink-50'}`}
            >
              <Heart size={20} className={post.likes.includes(currentUser.id) ? 'fill-pink-500' : ''} />
            </button>
            <button 
              onClick={() => setShowShareModal(post.id)}
              className="p-1.5 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <Share2 size={20} />
            </button>
          </div>

          {/* Comments */}
          <div className="mt-0">
            {forumAiLoadingPostId === post.id && (
              <div className="px-4 py-3 text-[12px] text-zinc-500">
                网友正在接楼...
              </div>
            )}
            {sortedComments.map(comment => (
              <ForumCommentItem
                key={comment.id}
                comment={comment}
                post={post}
                author={getAuthor(comment.authorId)}
                handle={formatForumHandle(getAuthor(comment.authorId))}
                identityMeta={getForumIdentityBadgeMeta(resolveCommentIdentity(comment))}
                isOwner={isCurrentUserCommentAuthor(comment.authorId, comment)}
                isPostOwner={comment.authorId === post.authorId}
                floorNumber={floorMap[comment.id] || 0}
                replyToFloor={comment.replyToId ? (floorMap[comment.replyToId] || null) : null}
                replyToAuthorName={comment.replyToId ? getAuthor(post.comments.find((item) => item.id === comment.replyToId)?.authorId || '').name : undefined}
                currentUserAvatar={currentUser.avatar}
                anonymousAvatar={seedFallbackAvatar(`seed-anon-${currentUser.id}-reply`, '匿名')}
                likedByCurrentUser={comment.likes.includes(currentUser.id)}
                repliesCount={post.comments.filter((item) => item.replyToId === comment.id).length}
                timeStr={(() => {
                  const postDate = new Date(comment.timestamp);
                  const now = new Date();
                  const diffMs = now.getTime() - postDate.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMins / 60);
                  const diffDays = Math.floor(diffHours / 24);
                  if (diffMins < 1) return '刚刚';
                  if (diffMins < 60) return `${diffMins}分钟`;
                  if (diffHours < 24) return `${diffHours}小时`;
                  if (diffDays < 365) return postDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
                  return postDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
                })()}
                onReply={handleCommentWithAi}
                onLike={handleLikeComment}
                onDelete={(postId, commentId) => { void handleDeleteComment(postId, commentId); }}
                onReport={handleReport}
                onUserClick={handleUserClick}
              />
            ))}
          </div>
        </div>

        {/* Reply Input */}
        <div className="sticky bottom-0 z-20 shrink-0 bg-white border-t border-zinc-100 px-3 py-2 flex items-center gap-3">
          <ResolvedImage
            value={commentIdentity === 'anonymous' ? seedFallbackAvatar(`seed-anon-${currentUser.id}-main`, '匿名') : currentUser.avatar}
            className="w-7 h-7 rounded-full object-cover"
          />
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCommentIdentity('self')}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${commentIdentity === 'self' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'}`}
            >
              本人
            </button>
            <button
              type="button"
              onClick={() => setCommentIdentity('anonymous')}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${commentIdentity === 'anonymous' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'}`}
            >
              匿名
            </button>
          </div>
          <input 
            type="text" 
            value={mainReplyText}
            onChange={(e) => setMainReplyText(e.target.value)}
            placeholder="发布你的回复"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder-zinc-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && mainReplyText.trim()) {
                void handleCommentWithAi(post.id, mainReplyText.trim(), undefined, undefined, commentIdentity);
                setMainReplyText('');
                setCommentIdentity('self');
              }
            }}
          />
          <button 
            onClick={() => {
              if (mainReplyText.trim()) {
                void handleCommentWithAi(post.id, mainReplyText.trim(), undefined, undefined, commentIdentity);
                setMainReplyText('');
                setCommentIdentity('self');
              }
            }}
            disabled={!mainReplyText.trim()}
            className={`px-3 py-1.5 rounded-full font-bold text-[12px] transition-all shrink-0 whitespace-nowrap ${mainReplyText.trim() ? 'border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'}`}
          >
            回复
          </button>
        </div>
        {/* Share Modal */}
        {renderShareModal()}
      </div>
    );
  };

  const renderEditor = () => (
    <div className="bg-white h-full min-h-0 flex flex-col">
      <div className="px-4 pb-3 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10" style={forumTopInsetStyle}>
        <button onClick={() => {
          setCurrentView('list');
          setEditingPostId(null);
          setEditorIdentity('self');
        }} className="text-zinc-900 font-bold text-[14px]">取消</button>
        <div className="flex gap-4 items-center">
          <button onClick={saveForumComposerDraft} className="text-zinc-900 font-bold text-[14px]">草稿</button>
          <button 
            onClick={handlePublish}
            className={`rounded-full border px-4 py-1.5 text-[14px] font-bold transition-colors ${(!editorTitle.trim() || !editorContent.trim()) ? 'border-zinc-200 bg-zinc-100 text-zinc-400 opacity-60' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
          >
            发布
          </button>
        </div>
      </div>
      <div className="p-4 flex-1 min-h-0 overflow-y-auto flex gap-3">
        <ResolvedImage
          value={editorIdentity === 'anonymous' ? seedFallbackAvatar(buildAnonymousPostAuthorId(), '匿名') : currentUser.avatar}
          className="w-10 h-10 rounded-full object-cover shrink-0"
        />
        <div className="flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[12px] font-bold text-zinc-600">
              发到 {activeChannelMeta.label}
            </div>
            <button
              type="button"
              onClick={() => setEditorIdentity('self')}
              className={`rounded-full border px-3 py-1 text-[12px] font-bold transition-colors ${editorIdentity === 'self' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'}`}
            >
              本人发帖
            </button>
            <button
              type="button"
              onClick={() => setEditorIdentity('anonymous')}
              className={`rounded-full border px-3 py-1 text-[12px] font-bold transition-colors ${editorIdentity === 'anonymous' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'}`}
            >
              匿名发帖
            </button>
          </div>
          <div className="mb-3 text-[12px] text-zinc-500">
            {editorIdentity === 'anonymous' ? '这条帖子会以前台匿名马甲显示，但仍算你的帖子。' : '这条帖子会以你的当前身份发布。'}
          </div>
          <input
            type="text"
            placeholder="标题（可选）"
            value={editorTitle}
            onChange={e => setEditorTitle(e.target.value)}
            className="w-full text-base font-bold outline-none placeholder-zinc-500 mb-2 bg-transparent"
          />
          <textarea
            placeholder="有什么新鲜事？！"
            value={editorContent}
            onChange={e => setEditorContent(e.target.value)}
            className="w-full h-32 text-lg outline-none resize-none placeholder-zinc-500 bg-transparent"
          />
          
          {editorImages.length > 0 && (
            <div className={`grid gap-0.5 mt-4 overflow-hidden rounded-2xl border border-zinc-100 ${editorImages.length === 1 ? 'grid-cols-1' : editorImages.length === 2 ? 'grid-cols-2' : editorImages.length === 3 ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {editorImages.map((img, i) => (
                <div key={i} className={`relative ${editorImages.length === 1 ? 'max-h-80' : 'h-32'} ${editorImages.length === 3 && i === 0 ? 'row-span-2 h-full' : ''}`}>
                  <ResolvedImage value={img} className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setEditorImages(editorImages.filter((_, idx) => idx !== i))}
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors backdrop-blur-sm"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-zinc-100 text-zinc-900">
            <label className="p-2 hover:bg-zinc-100 rounded-full transition-colors -ml-2 cursor-pointer">
              <ImageIcon size={20} />
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []) as File[];
                  if (files.length === 0) {
                    e.target.value = '';
                    return;
                  }
                  const uploadedValues = await Promise.all(files.map(file => setUploadedFile(file)));
                  setEditorImages(prev => [...prev, ...uploadedValues].slice(0, 9));
                  e.target.value = '';
                }} 
              />
            </label>
            <button 
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <Link2 size={20} />
            </button>
            <button className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <Camera size={20} />
            </button>
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
                onClick={async () => {
                  const urls = extractImageUrls(urlInput);
                  if (urls.length > 0) {
                    const normalizedUrls = await Promise.all(urls.map(url => setRemoteUrl(url)));
                    setEditorImages(prev => [...prev, ...normalizedUrls].slice(0, 9));
                    setUrlInput('');
                    setShowUrlInput(false);
                  }
                }}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-zinc-100 py-1.5 text-xs font-bold text-zinc-900 hover:bg-zinc-200"
              >
                添加这些链接
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderHotList = () => {
    // Sort posts by view count + comments + likes for "hotness"
    const hotPosts = [...posts].sort((a, b) => {
      const scoreA = a.viewCount + a.comments.length * 10 + a.likes.length * 5;
      const scoreB = b.viewCount + b.comments.length * 10 + b.likes.length * 5;
      return scoreB - scoreA;
    });

    return (
      <div className="forum-app-scroll bg-white h-full min-h-0 overflow-y-auto" style={forumBottomInsetStyle}>
        <div className="sticky top-0 z-10 border-b border-zinc-100 bg-white/95 px-5 pb-3 backdrop-blur-md" style={forumTopInsetStyle}>
          <h2 className="text-[20px] font-black tracking-tight text-zinc-900">为你推荐的趋势</h2>
        </div>
        <div className="space-y-0">
          {hotPosts.map((post, index) => {
            const author = getAuthor(post.authorId);
            const threadTypeMeta = getForumThreadTypeMeta(post.threadType);
            return (
              <div 
                key={post.id}
                onClick={() => {
                  setSelectedPostId(post.id);
                  setCurrentView('detail');
                  const newPosts = posts.map(p => p.id === post.id ? { ...p, viewCount: p.viewCount + 1 } : p);
                  updatePosts(newPosts);
                }}
                className="flex cursor-pointer items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-zinc-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <span className="text-[12px] text-zinc-500 font-bold">{index + 1} · 趋势</span>
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPostMenu(showPostMenu === post.id ? null : post.id);
                        }}
                        className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 p-1.5 rounded-full transition-colors -mr-1.5"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {showPostMenu === post.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowPostMenu(null); }} />
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-50 overflow-hidden">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCollectPost(post.id);
                                setShowPostMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-[14px] hover:bg-zinc-50 flex items-center gap-2"
                            >
                              <Bookmark size={16} />
                              {post.collections.includes(currentUser.id) ? '取消收藏' : '收藏'}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(window.location.href);
                                alert('链接已复制');
                                setShowPostMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-[14px] hover:bg-zinc-50 flex items-center gap-2"
                            >
                              <Link2 size={16} />
                              复制链接
                            </button>
                            {isCurrentUserPostAuthor(post.authorId, post) ? (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePost(post.id);
                                  setShowPostMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-[14px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={16} />
                                删除
                              </button>
                            ) : (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReport();
                                  setShowPostMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-[14px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                <AlertTriangle size={16} />
                                举报
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-2 pr-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${threadTypeMeta.className}`}>
                      {threadTypeMeta.label}
                    </span>
                    <h3 className="text-[15px] font-bold leading-7 text-zinc-900 line-clamp-2">{post.title || post.content}</h3>
                  </div>
                  <div className="text-[12px] text-zinc-500">
                    {post.viewCount > 1000 ? `${(post.viewCount / 1000).toFixed(1)}K` : post.viewCount} 帖子
                  </div>
                </div>
                {post.images && post.images.length > 0 && (
                <ResolvedImage value={post.images[0]} className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
                )}
              </div>
            );
          })}
        </div>
        {/* Share Modal */}
        {renderShareModal()}
      </div>
    );
  };

  const renderUserProfile = () => {
    if (!viewingUserId) return null;
    const user = getAuthor(viewingUserId);
    const userPosts = posts.filter(p => p.authorId === viewingUserId).sort((a, b) => b.timestamp - a.timestamp);
    const handle = formatForumHandle(user);
    const isFollowed = followedUsers.includes(user.id);
    const userFollowingCount = resolveFollowingIdsForUser(user.id).length;
    const userFollowerCount = collectFollowerIdsForUser(user.id).length;

    return (
      <div className="forum-app-scroll bg-white h-full min-h-0 overflow-y-auto" style={forumBottomInsetStyle}>
        {/* Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 px-4 pb-3 flex items-center gap-6" style={forumTopInsetStyle}>
          <button onClick={() => {
            setCurrentView('list');
            setViewingUserId(null);
          }} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <h2 className="font-bold text-lg text-zinc-900 leading-tight">{user.name}</h2>
            <span className="text-[12px] text-zinc-500">{userPosts.length} 帖子</span>
          </div>
        </div>

        {/* Profile Header */}
        <div className="px-4 pt-12 pb-6">
          <div className="rounded-[28px] border border-zinc-100 bg-zinc-50/60 p-4">
            <div className="flex items-start gap-4">
              <ResolvedImage value={user.avatar} className="w-24 h-24 rounded-full border-2 border-white object-cover shadow-sm shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[20px] font-bold text-zinc-900 leading-tight break-words">{user.name}</h2>
                    <p className="mt-1 text-[12px] text-zinc-500 break-all">{handle}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pt-1">
                    {canOpenForumPrivateChat(user.id) && (
                      <button
                        onClick={() => openForumPrivateChat(user.id)}
                        className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-900 hover:bg-zinc-50 transition-colors"
                      >
                        <MessageCircle size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => handleFollow(user.id)}
                      className={`px-5 py-1.5 rounded-full font-bold text-[13px] transition-colors ${
                        isFollowed
                          ? 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                          : 'border border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                      }`}
                    >
                      {isFollowed ? '已关注' : '关注'}
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-[13px] leading-7 text-zinc-600 break-words">
                  {('bio' in user ? user.bio : 'description' in user ? user.description : '') || '暂无简介。'}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-100 pt-4">
              <div className="rounded-2xl bg-white px-3 py-3 text-center">
                <div className="text-[18px] font-bold text-zinc-900">{userPosts.length}</div>
                <div className="mt-1 text-[11px] text-zinc-400">帖子</div>
              </div>
              <button
                type="button"
                onClick={() => openFollowList('following', user.id)}
                className="rounded-2xl bg-white px-3 py-3 text-center transition-colors hover:bg-zinc-50"
              >
                <div className="text-[18px] font-bold text-zinc-900">{userFollowingCount}</div>
                <div className="mt-1 text-[11px] text-zinc-400">正在关注</div>
              </button>
              <button
                type="button"
                onClick={() => openFollowList('followers', user.id)}
                className="rounded-2xl bg-white px-3 py-3 text-center transition-colors hover:bg-zinc-50"
              >
                <div className="text-[18px] font-bold text-zinc-900">{userFollowerCount}</div>
                <div className="mt-1 text-[11px] text-zinc-400">关注者</div>
              </button>
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="flex border-b border-zinc-100">
          <button className="flex-1 py-4 text-[14px] font-bold text-zinc-900 relative hover:bg-zinc-50 transition-colors">
            帖子
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />
          </button>
          <button className="flex-1 py-4 text-[14px] font-bold text-zinc-500 relative hover:bg-zinc-50 transition-colors">
            回复
          </button>
          <button className="flex-1 py-4 text-[14px] font-bold text-zinc-500 relative hover:bg-zinc-50 transition-colors">
            喜欢
          </button>
        </div>

        <div className="space-y-0">
          {/* User Posts Section */}
          {userPosts.length > 0 ? userPosts.map(post => {
            const threadTypeMeta = getForumThreadTypeMeta(post.threadType);
            const postDate = new Date(post.timestamp);
            const now = new Date();
            const diffMs = now.getTime() - postDate.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);
            let timeStr = '';
            if (diffMins < 1) timeStr = '刚刚';
            else if (diffMins < 60) timeStr = `${diffMins}分钟`;
            else if (diffHours < 24) timeStr = `${diffHours}小时`;
            else if (diffDays < 365) timeStr = postDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
            else timeStr = postDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });

            return (
              <div 
                key={post.id}
                onClick={() => {
                  setSelectedPostId(post.id);
                  setCurrentView('detail');
                }}
                className="bg-white p-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer flex gap-3"
              >
                <ResolvedImage value={user.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[14px] truncate">
                      <span className="font-bold text-zinc-900 truncate hover:underline">{user.name}</span>
                      <span className="text-zinc-500 truncate">{handle}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-500 hover:underline">{timeStr}</span>
                    </div>
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPostMenu(showPostMenu === post.id ? null : post.id);
                        }}
                        className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 p-1.5 rounded-full transition-colors -mr-1.5"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {showPostMenu === post.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowPostMenu(null); }} />
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-50 overflow-hidden">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCollectPost(post.id);
                                setShowPostMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-[14px] hover:bg-zinc-50 flex items-center gap-2"
                            >
                              <Bookmark size={16} />
                              {post.collections.includes(currentUser.id) ? '取消收藏' : '收藏'}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(window.location.href);
                                alert('链接已复制');
                                setShowPostMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-[14px] hover:bg-zinc-50 flex items-center gap-2"
                            >
                              <Link2 size={16} />
                              复制链接
                            </button>
                            {isCurrentUserPostAuthor(post.authorId, post) ? (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePost(post.id);
                                  setShowPostMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-[14px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={16} />
                                删除
                              </button>
                            ) : (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReport();
                                  setShowPostMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-[14px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                <AlertTriangle size={16} />
                                举报
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${threadTypeMeta.className}`}>
                      {threadTypeMeta.label}
                    </span>
                    {post.title && <h3 className="text-[14px] font-bold text-zinc-900">{post.title}</h3>}
                  </div>
                  <p className="text-[14px] text-zinc-900 mt-0.5 whitespace-pre-wrap leading-snug">{post.content}</p>
                  
                  <div className="flex items-center justify-between mt-3 text-zinc-500 max-w-md pr-4">
                    <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
                      <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
                        <MessageCircle size={18} />
                      </div>
                      <span className="text-[12px]">{post.comments.length > 0 ? post.comments.length : ''}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-green-500 group transition-colors">
                      <div className="p-1.5 rounded-full group-hover:bg-green-50 transition-colors -ml-1.5">
                        <Repeat size={18} />
                      </div>
                      <span className="text-[12px]">{post.collections.length > 0 ? post.collections.length : ''}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-pink-500 group transition-colors">
                      <div className="p-1.5 rounded-full group-hover:bg-pink-50 transition-colors -ml-1.5">
                        <Heart size={18} />
                      </div>
                      <span className="text-[12px]">{post.likes.length > 0 ? post.likes.length : ''}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
                      <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
                        <BarChart2 size={18} />
                      </div>
                      <span className="text-[12px]">{post.viewCount > 0 ? post.viewCount : ''}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-10 text-zinc-500 text-[14px]">
              <h3 className="font-bold text-lg text-zinc-900 mb-2">还没有帖子</h3>
              <p>当该用户发布帖子时，它会显示在这里。</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTempChat = () => {
    if (!activeTempChatUserId) return null;
    const author = getAuthor(activeTempChatUserId);
    const session = tempChats[activeTempChatUserId];
    if (!session) return null;
    return (
      <ForumTempChatView
        author={author}
        session={session}
        currentUserAvatar={currentUser.avatar}
        tempChatInput={tempChatInput}
        tempChatLoading={tempChatLoading}
        onBack={() => {
          setCurrentView('user-profile');
          setTempChatInput('');
        }}
        onUpgrade={() => handleUpgradeForumFriend(activeTempChatUserId)}
        onInputChange={setTempChatInput}
        onSend={() => { void handleSendTempChatMessage(); }}
        topInsetStyle={forumTopInsetStyle}
      />
    );
  };

  const renderFollowList = () => {
    const targetUserId = followListUserId || currentUser.id;
    const targetUser = getAuthor(targetUserId);
    const rawFollowIds = followListMode === 'following'
      ? resolveFollowingIdsForUser(targetUserId)
      : collectFollowerIdsForUser(targetUserId);
    const followIds = rawFollowIds.filter((userId) => {
      if (!followListSearch.trim()) return true;
      const user = getAuthor(userId);
      const keyword = followListSearch.trim().toLowerCase();
      return (
        user.name.toLowerCase().includes(keyword)
        || formatForumHandle(user).toLowerCase().includes(keyword)
        || (user.bio || user.description || '').toLowerCase().includes(keyword)
      );
    });

    return (
      <div className="bg-white h-full min-h-0 flex flex-col">
        <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 px-4 pb-3 flex items-center gap-6" style={forumTopInsetStyle}>
          <button
            onClick={() => {
              if (targetUserId === currentUser.id) {
                setCurrentView('list');
                setActiveTab('profile');
              } else {
                setCurrentView('user-profile');
              }
            }}
            className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="font-bold text-lg text-zinc-900">
              {followListMode === 'following' ? '正在关注' : '关注者'}
            </h2>
            <div className="text-[12px] text-zinc-500 truncate">
              {targetUser.name} · {rawFollowIds.length}
            </div>
          </div>
        </div>

        <div className="border-b border-zinc-100 px-4 py-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <input
              type="text"
              value={followListSearch}
              onChange={(e) => setFollowListSearch(e.target.value)}
              placeholder={followListMode === 'following' ? '搜索你关注的人' : '搜索关注你的人'}
              className="w-full bg-transparent text-[13px] text-zinc-900 outline-none placeholder-zinc-400"
            />
          </div>
        </div>

        <div className="forum-app-scroll flex-1 min-h-0 overflow-y-auto bg-white" style={forumBottomInsetStyle}>
          {followIds.length === 0 ? (
            <div className="px-8 pt-16 text-center text-[14px] text-zinc-500">
              <h3 className="mb-3 text-[18px] font-bold text-zinc-900">这里还没有名单</h3>
              <p className="leading-7">
                {followListSearch.trim()
                  ? '没有搜到匹配的人。'
                  : followListMode === 'following'
                    ? '还没有关注任何人。'
                    : '目前还没有整理出关注者。'}
              </p>
            </div>
          ) : (
            followIds.map((userId) => {
              const user = getAuthor(userId);
              const handle = formatForumHandle(user);
              const isFollowed = followedUsers.includes(userId);
              const canChat = canOpenForumPrivateChat(userId);

              return (
                <div key={userId} className="flex items-center gap-3 border-b border-zinc-100 px-4 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      setViewingUserId(userId);
                      setCurrentView('user-profile');
                    }}
                    className="shrink-0"
                  >
                    <ResolvedImage value={user.avatar} className="h-12 w-12 rounded-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewingUserId(userId);
                      setCurrentView('user-profile');
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[15px] font-bold text-zinc-900">{user.name}</div>
                    <div className="mt-1 truncate text-[12px] text-zinc-500">{handle}</div>
                    <div className="mt-1 truncate text-[12px] text-zinc-400">
                      {user.bio || user.description || '这个人还没有留下简介。'}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {canChat && (
                      <button
                        type="button"
                        onClick={() => openForumPrivateChat(userId)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-50"
                      >
                        <MessageCircle size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleFollow(userId)}
                      className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition-colors ${
                        isFollowed
                          ? 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                          : 'border border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                      }`}
                    >
                      {isFollowed ? '已关注' : '关注'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderProfile = () => {
    const myPosts = posts.filter((p) => isCurrentUserPostAuthor(p.authorId, p));
    const myReplies = posts.flatMap((p) => p.comments).filter((c) => isCurrentUserCommentAuthor(c.authorId, c));
    const myLikedPosts = posts.filter(p => p.likes.includes(currentUser.id));
    const handle = formatCurrentUserForumHandle(currentUser.id);
    const followingCount = followedUsers.length;
    const followerCount = collectFollowerIdsForUser(currentUser.id).length;

    const formatProfileTime = (timestamp: number) => {
      const postDate = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - postDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return `${diffMins}分钟`;
      if (diffHours < 24) return `${diffHours}小时`;
      if (diffDays < 365) return postDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      return postDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const openProfilePost = (postId: string) => {
      setSelectedPostId(postId);
      setCurrentView('detail');
    };

    const renderProfilePostCard = (post: ForumPost) => {
      const author = getAuthor(post.authorId);
      const handle = formatForumHandle(author);
      const identityMeta = getForumIdentityBadgeMeta(resolvePostIdentity(post));
      const timeStr = formatProfileTime(post.timestamp);
      const threadTypeMeta = getForumThreadTypeMeta(post.threadType);
      return (
        <div
          key={post.id}
          onClick={() => openProfilePost(post.id)}
          className="bg-white p-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer flex gap-3"
        >
          <ResolvedImage value={author.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[14px] truncate">
                <span className="font-bold text-zinc-900 truncate hover:underline">{author.name}</span>
                {identityMeta && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${identityMeta.className}`}>{identityMeta.label}</span>}
                <span className="text-zinc-500 truncate">{handle}</span>
                <span className="text-zinc-500">·</span>
                <span className="text-zinc-500 hover:underline">{timeStr}</span>
              </div>
              <button className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 p-1.5 rounded-full transition-colors -mr-1.5">
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${threadTypeMeta.className}`}>
                {threadTypeMeta.label}
              </span>
              {post.title && <h3 className="text-[14px] font-bold text-zinc-900">{post.title}</h3>}
            </div>
            <p className="text-[14px] text-zinc-900 mt-0.5 whitespace-pre-wrap leading-snug">{post.content}</p>

            <div className="flex items-center justify-between mt-3 text-zinc-500 max-w-md pr-4">
              <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
                <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
                  <MessageCircle size={18} />
                </div>
                <span className="text-[12px]">{post.comments.length > 0 ? post.comments.length : ''}</span>
              </button>
              <button className="flex items-center gap-1 hover:text-green-500 group transition-colors">
                <div className="p-1.5 rounded-full group-hover:bg-green-50 transition-colors -ml-1.5">
                  <Repeat size={18} />
                </div>
                <span className="text-[12px]">{post.collections.length > 0 ? post.collections.length : ''}</span>
              </button>
              <button className="flex items-center gap-1 hover:text-pink-500 group transition-colors">
                <div className="p-1.5 rounded-full group-hover:bg-pink-50 transition-colors -ml-1.5">
                  <Heart size={18} />
                </div>
                <span className="text-[12px]">{post.likes.length > 0 ? post.likes.length : ''}</span>
              </button>
              <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
                <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
                  <BarChart2 size={18} />
                </div>
                <span className="text-[12px]">{post.viewCount > 0 ? post.viewCount : ''}</span>
              </button>
            </div>
          </div>
        </div>
      );
    };

    const renderProfileReplyCard = (comment: ForumComment) => {
      const parentPost = posts.find((post) => post.id === comment.postId);
      const replyToComment = parentPost?.comments.find((item) => item.id === comment.replyToId);
      const author = getAuthor(comment.authorId);
      const handle = formatForumHandle(author);
      const identityMeta = getForumIdentityBadgeMeta(resolveCommentIdentity(comment));
      return (
        <div
          key={comment.id}
          onClick={() => openProfilePost(comment.postId)}
          className="bg-white p-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer flex gap-3"
        >
          <ResolvedImage value={author.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-[14px] truncate">
              <span className="font-bold text-zinc-900 truncate">{author.name}</span>
              {identityMeta && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${identityMeta.className}`}>{identityMeta.label}</span>}
              <span className="text-zinc-500 truncate">{handle}</span>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-500">{formatProfileTime(comment.timestamp)}</span>
            </div>
            <div className="mt-2 rounded-2xl bg-zinc-50 px-3 py-2 text-[12px] text-zinc-500">
              回复在 {parentPost?.title || parentPost?.content.slice(0, 18) || '这条帖子'} 下
              {replyToComment ? ` · 接的是“${replyToComment.content.slice(0, 14)}”` : ''}
            </div>
            <p className="mt-2 text-[14px] text-zinc-900 whitespace-pre-wrap leading-snug">{comment.content}</p>
            <div className="mt-3 flex items-center gap-5 text-[12px] text-zinc-500">
              <span>获赞 {comment.likes.length}</span>
              <span>查看原帖</span>
            </div>
          </div>
        </div>
      );
    };

    if (currentView === 'edit-profile') {
      return (
        <div className="bg-white h-full min-h-0 flex flex-col">
          <div className="px-4 pb-3 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10" style={forumTopInsetStyle}>
            <div className="flex items-center gap-6">
              <button onClick={() => setCurrentView('list')} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
                <ArrowLeft size={20} />
              </button>
              <h2 className="font-bold text-lg text-zinc-900">编辑个人资料</h2>
            </div>
            <button 
              onClick={handleUpdateProfile} 
              className="rounded-full border border-zinc-200 bg-zinc-100 px-4 py-1.5 text-[14px] font-bold text-zinc-900 hover:bg-zinc-200"
            >
              保存
            </button>
          </div>
          <div className="p-4 flex-1 min-h-0 overflow-y-auto space-y-6">
            <div className="mb-6">
              <input
                ref={profileAvatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const persistedValue = await setUploadedFile(file);
                  setEditAvatar(persistedValue);
                  event.currentTarget.value = '';
                }}
              />
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <ResolvedImage value={editAvatar || currentUser.avatar} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-sm" />
                  <button
                    type="button"
                    onClick={() => profileAvatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-sky-700 shadow-sm transition-colors hover:bg-sky-100"
                  >
                    <Camera size={16} />
                  </button>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="text-[13px] font-bold text-zinc-900">头像</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editAvatarUrlInput}
                      onChange={(e) => setEditAvatarUrlInput(e.target.value)}
                      placeholder="粘贴头像链接"
                      className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] text-zinc-900 outline-none transition-colors focus:border-sky-300 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!editAvatarUrlInput.trim()) return;
                        const finalUrl = await setRemoteUrl(extractImageUrls(editAvatarUrlInput)[0] || editAvatarUrlInput.trim());
                        setEditAvatar(finalUrl);
                        setEditAvatarUrlInput('');
                      }}
                      className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] font-bold text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      使用链接
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => profileAvatarInputRef.current?.click()}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] font-bold text-zinc-700 transition-colors hover:bg-zinc-100"
                  >
                    上传本地图片
                  </button>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="relative border border-zinc-200 rounded-md px-3 py-2 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 transition-all">
                <label className="block text-[12px] text-zinc-500">名称</label>
                <input 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-transparent text-[14px] text-zinc-900 outline-none" 
                />
              </div>
              <div className="relative border border-zinc-200 rounded-md px-3 py-2 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 transition-all">
                <label className="block text-[12px] text-zinc-500">ID</label>
                <input
                  value={editId}
                  onChange={e => setEditId(e.target.value)}
                  placeholder="例如 linran 或 user_8888"
                  className="w-full bg-transparent text-[14px] text-zinc-900 outline-none font-mono"
                />
                <div className="mt-1 text-[11px] text-zinc-400">
                  当前论坛显示为 {formatCurrentUserForumHandle(editId || currentUser.id)}
                </div>
              </div>
              <div className="relative border border-zinc-200 rounded-md px-3 py-2 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 transition-all">
                <label className="block text-[12px] text-zinc-500">简介</label>
                <textarea 
                  value={editBio} 
                  onChange={e => setEditBio(e.target.value)}
                  className="w-full bg-transparent text-[14px] text-zinc-900 outline-none h-20 resize-none" 
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="forum-app-scroll bg-white h-full min-h-0 overflow-y-auto pb-20">
        {/* Profile Header */}
        <div className="px-4 pt-12 pb-6">
          <div className="flex gap-6">
            {/* Left: Avatar, Name, ID */}
            <div className="flex flex-col items-center shrink-0 w-24">
              <ResolvedImage value={currentUser.avatar} className="w-24 h-24 rounded-full border-2 border-zinc-100 object-cover shadow-sm mb-3" />
              <h2 className="text-[15px] font-bold text-zinc-900 text-center leading-tight">{currentUser.name}</h2>
              <p className="text-[12px] text-zinc-500 text-center mt-1">{handle}</p>
            </div>

            {/* Right: Bio, Stats, Actions */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-end mb-4">
                <button 
                  onClick={() => {
                    setEditName(currentUser.name);
                    setEditId(currentUser.id);
                    setEditBio(currentUser.bio);
                    setEditAvatar(currentUser.avatar);
                    setEditAvatarUrlInput('');
                    setCurrentView('edit-profile');
                  }}
                  className="px-5 py-1.5 rounded-full border border-zinc-200 font-bold text-[13px] text-zinc-900 hover:bg-zinc-50 transition-colors"
                >
                  编辑个人资料
                </button>
              </div>

              <div className="p-2 flex-1">
                <p className="text-[13px] text-zinc-600 leading-relaxed mb-4 italic">
                  {currentUser.bio || '暂无简介。'}
                </p>
                <div className="flex gap-6 border-t border-zinc-100 pt-3">
                  <button
                    type="button"
                    onClick={() => openFollowList('following', currentUser.id)}
                    className="flex flex-col rounded-xl px-1 text-left transition-colors hover:bg-zinc-50"
                  >
                    <span className="font-bold text-zinc-900 text-[14px]">{followingCount}</span>
                    <span className="text-zinc-400 text-[11px] uppercase tracking-wider text-center">正在关注</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openFollowList('followers', currentUser.id)}
                    className="flex flex-col rounded-xl px-1 text-left transition-colors hover:bg-zinc-50"
                  >
                    <span className="font-bold text-zinc-900 text-[14px]">{followerCount.toLocaleString('zh-CN')}</span>
                    <span className="text-zinc-400 text-[11px] uppercase tracking-wider text-center">关注者</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="flex border-b border-zinc-100">
          <button
            onClick={() => setProfileTab('posts')}
            className={`flex-1 py-4 text-[14px] font-bold relative hover:bg-zinc-50 transition-colors ${profileTab === 'posts' ? 'text-zinc-900' : 'text-zinc-500'}`}
          >
            帖子
            {profileTab === 'posts' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />}
          </button>
          <button
            onClick={() => setProfileTab('replies')}
            className={`flex-1 py-4 text-[14px] font-bold relative hover:bg-zinc-50 transition-colors ${profileTab === 'replies' ? 'text-zinc-900' : 'text-zinc-500'}`}
          >
            回复
            {profileTab === 'replies' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />}
          </button>
          <button
            onClick={() => setProfileTab('likes')}
            className={`flex-1 py-4 text-[14px] font-bold relative hover:bg-zinc-50 transition-colors ${profileTab === 'likes' ? 'text-zinc-900' : 'text-zinc-500'}`}
          >
            喜欢
            {profileTab === 'likes' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />}
          </button>
        </div>

        <div className="space-y-0">
          {profileTab === 'posts' && (
            myPosts.length > 0 ? myPosts.map(renderProfilePostCard) : (
              <div className="text-center py-10 text-zinc-500 text-[14px]">
                <h3 className="font-bold text-lg text-zinc-900 mb-2">还没有帖子</h3>
                <p>当你发布帖子时，它会显示在这里。</p>
              </div>
            )
          )}
          {profileTab === 'replies' && (
            myReplies.length > 0 ? myReplies
              .sort((a, b) => b.timestamp - a.timestamp)
              .map(renderProfileReplyCard) : (
                <div className="text-center py-10 text-zinc-500 text-[14px]">
                  <h3 className="font-bold text-lg text-zinc-900 mb-2">还没有回复</h3>
                  <p>当你在帖子里回帖后，这里会显示你的回复记录。</p>
                </div>
              )
          )}
          {profileTab === 'likes' && (
            myLikedPosts.length > 0 ? myLikedPosts.map(renderProfilePostCard) : (
              <div className="text-center py-10 text-zinc-500 text-[14px]">
                <h3 className="font-bold text-lg text-zinc-900 mb-2">还没有喜欢</h3>
                <p>当你点过喜欢的帖子时，它们会显示在这里。</p>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  const renderNotifications = () => {
    const myNotifications = notifications.filter(n => n.userId === currentUser.id).sort((a, b) => b.timestamp - a.timestamp);
    const chatSessions = Object.values(tempChats)
      .map((session) => {
        const author = getAuthor(session.authorId);
        const lastMessage = session.messages[session.messages.length - 1] || null;
        const relatedPost = resolveRecentForumPostForAuthor(session.authorId);
        const isUnread = !!lastMessage
          && lastMessage.role === 'npc'
          && lastMessage.timestamp > (session.viewerLastSeenAt || 0);

        return {
          session,
          author,
          lastMessage,
          relatedPost,
          isUnread,
          isMutual: isMutualForumFollow(session.authorId),
          sortTimestamp: lastMessage?.timestamp || session.updatedAt || session.createdAt,
        };
      });
    const sortChatSessionGroup = (items: typeof chatSessions) => [...items].sort((a, b) => {
      if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;
      if (!!a.session.pendingReply !== !!b.session.pendingReply) return a.session.pendingReply ? -1 : 1;
      return b.sortTimestamp - a.sortTimestamp;
    });
    const mutualChatSessions = sortChatSessionGroup(chatSessions.filter((item) => item.isMutual));
    const strangerChatSessions = sortChatSessionGroup(chatSessions.filter((item) => !item.isMutual));
    const visibleChatSessions = chatListTab === 'mutual' ? mutualChatSessions : strangerChatSessions;
    const mutualUnreadCount = mutualChatSessions.filter((item) => item.isUnread).length;
    const strangerUnreadCount = strangerChatSessions.filter((item) => item.isUnread).length;
    
    return (
      <div className="forum-app-scroll bg-white h-full min-h-0 overflow-y-auto" style={forumBottomInsetStyle}>
        <div className="px-4 pb-3 bg-white/90 backdrop-blur-md sticky top-0 z-10 border-b border-zinc-100 flex items-center justify-between" style={forumTopInsetStyle}>
           <div className="text-[20px] font-black tracking-tight text-zinc-900">消息</div>
           <button className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
             <Settings size={20} className="text-zinc-900" />
           </button>
        </div>
        
        <div className="flex border-b border-zinc-100">
          <button
            onClick={() => setMessageTab('chats')}
            className={`flex-1 py-4 text-[14px] font-bold relative hover:bg-zinc-50 transition-colors ${messageTab === 'chats' ? 'text-zinc-900' : 'text-zinc-500'}`}
          >
            聊天
            {messageTab === 'chats' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />}
          </button>
          <button
            onClick={() => setMessageTab('activity')}
            className={`flex-1 py-4 text-[14px] font-bold relative hover:bg-zinc-50 transition-colors ${messageTab === 'activity' ? 'text-zinc-900' : 'text-zinc-500'}`}
          >
            通知
            {messageTab === 'activity' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />}
          </button>
        </div>

        {messageTab === 'chats' ? (
          <div className="space-y-0">
            <div className="flex border-b border-zinc-100 bg-white px-4">
              <button
                type="button"
                onClick={() => setChatListTab('mutual')}
                className={`relative flex-1 py-3 text-[13px] font-medium transition-colors ${chatListTab === 'mutual' ? 'text-zinc-900' : 'text-zinc-500'}`}
              >
                互相关注
                <span className="ml-1 text-[11px] text-zinc-400">{mutualChatSessions.length}</span>
                {mutualUnreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {mutualUnreadCount}
                  </span>
                )}
                {chatListTab === 'mutual' && <div className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-zinc-900" />}
              </button>
              <button
                type="button"
                onClick={() => setChatListTab('strangers')}
                className={`relative flex-1 py-3 text-[13px] font-medium transition-colors ${chatListTab === 'strangers' ? 'text-zinc-900' : 'text-zinc-500'}`}
              >
                陌生人
                <span className="ml-1 text-[11px] text-zinc-400">{strangerChatSessions.length}</span>
                {strangerUnreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {strangerUnreadCount}
                  </span>
                )}
                {chatListTab === 'strangers' && <div className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-zinc-900" />}
              </button>
            </div>
            {visibleChatSessions.length > 0 && (
              <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 text-[12px] text-zinc-500">
                {chatListTab === 'mutual'
                  ? `按未读优先展示互相关注会话，共 ${mutualChatSessions.length} 条`
                  : `按未读优先展示陌生人会话，共 ${strangerChatSessions.length} 条`}
              </div>
            )}
            {visibleChatSessions.map(({ session, author, lastMessage, relatedPost, isUnread, isMutual }) => (
              <button
                key={session.authorId}
                type="button"
                onClick={() => {
                  updateTempChatSession(session.authorId, (currentSession) => ({
                    ...currentSession,
                    viewerLastSeenAt: Date.now(),
                  }));
                  setViewingUserId(session.authorId);
                  setActiveTempChatUserId(session.authorId);
                  setCurrentView('temp-chat');
                }}
                className="flex w-full gap-3 border-b border-zinc-100 bg-white px-4 py-4 text-left transition-colors hover:bg-zinc-50"
              >
                <div className="relative shrink-0">
                  <ResolvedImage value={author.avatar} className="h-12 w-12 rounded-full object-cover" />
                  {isUnread && <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-[15px] font-bold text-zinc-900">{author.name}</span>
                        {isMutual && (
                          <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-600">互关</span>
                        )}
                        {session.addedAsFriend && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">已加好友</span>
                        )}
                      </div>
                      <div className="truncate text-[12px] text-zinc-500">{formatForumHandle(author)}</div>
                    </div>
                    <div className="shrink-0 text-[11px] text-zinc-400">
                      {lastMessage ? formatRelativeTime(lastMessage.timestamp) : ''}
                    </div>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[13px] leading-5 text-zinc-600">
                    {lastMessage?.text || '还没有开始聊天'}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-zinc-400">
                    {session.pendingReply && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                        {session.pendingReply.status === 'typing' ? '对方输入中' : session.pendingReply.status === 'ghosted' ? '已读未回' : '等待回复'}
                      </span>
                    )}
                    {relatedPost && (
                      <span className="truncate">
                        相关帖子：{relatedPost.title || relatedPost.content.slice(0, 18)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {visibleChatSessions.length === 0 && (
              <div className="px-8 pt-16 text-center text-[14px] text-zinc-500">
                <h3 className="mb-3 text-[18px] font-bold text-zinc-900">
                  {chatListTab === 'mutual' ? '这里还没有互关聊天' : '这里还没有陌生人聊天'}
                </h3>
                <p className="leading-7">
                  {chatListTab === 'mutual'
                    ? '当你和论坛网友互相关注后，你们的会话会整理到这里。'
                    : '在论坛里点进网友主页并发起临时单聊后，来自陌生网友的会话会先留在这里。'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-0">
          {myNotifications.map(n => {
            const sourceUser = getAuthor(n.sourceUserId);
            const post = posts.find(p => p.id === n.postId);
            
            let Icon = User;
            let iconColor = 'text-blue-500 fill-blue-500';
            let actionText = '';
            
            if (n.type === 'like_post' || n.type === 'like_comment') {
              Icon = Heart;
              iconColor = 'text-pink-500 fill-pink-500';
              actionText = '喜欢了你的帖子';
            } else if (n.type === 'reply') {
              Icon = MessageCircle;
              iconColor = 'text-zinc-900 fill-zinc-900';
              actionText = '回复了你的帖子';
            }

            return (
              <div 
                key={n.id} 
                onClick={() => {
                  if (post) {
                    setSelectedPostId(post.id);
                    setCurrentView('detail');
                  }
                }}
                className="bg-white p-4 border-b border-zinc-100 flex gap-3 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <div className="w-10 flex justify-end pt-1">
                  <Icon size={24} className={iconColor} />
                </div>
                <div className="flex-1">
                  <ResolvedImage value={sourceUser.avatar} className="w-8 h-8 rounded-full object-cover mb-2" />
                  <p className="text-[14px] text-zinc-900 mb-2">
                    <span className="font-bold hover:underline">{sourceUser.name}</span>
                    <span className="text-zinc-500 ml-1">{actionText}</span>
                  </p>
                  {post && (
                    <div className="text-[15px] text-zinc-500 line-clamp-3">
                      {post.content}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {myNotifications.length === 0 && (
            <div className="px-8 pt-16 text-center text-[14px] text-zinc-500">
              <h3 className="mb-3 text-[18px] font-bold text-zinc-900">这里还没有任何互动</h3>
              <p className="leading-7">从喜欢、回复到更多互动，这里会留下论坛里的动静。</p>
            </div>
          )}
          </div>
        )}
      </div>
    );
  };

  // --- Main Render ---

  const shouldShowForumBottomNav = currentView !== 'editor' && currentView !== 'edit-profile' && currentView !== 'follow-list';

  const renderCurrentView = () => {
    if (currentView === 'detail') return renderPostDetail();
    if (currentView === 'editor') return renderEditor();
    if (currentView === 'spectator-settings') {
      return (
        <SpectatorSettingsView
          characters={appData.characters}
          subjectName={spectatorSubjectName}
          relationshipSummary={spectatorRelationshipSummary}
          tone={spectatorTone}
          autoGenerate={spectatorAutoGenerate}
          selectedCharacterIds={spectatorCharacterIds}
          onSubjectNameChange={setSpectatorSubjectName}
          onRelationshipSummaryChange={setSpectatorRelationshipSummary}
          onToneChange={setSpectatorTone}
          onAutoGenerateChange={setSpectatorAutoGenerate}
          onToggleCharacter={toggleSpectatorCharacter}
          onBack={() => setCurrentView('list')}
          onSave={saveSpectatorSettings}
          onGenerate={generateSpectatorPostsFromSettings}
          topInsetStyle={forumTopInsetStyle}
        />
      );
    }
    if (currentView === 'user-profile') return renderUserProfile();
    if (currentView === 'temp-chat') return renderTempChat();
    if (currentView === 'follow-list') return renderFollowList();

    if (activeTab === 'home') return renderPostList();
    if (activeTab === 'hot') return renderHotList();
    if (activeTab === 'notification') return renderNotifications();
    return renderProfile();
  };

  const handlePrimaryRefresh = async () => {
    if (forumBoard === 'spectator') {
      generateSpectatorPostsFromSettings();
      return;
    }
    await handleRefreshFeed();
  };

  return (
    <div className="forum-app-shell absolute inset-0 min-h-0 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      {currentView === 'list' && activeTab === 'home' && (
        <ForumHomeHeader
          forumBoard={forumBoard}
          publicLabel={activeChannelMeta.label}
          publicFilterLabel={activeThreadTypeLabel}
          publicBlurb={activeChannelMeta.blurb}
          spectatorSettings={spectatorSettings}
          feedRefreshLoading={feedRefreshLoading}
          forumConfigEnabled={!!forumConfig}
          onClose={onClose}
          onSwitchBoard={setForumBoard}
          onRefresh={() => { void handlePrimaryRefresh(); }}
          onOpenFilter={() => setShowFilterSheet(true)}
          onOpenSpectatorSettings={() => setCurrentView('spectator-settings')}
          topInsetStyle={forumTopInsetStyle}
        />
      )}

      {!forumConfig && (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[12px] leading-5 text-amber-700">
          当前论坛 AI 未启用。你仍然可以发帖和看帖，但自动跟帖、补新帖、临时单聊回复暂时不会运行。
        </div>
      )}

      {forumNotice && (
        <div className={`border-b px-4 py-2 text-[12px] leading-5 ${
          forumNotice.tone === 'error'
            ? 'border-rose-100 bg-rose-50 text-rose-700'
            : 'border-sky-100 bg-sky-50 text-sky-700'
        }`}>
          {forumNotice.message}
        </div>
      )}

      {forumBoard === 'public' && renderFilterSheet()}

      {/* Content Area */}
      <div className="forum-app-content flex-1 min-h-0 overflow-hidden">
        {renderCurrentView()}
      </div>

      {/* Floating Action Button */}
      {currentView === 'list' && activeTab === 'home' && (
        <button 
          onClick={() => {
            if (forumBoard === 'spectator') {
              setCurrentView('spectator-settings');
              return;
            }
            openForumComposer();
          }}
          className="forum-app-fab absolute bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm transition-colors hover:bg-zinc-200 z-20"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      )}

      {/* Bottom Navigation */}
      {shouldShowForumBottomNav && (
        <div className="forum-app-bottom-nav shrink-0 z-20 bg-white border-t border-zinc-100 px-6 pt-2 flex justify-between items-center" style={forumBottomNavStyle}>
          <button 
            onClick={() => { setActiveTab('home'); setCurrentView('list'); setMessageTab('chats'); }}
            className={`p-2 rounded-full transition-colors ${activeTab === 'home' ? 'text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100'}`}
          >
            <Home size={26} fill={activeTab === 'home' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'home' ? 0 : 2} />
          </button>
          <button 
            onClick={() => { setActiveTab('hot'); setCurrentView('list'); setMessageTab('chats'); }}
            className={`p-2 rounded-full transition-colors ${activeTab === 'hot' ? 'text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100'}`}
          >
            <Search size={26} strokeWidth={activeTab === 'hot' ? 3 : 2} />
          </button>
          <button 
            onClick={() => { setActiveTab('notification'); setCurrentView('list'); setMessageTab('chats'); }}
            className={`p-2 rounded-full transition-colors relative ${activeTab === 'notification' ? 'text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100'}`}
          >
            <Bell size={26} fill={activeTab === 'notification' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'notification' ? 0 : 2} />
            {(notifications.some(n => !n.read && n.userId === currentUser.id) || hasUnreadForumMessages) && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-zinc-900 rounded-full border border-white" />
            )}
          </button>
          <button 
            onClick={() => { setActiveTab('profile'); setCurrentView('list'); setMessageTab('chats'); }}
            className={`p-2 rounded-full transition-colors ${activeTab === 'profile' ? 'text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100'}`}
          >
            <Mail size={26} fill={activeTab === 'profile' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'profile' ? 0 : 2} />
          </button>
        </div>
      )}

      {/* Share Modal */}
      {renderShareModal()}
    </div>
  );
}

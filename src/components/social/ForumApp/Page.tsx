import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Bell, User, PenSquare, Share2, 
  Image as ImageIcon, Send, X, 
  ThumbsUp, Flag, Trash2, Edit2, MessageSquare, Flame, Clock,
  Camera, Check, LogOut, Key, Settings, Repeat, BarChart2, Feather,
  CheckCircle2, ArrowLeft, Home, Mail, Plus, Bookmark, Link2, AlertTriangle
} from 'lucide-react';
import {
  AppDataExtended,
  ForumPost,
  ForumComment,
  UserProfileExtended,
  Character,
  ForumData,
  AppSettings,
  ForumTempChatSession,
  ForumRuntimeAuthorProfile,
  ForumSpectatorSettings,
  ForumSpectatorTargetCharacter,
  ForumSpectatorTargetPreset,
  ForumSpectatorObjectMode,
  Mask,
} from '../../../types';
import { usePersistentFieldActions } from '../../../features/persistence/usePersistentFieldActions';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';
import { createCharacterDirectory } from '../../../features/character-domain/useCharacterDirectory';
import { buildInitialForumSeedPosts, getForumSeedAuthorProfile, registerForumRuntimeAuthorProfile } from '../../../features/forum-domain/seedThreadsCatalog';
import { appendRepliesToForumThreadV2, legacyForumPostToThreadV2, forumThreadV2ToLegacyPost } from '../../../features/forum-domain/adapters';
import { FORUM_CHANNEL_LABELS, FORUM_THREAD_TYPE_LABELS } from '../../../features/forum-domain/constants';
import { FORUM_CHANNEL_TABS, FORUM_FILTER_THREAD_TYPES, getForumThreadTypeMeta } from '../../../features/forum-domain/forumPresentation';
import type { ForumChannel, ForumThreadType } from '../../../features/forum-domain/types';
import { buildCharacterForumHabit, buildForumCharacterPostTitle, buildReadableForumHandle } from '../../../features/forum-domain/characterForumPersona';
import { getForumIdentityBadgeMeta, isCurrentUserCommentAuthor as isCurrentUserCommentOwner, isCurrentUserPostAuthor as isCurrentUserPostOwner, resolveForumCommentIdentity, resolveForumPostIdentity } from '../../../features/forum-domain/forumIdentity';
import {
  buildDefaultSpectatorSettings,
  buildRandomSpectatorSettings,
  normalizeSpectatorTargetCharacters,
  normalizeSpectatorUserSlot,
  resolveAutoSpectatorFlavor,
  SPECTATOR_BOARD_AUTHOR_PREFIX,
  SPECTATOR_BOARD_CATEGORY,
  SPECTATOR_BOARD_LABEL,
  SPECTATOR_RELATIONSHIP_HINTS,
} from '../../../features/forum-domain/spectatorBoard';
import { buildSpectatorAuthorProfile, buildSpectatorRuntimeHandle, parseSpectatorAuthorShell, resolveSpectatorWorldShell, SPECTATOR_WORLD_SHELLS, type SpectatorWorldShell } from '../../../features/forum-domain/spectatorWorldShells';
import { SpectatorSettingsView } from './SpectatorSettingsView';
import { ForumResolvedImage as ResolvedImage } from './ForumResolvedImage';
import { ForumCommentItem } from './ForumCommentItem';
import { ForumPostCard } from './ForumPostCard';
import { ForumHomeHeader } from './ForumHomeHeader';
import { ForumBrowseFilterSheet } from './ForumBrowseFilterSheet';
import { ForumTempChatView } from './ForumTempChatView';
import { ForumFollowListView } from './ForumFollowListView';
import { ForumPostDetailView } from './ForumPostDetailView';
import { ForumUserProfileView } from './ForumUserProfileView';
import { ForumOpenSettingsRoute, type ForumOpenDraft } from './ForumOpenSettingsRoute';
import { ForumAuthorProfileEditor } from './ForumAuthorProfileEditor';
import { ForumMessageManageSheet } from './ForumMessageManageSheet';
import { ForumProfilePostCard } from './ForumProfilePostCard';
import { ForumTrendListView, type ForumTrendListItem } from './ForumTrendListView';
import { ForumSettingsRoute } from './ForumSettingsRoute';
import { ForumMessageCenterView } from './ForumMessageCenterView';
import { resolveSceneTextApiConfig } from '../../../services/ai/apiCenter/resolveSceneApiConfig';
import { generateSpectatorThreads } from '../../../services/forum/generateSpectatorThreads';
import { maybeGenerateSpectatorCharacterPost, maybeGenerateSpectatorCharacterReply } from '../../../services/forum/generateSpectatorCharacterActivity';
import { maybeGenerateCharacterForumReplyActivity } from '../../../services/forum/generateCharacterForumActivity';
import { buildCharacterForumRuntimeProfile } from '../../../services/forum/buildCharacterForumRuntimeProfile';
import {
  buildUpdatedCurrentUserForumProfiles,
  resolveCurrentUserForumProfile,
} from '../../../services/forum/currentUserForumProfile';
import { generateCharacterForumRuntimeProfile } from '../../../services/forum/generateCharacterForumRuntimeProfile';
import { resolveCharacterForumDisplayProfile } from '../../../services/forum/resolveCharacterForumDisplayProfile';
import { syncCharacterForumProfiles } from '../../../services/forum/syncCharacterForumProfiles';
import { shouldSyncCharacterForumProfile } from '../../../services/forum/shouldSyncCharacterForumProfile';
import { openForumThreads } from '../../../services/forum/openForumThreads';
import { applyForumHotState, markForumHotContinuation } from '../../../services/forum/forumHotState';
import { buildForumMomentumCandidates } from '../../../services/forum/buildForumMomentumCandidates';
import { evaluateForumUserMomentum } from '../../../services/forum/evaluateForumUserMomentum';
import { generateForumTempOpening } from '../../../services/forum/generateForumTempOpening';
import { createSpectatorPosts } from '../../../services/forum/createSpectatorPosts';
import {
  applyForumAutoNpcChatsCleared,
  applyForumChatsRead,
  applyForumNotificationsCleared,
  applyForumNotificationsRead,
  applyForumStrangerChatsCleared,
  applySingleForumChatRemoved,
  applySingleForumNotificationRemoved,
} from '../../../services/forum/manageForumMessages';
import { getForumTrendBreakdown, getForumTrendMeta, getForumTrendScore, normalizeForumTrendStates } from '../../../services/forum/forumPostActivity';
import { togglePinnedForumChat, togglePinnedForumPost, sortForumIdsWithPins, sortForumPostsWithPins } from '../../../services/forum/manageForumPins';
import { buildForumPostMeta, buildForumReplyPlan, diversifyForumPosts } from '../../../services/forum/forumOrchestration';
import { castForumPollVote, ensureForumPollState } from '../../../services/forum/forumPoll';
import { appendForumPostFooterTags } from '../../../services/forum/forumPostTags';
import { orchestrateForumReplies } from '../../../services/forum/orchestrateForumReplies';
import { inferForumContentTier, inferForumDiscourseAxis } from '../../../services/forum/forumContentTier';
import {
  addForumComment,
  toggleForumCommentLike,
  toggleForumPostLike,
} from '../../../services/forum/forumPostInteractions';
import { buildSpectatorGenerationBatches } from '../../../services/forum/buildSpectatorGenerationBatches';
import { buildSpectatorDraftText, parseSpectatorDraftChips, pickRandomSpectatorDraftValues, toggleSpectatorDraftValue } from '../../../services/forum/spectatorSettingsDraft';
import { DEFAULT_FORUM_GLOBAL_SETTINGS, normalizeForumGlobalSettings } from '../../../services/forum/forumGlobalSettings';
import { resolveForumGenerationContext } from '../../../services/forum/forumGenerationContext';
import { buildPublicViewSummary, toggleForumChannelSelection } from '../../../services/forum/forumPublicViewState';
import {
  buildSpectatorTargetLabel,
  buildSpectatorTargetPreset,
  cycleSpectatorTargetCharacterRole,
  deriveTargetCharactersFromIds,
  toggleSpectatorTargetCharacterSelection,
} from '../../../services/forum/spectatorSettingsManager';
import { generateMomentPostContent } from '../../../services/moments/generators';
import { extractImageUrls, showInAppConfirm } from '../../../utils';
import { getForumNotificationActionText } from '../../../services/forum/forumNotifications';
import { bridgeForumFriendToFormalChat } from '../../../services/forum/forumFriendBridge';
import {
  createEmptyForumTempChatSession,
} from '../../../services/forum/forumTempChatState';
import {
  buildForumMessageCenterData,
  type ForumMessageNotificationItem,
} from '../../../services/forum/forumMessageCenter';
import {
  processPendingForumTempReply,
  resolveForumTempSession,
} from '../../../services/forum/forumTempChatRuntime';
import { createForumTempUserMessage, queueForumTempUserMessage } from '../../../services/forum/forumTempChatCompose';
import { appendForumNotification } from '../../../services/forum/forumNotificationState';
import { buildForumSharedSettlement } from '../../../services/forum/buildForumSharedSettlement';

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

type EditorIdentityMode = 'self' | 'mask' | 'anonymous';

type ForumChannelTabId = typeof FORUM_CHANNEL_TABS[number]['id'];

const ANIME_AVATAR_STYLES = ['lorelei', 'lorelei-neutral'] as const;

function isForumGeneratedAvatar(value?: string) {
  return !!value && /api\.dicebear\.com\/9\.x\//.test(value);
}

function buildAnimeAvatar(seed: string, label?: string) {
  const style = ANIME_AVATAR_STYLES[hashString(seed) % ANIME_AVATAR_STYLES.length];
  const safeSeed = `${label || seed}-${hashString(seed).toString(36).slice(0, 4)}`;
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(safeSeed)}&backgroundType=gradientLinear&backgroundColor=ffe4ef,ffeef8,e8f2ff,f3ecff&radius=50&scale=110&translateY=-2`;
}

function resolveForumAvatar(avatar: string | undefined, seed: string, label?: string) {
  if (avatar && !isForumGeneratedAvatar(avatar)) return avatar;
  return buildAnimeAvatar(seed, label);
}

function looksMachineGeneratedHandle(value?: string) {
  if (!value) return true;
  return !/\p{Script=Han}/u.test(value)
    || /forum_runtime|generated-post|seed-|[_]{1,}|^\w+\d{3,}$/i.test(value)
    || value.length > 12;
}

const formatForumHandle = (author: ForumAuthor) => {
  if (author.handle && !looksMachineGeneratedHandle(author.handle)) return `@${author.handle}`;
  return `@${buildReadableForumHandle({
    id: author.handle || author.id,
    name: author.name,
  })}`;
};

function formatCurrentUserForumHandle(userId: string) {
  if (!userId.trim()) return '@未设置ID';
  return `@${userId.replace(/^@/, '').trim()}`;
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
const SPECTATOR_OPEN_THREAD_TOTAL_COUNT = 10;

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

function pickRandomItem<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

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

function formatCompactMetric(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}w`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${value}`;
}

function buildSearchSnippet(text: string, query: string, radius = 28) {
  const source = (text || '').replace(/\s+/g, ' ').trim();
  if (!source) return '';
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return source.slice(0, radius * 2);

  const hitIndex = source.toLowerCase().indexOf(normalizedQuery);
  if (hitIndex < 0) return source.slice(0, radius * 2);

  const start = Math.max(0, hitIndex - radius);
  const end = Math.min(source.length, hitIndex + normalizedQuery.length + radius);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < source.length ? '...' : '';
  return `${prefix}${source.slice(start, end)}${suffix}`;
}

function buildHotInsight(post: ForumPost) {
  const breakdown = getForumTrendBreakdown(post);
  if (breakdown.velocityScore >= 14) {
    return `近期增速很快，${post.comments.length} 条回复把这楼顶上来了。`;
  }
  if (breakdown.discussionScore >= 8) {
    return `讨论层数够深，串楼回复和接话都在继续扩散。`;
  }
  if (post.collections.length >= 4) {
    return `收藏转存比较多，这类帖子后劲通常会更长。`;
  }
  if (post.likes.length >= 10) {
    return `喜欢反馈稳定，说明这条内容已经出圈到更泛的人群。`;
  }
  return `阅读和互动都在稳步积累，属于会被继续翻出来的帖子。`;
}

function buildMaskDisplayBio(mask: Mask) {
  return [mask.occupation, mask.personality, mask.relationship, mask.worldBackground]
    .map((item) => item?.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');
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

export default function ForumApp({ appData, onUpdateAppData, onClose, settings, onOpenChat, initialPostId }: ForumAppProps) {
  const forumTopInsetStyle = { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' };
  const forumBottomInsetStyle = { paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 80px)' };
  const forumBottomNavStyle = { paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 8px)' };
  const [activeTab, setActiveTab] = useState<'home' | 'hot' | 'notification' | 'profile'>('home');
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'editor' | 'edit-profile' | 'edit-author-profile' | 'user-profile' | 'temp-chat' | 'follow-list' | 'spectator-settings' | 'forum-settings' | 'public-open-settings'>('list');
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
  const [tempChatReturnTarget, setTempChatReturnTarget] = useState<'messages' | 'user-profile'>('user-profile');
  const [homeFilter, setHomeFilter] = useState<'latest' | 'hot'>('latest');
  const [forumBoard, setForumBoard] = useState<'public' | 'spectator'>('public');
  const [publicOpenDraft, setPublicOpenDraft] = useState<ForumOpenDraft>({
    mode: 'random',
    selectedChannels: ['junction'],
    selectedThreadTypes: [],
    preferredTopicText: '',
    preferredSceneText: '',
    preferredConflictText: '',
    preferredRelationshipText: '',
    excludedTopicText: '',
  });
  const [publicViewChannels, setPublicViewChannels] = useState<ForumChannel[]>([]);
  const [showBrowseFilterSheet, setShowBrowseFilterSheet] = useState(false);
  const [activeChannel, setActiveChannel] = useState<ForumChannelTabId>('junction');
  const [profileTab, setProfileTab] = useState<'posts' | 'replies' | 'likes'>('posts');
  const [searchQuery, setSearchQuery] = useState('');
  const [hotSearchQuery, setHotSearchQuery] = useState('');
  
  // Editor State
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorImages, setEditorImages] = useState<string[]>([]);
  const [editorSettingsOpen, setEditorSettingsOpen] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [editId, setEditId] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editingForumAuthorId, setEditingForumAuthorId] = useState<string | null>(null);
  const [editAvatar, setEditAvatar] = useState('');
  const [editAvatarUrlInput, setEditAvatarUrlInput] = useState('');
  const [profileEditReturnView, setProfileEditReturnView] = useState<'list' | 'forum-settings'>('list');
  const [editorIdentity, setEditorIdentity] = useState<EditorIdentityMode>('self');
  const [editorMaskId, setEditorMaskId] = useState<string | undefined>(undefined);
  const [editorChannel, setEditorChannel] = useState<ForumChannelTabId>('junction');
  const [editorThreadType, setEditorThreadType] = useState<ForumThreadType | 'auto'>('auto');

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
  const [spectatorObjectMode, setSpectatorObjectMode] = useState<ForumSpectatorObjectMode>('user_with_characters');
  const [spectatorTopicHint, setSpectatorTopicHint] = useState('');
  const [spectatorOpenMode, setSpectatorOpenMode] = useState<'random' | 'configured'>('configured');
  const [spectatorThreadTypes, setSpectatorThreadTypes] = useState<ForumThreadType[]>([]);
  const [spectatorWorldShell, setSpectatorWorldShell] = useState<SpectatorWorldShell | undefined>(undefined);
  const [spectatorTone, setSpectatorTone] = useState<ForumSpectatorSettings['tone']>(undefined);
  const [spectatorAngles, setSpectatorAngles] = useState<NonNullable<ForumSpectatorSettings['angles']>>([]);
  const [spectatorAutoGenerate, setSpectatorAutoGenerate] = useState(false);
  const [spectatorCharacterIds, setSpectatorCharacterIds] = useState<string[]>([]);
  const [spectatorUserSlotMode, setSpectatorUserSlotMode] = useState<'self' | 'mask'>('self');
  const [spectatorUserNameSource, setSpectatorUserNameSource] = useState<'user' | 'forum'>('user');
  const [spectatorUserMaskId, setSpectatorUserMaskId] = useState<string | undefined>(undefined);
  const [spectatorTargetCharacters, setSpectatorTargetCharacters] = useState<ForumSpectatorTargetCharacter[]>([]);
  const [spectatorTargetPresets, setSpectatorTargetPresets] = useState<ForumSpectatorTargetPreset[]>([]);
  const [spectatorCluePool, setSpectatorCluePool] = useState<string[]>([]);
  const [spectatorDefaultThreadTypePool, setSpectatorDefaultThreadTypePool] = useState<ForumThreadType[]>([]);

  // Share State
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [messageTab, setMessageTab] = useState<'chats' | 'activity'>('chats');
  const [chatListTab, setChatListTab] = useState<'mutual' | 'strangers'>('strangers');
  const [showMessageManageSheet, setShowMessageManageSheet] = useState(false);
  const [openMessageRowMenuId, setOpenMessageRowMenuId] = useState<string | null>(null);

  const currentUser = appData.userProfile;
  const forumData: ForumData = appData.forumData || {
    posts: [],
    notifications: [],
    followedUsers: [],
    followerMap: {},
    tempChats: {},
    pinnedChatAuthorIds: [],
    pinnedPostIds: [],
    runtimeAuthorProfiles: {},
    composerDraft: null,
    spectatorSettings: DEFAULT_SPECTATOR_SETTINGS,
  };
  const posts = forumData.posts || [];
  const notifications = forumData.notifications || [];
  const followedUsers = forumData.followedUsers || [];
  const followerMap = forumData.followerMap || {};
  const tempChats = forumData.tempChats || {};
  const pinnedChatAuthorIds = forumData.pinnedChatAuthorIds || [];
  const pinnedPostIds = forumData.pinnedPostIds || [];
  const runtimeAuthorProfiles = forumData.runtimeAuthorProfiles || {};
  const currentUserForumProfile = resolveCurrentUserForumProfile({
    currentUser,
    runtimeProfile: runtimeAuthorProfiles[currentUser.id],
  });
  const spectatorUserName = currentUser.name;
  const spectatorForumNickname = currentUserForumProfile.name;
  const resolveSpectatorNameSource = (source?: ForumSpectatorSettings['userNameSource']) => (
    source === 'forum' ? spectatorForumNickname : spectatorUserName
  );
  const spectatorObjectUserName = spectatorUserNameSource === 'forum' ? spectatorForumNickname : spectatorUserName;
  const composerDraft = forumData.composerDraft || null;
  const spectatorSettings = forumData.spectatorSettings || DEFAULT_SPECTATOR_SETTINGS;
  const forumGlobalSettings = normalizeForumGlobalSettings(forumData.globalSettings || DEFAULT_FORUM_GLOBAL_SETTINGS);
  const availableCommentMasks = (appData.masks || []).filter((mask) => {
    if (!forumGlobalSettings.mask.enabled) return false;
    if (forumGlobalSettings.mask.useActiveMaskOnly) return mask.isActive;
    if (forumGlobalSettings.mask.selectedIds.length === 0) return true;
    return forumGlobalSettings.mask.selectedIds.includes(mask.id);
  });
  const availablePostMasks = availableCommentMasks;
  const resolvePostIdentity = (post: ForumPost) => resolveForumPostIdentity(post, getCharacterByIdStrict);
  const resolveCommentIdentity = (comment: ForumComment) => resolveForumCommentIdentity(comment, getCharacterByIdStrict);
  const isCurrentUserPostAuthor = (authorId: string, post?: ForumPost) => isCurrentUserPostOwner(currentUser.id, authorId, post);
  const isCurrentUserCommentAuthor = (authorId: string, comment?: ForumComment) => isCurrentUserCommentOwner(currentUser.id, authorId, comment);
  const buildAnonymousPostAuthorId = (channel: ForumChannelTabId = editorChannel) => `seed-anon-${currentUser.id}-${channel}-${Date.now()}`;
  const buildAnonymousCommentAuthorId = () => `seed-anon-${currentUser.id}-comment-${activeChannel}-${Date.now()}`;
  const appDataRef = useRef(appData);
  const forumDataRef = useRef(forumData);
  const postsRef = useRef(posts);
  const feedRefreshLockRef = useRef(false);
  const tempReplyProcessingRef = useRef<Set<string>>(new Set());
  const profileAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const { setRemoteUrl, setUploadedFile } = usePersistentFieldActions();
  const { getCharacterById } = createCharacterDirectory({ characters: appData.characters });
  const getCharacterByIdStrict = (characterId: string) => getCharacterById(characterId) || undefined;
  const activeChannelMeta = FORUM_CHANNEL_TABS.find((item) => item.id === activeChannel) || FORUM_CHANNEL_TABS[0];
  const editorChannelMeta = FORUM_CHANNEL_TABS.find((item) => item.id === editorChannel) || activeChannelMeta;
  const publicViewSummary = buildPublicViewSummary(publicViewChannels);
  const publicOpenSummaryLabel = publicOpenDraft.mode === 'random'
    ? '随机开楼'
    : publicOpenDraft.selectedThreadTypes.length === 0
      ? '按设置开楼'
      : publicOpenDraft.selectedThreadTypes.length === 1
        ? FORUM_THREAD_TYPE_LABELS[publicOpenDraft.selectedThreadTypes[0]]
        : `已选${publicOpenDraft.selectedThreadTypes.length}种帖型`;
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
  const togglePublicViewChannel = (channel: ForumChannel) => {
    setPublicViewChannels((current) => {
      const next = toggleForumChannelSelection(current, channel);
      if (next.length === 1) {
        setActiveChannel(next[0] as ForumChannelTabId);
      }
      return next;
    });
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
    const synced = syncCharacterForumProfiles({
      characters: appData.characters,
      runtimeAuthorProfiles,
    });
    if (!synced.changed) return;

    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        runtimeAuthorProfiles: synced.runtimeAuthorProfiles,
      }),
    } as AppDataExtended);
  }, [appData.characters, runtimeAuthorProfiles, onUpdateAppData]);

  useEffect(() => {
    const nextSubjectName = spectatorSettings.subjectName || '';
    const nextRelationshipSummary = spectatorSettings.relationshipSummary || '';
    const nextTopicHint = spectatorSettings.topicHint || '';
    const nextObjectMode = spectatorSettings.objectMode || 'user_with_characters';
    const nextMode = spectatorSettings.mode === 'random' ? 'random' : 'configured';
    const nextThreadTypes = spectatorSettings.threadTypes || [];
    const nextWorldShell = spectatorSettings.worldShell as SpectatorWorldShell | undefined;
    const nextTone = spectatorSettings.tone;
    const nextAngles = spectatorSettings.angles || [];
    const nextAutoGenerate = !!spectatorSettings.autoGenerate;
    const nextCharacterIds = spectatorSettings.selectedCharacterIds || [];
    const nextUserSlot = normalizeSpectatorUserSlot(spectatorSettings);
    const nextTargetCharacters = normalizeSpectatorTargetCharacters(spectatorSettings);
    const nextTargetPresets = spectatorSettings.targetPresets || [];
    const nextCluePool = spectatorSettings.cluePool || [];
    const nextDefaultThreadTypePool = spectatorSettings.defaultThreadTypePool || [];

    setSpectatorSubjectName((current) => current === nextSubjectName ? current : nextSubjectName);
    setSpectatorRelationshipSummary((current) => current === nextRelationshipSummary ? current : nextRelationshipSummary);
    setSpectatorTopicHint((current) => current === nextTopicHint ? current : nextTopicHint);
    setSpectatorObjectMode((current) => current === nextObjectMode ? current : nextObjectMode);
    setSpectatorOpenMode((current) => current === nextMode ? current : nextMode);
    setSpectatorThreadTypes((current) => areStringListsEqual(current, nextThreadTypes) ? current : nextThreadTypes);
    setSpectatorWorldShell((current) => current === nextWorldShell ? current : nextWorldShell);
    setSpectatorTone((current) => current === nextTone ? current : nextTone);
    setSpectatorAngles((current) => areStringListsEqual(current || [], nextAngles) ? current : nextAngles);
    setSpectatorAutoGenerate((current) => current === nextAutoGenerate ? current : nextAutoGenerate);
    setSpectatorCharacterIds((current) => areStringListsEqual(current, nextCharacterIds) ? current : nextCharacterIds);
    setSpectatorUserSlotMode((current) => current === nextUserSlot.mode ? current : nextUserSlot.mode);
    setSpectatorUserNameSource((current) => current === (spectatorSettings.userNameSource || 'user') ? current : (spectatorSettings.userNameSource || 'user'));
    setSpectatorUserMaskId((current) => current === nextUserSlot.maskId ? current : nextUserSlot.maskId);
    setSpectatorTargetCharacters((current) => JSON.stringify(current) === JSON.stringify(nextTargetCharacters) ? current : nextTargetCharacters);
    setSpectatorTargetPresets((current) => JSON.stringify(current) === JSON.stringify(nextTargetPresets) ? current : nextTargetPresets);
    setSpectatorCluePool((current) => areStringListsEqual(current, nextCluePool) ? current : nextCluePool);
    setSpectatorDefaultThreadTypePool((current) => areStringListsEqual(current, nextDefaultThreadTypePool) ? current : nextDefaultThreadTypePool);
  }, [spectatorSettings.subjectName, spectatorSettings.relationshipSummary, spectatorSettings.topicHint, spectatorSettings.objectMode, spectatorSettings.mode, spectatorSettings.threadTypes, spectatorSettings.worldShell, spectatorSettings.tone, spectatorSettings.angles, spectatorSettings.autoGenerate, spectatorSettings.selectedCharacterIds, spectatorSettings.userSlot, spectatorSettings.userNameSource, spectatorSettings.targetCharacters, spectatorSettings.targetPresets, spectatorSettings.cluePool, spectatorSettings.defaultThreadTypePool]);

  useEffect(() => {
    const nextIds = spectatorTargetCharacters.map((target) => target.characterId);
    setSpectatorCharacterIds((current) => areStringListsEqual(current, nextIds) ? current : nextIds);
  }, [spectatorTargetCharacters]);

  const spectatorRelationshipSuggestions = [...SPECTATOR_RELATIONSHIP_HINTS];
  const selectedSpectatorRelationshipSuggestions = parseSpectatorDraftChips(spectatorRelationshipSummary);

  const buildCurrentSpectatorSettings = (): ForumSpectatorSettings => {
    const normalizedTargetCharacters = spectatorTargetCharacters.length > 0
      ? spectatorTargetCharacters
      : deriveTargetCharactersFromIds(spectatorCharacterIds);
    const constrainedTargetCharacters = normalizedTargetCharacters;
    const normalizedCharacterIds = constrainedTargetCharacters.map((target) => target.characterId);
    const computedSubjectName = buildSpectatorTargetLabel({
      currentUserName: spectatorObjectUserName,
      characters: appData.characters,
      targets: constrainedTargetCharacters,
      userSlotMode: spectatorUserSlotMode,
      objectMode: spectatorObjectMode,
    });
    const normalizedSubjectName = constrainedTargetCharacters.length > 0
      ? computedSubjectName
      : spectatorSubjectName.trim() || computedSubjectName;
    const baseSettings: ForumSpectatorSettings = {
      subjectName: normalizedSubjectName,
      relationshipSummary: spectatorRelationshipSummary.trim(),
      topicHint: spectatorTopicHint.trim(),
      objectMode: spectatorObjectMode,
      mode: spectatorOpenMode,
      threadTypes: spectatorThreadTypes,
      worldShell: spectatorWorldShell,
      autoGenerate: spectatorAutoGenerate,
      selectedCharacterIds: normalizedCharacterIds,
      userSlot: {
        mode: spectatorUserSlotMode,
        maskId: spectatorUserSlotMode === 'mask' ? spectatorUserMaskId : undefined,
      },
      userNameSource: spectatorUserNameSource,
      targetCharacters: constrainedTargetCharacters,
      targetPresets: spectatorTargetPresets,
      cluePool: spectatorCluePool.length > 0 ? spectatorCluePool : selectedSpectatorRelationshipSuggestions,
      defaultThreadTypePool: spectatorDefaultThreadTypePool.length > 0 ? spectatorDefaultThreadTypePool : spectatorThreadTypes,
    };
    const autoFlavor = resolveAutoSpectatorFlavor(baseSettings);
    return {
      ...baseSettings,
      tone: spectatorTone || autoFlavor.tone,
      angles: spectatorAngles.length > 0 ? spectatorAngles : autoFlavor.angles,
    };
  };
  const spectatorHeaderSettings = buildCurrentSpectatorSettings();

  const toggleSpectatorRelationshipSuggestion = (value: string) => {
    setSpectatorRelationshipSummary((current) => toggleSpectatorDraftValue(current, value, ' / '));
  };

  const toggleSpectatorThreadType = (threadType: ForumThreadType) => {
    setSpectatorThreadTypes((current) => (
      current.includes(threadType)
        ? current.filter((item) => item !== threadType)
        : [...current, threadType]
    ));
  };

  const toggleSpectatorAngle = (angle: NonNullable<ForumSpectatorSettings['angles']>[number]) => {
    setSpectatorAngles((current) => (
      current.includes(angle)
        ? current.filter((item) => item !== angle)
        : [...current, angle]
    ));
  };

  const clearSpectatorThreadTypes = () => {
    setSpectatorThreadTypes([]);
  };

  const toggleSpectatorTargetCharacter = (characterId: string) => {
    setSpectatorTargetCharacters((current) => toggleSpectatorTargetCharacterSelection(current, characterId));
    setSpectatorSubjectName('');
  };

  const cycleSpectatorTargetRole = (characterId: string) => {
    setSpectatorTargetCharacters((current) => cycleSpectatorTargetCharacterRole(current, characterId));
    setSpectatorSubjectName('');
  };

  const saveCurrentSpectatorPreset = () => {
    const currentTargets = spectatorTargetCharacters.length > 0
      ? spectatorTargetCharacters
      : deriveTargetCharactersFromIds(spectatorCharacterIds);

    if (!currentTargets.length) {
      showForumNotice('至少先选一个角色，再存成常用组合。');
      return;
    }

    const nextPreset = buildSpectatorTargetPreset({
      currentUserName: spectatorObjectUserName,
      characters: appData.characters,
      objectMode: spectatorObjectMode,
      userSlotMode: spectatorUserSlotMode,
      userNameSource: spectatorUserNameSource,
      userMaskId: spectatorUserMaskId,
      targetCharacters: currentTargets,
      threadTypes: spectatorThreadTypes,
      angles: spectatorAngles,
      relationshipSummary: spectatorRelationshipSummary,
      worldShell: spectatorWorldShell,
    });

    setSpectatorTargetPresets((current) => {
      const deduped = current.filter((item) => item.label !== nextPreset.label);
      return [nextPreset, ...deduped].slice(0, 8);
    });
    showForumNotice('这组围观对象已经存成常用组合。');
  };

  const applySpectatorPreset = (presetId: string) => {
    const preset = spectatorTargetPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setSpectatorUserSlotMode(preset.userSlot.mode);
    setSpectatorObjectMode(preset.objectMode || 'user_with_characters');
    setSpectatorUserNameSource(preset.userNameSource || 'user');
    setSpectatorUserMaskId(preset.userSlot.maskId);
    setSpectatorTargetCharacters(preset.targetCharacters);
    setSpectatorCharacterIds(preset.targetCharacters.map((target) => target.characterId));
    if ((preset.threadTypes || []).length > 0) setSpectatorThreadTypes(preset.threadTypes || []);
    if ((preset.angles || []).length > 0) setSpectatorAngles(preset.angles || []);
    if (preset.relationshipSummary) setSpectatorRelationshipSummary(preset.relationshipSummary);
    if (preset.worldShell) setSpectatorWorldShell(preset.worldShell as SpectatorWorldShell);
    setSpectatorSubjectName(buildSpectatorTargetLabel({
      currentUserName: preset.userNameSource === 'forum' ? spectatorForumNickname : spectatorUserName,
      characters: appData.characters,
      targets: preset.targetCharacters,
      userSlotMode: preset.userSlot.mode,
      objectMode: preset.objectMode || 'user_with_characters',
    }));
  };

  const removeSpectatorPreset = (presetId: string) => {
    setSpectatorTargetPresets((current) => current.filter((item) => item.id !== presetId));
  };

  const resolveMaskAvatar = (mask: Mask) => seedFallbackAvatar(`forum-mask-${mask.id}`, mask.name);

  const resolveIdentityAvatar = (identity: EditorIdentityMode, maskId?: string) => {
    if (identity === 'anonymous') return seedFallbackAvatar(buildAnonymousPostAuthorId(), '匿名');
    if (identity === 'mask' && maskId) {
      const matchedMask = availablePostMasks.find((mask) => mask.id === maskId);
      if (matchedMask) return resolveMaskAvatar(matchedMask);
    }
    return currentUserForumProfile.avatar;
  };

  const resolveMaskedAuthor = (maskId?: string): ForumAuthor | null => {
    if (!maskId) return null;
    const mask = (appData.masks || []).find((item) => item.id === maskId);
    if (!mask) return null;
    return {
      id: currentUser.id,
      name: mask.name,
      avatar: resolveMaskAvatar(mask),
      handle: buildReadableForumHandle({ id: mask.id, name: mask.name }),
      bio: buildMaskDisplayBio(mask),
      description: buildMaskDisplayBio(mask),
    };
  };

  const buildForumDataState = (overrides: Partial<ForumData> = {}): ForumData => ({
    posts: overrides.posts ?? postsRef.current,
    notifications: overrides.notifications ?? (forumDataRef.current.notifications || []),
    followedUsers: overrides.followedUsers ?? (forumDataRef.current.followedUsers || []),
    followerMap: overrides.followerMap ?? (forumDataRef.current.followerMap || {}),
    tempChats: overrides.tempChats ?? (forumDataRef.current.tempChats || {}),
    pinnedChatAuthorIds: overrides.pinnedChatAuthorIds ?? (forumDataRef.current.pinnedChatAuthorIds || []),
    pinnedPostIds: overrides.pinnedPostIds ?? (forumDataRef.current.pinnedPostIds || []),
    runtimeAuthorProfiles: overrides.runtimeAuthorProfiles ?? (forumDataRef.current.runtimeAuthorProfiles || {}),
    composerDraft: overrides.composerDraft ?? (forumDataRef.current.composerDraft || null),
    spectatorSettings: overrides.spectatorSettings ?? (forumDataRef.current.spectatorSettings || DEFAULT_SPECTATOR_SETTINGS),
    globalSettings: normalizeForumGlobalSettings(
      overrides.globalSettings ?? (forumDataRef.current.globalSettings || DEFAULT_FORUM_GLOBAL_SETTINGS),
    ),
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
    if (!posts.length) return;
    if (posts.every((post) => typeof post.hotState === 'string' && typeof post.hotScore === 'number')) return;
    updatePosts(posts, forumDataRef.current.runtimeAuthorProfiles || {});
  }, [posts]);

  useEffect(() => {
    if (editorIdentity !== 'mask') return;
    if (!availablePostMasks.length) {
      setEditorIdentity('self');
      setEditorMaskId(undefined);
      return;
    }
    setEditorMaskId((current) => (
      current && availablePostMasks.some((mask) => mask.id === current)
        ? current
        : availablePostMasks[0]?.id
    ));
  }, [availablePostMasks, editorIdentity]);

  const getAuthor = (id: string): ForumAuthor => {
    if (id === currentUser.id) {
      return {
        id: currentUser.id,
        name: currentUserForumProfile.name,
        avatar: currentUserForumProfile.avatar,
        bio: currentUserForumProfile.bio,
        handle: currentUserForumProfile.handle,
      };
    }
    const runtimeProfile = runtimeAuthorProfiles[id];
    const seedProfile = getForumSeedAuthorProfile(id);
    const character = getCharacterById(id);
    if (character) {
      const characterProfile = resolveCharacterForumDisplayProfile(character, runtimeProfile);
      return {
        id: character.id,
        name: characterProfile.name,
        avatar: character.avatar || resolveForumAvatar(seedProfile?.avatar, `${character.id}${character.name}`, characterProfile.name),
        handle: characterProfile.handle,
        bio: characterProfile.bio,
        description: characterProfile.bio || character.corePersona || character.openingRemark || '',
        persona: characterProfile.persona,
        speakingStyle: characterProfile.speakingStyle,
        preferredMove: characterProfile.preferredMove,
      };
    }

    if (runtimeProfile) {
      return {
        id: runtimeProfile.id,
        name: runtimeProfile.name,
        avatar: resolveForumAvatar(runtimeProfile.avatar, `${runtimeProfile.id}${runtimeProfile.handle || runtimeProfile.name}`, runtimeProfile.name),
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
        avatar: resolveForumAvatar(seedProfile.avatar, `${seedProfile.id}${seedProfile.handle || seedProfile.name}`, seedProfile.name),
        handle: seedProfile.handle,
        description: seedProfile.bio,
      };
    }

  const seedFallback = buildLegacySeedFallback(id);
  if (seedFallback) {
    return seedFallback;
  }

    if (id.startsWith(SPECTATOR_BOARD_AUTHOR_PREFIX)) {
      const shell = parseSpectatorAuthorShell(id);
      const indexMatch = id.match(/_(\d+)$/);
      const index = indexMatch?.[1] ? Number(indexMatch[1]) : 0;
      const profile = buildSpectatorAuthorProfile(shell, index);
      return {
        id,
        name: profile.name,
        avatar: seedFallbackAvatar(id, profile.name),
        handle: profile.handle,
        description: profile.description,
      };
    }
    
    return {
      id,
      name: id.startsWith('forum_runtime_') || id.startsWith('forum_spectator_runtime_') ? `网友${id.slice(-4)}` : `用户${id.slice(-4)}`,
      avatar: seedFallbackAvatar(id, id.startsWith('forum_runtime_') || id.startsWith('forum_spectator_runtime_') ? id.slice(-2).toUpperCase() : id.slice(-2)),
      handle: id.startsWith('forum_runtime_') || id.startsWith('forum_spectator_runtime_') ? buildReadableForumHandle({
        id,
        name: `网友${id.slice(-4)}`,
      }) : undefined,
    };
  };

  const resolvePostAuthor = (post: ForumPost): ForumAuthor => (
    resolveMaskedAuthor(post.authorMaskId) || getAuthor(post.authorId)
  );

  const resolveCommentAuthor = (comment: ForumComment): ForumAuthor => (
    resolveMaskedAuthor(comment.authorMaskId) || getAuthor(comment.authorId)
  );

  const canOpenForumPrivateChat = (authorId: string) => {
    if (authorId === currentUser.id) return false;
    return !!runtimeAuthorProfiles[authorId] || !!getForumSeedAuthorProfile(authorId);
  };

  const resolveRecentForumPostForAuthor = (authorId: string) => (
    [...postsRef.current]
      .filter((post) => post.authorId === authorId || post.comments.some((comment) => comment.authorId === authorId))
      .sort((a, b) => b.timestamp - a.timestamp)[0] || null
  );

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
          ...createEmptyForumTempChatSession(authorId),
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
    setTempChatReturnTarget('user-profile');
    setCurrentView('temp-chat');
  };

  const pruneForumFeed = (items: ForumPost[]) => {
    const deduped = items.filter((post, index, collection) => {
      const isSpectatorPost = post.board === 'spectator' || post.category === SPECTATOR_BOARD_CATEGORY;
      if (isSpectatorPost) {
        return collection.findIndex((candidate) => candidate.id === post.id) === index;
      }
      const titleKey = normalizeForumPostFingerprint(post.title || '');
      const bodyKey = normalizeForumPostFingerprint(post.content || '');
      return collection.findIndex((candidate) => (
        normalizeForumPostFingerprint(candidate.title || '') === titleKey
        && normalizeForumPostFingerprint(candidate.content || '') === bodyKey
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

    const diversifiedRemainder = diversifyForumPosts(remainder);

    return [...pinned, ...diversifiedRemainder]
      .sort((a, b) => b.timestamp - a.timestamp);
  };

  const updateTempChatSession = (authorId: string, updater: (session: ForumTempChatSession) => ForumTempChatSession) => {
    const existingSession = (forumDataRef.current.tempChats || {})[authorId] || createEmptyForumTempChatSession(authorId);
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
        const shouldNeedProcessing = now >= pendingReply.readAt || pendingReply.status === 'typing' || (!!pendingReply.replyAt && now >= pendingReply.replyAt);
        if (!shouldNeedProcessing) return;
        if (tempReplyProcessingRef.current.has(authorId)) return;

        tempReplyProcessingRef.current.add(authorId);

        const relatedPost = pendingReply.relatedPostId
          ? postsRef.current.find((post) => post.id === pendingReply.relatedPostId) || null
          : resolveRecentForumPostForAuthor(authorId);
        const currentSession = resolveForumTempSession(forumDataRef.current.tempChats || {}, authorId);

        processPendingForumTempReply({
          appData: appDataRef.current,
          currentUserId: currentUser.id,
          allowNpcFriendRequest: !!(forumDataRef.current.globalSettings || DEFAULT_FORUM_GLOBAL_SETTINGS).social?.allowNpcFriendRequest,
          activeTempChatUserId,
          currentView,
          forumConfig,
          session: currentSession,
          author,
          relatedPost,
          resolveRecentForumPostForAuthor,
          inferForumChannelFromCategory,
        })
          .then((result) => {
            if (result.kind === 'idle') return;

            if (result.kind === 'mark-read' || result.kind === 'ghosted' || result.kind === 'typing' || result.kind === 'cleared') {
              updateTempChatSession(authorId, () => result.nextSession);
              return;
            }

            const tempChatsMap = forumDataRef.current.tempChats || {};
            const nextSettlementEvents: Array<Parameters<typeof applyForumCharacterSettlements>[0][number]> = [];
            const isKnownCharacter = !!getCharacterById(authorId);
            const priorRounds = currentSession.completedExchangeRounds || 0;
            const nextRounds = result.nextSession.completedExchangeRounds || 0;

            if (isKnownCharacter && priorRounds < 3 && nextRounds >= 3) {
              const latestNpcMessage = [...result.nextSession.messages]
                .reverse()
                .find((message) => message.role === 'npc');
              if (latestNpcMessage?.text.trim()) {
                nextSettlementEvents.push({
                  kind: 'temp_chat_familiar',
                  characterId: authorId,
                  actorName: author.name,
                  content: latestNpcMessage.text,
                  timestamp: latestNpcMessage.timestamp,
                  postTitle: relatedPost?.title,
                  userComment: pendingReply.userText,
                });
              }
            }

            if (isKnownCharacter && result.friendRequestNotice) {
              nextSettlementEvents.push({
                kind: 'friend_request_sent',
                characterId: authorId,
                actorName: author.name,
                content: result.friendRequestNotice,
                timestamp: Date.now(),
                postTitle: relatedPost?.title,
                userComment: pendingReply.userText,
              });
            }

            const nextCharacters = applyForumCharacterSettlements(nextSettlementEvents);
            onUpdateAppData({
              ...appDataRef.current,
              characters: nextCharacters,
              friendRequests: result.nextFriendRequests,
              forumData: buildForumDataState({
                tempChats: {
                  ...tempChatsMap,
                  [authorId]: result.nextSession,
                },
                notifications: result.nextNotifications,
              }),
            } as AppDataExtended);

            if (result.friendRequestNotice) {
              showForumNotice(result.friendRequestNotice);
            }
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

    const sharePreview = `${post.title || post.content.slice(0, 20)}${post.content.length > 20 && !post.title ? '...' : ''}`;

    // Cast appData to access chatHistory which is present in AppData but not AppDataExtended
    const fullAppData = appData as any;
    const currentHistory = fullAppData.chatHistory?.[characterId] || [];
    
    const newMessage = {
      role: 'user',
      text: '',
      timestamp: Date.now(),
      needsReply: true,
      sharedPost: {
        id: post.id,
        title: post.title || post.content.slice(0, 20),
        content: post.content,
        images: post.images,
        authorName: resolvePostAuthor(post).name,
        authorAvatar: resolvePostAuthor(post).avatar
      }
    };

    const newHistory = [...currentHistory, newMessage];

    // Update appData to trigger state change and update last message
    const updatedCharacters = appData.characters.map(c => {
      if (c.id === characterId) {
        return {
          ...c,
          lastMessage: `[分享动态] ${sharePreview}`,
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
    const result = toggleForumPostLike({
      posts,
      currentUserId: currentUser.id,
      notifications: forumDataRef.current.notifications || [],
      postId,
      isCurrentUserPostAuthor,
    });
    updatePosts(result.posts);
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        notifications: result.notifications,
      }),
    } as AppDataExtended);
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

  const handleVoteInPoll = (postId: string, optionId: string) => {
    const nextPosts = postsRef.current.map((post) => (
      post.id === postId ? castForumPollVote(post, currentUser.id, optionId) : post
    ));
    updatePosts(nextPosts);
  };

  const handlePublish = () => {
    if (!editorContent.trim()) return;
    const resolvedTitle = editorTitle.trim() || buildForumCharacterPostTitle(editorContent.trim()) || editorContent.trim().slice(0, 18);
    const resolvedChannel = forumBoard === 'spectator' ? 'junction' : editorChannel as ForumChannel;
    const inferredMeta = buildForumPostMeta(resolvedTitle, editorContent.trim(), resolvedChannel);
    const resolvedThreadType = editorThreadType === 'auto' ? inferredMeta.threadType : editorThreadType;
    const resolvedMeta = {
      threadType: resolvedThreadType,
      contentTier: inferForumContentTier(resolvedThreadType, resolvedTitle, editorContent.trim()),
      discourseAxis: inferForumDiscourseAxis(resolvedThreadType, resolvedChannel, resolvedTitle, editorContent.trim()),
    };
    const resolvedContent = appendForumPostFooterTags(editorContent.trim(), {
      title: resolvedTitle,
      body: editorContent.trim(),
      threadType: resolvedMeta.threadType,
      contentTier: resolvedMeta.contentTier,
      discourseAxis: resolvedMeta.discourseAxis,
      channel: resolvedChannel,
    });
    let publishedPostId: string | null = null;
    const resolvedMaskId = editorIdentity === 'mask' ? editorMaskId : undefined;

    if (editingPostId) {
      // Update existing post
      const newPosts = posts.map(p => {
        if (p.id === editingPostId) {
          return {
            ...p,
            title: resolvedTitle,
            content: resolvedContent,
            images: editorImages,
            category: forumBoard === 'spectator' ? SPECTATOR_BOARD_CATEGORY : editorChannelMeta.label,
            authorMaskId: resolvedMaskId,
            threadType: resolvedMeta.threadType,
            contentTier: resolvedMeta.contentTier,
            discourseAxis: resolvedMeta.discourseAxis,
            timestamp: Date.now() // Update timestamp or keep original? Usually keep original or add edited time.
          };
        }
        return p;
      });
      updatePosts(newPosts);
    } else {
      // Create new post
      const authorId = editorIdentity === 'anonymous'
        ? buildAnonymousPostAuthorId(editorChannel)
        : currentUser.id;
      const postId = `post-${Date.now()}`;
      const newPost: ForumPost = {
        id: postId,
        authorId,
        authorIdentity: editorIdentity === 'anonymous' ? 'anonymous' : 'self',
        authorMaskId: resolvedMaskId,
        ownerUserId: currentUser.id,
        board: forumBoard,
        title: resolvedTitle,
        content: resolvedContent,
        images: editorImages,
        category: forumBoard === 'spectator' ? SPECTATOR_BOARD_CATEGORY : editorChannelMeta.label,
        threadType: resolvedMeta.threadType,
        contentTier: resolvedMeta.contentTier,
        discourseAxis: resolvedMeta.discourseAxis,
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
    setEditorMaskId(undefined);
    setEditorChannel(activeChannel);
    setEditorThreadType('auto');
    setEditorSettingsOpen(false);
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
        const publishedPost = postsRef.current.find((post) => post.id === publishedPostId);
        if (!publishedPost) return;
        const replyPlan = buildForumReplyPlan(publishedPost, 'post');
        void triggerForumAiReplies(publishedPostId!, replyPlan);
      }, 300);
      const publishedPost = postsRef.current.find((post) => post.id === publishedPostId);
      if (publishedPost) {
        window.setTimeout(() => { void applyUserMomentum(publishedPost); }, 450);
      }
    } else if (publishedPostId) {
      showForumNotice('帖子已经发出。当前论坛 AI 未启用，所以这次不会自动出现网友互动。');
      const publishedPost = postsRef.current.find((post) => post.id === publishedPostId);
      if (publishedPost) {
        void applyUserMomentum(publishedPost);
      }
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
          maskId: editorIdentity === 'mask' ? editorMaskId : undefined,
          channel: editorChannel,
          threadType: editorThreadType,
          board: forumBoard,
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
    setEditorMaskId(draft?.maskId);
    setEditorThreadType(draft?.threadType || 'auto');
    setShowUrlInput(false);
    setUrlInput('');
    if (draft?.channel && FORUM_CHANNEL_TABS.some((item) => item.id === draft.channel)) {
      setEditorChannel(draft.channel as ForumChannelTabId);
    } else {
      setEditorChannel(activeChannel);
    }
    if (draft?.board) {
      setForumBoard(draft.board);
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
        const scoreByType = notification.type === 'reply_to_post' || notification.type === 'reply_to_comment' ? 4 : 2;
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

  const handleComment = (
    postId: string,
    content: string,
    replyToId?: string,
    rootCommentId?: string,
    identity: 'self' | 'anonymous' = 'self',
    maskId?: string,
  ): ForumComment | null => {
    const result = addForumComment({
      posts,
      currentUserId: currentUser.id,
      notifications: forumDataRef.current.notifications || [],
      postId,
      content,
      replyToId,
      rootCommentId,
      identity,
      maskId,
      anonymousAuthorId: buildAnonymousCommentAuthorId(),
      isCurrentUserPostAuthor,
      isCurrentUserCommentAuthor,
    });
    updatePosts(result.posts);
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        notifications: result.notifications,
      }),
    } as AppDataExtended);
    return result.createdComment;
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
    const result = toggleForumCommentLike({
      posts,
      currentUserId: currentUser.id,
      notifications: forumDataRef.current.notifications || [],
      postId,
      commentId,
    });
    updatePosts(result.posts);
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        notifications: result.notifications,
      }),
    } as AppDataExtended);
  };

  const updatePosts = (
    newPosts: ForumPost[],
    nextRuntimeAuthorProfiles = forumDataRef.current.runtimeAuthorProfiles || {},
    nextCharacters = appDataRef.current.characters,
  ) => {
    const normalizedPosts = normalizeForumTrendStates(
      newPosts.map((post) => ensureForumPollState(post)),
      inferForumChannelFromCategory,
    );
    postsRef.current = normalizedPosts;
    onUpdateAppData({
      ...appDataRef.current,
      characters: nextCharacters,
      forumData: buildForumDataState({
        posts: normalizedPosts,
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

  const applyForumCharacterSettlements = (events: Array<{
    kind?: 'public_reply' | 'public_loop' | 'temp_chat_familiar' | 'friend_request_sent' | 'friend_request_accepted' | 'friend_bridge';
    characterId: string;
    actorName: string;
    content: string;
    timestamp: number;
    postTitle?: string;
    userComment?: string;
    userIdentity?: 'self' | 'anonymous';
    repeatedCount?: number;
  }>) => {
    if (!events.length) return appDataRef.current.characters;

    const groupedEvents = new Map<string, typeof events>();
    events.forEach((event) => {
      const current = groupedEvents.get(event.characterId) || [];
      current.push(event);
      groupedEvents.set(event.characterId, current);
    });

    let didChange = false;
    const nextCharacters = appDataRef.current.characters.map((character) => {
      if (!character) return character;
      const characterEvents = groupedEvents.get(character.id);
      if (!characterEvents?.length) {
        return character;
      }

      let nextCharacter = character;
      characterEvents.forEach((event) => {
        const settlement = buildForumSharedSettlement(nextCharacter, {
          kind: event.kind,
          actorName: event.actorName,
          content: event.content,
          timestamp: event.timestamp,
          postTitle: event.postTitle,
          userComment: event.userComment,
          userIdentity: event.userIdentity,
          repeatedCount: event.repeatedCount,
        });
        nextCharacter = {
          ...nextCharacter,
          sharedContextSnapshots: settlement.sharedContextSnapshots,
          shortTermSummary: settlement.shortTermSummary,
          openLoopRegistry: settlement.openLoopRegistry,
        };
      });

      if (nextCharacter !== character) {
        didChange = true;
      }
      return nextCharacter;
    });

    return didChange ? nextCharacters : appDataRef.current.characters;
  };

  const appendGeneratedReplies = (postId: string, replies: Array<{
    authorId: string;
    content: string;
    replyToId?: string;
    rootCommentId?: string;
  }>) => {
    if (!replies.length) return;

    const sourcePost = postsRef.current.find((post) => post.id === postId);
    if (sourcePost) {
      let nextNotifications = forumDataRef.current.notifications || [];
      replies.forEach((reply) => {
        if (!reply.authorId || reply.authorId === currentUser.id) return;
        if (reply.replyToId) {
          const targetComment = sourcePost.comments.find((comment) => comment.id === reply.replyToId);
          if (targetComment && isCurrentUserCommentAuthor(targetComment.authorId, targetComment)) {
            nextNotifications = appendForumNotification({
              notifications: nextNotifications,
              userId: currentUser.id,
              type: 'reply_to_comment',
              sourceUserId: reply.authorId,
              postId,
              commentId: targetComment.id,
            });
          }
          return;
        }

        if (isCurrentUserPostAuthor(sourcePost.authorId, sourcePost)) {
          nextNotifications = appendForumNotification({
            notifications: nextNotifications,
            userId: currentUser.id,
            type: 'reply_to_post',
            sourceUserId: reply.authorId,
            postId,
          });
        }
      });

      if (nextNotifications !== (forumDataRef.current.notifications || [])) {
        onUpdateAppData({
          ...appDataRef.current,
          forumData: buildForumDataState({
            notifications: nextNotifications,
          }),
        } as AppDataExtended);
      }
    }

    const nextCharacterSettlementEvents: Array<{
      kind?: 'public_reply' | 'public_loop' | 'temp_chat_familiar' | 'friend_request_sent' | 'friend_request_accepted' | 'friend_bridge';
      characterId: string;
      actorName: string;
      content: string;
      timestamp: number;
      postTitle?: string;
      userComment?: string;
      userIdentity?: 'self' | 'anonymous';
      repeatedCount?: number;
    }> = [];

    const nextPosts = postsRef.current.map((post) => {
      if (post.id !== postId) {
        return post;
      }

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
        const replyTarget = matchedReply.replyToId
          ? post.comments.find((item) => item.id === matchedReply.replyToId)
          : undefined;
        const repliedToCurrentUser = replyTarget
          ? isCurrentUserCommentAuthor(replyTarget.authorId, replyTarget)
          : isCurrentUserPostAuthor(post.authorId, post);

        if (isCharacterReply && repliedToCurrentUser) {
          const previousPublicReplies = post.comments.filter((item) => {
            if (item.authorId !== matchedReply.authorId) return false;
            if (replyTarget) {
              return item.replyToId === replyTarget.id;
            }
            return !item.replyToId && isCurrentUserPostAuthor(post.authorId, post);
          }).length;

          nextCharacterSettlementEvents.push({
            kind: previousPublicReplies > 0 ? 'public_loop' : 'public_reply',
            characterId: matchedReply.authorId,
            actorName: getAuthor(matchedReply.authorId).name,
            content: matchedReply.content,
            timestamp: baseTimestamp,
            postTitle: post.title,
            userComment: replyTarget?.content || post.content,
            userIdentity: replyTarget
              ? (replyTarget.authorIdentity === 'anonymous' ? 'anonymous' : 'self')
              : (post.authorIdentity === 'anonymous' ? 'anonymous' : 'self'),
            repeatedCount: previousPublicReplies + 1,
          });
        }

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

    const nextCharacters = applyForumCharacterSettlements(nextCharacterSettlementEvents);
    updatePosts(nextPosts, forumDataRef.current.runtimeAuthorProfiles || {}, nextCharacters);
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
    const existingRuntimeProfile = forumDataRef.current.runtimeAuthorProfiles?.[pickedCharacter.id];
    let characterRuntimeProfile = existingRuntimeProfile && existingRuntimeProfile.origin === 'character'
      ? existingRuntimeProfile
      : buildCharacterForumRuntimeProfile(pickedCharacter, channel);

    if (shouldSyncCharacterForumProfile({ character: pickedCharacter, profile: existingRuntimeProfile })) {
      try {
        characterRuntimeProfile = await generateCharacterForumRuntimeProfile({
          activeConfig: forumConfig,
          character: pickedCharacter,
          channel,
        });
      } catch (error) {
        console.error('Failed to generate AI forum profile before character post', pickedCharacter.id, error);
      }
    }

    const generationContext = resolveForumGenerationContext({
      globalSettings: forumDataRef.current.globalSettings || DEFAULT_FORUM_GLOBAL_SETTINGS,
      masks: appDataRef.current.masks || [],
      worldBooks: appDataRef.current.worldBooks || [],
      worldBookScope: 'character_post',
      maskScope: 'character_post',
    });

    const generated = await generateMomentPostContent({
      activeConfig: forumConfig,
      character: pickedCharacter,
      masks: generationContext.activeMasks,
      worldBook: generationContext.activeWorldBooks,
      extraPromptSections: [
        generationContext.worldBookPromptBlock,
        generationContext.maskPromptBlock,
      ].filter(Boolean),
      requestText: `论坛角色自主发帖：频道=${FORUM_CHANNEL_LABELS[channel]}；氛围=${activeChannelMeta.blurb}；角色论坛偏好=${forumHabit.persona}；写成角色本人会发在公共论坛的一条短帖。`,
    });

    const content = generated.content.trim();
    if (!content) return null;
    const title = buildForumCharacterPostTitle(content);
    const resolvedMeta = buildForumPostMeta(title, content, channel);

    const runtimeProfile: ForumRuntimeAuthorProfile = {
      ...characterRuntimeProfile,
      id: pickedCharacter.id,
      avatar: pickedCharacter.avatar,
      persona: forumHabit.persona,
      speakingStyle: forumHabit.speakingStyle,
      preferredMove: forumHabit.preferredMove,
    };

    const post: ForumPost = {
      id: `forum-character-post-${pickedCharacter.id}-${Date.now()}`,
      authorId: pickedCharacter.id,
      authorIdentity: 'character',
      authorCharacterId: pickedCharacter.id,
      title,
      content: appendForumPostFooterTags(content, {
        title,
        body: content,
        threadType: resolvedMeta.threadType,
        contentTier: resolvedMeta.contentTier,
        discourseAxis: resolvedMeta.discourseAxis,
        channel,
      }),
      images: [],
      category: FORUM_CHANNEL_LABELS[channel],
      threadType: resolvedMeta.threadType,
      contentTier: resolvedMeta.contentTier,
      discourseAxis: resolvedMeta.discourseAxis,
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

  const applyUserMomentum = async (post: ForumPost, comment?: ForumComment) => {
    const relatedPosts = postsRef.current.filter((item) => {
      if (post.board === 'spectator' || post.category === SPECTATOR_BOARD_CATEGORY) {
        return item.board === 'spectator' || item.category === SPECTATOR_BOARD_CATEGORY;
      }
      return inferForumChannelFromCategory(item.category) === inferForumChannelFromCategory(post.category);
    });

    const candidates = buildForumMomentumCandidates({
      post,
      recentPosts: relatedPosts,
      currentUserId: currentUser.id,
      resolveAuthor: (authorId) => {
        const author = getAuthor(authorId);
        return {
          id: author.id,
          name: author.name,
          handle: author.handle || buildReadableForumHandle({ id: author.id, name: author.name }),
          avatar: author.avatar,
          bio: author.bio || author.description || '',
        };
      },
      isCharacterAuthor: (authorId) => !!getCharacterById(authorId),
    });

    const momentum = evaluateForumUserMomentum({
      event: comment ? 'comment' : 'post',
      currentUserId: currentUser.id,
      currentUserName: currentUserForumProfile.name,
      post,
      comment,
      allowNpcTempChat: !!(forumDataRef.current.globalSettings || DEFAULT_FORUM_GLOBAL_SETTINGS).social?.allowNpcTempChat,
      followedUsers: forumDataRef.current.followedUsers || [],
      followerMap: forumDataRef.current.followerMap || {},
      tempChats: forumDataRef.current.tempChats || {},
      candidates,
    });

    const hasDmIntent = !!momentum.dmOpenIntent;
    if (
      !momentum.summaryNotice
      && momentum.notifications.length === 0
      && momentum.likedByIds.length === 0
      && momentum.collectedByIds.length === 0
      && !hasDmIntent
    ) return;

    const nextPosts = postsRef.current.map((item) => {
      if (item.id !== post.id) return item;
      const nextLikes = Array.from(new Set([...(item.likes || []), ...momentum.likedByIds]));
      const nextCollections = Array.from(new Set([...(item.collections || []), ...momentum.collectedByIds]));
      if (nextLikes.length === item.likes.length && nextCollections.length === item.collections.length) {
        return item;
      }
      return {
        ...item,
        likes: nextLikes,
        collections: nextCollections,
      };
    });

    const baseForumData = forumDataRef.current;
    const nextNotifications = [...momentum.notifications, ...(baseForumData.notifications || [])];
    let nextTempChats = momentum.tempChats;
    let dmChatCreated = false;

    if (hasDmIntent && forumConfig) {
      const authorId = momentum.dmOpenIntent!.authorId;
      const author = getAuthor(authorId);
      const relatedPost = postsRef.current.find((item) => item.id === momentum.dmOpenIntent!.postId) || post;
      try {
        const opening = await generateForumTempOpening({
          activeConfig: forumConfig,
          authorName: author.name,
          authorPersona: author.description || author.bio || '',
          channel: relatedPost ? inferForumChannelFromCategory(relatedPost.category) : undefined,
          recentForumPost: relatedPost,
          userComment: comment || null,
          reason: momentum.dmOpenIntent!.reason,
        });

        if (opening.trim()) {
          const now = Date.now();
          nextTempChats = {
            ...nextTempChats,
            [authorId]: {
              ...createEmptyForumTempChatSession(authorId, now),
              updatedAt: now,
              sessionOrigin: 'npc_auto',
              messages: [{
                id: `forum-temp-npc-${now}-${authorId}`,
                role: 'npc',
                text: opening.trim(),
                timestamp: now,
              }],
              viewerLastSeenAt: 0,
            },
          };
          dmChatCreated = true;
        }
      } catch (error) {
        console.error('[forum] temporary opening generation failed', error);
      }
    }

    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        posts: nextPosts,
        followerMap: momentum.followerMap,
        tempChats: nextTempChats,
        notifications: nextNotifications,
      }),
    } as AppDataExtended);

    const shouldShowSummaryNotice = momentum.summaryNotice && (
      !hasDmIntent
      || dmChatCreated
    );
    if (shouldShowSummaryNotice) {
      showForumNotice(momentum.summaryNotice);
    }
  };

  const triggerForumAiReplies = async (postId: string, options: {
    userNewComment?: ForumComment;
    replyCount?: number;
    minReplyCount?: number;
    replyMode?: 'mixed' | 'independent_only' | 'threaded_only';
    markDetailExpanded?: boolean;
    allowCharacterReply?: boolean;
  } = {}) => {
    if (!forumConfig) {
      if (options.userNewComment) {
        showForumNotice('评论已发出，但论坛 AI 还没启用，所以这次不会自动跟帖。');
      }
      return 0;
    }
    if (forumAiLoadingPostId === postId) return 0;

    const latestPost = postsRef.current.find((item) => item.id === postId);
    if (!latestPost) return 0;

    const desiredReplyCount = options.replyCount ?? 3;
    const minimumReplyCount = Math.max(0, options.minReplyCount ?? 0);

    setForumAiLoadingPostId(postId);
    try {
      const result = await orchestrateForumReplies({
        activeConfig: forumConfig,
        post: latestPost,
        currentUserId: currentUser.id,
        desiredReplyCount,
        minimumReplyCount,
        replyMode: options.replyMode ?? 'mixed',
        userNewComment: options.userNewComment,
        allCharacters: appDataRef.current.characters,
        existingPosts: postsRef.current,
        globalSettings: forumDataRef.current.globalSettings || DEFAULT_FORUM_GLOBAL_SETTINGS,
        masks: appDataRef.current.masks || [],
        worldBooks: appDataRef.current.worldBooks || [],
        inferChannel: inferForumChannelFromCategory,
        getAuthor,
        getCharacterById,
        appendReplies: (replies) => appendGeneratedReplies(postId, replies),
        allowCharacterReply: options.allowCharacterReply ?? true,
        resolveCharacterReply: async ({ post, channel, triggerComment, allCharacters, existingPosts }) => {
          if (post.board === 'spectator' || post.category === SPECTATOR_BOARD_CATEGORY) {
            const spectatorSettings = forumDataRef.current.spectatorSettings || buildCurrentSpectatorSettings();
            const selectedTargetIds = normalizeSpectatorTargetCharacters(spectatorSettings).map((target) => target.characterId);
            const selectedCharacters = appDataRef.current.characters.filter((character) => (
              selectedTargetIds.includes(character.id)
            ));
              return maybeGenerateSpectatorCharacterReply({
                activeConfig: forumConfig,
                settings: spectatorSettings,
                currentUserName: resolveSpectatorNameSource(spectatorSettings.userNameSource),
                selectedCharacters,
              allCharacters,
              existingPosts: existingPosts.filter((item) => item.board === 'spectator' || item.category === SPECTATOR_BOARD_CATEGORY),
              globalSettings: forumDataRef.current.globalSettings || DEFAULT_FORUM_GLOBAL_SETTINGS,
              masks: appDataRef.current.masks || [],
              worldBooks: appDataRef.current.worldBooks || [],
              post,
              userComment: triggerComment.content,
            });
          }

          return maybeGenerateCharacterForumReplyActivity({
            activeConfig: forumConfig,
            post,
            channel,
            userNewComment: triggerComment,
            allCharacters,
            existingPosts,
            globalSettings: forumDataRef.current.globalSettings || DEFAULT_FORUM_GLOBAL_SETTINGS,
            masks: appDataRef.current.masks || [],
            worldBooks: appDataRef.current.worldBooks || [],
            resolveAuthorName: (authorId) => getAuthor(authorId).name,
          });
        },
      });

      if (result.addedCount > 0) {
        return result.addedCount;
      }

      if (options.markDetailExpanded) {
        updateSinglePost(postId, (post) => ({
          ...post,
          aiDetailExpanded: true,
          aiLastExpandedAt: Date.now(),
        }));
      }
      return 0;
    } catch (error) {
      console.error('[forum] failed to generate replies', error);
      showForumNotice('论坛自动回帖失败了，这次先没接上。可以稍后再试一次。', 'error');
      return 0;
    } finally {
      setForumAiLoadingPostId((current) => current === postId ? null : current);
    }
  };

  const handleCommentWithAi = async (
    postId: string,
    content: string,
    replyToId?: string,
    rootCommentId?: string,
    identity: 'self' | 'anonymous' = 'self',
    maskId?: string,
  ) => {
    const createdComment = handleComment(postId, content, replyToId, rootCommentId, identity, maskId);
    if (!createdComment) return;
    const commentedPost = postsRef.current.find((item) => item.id === postId);
    if (commentedPost) {
      void applyUserMomentum(commentedPost, createdComment);
    }
    if (!forumConfig) {
      showForumNotice('评论已发出。当前论坛 AI 未启用，所以还不会自动回复。');
      return;
    }

    await triggerForumAiReplies(postId, {
      userNewComment: createdComment,
      allowCharacterReply: false,
      ...buildForumReplyPlan(postsRef.current.find((item) => item.id === postId) || { contentTier: 'baseline' }, 'comment', !!replyToId),
    });
  };

  const handleManualRefreshReplies = async (postId: string) => {
    if (!forumConfig) {
      showForumNotice('当前论坛 AI 未启用，暂时不能补楼。', 'error');
      return;
    }

    const targetPost = postsRef.current.find((item) => item.id === postId);
    if (!targetPost) return;

    const replyCount = 28 + Math.floor(Math.random() * 13);
    const addedCount = await triggerForumAiReplies(postId, {
      replyCount,
      minReplyCount: 20,
      replyMode: 'mixed',
      markDetailExpanded: true,
    });
    if (addedCount > 0) {
      updateSinglePost(postId, (post) => applyForumHotState(markForumHotContinuation(post, 'detail_refresh')));
      showForumNotice(`这次手动补了 ${addedCount} 层新回复。`);
      return;
    }
    showForumNotice('这次没补出新回复，可以稍后再点一次。');
  };

  const handleOpenPublicThreads = async (draftOverride?: ForumOpenDraft) => {
    if (!forumConfig) {
      showForumNotice('当前论坛 AI 未启用，暂时不能开新楼。', 'error');
      return;
    }
    if (feedRefreshLoading || feedRefreshLockRef.current) return;
    const openDraft = draftOverride || publicOpenDraft;

    let shouldTriggerLinkedSpectatorRefresh = false;
    feedRefreshLockRef.current = true;
    setFeedRefreshLoading(true);
    try {
      const opened = await openForumThreads({
        activeConfig: forumConfig,
        activeChannel,
        mode: openDraft.mode,
        selectedChannels: openDraft.selectedChannels,
        selectedThreadTypes: openDraft.selectedThreadTypes,
        preferredTopicText: openDraft.preferredTopicText.trim(),
        preferredSceneText: openDraft.preferredSceneText.trim(),
        preferredConflictText: openDraft.preferredConflictText.trim(),
        preferredRelationshipText: openDraft.preferredRelationshipText.trim(),
        excludedTopicText: openDraft.excludedTopicText.trim(),
        posts: postsRef.current,
        globalSettings: forumDataRef.current.globalSettings || DEFAULT_FORUM_GLOBAL_SETTINGS,
        worldBooks: appDataRef.current.worldBooks || [],
        currentUserId: currentUser.id,
        followedUserIds: followedUsers,
        inferChannel: inferForumChannelFromCategory,
        getAuthor,
      });
        const nextViewChannels = openDraft.mode === 'random'
          ? opened.openedChannels
          : (openDraft.selectedChannels.length > 0 ? openDraft.selectedChannels : publicViewChannels);
        if (opened.posts.length > 0) {
          const nextRuntimeAuthorProfiles = opened.runtimeProfiles.length > 0
            ? mergeRuntimeAuthorProfiles(opened.runtimeProfiles)
            : (forumDataRef.current.runtimeAuthorProfiles || {});
          const updatedSourcePostMap = new Map(opened.updatedSourcePosts.map((post) => [post.id, post]));
          const merged = pruneForumFeed(
          [
            ...diversifyForumPosts(opened.posts),
            ...postsRef.current.map((post) => updatedSourcePostMap.get(post.id) || post),
          ].map((post) => applyForumHotState(post)),
        );
        updatePosts(merged, nextRuntimeAuthorProfiles);
        setPublicViewChannels(nextViewChannels);
        if (nextViewChannels.length === 1) {
          setActiveChannel(nextViewChannels[0] as ForumChannelTabId);
        }
        shouldTriggerLinkedSpectatorRefresh = !!forumDataRef.current.spectatorSettings?.autoGenerate;
        const followupSuffix = opened.hotFollowupCount > 0 ? `，另带了 ${opened.hotFollowupCount} 篇热帖续贴` : '';
        const feedbackSuffix = opened.topicFeedbackLines.length > 0
          ? ` 命中：${opened.topicFeedbackLines.slice(0, 3).join('；')}。`
          : '';
        showForumNotice(`这次开了 ${opened.actualCount} / ${opened.requestedCount} 帖，覆盖 ${opened.openedChannels.length} 个区${followupSuffix}。${feedbackSuffix}`);
      } else {
        console.warn('[forum] open threads produced no posts');
        showForumNotice('这次没开出新楼，可以稍后再试。', 'error');
      }
    } catch (error) {
      console.error('[forum] failed to open public threads', error);
      showForumNotice('开楼失败了，可能是接口暂时没接上。', 'error');
    } finally {
      setFeedRefreshLoading(false);
      feedRefreshLockRef.current = false;
    }

    if (shouldTriggerLinkedSpectatorRefresh) {
      await generateSpectatorPostsFromSettings({
        randomizeIfEmpty: true,
        preserveBoardView: true,
        silentNotice: true,
      });
    }
  };

  const handleUpgradeForumFriend = (authorId: string) => {
    const author = getAuthor(authorId);
    if (getCharacterById(authorId)) {
      if (onOpenChat) onOpenChat(authorId);
      return;
    }

    const existingSession = (forumDataRef.current.tempChats || {})[authorId];
    if (!existingSession?.addedAsFriend) {
      showForumNotice('对方还没有正式加上你，先去“新的朋友”里处理好友申请。', 'error');
      return;
    }
    const bridged = bridgeForumFriendToFormalChat({
      appData: appDataRef.current,
      author,
      session: existingSession,
    });
    const bridgeTimestamp = Date.now();
    const nextCharacters = bridged.nextCharacters.map((character) => {
      if (!character || character.id !== authorId) {
        return character;
      }

      const settlement = buildForumSharedSettlement(character, {
        kind: 'friend_bridge',
        actorName: author.name,
        content: existingSession.messages.slice(-1)[0]?.text || '论坛里的关系已经往正式单聊过渡。',
        timestamp: bridgeTimestamp,
      });

      return {
        ...character,
        sharedContextSnapshots: settlement.sharedContextSnapshots,
        shortTermSummary: settlement.shortTermSummary,
        openLoopRegistry: settlement.openLoopRegistry,
      };
    });

    onUpdateAppData({
      ...appDataRef.current,
      characters: nextCharacters,
      chatHistory: bridged.nextChatHistory,
      forumData: buildForumDataState({
        tempChats: {
          ...(forumDataRef.current.tempChats || {}),
          [authorId]: bridged.nextTempSession,
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
    const userMessage = createForumTempUserMessage(userText);

    setTempChatInput('');
    setTempChatLoading(true);

    const relatedPost = resolveRecentForumPostForAuthor(activeTempChatUserId);
    const replyPolicy = buildTempChatReplyPolicy(author, session || {
      ...createEmptyForumTempChatSession(activeTempChatUserId),
    });

    updateTempChatSession(activeTempChatUserId, (currentSession) => {
      return queueForumTempUserMessage({
        session: currentSession,
        userMessage,
        userText,
        behavior: replyPolicy.behavior,
        readDelayMs: replyPolicy.readDelayMs,
        replyDelayMs: replyPolicy.replyDelayMs,
        relatedPostId: relatedPost?.id || null,
      });
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

  const handleMarkAllForumNotificationsRead = () => {
    const currentForumData = forumDataRef.current;
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState(applyForumNotificationsRead(currentForumData)),
    } as AppDataExtended);
    showForumNotice('通知都标成已读了。');
    setShowMessageManageSheet(false);
  };

  const handleMarkAllForumChatsRead = () => {
    const currentForumData = forumDataRef.current;
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState(applyForumChatsRead(currentForumData)),
    } as AppDataExtended);
    showForumNotice('聊天都标成已读了。');
    setShowMessageManageSheet(false);
  };

  const handleClearStrangerForumChats = () => {
    const currentForumData = forumDataRef.current;
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState(applyForumStrangerChatsCleared(
        currentForumData,
        (authorId) => isMutualForumFollow(authorId),
      )),
    } as AppDataExtended);
    showForumNotice('陌生人聊天已经清掉。');
    setShowMessageManageSheet(false);
  };

  const handleClearAllForumNotifications = () => {
    const currentForumData = forumDataRef.current;
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState(applyForumNotificationsCleared(currentForumData)),
    } as AppDataExtended);
    showForumNotice('通知列表已经清空。');
    setShowMessageManageSheet(false);
  };

  const handleTogglePinnedForumChat = (authorId: string) => {
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        pinnedChatAuthorIds: togglePinnedForumChat(forumDataRef.current.pinnedChatAuthorIds || [], authorId),
      }),
    } as AppDataExtended);
    setOpenMessageRowMenuId(null);
  };

  const handleTogglePinnedForumPost = (postId: string) => {
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        pinnedPostIds: togglePinnedForumPost(forumDataRef.current.pinnedPostIds || [], postId),
      }),
    } as AppDataExtended);
  };

  const handleRemoveSingleForumChat = (authorId: string) => {
    const currentForumData = forumDataRef.current;
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState(applySingleForumChatRemoved(currentForumData, authorId)),
    } as AppDataExtended);
    showForumNotice('这条聊天已经清理。');
    setOpenMessageRowMenuId(null);
  };

  const handleRemoveSingleForumNotification = (notificationId: string) => {
    const currentForumData = forumDataRef.current;
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState(applySingleForumNotificationRemoved(currentForumData, notificationId)),
    } as AppDataExtended);
    showForumNotice('这条通知已经清理。');
    setOpenMessageRowMenuId(null);
  };

  // Mark notifications as read when switching to notification tab
  useEffect(() => {
    if (activeTab === 'notification' && messageTab === 'activity') {
      markNotificationsRead();
    }
  }, [activeTab, messageTab]);

  useEffect(() => {
    setOpenMessageRowMenuId(null);
  }, [messageTab, chatListTab]);

  const handleUpdateProfile = () => {
    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        runtimeAuthorProfiles: buildUpdatedCurrentUserForumProfiles({
          currentUser,
          runtimeProfiles: forumDataRef.current.runtimeAuthorProfiles || {},
          draft: {
            name: editName,
            handle: editId,
            bio: editBio,
            avatar: editAvatar || currentUserForumProfile.avatar,
          },
        }),
      }),
    } as AppDataExtended);
    setEditAvatarUrlInput('');
    setCurrentView(profileEditReturnView);
    if (profileEditReturnView === 'list') {
      setActiveTab('profile');
    }
  };

  const openCurrentUserForumProfileEditor = (returnView: 'list' | 'forum-settings' = 'list') => {
    setProfileEditReturnView(returnView);
    setEditName(currentUserForumProfile.name || '');
    setEditId(currentUserForumProfile.handle || '');
    setEditBio(currentUserForumProfile.bio || '');
    setEditAvatar(currentUserForumProfile.avatar || '');
    setEditAvatarUrlInput('');
    setCurrentView('edit-profile');
  };

  const openCharacterForumProfileEditor = (characterId: string) => {
    const character = getCharacterByIdStrict(characterId);
    if (!character) return;
    const profile = runtimeAuthorProfiles[characterId] || buildCharacterForumRuntimeProfile(character);
    setEditingForumAuthorId(characterId);
    setEditName(profile.name || character.name);
    setEditId(profile.handle || '');
    setEditBio(profile.bio || character.signature || character.corePersona || '');
    setCurrentView('edit-author-profile');
  };

  const handleSaveCharacterForumProfile = () => {
    if (!editingForumAuthorId) return;
    const character = getCharacterByIdStrict(editingForumAuthorId);
    if (!character) return;

    const baseProfile = buildCharacterForumRuntimeProfile(character);
    const normalizedHandle = editId.trim().replace(/^@/, '');
    const nextProfile: ForumRuntimeAuthorProfile = {
      ...baseProfile,
      id: character.id,
      name: editName.trim() || baseProfile.name,
      handle: normalizedHandle || baseProfile.handle,
      bio: editBio.trim() || baseProfile.bio,
      avatar: character.avatar,
      origin: 'character',
      aliasVersion: baseProfile.aliasVersion,
      manuallyEdited: true,
      generationMode: 'manual',
    };

    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        runtimeAuthorProfiles: {
          ...(forumDataRef.current.runtimeAuthorProfiles || {}),
          [character.id]: nextProfile,
        },
      }),
    } as AppDataExtended);

    setCurrentView('user-profile');
    showForumNotice('这个角色的论坛资料已经改好。');
  };

  const handleUpdateForumGlobalSettings = (nextSettings: NonNullable<ForumData['globalSettings']>) => {
    const currentSettings = normalizeForumGlobalSettings(forumDataRef.current.globalSettings || DEFAULT_FORUM_GLOBAL_SETTINGS);
    const normalizedNextSettings = normalizeForumGlobalSettings(nextSettings);
    const shouldClearAutoNpcChats = currentSettings.social.allowNpcTempChat && !normalizedNextSettings.social.allowNpcTempChat;
    const nextForumData = shouldClearAutoNpcChats
      ? applyForumAutoNpcChatsCleared({
          ...forumDataRef.current,
          globalSettings: normalizedNextSettings,
        } as ForumData)
      : {
          ...forumDataRef.current,
          globalSettings: normalizedNextSettings,
        };

    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState(nextForumData),
    } as AppDataExtended);

    if (shouldClearAutoNpcChats) {
      showForumNotice('已关闭网友主动私聊，历史自动陌生人私聊也一起清掉了。');
    }
  };

  const saveSpectatorSettings = () => {
    setSpectatorOpenMode('configured');
    const nextSettings = buildCurrentSpectatorSettings();

    onUpdateAppData({
      ...appDataRef.current,
      forumData: buildForumDataState({
        spectatorSettings: nextSettings,
      }),
    } as AppDataExtended);
    showForumNotice('镜间设置已保存。');
    setForumBoard('spectator');
    setCurrentView('list');
  };

  const buildRandomSpectatorSeed = (): ForumSpectatorSettings => buildRandomSpectatorSettings({
    currentUserName: spectatorObjectUserName,
    availableCharacterNames: appData.characters.slice(0, 10).map((character) => character.name).filter(Boolean),
  });

  const applySpectatorSettingsDraft = (draft: ForumSpectatorSettings) => {
    setSpectatorSubjectName(draft.subjectName || '');
    setSpectatorRelationshipSummary(draft.relationshipSummary || '');
    setSpectatorTopicHint(draft.topicHint || '');
    setSpectatorObjectMode(draft.objectMode || 'user_with_characters');
    setSpectatorOpenMode(draft.mode === 'random' ? 'random' : 'configured');
    setSpectatorThreadTypes(draft.threadTypes || []);
    setSpectatorWorldShell(draft.worldShell as SpectatorWorldShell | undefined);
    setSpectatorTone(draft.tone);
    setSpectatorAngles(draft.angles || []);
    setSpectatorAutoGenerate(!!draft.autoGenerate);
    setSpectatorCharacterIds(draft.selectedCharacterIds || []);
    const normalizedUserSlot = normalizeSpectatorUserSlot(draft);
    setSpectatorUserSlotMode(normalizedUserSlot.mode);
    setSpectatorUserNameSource(draft.userNameSource || 'user');
    setSpectatorUserMaskId(normalizedUserSlot.maskId);
    setSpectatorTargetCharacters(normalizeSpectatorTargetCharacters(draft));
    setSpectatorTargetPresets(draft.targetPresets || []);
    setSpectatorCluePool(draft.cluePool || []);
    setSpectatorDefaultThreadTypePool(draft.defaultThreadTypePool || []);
  };

  const generateSpectatorPostsFromSettings = async (options?: {
    randomizeIfEmpty?: boolean;
    forceRandomize?: boolean;
    preserveBoardView?: boolean;
    silentNotice?: boolean;
  }) => {
    const currentSettings = buildCurrentSpectatorSettings();
    const randomSeed = buildRandomSpectatorSeed();
    const currentAngles = currentSettings.angles || [];
    const selectedThreadTypes = currentSettings.threadTypes || [];
    const preserveBoardView = !!options?.preserveBoardView;
    const shouldRandomize = !!options?.forceRandomize
      || (!!options?.randomizeIfEmpty && !currentSettings.subjectName && !currentSettings.worldShell && currentAngles.length === 0);
    const randomizedRelationshipSummary = buildSpectatorDraftText(
      pickRandomSpectatorDraftValues(
        spectatorRelationshipSuggestions,
        2 + Math.floor(Math.random() * 2),
      ),
      ' / ',
    );
    const settingsPayload = shouldRandomize ? {
      ...randomSeed,
      relationshipSummary: randomizedRelationshipSummary || randomSeed.relationshipSummary,
      threadTypes: [],
    } : {
      ...currentSettings,
      subjectName: currentSettings.subjectName || randomSeed.subjectName,
      relationshipSummary: currentSettings.relationshipSummary || randomizedRelationshipSummary || randomSeed.relationshipSummary,
      tone: currentSettings.tone || randomSeed.tone,
      worldShell: currentSettings.worldShell || randomSeed.worldShell,
      angles: currentAngles.length ? currentAngles : randomSeed.angles,
      threadTypes: selectedThreadTypes,
    };
    const selectedTargetIds = normalizeSpectatorTargetCharacters(settingsPayload).map((target) => target.characterId);
    const selectedCharacters = appData.characters.filter((character) => selectedTargetIds.includes(character.id));
    const generationBatches = buildSpectatorGenerationBatches({
      settings: settingsPayload,
      selectedCharacters,
      totalCount: SPECTATOR_OPEN_THREAD_TOTAL_COUNT,
    });

    applySpectatorSettingsDraft(settingsPayload);

    if (!preserveBoardView) {
      setForumBoard('spectator');
      setCurrentView('list');
    }

    if (feedRefreshLoading || feedRefreshLockRef.current) return;
    feedRefreshLockRef.current = true;
    setFeedRefreshLoading(true);

    try {
      let spectatorPosts = generationBatches.flatMap((batch, index) => createSpectatorPosts({
        settings: batch.settings,
        currentUserName: spectatorObjectUserName,
        selectedCharacters: batch.selectedCharacters,
        now: Date.now() + index * 1000,
        count: batch.count,
        allowedThreadTypes: batch.settings.threadTypes || [],
      })).slice(0, SPECTATOR_OPEN_THREAD_TOTAL_COUNT);
      let nextRuntimeProfiles = forumDataRef.current.runtimeAuthorProfiles || {};

      if (forumConfig) {
        const generatedResults = await Promise.all(generationBatches.map((batch) => generateSpectatorThreads({
          activeConfig: forumConfig,
          settings: batch.settings,
          currentUserName: spectatorObjectUserName,
          selectedCharacters: batch.selectedCharacters,
          existingPosts: postsRef.current.filter((post) => post.board === 'spectator' || post.category === SPECTATOR_BOARD_CATEGORY),
          globalSettings: forumDataRef.current.globalSettings || DEFAULT_FORUM_GLOBAL_SETTINGS,
          masks: appDataRef.current.masks || [],
          worldBooks: appDataRef.current.worldBooks || [],
          count: batch.count,
          allowedThreadTypes: batch.settings.threadTypes || [],
        })));

        const generatedPosts = generatedResults.flatMap((result) => result.posts);
        if (generatedPosts.length > 0) {
          const resolvedShell = resolveSpectatorWorldShell(settingsPayload.worldShell);
          const generatedRuntimeProfiles = generatedResults.flatMap((result) => result.authors).map((author, index) => ({
            id: author.id,
            name: author.displayName,
            handle: !author.handle || looksMachineGeneratedHandle(author.handle)
              ? buildSpectatorRuntimeHandle(resolvedShell, index, author.displayName)
              : author.handle.replace(/^@/, '').trim(),
            avatar: seedFallbackAvatar(author.avatarSeed || `${author.displayName}${author.handle || ''}`, author.displayName),
            bio: author.bio || '',
            persona: author.persona || author.bio || '',
            speakingStyle: author.speakingStyle,
            preferredMove: author.speakingStyle ? `说话常带 ${author.speakingStyle}` : undefined,
            homeChannel: 'junction' as const,
            boardScope: 'spectator' as const,
          }));
          nextRuntimeProfiles = mergeRuntimeAuthorProfiles(generatedRuntimeProfiles);
          spectatorPosts = generatedPosts.slice(0, SPECTATOR_OPEN_THREAD_TOTAL_COUNT);
        }
      }

      if (spectatorPosts.length < SPECTATOR_OPEN_THREAD_TOTAL_COUNT) {
        const fallbackPosts = generationBatches.flatMap((batch, index) => createSpectatorPosts({
          settings: batch.settings,
          currentUserName: spectatorObjectUserName,
          selectedCharacters: batch.selectedCharacters,
          now: Date.now() + 2000 + index * 1000,
          count: batch.count,
          allowedThreadTypes: batch.settings.threadTypes || [],
        }));
        const existingIds = new Set(spectatorPosts.map((post) => post.id));
        spectatorPosts = [...spectatorPosts, ...fallbackPosts.filter((post) => !existingIds.has(post.id))]
          .slice(0, SPECTATOR_OPEN_THREAD_TOTAL_COUNT);
      }

      if (forumConfig && settingsPayload.objectMode !== 'single_character') {
        const characterPost = await maybeGenerateSpectatorCharacterPost({
          activeConfig: forumConfig,
          settings: settingsPayload,
          currentUserName: spectatorObjectUserName,
          selectedCharacters,
          allCharacters: appDataRef.current.characters,
          existingPosts: postsRef.current.filter((post) => post.board === 'spectator' || post.category === SPECTATOR_BOARD_CATEGORY),
          globalSettings: forumDataRef.current.globalSettings || DEFAULT_FORUM_GLOBAL_SETTINGS,
          masks: appDataRef.current.masks || [],
          worldBooks: appDataRef.current.worldBooks || [],
        });

        if (characterPost) {
          spectatorPosts = [characterPost, ...spectatorPosts].slice(0, SPECTATOR_OPEN_THREAD_TOTAL_COUNT);
        }
      }

      onUpdateAppData({
        ...appDataRef.current,
        forumData: buildForumDataState({
          posts: pruneForumFeed([...spectatorPosts, ...postsRef.current]),
          runtimeAuthorProfiles: nextRuntimeProfiles,
          spectatorSettings: settingsPayload,
        }),
      } as AppDataExtended);
      if (!options?.silentNotice) {
        showForumNotice(`镜间补了 ${spectatorPosts.length} 条新帖。`);
      }
      if (!preserveBoardView) {
        setCurrentView('list');
        setForumBoard('spectator');
      }
    } catch (error) {
      console.error('[forum] failed to generate spectator posts', error);
      if (!options?.silentNotice) {
        showForumNotice('镜间补帖失败了，这次先没接上。', 'error');
      }
    } finally {
      feedRefreshLockRef.current = false;
      setFeedRefreshLoading(false);
    }
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
        && (publicViewChannels.length === 0 || publicViewChannels.includes(inferForumChannelFromCategory(p.category)));
    });
    displayPosts = sortForumPostsWithPins(displayPosts, pinnedPostIds);

    if (searchQuery.trim()) {
      displayPosts = displayPosts.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getAuthor(p.authorId).name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      if (homeFilter === 'hot') {
        displayPosts.sort((a, b) => getForumTrendScore(b) - getForumTrendScore(a));
      } else {
        displayPosts.sort((a, b) => b.timestamp - a.timestamp);
      }
    }
    displayPosts = displayPosts.slice(0, 60);

    return (
      <div className="forum-app-scroll h-full min-h-0 overflow-y-auto bg-white" style={forumBottomInsetStyle}>
        {displayPosts.map(post => {
          const author = resolvePostAuthor(post);
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
              isPinned={pinnedPostIds.includes(post.id)}
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
              onTogglePin={isOwner ? handleTogglePinnedForumPost : undefined}
              onDelete={(postId) => { void handleDeletePost(postId); }}
              onReport={handleReport}
              onLike={handleLikePost}
              onShare={setShowShareModal}
            />
          );
        })}
        {displayPosts.length === 0 && (
          <div className="px-8 py-14 text-center text-zinc-500">
            <div className="text-[18px] font-bold text-zinc-900 mb-2">
              {forumBoard === 'spectator' ? '镜间还没有帖子' : `${publicViewSummary.label}还没有帖子`}
            </div>
            <div className="text-[13px] leading-6 text-zinc-500">
              {forumBoard === 'spectator'
                ? '先随手开一栋楼，或者直接点随机生贴。'
                : publicViewSummary.blurb}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPostDetail = () => {
    const post = posts.find(p => p.id === selectedPostId);
    if (!post) return null;
    const author = resolvePostAuthor(post);
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
      <ForumPostDetailView
        post={post}
        author={author}
        handle={handle}
        isOwner={isOwner}
        identityMeta={identityMeta}
        threadTypeLabel={threadTypeMeta.label}
        threadTypeClassName={threadTypeMeta.className}
        sortedComments={sortedComments}
        floorMap={floorMap}
        timeStr={timeStr}
        dateStr={dateStr}
        currentUserId={currentUser.id}
        currentUserAvatar={currentUserForumProfile.avatar}
        anonymousMainAvatar={seedFallbackAvatar(`seed-anon-${currentUser.id}-main`, '匿名')}
        anonymousReplyAvatar={seedFallbackAvatar(`seed-anon-${currentUser.id}-reply`, '匿名')}
        defaultCommentMaskId={availableCommentMasks[0]?.id}
        availableCommentMasks={availableCommentMasks.map((mask) => ({ id: mask.id, name: mask.name }))}
        mainReplyText={mainReplyText}
        showPostMenu={showPostMenu === post.id}
        isPinned={pinnedPostIds.includes(post.id)}
        forumAiLoading={forumAiLoadingPostId === post.id}
        topInsetStyle={forumTopInsetStyle}
        onBack={() => setCurrentView('list')}
        onOpenAuthor={(authorId) => {
          if (authorId !== currentUser.id && !authorId.startsWith(`seed-anon-${currentUser.id}-`)) {
            setViewingUserId(authorId);
            setCurrentView('user-profile');
          } else {
            setActiveTab('profile');
          }
        }}
        onToggleMenu={() => setShowPostMenu(showPostMenu === post.id ? null : post.id)}
        onCloseMenu={() => setShowPostMenu(null)}
        onCollect={handleCollectPost}
        onTogglePin={isOwner ? handleTogglePinnedForumPost : undefined}
        onDelete={handleDeletePost}
        onReport={handleReport}
        onLike={handleLikePost}
        onShare={setShowShareModal}
        onRefreshReplies={(postId) => { void handleManualRefreshReplies(postId); }}
        onVotePoll={handleVoteInPoll}
        onMainReplyTextChange={setMainReplyText}
        onSubmitSelfReply={(maskId) => {
          if (mainReplyText.trim()) {
            void handleCommentWithAi(post.id, mainReplyText.trim(), undefined, undefined, 'self', maskId);
            setMainReplyText('');
          }
        }}
        onSubmitAnonymousReply={() => {
          if (mainReplyText.trim()) {
            void handleCommentWithAi(post.id, mainReplyText.trim(), undefined, undefined, 'anonymous');
            setMainReplyText('');
          }
        }}
        resolveCommentAuthor={(comment) => resolveCommentAuthor(comment)}
        resolveCommentHandle={(comment) => formatForumHandle(resolveCommentAuthor(comment))}
        resolveCommentIdentityMeta={(comment) => getForumIdentityBadgeMeta(resolveCommentIdentity(comment))}
        isCurrentUserCommentAuthor={(comment) => isCurrentUserCommentAuthor(comment.authorId, comment)}
        resolveReplyToAuthorName={(comment) => (
          comment.replyToId
            ? resolveCommentAuthor(post.comments.find((item) => item.id === comment.replyToId) || comment).name
            : undefined
        )}
        resolveCommentTime={(comment) => {
          const commentDate = new Date(comment.timestamp);
          const now = new Date();
          const diffMs = now.getTime() - commentDate.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);
          if (diffMins < 1) return '刚刚';
          if (diffMins < 60) return `${diffMins}分钟`;
          if (diffHours < 24) return `${diffHours}小时`;
          if (diffDays < 365) return commentDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
          return commentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
        }}
        resolveRepliesCount={(comment) => post.comments.filter((item) => item.replyToId === comment.id).length}
        onReply={handleCommentWithAi}
        onLikeComment={handleLikeComment}
        onDeleteComment={(postId, commentId) => { void handleDeleteComment(postId, commentId); }}
        onUserClick={handleUserClick}
      >
        {renderShareModal()}
      </ForumPostDetailView>
    );
  };

  const renderEditor = () => (
    <div className="bg-white h-full min-h-0 flex flex-col">
      <div className="px-4 pb-3 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10" style={forumTopInsetStyle}>
        <button onClick={() => {
          setCurrentView('list');
          setEditingPostId(null);
          setEditorIdentity('self');
          setEditorMaskId(undefined);
          setEditorThreadType('auto');
          setEditorChannel(activeChannel);
          setEditorSettingsOpen(false);
        }} className="text-zinc-900 font-bold text-[14px]">取消</button>
        <div className="flex gap-4 items-center">
          <button onClick={saveForumComposerDraft} className="text-zinc-900 font-bold text-[14px]">草稿</button>
          <button
            onClick={handlePublish}
            className={`rounded-full border px-4 py-1.5 text-[14px] font-bold transition-colors ${(!editorContent.trim()) ? 'border-zinc-200 bg-zinc-100 text-zinc-400 opacity-60' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
          >
            发布
          </button>
        </div>
      </div>
      <div className="p-4 flex-1 min-h-0 overflow-y-auto flex gap-3">
        <ResolvedImage
          value={resolveIdentityAvatar(editorIdentity, editorMaskId)}
          className="w-10 h-10 rounded-full object-cover shrink-0"
        />
        <div className="flex-1">
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

          <div className="mt-5 rounded-3xl border border-zinc-100 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <button
              type="button"
              onClick={() => setEditorSettingsOpen((current) => !current)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <div className="text-[13px] font-semibold text-zinc-800">
                  发布到 {editorChannelMeta.label}
                  <span className="mx-2 text-zinc-300">·</span>
                  {editorIdentity === 'anonymous' ? '匿名' : editorIdentity === 'mask' ? (availablePostMasks.find((mask) => mask.id === editorMaskId)?.name || '面具') : '本人'}
                  <span className="mx-2 text-zinc-300">·</span>
                  {editorThreadType === 'auto' ? '自动帖型' : FORUM_THREAD_TYPE_LABELS[editorThreadType]}
                </div>
                <div className="mt-1 text-[12px] text-zinc-400">
                  {editorIdentity === 'anonymous'
                    ? '前台会显示为匿名马甲。'
                    : editorIdentity === 'mask'
                      ? '会以当前面具身份发布。'
                      : '会以你当前论坛身份发布。'}
                </div>
              </div>
              <span
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[12px] font-medium text-zinc-500"
              >
                {editorSettingsOpen ? '收起' : '调整'}
              </span>
            </button>

            {editorSettingsOpen && (
              <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
                <div className="mb-3">
                  <div className="mb-2 text-[12px] font-medium text-zinc-500">发布分区</div>
                  <div className="flex flex-wrap gap-2">
                    {FORUM_CHANNEL_TABS.map((channel) => (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => setEditorChannel(channel.id)}
                        className={`rounded-full border px-3 py-1 text-[12px] font-bold transition-colors ${
                          editorChannel === channel.id
                            ? 'border-sky-200 bg-sky-50 text-sky-700'
                            : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
                        }`}
                      >
                        {channel.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="mb-2 text-[12px] font-medium text-zinc-500">发帖身份</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditorIdentity('self');
                        setEditorMaskId(undefined);
                      }}
                      className={`rounded-full border px-3 py-1 text-[12px] font-bold transition-colors ${editorIdentity === 'self' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'}`}
                    >
                      本人发帖
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditorIdentity('mask');
                        setEditorMaskId((current) => current || availablePostMasks[0]?.id);
                      }}
                      disabled={availablePostMasks.length === 0}
                      className={`rounded-full border px-3 py-1 text-[12px] font-bold transition-colors ${
                        editorIdentity === 'mask'
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
                      } ${availablePostMasks.length === 0 ? 'cursor-not-allowed opacity-40' : ''}`}
                    >
                      面具发帖
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditorIdentity('anonymous');
                        setEditorMaskId(undefined);
                      }}
                      className={`rounded-full border px-3 py-1 text-[12px] font-bold transition-colors ${editorIdentity === 'anonymous' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'}`}
                    >
                      匿名发帖
                    </button>
                  </div>
                </div>

                {editorIdentity === 'mask' && availablePostMasks.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-2 text-[12px] font-medium text-zinc-500">选择面具</div>
                    <div className="flex flex-wrap gap-2">
                      {availablePostMasks.map((mask) => (
                        <button
                          key={mask.id}
                          type="button"
                          onClick={() => setEditorMaskId(mask.id)}
                          className={`rounded-full border px-3 py-1 text-[12px] font-bold transition-colors ${
                            editorMaskId === mask.id
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
                          }`}
                        >
                          {mask.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2 text-[12px] font-medium text-zinc-500">帖型</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditorThreadType('auto')}
                      className={`rounded-full border px-3 py-1 text-[12px] font-bold transition-colors ${
                        editorThreadType === 'auto'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
                      }`}
                    >
                      自动判断
                    </button>
                    {FORUM_FILTER_THREAD_TYPES.map((threadType) => (
                      <button
                        key={threadType}
                        type="button"
                        onClick={() => setEditorThreadType(threadType)}
                        className={`rounded-full border px-3 py-1 text-[12px] font-bold transition-colors ${
                          editorThreadType === threadType
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
                        }`}
                      >
                        {FORUM_THREAD_TYPE_LABELS[threadType]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

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
    const hotPosts = [...posts]
      .filter((post) => (post.board ?? 'public') !== 'spectator')
      .sort((a, b) => getForumTrendScore(b) - getForumTrendScore(a));
    const query = hotSearchQuery.trim().toLowerCase();

    const basePostItems: ForumTrendListItem[] = hotPosts.map((post, index) => {
      const author = resolvePostAuthor(post);
      const threadTypeMeta = getForumThreadTypeMeta(post.threadType);
      const trendMeta = getForumTrendMeta(post);
      const trendScore = getForumTrendScore(post);
      return {
        type: 'post',
        key: `post-${post.id}`,
        post,
        rank: index + 1,
        authorId: author.id,
        authorName: author.name,
        authorAvatar: author.avatar,
        authorHandle: formatForumHandle(author),
        category: post.category,
        threadTypeLabel: threadTypeMeta.label,
        threadTypeClassName: threadTypeMeta.className,
        trendLabel: trendMeta.label,
        trendToneClassName: trendMeta.direction === 'up'
          ? 'text-rose-600'
          : trendMeta.direction === 'flat'
            ? 'text-zinc-500'
            : 'text-sky-700',
        heatText: `${formatCompactMetric(post.viewCount)} 浏览`,
        heatScoreText: `${Math.round(trendScore)}`,
        preview: post.title || post.content,
        insight: buildHotInsight(post),
        image: post.images?.[0],
        isOwner: isCurrentUserPostAuthor(post.authorId, post),
        showMenu: showPostMenu === post.id,
        isCollected: post.collections.includes(currentUser.id),
      };
    });

    let trendItems: ForumTrendListItem[] = basePostItems;

    if (query) {
      const authorItems = Array.from(new Map(
        hotPosts.flatMap((post) => {
          const author = resolvePostAuthor(post);
          const handle = formatForumHandle(author);
          const bio = author.bio || author.description || '';
          const matchedFieldLabel = author.name.toLowerCase().includes(query)
            ? '作者'
            : handle.toLowerCase().includes(query)
              ? 'ID'
              : bio.toLowerCase().includes(query)
                ? '简介'
                : '';
          if (!matchedFieldLabel) return [];

          const matchedSnippet = matchedFieldLabel === '作者'
            ? author.name
            : matchedFieldLabel === 'ID'
              ? handle
              : bio;
          const hotCount = hotPosts.filter((item) => item.authorId === author.id).length;

          return [[author.id, {
            type: 'author' as const,
            key: `author-${author.id}`,
            authorId: author.id,
            authorName: author.name,
            authorAvatar: author.avatar,
            authorHandle: handle,
            authorBio: bio,
            matchedFieldLabel,
            matchedSnippet,
            postCount: posts.filter((item) => item.authorId === author.id).length,
            hotCount,
          }]];
        }),
      ).values());

      const snippetItems: ForumTrendListItem[] = hotPosts.flatMap((post, index) => {
        const author = resolvePostAuthor(post);
        const fields = [
          { label: '标题命中', text: post.title || '' },
          { label: '正文命中', text: post.content || '' },
          { label: '分区命中', text: post.category || '' },
        ];
        const matched = fields.find((field) => field.text.toLowerCase().includes(query));
        if (!matched) return [];

        return [{
          type: 'snippet' as const,
          key: `snippet-${post.id}-${matched.label}`,
          post,
          authorId: author.id,
          authorName: author.name,
          authorAvatar: author.avatar,
          authorHandle: formatForumHandle(author),
          category: post.category,
          rank: index + 1,
          matchLabel: matched.label,
          matchText: buildSearchSnippet(matched.text, query, 32),
          heatScoreText: `${Math.round(getForumTrendScore(post))}`,
        }];
      });

      const filteredPosts = basePostItems.filter((item) => (
        item.type === 'post' && [
          item.post.title,
          item.post.content,
          item.category,
          item.authorName,
          item.authorHandle,
        ].some((value) => (value || '').toLowerCase().includes(query))
      ));

      trendItems = [
        ...authorItems.slice(0, 4),
        ...snippetItems.slice(0, 6),
        ...filteredPosts.slice(0, 20),
      ];
    }

    return (
      <>
        <ForumTrendListView
          items={trendItems}
          searchValue={hotSearchQuery}
          topInsetStyle={forumTopInsetStyle}
          bottomInsetStyle={forumBottomInsetStyle}
          onSearchChange={setHotSearchQuery}
          onOpenPost={(postId) => {
            setSelectedPostId(postId);
            setCurrentView('detail');
            const newPosts = posts.map((p) => p.id === postId ? { ...p, viewCount: p.viewCount + 1 } : p);
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
          onTogglePostMenu={(postId) => setShowPostMenu(showPostMenu === postId ? null : postId)}
          onClosePostMenu={() => setShowPostMenu(null)}
          onCollectPost={handleCollectPost}
          onDeletePost={(postId) => { void handleDeletePost(postId); }}
          onReport={handleReport}
        />
        {renderShareModal()}
      </>
    );
  };

  const renderUserProfile = () => {
    if (!viewingUserId) return null;
    const user = getAuthor(viewingUserId);
    const userPosts = posts.filter(p => p.authorId === viewingUserId).sort((a, b) => b.timestamp - a.timestamp);
    const handle = formatForumHandle(user);
    const isFollowed = followedUsers.includes(user.id);
    const editableCharacter = getCharacterByIdStrict(user.id);
    const userFollowingCount = resolveFollowingIdsForUser(user.id).length;
    const userFollowerCount = collectFollowerIdsForUser(user.id).length;
    const userPostItems = userPosts.map((post) => {
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

      return {
        post,
        timeStr,
        threadTypeLabel: threadTypeMeta.label,
        threadTypeClassName: threadTypeMeta.className,
        showMenu: showPostMenu === post.id,
        isOwner: isCurrentUserPostAuthor(post.authorId, post),
        isPinned: pinnedPostIds.includes(post.id),
        identityMeta: getForumIdentityBadgeMeta(resolvePostIdentity(post)),
      };
    });

    return (
      <ForumUserProfileView
        user={{
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          handle,
          bio: user.bio,
          description: user.description,
        }}
        postCount={userPosts.length}
        followingCount={userFollowingCount}
        followerCount={userFollowerCount}
        isFollowed={isFollowed}
        canChat={canOpenForumPrivateChat(user.id)}
        canEditProfile={!!editableCharacter}
        posts={userPostItems}
        currentUserId={currentUser.id}
        topInsetStyle={forumTopInsetStyle}
        bottomInsetStyle={forumBottomInsetStyle}
        onBack={() => {
          setCurrentView('list');
          setViewingUserId(null);
        }}
        onOpenChat={() => openForumPrivateChat(user.id)}
        onEditProfile={() => openCharacterForumProfileEditor(user.id)}
        onToggleFollow={() => handleFollow(user.id)}
        onOpenFollowing={() => openFollowList('following', user.id)}
        onOpenFollowers={() => openFollowList('followers', user.id)}
        onOpenPost={(postId) => {
          setSelectedPostId(postId);
          setCurrentView('detail');
        }}
        onTogglePostMenu={(postId) => setShowPostMenu(showPostMenu === postId ? null : postId)}
        onClosePostMenu={() => setShowPostMenu(null)}
        onCollectPost={handleCollectPost}
        onTogglePinnedPost={handleTogglePinnedForumPost}
        onDeletePost={(postId) => { void handleDeletePost(postId); }}
        onReport={handleReport}
        onLikePost={handleLikePost}
        onSharePost={setShowShareModal}
      />
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
        currentUserAvatar={currentUserForumProfile.avatar}
        tempChatInput={tempChatInput}
        tempChatLoading={tempChatLoading}
        onBack={() => {
          setCurrentView(tempChatReturnTarget === 'messages' ? 'list' : 'user-profile');
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
    const keyword = followListSearch.trim().toLowerCase();
    const followIds = rawFollowIds.filter((userId) => {
      if (!followListSearch.trim()) return true;
      const user = getAuthor(userId);
      return (
        user.name.toLowerCase().includes(keyword)
        || formatForumHandle(user).toLowerCase().includes(keyword)
        || (user.bio || user.description || '').toLowerCase().includes(keyword)
      );
    });
    const followUsers = followIds.map((userId) => {
      const user = getAuthor(userId);
      return {
        id: userId,
        name: user.name,
        avatar: user.avatar,
        handle: formatForumHandle(user),
        bio: user.bio,
        description: user.description,
        isFollowed: followedUsers.includes(userId),
        canChat: canOpenForumPrivateChat(userId),
      };
    });

    return (
      <ForumFollowListView
        mode={followListMode}
        targetUserName={targetUser.name}
        rawCount={rawFollowIds.length}
        searchValue={followListSearch}
        users={followUsers}
        emptyBySearch={!!keyword}
        onBack={() => {
          if (targetUserId === currentUser.id) {
            setCurrentView('list');
            setActiveTab('profile');
          } else {
            setCurrentView('user-profile');
          }
        }}
        onSearchChange={setFollowListSearch}
        onOpenUser={(userId) => {
          setViewingUserId(userId);
          setCurrentView('user-profile');
        }}
        onOpenChat={openForumPrivateChat}
        onToggleFollow={handleFollow}
        topInsetStyle={forumTopInsetStyle}
        bottomInsetStyle={forumBottomInsetStyle}
      />
    );
  };

  const renderProfile = () => {
    const myPosts = sortForumPostsWithPins(posts.filter((p) => isCurrentUserPostAuthor(p.authorId, p)), pinnedPostIds);
    const myReplies = posts.flatMap((p) => p.comments).filter((c) => isCurrentUserCommentAuthor(c.authorId, c));
    const myLikedPosts = posts.filter(p => p.likes.includes(currentUser.id));
    const handle = formatCurrentUserForumHandle(currentUserForumProfile.handle);
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
      const author = resolvePostAuthor(post);
      const handle = formatForumHandle(author);
      const identityMeta = getForumIdentityBadgeMeta(resolvePostIdentity(post));
      const timeStr = formatProfileTime(post.timestamp);
      const threadTypeMeta = getForumThreadTypeMeta(post.threadType);
      return (
        <ForumProfilePostCard
          key={post.id}
          post={post}
          author={{
            id: author.id,
            name: author.name,
            avatar: author.avatar,
          }}
          handle={handle}
          identityMeta={identityMeta}
          isOwner={isCurrentUserPostAuthor(post.authorId, post)}
          isPinned={pinnedPostIds.includes(post.id)}
          threadTypeLabel={threadTypeMeta.label}
          threadTypeClassName={threadTypeMeta.className}
          timeStr={timeStr}
          currentUserId={currentUser.id}
          showMenu={showPostMenu === post.id}
          onOpen={openProfilePost}
          onOpenAuthor={handleUserClick}
          onToggleMenu={(postId) => setShowPostMenu(showPostMenu === postId ? null : postId)}
          onCloseMenu={() => setShowPostMenu(null)}
          onCollect={handleCollectPost}
          onTogglePin={handleTogglePinnedForumPost}
          onDelete={(postId) => { void handleDeletePost(postId); }}
          onReport={handleReport}
          onLike={handleLikePost}
          onShare={setShowShareModal}
        />
      );
    };

    const renderProfileReplyCard = (comment: ForumComment) => {
      const parentPost = posts.find((post) => post.id === comment.postId);
      const replyToComment = parentPost?.comments.find((item) => item.id === comment.replyToId);
      const author = resolveCommentAuthor(comment);
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

    if (currentView === 'edit-author-profile') {
      const editingCharacter = editingForumAuthorId ? getCharacterByIdStrict(editingForumAuthorId) : undefined;
      if (!editingCharacter) return null;
      return (
        <ForumAuthorProfileEditor
          title="编辑论坛角色资料"
          avatar={editingCharacter.avatar}
          displayName={editName}
          handle={editId}
          bio={editBio}
          topInsetStyle={forumTopInsetStyle}
          onBack={() => setCurrentView('user-profile')}
          onSave={handleSaveCharacterForumProfile}
          onChangeDisplayName={setEditName}
          onChangeHandle={setEditId}
          onChangeBio={setEditBio}
        />
      );
    }

    if (currentView === 'edit-profile') {
      return (
        <div className="bg-white h-full min-h-0 flex flex-col">
          <div className="px-4 pb-3 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10" style={forumTopInsetStyle}>
            <div className="flex items-center gap-6">
              <button onClick={() => setCurrentView(profileEditReturnView)} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
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
                  const input = event.currentTarget;
                  const persistedValue = await setUploadedFile(file);
                  setEditAvatar(persistedValue);
                  input.value = '';
                }}
              />
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <ResolvedImage value={editAvatar || currentUserForumProfile.avatar} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-sm" />
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
                  当前论坛显示为 {formatCurrentUserForumHandle(editId || currentUserForumProfile.handle || currentUser.id)}
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

    if (currentView === 'forum-settings') {
      return (
        <ForumSettingsRoute
          handle={handle}
          profile={{
            name: currentUserForumProfile.name,
            bio: currentUserForumProfile.bio,
            avatar: currentUserForumProfile.avatar,
          }}
          settings={forumGlobalSettings}
          posts={posts}
          spectatorSettings={spectatorHeaderSettings}
          masks={appData.masks || []}
          worldBooks={appData.worldBooks || []}
          topInsetStyle={forumTopInsetStyle}
          onBack={() => setCurrentView('list')}
          onChange={handleUpdateForumGlobalSettings}
          onEditProfile={() => openCurrentUserForumProfileEditor('forum-settings')}
        />
      );
    }

    return (
      <div className="forum-app-scroll bg-white h-full min-h-0 overflow-y-auto pb-20">
        {/* Profile Header */}
        <div className="px-4 pt-12 pb-6">
          <div className="flex gap-6">
            {/* Left: Avatar, Name, ID */}
            <div className="flex flex-col items-center shrink-0 w-24">
              <ResolvedImage value={currentUserForumProfile.avatar} className="w-24 h-24 rounded-full border-2 border-zinc-100 object-cover shadow-sm mb-3" />
              <h2 className="text-[15px] font-bold text-zinc-900 text-center leading-tight">{currentUserForumProfile.name}</h2>
              <p className="text-[12px] text-zinc-500 text-center mt-1">{formatCurrentUserForumHandle(currentUserForumProfile.handle)}</p>
            </div>

            {/* Right: Bio, Stats, Actions */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    setCurrentView('forum-settings');
                  }}
                  className="px-5 py-1.5 rounded-full border border-zinc-200 font-bold text-[13px] text-zinc-900 hover:bg-zinc-50 transition-colors"
                >
                  论坛设置
                </button>
              </div>

              <div className="p-2 flex-1">
                <p className="text-[13px] text-zinc-600 leading-relaxed mb-4 italic">
                  {currentUserForumProfile.bio || '暂无简介。'}
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

  const getMessageCenterData = () => buildForumMessageCenterData({
    currentUserId: currentUser.id,
    notifications,
    tempChats,
    pinnedChatAuthorIds,
    getAuthor: (authorId) => {
      const author = getAuthor(authorId);
      return {
        id: author.id,
        name: author.name,
        avatar: author.avatar,
      };
    },
    isMutualForumFollow,
    resolveRecentForumPostForAuthor,
    formatHandleText: (authorId) => formatForumHandle(getAuthor(authorId)),
  });

  const renderMessageCenterView = () => {
    const messageCenterData = getMessageCenterData();

    const notificationItems: ForumMessageNotificationItem[] = messageCenterData.myNotifications.map((notification) => {
      const sourceUser = getAuthor(notification.sourceUserId);
      return {
        notification,
        sourceUser: {
          id: sourceUser.id,
          name: sourceUser.name,
          avatar: sourceUser.avatar,
        },
        post: posts.find((post) => post.id === notification.postId),
        actionText: getForumNotificationActionText(notification),
      };
    });

    return (
      <ForumMessageCenterView
        data={messageCenterData}
        notificationItems={notificationItems}
        messageTab={messageTab}
        chatListTab={chatListTab}
        openMessageRowMenuId={openMessageRowMenuId}
        forumTopInsetStyle={forumTopInsetStyle}
        forumBottomInsetStyle={forumBottomInsetStyle}
        onOpenManageSheet={() => setShowMessageManageSheet(true)}
        onChangeMessageTab={setMessageTab}
        onChangeChatListTab={setChatListTab}
        onOpenChat={(authorId) => {
          setViewingUserId(authorId);
          setActiveTempChatUserId(authorId);
          setTempChatReturnTarget('messages');
          setCurrentView('temp-chat');
        }}
        onMarkChatViewed={(authorId) => {
          updateTempChatSession(authorId, (currentSession) => ({
            ...currentSession,
            viewerLastSeenAt: Date.now(),
          }));
        }}
        onToggleMessageRowMenu={setOpenMessageRowMenuId}
        onTogglePinnedChat={handleTogglePinnedForumChat}
        onRemoveChat={handleRemoveSingleForumChat}
        onOpenNotificationPost={(postId) => {
          setSelectedPostId(postId);
          setCurrentView('detail');
        }}
        onRemoveNotification={handleRemoveSingleForumNotification}
        isPinnedChat={(authorId) => pinnedChatAuthorIds.includes(authorId)}
      />
    );
  };

  // --- Main Render ---

  const shouldShowForumBottomNav = currentView !== 'editor'
    && currentView !== 'edit-profile'
    && currentView !== 'follow-list'
    && currentView !== 'forum-settings'
    && currentView !== 'public-open-settings';

  const renderCurrentView = () => {
    if (currentView === 'detail') return renderPostDetail();
    if (currentView === 'editor') return renderEditor();
    if (currentView === 'spectator-settings') {
      return (
        <SpectatorSettingsView
          characters={appData.characters}
          masks={appData.masks || []}
          relationshipSuggestions={spectatorRelationshipSuggestions}
          relationshipSummary={spectatorRelationshipSummary}
          topicHint={spectatorTopicHint}
          objectMode={spectatorObjectMode}
          selectedThreadTypes={spectatorThreadTypes}
          selectedAngles={spectatorAngles}
          selectedTone={spectatorTone}
          selectedRelationshipSuggestions={selectedSpectatorRelationshipSuggestions}
          worldShell={spectatorWorldShell}
          autoGenerate={spectatorAutoGenerate}
          userSlotMode={spectatorUserSlotMode}
          userNameSource={spectatorUserNameSource}
          selectedMaskId={spectatorUserMaskId}
          targetCharacters={spectatorTargetCharacters}
          targetPresets={spectatorTargetPresets}
          cluePool={spectatorCluePool}
          defaultThreadTypePool={spectatorDefaultThreadTypePool}
          currentUserName={spectatorUserName}
          currentForumNickname={spectatorForumNickname}
          onRelationshipSummaryChange={setSpectatorRelationshipSummary}
          onTopicHintChange={setSpectatorTopicHint}
          onObjectModeChange={setSpectatorObjectMode}
          onToggleThreadType={toggleSpectatorThreadType}
          onToggleAngle={toggleSpectatorAngle}
          onToneChange={setSpectatorTone}
          onClearThreadTypes={clearSpectatorThreadTypes}
          onToggleRelationshipSuggestion={toggleSpectatorRelationshipSuggestion}
          onWorldShellChange={setSpectatorWorldShell}
          onAutoGenerateChange={setSpectatorAutoGenerate}
          onUserSlotModeChange={setSpectatorUserSlotMode}
          onUserNameSourceChange={setSpectatorUserNameSource}
          onMaskChange={setSpectatorUserMaskId}
          onToggleTargetCharacter={toggleSpectatorTargetCharacter}
          onCycleTargetRole={cycleSpectatorTargetRole}
          onSavePreset={saveCurrentSpectatorPreset}
          onApplyPreset={applySpectatorPreset}
          onRemovePreset={removeSpectatorPreset}
          onBack={() => setCurrentView('list')}
          onSave={saveSpectatorSettings}
          onGenerate={() => {
            setSpectatorOpenMode('configured');
            setForumBoard('spectator');
            setCurrentView('list');
            void generateSpectatorPostsFromSettings();
          }}
          onGenerateRandom={() => {
            setSpectatorOpenMode('random');
            setForumBoard('spectator');
            setCurrentView('list');
            void generateSpectatorPostsFromSettings({ forceRandomize: true });
          }}
          topInsetStyle={forumTopInsetStyle}
        />
      );
    }
    if (currentView === 'public-open-settings') {
      return (
        <ForumOpenSettingsRoute
          initialDraft={publicOpenDraft}
          activeChannel={activeChannel}
          topInsetStyle={forumTopInsetStyle}
          onBack={() => setCurrentView('list')}
          onGenerate={(draft) => {
            setPublicOpenDraft(draft);
            setCurrentView('list');
            void handleOpenPublicThreads(draft);
          }}
        />
      );
    }
    if (currentView === 'user-profile') return renderUserProfile();
    if (currentView === 'temp-chat') return renderTempChat();
    if (currentView === 'follow-list') return renderFollowList();

    if (activeTab === 'home') return renderPostList();
    if (activeTab === 'hot') return renderHotList();
    if (activeTab === 'notification') return renderMessageCenterView();
    return renderProfile();
  };

  const handlePrimaryRefresh = async () => {
    if (forumBoard === 'spectator') {
      await generateSpectatorPostsFromSettings({ randomizeIfEmpty: true });
      return;
    }
    await handleOpenPublicThreads();
  };

  const messageCenterManageData = activeTab === 'notification' ? getMessageCenterData() : null;

  return (
    <div
      className="forum-app-shell absolute inset-0 min-h-0 flex flex-col bg-white overflow-hidden"
    >
      {/* Header */}
      {currentView === 'list' && activeTab === 'home' && (
        <ForumHomeHeader
          forumBoard={forumBoard}
          publicLabel={publicViewSummary.label}
          publicFilterLabel={publicOpenSummaryLabel}
          publicBlurb={publicViewSummary.blurb}
          spectatorSettings={spectatorHeaderSettings}
          spectatorCharacters={appData.characters.map((character) => ({ id: character.id, name: character.name }))}
          currentUserName={spectatorObjectUserName}
          feedRefreshLoading={feedRefreshLoading}
          forumConfigEnabled={!!forumConfig}
          onClose={onClose}
          onSwitchBoard={setForumBoard}
          onRefresh={() => { void handlePrimaryRefresh(); }}
          onOpenFilter={() => setCurrentView('public-open-settings')}
          onOpenBrowseFilter={() => setShowBrowseFilterSheet(true)}
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

      {forumBoard === 'public' && (
        <ForumBrowseFilterSheet
          open={showBrowseFilterSheet}
          selectedChannels={publicViewChannels}
          onClose={() => setShowBrowseFilterSheet(false)}
          onReset={() => {
            setPublicViewChannels([]);
            setShowBrowseFilterSheet(false);
          }}
          onToggleChannel={togglePublicViewChannel}
        />
      )}

      {/* Content Area */}
      <div className="forum-app-content flex-1 min-h-0 overflow-hidden">
        {renderCurrentView()}
      </div>

      {showMessageManageSheet && messageCenterManageData && (
        <ForumMessageManageSheet
          unreadNotificationCount={messageCenterManageData.unreadNotificationCount}
          unreadChatCount={messageCenterManageData.unreadChatCount}
          strangerChatCount={messageCenterManageData.strangerChatSessions.length}
          onClose={() => setShowMessageManageSheet(false)}
          onMarkAllNotificationsRead={handleMarkAllForumNotificationsRead}
          onMarkAllChatsRead={handleMarkAllForumChatsRead}
          onClearStrangerChats={handleClearStrangerForumChats}
          onClearNotifications={handleClearAllForumNotifications}
        />
      )}

      {/* Floating Action Button */}
      {currentView === 'list' && activeTab === 'home' && (
        <button 
          onClick={() => {
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

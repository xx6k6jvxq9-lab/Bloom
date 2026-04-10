import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Camera,
  ChevronLeft,
  Copy,
  Image as ImageIcon,
  Keyboard,
  LogOut,
  MapPin,
  MessageSquarePlus,
  Mic,
  MoreVertical,
  Forward,
  Plus,
  Reply,
  Send,
  Share2,
  Smile,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { AppSettings, Character, ChatGroup, ChatHistory, ChatMessage, FavoriteMessage, PerceptionSettings, WorldBookEntry } from '../../types';
import { generateTextFromMessagesWithConfig, type RuntimeChatMessage } from '../../services/ai/runtimeClient';
import { buildGroupChatPrompt } from '../../services/ai/prompts/builders/buildGroupChatPrompt';
import {
  copyTextContent,
  copyMessageText,
  createForwardText,
  createShareAction,
  createQuoteReplyPayload,
  deleteMessageAtIndex,
  getChatLayoutConfig,
  getContextMenuPosition,
  getReplyPreviewText,
  toggleFavoriteMessage,
  type ShareActionResult,
} from '../../services/chat/messageActions';
import { parseAssistantSpeakerLabel, stripAssistantSpeakerPrefix } from '../../services/chat/assistantText';
import { buildGroupChatSceneInput } from '../../services/scene-inputs/buildGroupChatSceneInput';
import { createCharacterDirectory } from '../character-domain/useCharacterDirectory';
import { useGroupChatRuntime } from '../chat-runtime/useGroupChatRuntime';
import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';
import { saveUploadedBlob } from '../persistence/persistentAssetService';
import { useResolvedPersistentValue } from '../persistence/useResolvedPersistentValue';
import { GroupSettingsScreen } from '../group-settings/components/GroupSettingsScreen';
import {
  buildGroupSettingsSystemMessages,
  createCancelAdminSystemMessage,
  createClearMemberBadgeSystemMessage,
  createInviteMemberSystemMessage,
  createLeaveGroupSystemMessage,
  createRemoveMemberSystemMessage,
  createSetMemberBadgeSystemMessage,
  createSetAdminSystemMessage,
} from '../group-settings/groupSystemMessages';
import {
  canManageGroupAdmins,
  canManageGroupMembers,
  getGroupRoleLabel,
  isProtectedGroupMember,
  resolveGroupMemberRole,
} from '../group-settings/groupRoles';
import { getGroupMemberBubbleColor } from '../group-settings/groupBubbleColors';
import { getGroupMemberBadge } from '../group-settings/memberBadges';
import { buildGroupSettingsPatch, createGroupSettingsFormState, hasGroupSettingsChanges } from '../group-settings/utils';
import { GroupLocationPickerSheet } from './GroupLocationPickerSheet';
import { buildScopedBubbleThemeCss, buildScopedBubbleVariantCss, buildScopedElementThemeCss, extractBubbleTextStyle, hasBubbleThemeCss, parseBubbleStyleCss, sanitizeBubbleSurfaceStyle } from './bubbleStyleCss';
import { getThemeSelectedFontStack } from '../theme/themeTypography';
import { AudioMessageCard } from './AudioMessageCard';
import { useAudioMessageRecorder } from './useAudioMessageRecorder';
import { usePressToRecordInteraction } from './usePressToRecordInteraction';
import { selectActiveGroupWorldBooks } from '../group-world-book/selectActiveGroupWorldBooks';

const BASIC_EMOJIS = ['😺', '😀', '😚', '😑', '😎', '😹', '😶', '❤️', '🙄', '🙏', '🎀', '🎉'];

const AUTO_OPENING_DEDUPE_WINDOW_MS = 1500;
const autoOpeningAttemptAtBySessionKey = new Map<string, number>();

function buildGroupNoticeDismissKey(groupId: string, notice: string): string {
  return `group_notice_dismissed:${groupId}:${notice.trim()}`;
}

function resolveGroupMessageSenderLabel(
  message: ChatMessage,
  params: {
    userName: string;
    getCharacterById: (id: string) => Character | null;
  },
): string {
  if (message.isSystem) {
    return '系统消息';
  }

  if (message.role === 'user') {
    return params.userName;
  }

  if (message.senderCharacterId) {
    const speaker = params.getCharacterById(message.senderCharacterId);
    return speaker?.remarkName?.trim() || speaker?.name || '角色';
  }

  return '角色';
}

function formatChatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatChatDividerTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function shouldShowChatTimeDivider(
  currentTimestamp: number,
  previousTimestamp?: number,
): boolean {
  if (!previousTimestamp) {
    return true;
  }

  const gapMs = currentTimestamp - previousTimestamp;
  const crossedDay = new Date(currentTimestamp).toDateString() !== new Date(previousTimestamp).toDateString();
  return crossedDay || gapMs >= 30 * 60 * 1000;
}

function getGroupReadCount(
  history: ChatMessage[],
  message: ChatMessage,
): number {
  if (message.role !== 'user') {
    return 0;
  }

  const readerIds = new Set<string>();

  for (const candidate of history) {
    if (
      candidate.timestamp > message.timestamp
      && candidate.role === 'model'
      && !candidate.isSystem
      && typeof candidate.senderCharacterId === 'string'
      && candidate.senderCharacterId.trim()
    ) {
      readerIds.add(candidate.senderCharacterId);
    }
  }

  return readerIds.size;
}

function buildInviteRuntimeMessages(params: {
  systemPrompt: string;
  history: ChatMessage[];
}): RuntimeChatMessage[] {
  const historyMessages = params.history
    .filter((message) => !message.isSystem)
    .map<RuntimeChatMessage>((message) => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.text,
    }));

  return [
    { role: 'system', content: params.systemPrompt },
    ...historyMessages,
    {
      role: 'user',
      content:
        'You were just invited into this group chat. Send your first natural in-group reaction in 1 to 2 short bubbles. Do not write narration, do not act overly formal, and do not summarize the whole group dynamic.',
    },
  ];
}

function buildInviteGenerationHistory(history: ChatMessage[], invitedName: string, timestamp: number): ChatMessage[] {
  const recentVisibleMessages = history
    .filter((message) => !message.isSystem)
    .slice(-6)
    .map((message) => ({
      ...message,
      text: formatMessagePreview(message.text),
    }));

  return [
    ...recentVisibleMessages,
    {
      role: 'model',
      text: `[notice] 你邀请了${invitedName}进群`,
      timestamp,
      isSystem: true,
    },
  ];
}

function normalizeInvitedReply(text: string, speaker: Character): string {
  let normalized = text.trim();
  const aliases = [speaker.name, speaker.remarkName?.trim()].filter((value): value is string => !!value);

  for (const alias of aliases) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(new RegExp(`^${escapedAlias}\\s*[:：]\\s*`), '').trim();
  }

  return normalized.replace(/^["'`\u201c\u201d\u2018\u2019]+|["'`\u201c\u201d\u2018\u2019]+$/g, '').trim();
}

const formatMessagePreview = (text: string | undefined): string => {
  if (!text) return '';
  if (text.startsWith('[notice]')) {
    return text.replace(/^\[notice\]\s*/i, '').trim();
  }
  if (text.startsWith('[audio]')) {
    return '[语音]';
  }
  if (text.startsWith('[sticker]')) {
    return text.replace(/^\[sticker\]\s*/i, '').trim();
  }
  if (text.startsWith('[GAME_CARD]')) {
    return '[游戏卡片]';
  }
  return text;
};

const stripVisualMessageMarker = (text: string) => (
  text.replace(/^\[(?:sticker|image|audio|表情包|图片|语音)\]\s*/i, '').trim()
);

function formatPendingGroupText(text: string): string {
  return stripAssistantSpeakerPrefix(text, []);
}

function stripSenderPrefix(text: string, aliases: string[]): string {
  return stripAssistantSpeakerPrefix(text, aliases);
}

function parseSenderLabel(text: string): { senderLabel: string; content: string } | null {
  return parseAssistantSpeakerLabel(text);
}

function GroupMessageAvatar({
  value,
  fallbackValue,
  alt,
  fit = 'cover',
}: {
  value?: string | null;
  fallbackValue?: string | null;
  alt: string;
  fit?: 'cover' | 'contain';
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const { resolvedUrl: resolvedFallbackUrl } = useResolvedPersistentValue(fallbackValue);
  const [hasError, setHasError] = useState(false);
  const src =
    getDisplayableAssetValue(value, resolvedUrl)
    || getDisplayableAssetValue(fallbackValue, resolvedFallbackUrl)
    || null;

  useEffect(() => {
    setHasError(false);
  }, [src, value, fallbackValue]);

  if (!src || hasError) {
    return <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-200" aria-label={alt} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`h-10 w-10 shrink-0 rounded-full border border-zinc-200 shadow-[0_2px_6px_rgba(15,23,42,0.05)] ${fit === 'contain' ? 'bg-white p-0.5 object-contain' : 'bg-zinc-200 object-cover'}`}
      onError={() => setHasError(true)}
    />
  );
}

function GroupStickerPreview({
  value,
  alt,
}: {
  value: string;
  alt: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl) || value;

  return <img src={src} alt={alt} className="h-full w-full object-cover" />;
}

function GroupMessageImage({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl);

  if (!src) return null;

  return <img src={src} alt={alt} className={className} />;
}

function GroupBubbleResolvedImageStyle({
  value,
  children,
}: {
  value?: string | null;
  children: (resolvedImageUrl?: string) => React.ReactNode;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const resolvedImageUrl = getDisplayableAssetValue(value, resolvedUrl) || undefined;
  return <>{children(resolvedImageUrl)}</>;
}

function isStickerMessage(message: ChatMessage, content: string) {
  if (!message.imageUrl) {
    return false;
  }

  if (typeof message.stickerLabel === 'string' && message.stickerLabel.trim().length > 0) {
    return true;
  }

  const normalizedText = message.text.trim();
  const normalizedContent = content.trim();
  return /(?:^|[:：]\s*)\[(?:sticker|表情包)\]/i.test(normalizedText)
    || /^\[(?:sticker|表情包)\]/i.test(normalizedContent);
}

function getReadableTextColor(backgroundColor: string): string {
  const normalized = backgroundColor.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return '#111827';
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.72 ? '#111827' : '#ffffff';
}

function BubbleThemeAnchors() {
  return (
    <>
      <span aria-hidden="true" className="corner bubble-corner tl pointer-events-none absolute" />
      <span aria-hidden="true" className="corner bubble-corner tr pointer-events-none absolute" />
      <span aria-hidden="true" className="corner bubble-corner bl pointer-events-none absolute" />
      <span aria-hidden="true" className="corner bubble-corner br pointer-events-none absolute" />
      <span aria-hidden="true" className="sticker-skull bubble-sticker-skull pointer-events-none absolute" />
    </>
  );
}

export function GroupChatSessionScreen({
  group,
  members,
  availableCustomStickers,
  history,
  favorites,
  setFavorites,
  setHistory,
  onUpdateGroup,
  onLeaveGroup,
  onClearHistory,
  onBack,
  userAvatar,
  userName,
  settings,
  worldBooks = [],
  perception,
  directChatHistory,
  inviteableCharacters,
}: {
  group: ChatGroup;
  members: Character[];
  availableCustomStickers: string[];
  history: ChatMessage[];
  favorites: FavoriteMessage[];
  setFavorites: (favorites: FavoriteMessage[]) => void;
  setHistory: Dispatch<SetStateAction<ChatMessage[]>>;
  onUpdateGroup: (patch: Partial<ChatGroup>) => void;
  onLeaveGroup: () => void;
  onClearHistory: () => void;
  onBack: () => void;
  userAvatar: string;
  userName: string;
  settings: AppSettings;
  worldBooks: WorldBookEntry[];
  perception?: PerceptionSettings;
  directChatHistory: ChatHistory;
  inviteableCharacters: Character[];
}) {
  const [input, setInput] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage['replyTo'] | null>(null);
  const [pendingShare, setPendingShare] = useState<ShareActionResult['payload'] | null>(null);
  const [showFunPanel, setShowFunPanel] = useState(false);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [stickerTab, setStickerTab] = useState<'basic' | 'custom'>('basic');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [isInvitingMember, setIsInvitingMember] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);
  const [isUpdatingBadge, setIsUpdatingBadge] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [highlightedMessageTarget, setHighlightedMessageTarget] = useState<{
    timestamp: number;
    text: string;
  } | null>(null);
  const [groupSettingsForm, setGroupSettingsForm] = useState(() => createGroupSettingsFormState(group));
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
    messageTimestamp: number;
    messageRole: ChatMessage['role'];
    messageText: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const preservedScrollTopRef = useRef<number | null>(null);
  const didTryOpeningRef = useRef(false);
  const previousSettingsOpenRef = useRef(false);
  const previousSettingsGroupIdRef = useRef(group.id);
  const latestGroupBackgroundRef = useRef(group.groupBackground || '');
  const longPressTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { getCharacterById, getCharacterByName } = createCharacterDirectory({ characters: members });
  const activeConfig = settings.configs.find((config) => config.id === settings.activeConfigId) || settings.configs[0];
  const hasUsableConfig = !!activeConfig?.apiKey?.trim();
  const layoutConfig = getChatLayoutConfig();
  const inputContainerClass = layoutConfig.inputContainerClass.replace('border-t', '').trim();
  const participantCount = members.length + 1;
  const actingRole = resolveGroupMemberRole(group, 'user');
  const openingSessionKey = `${group.id}:${group.lastTime || 0}`;
  const hasGroupInfoChanges = hasGroupSettingsChanges(group, groupSettingsForm);
  const groupDisplayName = group.groupRemark?.trim() || group.name;
  const groupUserDisplayName = group.groupNickname?.trim() || userName;
  const groupNotice = group.groupNotice?.trim() || '';
  const { resolvedUrl: resolvedGroupBackgroundUrl } = useResolvedPersistentValue(group.groupBackground);
  const groupBackgroundUrl = getDisplayableAssetValue(group.groupBackground, resolvedGroupBackgroundUrl);
  const headerStyleType = group.headerStyle || 'default';
  const headerOpacity = group.headerOpacity ?? 0.92;
  const footerStyleType = group.footerStyle || 'default';
  const footerOpacity = group.footerOpacity ?? 0.92;
  const [isNoticeVisible, setIsNoticeVisible] = useState(() => !!groupNotice);
  const hasSharedBubbleTheme = hasBubbleThemeCss(settings.visualSettings?.chat?.bubbleStyleCss);
  const hasGroupRoleTheme = hasBubbleThemeCss(settings.visualSettings?.chat?.modelBubbleStyleCss);
  const hasGroupUserTheme = hasBubbleThemeCss(settings.visualSettings?.chat?.userBubbleStyleCss);
  const sharedBubbleStyle = sanitizeBubbleSurfaceStyle(parseBubbleStyleCss(settings.visualSettings?.chat?.bubbleStyleCss));
  const groupRoleBubbleStyle = sanitizeBubbleSurfaceStyle(parseBubbleStyleCss(settings.visualSettings?.chat?.modelBubbleStyleCss));
  const groupUserBubbleStyle = sanitizeBubbleSurfaceStyle(parseBubbleStyleCss(settings.visualSettings?.chat?.userBubbleStyleCss));
  const groupBubbleThemeCss = buildScopedBubbleThemeCss(settings.visualSettings?.chat?.bubbleStyleCss, '.chat-bubble-theme-scope');
  const groupModelBubbleThemeCss = buildScopedBubbleVariantCss(
    settings.visualSettings?.chat?.modelBubbleStyleCss,
    '.chat-bubble-theme-scope',
    '.bot-bubble',
  );
  const groupUserBubbleThemeCss = buildScopedBubbleVariantCss(
    settings.visualSettings?.chat?.userBubbleStyleCss,
    '.chat-bubble-theme-scope',
    '.user-bubble',
  );
  const buildGroupCharacterBubbleThemeCss = (characters: Character[]) => characters
    .map((member) => {
      const scopedSelector = `.chat-bubble-theme-scope [data-character-bubble-scope="${member.id}"]`;
      return buildScopedElementThemeCss(
        member.bubbleStyleCss,
        scopedSelector,
        ['.chat-bubble', '.message-bubble', '.bot-bubble', '.left', '.chat-bubble-left'],
      );
    })
    .filter(Boolean)
    .join('\n\n');
  const getGroupBubbleTextStyle = (params: {
    isUser: boolean;
    senderBubbleStyleCss?: string;
  }): React.CSSProperties => ({
    ...extractBubbleTextStyle(parseBubbleStyleCss(settings.visualSettings?.chat?.bubbleStyleCss)),
    ...extractBubbleTextStyle(parseBubbleStyleCss(
      params.isUser ? settings.visualSettings?.chat?.userBubbleStyleCss : settings.visualSettings?.chat?.modelBubbleStyleCss,
    )),
    ...extractBubbleTextStyle(parseBubbleStyleCss(params.senderBubbleStyleCss)),
  });
  const groupSettingsMembers = [
    { id: 'user', name: groupUserDisplayName, avatar: userAvatar, remarkName: undefined, role: actingRole },
    ...members.map((member) => ({
      id: member.id,
      name: member.name,
      remarkName: member.remarkName,
      avatar: member.avatar,
      role: resolveGroupMemberRole(group, member.id),
      badgeLabel: getGroupMemberBadge(group, member.id)?.label,
      badgeColor: getGroupMemberBadge(group, member.id)?.color,
      bubbleColor: getGroupMemberBubbleColor(group, member.id) || undefined,
    })),
  ];
  const groupSettingsInviteCandidates = inviteableCharacters.map((character) => ({
    id: character.id,
    name: character.name,
    remarkName: character.remarkName,
    avatar: character.avatar,
    role: 'member' as const,
    badgeLabel: undefined,
    badgeColor: undefined,
    bubbleColor: undefined,
  }));
  const mentionMatch = input.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = mentionMatch?.[1] ?? '';
  const mentionCandidates = mentionMatch
    ? members.filter((member) => {
        const aliases = [member.name, member.remarkName?.trim()].filter((value): value is string => !!value);
        return aliases.some((alias) => alias.toLowerCase().includes(mentionQuery.toLowerCase()));
      })
    : [];
  const showMentionPicker = mentionMatch !== null && mentionCandidates.length > 0;
  const showChatTimeDividers = settings.showChatTimeDividers ?? true;
  const showChatMessageTime = settings.showChatMessageTime ?? true;
  const chatFontFamily = getThemeSelectedFontStack(settings.visualSettings?.themeTypography);
  const chatTextStyle = chatFontFamily ? { fontFamily: chatFontFamily } : undefined;
  const groupChatFontCss = chatFontFamily
    ? `.chat-bubble-theme-scope .chat-bubble,
.chat-bubble-theme-scope .chat-bubble *,
.chat-bubble-theme-scope .chat-loading-bubble,
.chat-bubble-theme-scope .chat-loading-bubble *,
.chat-bubble-theme-scope .chat-session-header,
.chat-bubble-theme-scope .chat-session-header *,
.chat-bubble-theme-scope .chat-session-footer,
.chat-bubble-theme-scope .chat-session-footer * {
  font-family: ${chatFontFamily} !important;
}`
    : '';
  let groupHeaderClassName = 'relative z-10 flex min-h-[64px] items-center justify-between border-b px-4 pb-3 pt-12 shadow-sm';
  const groupHeaderStyle: React.CSSProperties = {};
  const getDefaultGroupBubbleSurfaceStyle = (params: {
    isUser: boolean;
    shouldUseDefaultSurface: boolean;
  }): React.CSSProperties => {
    if (!params.shouldUseDefaultSurface) {
      return {};
    }

    const chatOpacity = settings.visualSettings?.chatOpacity ?? 0.9;
    const hasBackground = Boolean(groupBackgroundUrl);

    return {
      borderRadius: 16,
      borderTopRightRadius: params.isUser ? 6 : 16,
      borderTopLeftRadius: params.isUser ? 16 : 6,
      boxShadow: params.isUser
        ? '0 10px 24px rgba(59, 130, 246, 0.18)'
        : '0 10px 24px rgba(15, 23, 42, 0.08)',
      backgroundColor: params.isUser
        ? (settings.visualSettings?.chat?.messageBackgroundColorUser
            || `rgba(59, 130, 246, ${hasBackground ? chatOpacity : 1})`)
        : (settings.visualSettings?.chat?.messageBackgroundColorModel
            || `rgba(255, 255, 255, ${hasBackground ? chatOpacity : 1})`),
      borderColor: params.isUser
        ? (settings.visualSettings?.chat?.messageBackgroundColorUser
            || `rgba(59, 130, 246, ${hasBackground ? chatOpacity : 1})`)
        : `rgba(228, 228, 231, ${hasBackground ? chatOpacity : 1})`,
    };
  };

  if (headerStyleType === 'default') {
    groupHeaderClassName += ' border-zinc-100 backdrop-blur-md';
    groupHeaderStyle.backgroundColor = `rgba(255, 255, 255, ${headerOpacity})`;
  } else if (headerStyleType === 'glass') {
    groupHeaderClassName += ' border-white/40 backdrop-blur-xl';
    groupHeaderStyle.backgroundColor = `rgba(255, 255, 255, ${headerOpacity})`;
  } else if (headerStyleType === 'solid') {
    groupHeaderClassName += ' border-zinc-200';
    groupHeaderStyle.backgroundColor = `rgba(244, 244, 245, ${headerOpacity})`;
  } else {
    groupHeaderClassName += ' border-transparent bg-transparent';
    groupHeaderStyle.backgroundColor = `rgba(255, 255, 255, ${Math.max(0, headerOpacity - 0.2)})`;
    groupHeaderStyle.boxShadow = 'none';
  }

  let groupFooterClassName = `${inputContainerClass} relative z-10`;
  const groupFooterStyle: React.CSSProperties = {};
  let groupFooterControlTone = {
    iconButton: 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100',
    inputShell: 'bg-zinc-50 border-zinc-100',
    voiceButton: 'bg-zinc-100 text-zinc-500',
  };

  if (footerStyleType === 'default') {
    groupFooterStyle.backgroundColor = `rgba(255, 255, 255, ${footerOpacity})`;
    groupFooterStyle.borderColor = '#e4e4e7';
  } else if (footerStyleType === 'glass') {
    groupFooterClassName = groupFooterClassName.replace('backdrop-blur-md', 'backdrop-blur-xl');
    groupFooterStyle.backgroundColor = `rgba(255, 255, 255, ${footerOpacity})`;
    groupFooterStyle.borderColor = 'rgba(255, 255, 255, 0.36)';
    groupFooterControlTone = {
      iconButton: 'bg-white/75 text-zinc-700 hover:bg-white/90',
      inputShell: 'bg-white/72 border-white/50',
      voiceButton: 'bg-white/72 text-zinc-700',
    };
  } else if (footerStyleType === 'solid') {
    groupFooterClassName = groupFooterClassName.replace('backdrop-blur-md', '');
    groupFooterStyle.backgroundColor = `rgba(244, 244, 245, ${footerOpacity})`;
    groupFooterStyle.borderColor = '#e4e4e7';
    groupFooterControlTone = {
      iconButton: 'bg-white text-zinc-600 hover:bg-zinc-100',
      inputShell: 'bg-white border-zinc-200',
      voiceButton: 'bg-white text-zinc-600',
    };
  } else {
    groupFooterClassName = groupFooterClassName.replace('backdrop-blur-md', '');
    groupFooterStyle.backgroundColor = `rgba(255, 255, 255, ${Math.max(0, footerOpacity - 0.2)})`;
    groupFooterStyle.borderColor = 'transparent';
    groupFooterControlTone = {
      iconButton: 'bg-white/78 text-zinc-700 hover:bg-white/90',
      inputShell: 'bg-white/78 border-white/55',
      voiceButton: 'bg-white/78 text-zinc-700',
    };
  }

  const {
    isLoading,
    error,
    pendingMessage,
    sendText,
    sendImageMessage,
    sendAudioMessage,
    sendStickerMessage,
    sendLocationMessage,
    maybeOpenScene,
    reactToNoticeUpdate,
  } = useGroupChatRuntime({
    members,
    worldBooks,
    groupMeta: {
      lastMessage: group.lastMessage,
      lastTime: group.lastTime,
      groupStage: group.groupStage,
      activeWorldBookIds: group.activeWorldBookIds,
      memberRelationSeeds: group.memberRelationSeeds,
      backgroundSummary: group.backgroundSummary,
      memberRelationshipState: group.memberRelationshipState,
      memberRelationshipNote: group.memberRelationshipNote,
      currentScene: group.currentScene,
      publicFacts: group.publicFacts,
    },
    history,
    setHistory,
    input,
    setInput,
    replyingTo,
    setReplyingTo,
    userName: groupUserDisplayName,
    directChatHistory,
    perception,
    activeConfig,
  });
  const { isRecording, startRecording, stopRecording, cancelRecording } = useAudioMessageRecorder({
    onRecorded: async ({ blob, durationMs }) => {
      const audioRef = await saveUploadedBlob(blob, {
        fileName: `group-voice-message-${Date.now()}.wav`,
        mimeType: 'audio/wav',
      });
      await sendAudioMessage(audioRef, 'audio/wav', Math.max(1, Math.round(durationMs / 1000)));
      setShowFunPanel(false);
    },
  });
  const audioRecordInteraction = usePressToRecordInteraction({
    isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
  });
  const renderedHistory = pendingMessage
    ? [...history, {
        role: 'model' as const,
        text: `${pendingMessage.speakerName}: ${formatPendingGroupText(pendingMessage.text)}`,
        timestamp: pendingMessage.timestamp,
        senderCharacterId: pendingMessage.speakerId,
        isPending: true,
      }]
    : history;

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    if (preservedScrollTopRef.current !== null) {
      const nextTop = Math.min(
        preservedScrollTopRef.current,
        Math.max(0, scrollRef.current.scrollHeight - scrollRef.current.clientHeight)
      );
      scrollRef.current.scrollTop = nextTop;
      preservedScrollTopRef.current = null;
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  useEffect(() => {
    if (!highlightedMessageTarget || !scrollRef.current) {
      return;
    }

    const selector = `[data-message-timestamp="${highlightedMessageTarget.timestamp}"]`;
    const candidates = Array.from(
      scrollRef.current.querySelectorAll<HTMLElement>(selector),
    );
    const targetNode = candidates.find(
      (node) => node.dataset.messageText === highlightedMessageTarget.text,
    ) || candidates[0];

    if (!targetNode) {
      return;
    }

    targetNode.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const timeoutId = window.setTimeout(() => {
      setHighlightedMessageTarget((current) => (
        current
        && current.timestamp === highlightedMessageTarget.timestamp
        && current.text === highlightedMessageTarget.text
          ? null
          : current
      ));
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedMessageTarget, history]);

  useEffect(() => {
    didTryOpeningRef.current = false;
  }, [openingSessionKey]);

  useEffect(() => {
    if (didTryOpeningRef.current || !hasUsableConfig || members.length === 0) return;

    const lastAttemptAt = autoOpeningAttemptAtBySessionKey.get(openingSessionKey) || 0;
    const now = Date.now();
    if (now - lastAttemptAt < AUTO_OPENING_DEDUPE_WINDOW_MS) {
      didTryOpeningRef.current = true;
      return;
    }

    autoOpeningAttemptAtBySessionKey.set(openingSessionKey, now);
    didTryOpeningRef.current = true;
    void maybeOpenScene();
  }, [hasUsableConfig, maybeOpenScene, members.length, openingSessionKey]);

  useEffect(() => {
    const didJustOpen = showGroupSettings && !previousSettingsOpenRef.current;
    const switchedGroup = previousSettingsGroupIdRef.current !== group.id;

    if (didJustOpen || switchedGroup) {
      setGroupSettingsForm(createGroupSettingsFormState(group));
      latestGroupBackgroundRef.current = group.groupBackground || '';
    }

    previousSettingsOpenRef.current = showGroupSettings;
    previousSettingsGroupIdRef.current = group.id;
  }, [group, showGroupSettings]);

  useEffect(() => {
    if (!groupNotice) {
      setIsNoticeVisible(false);
      return;
    }

    try {
      const dismissed = localStorage.getItem(buildGroupNoticeDismissKey(group.id, groupNotice)) === '1';
      setIsNoticeVisible(!dismissed);
    } catch {
      setIsNoticeVisible(true);
    }
  }, [group.id, groupNotice]);

  useEffect(() => {
    const repairedHistory = history.map((message) => {
      if (message.role !== 'model' || message.isSystem || message.senderCharacterId) {
        return message;
      }

      const parsedSender = parseSenderLabel(message.text);
      if (!parsedSender) {
        return message;
      }

      const character = getCharacterByName(parsedSender.senderLabel);
      if (!character) {
        return message;
      }

      return {
        ...message,
        senderCharacterId: character.id,
      };
    });

    const needsRepair = repairedHistory.some((message, index) => message !== history[index]);
    if (needsRepair) {
      setHistory(repairedHistory);
    }
  }, [getCharacterByName, history, setHistory]);

  const resolveSender = (message: ChatMessage) => {
    if (message.role === 'user') {
      return {
        senderId: 'user',
        senderName: groupUserDisplayName,
        avatar: userAvatar,
        content: formatMessagePreview(message.text),
        badge: null,
        roleLabel: getGroupRoleLabel(actingRole),
      };
    }

    const sender = message.senderCharacterId ? getCharacterById(message.senderCharacterId) : null;
    if (sender) {
      const senderName = sender.remarkName?.trim() || sender.name;
      const senderAliases = [sender.name, sender.remarkName?.trim()].filter((value): value is string => !!value);
      const contentWithoutPrefix = senderAliases.reduce((currentText, alias) => {
        if (currentText !== message.text) return currentText;
        const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return currentText.replace(new RegExp(`^${escapedAlias}\\s*[:：]\\s*`), '');
      }, message.text);
      return {
        senderId: sender.id,
        senderName,
        avatar: sender.avatar,
        content: formatMessagePreview(contentWithoutPrefix),
        badge: getGroupMemberBadge(group, sender.id),
        bubbleColor: getGroupMemberBubbleColor(group, sender.id),
        roleLabel: getGroupRoleLabel(resolveGroupMemberRole(group, sender.id)),
      };
    }

    const match = message.text.match(/^([^:：]+)\s*[:：]\s*(.*)$/);
    if (match) {
      const senderLabel = match[1].trim();
      const character = getCharacterByName(senderLabel);
      return {
        senderId: character?.id || `parsed:${senderLabel}`,
        senderName: character?.remarkName?.trim() || character?.name || senderLabel,
        avatar: character?.avatar || '',
        content: formatMessagePreview(match[2]),
        badge: character ? getGroupMemberBadge(group, character.id) : null,
        bubbleColor: character ? getGroupMemberBubbleColor(group, character.id) : null,
        roleLabel: character ? getGroupRoleLabel(resolveGroupMemberRole(group, character.id)) : undefined,
      };
    }

    return {
      senderId: `unknown:${message.timestamp}:${message.text}`,
      senderName: '群成员',
      avatar: '',
      content: formatMessagePreview(message.text),
      badge: null,
      bubbleColor: null,
      roleLabel: undefined,
    };
  };

  const resolveSenderInfo = (message: ChatMessage) => {
    if (message.role === 'user') {
      return {
        senderId: 'user',
        senderName: groupUserDisplayName,
        avatar: userAvatar,
        content: formatMessagePreview(message.text),
        badge: null,
        bubbleColor: null,
        roleLabel: getGroupRoleLabel(actingRole),
        character: null as Character | null,
      };
    }

    const sender = message.senderCharacterId ? getCharacterById(message.senderCharacterId) : null;
    if (sender) {
      const senderName = sender.remarkName?.trim() || sender.name;
      const senderAliases = [sender.name, sender.remarkName?.trim()].filter((value): value is string => !!value);
      return {
        senderId: sender.id,
        senderName,
        avatar: sender.avatar,
        content: formatMessagePreview(stripSenderPrefix(message.text, senderAliases)),
        badge: getGroupMemberBadge(group, sender.id),
        bubbleColor: getGroupMemberBubbleColor(group, sender.id),
        roleLabel: getGroupRoleLabel(resolveGroupMemberRole(group, sender.id)),
        character: sender,
      };
    }

    const parsedSender = parseSenderLabel(message.text);
    if (parsedSender) {
      const character = getCharacterByName(parsedSender.senderLabel);
      return {
        senderId: character?.id || `parsed:${parsedSender.senderLabel}`,
        senderName: character?.remarkName?.trim() || character?.name || parsedSender.senderLabel,
        avatar: character?.avatar || '',
        content: formatMessagePreview(parsedSender.content),
        badge: character ? getGroupMemberBadge(group, character.id) : null,
        bubbleColor: character ? getGroupMemberBubbleColor(group, character.id) : null,
        roleLabel: character ? getGroupRoleLabel(resolveGroupMemberRole(group, character.id)) : undefined,
        character: character || null,
      };
    }

    return {
      senderId: `unknown:${message.timestamp}:${message.text}`,
      senderName: '群成员',
      avatar: '',
      content: formatMessagePreview(message.text),
      badge: null,
      bubbleColor: null,
      roleLabel: undefined,
      character: null as Character | null,
    };
  };

  const themeCharacterById = new Map<string, Character>();
  members.forEach((member) => {
    themeCharacterById.set(member.id, member);
  });
  renderedHistory.forEach((message) => {
    const resolved = resolveSenderInfo(message);
    if (resolved.character?.id) {
      themeCharacterById.set(resolved.character.id, resolved.character);
    }
  });
  const groupCharacterBubbleThemeCss = buildGroupCharacterBubbleThemeCss(Array.from(themeCharacterById.values()));

  const getContextMenuMessageIndex = () => {
    if (!contextMenu) {
      return -1;
    }

    const matchesContextMenuMessage = (message: ChatMessage | undefined) =>
      !!message
      && message.timestamp === contextMenu.messageTimestamp
      && message.role === contextMenu.messageRole
      && message.text === contextMenu.messageText;

    if (matchesContextMenuMessage(history[contextMenu.index])) {
      return contextMenu.index;
    }

    return history.findIndex(matchesContextMenuMessage);
  };

  const contextMenuMessageIndex = getContextMenuMessageIndex();
  const contextMenuMessage = contextMenuMessageIndex >= 0 ? history[contextMenuMessageIndex] : null;

  const openContextMenu = (event: { clientX: number; clientY: number }, index: number) => {
    const container = document.getElementById('phone-container');
    const targetMessage = history[index];
    if (!targetMessage || targetMessage.isRecalled) return;

    setContextMenu({
      ...getContextMenuPosition({
        containerRect: container?.getBoundingClientRect(),
        clickX: event.clientX,
        clickY: event.clientY,
        index,
      }),
      messageTimestamp: targetMessage.timestamp,
      messageRole: targetMessage.role,
      messageText: targetMessage.text,
    });
  };

  const handleMessageClick = (event: React.MouseEvent, index: number) => {
    event.preventDefault();
    openContextMenu(event, index);
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleRecall = () => {
    if (!contextMenuMessage || contextMenuMessageIndex < 0 || contextMenuMessage.role !== 'user') {
      closeContextMenu();
      return;
    }

    preservedScrollTopRef.current = scrollRef.current?.scrollTop ?? null;
    setHistory(
      history.map((message, index) => (
        index === contextMenuMessageIndex
          ? { ...message, isRecalled: true }
          : message
      )),
    );
    closeContextMenu();
  };

  const handleCopy = async () => {
    if (!contextMenuMessage) {
      closeContextMenu();
      return;
    }

    const result = await copyMessageText(contextMenuMessage);
    closeContextMenu();
    if (!result.ok) {
      alert(result.message);
    }
  };

  const handleQuoteReply = () => {
    if (!contextMenuMessage) {
      closeContextMenu();
      return;
    }

    const authorLabel = contextMenuMessage.role === 'user'
      ? groupUserDisplayName
      : resolveSender(contextMenuMessage).senderName;
    setReplyingTo(createQuoteReplyPayload(contextMenuMessage, {
      userLabel: groupUserDisplayName,
      modelLabel: authorLabel,
    }));
    closeContextMenu();
  };

  const handleFavorite = () => {
    if (!contextMenuMessage || contextMenuMessageIndex < 0) {
      closeContextMenu();
      return;
    }

    const result = toggleFavoriteMessage(contextMenuMessage, favorites, {
      id: group.id,
      name: groupDisplayName,
    });

    setFavorites(result.favorites);
    setHistory(
      history.map((message, index) => (index === contextMenuMessageIndex ? result.updatedMessage : message))
    );
    closeContextMenu();
  };

  const handleShare = () => {
    if (!contextMenuMessage) {
      closeContextMenu();
      return;
    }

    const payload = createShareAction(contextMenuMessage);
    setPendingShare(payload.payload);
    closeContextMenu();
  };

  const handleDelete = () => {
    if (!contextMenuMessage || contextMenuMessageIndex < 0) {
      closeContextMenu();
      return;
    }

    setHistory(deleteMessageAtIndex(history, contextMenuMessageIndex));
    closeContextMenu();
  };

  const deleteMessageByIndex = (messageIndex: number) => {
    if (messageIndex < 0) {
      return;
    }

    preservedScrollTopRef.current = scrollRef.current?.scrollTop ?? null;
    setHistory((prev) => deleteMessageAtIndex(prev, messageIndex));
    if (contextMenuMessageIndex === messageIndex) {
      closeContextMenu();
    }
  };

  const handleForward = () => {
    if (!contextMenuMessage) {
      closeContextMenu();
      return;
    }

    setInput((prev) => `${prev}${prev ? '\n' : ''}${createForwardText(contextMenuMessage)}`);
    closeContextMenu();
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      void sendImageMessage(base64String);
      setShowFunPanel(false);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGroupAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setGroupSettingsForm((prev) => ({
        ...prev,
        avatar: (reader.result as string) || '',
      }));
    };
    reader.readAsDataURL(file);

    if (groupAvatarInputRef.current) {
      groupAvatarInputRef.current.value = '';
    }
  };

  const handleCustomStickerSend = (sticker: string) => {
    void sendStickerMessage(sticker);
    setShowEmojiPanel(false);
    setStickerTab('basic');
  };

  const handleMentionInsert = (member: Character) => {
    setInput((prev) => prev.replace(/@([^\s@]*)$/, `@${member.name} `));
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleSaveGroupInfo = () => {
    const trimmedName = groupSettingsForm.name.trim();
    if (!trimmedName) return;

    const nextNotice = groupSettingsForm.groupNotice.trim();
    const previousNotice = group.groupNotice?.trim() || '';
    const systemMessages = buildGroupSettingsSystemMessages(group, groupSettingsForm, Date.now());
    onUpdateGroup(buildGroupSettingsPatch({
      ...groupSettingsForm,
      groupBackground: latestGroupBackgroundRef.current,
    }));
    if (systemMessages.length > 0) {
      setHistory((prev) => [...prev, ...systemMessages]);
    }
    if (nextNotice && nextNotice !== previousNotice) {
      void reactToNoticeUpdate({
        noticeText: nextNotice,
        currentHistory: [...history, ...systemMessages],
      });
    }
  };

  const handleCloseGroupSettings = () => {
    if (hasGroupInfoChanges && groupSettingsForm.name.trim()) {
      handleSaveGroupInfo();
    }
    setShowGroupSettings(false);
  };

  const handleUpdateGroupBackground = (value: string) => {
    latestGroupBackgroundRef.current = value;
    setGroupSettingsForm((prev) => ({
      ...prev,
      groupBackground: value,
    }));
    onUpdateGroup({
      groupBackground: value.trim() ? value : undefined,
    });
  };

  const handleInviteMember = async (memberId: string) => {
    const invitedCharacter = inviteableCharacters.find((character) => character.id === memberId);
    if (!invitedCharacter || group.memberIds.includes(memberId) || isInvitingMember) {
      return;
    }

    setIsInvitingMember(true);

    onUpdateGroup({
      memberIds: [...group.memberIds, memberId],
    });

    const invitedName = invitedCharacter.remarkName?.trim() || invitedCharacter.name;
    const timestamp = Date.now();
    const noticeMessage = createInviteMemberSystemMessage(invitedName, timestamp);
    const inviteGenerationHistory = buildInviteGenerationHistory(history, invitedName, timestamp);

    setHistory((prev) => [
      ...prev,
      noticeMessage,
    ]);

    if (!activeConfig) {
      setIsInvitingMember(false);
      return;
    }

    try {
      const responseText = await generateTextFromMessagesWithConfig({
        activeConfig,
        messages: buildInviteRuntimeMessages({
          systemPrompt: buildGroupChatPrompt({
            sceneInput: buildGroupChatSceneInput({
              speaker: invitedCharacter,
              members: [...members, invitedCharacter],
              group: {
                ...group,
                memberIds: [...group.memberIds, invitedCharacter.id],
              },
              userName: groupUserDisplayName,
              history: inviteGenerationHistory,
              mode: 'invited',
              activeWorldBooks: selectActiveGroupWorldBooks({
                speaker: invitedCharacter,
                group: {
                  activeWorldBookIds: group.activeWorldBookIds,
                },
                worldBooks,
              }),
              directChatHistory,
            }),
          }),
          history: inviteGenerationHistory,
        }),
        temperature: 0.7,
      });

      const normalizedReply = normalizeInvitedReply(responseText, invitedCharacter);
      if (!normalizedReply) {
        return;
      }

      setHistory((prev) => [
        ...prev,
        {
          role: 'model',
          text: `${invitedCharacter.name}: ${normalizedReply}`,
          timestamp: timestamp + 1,
          senderCharacterId: invitedCharacter.id,
        },
      ]);
    } catch (error) {
      console.error('Failed to generate invited member reply:', error);
    } finally {
      setIsInvitingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const member = members.find((item) => item.id === memberId);
    if (!member || isRemovingMember || !canManageGroupMembers(group, 'user') || isProtectedGroupMember(group, memberId)) {
      return;
    }

    const memberName = member.remarkName?.trim() || member.name;
    if (!window.confirm(`确认将 ${memberName} 移出当前群聊吗？`)) {
      return;
    }

    setIsRemovingMember(true);

    onUpdateGroup({
      memberIds: group.memberIds.filter((id) => id !== memberId),
      adminIds: (group.adminIds || []).filter((id) => id !== memberId),
    });

    setHistory((prev) => [
      ...prev,
      createRemoveMemberSystemMessage(memberName, Date.now()),
    ]);

    setIsRemovingMember(false);
  };

  const handleToggleAdmin = async (memberId: string) => {
    const member = members.find((item) => item.id === memberId);
    if (!member || isUpdatingAdmin || !canManageGroupAdmins(group, 'user') || isProtectedGroupMember(group, memberId)) {
      return;
    }

    const memberName = member.remarkName?.trim() || member.name;
    const isAdmin = (group.adminIds || []).includes(memberId);
    setIsUpdatingAdmin(true);

    onUpdateGroup({
      adminIds: isAdmin
        ? (group.adminIds || []).filter((id) => id !== memberId)
        : [...new Set([...(group.adminIds || []), memberId])],
    });

    setHistory((prev) => [
      ...prev,
      isAdmin
        ? createCancelAdminSystemMessage(memberName, Date.now())
        : createSetAdminSystemMessage(memberName, Date.now()),
    ]);

    setIsUpdatingAdmin(false);
  };

  const handleUpdateBadge = async (memberId: string, payload: { label: string; color: string }) => {
    const member = members.find((item) => item.id === memberId);
    if (!member || isUpdatingBadge || !canManageGroupMembers(group, 'user')) {
      return;
    }

    const memberName = member.remarkName?.trim() || member.name;
    const nextLabel = payload.label.trim();
    const nextColor = payload.color.trim() || '#22c55e';
    const currentBadges = group.memberBadges || [];
    const nextBadges = nextLabel
      ? [
          ...currentBadges.filter((badge) => badge.memberId !== memberId),
          { memberId, label: nextLabel, color: nextColor },
        ]
      : currentBadges.filter((badge) => badge.memberId !== memberId);

    setIsUpdatingBadge(true);
    onUpdateGroup({ memberBadges: nextBadges });
    setHistory((prev) => [
      ...prev,
      nextLabel
        ? createSetMemberBadgeSystemMessage(memberName, nextLabel, Date.now())
        : createClearMemberBadgeSystemMessage(memberName, Date.now()),
    ]);
    setIsUpdatingBadge(false);
  };

  const handleUpdateBubbleColor = async (memberId: string, color: string | null) => {
    const member = members.find((item) => item.id === memberId);
    if (!member) {
      return;
    }

    const currentColors = group.memberBubbleColors || [];
    const nextColors = color
      ? [
          ...currentColors.filter((item) => item.memberId !== memberId),
          { memberId, color },
        ]
      : currentColors.filter((item) => item.memberId !== memberId);

    onUpdateGroup({ memberBubbleColors: nextColors });
  };

  const handleLeaveCurrentGroup = () => {
    if (isLeavingGroup) {
      return;
    }

    setIsLeavingGroup(true);
    setHistory((prev) => [
      ...prev,
      createLeaveGroupSystemMessage(Date.now()),
    ]);

    window.setTimeout(() => {
      onLeaveGroup();
    }, 280);
  };

  const renderTextWithMentions = (text: string, variant: 'incoming' | 'outgoing' = 'incoming') => {
    const parts = text.split(/(@[^\s@]+)/g);
    return parts.map((part, index) => {
      if (!part.startsWith('@')) {
        return <span key={`${part}-${index}`}>{part}</span>;
      }

      return (
        <span
          key={`${part}-${index}`}
          className={variant === 'outgoing' ? 'font-semibold text-white/95' : 'font-medium text-blue-600'}
        >
          {part}
        </span>
      );
    });
  };

  const getMessageVisualKind = (message: ChatMessage, content: string) => {
    if (message.isSystem || content.startsWith('[notice]')) {
      return 'notice' as const;
    }

    if (isStickerMessage(message, content) || content.startsWith('[sticker]')) {
      return 'sticker' as const;
    }

    if (message.replyTo) {
      return 'reply' as const;
    }

    return 'normal' as const;
  };

  const getReadableMessageBody = (message: ChatMessage, content: string) => {
    if (message.imageUrl || message.audioUrl) {
      return '';
    }

    return content
      .replace(/^\[(?:sticker|notice)\]\s*/i, '')
      .trim();
  };

  const shouldBreakGroupedBubble = (params: {
    previousMessage?: ChatMessage;
    previousContent: string;
    currentMessage: ChatMessage;
    currentContent: string;
    streakIndex: number;
    previousVisualKind: 'notice' | 'sticker' | 'reply' | 'normal';
    currentVisualKind: 'notice' | 'sticker' | 'reply' | 'normal';
  }) => {
    const {
      previousMessage,
      previousContent,
      currentMessage,
      currentContent,
      streakIndex,
      previousVisualKind,
      currentVisualKind,
    } = params;

    if (!previousMessage) {
      return true;
    }

    if (currentVisualKind !== previousVisualKind) {
      return true;
    }

    if (currentVisualKind === 'reply' || previousVisualKind === 'reply') {
      return true;
    }

    if (currentMessage.imageUrl || previousMessage.imageUrl || currentMessage.audioUrl || previousMessage.audioUrl) {
      return true;
    }

    if (streakIndex >= 2) {
      return true;
    }

    const previousBody = getReadableMessageBody(previousMessage, previousContent);
    const currentBody = getReadableMessageBody(currentMessage, currentContent);
    const previousLength = previousBody.replace(/\s/g, '').length;
    const currentLength = currentBody.replace(/\s/g, '').length;
    const previousLooksReactive = previousLength > 0 && previousLength <= 8;
    const currentLooksReactive = currentLength > 0 && currentLength <= 8;
    const currentLooksIndependent = currentLength >= 13 || /[!?？！。]/.test(currentBody);
    const previousWasReply = !!previousMessage.replyTo;
    const currentWasReply = !!currentMessage.replyTo;
    const previousLooksLikeToneLine =
      /^(是吗|不是吧|好啊|行啊|这句|我在看|顺便确认|在等)(?:\s|$)/.test(previousBody);
    const previousLooksLikeStandaloneStatement =
      previousLength >= 9
      && /^(怎么|刚才|还没|老实说|既然|现在|这句|我在看)/.test(previousBody);
    const currentIsQuestionLike =
      /(?:有没有|是不是|要不要|行不行)$/.test(currentBody)
      || /[?？]$/.test(currentBody);
    const currentStartsFreshThought = /^(那个|这个|我们|我先|我看|我觉得|你们|还有|刚才|不过|反正|其实|顺便|毕竟|在等)/.test(currentBody);
    const currentIsStandaloneShortBeat = currentLooksReactive && /^(好啊|知道了|行吧|收到|可以|也行|对啊|在呢|来了|没事|别急)/.test(currentBody);

    if (previousLooksReactive && currentLooksIndependent) {
      return true;
    }

    if (previousWasReply && currentLength >= 7) {
      return true;
    }

    if (currentWasReply) {
      return true;
    }

    if (previousLooksLikeToneLine && currentIsQuestionLike) {
      return true;
    }

    if (previousLooksLikeStandaloneStatement && currentIsQuestionLike) {
      return true;
    }

    if (currentIsStandaloneShortBeat && streakIndex >= 1) {
      return true;
    }

    if (!currentLooksReactive && previousLength >= 12 && currentLength >= 10) {
      return true;
    }

    if (currentLooksIndependent && currentStartsFreshThought) {
      return true;
    }

    return false;
  };

  return (
    <div
      className="absolute inset-0 z-50 isolate flex flex-col overflow-hidden bg-zinc-50 chat-bubble-theme-scope"
      style={chatFontFamily ? { fontFamily: chatFontFamily } : undefined}
    >
      {(groupBubbleThemeCss || groupModelBubbleThemeCss || groupUserBubbleThemeCss || groupCharacterBubbleThemeCss || groupChatFontCss) && (
        <style>{[groupBubbleThemeCss, groupModelBubbleThemeCss, groupUserBubbleThemeCss, groupCharacterBubbleThemeCss, groupChatFontCss].filter(Boolean).join('\n\n')}</style>
      )}
      {groupBackgroundUrl ? (
        <>
          <img
            src={groupBackgroundUrl}
            alt="群聊天背景"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        </>
      ) : null}

      <div className={`chat-session-header chat-header ${groupHeaderClassName}`} style={groupHeaderStyle}>
        <div className="chat-header-leading flex items-center gap-2">
          <button onClick={onBack} className="chat-header-back-button p-1 -ml-1 text-zinc-400 active:text-zinc-600">
            <ChevronLeft size={24} className="chat-header-back-icon" />
          </button>
          <div className="chat-header-title-block flex flex-col">
            <h1 className="chat-header-title text-[16px] font-bold text-zinc-900">{groupDisplayName}</h1>
            <span className="chat-header-subtitle text-[11px] text-zinc-500">{participantCount} 人</span>
          </div>
        </div>
        <button onClick={() => setShowGroupSettings(true)} className="chat-header-action-button chat-header-settings-button p-2 text-zinc-400">
          <MoreVertical size={20} className="chat-header-settings-icon" />
        </button>
      </div>

      {groupNotice && isNoticeVisible && (
        <div className="relative z-10 border-b border-amber-200 bg-amber-50/95 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">群公告</div>
              <div className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-amber-900">
                {groupNotice}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsNoticeVisible(false);
                try {
                  localStorage.setItem(buildGroupNoticeDismissKey(group.id, groupNotice), '1');
                } catch {
                  // Ignore storage access issues for this lightweight UI state.
                }
              }}
              className="rounded-full p-1 text-amber-700/70 transition-colors hover:bg-amber-100 hover:text-amber-900"
              aria-label="关闭群公告"
              title="关闭群公告"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className={`${layoutConfig.messageListClass} relative z-10`} ref={scrollRef}>
        <div>
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-[13px] text-red-500">
            {error}
          </div>
        )}
        {renderedHistory.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const { senderId, senderName, avatar, content, badge, bubbleColor, roleLabel, character: senderCharacter } = resolveSenderInfo(msg);
          const visualKind = getMessageVisualKind(msg, content);
          const previousMessage = renderedHistory[idx - 1];
          const previousResolved = previousMessage ? resolveSenderInfo(previousMessage) : null;
          const previousVisualKind = previousMessage
            ? getMessageVisualKind(previousMessage, previousResolved?.content || '')
            : null;
          let sameSenderStreak = 0;
          for (let reverseIndex = idx - 1; reverseIndex >= 0; reverseIndex -= 1) {
            const streakMessage = renderedHistory[reverseIndex];
            if (
              streakMessage.isSystem
              || streakMessage.role !== msg.role
              || resolveSenderInfo(streakMessage).senderId !== senderId
            ) {
              break;
            }
            sameSenderStreak += 1;
          }

          const shouldShowIndependentBlock = !previousMessage || shouldBreakGroupedBubble({
            previousMessage,
            previousContent: previousResolved?.content || '',
            currentMessage: msg,
            currentContent: content,
            streakIndex: sameSenderStreak,
            previousVisualKind: previousVisualKind || 'normal',
            currentVisualKind: visualKind,
          });
          const isGroupedWithPrevious = !!previousMessage
            && !msg.isSystem
            && !previousMessage.isSystem
            && previousMessage.role === msg.role
            && previousResolved?.senderId === senderId
            && !shouldShowIndependentBlock;
          const shouldRenderTimeDivider = showChatTimeDividers && shouldShowChatTimeDivider(msg.timestamp, previousMessage?.timestamp);
          const groupReadCount = getGroupReadCount(renderedHistory, msg);

          const messageKey = `${msg.timestamp}-${msg.role}-${msg.senderCharacterId || senderId}-${idx}`;

          if (visualKind === 'notice') {
            return (
              <div key={messageKey}>
                {shouldRenderTimeDivider && (
                  <div className="mb-3 flex justify-center">
                    <div className="rounded-full bg-white/72 px-3 py-1 text-[11px] text-zinc-500 shadow-sm backdrop-blur-sm">
                      {formatChatDividerTime(msg.timestamp)}
                    </div>
                  </div>
                )}
                <div className="flex justify-center py-1">
                  <div className="chat-notice-card relative max-w-[88%] rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => deleteMessageByIndex(idx)}
                      className="absolute right-2 top-2 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                      aria-label="删除通知"
                      title="删除通知"
                    >
                      <X size={14} />
                    </button>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">NOTICE</div>
                    <div className="text-[14px] leading-6 text-zinc-700">{content.replace(/^\[notice\]\s*/i, '')}</div>
                  </div>
                </div>
              </div>
            );
          }

          const isPendingMessage = !!msg.isPending;

          const senderBubbleStyleCss = !isUser ? senderCharacter?.bubbleStyleCss : undefined;
          const hasSenderBubbleThemeCss = hasBubbleThemeCss(senderBubbleStyleCss);
          const senderBubbleStyle = sanitizeBubbleSurfaceStyle(parseBubbleStyleCss(senderBubbleStyleCss));
          const hasSenderBubbleCustomization = !!senderBubbleStyleCss?.trim();
          const senderBubbleColor = !isUser ? senderCharacter?.bubbleColor || undefined : undefined;
          const shouldUseCustomMemberBubble =
            !isUser
            && !msg.isSystem
            && !msg.imageUrl
            && visualKind !== 'sticker'
            && !isPendingMessage
            && !hasSenderBubbleCustomization
            && !senderCharacter?.bubbleImage
            && !senderBubbleColor
            && !!bubbleColor;
          const memberBubbleTextColor = shouldUseCustomMemberBubble ? getReadableTextColor(bubbleColor!) : '#111827';
          const memberBubbleStyle = shouldUseCustomMemberBubble
            ? {
                backgroundColor: bubbleColor!,
                borderColor: bubbleColor!,
                color: memberBubbleTextColor,
              }
            : undefined;

          return (
            <div key={messageKey}>
              {shouldRenderTimeDivider && (
                <div className="mb-3 flex justify-center">
                  <div className="rounded-full bg-white/72 px-3 py-1 text-[11px] text-zinc-500 shadow-sm backdrop-blur-sm">
                    {formatChatDividerTime(msg.timestamp)}
                  </div>
                </div>
              )}
            <div
              data-message-timestamp={msg.timestamp}
              data-message-text={msg.text}
              className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${isGroupedWithPrevious ? 'mt-1.5' : 'mt-3'} ${
                highlightedMessageTarget
                && highlightedMessageTarget.timestamp === msg.timestamp
                && highlightedMessageTarget.text === msg.text
                  ? 'rounded-[28px] bg-amber-50/70 px-2 py-2 ring-1 ring-amber-200 transition-all'
                  : ''
              }`}
            >
              {isGroupedWithPrevious ? (
                <div className="h-10 w-10 shrink-0" />
              ) : (
                <GroupMessageAvatar
                  value={isUser ? userAvatar : avatar}
                  fallbackValue={undefined}
                  alt={isUser ? groupUserDisplayName : senderName}
                  fit={isUser ? 'contain' : 'cover'}
                />
              )}
              <div
                className={`flex max-w-[88%] flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                {!isGroupedWithPrevious && (
                  <div className={`mb-1 flex flex-wrap items-center gap-2 ${isUser ? 'justify-end mr-1' : 'ml-1'}`}>
                    {badge ? (
                      <span
                        className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                        style={{ backgroundColor: badge.color }}
                      >
                        {badge.label}
                      </span>
                    ) : null}
                    <span className="text-[12px] font-medium text-zinc-500">{senderName}</span>
                    {!badge && roleLabel && roleLabel !== '普通成员' ? (
                      <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        {roleLabel}
                      </span>
                    ) : null}
                  </div>
                )}
                {msg.replyTo && (
                  <div className="chat-reply-preview mb-1 inline-flex max-w-[min(82%,34rem)] items-start gap-2 rounded-xl border border-zinc-200/80 bg-white/65 px-3 py-2 text-zinc-700 backdrop-blur-sm">
                    <Reply size={13} className="mt-0.5 shrink-0 text-zinc-400" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-zinc-500">
                        回复 {msg.replyTo.authorLabel}
                      </div>
                      <div className="mt-0.5 max-w-[min(60vw,24rem)] line-clamp-2 text-[12px] leading-5 text-zinc-600 break-words">
                        {getReplyPreviewText(msg)}
                      </div>
                    </div>
                  </div>
                )}
                {(() => {
                  const isStandaloneMedia = visualKind === 'sticker' || Boolean(msg.audioUrl);
                  const shouldUseDefaultBubbleSurface =
                    !isStandaloneMedia
                    && !shouldUseCustomMemberBubble
                    && !hasSenderBubbleThemeCss
                    && !hasSharedBubbleTheme
                    && !(isUser ? hasGroupUserTheme : hasGroupRoleTheme);

                  return (
                  <GroupBubbleResolvedImageStyle value={!isUser ? senderCharacter?.bubbleImage : undefined}>
                    {(senderBubbleImageUrl) => {
                      const hasSenderBubbleSurfaceCustomization = !!senderBubbleImageUrl || !!senderBubbleColor;
                      const hasSenderBubbleOverride =
                        !!senderBubbleStyleCss?.trim() || hasSenderBubbleSurfaceCustomization;
                      const shouldUseResolvedMemberBubble =
                        !isUser
                        && !msg.isSystem
                        && !msg.imageUrl
                        && visualKind !== 'sticker'
                        && !isPendingMessage
                        && !hasSenderBubbleOverride
                        && !hasSenderBubbleSurfaceCustomization
                        && !!bubbleColor;
                      const resolvedMemberBubbleTextColor = shouldUseResolvedMemberBubble ? getReadableTextColor(bubbleColor!) : '#111827';
                      const resolvedMemberBubbleStyle = shouldUseResolvedMemberBubble
                        ? {
                            backgroundColor: bubbleColor!,
                            borderColor: bubbleColor!,
                            color: resolvedMemberBubbleTextColor,
                        }
                        : undefined;
                      const groupBubbleTextStyle = getGroupBubbleTextStyle({
                        isUser,
                        senderBubbleStyleCss,
                      });
                      const resolvedDefaultBubbleSurface =
                        !isStandaloneMedia
                        && !shouldUseResolvedMemberBubble
                        && !hasSenderBubbleOverride
                        && !hasSharedBubbleTheme
                        && !(isUser ? hasGroupUserTheme : hasGroupRoleTheme);

                      return (
                        <div
                          onClick={(event) => handleMessageClick(event, idx)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            openContextMenu(event, idx);
                          }}
                          onPointerDown={(event) => {
                            clearLongPressTimer();
                            longPressTimerRef.current = window.setTimeout(() => {
                              openContextMenu(event, idx);
                            }, 420);
                          }}
                          onPointerUp={clearLongPressTimer}
                          onPointerLeave={clearLongPressTimer}
                          onPointerCancel={clearLongPressTimer}
                          className={`${isStandaloneMedia ? '' : `chat-bubble message-bubble ${isUser ? 'user-bubble right chat-bubble-right' : 'bot-bubble left chat-bubble-left'} ${isPendingMessage && !content ? 'chat-loading-bubble' : ''} relative`} cursor-pointer px-4 py-2.5 text-[15px] shadow-sm transition-all active:scale-[0.98] ${
                            msg.isRecalled
                              ? `border border-zinc-200 bg-zinc-100 text-zinc-400 ${isGroupedWithPrevious ? 'rounded-2xl' : isUser ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm'} shadow-none`
                              : isUser
                                ? `${isStandaloneMedia ? 'bg-transparent p-0 text-white shadow-none' : `bg-blue-500 text-white ${isGroupedWithPrevious ? 'rounded-2xl' : 'rounded-2xl rounded-tr-sm'}`}`
                                : `${isStandaloneMedia ? 'bg-transparent p-0 text-zinc-800 shadow-none' : isPendingMessage ? 'border border-zinc-100 bg-zinc-50/90 text-zinc-700' : shouldUseResolvedMemberBubble ? 'border' : 'border border-zinc-100 bg-white text-zinc-800'} ${isStandaloneMedia ? '' : isGroupedWithPrevious ? 'rounded-2xl shadow-[0_8px_20px_rgba(15,23,42,0.05)]' : 'rounded-2xl rounded-tl-sm shadow-[0_10px_24px_rgba(15,23,42,0.08)]'} ${isPendingMessage ? 'animate-pulse' : ''}`
                          }`}
                          data-character-bubble-scope={!isUser && senderCharacter?.id ? senderCharacter.id : undefined}
                          style={isStandaloneMedia
                            ? undefined
                            : {
                                ...getDefaultGroupBubbleSurfaceStyle({
                                  isUser,
                                  shouldUseDefaultSurface: resolvedDefaultBubbleSurface,
                                }),
                                ...(hasSenderBubbleOverride ? {} : resolvedMemberBubbleStyle),
                                ...(!hasSenderBubbleCustomization && !isUser && senderBubbleImageUrl
                                  ? {
                                      backgroundImage: `url(${senderBubbleImageUrl})`,
                                      backgroundSize: 'cover',
                                      backgroundPosition: 'center',
                                      border: 'none',
                                    }
                                  : !hasSenderBubbleCustomization && !isUser && senderBubbleColor
                                    ? {
                                        backgroundColor: senderBubbleColor,
                                        borderColor: senderBubbleColor,
                                      }
                                    : {}),
                                ...(hasSenderBubbleOverride || hasSharedBubbleTheme ? {} : sharedBubbleStyle),
                                ...(hasSenderBubbleOverride || (isUser ? hasGroupUserTheme : hasGroupRoleTheme)
                                  ? {}
                                  : (isUser ? groupUserBubbleStyle : groupRoleBubbleStyle)),
                                ...senderBubbleStyle,
                                ...(chatTextStyle || {}),
                              }}
                        >
                  {!isStandaloneMedia && !msg.isRecalled && <BubbleThemeAnchors />}
                  {msg.isRecalled ? (
                    <div className="text-xs italic">
                      {msg.role === 'user' ? '你撤回了一条消息' : '对方撤回了一条消息'}
                    </div>
                  ) : msg.audioUrl && (
                    <AudioMessageCard
                      value={msg.audioUrl}
                      durationSeconds={msg.duration}
                      caption={stripVisualMessageMarker(content) || null}
                      isUser={isUser}
                      className="shadow-none"
                    />
                  )}
                  {!msg.isRecalled && msg.imageUrl && (
                    <>
                      <GroupMessageImage
                        value={msg.imageUrl}
                        alt={visualKind === 'sticker' ? '表情包' : '群聊图片'}
                        className={`chat-message-image rounded-xl object-contain ${
                          visualKind === 'sticker'
                            ? 'max-h-36 max-w-[11rem]'
                            : 'mb-2 max-h-60 max-w-[18rem]'
                        }`}
                      />
                      {(() => {
                        const visualText = stripVisualMessageMarker(content);
                        if (!visualText) return null;
                        return (
                          <span className={`whitespace-pre-wrap break-words ${visualKind === 'sticker' ? 'text-[16px] leading-7' : ''}`} style={{ ...chatTextStyle, ...groupBubbleTextStyle }}>
                            {renderTextWithMentions(visualText, isUser ? 'outgoing' : 'incoming')}
                          </span>
                        );
                      })()}
                    </>
                  )}
                  {!msg.isRecalled && !msg.imageUrl && visualKind === 'sticker' && (
                    <div className="mb-2 inline-flex items-center rounded-full bg-pink-100 px-2.5 py-1 text-[11px] font-medium text-pink-500">
                      STICKER
                    </div>
                  )}
                  {!msg.isRecalled && msg.location && (
                    <div className="chat-location-inline-card mb-2 rounded-xl bg-zinc-100/80 px-3 py-2 text-[12px] text-zinc-600">
                      <div className="font-medium text-zinc-700">{msg.location.name}</div>
                      {msg.location.address && <div className="mt-0.5">{msg.location.address}</div>}
                    </div>
                  )}
                  {!msg.isRecalled && !msg.imageUrl && !msg.audioUrl && msg.isPending && !content ? (
                    <div className="flex gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                      <div className="delay-75 h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                      <div className="delay-150 h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                    </div>
                  ) : !msg.isRecalled && !msg.imageUrl && !msg.audioUrl ? (
                    <span className={`whitespace-pre-wrap break-words ${visualKind === 'sticker' ? 'text-[16px] leading-7' : ''}`} style={{ ...chatTextStyle, ...groupBubbleTextStyle }}>
                      {renderTextWithMentions(content.replace(/^\[sticker\]\s*/i, ''), isUser ? 'outgoing' : 'incoming')}
                    </span>
                  ) : null
                  }
                        </div>
                      );
                    }}
                  </GroupBubbleResolvedImageStyle>
                  );
                })()}
                {showChatMessageTime && (
                  <div className={`mt-1 px-1 text-[10px] text-zinc-400 ${isUser ? 'text-right' : 'text-left'}`}>
                    {formatChatMessageTime(msg.timestamp)}
                    {isUser && groupReadCount > 0 && (
                      <span className="ml-1">{`${groupReadCount}人已读`}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            </div>
          );
        })}
        {isLoading && !pendingMessage && (
          <div className="mt-3 flex gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-100" />
            <div className="chat-loading-bubble rounded-2xl rounded-tl-sm border border-zinc-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                <div className="delay-75 h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                <div className="delay-150 h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      <div className={`chat-session-footer chat-footer ${groupFooterClassName}`} style={{ ...layoutConfig.inputContainerStyle, ...groupFooterStyle }}>
        {replyingTo && (
          <div className="chat-footer-reply-preview flex items-center justify-between rounded-xl border border-zinc-200/50 bg-zinc-100/80 px-3 py-2 text-[13px] text-zinc-600">
            <div className="chat-footer-reply-preview-content flex items-center gap-2 truncate">
              <Reply size={14} className="chat-footer-reply-preview-icon shrink-0" />
              <span className="shrink-0 font-medium">{replyingTo.authorLabel}:</span>
              <span className="truncate">{replyingTo.preview}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="chat-footer-reply-close-button shrink-0 rounded-full p-1 hover:bg-zinc-200">
              <X size={14} className="chat-footer-reply-close-icon" />
            </button>
          </div>
        )}

        <div className="chat-footer-controls flex items-end gap-2">
          <button
            onClick={() => setIsVoiceMode((prev) => !prev)}
            className={`chat-footer-voice-toggle-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
              isVoiceMode ? 'bg-zinc-100 text-zinc-800' : groupFooterControlTone.iconButton
            }`}
          >
            {isVoiceMode ? <Keyboard size={22} className="chat-footer-voice-toggle-icon" /> : <Mic size={22} className="chat-footer-voice-toggle-icon" />}
          </button>

          <div className={`chat-footer-input-shell flex flex-1 items-end gap-2 rounded-2xl border px-4 py-2.5 focus-within:border-blue-500 ${groupFooterControlTone.inputShell}`}>
            {isVoiceMode ? (
              <button
                onPointerDown={audioRecordInteraction.onPointerDown}
                onPointerUp={audioRecordInteraction.onPointerUp}
                onPointerCancel={audioRecordInteraction.onPointerCancel}
                onPointerLeave={audioRecordInteraction.onPointerLeave}
                className={`chat-footer-voice-button flex h-10 w-full items-center justify-center rounded-xl text-[14px] transition-all active:scale-[0.98] select-none ${
                  isRecording
                    ? 'bg-zinc-200 text-zinc-800'
                    : groupFooterControlTone.voiceButton
                }`}
              >
                {audioRecordInteraction.buttonLabel}
              </button>
            ) : (
              <>
	                <textarea
	                  ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendText();
                }
              }}
              placeholder="发送消息..."
              className="chat-footer-textarea min-h-[24px] w-full resize-none bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-500"
              rows={1}
            />
            <button
	              onClick={() => {
	                setShowEmojiPanel(!showEmojiPanel);
	                setStickerTab('basic');
	                if (showFunPanel) setShowFunPanel(false);
	              }}
              className={`chat-footer-emoji-button shrink-0 p-1 transition-colors ${showEmojiPanel ? 'text-zinc-900' : footerStyleType === 'transparent' || footerStyleType === 'glass' ? 'text-zinc-500 hover:text-zinc-700' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <Smile size={20} className="chat-footer-emoji-icon" />
                </button>
              </>
            )}
          </div>

          {!isVoiceMode && input.trim() ? (
            <button
              onClick={() => void sendText()}
              className="chat-footer-send-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-900 transition-all hover:bg-zinc-200 active:scale-90"
            >
              <Send size={18} className="chat-footer-send-icon" />
            </button>
          ) : (
            <button
              onClick={() => {
                setShowFunPanel(!showFunPanel);
                if (showEmojiPanel) setShowEmojiPanel(false);
              }}
              className={`chat-footer-plus-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                showFunPanel ? 'rotate-45 bg-zinc-100 text-zinc-800' : groupFooterControlTone.iconButton
              }`}
            >
              <Plus size={24} className="chat-footer-plus-icon" />
            </button>
          )}
        </div>

	        <div className="relative">
	          <AnimatePresence>
	            {showMentionPicker && (
	              <motion.div
	                initial={{ opacity: 0, y: 8 }}
	                animate={{ opacity: 1, y: 0 }}
	                exit={{ opacity: 0, y: 8 }}
	                className="mb-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg"
	              >
	                <div className="px-3 py-2 text-[12px] text-zinc-500">选择要 @ 的成员</div>
	                <div className="max-h-44 overflow-y-auto">
	                  {mentionCandidates.map((member) => (
	                    <button
	                      key={member.id}
	                      onClick={() => handleMentionInsert(member)}
	                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50"
	                    >
	                      <GroupMessageAvatar value={member.avatar} alt={member.name} />
	                      <div className="min-w-0">
	                        <div className="truncate text-sm font-medium text-zinc-900">
	                          {member.remarkName?.trim() || member.name}
	                        </div>
	                        <div className="truncate text-[12px] text-zinc-500">@{member.name}</div>
	                      </div>
	                    </button>
	                  ))}
	                </div>
	              </motion.div>
	            )}
	          </AnimatePresence>
	          <AnimatePresence>
	            {showEmojiPanel && (
	              <motion.div
	                initial={{ height: 0, opacity: 0 }}
	                animate={{ height: 'auto', opacity: 1 }}
	                exit={{ height: 0, opacity: 0 }}
	                className="overflow-hidden"
	              >
	                <div className="pt-4">
	                  <div className="mb-3 flex border-b border-zinc-100">
	                    <button
	                      onClick={() => setStickerTab('basic')}
	                      className={`flex-1 py-2 text-[13px] font-medium transition-colors ${
	                        stickerTab === 'basic' ? 'border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50'
	                      }`}
	                    >
	                      基础表情
	                    </button>
	                    <button
	                      onClick={() => setStickerTab('custom')}
	                      className={`flex-1 py-2 text-[13px] font-medium transition-colors ${
	                        stickerTab === 'custom' ? 'border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50'
	                      }`}
	                    >
	                      自定义表情
	                    </button>
	                  </div>
	                  <div className="h-48 overflow-y-auto">
	                    {stickerTab === 'basic' ? (
	                      <div className="grid grid-cols-6 gap-2">
	                        {BASIC_EMOJIS.map((emoji) => (
	                          <button
	                            key={emoji}
	                            onClick={() => setInput((prev) => prev + emoji)}
	                            className="flex aspect-square items-center justify-center rounded-lg text-2xl transition-colors hover:bg-zinc-50"
	                          >
	                            {emoji}
	                          </button>
	                        ))}
	                      </div>
	                    ) : availableCustomStickers.length > 0 ? (
	                      <div className="grid grid-cols-4 gap-2">
	                        {availableCustomStickers.map((sticker, index) => (
	                          <button
	                            key={`${sticker}-${index}`}
	                            onClick={() => handleCustomStickerSend(sticker)}
	                            className="aspect-square overflow-hidden rounded-xl border border-zinc-100 transition-colors hover:border-blue-300"
	                          >
	                            <GroupStickerPreview value={sticker} alt={`自定义表情 ${index + 1}`} />
	                          </button>
	                        ))}
	                      </div>
	                    ) : (
	                      <div className="flex h-full flex-col items-center justify-center py-8 text-zinc-400">
	                        <Smile size={32} className="mb-2 opacity-50" />
	                        <p className="text-[12px]">暂无自定义表情</p>
	                      </div>
	                    )}
	                  </div>
	                </div>
	              </motion.div>
	            )}
	          </AnimatePresence>

          <AnimatePresence>
            {showFunPanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 transition-transform active:scale-95">
                      <ImageIcon size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">发图</span>
                  </button>
                  <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />

                  <button
                    onClick={() => {
                      setShowLocationPicker(true);
                      setShowFunPanel(false);
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 transition-transform active:scale-95">
                      <MapPin size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">发位置</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowEmojiPanel(true);
                      setShowFunPanel(false);
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 transition-transform active:scale-95">
                      <Smile size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">表情</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <GroupLocationPickerSheet
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSend={sendLocationMessage}
      />

      <AnimatePresence>
        {showGroupSettings && (
          <>
            <input
              ref={groupAvatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGroupAvatarUpload}
            />
              <GroupSettingsScreen
                groupName={groupDisplayName}
                formState={groupSettingsForm}
                actingRole={actingRole}
                memberCount={participantCount}
                members={groupSettingsMembers}
                inviteCandidates={groupSettingsInviteCandidates}
                worldBooks={worldBooks}
                messages={history}
                onChange={(patch) => setGroupSettingsForm((prev) => ({ ...prev, ...patch }))}
                onUpdateGroupBackground={handleUpdateGroupBackground}
                onAvatarPick={() => groupAvatarInputRef.current?.click()}
                onBack={handleCloseGroupSettings}
                onJumpToMessage={(target) => {
                  setShowGroupSettings(false);
                  setHighlightedMessageTarget(target);
                }}
                onInviteMember={handleInviteMember}
                onRemoveMember={handleRemoveMember}
                onToggleAdmin={handleToggleAdmin}
                onUpdateBadge={handleUpdateBadge}
                onUpdateBubbleColor={handleUpdateBubbleColor}
                resolveSenderLabel={(message) => resolveGroupMessageSenderLabel(message, {
                  userName: groupUserDisplayName,
                  getCharacterById,
                })}
                isInvitingMember={isInvitingMember}
                isRemovingMember={isRemovingMember}
                isUpdatingAdmin={isUpdatingAdmin}
                isUpdatingBadge={isUpdatingBadge}
                onClearHistory={() => {
                  if (!window.confirm('确认清空当前群聊记录吗？')) return;
                  onClearHistory();
                  setShowGroupSettings(false);
                }}
                onLeaveGroup={() => {
                  if (!window.confirm('确认退出当前群聊吗？')) return;
                  setShowGroupSettings(false);
                  handleLeaveCurrentGroup();
                }}
              />
          </>
        )}
      </AnimatePresence>

      {contextMenu && contextMenuMessage && (
        <>
          <div className="absolute inset-0 z-[90]" onClick={closeContextMenu} />
          <div
            className="absolute z-[95] overflow-hidden rounded-xl border border-zinc-200/50 bg-white/90 backdrop-blur-xl shadow-xl"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="flex items-center gap-1 p-1.5">
              <button
                onClick={handleQuoteReply}
                className="rounded-lg p-2 text-zinc-900 transition-colors hover:bg-zinc-100"
                title="引用回复"
              >
                <MessageSquarePlus size={20} />
              </button>
              {contextMenuMessage.role === 'user' && !contextMenuMessage.isRecalled && (
                <button
                  onClick={handleRecall}
                  className="rounded-lg p-2 text-zinc-900 transition-colors hover:bg-zinc-100"
                  title="撤回"
                >
                  <Reply size={20} />
                </button>
              )}
              <button
                onClick={() => void handleCopy()}
                className="rounded-lg p-2 text-zinc-900 transition-colors hover:bg-zinc-100"
                title="复制"
              >
	                <Copy size={20} />
	              </button>
	              <button
	                onClick={handleForward}
	                className="rounded-lg p-2 text-zinc-900 transition-colors hover:bg-zinc-100"
	                title="转发"
	              >
	                <Forward size={20} />
	              </button>
	              <button
	                onClick={handleDelete}
	                className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
	                title="删除"
	              >
	                <Trash2 size={20} />
	              </button>
	              <button
	                onClick={handleFavorite}
                className="rounded-lg p-2 text-zinc-900 transition-colors hover:bg-zinc-100"
                title={contextMenuMessage.isFavorited ? '取消收藏' : '收藏'}
              >
                <Star
                  size={20}
                  fill={contextMenuMessage.isFavorited ? 'currentColor' : 'none'}
                  className={contextMenuMessage.isFavorited ? 'text-yellow-400' : ''}
                />
              </button>
              <button
                onClick={handleShare}
                className="rounded-lg p-2 text-zinc-900 transition-colors hover:bg-zinc-100"
                title="分享"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </>
      )}

      {pendingShare && (
        <>
          <div className="absolute inset-0 z-[96] bg-black/20" onClick={() => setPendingShare(null)} />
          <div className="absolute inset-x-3 bottom-3 z-[97] rounded-3xl border border-zinc-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
            <div className="mb-3">
              <div className="text-sm font-semibold text-zinc-900">分享消息</div>
              <div className="mt-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                {pendingShare.preview}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  const result = await copyTextContent(pendingShare.summary);
                  if (result.ok) {
                    setPendingShare(null);
                    return;
                  }
                  alert(result.message);
                }}
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white"
              >
                复制分享内容
              </button>
              <button
                onClick={() => setPendingShare(null)}
                className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-700"
              >
                取消
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


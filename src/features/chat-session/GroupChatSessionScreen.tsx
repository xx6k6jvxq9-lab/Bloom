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
import type { AppSettings, Character, ChatGroup, ChatHistory, ChatMessage, FavoriteMessage } from '../../types';
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
import { buildGroupChatSceneInput } from '../../services/scene-inputs/buildGroupChatSceneInput';
import { createCharacterDirectory } from '../character-domain/useCharacterDirectory';
import { useGroupChatRuntime } from '../chat-runtime/useGroupChatRuntime';
import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';
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
import { getGroupMemberBadge } from '../group-settings/memberBadges';
import { buildGroupSettingsPatch, createGroupSettingsFormState, hasGroupSettingsChanges } from '../group-settings/utils';

const BASIC_EMOJIS = ['😺', '😀', '😚', '😑', '😎', '😹', '😶', '❤️', '🙄', '🙏', '🎀', '🎉'];

const DEFAULT_LOCATIONS = [
  { name: '我的当前位置', address: '成都市 锦江区 春熙路', isVirtual: false },
  { name: '公司', address: '高新区 天府大道', isVirtual: true },
  { name: '家', address: '武侯区', isVirtual: true },
];

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
  if (text.startsWith('[sticker]')) {
    return text.replace(/^\[sticker\]\s*/i, '').trim();
  }
  if (text.startsWith('[GAME_CARD]')) {
    return '[游戏卡片]';
  }
  return text;
};

function formatPendingGroupText(text: string): string {
  return text
    .replace(/^[\s"'`!?，。？！,]+/, '')
    .replace(/^\[(?:reply|reply to)\s*:\s*[^\]]+\]\s*/i, '')
    .replace(/^\[(?:notice|system|sticker|image)\]\s*/i, '')
    .trim();
}

function stripSenderPrefix(text: string, aliases: string[]): string {
  return aliases.reduce((currentText, alias) => {
    if (currentText !== text) return currentText;
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return currentText.replace(new RegExp(`^${escapedAlias}\\s*[:：]\\s*`), '');
  }, text);
}

function parseSenderLabel(text: string): { senderLabel: string; content: string } | null {
  const match = text.match(/^([^:：]+)\s*[:：]\s*(.*)$/);
  if (!match) return null;

  return {
    senderLabel: match[1].trim(),
    content: match[2],
  };
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
  const [isNoticeVisible, setIsNoticeVisible] = useState(() => !!groupNotice);
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

  const {
    isLoading,
    error,
    pendingMessage,
    sendText,
    sendImageMessage,
    sendLocationMessage,
    maybeOpenScene,
    reactToNoticeUpdate,
  } = useGroupChatRuntime({
    members,
    groupMeta: {
      lastMessage: group.lastMessage,
      lastTime: group.lastTime,
      groupStage: group.groupStage,
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
    activeConfig,
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
    setGroupSettingsForm(createGroupSettingsFormState(group));
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
        roleLabel: character ? getGroupRoleLabel(resolveGroupMemberRole(group, character.id)) : undefined,
      };
    }

    return {
      senderId: `unknown:${message.timestamp}:${message.text}`,
      senderName: '群成员',
      avatar: '',
      content: formatMessagePreview(message.text),
      badge: null,
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
        roleLabel: getGroupRoleLabel(actingRole),
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
        roleLabel: getGroupRoleLabel(resolveGroupMemberRole(group, sender.id)),
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
        roleLabel: character ? getGroupRoleLabel(resolveGroupMemberRole(group, character.id)) : undefined,
      };
    }

    return {
      senderId: `unknown:${message.timestamp}:${message.text}`,
      senderName: '群成员',
      avatar: '',
      content: formatMessagePreview(message.text),
      badge: null,
      roleLabel: undefined,
    };
  };

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
    if (!targetMessage) return;

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
    void sendImageMessage(sticker);
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
    onUpdateGroup(buildGroupSettingsPatch(groupSettingsForm));
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

    if (message.imageUrl || content.startsWith('[sticker]')) {
      return 'sticker' as const;
    }

    if (message.replyTo) {
      return 'reply' as const;
    }

    return 'normal' as const;
  };

  const getReadableMessageBody = (message: ChatMessage, content: string) => {
    if (message.imageUrl) {
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

    if (currentMessage.imageUrl || previousMessage.imageUrl) {
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
    <div className="absolute inset-0 z-50 flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center justify-between border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[16px] font-bold text-zinc-900">{groupDisplayName}</h1>
            <span className="text-[11px] text-zinc-500">{participantCount} 人</span>
          </div>
        </div>
        <button onClick={() => setShowGroupSettings(true)} className="p-2 text-zinc-400">
          <MoreVertical size={20} />
        </button>
      </div>

      {groupNotice && isNoticeVisible && (
        <div className="border-b border-amber-200 bg-amber-50/95 px-4 py-3">
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

      <div className={`${layoutConfig.messageListClass} relative isolate overflow-hidden`} ref={scrollRef}>
        {groupBackgroundUrl ? (
          <>
            <img
              src={groupBackgroundUrl}
              alt="群聊天背景"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-white/60" />
          </>
        ) : null}
        <div className="relative z-10">
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-[13px] text-red-500">
            {error}
          </div>
        )}
        {renderedHistory.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const { senderId, senderName, avatar, content, badge, roleLabel } = resolveSenderInfo(msg);
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

          const messageKey = `${msg.timestamp}-${msg.role}-${msg.senderCharacterId || senderId}-${idx}`;

          if (visualKind === 'notice') {
            return (
              <div key={messageKey} className="flex justify-center py-1">
                <div className="relative max-w-[88%] rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
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
            );
          }

          const isPendingMessage = !!msg.isPending;

          return (
            <div
              key={messageKey}
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
              <div className={`flex max-w-[88%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                {!isGroupedWithPrevious && (
                  <div className={`mb-1 flex flex-wrap items-center gap-2 ${isUser ? 'justify-end mr-1' : 'ml-1'}`}>
                    {badge ? (
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                        style={{ backgroundColor: badge.color }}
                      >
                        {badge.label}
                      </span>
                    ) : null}
                    <span className="text-[11px] text-zinc-400">{senderName}</span>
                    {roleLabel ? (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        {roleLabel}
                      </span>
                    ) : null}
                  </div>
                )}
                {msg.replyTo && (
                  <div className="mb-1 inline-flex max-w-[min(82%,34rem)] items-start gap-2 rounded-xl border border-zinc-200/80 bg-white/65 px-3 py-2 text-zinc-700 backdrop-blur-sm">
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
                  className={`relative cursor-pointer px-4 py-2.5 text-[15px] shadow-sm transition-all active:scale-[0.98] ${
                    isUser
                      ? `bg-blue-500 text-white ${isGroupedWithPrevious ? 'rounded-2xl' : 'rounded-2xl rounded-tr-sm'}`
                      : `${visualKind === 'sticker' ? 'border border-pink-100 bg-pink-50/80 text-zinc-800' : isPendingMessage ? 'border border-zinc-100 bg-zinc-50/90 text-zinc-700' : 'border border-zinc-100 bg-white text-zinc-800'} ${isGroupedWithPrevious ? 'rounded-2xl shadow-[0_8px_20px_rgba(15,23,42,0.05)]' : 'rounded-2xl rounded-tl-sm shadow-[0_10px_24px_rgba(15,23,42,0.08)]'} ${isPendingMessage ? 'animate-pulse' : ''}`
                  }`}
                >
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="群聊图片"
                      className={`${visualKind === 'sticker' ? 'max-h-36 max-w-[11rem]' : 'max-h-48'} mb-2 rounded-xl object-cover`}
                    />
                  )}
                  {!msg.imageUrl && visualKind === 'sticker' && (
                    <div className="mb-2 inline-flex items-center rounded-full bg-pink-100 px-2.5 py-1 text-[11px] font-medium text-pink-500">
                      STICKER
                    </div>
                  )}
                  {msg.location && (
                    <div className="mb-2 rounded-xl bg-zinc-100/80 px-3 py-2 text-[12px] text-zinc-600">
                      <div className="font-medium text-zinc-700">{msg.location.name}</div>
                      {msg.location.address && <div className="mt-0.5">{msg.location.address}</div>}
                    </div>
                  )}
                  {msg.isPending && !content ? (
                    <div className="flex gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                      <div className="delay-75 h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                      <div className="delay-150 h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                    </div>
                  ) : (
                    <span className={`whitespace-pre-wrap break-words ${visualKind === 'sticker' ? 'text-[16px] leading-7' : ''}`}>
                      {renderTextWithMentions(content.replace(/^\[sticker\]\s*/i, ''), isUser ? 'outgoing' : 'incoming')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isLoading && !pendingMessage && (
          <div className="mt-3 flex gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-100" />
            <div className="rounded-2xl rounded-tl-sm border border-zinc-100 bg-white px-4 py-3 shadow-sm">
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

      <div className={inputContainerClass} style={layoutConfig.inputContainerStyle}>
        {replyingTo && (
          <div className="flex items-center justify-between rounded-xl border border-zinc-200/50 bg-zinc-100/80 px-3 py-2 text-[13px] text-zinc-600">
            <div className="flex items-center gap-2 truncate">
              <Reply size={14} className="shrink-0" />
              <span className="shrink-0 font-medium">{replyingTo.authorLabel}:</span>
              <span className="truncate">{replyingTo.preview}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="shrink-0 rounded-full p-1 hover:bg-zinc-200">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => setIsVoiceMode((prev) => !prev)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
              isVoiceMode ? 'bg-zinc-100 text-zinc-800' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
            }`}
          >
            {isVoiceMode ? <Keyboard size={22} /> : <Mic size={22} />}
          </button>

          <div className="flex flex-1 items-end gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-2.5 focus-within:border-blue-500">
            {isVoiceMode ? (
              <div className="flex h-10 w-full items-center justify-center rounded-xl bg-zinc-100 text-[14px] text-zinc-500">
                按住说话
              </div>
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
              className="min-h-[24px] w-full resize-none bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-500"
              rows={1}
            />
            <button
	              onClick={() => {
	                setShowEmojiPanel(!showEmojiPanel);
	                setStickerTab('basic');
	                if (showFunPanel) setShowFunPanel(false);
	              }}
              className={`shrink-0 p-1 transition-colors ${showEmojiPanel ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <Smile size={20} />
                </button>
              </>
            )}
          </div>

          {!isVoiceMode && input.trim() ? (
            <button
              onClick={() => void sendText()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-all active:scale-90"
              disabled={isLoading}
            >
              <Send size={18} />
            </button>
          ) : (
            <button
              onClick={() => {
                setShowFunPanel(!showFunPanel);
                if (showEmojiPanel) setShowEmojiPanel(false);
              }}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                showFunPanel ? 'rotate-45 bg-zinc-100 text-zinc-800' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              <Plus size={24} />
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

      <AnimatePresence>
        {showLocationPicker && (
          <div className="absolute inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="flex max-h-[88vh] w-full flex-col rounded-t-[32px] bg-white p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-[18px] font-bold text-zinc-900">发送位置</h3>
                <button onClick={() => setShowLocationPicker(false)} className="p-2 text-zinc-400">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {DEFAULT_LOCATIONS.map((location) => (
                  <button
                    key={location.name}
                    onClick={() => {
                      void sendLocationMessage(location);
                      setShowLocationPicker(false);
                    }}
                    className="w-full rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-left"
                  >
                    <div className="font-medium text-zinc-900">{location.name}</div>
                    {location.address && <div className="mt-1 text-[13px] text-zinc-500">{location.address}</div>}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                messages={history}
                onChange={(patch) => setGroupSettingsForm((prev) => ({ ...prev, ...patch }))}
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


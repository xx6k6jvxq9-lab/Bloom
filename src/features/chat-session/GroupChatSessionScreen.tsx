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
import type { AppSettings, Character, ChatGroup, ChatMessage, FavoriteMessage } from '../../types';
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
import { createCharacterDirectory } from '../character-domain/useCharacterDirectory';
import { useGroupChatRuntime } from '../chat-runtime/useGroupChatRuntime';
import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../persistence/useResolvedPersistentValue';

const BASIC_EMOJIS = ['😀', '😂', '🥹', '😎', '🥳', '🤔', '😭', '❤️', '👍', '🙏', '🎉', '🌟'];

const DEFAULT_LOCATIONS = [
  { name: '我的当前位置', address: '成都市 锦江区 春熙路', isVirtual: false },
  { name: '公司', address: '高新区 天府大道', isVirtual: true },
  { name: '家', address: '武侯区', isVirtual: true },
];

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

function GroupMessageAvatar({
  value,
  fallbackValue,
  alt,
}: {
  value?: string | null;
  fallbackValue?: string | null;
  alt: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const { resolvedUrl: resolvedFallbackUrl } = useResolvedPersistentValue(fallbackValue);
  const src =
    getDisplayableAssetValue(value, resolvedUrl)
    || getDisplayableAssetValue(fallbackValue, resolvedFallbackUrl)
    || null;

  if (!src) {
    return <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-200" aria-label={alt} />;
  }

  return <img src={src} alt={alt} className="h-10 w-10 shrink-0 rounded-full bg-zinc-200 object-cover" />;
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
}) {
  const [input, setInput] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage['replyTo'] | null>(null);
  const [pendingShare, setPendingShare] = useState<ShareActionResult['payload'] | null>(null);
  const [showFunPanel, setShowFunPanel] = useState(false);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [stickerTab, setStickerTab] = useState<'basic' | 'custom'>('basic');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState(group.name);
  const [groupAvatarDraft, setGroupAvatarDraft] = useState(group.avatar || '');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
    messageTimestamp: number;
    messageRole: ChatMessage['role'];
    messageText: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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
  const hasGroupInfoChanges =
    groupNameDraft.trim() !== group.name || groupAvatarDraft !== (group.avatar || '');
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
    sendText,
    sendImageMessage,
    sendLocationMessage,
    maybeOpenScene,
  } = useGroupChatRuntime({
    members,
    groupMeta: {
      lastMessage: group.lastMessage,
      lastTime: group.lastTime,
    },
    history,
    setHistory,
    input,
    setInput,
    replyingTo,
    setReplyingTo,
    userName,
    activeConfig,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    didTryOpeningRef.current = false;
  }, [group.id]);

  useEffect(() => {
    if (didTryOpeningRef.current || !hasUsableConfig || members.length === 0) return;
    didTryOpeningRef.current = true;
    void maybeOpenScene();
  }, [hasUsableConfig, maybeOpenScene, members.length]);

  useEffect(() => {
    setGroupNameDraft(group.name);
    setGroupAvatarDraft(group.avatar || '');
  }, [group.name, group.avatar, showGroupInfo]);

  const resolveSender = (message: ChatMessage) => {
    if (message.role === 'user') {
      return {
        senderName: userName,
        avatar: userAvatar,
        content: formatMessagePreview(message.text),
      };
    }

    const sender = message.senderCharacterId ? getCharacterById(message.senderCharacterId) : null;
    if (sender) {
      const senderName = sender.remarkName?.trim() || sender.name;
      const prefix = `${sender.name}: `;
      return {
        senderName,
        avatar: sender.avatar,
        content: formatMessagePreview(message.text.startsWith(prefix) ? message.text.slice(prefix.length) : message.text),
      };
    }

    const match = message.text.match(/^([^:]+): (.*)/);
    if (match) {
      const character = getCharacterByName(match[1]);
      return {
        senderName: match[1],
        avatar: character?.avatar || '',
        content: formatMessagePreview(match[2]),
      };
    }

    return {
      senderName: '群成员',
      avatar: '',
      content: formatMessagePreview(message.text),
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
      ? userName
      : resolveSender(contextMenuMessage).senderName;
    setReplyingTo(createQuoteReplyPayload(contextMenuMessage, {
      userLabel: userName,
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
      name: group.name,
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
      setGroupAvatarDraft((reader.result as string) || '');
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
    const mentionLabel = member.remarkName?.trim() || member.name;
    setInput((prev) => prev.replace(/@([^\s@]*)$/, `@${mentionLabel} `));
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleSaveGroupInfo = () => {
    const trimmedName = groupNameDraft.trim();
    if (!trimmedName) return;

    onUpdateGroup({
      name: trimmedName,
      avatar: groupAvatarDraft || undefined,
    });
    setShowGroupInfo(false);
  };

  const renderTextWithMentions = (text: string) => {
    const parts = text.split(/(@[^\s@]+)/g);
    return parts.map((part, index) => {
      if (!part.startsWith('@')) {
        return <span key={`${part}-${index}`}>{part}</span>;
      }

      return (
        <span
          key={`${part}-${index}`}
          className="rounded-md bg-blue-50 px-1.5 py-0.5 font-medium text-blue-600"
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
    const previousLooksReactive = previousLength > 0 && previousLength <= 6;
    const currentLooksIndependent = currentLength >= 14 || /[，,；;：:]/.test(currentBody);
    const currentStartsFreshThought = /^(那|这个|我们|我先|我看|我觉得|她|他|你|行|还有|刚才|不过|反正|其实)/.test(currentBody);

    if (previousLooksReactive && currentLooksIndependent) {
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
            <h1 className="text-[16px] font-bold text-zinc-900">{group.name}</h1>
            <span className="text-[11px] text-zinc-500">{participantCount} 人</span>
          </div>
        </div>
        <button onClick={() => setShowGroupInfo(true)} className="p-2 text-zinc-400">
          <MoreVertical size={20} />
        </button>
      </div>

      <div className={layoutConfig.messageListClass} ref={scrollRef}>
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-[13px] text-red-500">
            {error}
          </div>
        )}
        {history.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const { senderName, avatar, content } = resolveSender(msg);
          const visualKind = getMessageVisualKind(msg, content);
          const previousMessage = history[idx - 1];
          const previousResolved = previousMessage ? resolveSender(previousMessage) : null;
          const previousVisualKind = previousMessage
            ? getMessageVisualKind(previousMessage, previousResolved?.content || '')
            : null;
          let sameSenderStreak = 0;
          for (let reverseIndex = idx - 1; reverseIndex >= 0; reverseIndex -= 1) {
            const streakMessage = history[reverseIndex];
            if (
              streakMessage.isSystem
              || streakMessage.role !== msg.role
              || streakMessage.senderCharacterId !== msg.senderCharacterId
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
            && previousMessage.senderCharacterId === msg.senderCharacterId
            && !shouldShowIndependentBlock;

          if (visualKind === 'notice') {
            return (
              <div key={idx} className="flex justify-center py-1">
                <div className="max-w-[88%] rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">NOTICE</div>
                  <div className="text-[14px] leading-6 text-zinc-700">{content.replace(/^\[notice\]\s*/i, '')}</div>
                </div>
              </div>
            );
          }

          return (
            <div key={idx} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${isGroupedWithPrevious ? 'mt-1.5' : 'mt-3'}`}>
              {isGroupedWithPrevious ? (
                <div className="h-10 w-10 shrink-0" />
              ) : (
                <GroupMessageAvatar
                  value={isUser ? userAvatar : avatar}
                  fallbackValue={isUser ? null : 'https://picsum.photos/seed/unknown/200'}
                  alt={isUser ? userName : senderName}
                />
              )}
              <div className={`flex max-w-[88%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                {!isUser && !isGroupedWithPrevious && <span className="mb-1 ml-1 text-[11px] text-zinc-400">{senderName}</span>}
                {msg.replyTo && (
                  <div className="mb-1 inline-flex max-w-[min(74%,28rem)] items-start gap-1.5 rounded-lg border-l-2 border-zinc-300 bg-zinc-50/80 px-2.5 py-1.5 text-zinc-600">
                    <Reply size={12} className="mt-0.5 shrink-0 text-zinc-400" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-zinc-500">回复 {msg.replyTo.authorLabel}</div>
                      <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-500 break-words">
                        {msg.replyTo.preview || getReplyPreviewText(msg)}
                      </div>
                    </div>
                  </div>
                )}
                <div
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
                      : `${visualKind === 'sticker' ? 'border border-pink-100 bg-pink-50/80 text-zinc-800' : 'border border-zinc-100 bg-white text-zinc-800'} ${isGroupedWithPrevious ? 'rounded-2xl shadow-[0_8px_20px_rgba(15,23,42,0.05)]' : 'rounded-2xl rounded-tl-sm shadow-[0_10px_24px_rgba(15,23,42,0.08)]'}`
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
                  <span className={`whitespace-pre-wrap break-words ${visualKind === 'sticker' ? 'text-[16px] leading-7' : ''}`}>
                    {renderTextWithMentions(content.replace(/^\[sticker\]\s*/i, ''))}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex gap-3">
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
                    <span className="text-[12px] text-zinc-600">发定位</span>
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
        {showGroupInfo && (
          <div className="absolute inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="flex max-h-[88vh] w-full flex-col rounded-t-[32px] bg-white p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-[18px] font-bold text-zinc-900">群信息</h3>
                  <p className="mt-1 text-[13px] text-zinc-500">{participantCount} 人</p>
                </div>
                <button onClick={() => setShowGroupInfo(false)} className="p-2 text-zinc-400">
                  <X size={20} />
                </button>
              </div>

              <div className="mb-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <GroupMessageAvatar value={groupAvatarDraft} fallbackValue={group.avatar} alt={group.name} />
                    <button
                      onClick={() => groupAvatarInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white shadow-md"
                    >
                      <Camera size={14} />
                    </button>
                    <input
                      ref={groupAvatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleGroupAvatarUpload}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 text-[13px] text-zinc-500">群名称</div>
                    <input
                      value={groupNameDraft}
                      onChange={(event) => setGroupNameDraft(event.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-[15px] text-zinc-900 outline-none focus:border-zinc-400"
                      placeholder="请输入群名称"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                <div className="text-[15px] font-semibold text-zinc-900">{group.name}</div>
                <div className="mt-3 flex items-center gap-2 text-[13px] text-zinc-500">
                  <Users size={16} />
                  当前成员
                </div>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <GroupMessageAvatar value={userAvatar} alt={userName} />
                    <div className="font-medium text-zinc-900">{userName}</div>
                  </div>
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3">
                      <GroupMessageAvatar value={member.avatar} alt={member.name} />
                      <div className="font-medium text-zinc-900">{member.remarkName?.trim() || member.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    if (!window.confirm('确认清空当前群聊记录吗？')) return;
                    onClearHistory();
                    setShowGroupInfo(false);
                  }}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700"
                >
                  <Trash2 size={16} />
                  清空聊天记录
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm('确认退出当前群聊吗？')) return;
                    setShowGroupInfo(false);
                    onLeaveGroup();
                  }}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-500"
                >
                  <LogOut size={16} />
                  退出群聊
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowGroupInfo(false)}
                  className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-700"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveGroupInfo}
                  disabled={!hasGroupInfoChanges || !groupNameDraft.trim()}
                  className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  保存修改
                </button>
              </div>
            </motion.div>
          </div>
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

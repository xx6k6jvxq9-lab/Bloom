import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  Image as ImageIcon,
  Keyboard,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  Mic,
  MoreVertical,
  Pencil,
  Forward,
  Plus,
  RefreshCw,
  RotateCcw,
  Reply,
  ScanEye,
  Send,
  Share2,
  Smile,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { AppSettings, Character, ChatGroup, ChatHistory, ChatMessage, FavoriteMessage, GroupPollOption, GroupRelayEntry, GroupTaskEntry, PerceptionSettings, WorldBookEntry } from '../../types';
import { generateTextFromMessagesWithConfig, type RuntimeChatMessage } from '../../services/ai/runtimeClient';
import { resolveSceneTextApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
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
import { GroupChatFunPanel } from './GroupChatFunPanel';
import {
  appendGroupRelayEntry,
  appendGroupTaskEntry,
  completeGroupPollMessage,
  completeGroupRelayMessage,
  createGroupPollMessage,
  createGroupRelayMessage,
  createGroupTaskMessage,
  updateGroupTaskMessage,
  voteOnGroupPollMessage,
} from './groupFeatureCards';
import { buildScopedBubbleThemeCss, buildScopedBubbleVariantCss, buildScopedElementThemeCss, extractBubbleTextStyle, hasBubbleThemeCss, parseBubbleStyleCss, sanitizeBubbleSurfaceStyle } from './bubbleStyleCss';
import { getThemeSelectedFontStack } from '../theme/themeTypography';
import { AudioMessageCard } from './AudioMessageCard';
import { useAudioMessageRecorder } from './useAudioMessageRecorder';
import { usePressToRecordInteraction } from './usePressToRecordInteraction';
import { selectActiveGroupWorldBooks } from '../group-world-book/selectActiveGroupWorldBooks';
import { ExpandedInputSheet } from './ExpandedInputSheet';
import { useAppKeyboard } from '../app-shell/AppKeyboardContext';

const BASIC_EMOJIS = ['😺', '😀', '😚', '😑', '😎', '😹', '😶', '❤️', '🙄', '🙏', '🎀', '🎉'];
const getGroupMessageSelectionKey = (message: ChatMessage) => (
  `${message.timestamp}::${message.role}::${message.senderCharacterId ?? ''}::${message.text}`
);

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

function parseGroupPollAiDecision(rawText: string, options: GroupPollOption[]) {
  const trimmed = rawText.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { option?: string; reason?: string };
      const matchedOption = options.find((option) => parsed.option?.includes(option.text) || option.text.includes(parsed.option || ''));
      if (matchedOption) {
        return {
          optionId: matchedOption.id,
          reason: (parsed.reason || '').trim(),
        };
      }
    } catch {
      // Ignore invalid JSON and fall back to plain-text matching.
    }
  }

  const matchedOption = options.find((option) => trimmed.includes(option.text)) ?? options[0];
  const reason = trimmed
    .replace(matchedOption?.text || '', '')
    .replace(/^[^：:]*[:：]\s*/, '')
    .trim();

  return {
    optionId: matchedOption?.id || options[0]?.id || '',
    reason,
  };
}

function buildGroupFeaturePersonaGuard(featureName: string) {
  return [
    `这是群聊里的${featureName}互动，不是单独开怼模式。`,
    '投票和表态必须优先符合角色自己的人设、表达习惯、稳定偏好、生活习惯和判断逻辑。',
    '如果长期记忆、短期记忆或当前生活状态里有相关偏好，可以把它们当依据；如果没有，就按角色此刻最自然的选择来。',
    '优先写“这个角色自己为什么会选这个”，而不是先围着用户或群里别人的关系去转。',
    '用户关系和群成员关系只能影响语气、站位和轻微偏向，不应该盖过角色自己的主见。',
    '轻话题默认只要轻表态、轻理由，不要为了显得“真实”就自动放大成毒舌、攻击或阴阳怪气。',
    '除非当前群里本来就张力很高，或者角色本来就会自然轻刺一句，否则不要凭空提高攻击性。',
    '最终效果应该像“这个人真的会这么投、也真的会这么接一句”，而不是像模板吐槽。',
  ].join('\n');
}

function parseGroupRelayAiLine(rawText: string) {
  const trimmed = rawText.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { line?: string };
      return (parsed.line || '').trim();
    } catch {
      // Ignore invalid JSON and fall back to plain text.
    }
  }

  return trimmed
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
    .replace(/^[^：:]*[:：]\s*/, '')
    .trim();
}

function parseGroupTaskAiEntry(rawText: string) {
  const trimmed = rawText.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { entry?: string; finished?: boolean };
      return {
        entry: (parsed.entry || '').trim(),
        finished: parsed.finished === true,
      };
    } catch {
      // Ignore invalid JSON and fall back to plain text.
    }
  }

  return {
    entry: trimmed
      .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
      .replace(/^[^：:]*[:：]\s*/, '')
      .trim(),
    finished: false,
  };
}

type GroupFeatureInitiativePlan =
  | { feature: 'none' }
  | { feature: 'poll'; title: string; options: string[] }
  | { feature: 'relay'; topic: string; starterText: string }
  | { feature: 'task'; prompt: string };

function parseGroupFeatureInitiativePlan(rawText: string): GroupFeatureInitiativePlan {
  const trimmed = rawText.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        feature?: string;
        title?: string;
        options?: string[];
        topic?: string;
        starterText?: string;
        prompt?: string;
      };
      const feature = (parsed.feature || '').trim().toLowerCase();

      if (feature === 'poll') {
        const options = Array.isArray(parsed.options)
          ? parsed.options.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
          : [];
        if ((parsed.title || '').trim() && options.length >= 2) {
          return {
            feature: 'poll',
            title: parsed.title!.trim(),
            options,
          };
        }
      }

      if (feature === 'relay') {
        const topic = (parsed.topic || '').trim();
        const starterText = (parsed.starterText || '').trim() || topic;
        if (topic) {
          return { feature: 'relay', topic, starterText };
        }
      }

      if (feature === 'task') {
        const prompt = (parsed.prompt || '').trim();
        if (prompt) {
          return { feature: 'task', prompt };
        }
      }
    } catch {
      // Ignore invalid JSON and fall back to none.
    }
  }

  return { feature: 'none' };
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
  if (text.startsWith('[image]')) {
    return '[图片]';
  }
  if (text.startsWith('[sticker]')) {
    return '[表情包]';
  }
  if (text.startsWith('[group-poll]')) {
    return '[群投票]';
  }
  if (text.startsWith('[group-relay]')) {
    return '[群接龙]';
  }
  if (text.startsWith('[group-task]')) {
    return '[群小任务]';
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

function clampGroupBubbleScale(value: number | undefined): number {
  return Math.min(1.3, Math.max(0.8, value ?? 1));
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
  patchCharacter,
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
  patchCharacter: (characterId: string, patch: Partial<Character>) => void;
  inviteableCharacters: Character[];
}) {
  const [input, setInput] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage['replyTo'] | null>(null);
  const [pendingShare, setPendingShare] = useState<ShareActionResult['payload'] | null>(null);
  const [showFunPanel, setShowFunPanel] = useState(false);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [showExpandInputToggle, setShowExpandInputToggle] = useState(false);
  const [chatFooterHeight, setChatFooterHeight] = useState(64);
  const [expandedAudioTranscriptKeys, setExpandedAudioTranscriptKeys] = useState<Set<string>>(new Set());
  const [activeGroupFeatureComposer, setActiveGroupFeatureComposer] = useState<'poll' | 'relay' | 'task' | null>(null);
  const [groupPollTitleDraft, setGroupPollTitleDraft] = useState('');
  const [groupPollOptionsDraft, setGroupPollOptionsDraft] = useState('选项一\n选项二');
  const [groupRelayTopicDraft, setGroupRelayTopicDraft] = useState('');
  const [groupTaskPromptDraft, setGroupTaskPromptDraft] = useState('');
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
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const preservedScrollTopRef = useRef<number | null>(null);
  const didTryOpeningRef = useRef(false);
  const previousSettingsOpenRef = useRef(false);
  const previousSettingsGroupIdRef = useRef(group.id);
  const latestGroupBackgroundRef = useRef(group.groupBackground || '');
  const lastProcessedInitiativeTriggerRef = useRef<number | null>(null);
  const lastInitiativeAtRef = useRef(0);
  const longPressTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatFooterRef = useRef<HTMLDivElement | null>(null);
  const {
    keyboardInset,
    keyboardVisible,
    visualViewportHeight,
  } = useAppKeyboard();
  const { getCharacterById, getCharacterByName } = createCharacterDirectory({ characters: members });
  const activeConfig = resolveSceneTextApiConfig({
    settings,
    scene: 'group-chat',
  }).runtimeConfig;
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
    { id: 'user', name: groupUserDisplayName, avatar: userAvatar, remarkName: undefined, role: actingRole, voiceEnabled: false },
    ...members.map((member) => ({
      id: member.id,
      name: member.name,
      remarkName: member.remarkName,
      avatar: member.avatar,
      role: resolveGroupMemberRole(group, member.id),
      badgeLabel: getGroupMemberBadge(group, member.id)?.label,
      badgeColor: getGroupMemberBadge(group, member.id)?.color,
      bubbleColor: getGroupMemberBubbleColor(group, member.id) || undefined,
      voiceEnabled: member.voiceProfile?.enabled === true,
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
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || isVoiceMode) {
      return;
    }

    const collapsedMaxHeight = 88;
    const expandedMaxHeight = 176;
    const toggleThreshold = 62;

    textarea.style.height = '0px';
    const nextScrollHeight = textarea.scrollHeight;
    const nextMaxHeight = isInputExpanded ? expandedMaxHeight : collapsedMaxHeight;
    textarea.style.height = `${Math.min(nextScrollHeight, nextMaxHeight)}px`;
    textarea.style.overflowY = nextScrollHeight > nextMaxHeight ? 'auto' : 'hidden';

    const shouldShowToggle = input.trim().length > 0 && nextScrollHeight > toggleThreshold;
    setShowExpandInputToggle(shouldShowToggle);

    if (!shouldShowToggle && isInputExpanded) {
      setIsInputExpanded(false);
    }
  }, [input, isInputExpanded, isVoiceMode]);

  useEffect(() => {
    if (
      typeof document === 'undefined'
      || !keyboardVisible
      || !keyboardInset
      || document.activeElement !== textareaRef.current
    ) {
      return;
    }

    requestAnimationFrame(() => {
      chatFooterRef.current?.scrollIntoView({ block: 'end' });
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
    });
  }, [keyboardInset, keyboardVisible, visualViewportHeight]);

  useEffect(() => {
    const footerNode = chatFooterRef.current;
    if (!footerNode || typeof window === 'undefined') {
      return;
    }

    const updateFooterHeight = () => {
      const measuredHeight = Math.ceil(footerNode.getBoundingClientRect().height);
      setChatFooterHeight(measuredHeight > 0 ? measuredHeight : 64);
    };

    updateFooterHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateFooterHeight);
      return () => {
        window.removeEventListener('resize', updateFooterHeight);
      };
    }

    const observer = new ResizeObserver(() => {
      updateFooterHeight();
    });
    observer.observe(footerNode);
    window.addEventListener('resize', updateFooterHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateFooterHeight);
    };
  }, [replyingTo, isVoiceMode, input, editingMessageIndex, showEmojiPanel, showFunPanel, isInputExpanded, settings.visualSettings?.chat?.uiScale]);

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
  const bubbleScale = clampGroupBubbleScale(settings.visualSettings?.chat?.bubbleScale);
  const groupTextBubbleWidthPercent = Math.min(96, Math.max(76, 86 + (bubbleScale - 1) * 20));
  const getGroupBubbleScaleStyle = ({
    basePaddingX,
    basePaddingY,
    maxWidthPercent,
    maxWidthRem,
  }: {
    basePaddingX: number;
    basePaddingY: number;
    maxWidthPercent?: number;
    maxWidthRem?: number;
  }): React.CSSProperties => ({
    paddingInline: `${basePaddingX * bubbleScale}px`,
    paddingBlock: `${basePaddingY * bubbleScale}px`,
    ...(maxWidthPercent && maxWidthRem
      ? { maxWidth: `min(${maxWidthPercent}%, ${maxWidthRem * bubbleScale}rem)` }
      : {}),
  });
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
    regenerateLatestReplyAt,
    requestManualReply,
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
      manualReplyEnabled: group.manualReplyEnabled,
      voiceRepliesEnabled: group.voiceRepliesEnabled,
      voiceReplyMemberIds: group.voiceReplyMemberIds,
      topicState: group.topicState,
      groupShortTermSummary: group.groupShortTermSummary,
      groupMemberPerspectiveSummaries: group.groupMemberPerspectiveSummaries,
      groupLongTermMemory: group.groupLongTermMemory,
    },
    history,
    setHistory,
    input,
    setInput,
    replyingTo,
    setReplyingTo,
    userName: groupUserDisplayName,
    directChatHistory,
    patchCharacter,
    perception,
    settings,
  });
  const { isRecording, startRecording, stopRecording, cancelRecording } = useAudioMessageRecorder({
    onRecorded: async ({ blob, durationMs, transcript }) => {
      const audioRef = await saveUploadedBlob(blob, {
        fileName: `group-voice-message-${Date.now()}.wav`,
        mimeType: 'audio/wav',
      });
      await sendAudioMessage(
        audioRef,
        'audio/wav',
        Math.max(1, Math.round(durationMs / 1000)),
        transcript,
      );
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
  const manualReplyModeEnabled = group.manualReplyEnabled !== false;
  const hasVisibleMessages = history.length > 0 || isLoading || !!error;
  const chatViewportHeight = keyboardVisible
    ? 'var(--app-visible-viewport-height, var(--app-viewport-height, 100dvh))'
    : 'var(--app-viewport-height, 100dvh)';
  const chatFooterStyle: React.CSSProperties = {
    paddingBottom: keyboardVisible ? '1px' : 'var(--app-safe-area-bottom-ui, 0px)',
    ...layoutConfig.inputContainerStyle,
    ...groupFooterStyle,
    transition: 'padding-bottom 180ms ease',
  };
  const chatMessageListStyle: React.CSSProperties = {
    minHeight: 0,
    paddingBottom: '8px',
    scrollPaddingBottom: `${chatFooterHeight + 12}px`,
  };
  const canUseManualReplyButton = manualReplyModeEnabled
    && hasUsableConfig
    && !isLoading
    && !pendingMessage
    && members.length > 0;
  const getLatestGroupModelSegment = useCallback(() => {
    let end = -1;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const message = history[index];
      if (message.isSystem || message.isRecalled) continue;
      if (message.role !== 'model') return null;
      end = index;
      break;
    }
    if (end < 0) return null;
    const speakerId = history[end]?.senderCharacterId;
    if (!speakerId) return null;
    let start = end;
    for (let index = end - 1; index >= 0; index -= 1) {
      const message = history[index];
      if (
        message.role !== 'model'
        || message.isSystem
        || message.isRecalled
        || message.senderCharacterId !== speakerId
      ) {
        break;
      }
      start = index;
    }
    return { start, end };
  }, [history]);
  const isEditableMessage = useCallback((message: ChatMessage | null | undefined) => (
    !!message
    && !message.isSystem
    && !message.isRecalled
    && !message.imageUrl
    && !message.audioUrl
    && !message.location
    && !message.isVoiceCall
    && !message.groupPollCard
    && !message.groupRelayCard
    && !message.groupTaskCard
    && !!message.text.trim()
  ), []);
  const canRegenerateMessage = useCallback((index: number, message: ChatMessage | null | undefined) => {
    if (!message || message.role !== 'model' || message.isSystem || message.isRecalled || isLoading) {
      return false;
    }
    const segment = getLatestGroupModelSegment();
    return !!segment && index >= segment.start && index <= segment.end;
  }, [getLatestGroupModelSegment, isLoading]);
  const canBacktrackMessage = useCallback((message: ChatMessage | null | undefined) => (
    !!message
    && !message.isSystem
    && !message.isRecalled
    && !isLoading
  ), [isLoading]);

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
        bubbleColor: getGroupMemberBubbleColor(group, 'user'),
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
        bubbleColor: getGroupMemberBubbleColor(group, 'user'),
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

  const handleStartEdit = () => {
    if (!contextMenuMessage || contextMenuMessageIndex < 0 || !isEditableMessage(contextMenuMessage)) {
      closeContextMenu();
      return;
    }

    setEditingMessageIndex(contextMenuMessageIndex);
    setInput(contextMenuMessage.text);
    setReplyingTo(null);
    setIsVoiceMode(false);
    closeContextMenu();
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
    setInput('');
  };

  const handleSaveEdit = () => {
    if (editingMessageIndex === null) {
      return;
    }
    const targetMessage = history[editingMessageIndex];
    const nextText = input.trim();
    if (!targetMessage || !nextText) {
      return;
    }
    preservedScrollTopRef.current = scrollRef.current?.scrollTop ?? null;
    setHistory((prev) => prev.map((message, index) => (
      index === editingMessageIndex
        ? { ...message, text: nextText, isEdited: true }
        : message
    )));
    setEditingMessageIndex(null);
    setInput('');
  };

  const handleRegenerate = async () => {
    if (!contextMenuMessage || contextMenuMessageIndex < 0 || !canRegenerateMessage(contextMenuMessageIndex, contextMenuMessage)) {
      closeContextMenu();
      return;
    }

    closeContextMenu();
    await regenerateLatestReplyAt(contextMenuMessageIndex);
  };

  const handleBacktrack = () => {
    if (!contextMenuMessage || contextMenuMessageIndex < 0 || !canBacktrackMessage(contextMenuMessage)) {
      closeContextMenu();
      return;
    }

    setHistory(history.slice(0, contextMenuMessageIndex + 1));
    setReplyingTo(null);
    setEditingMessageIndex(null);
    setInput('');
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

  const handleToggleTranscript = () => {
    if (!contextMenuMessage || !contextMenuMessage.audioUrl || !contextMenuMessage.audioTranscript) {
      closeContextMenu();
      return;
    }

    const messageKey = getGroupMessageSelectionKey(contextMenuMessage);
    setExpandedAudioTranscriptKeys((prev) => {
      const next = new Set(prev);
      if (next.has(messageKey)) {
        next.delete(messageKey);
      } else {
        next.add(messageKey);
      }
      return next;
    });
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

  const publishGroupFeatureNotice = (noticeText: string) => {
    const trimmedNotice = noticeText.trim();
    if (!trimmedNotice) return;
    const noticeMessage: ChatMessage = {
      role: 'model',
      text: `[notice] ${trimmedNotice}`,
      timestamp: Date.now(),
      isSystem: true,
    };
    setHistory((prev) => [...prev, noticeMessage]);
    void reactToNoticeUpdate({
      noticeText: trimmedNotice,
      currentHistory: [...history, noticeMessage],
    });
  };

  const runAiVotesForPoll = async (params: { pollMessage: ChatMessage; pollOptions: string[] }) => {
    if (!params.pollMessage.groupPollCard || !activeConfig || !hasUsableConfig) {
      return;
    }

    let workingHistory = [...history, params.pollMessage];
    for (const member of members) {
      try {
        const systemPrompt = buildGroupChatPrompt({
          sceneInput: buildGroupChatSceneInput({
            speaker: member,
            members,
            group,
            history: workingHistory,
            userName: groupUserDisplayName,
            directChatHistory,
          }),
        });

        const response = await generateTextFromMessagesWithConfig({
          activeConfig,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                `群里刚发起了一条投票：《${params.pollMessage.groupPollCard.title}》`,
                `可选项：${params.pollOptions.join('、')}`,
                buildGroupFeaturePersonaGuard('投票'),
                '请先判断：如果完全不考虑用户，只按这个角色自己的偏好、生活方式、兴趣和判断逻辑，他最可能投什么。',
                '再判断：当前群聊语境和关系会不会让他在表达上稍微偏一下，但不要改变他最核心的选择理由。',
                '然后用群里自然说话的方式，补一句很短的真实反应或原因。',
                '这句反应优先像自然表态，最好带一点角色自己的思路、习惯或生活感，不要默认带攻击性；如果只是轻松话题，就保持轻一点。',
                '只输出 JSON，不要解释。',
                '格式：{"option":"原样填写你选的选项","reason":"一句群聊短反应，不超过18字"}',
              ].join('\n'),
            },
          ],
        });

        const parsed = parseGroupPollAiDecision(response, params.pollMessage.groupPollCard.options);
        if (!parsed.optionId) {
          continue;
        }

        const selectedOptionText =
          params.pollMessage.groupPollCard.options.find((item) => item.id === parsed.optionId)?.text || '这个';
        const reasonText = parsed.reason.trim() || `我投 ${selectedOptionText}。`;
        const reactionMessage: ChatMessage = {
          role: 'model',
          text: reasonText,
          timestamp: Date.now() + Math.floor(Math.random() * 120),
          senderCharacterId: member.id,
        };

        setHistory((prev) => prev.map((message) => {
          if (message.timestamp !== params.pollMessage.timestamp || !message.groupPollCard) {
            return message;
          }
          return voteOnGroupPollMessage({
            message,
            voterId: member.id,
            optionId: parsed.optionId,
          });
        }).concat(reactionMessage));

        workingHistory = workingHistory.map((message) => {
          if (message.timestamp !== params.pollMessage.timestamp || !message.groupPollCard) {
            return message;
          }
          return voteOnGroupPollMessage({
            message,
            voterId: member.id,
            optionId: parsed.optionId,
          });
        }).concat(reactionMessage);
      } catch {
        // Ignore a single member failure and keep the rest of the poll flow running.
      }
    }

    setHistory((prev) => prev.map((message) => {
      if (message.timestamp !== params.pollMessage.timestamp || !message.groupPollCard) {
        return message;
      }
      return completeGroupPollMessage(message);
    }));
  };

  const runAiRelayEntries = async (params: { relayMessage: ChatMessage }) => {
    if (!params.relayMessage.groupRelayCard || !activeConfig || !hasUsableConfig) {
      return;
    }

    let workingHistory = [...history, params.relayMessage];
    for (const member of members) {
      try {
        const currentRelayCard = workingHistory.find(
          (message) => message.timestamp === params.relayMessage.timestamp,
        )?.groupRelayCard || params.relayMessage.groupRelayCard;

        const systemPrompt = buildGroupChatPrompt({
          sceneInput: buildGroupChatSceneInput({
            speaker: member,
            members,
            group,
            history: workingHistory,
            userName: groupUserDisplayName,
            directChatHistory,
          }),
        });

        const response = await generateTextFromMessagesWithConfig({
          activeConfig,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                `群里正在玩接龙，主题是：《${currentRelayCard.topic}》`,
                '当前已经接到这里：',
                ...currentRelayCard.entries.map((entry) => `- ${entry.authorName}：${entry.content}`),
                buildGroupFeaturePersonaGuard('接龙'),
                '请按角色自己的思路和语气，顺着上一句自然接一句。',
                '优先让这句像角色自己会接的内容，可以带一点他的习惯、偏好、脑回路或生活感。',
                '不要复读前一句，不要改写别人的句子，不要突然变成长回复。',
                '只输出 JSON，不要解释。',
                '格式：{"line":"接龙里要发出的下一句，不超过20字"}',
              ].join('\n'),
            },
          ],
        });

        const line = parseGroupRelayAiLine(response);
        if (!line) {
          continue;
        }

        setHistory((prev) => prev.map((message) => {
          if (message.timestamp !== params.relayMessage.timestamp || !message.groupRelayCard) {
            return message;
          }
          return appendGroupRelayEntry({
            message,
            authorId: member.id,
            authorName: member.remarkName?.trim() || member.name,
            content: line,
          });
        }));

        workingHistory = workingHistory.map((message) => {
          if (message.timestamp !== params.relayMessage.timestamp || !message.groupRelayCard) {
            return message;
          }
          return appendGroupRelayEntry({
            message,
            authorId: member.id,
            authorName: member.remarkName?.trim() || member.name,
            content: line,
          });
        });
      } catch {
        // Ignore a single member failure and keep the rest of the relay flow running.
      }
    }

    setHistory((prev) => prev.map((message) => {
      if (message.timestamp !== params.relayMessage.timestamp || !message.groupRelayCard) {
        return message;
      }
      return completeGroupRelayMessage(message);
    }));
  };

  const runAiTaskEntries = async (params: { taskMessage: ChatMessage }) => {
    if (!params.taskMessage.groupTaskCard || !activeConfig || !hasUsableConfig) {
      return;
    }

    let workingHistory = [...history, params.taskMessage];
    const maxRounds = 3;
    let currentRound = 0;
    let taskCompleted = false;

    while (currentRound < maxRounds && !taskCompleted) {
      currentRound += 1;
      let roundMessageCount = 0;
      let finishSignals = 0;

      for (const member of members) {
        try {
          const currentTaskCard = workingHistory.find(
            (message) => message.timestamp === params.taskMessage.timestamp,
          )?.groupTaskCard || params.taskMessage.groupTaskCard;

          const systemPrompt = buildGroupChatPrompt({
            sceneInput: buildGroupChatSceneInput({
              speaker: member,
              members,
              group,
              history: workingHistory,
              userName: groupUserDisplayName,
              directChatHistory,
            }),
          });

          const response = await generateTextFromMessagesWithConfig({
            activeConfig,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  `群里正在做一个小任务：《${currentTaskCard.prompt}》`,
                  `当前是第 ${currentRound} 轮。`,
                  '任务卡片只负责发起和显示状态，真正参与任务时要像正常群聊一样用普通消息气泡发言。',
                  '最近和这个任务有关的内容：',
                  ...workingHistory
                    .filter((message) => message.timestamp >= params.taskMessage.timestamp)
                    .slice(-12)
                    .map((message) => {
                      if (message.groupTaskCard) {
                        return `- 任务卡：${message.groupTaskCard.prompt}（状态：${message.groupTaskCard.status}）`;
                      }
                      const resolvedSender = resolveSenderInfo(message);
                      return `- ${resolvedSender.senderName}：${resolvedSender.content}`;
                    }),
                  buildGroupFeaturePersonaGuard('小任务'),
                  '请先判断：如果完全不考虑用户，只按这个角色自己的偏好、生活习惯、兴趣、判断逻辑和当前状态，他现在最自然会怎么参与这个任务。',
                  '如果任务已经自然完成，或者这个角色此刻不需要再补一句，也可以选择不发。',
                  '如果要发，就用正常群聊消息的口吻回答，不要写成系统卡片文案。',
                  '只输出 JSON，不要解释。',
                  '格式：{"entry":"这轮要发出的正常群聊消息，不超过22字；如果不发就留空","finished":true/false}',
                ].join('\n'),
              },
            ],
          });

          const parsed = parseGroupTaskAiEntry(response);
          if (parsed.finished) {
            finishSignals += 1;
          }

          if (!parsed.entry) {
            continue;
          }

          const reactionMessage: ChatMessage = {
            role: 'model',
            text: parsed.entry,
            timestamp: Date.now() + Math.floor(Math.random() * 120),
            senderCharacterId: member.id,
          };

          workingHistory = workingHistory.map((message) => {
            if (message.timestamp !== params.taskMessage.timestamp || !message.groupTaskCard) {
              return message;
            }
            return updateGroupTaskMessage({
              message: appendGroupTaskEntry({
                message,
                authorId: member.id,
                authorName: member.remarkName?.trim() || member.name,
                content: parsed.entry,
              }),
              participantId: member.id,
              rounds: currentRound,
            });
          }).concat(reactionMessage);

          setHistory(workingHistory);
          roundMessageCount += 1;
        } catch {
          // Ignore a single member failure and keep the rest of the task flow running.
        }
      }

      const shouldComplete =
        roundMessageCount === 0
        || finishSignals >= Math.ceil(members.length / 2)
        || currentRound >= maxRounds;

      if (shouldComplete) {
        taskCompleted = true;
        workingHistory = workingHistory.map((message) => {
          if (message.timestamp !== params.taskMessage.timestamp || !message.groupTaskCard) {
            return message;
          }
          return updateGroupTaskMessage({
            message,
            rounds: currentRound,
            status: 'completed',
          });
        });
        setHistory(workingHistory);
      }
    }
  };

  const launchGroupFeatureFromPlan = (params: {
    initiatorId: string;
    initiatorName: string;
    role: ChatMessage['role'];
    senderCharacterId?: string;
    plan: GroupFeatureInitiativePlan;
  }) => {
    if (params.plan.feature === 'poll') {
      const pollMessage = createGroupPollMessage({
        title: params.plan.title,
        options: params.plan.options,
        creatorName: params.initiatorName,
        senderCharacterId: params.senderCharacterId,
      });
      setHistory((prev) => [...prev, pollMessage]);
      void runAiVotesForPoll({
        pollMessage,
        pollOptions: params.plan.options,
      });
      return;
    }

    if (params.plan.feature === 'relay') {
      const relayMessage = createGroupRelayMessage({
        topic: params.plan.topic,
        starterText: params.plan.starterText,
        creatorId: params.initiatorId,
        creatorName: params.initiatorName,
        role: params.role,
        senderCharacterId: params.senderCharacterId,
      });
      setHistory((prev) => [...prev, relayMessage]);
      void runAiRelayEntries({
        relayMessage,
      });
      return;
    }

    if (params.plan.feature === 'task') {
      const taskMessage = createGroupTaskMessage({
        prompt: params.plan.prompt,
        creatorId: params.initiatorId,
        creatorName: params.initiatorName,
        role: params.role,
        senderCharacterId: params.senderCharacterId,
      });
      setHistory((prev) => [...prev, taskMessage]);
      void runAiTaskEntries({
        taskMessage,
      });
    }
  };

  const handleLaunchGroupPoll = () => {
    const title = groupPollTitleDraft.trim();
    const options = groupPollOptionsDraft
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);

    if (!title || options.length < 2) return;

    launchGroupFeatureFromPlan({
      initiatorId: 'user',
      initiatorName: groupUserDisplayName,
      role: 'user',
      plan: {
        feature: 'poll',
        title,
        options,
      },
    });
    setGroupPollTitleDraft('');
    setGroupPollOptionsDraft('选项一\n选项二');
    setActiveGroupFeatureComposer(null);
    setShowFunPanel(false);
  };

  const handleLaunchGroupRelay = () => {
    const topic = groupRelayTopicDraft.trim();
    if (!topic) return;

    launchGroupFeatureFromPlan({
      initiatorId: 'user',
      initiatorName: groupUserDisplayName,
      role: 'user',
      plan: {
        feature: 'relay',
        topic,
        starterText: topic,
      },
    });
    setGroupRelayTopicDraft('');
    setActiveGroupFeatureComposer(null);
    setShowFunPanel(false);
  };

  const handleLaunchGroupTask = () => {
    const prompt = groupTaskPromptDraft.trim();
    if (!prompt) return;

    launchGroupFeatureFromPlan({
      initiatorId: 'user',
      initiatorName: groupUserDisplayName,
      role: 'user',
      plan: {
        feature: 'task',
        prompt,
      },
    });
    setGroupTaskPromptDraft('');
    setActiveGroupFeatureComposer(null);
    setShowFunPanel(false);
  };

  const handleVoteOnPoll = (messageTimestamp: number, optionId: string) => {
    setHistory((prev) => prev.map((message) => {
      if (message.timestamp !== messageTimestamp || !message.groupPollCard) {
        return message;
      }
      return voteOnGroupPollMessage({
        message,
        voterId: 'user',
        optionId,
      });
    }));
  };

  useEffect(() => {
    if (!activeConfig || !hasUsableConfig || isLoading || pendingMessage || members.length === 0) {
      return;
    }

    const recentNormalMessages = history.filter((message) => (
      !message.isSystem
      && !message.groupPollCard
      && !message.groupRelayCard
      && !message.groupTaskCard
    ));
    const latestUserMessage = [...recentNormalMessages].reverse().find((message) => message.role === 'user');
    if (!latestUserMessage) {
      return;
    }

    if (lastProcessedInitiativeTriggerRef.current === latestUserMessage.timestamp) {
      return;
    }

    const followupMessages = recentNormalMessages.filter((message) => message.timestamp > latestUserMessage.timestamp);
    if (followupMessages.length < 2) {
      return;
    }

    const latestFeatureMessage = [...history].reverse().find((message) => (
      message.groupPollCard || message.groupRelayCard || message.groupTaskCard
    ));
    const recentMessages = history.slice(-12);
    const featureInRecentWindow = recentMessages.some((message) => (
      message.groupPollCard || message.groupRelayCard || message.groupTaskCard
    ));

    if (featureInRecentWindow) {
      lastProcessedInitiativeTriggerRef.current = latestUserMessage.timestamp;
      return;
    }

    if (
      latestFeatureMessage
      && latestUserMessage.timestamp - latestFeatureMessage.timestamp < 8 * 60 * 1000
    ) {
      lastProcessedInitiativeTriggerRef.current = latestUserMessage.timestamp;
      return;
    }

    if (Date.now() - lastInitiativeAtRef.current < 30 * 1000) {
      return;
    }

    lastProcessedInitiativeTriggerRef.current = latestUserMessage.timestamp;

    if (recentNormalMessages.length < 6 || Math.random() > 0.16) {
      return;
    }

    const initiator = members[Math.floor(Math.random() * members.length)];
    if (!initiator) {
      return;
    }

    let cancelled = false;

    const runInitiative = async () => {
      try {
        const systemPrompt = buildGroupChatPrompt({
          sceneInput: buildGroupChatSceneInput({
            speaker: initiator,
            members,
            group,
            history,
            userName: groupUserDisplayName,
            directChatHistory,
            perception,
          }),
        });

        const response = await generateTextFromMessagesWithConfig({
          activeConfig,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                '请判断：这个角色现在要不要顺势在群里主动发起一个轻量群功能。',
                '目标是低频、顺势、像这个角色自己临场起意，不要像系统推送。',
                '优先看角色自己的生活感、兴趣、习惯、判断逻辑和当前状态，再看最近群聊气氛，关系只做修饰。',
                '如果最近已经发过类似功能，或者气氛不适合，就不要发起。',
                '可选功能只有：poll / relay / task / none。',
                'poll 适合轻选择和分歧；relay 适合顺着气氛玩一句；task 适合“每人来一个”的轻任务。',
                '如果选择 poll，给出 title 和 2-4 个 options。',
                '如果选择 relay，给出 topic 和 starterText。',
                '如果选择 task，给出 prompt。',
                '只输出 JSON，不要解释。',
                '格式：{"feature":"none"} 或 {"feature":"poll","title":"...","options":["...","..."]} 或 {"feature":"relay","topic":"...","starterText":"..."} 或 {"feature":"task","prompt":"..."}',
              ].join('\n'),
            },
          ],
        });

        if (cancelled) {
          return;
        }

        const plan = parseGroupFeatureInitiativePlan(response);
        if (plan.feature === 'none') {
          return;
        }

        lastInitiativeAtRef.current = Date.now();
        launchGroupFeatureFromPlan({
          initiatorId: initiator.id,
          initiatorName: initiator.remarkName?.trim() || initiator.name,
          role: 'model',
          senderCharacterId: initiator.id,
          plan,
        });
      } catch {
        // Ignore initiative failure and keep the normal group flow running.
      }
    };

    void runInitiative();

    return () => {
      cancelled = true;
    };
  }, [
    activeConfig,
    directChatHistory,
    group,
    groupUserDisplayName,
    hasUsableConfig,
    history,
    isLoading,
    members,
    pendingMessage,
    perception,
    setHistory,
  ]);

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
      voiceReplyMemberIds: (group.voiceReplyMemberIds || []).filter((id) => id !== memberId),
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
    const isUserMember = memberId === 'user';
    const member = members.find((item) => item.id === memberId);
    if (!isUserMember && !member) {
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
    if (message.groupPollCard) {
      return 'poll' as const;
    }

    if (message.groupRelayCard) {
      return 'relay' as const;
    }

    if (message.groupTaskCard) {
      return 'task' as const;
    }

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
      .replace(/^\[(?:quote|reply|reply to|回复)\s*[:：]\s*[^\]]+\]\s*/i, '')
      .trim();
  };

  const shouldBreakGroupedBubble = (params: {
    previousMessage?: ChatMessage;
    previousContent: string;
    currentMessage: ChatMessage;
    currentContent: string;
    streakIndex: number;
    previousVisualKind: 'notice' | 'sticker' | 'reply' | 'normal' | 'poll' | 'relay' | 'task';
    currentVisualKind: 'notice' | 'sticker' | 'reply' | 'normal' | 'poll' | 'relay' | 'task';
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
      style={{
        ...(chatFontFamily ? { fontFamily: chatFontFamily } : {}),
        height: chatViewportHeight,
        minHeight: chatViewportHeight,
      }}
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

      <div className={`${layoutConfig.messageListClass} relative z-10 ${hasVisibleMessages ? '' : 'flex flex-col justify-end'}`} ref={scrollRef} style={chatMessageListStyle}>
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

          if (visualKind === 'poll' && msg.groupPollCard) {
            const totalVotes = msg.groupPollCard.options.reduce((sum, option) => sum + option.voterIds.length, 0);
            const userVotedOptionId = msg.groupPollCard.options.find((option) => option.voterIds.includes('user'))?.id;
            const pollStatus = msg.groupPollCard.status === 'completed' ? 'completed' : 'active';

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
                  <div className="w-full max-w-[88%] rounded-[24px] border border-zinc-200 bg-white/92 px-4 py-4 shadow-sm backdrop-blur-sm">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">投票</div>
                    <div className="text-[16px] font-semibold text-zinc-900">{msg.groupPollCard.title}</div>
                    <div className="mt-1 text-[12px] text-zinc-500">
                      {msg.groupPollCard.createdBy} 发起 · {pollStatus === 'completed' ? '已结束' : '进行中'} · 共 {totalVotes} 票
                    </div>
                    <div className="mt-4 space-y-2.5">
                      {msg.groupPollCard.options.map((option) => {
                        const isSelected = userVotedOptionId === option.id;
                        const ratio = totalVotes > 0 ? (option.voterIds.length / totalVotes) * 100 : 0;
                        return (
                          <button
                            key={option.id}
                            onClick={() => {
                              if (pollStatus === 'completed') return;
                              handleVoteOnPoll(msg.timestamp, option.id);
                            }}
                            className={`relative w-full overflow-hidden rounded-2xl border px-3 py-3 text-left transition-colors ${
                              isSelected
                                ? 'border-zinc-300 bg-zinc-100'
                                : 'border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100/80'
                            } ${pollStatus === 'completed' ? 'cursor-default opacity-90' : ''}`}
                          >
                            <div
                              className="absolute inset-y-0 left-0 rounded-2xl bg-zinc-200/70"
                              style={{ width: `${Math.max(ratio, 0)}%` }}
                            />
                            <div className="relative flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[14px] font-medium text-zinc-900">{option.text}</div>
                                <div className="mt-1 text-[12px] text-zinc-500">
                                  {option.voterIds.length > 0 ? `${option.voterIds.length} 人支持` : '还没有人投'}
                                </div>
                              </div>
                              <div className="shrink-0 text-[12px] font-medium text-zinc-600">
                                {Math.round(ratio)}%
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (visualKind === 'relay' && msg.groupRelayCard) {
            const relayStatus = msg.groupRelayCard.status === 'completed' ? 'completed' : 'active';
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
                  <div className="w-full max-w-[88%] rounded-[24px] border border-zinc-200 bg-white/92 px-4 py-4 shadow-sm backdrop-blur-sm">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">接龙</div>
                    <div className="text-[16px] font-semibold text-zinc-900">{msg.groupRelayCard.topic}</div>
                    <div className="mt-1 text-[12px] text-zinc-500">
                      {msg.groupRelayCard.createdBy} 发起 · {relayStatus === 'completed' ? '已结束' : '进行中'} · 已接 {msg.groupRelayCard.entries.length} 句
                    </div>
                    <div className="mt-4 space-y-2.5">
                      {msg.groupRelayCard.entries.map((entry: GroupRelayEntry, entryIndex) => (
                        <div
                          key={entry.id || `${entry.authorId}-${entryIndex}`}
                          className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-3 py-3"
                        >
                          <div className="text-[12px] font-medium text-zinc-500">{entry.authorName}</div>
                          <div className="mt-1 text-[14px] leading-6 text-zinc-900">{entry.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (visualKind === 'task' && msg.groupTaskCard) {
            const taskRounds = typeof msg.groupTaskCard.rounds === 'number' ? msg.groupTaskCard.rounds : 0;
            const taskParticipantIds = Array.isArray(msg.groupTaskCard.participantIds) ? msg.groupTaskCard.participantIds : [];
            const taskStatus = msg.groupTaskCard.status === 'completed' ? 'completed' : 'active';
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
                  <div className="w-full max-w-[88%] rounded-[24px] border border-zinc-200 bg-white/92 px-4 py-4 shadow-sm backdrop-blur-sm">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">小任务</div>
                    <div className="text-[16px] font-semibold text-zinc-900">{msg.groupTaskCard.prompt}</div>
                    <div className="mt-1 text-[12px] text-zinc-500">
                      {msg.groupTaskCard.createdBy} 发起 · {taskStatus === 'completed' ? '已结束' : '进行中'}
                    </div>
                    <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[13px] font-medium text-zinc-700">
                          已进行 {taskRounds} 轮
                        </div>
                        <div className="text-[12px] text-zinc-500">
                          已参与 {taskParticipantIds.length} 人
                        </div>
                      </div>
                      <div className="mt-2 text-[12px] leading-5 text-zinc-500">
                        任务发起后，成员会用下面的正常消息气泡继续参与，直到任务自然结束。
                      </div>
                    </div>
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
          const effectiveBubbleColor = bubbleColor || senderBubbleColor;
          const shouldUseCustomMemberBubble =
            !msg.isSystem
            && !msg.imageUrl
            && visualKind !== 'sticker'
            && !isPendingMessage
            && !hasSenderBubbleCustomization
            && !(isUser ? false : senderCharacter?.bubbleImage)
            && !!effectiveBubbleColor;
          const memberBubbleTextColor = shouldUseCustomMemberBubble ? getReadableTextColor(effectiveBubbleColor!) : '#111827';
          const memberBubbleStyle = shouldUseCustomMemberBubble
            ? {
                backgroundColor: effectiveBubbleColor!,
                borderColor: effectiveBubbleColor!,
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
                  <div className={`chat-reply-preview mb-1 inline-flex max-w-[min(82%,32rem)] items-start gap-2 rounded-2xl border px-3 py-2 backdrop-blur-sm ${
                    isUser
                      ? 'border-white/18 bg-white/16 text-white'
                      : 'border-zinc-200/80 bg-white/70 text-zinc-700'
                  }`}>
                    <Reply size={13} className={`mt-0.5 shrink-0 ${isUser ? 'text-white/72' : 'text-zinc-400'}`} />
                    <div className="min-w-0">
                      <div className={`text-[11px] font-medium ${isUser ? 'text-white/72' : 'text-zinc-500'}`}>
                        回复 {msg.replyTo.authorLabel}
                      </div>
                      <div className={`mt-0.5 max-w-[min(60vw,24rem)] line-clamp-2 text-[12px] leading-5 break-words ${isUser ? 'text-white/82' : 'text-zinc-600'}`}>
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
                      const hasSenderBubbleSurfaceCustomization = !!senderBubbleImageUrl || (!!senderBubbleColor && !bubbleColor);
                      const hasSenderBubbleOverride =
                        !!senderBubbleStyleCss?.trim() || hasSenderBubbleSurfaceCustomization;
                      const shouldUseResolvedMemberBubble =
                        !msg.isSystem
                        && !msg.imageUrl
                        && visualKind !== 'sticker'
                        && !isPendingMessage
                        && !hasSenderBubbleOverride
                        && !hasSenderBubbleSurfaceCustomization
                        && !!effectiveBubbleColor;
                      const resolvedMemberBubbleTextColor = shouldUseResolvedMemberBubble ? getReadableTextColor(effectiveBubbleColor!) : '#111827';
                      const resolvedMemberBubbleStyle = shouldUseResolvedMemberBubble
                        ? {
                            backgroundColor: effectiveBubbleColor!,
                            borderColor: effectiveBubbleColor!,
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
                                ...getGroupBubbleScaleStyle({
                                  basePaddingX: 16,
                                  basePaddingY: 10,
                                  maxWidthPercent: groupTextBubbleWidthPercent,
                                  maxWidthRem: 28,
                                }),
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
                      transcript={msg.audioTranscript || null}
                      translation={msg.translation || null}
                      showTranscript={!!msg.audioTranscript}
                      autoPlay={msg.role === 'model' && !!senderCharacter?.voiceProfile?.autoPlay}
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
                      {renderTextWithMentions(getReadableMessageBody(msg, content), isUser ? 'outgoing' : 'incoming')}
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
                    {msg.isEdited && <span className="ml-1">已编辑</span>}
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
            <div
              className="chat-loading-bubble rounded-2xl rounded-tl-sm border border-zinc-100 bg-white px-4 py-3 shadow-sm"
              style={getGroupBubbleScaleStyle({
                basePaddingX: 16,
                basePaddingY: 12,
                maxWidthPercent: groupTextBubbleWidthPercent,
                maxWidthRem: 12,
              })}
            >
              <div className="flex gap-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                <div className="delay-75 h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                <div className="delay-150 h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
              </div>
            </div>
          </div>
        )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <div ref={chatFooterRef} className={`chat-session-footer chat-footer ${groupFooterClassName}`} style={chatFooterStyle}>
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
        {editingMessageIndex !== null && history[editingMessageIndex] && (
          <div className="chat-footer-reply-preview flex items-center justify-between rounded-xl border border-amber-200/70 bg-amber-50/90 px-3 py-2 text-[13px] text-amber-700">
            <div className="chat-footer-reply-preview-content flex items-center gap-2 truncate">
              <Pencil size={14} className="shrink-0" />
              <span className="shrink-0 font-medium">编辑消息</span>
              <span className="truncate">{history[editingMessageIndex]?.text}</span>
            </div>
            <button onClick={handleCancelEdit} className="chat-footer-reply-close-button shrink-0 rounded-full p-1 hover:bg-amber-100">
              <X size={14} className="chat-footer-reply-close-icon" />
            </button>
          </div>
        )}

        <div className="chat-footer-controls flex items-end gap-1.5">
          <button
            onClick={() => {
              setIsVoiceMode((prev) => !prev);
              setIsInputExpanded(false);
            }}
            className={`chat-footer-voice-toggle-button flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full transition-all ${
              isVoiceMode ? 'bg-zinc-100 text-zinc-800' : groupFooterControlTone.iconButton
            }`}
          >
            {isVoiceMode ? <Keyboard size={19} className="chat-footer-voice-toggle-icon" /> : <Mic size={19} className="chat-footer-voice-toggle-icon" />}
          </button>

          {manualReplyModeEnabled && (
            <button
              type="button"
              onClick={() => {
                void requestManualReply();
                if (showEmojiPanel) setShowEmojiPanel(false);
                if (showFunPanel) setShowFunPanel(false);
              }}
              disabled={!canUseManualReplyButton}
              title="手动回复"
              aria-label="手动回复"
              className={`chat-footer-manual-reply-button flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full transition-all ${
                canUseManualReplyButton
                  ? `${groupFooterControlTone.iconButton} active:scale-90`
                  : 'cursor-not-allowed bg-zinc-100/70 text-zinc-300'
              }`}
            >
              <MessageCircle size={18} className="chat-footer-manual-reply-icon" />
            </button>
          )}

          <div className={`chat-footer-input-shell flex min-h-9 flex-1 items-end gap-2 rounded-2xl border px-3 py-1.5 focus-within:border-blue-500 ${groupFooterControlTone.inputShell}`}>
            {isVoiceMode ? (
              <button
                onPointerDown={audioRecordInteraction.onPointerDown}
                onPointerUp={audioRecordInteraction.onPointerUp}
                onPointerCancel={audioRecordInteraction.onPointerCancel}
                onPointerLeave={audioRecordInteraction.onPointerLeave}
                className={`chat-footer-voice-button flex h-9 w-full items-center justify-center rounded-2xl text-[15px] font-medium transition-all active:scale-[0.98] select-none ${
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
              onFocus={() => {
                requestAnimationFrame(() => {
                  chatFooterRef.current?.scrollIntoView({ block: 'end' });
                });
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (editingMessageIndex !== null) {
                    handleSaveEdit();
                  } else {
                    void sendText();
                  }
                }
              }}
              placeholder={editingMessageIndex !== null ? '编辑消息...' : '发送消息...'}
              className="chat-footer-textarea min-h-[24px] w-full resize-none bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-500"
              rows={1}
            />
            <button
              type="button"
              onClick={() => {
                setIsInputExpanded((prev) => !prev);
              }}
              className={`chat-footer-expand-button shrink-0 p-1 transition-colors ${
                showExpandInputToggle
                  ? footerStyleType === 'transparent' || footerStyleType === 'glass'
                    ? 'text-zinc-500 hover:text-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-600'
                  : 'hidden'
              }`}
              aria-label={isInputExpanded ? '收起输入框' : '展开输入框'}
              title={isInputExpanded ? '收起输入框' : '展开输入框'}
            >
              {isInputExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
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
              onClick={() => {
                if (editingMessageIndex !== null) {
                  handleSaveEdit();
                } else {
                  void sendText();
                }
              }}
              className="chat-footer-send-button flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-900 transition-all hover:bg-zinc-200 active:scale-90"
            >
              <Send size={18} className="chat-footer-send-icon" />
            </button>
          ) : (
            <button
              onClick={() => {
                setShowFunPanel(!showFunPanel);
                if (showEmojiPanel) setShowEmojiPanel(false);
              }}
              className={`chat-footer-plus-button flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full transition-all ${
                showFunPanel ? 'rotate-45 bg-zinc-100 text-zinc-800' : groupFooterControlTone.iconButton
              }`}
            >
              <Plus size={22} className="chat-footer-plus-icon" />
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
              <GroupChatFunPanel
                activeGroupFeatureComposer={activeGroupFeatureComposer}
                groupPollTitleDraft={groupPollTitleDraft}
                groupPollOptionsDraft={groupPollOptionsDraft}
                groupRelayTopicDraft={groupRelayTopicDraft}
                groupTaskPromptDraft={groupTaskPromptDraft}
                onOpenImagePicker={() => fileInputRef.current?.click()}
                onOpenLocationPicker={() => {
                  setShowLocationPicker(true);
                  setShowFunPanel(false);
                }}
                onSelectFeature={(feature) => setActiveGroupFeatureComposer(feature)}
                onCancelFeature={() => setActiveGroupFeatureComposer(null)}
                onGroupPollTitleChange={setGroupPollTitleDraft}
                onGroupPollOptionsChange={setGroupPollOptionsDraft}
                onGroupRelayTopicChange={setGroupRelayTopicDraft}
                onGroupTaskPromptChange={setGroupTaskPromptDraft}
                onLaunchGroupPoll={handleLaunchGroupPoll}
                onLaunchGroupRelay={handleLaunchGroupRelay}
                onLaunchGroupTask={handleLaunchGroupTask}
              />
            )}
          </AnimatePresence>
          <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
        </div>
      </div>

      <ExpandedInputSheet
        open={false}
        value={input}
        onChange={setInput}
        onClose={() => undefined}
        onSend={() => {
          if (editingMessageIndex !== null) {
            handleSaveEdit();
          } else {
            void sendText();
          }
          return;
        }}
        canSend={!!input.trim()}
        placeholder={editingMessageIndex !== null ? '编辑消息...' : '发送消息...'}
        style={chatTextStyle}
      />

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
                groupShortTermSummary={group.groupShortTermSummary}
                groupMemberPerspectiveSummaries={group.groupMemberPerspectiveSummaries}
                groupLongTermMemory={group.groupLongTermMemory}
                onChange={(patch) => setGroupSettingsForm((prev) => ({ ...prev, ...patch }))}
                onClearMemory={(patch) => onUpdateGroup(patch)}
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
              {isEditableMessage(contextMenuMessage) && (
                <button
                  onClick={handleStartEdit}
                  className="rounded-lg p-2 text-zinc-900 transition-colors hover:bg-zinc-100"
                  title="编辑"
                >
                  <Pencil size={20} />
                </button>
              )}
              {canBacktrackMessage(contextMenuMessage) && (
                <button
                  onClick={handleBacktrack}
                  className="rounded-lg p-2 text-zinc-900 transition-colors hover:bg-zinc-100"
                  title="回溯"
                >
                  <RotateCcw size={20} />
                </button>
              )}
              {canRegenerateMessage(contextMenuMessageIndex, contextMenuMessage) && (
                <button
                  onClick={() => void handleRegenerate()}
                  className="rounded-lg p-2 text-zinc-900 transition-colors hover:bg-zinc-100"
                  title="重回"
                >
                  <RefreshCw size={20} />
                </button>
              )}
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
              {contextMenuMessage.audioUrl && contextMenuMessage.audioTranscript && (
                <button
                  onClick={handleToggleTranscript}
                  className="rounded-lg p-2 text-zinc-900 transition-colors hover:bg-zinc-100"
                  title={expandedAudioTranscriptKeys.has(getGroupMessageSelectionKey(contextMenuMessage)) ? '收起转文字' : '转文字'}
                >
                  <ScanEye size={20} />
                </button>
              )}
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
                className="rounded-2xl border border-[#d9e6f7] bg-[#eef5ff] px-4 py-3 text-sm font-medium text-[#4b6788]"
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


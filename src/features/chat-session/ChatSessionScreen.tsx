import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Wifi, ChevronLeft, ChevronRight, Send, Settings, Trash2, Plus, Check, X, Cpu, Pencil, Save, Link2, Key, RefreshCw, RotateCcw, ChevronDown, ChevronUp, Image as ImageIcon, Upload, PlusCircle, Smile, Share2, Banknote, Heart, Mic, Keyboard, Copy, Star, Reply, MoreHorizontal, CheckCircle, Search, MessageSquarePlus, MessageCircle, ScanEye, Phone, PhoneOff, MapPin, Gamepad2, Coffee, Images, Volume2, AlertCircle, Hand } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mask, FavoriteMessage, VisualSettings, WorldBookEntry,
  Character, ChatMessage, PerceptionSettings,
  ApiConfig, AppSettings, CallRecord, CoupleSpaceData, DateSession, WalletData,
  ChatGroup, ChatHistory, FriendRequest,
} from '../../types';
import { ChatSettingsPanel } from '../../components/chat/ChatSettingsPanel';
import { DatingModal } from '../../components/dating/DatingModal';
import { resolveSceneTextApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';
import { buildDatingEndedSettlement } from '../../services/dating/buildDatingEndedSettlement';
import { GameCenter } from '../../components/games/GameCenter';
import { GameCard } from '../../components/chat/GameCard';
import { AvatarLibraryPanel } from './AvatarLibraryPanel';
import { MOCK_CARDS } from '../../components/wallet/WalletApp/mockData';
import {
  copyTextContent,
  createShareAction,
  getChatHeaderState,
  getChatLayoutConfig,
  getContextMenuPosition,
  getLatestModelReplyTimestamp,
  getReplyPreviewText,
  getUserReadStatusLabel,
  type ShareActionResult,
} from '../../services/chat/messageActions';
import { getLegacyTranslationParts, sanitizePipeMarkers } from '../../services/chat/messageText';
import { BASIC_CHAT_EXPRESSIONS } from '../../services/chat/basicExpressions';
import { extractImageUrls } from '../../utils';
import { useResolvedPersistentValue } from '../persistence/useResolvedPersistentValue';
import { resolveValueToDisplayUrl } from '../persistence/persistentAssetService';
import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';
import { saveUploadedBlob, saveUploadedFile } from '../persistence/persistentAssetService';
import { resolveDirectChatBackground } from './directChatBackground';
import { useDirectChatRuntime } from '../chat-runtime/useDirectChatRuntime';
import { hasOpenedCoupleSpaceForCharacter } from '../chat-runtime/coupleSpaceInviteGuard';
import { getDirectMemoryMessageLimit } from '../../services/memory/memoryWindowLimits';
import { appendWorkingMemorySnapshots } from '../../services/memory/memoryRecordSnapshots';
import { buildScopedBubbleThemeCss, buildScopedBubbleVariantCss, extractBubbleTextStyle, hasBubbleThemeCss, parseBubbleStyleCss, sanitizeBubbleSurfaceStyle } from './bubbleStyleCss';
import { buildScopedAvatarFrameThemeCss } from './avatarFrameStyleCss';
import { AudioMessageCard } from './AudioMessageCard';
import { useAudioMessageRecorder } from './useAudioMessageRecorder';
import { usePressToRecordInteraction } from './usePressToRecordInteraction';
import { getThemeSelectedFontStack } from '../theme/themeTypography';
import { GroupLocationPickerSheet } from './GroupLocationPickerSheet';
import { InnerVoiceUnlockCard, parseInnerVoiceCardContent } from './InnerVoiceUnlockCard';
import { buildCharacterTemporalState } from '../../services/relationship-time/buildCharacterTemporalState';
import { buildRelationshipProjection } from '../../services/relationship-context/buildRelationshipProjection';
import { useAppKeyboard } from '../app-shell/AppKeyboardContext';
import { focusTextEntryElement } from '../app-shell/keyboardUtils';
import { useKeyboardSafeViewport } from '../app-shell/useKeyboardSafeViewport';
import { getMessageMainText } from '../../utils';
import { ExpandedInputSheet } from './ExpandedInputSheet';
import {
  FOOTER_REPLY_PREVIEW_ICON_STYLE,
  MESSAGE_REPLY_PREVIEW_ICON_STYLE,
  MESSAGE_REPLY_PREVIEW_LABEL_CLASS,
  MESSAGE_REPLY_PREVIEW_LABEL_STYLE,
  MESSAGE_REPLY_PREVIEW_TEXT_CLASS,
  MESSAGE_REPLY_PREVIEW_TEXT_STYLE,
  getFooterReplyCloseButtonClass,
  getFooterReplyPreviewClass,
  getMessageReplyPreviewClass,
} from './replyPreviewStyles';
import type { DrawBlocksCharacterRuntimeContext } from '../../components/games/DrawBlocksGame';
import { AvatarFrame } from '../../components/chat/AvatarFrame';
import { getCharacterBlockState } from '../contacts/contactRelationship';
import {
  getDirectChatRelationshipBlockNotice,
  isDirectChatBlockedByCharacter,
  isDirectChatBlockedByUser,
  isDirectChatRelationshipPendingRepair,
  shouldPauseDirectChatComposerForCharacter,
} from '../chat-runtime/directChatDelivery';

const getMessageSelectionKey = (message: ChatMessage) => (
  `${message.timestamp}::${message.role}::${message.text}`
);
const GAME_CARD_FAILURE_TOKEN = '[GAME_CARD_ERROR]';
const CHAT_HISTORY_INITIAL_WINDOW = 90;
const CHAT_HISTORY_LOAD_STEP = 60;
const CHAT_HISTORY_LOAD_MORE_THRESHOLD = 120;
const DIRECT_POKE_DOUBLE_TAP_WINDOW_MS = 320;

type ParsedGameCardDisplayData = {
  game: 'qna' | 'tod' | 'blocks';
  type: 'question' | 'answer' | 'truth' | 'dare' | 'request_question' | 'result';
  question?: string;
  content: string;
};

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

function resetDatingScenePresentation(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const phoneContainer = document.getElementById('phone-container');
  const phoneScreenRoot = phoneContainer?.querySelector('.phone-screen-root');

  phoneContainer?.classList.remove('is-dating-scene');
  phoneScreenRoot?.classList.remove('is-dating-scene');
}

const BubbleThemeAnchors = React.memo(function BubbleThemeAnchors() {
  return (
    <>
      <span aria-hidden="true" className="corner bubble-corner tl pointer-events-none absolute" />
      <span aria-hidden="true" className="corner bubble-corner tr pointer-events-none absolute" />
      <span aria-hidden="true" className="corner bubble-corner bl pointer-events-none absolute" />
      <span aria-hidden="true" className="corner bubble-corner br pointer-events-none absolute" />
      <span aria-hidden="true" className="sticker-skull bubble-sticker-skull pointer-events-none absolute" />
      <span aria-hidden="true" className="bubble-charm pointer-events-none absolute">
        <span aria-hidden="true" className="bubble-charm-string pointer-events-none absolute" />
        <span aria-hidden="true" className="bubble-charm-body pointer-events-none absolute">
          <span aria-hidden="true" className="bubble-charm-core pointer-events-none absolute" />
        </span>
      </span>
    </>
  );
});

BubbleThemeAnchors.displayName = 'BubbleThemeAnchors';

function isStickerMessage(message: ChatMessage) {
  return !!message.imageUrl && /^\[(?:sticker|表情包)\]/i.test(message.text.trim());
}

function stripVisualMessageMarker(text: string) {
  return text.replace(/^\[(?:sticker|image|表情包|图片)\]\s*/i, '').trim();
}

function stripMediaMessageMarker(text: string) {
  return text.replace(/^\[(?:sticker|image|audio|表情包|图片|语音)\]\s*/i, '').trim();
}

function getDirectTextBubbleClass(role: ChatMessage['role'], maxWidthClass: string) {
  if (role === 'model') {
    return `inline-block ${maxWidthClass} px-4 py-3 rounded-2xl`;
  }

  return `w-fit ${maxWidthClass} px-4 py-3 rounded-2xl`;
}

function clampChatBubbleScale(value: number | undefined): number {
  return Math.min(1.3, Math.max(0.8, value ?? 1));
}

function removeBackdropBlurClassNames(className: string) {
  return className
    .replace(/\bbackdrop-blur(?:-\[[^\]]+\]|-[^\s]+)?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDirectTextBubbleStyle({
  role,
  visualSettings,
  activeBackground,
  resolvedChatMessageBackgroundUrl,
  resolvedCharacterBubbleImageUrl,
  resolvedUserBubbleImageUrl,
  character,
}: {
  role: ChatMessage['role'];
  visualSettings: VisualSettings;
  activeBackground: string | undefined;
  resolvedChatMessageBackgroundUrl?: string;
  resolvedCharacterBubbleImageUrl?: string;
  resolvedUserBubbleImageUrl?: string;
  character: Character;
}): React.CSSProperties {
  const hasGlobalTheme = hasBubbleThemeCss(visualSettings?.chat?.bubbleStyleCss);
  const hasRoleTheme = hasBubbleThemeCss(
    role === 'model' ? visualSettings?.chat?.modelBubbleStyleCss : visualSettings?.chat?.userBubbleStyleCss,
  );
  const characterRoleBubbleStyleCss = role === 'model' ? character.bubbleStyleCss : character.userBubbleStyleCss;
  const hasCharacterRoleTheme = hasBubbleThemeCss(characterRoleBubbleStyleCss);
  const shouldUseDefaultBubbleSurface = !hasGlobalTheme && !hasRoleTheme && !hasCharacterRoleTheme;
  const shouldApplyRoleBubbleSurfaceOverride = !hasGlobalTheme && !hasRoleTheme && !hasCharacterRoleTheme;
  const globalBubbleStyle = sanitizeBubbleSurfaceStyle(parseBubbleStyleCss(visualSettings?.chat?.bubbleStyleCss));
  const globalRoleBubbleStyle = sanitizeBubbleSurfaceStyle(parseBubbleStyleCss(
    role === 'model' ? visualSettings?.chat?.modelBubbleStyleCss : visualSettings?.chat?.userBubbleStyleCss,
  ));
  const characterBubbleStyle = sanitizeBubbleSurfaceStyle(parseBubbleStyleCss(characterRoleBubbleStyleCss));
  const resolvedRoleBubbleImageUrl = role === 'model' ? resolvedCharacterBubbleImageUrl : resolvedUserBubbleImageUrl;
  const roleBubbleColor = role === 'model' ? character.bubbleColor : character.userBubbleColor;

  return {
    ...(shouldUseDefaultBubbleSurface ? {
      borderRadius: visualSettings?.chat?.messageBorderRadius ?? 16,
      borderTopRightRadius:
        role === 'user'
          ? 6
          : visualSettings?.chat?.messageBorderRadius ?? 16,
      borderTopLeftRadius:
        role === 'model'
          ? 6
          : visualSettings?.chat?.messageBorderRadius ?? 16,
      boxShadow:
        role === 'user'
          ? '0 10px 24px rgba(59, 130, 246, 0.18)'
          : '0 10px 24px rgba(15, 23, 42, 0.08)',
      backgroundColor:
        role === 'user'
          ? (visualSettings?.chat?.messageBackgroundColorUser ||
              `rgba(59, 130, 246, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`)
      : (visualSettings?.chat?.messageBackgroundColorModel ||
              `rgba(255, 255, 255, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`),
      borderColor:
        role === 'user'
          ? (visualSettings?.chat?.messageBackgroundColorUser ||
              `rgba(59, 130, 246, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`)
          : `rgba(228, 228, 231, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`,
    } : {}),
    ...(resolvedChatMessageBackgroundUrl
      ? {
          backgroundImage: `url(${resolvedChatMessageBackgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: 'none',
        }
      : {}),
    ...(shouldApplyRoleBubbleSurfaceOverride
      ? (resolvedRoleBubbleImageUrl
          ? {
              backgroundImage: `url(${resolvedRoleBubbleImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: 'none',
            }
          : roleBubbleColor
          ? {
              backgroundColor: roleBubbleColor,
              borderColor: roleBubbleColor,
            }
          : {})
      : {}),
    ...(hasCharacterRoleTheme ? {} : globalBubbleStyle),
    ...(hasCharacterRoleTheme ? {} : globalRoleBubbleStyle),
    ...characterBubbleStyle,
  };
}

function getDirectTextContentStyle({
  role,
  visualSettings,
  character,
}: {
  role: ChatMessage['role'];
  visualSettings: VisualSettings;
  character: Character;
}): React.CSSProperties {
  const characterRoleBubbleStyleCss = role === 'model' ? character.bubbleStyleCss : character.userBubbleStyleCss;

  return {
    ...extractBubbleTextStyle(parseBubbleStyleCss(visualSettings?.chat?.bubbleStyleCss)),
    ...extractBubbleTextStyle(parseBubbleStyleCss(
      role === 'model' ? visualSettings?.chat?.modelBubbleStyleCss : visualSettings?.chat?.userBubbleStyleCss,
    )),
    ...extractBubbleTextStyle(parseBubbleStyleCss(characterRoleBubbleStyleCss)),
  };
}

type DirectResolvedTextBubbleStyles = {
  bubbleStyle: React.CSSProperties;
  textStyle: React.CSSProperties;
};

type ParsedGameCardPayloadState =
  | {
      status: 'ok';
      payload: {
        data: ParsedGameCardDisplayData;
        translation: string;
      };
    }
  | { status: 'incomplete' }
  | { status: 'invalid'; error: unknown };

function parseGameCardPayloadState(message: ChatMessage): ParsedGameCardPayloadState {
  const gameCardRegex = /^\[GAME_CARD\]\s*([\s\S]*?)(?:\n\n---TRANSLATION---\s*[\s\S]*)?$/;
  const gameCardMatch = message.text.match(gameCardRegex);
  if (!gameCardMatch) {
    return { status: 'invalid', error: new Error('Not a GAME_CARD payload.') };
  }

  try {
    let jsonString = gameCardMatch[1].trim();

    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const jsonStart = jsonString.indexOf('{');
    const jsonEnd = jsonString.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
      return { status: 'incomplete' };
    }
    jsonString = jsonString.substring(jsonStart, jsonEnd + 1);

    const gameData = JSON.parse(jsonString) as Partial<ParsedGameCardDisplayData>;
    const legacyTranslationParts = getLegacyTranslationParts(message.text);

    if (
      (gameData.game !== 'qna' && gameData.game !== 'tod' && gameData.game !== 'blocks')
      || (
        gameData.type !== 'question'
        && gameData.type !== 'answer'
        && gameData.type !== 'truth'
        && gameData.type !== 'dare'
        && gameData.type !== 'request_question'
        && gameData.type !== 'result'
      )
      || typeof gameData.content !== 'string'
    ) {
      return { status: 'invalid', error: new Error('GAME_CARD payload shape is invalid.') };
    }

    return {
      status: 'ok',
      payload: {
        data: {
          game: gameData.game,
          type: gameData.type,
          content: sanitizePipeMarkers(gameData.content, '\n'),
          ...(typeof gameData.question === 'string'
            ? { question: sanitizePipeMarkers(gameData.question, '\n') }
            : {}),
        },
        translation: sanitizePipeMarkers(
          message.translation?.trim() || legacyTranslationParts.translation,
          '\n',
        ),
      },
    };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error ?? '');
    if (
      /unterminated string|unexpected end of json input|expected ',' or '}'/i.test(messageText)
      || !message.text.trim().endsWith('}')
    ) {
      return { status: 'incomplete' };
    }
    return { status: 'invalid', error };
  }
}

const PersistentImage = React.memo(function PersistentImage({
  value,
  fallbackValue,
  alt,
  className,
  style,
  referrerPolicy,
}: {
  value?: string | null;
  fallbackValue?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>['referrerPolicy'];
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const { resolvedUrl: resolvedFallbackUrl } = useResolvedPersistentValue(fallbackValue);
  const src =
    getDisplayableAssetValue(value, resolvedUrl)
    || getDisplayableAssetValue(fallbackValue, resolvedFallbackUrl)
    || null;

  if (!src) return null;

  return <img src={src} alt={alt} className={className} style={style} referrerPolicy={referrerPolicy} />;
});

PersistentImage.displayName = 'PersistentImage';

function CoupleSpaceInviteIcon({ size = 24, className }: { size?: number; className?: string }) {
  return <Star size={size} className={className} />;
}

export function ChatSessionScreen({ 
  character, 
  characters,
  history, 
  setHistory, 
  onUpdateCharacter,
  onPatchCharacter,
  onToggleCharacterBlock,
  settings, 
  onUpdateSettings,
  onBack,
  userAvatar,
  userName,
  masks,
  favorites,
  setFavorites,
  visualSettings,
  onUpdateVisualSettings,
  groups,
  chatGroups,
  directChatHistory,
  worldBook = [],
  perception,
  coupleSpace,
  isCoupleSpaceDismissed,
  onViewForumPost,
  callHistory,
  onAddCallRecord,
  onDeleteCallRecord,
  onSaveDate,
  onCollectDate,
  savedDates,
  datingResumeSignal = 0,
  walletData,
  onUpdateWalletData,
  onPublishMoment,
  onOpenCharacterMoments,
  onOpenCharacterProfile,
  onStatusBarVisibilityChange,
  onAcceptCoupleSpaceInvite,
  onRuntimeBusyChange,
  friendRequests = [],
  setFriendRequests,
  isActive = true,
  suspendHeavyRendering = false,
}: { 
  character: Character;
  characters: Character[];
  history: ChatMessage[];
  setHistory: (h: ChatMessage[]) => void;
  onUpdateCharacter: (c: Character) => void;
  onPatchCharacter?: (patch: Partial<Character>) => void;
  onToggleCharacterBlock?: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onBack: () => void;
  userAvatar: string;
  userName: string;
  masks: Mask[];
  favorites: FavoriteMessage[];
  setFavorites: (f: FavoriteMessage[]) => void;
  visualSettings: VisualSettings;
  onUpdateVisualSettings: (settings: VisualSettings) => void;
  groups: string[];
  chatGroups?: ChatGroup[];
  directChatHistory?: ChatHistory;
  worldBook?: WorldBookEntry[];
  key?: string;
  perception?: PerceptionSettings;
  coupleSpace?: CoupleSpaceData;
  isCoupleSpaceDismissed?: boolean;
  onViewForumPost?: (postId: string) => void;
  callHistory?: CallRecord[];
  onAddCallRecord?: (record: CallRecord) => void;
  onDeleteCallRecord?: (recordId: string) => void;
  onSaveDate?: (session: DateSession) => void;
  onCollectDate?: (session: DateSession) => void;
  savedDates?: DateSession[];
  datingResumeSignal?: number;
  walletData?: WalletData;
  onUpdateWalletData?: (data: WalletData) => void;
  onPublishMoment?: (moment: { authorId: string; content: string; translation?: string; images?: string[]; imageCard?: import('../../types').MomentImageCard; isCollected?: boolean; sourceChatMessage?: { characterId: string; timestamp: number } }) => void;
  onOpenCharacterMoments?: () => void;
  onOpenCharacterProfile?: () => void;
  onStatusBarVisibilityChange?: (visible: boolean) => void;
  onAcceptCoupleSpaceInvite?: (characterId: string) => void;
  onRuntimeBusyChange?: (busy: boolean) => void;
  friendRequests?: FriendRequest[];
  setFriendRequests?: React.Dispatch<React.SetStateAction<FriendRequest[]>>;
  isActive?: boolean;
  suspendHeavyRendering?: boolean;
}) {
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage['replyTo'] | null>(null);
  const [pendingShare, setPendingShare] = useState<ShareActionResult['payload'] | null>(null);
  const [activeInnerVoiceIndex, setActiveInnerVoiceIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAvatarLibrary, setShowAvatarLibrary] = useState(false);
  const [showFunPanel, setShowFunPanel] = useState(false);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [showExpandInputToggle, setShowExpandInputToggle] = useState(false);
  const [showActionInput, setShowActionInput] = useState(false);
  const [actionInput, setActionInput] = useState('');
  const [stickerTab, setStickerTab] = useState<'basic' | 'custom'>('basic');
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferType, setTransferType] = useState<'toUser' | 'toCharacter'>('toCharacter');
  const [transferAmount, setTransferAmount] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const sessionEnteredAtRef = useRef(Date.now());
  const lastModelAvatarTapAtRef = useRef(0);
  const availableCustomStickers = Array.from(new Set([
    ...(settings.sharedStickers || []),
    ...(character.stickers || []),
  ].filter((sticker): sticker is string => typeof sticker === 'string' && sticker.trim().length > 0)));
  const [activeIncomingTransferIndex, setActiveIncomingTransferIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDatingModal, setShowDatingModal] = useState(false);
  const [showGameCenter, setShowGameCenter] = useState(false);
  const handledDatingResumeSignalRef = useRef(0);

  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [voiceCallDuration, setVoiceCallDuration] = useState(0);
  const [voiceCallInput, setVoiceCallInput] = useState('');
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const [isVoiceCallResponding, setIsVoiceCallResponding] = useState(false);
  const [voiceCallAudioNotice, setVoiceCallAudioNotice] = useState('');
  const voiceCallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceCallRecognitionRef = useRef<any>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
    messageTimestamp: number;
    messageRole: ChatMessage['role'];
    messageText: string;
  } | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [expandedAudioTranscriptKeys, setExpandedAudioTranscriptKeys] = useState<Set<string>>(new Set());
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [showMemoryWindowHint, setShowMemoryWindowHint] = useState(false);
  const inputTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatFooterRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const chatRootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    keyboardVisible,
  } = useAppKeyboard();
  const { keyboardVisible: ownsFocusedKeyboard } = useKeyboardSafeViewport({
    containerRef: chatRootRef,
    enabled: true,
    clampViewportHeight: true,
    scrollFocusedIntoView: false,
  });
  const chatKeyboardOpen = keyboardVisible && ownsFocusedKeyboard;
  const previousChatKeyboardOpenRef = useRef(false);
  const latestViewReadyRef = useRef(false);
  const previousHistoryAutoscrollStateRef = useRef({
    latestMessageKey: '',
    isLoading: false,
  });
  const previousActiveStateRef = useRef(isActive);
  const historyWindowRestoreRef = useRef<{ previousScrollHeight: number; previousScrollTop: number } | null>(null);
  const previousTransientPanelOpenRef = useRef(false);
  const [visibleMessageCount, setVisibleMessageCount] = useState(() => Math.min(history.length, CHAT_HISTORY_INITIAL_WINDOW));
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    void (async () => {
      try {
        const persistedImage = await saveUploadedFile(file);
        sendImageMessage(persistedImage);
        setShowFunPanel(false);
      } catch (error) {
        console.error('Failed to persist direct chat image before sending', error);
        setError('图片保存失败，请重试。');
      }
    })();
  };
  const {
    isRecording: isAudioRecording,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    cancelRecording: cancelAudioRecording,
  } = useAudioMessageRecorder({
    onRecorded: async ({ blob, durationMs, transcript }) => {
      const audioRef = await saveUploadedBlob(blob, {
        fileName: `voice-message-${Date.now()}.wav`,
        mimeType: 'audio/wav',
      });
      const actionText = actionInput.trim();
      const spokenText = transcript?.trim() || '';
      sendAudioMessage(
        audioRef,
        'audio/wav',
        Math.max(1, Math.round(durationMs / 1000)),
        spokenText,
        actionText
          ? {
              promptText: `${`（${actionText}）`}${spokenText}`,
              displayTranscript: `（${actionText}）`,
            }
          : undefined,
      );
      if (actionText) {
        setActionInput('');
        setShowActionInput(false);
      }
      setShowFunPanel(false);
    },
  });
  useEffect(() => {
    setIsRecording(isAudioRecording);
  }, [isAudioRecording]);
  useEffect(() => {
    if (!character.actionDescriptionEnabled) {
      setShowActionInput(false);
      setActionInput('');
    }
  }, [character.actionDescriptionEnabled]);
  const audioRecordInteraction = usePressToRecordInteraction({
    isRecording: isAudioRecording,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    cancelRecording: cancelAudioRecording,
  });

  const activeConfig = settings?.configs?.find(c => c.id === settings.activeConfigId);
  const datingConfig = resolveSceneTextApiConfig({
    settings,
    scene: 'dating',
    characterId: character.id,
  }).runtimeConfig;
  const activeSavedDate =
    savedDates?.find(
      session => session.characterId === character.id && (session.status || 'active') === 'active',
    ) || null;
  const hasOpenedCoupleSpace = hasOpenedCoupleSpaceForCharacter({
    characterId: character.id,
    coupleSpace,
    history,
    isDismissed: isCoupleSpaceDismissed,
  });
  const {
    isLoading,
    error,
    setError,
    handleSend,
    requestManualReply,
    handleVoiceCallAIResponse,
    sendImageMessage,
    sendAudioMessage,
    sendStickerMessage,
    sendLocationMessage,
    sendPokeInteraction,
    sendCoupleSpaceInvitation,
    sendInnerVoiceProbe,
    sendSpeechTranscript,
    finalizeVoiceCall,
    editMessageAt,
    backtrackToMessageAt,
    regenerateLatestReplyAt,
    recallMessageAt,
    deleteMessageAt,
    deleteSelectedMessages: deleteSelectedMessagesFromRuntime,
    copyMessageAt,
    toggleFavoriteAt,
    quoteReplyAt,
    forwardMessageAt,
    createSharePayloadAt,
    generateAudioForMessageAt,
    submitTransfer,
    handleReceiveTransfer,
    handleRejectTransfer,
  } = useDirectChatRuntime({
    character,
    characters,
    sharedStickers: settings.sharedStickers || [],
    history,
    setHistory,
    settings,
    input,
    setInput,
    replyingTo,
    setReplyingTo,
    masks,
    worldBook,
    perception,
    coupleSpace,
    isCoupleSpaceDismissed,
    userName,
    directChatHistory,
    chatGroups,
    favorites,
    setFavorites,
    walletData,
    onUpdateWalletData,
    onUpdateCharacter,
    onPatchCharacter,
    onPublishMoment,
    onAddCallRecord,
    onAcceptCoupleSpaceInvite,
    friendRequests,
    setFriendRequests,
  });

  useEffect(() => {
    onRuntimeBusyChange?.(isLoading);
    return () => {
      onRuntimeBusyChange?.(false);
    };
  }, [isLoading, onRuntimeBusyChange]);

  const latestUserMessageIndex = [...history].map((message, index) => ({ message, index })).reverse().find(({ message }) => (
    message.role === 'user' && !message.isSystem && (message.text || message.imageUrl || message.audioUrl || message.location)
  ))?.index;
  const getLatestDirectModelSegment = useCallback(() => {
    let end = -1;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const message = history[index];
      if (message.isSystem || message.isRecalled) continue;
      if (message.role !== 'model') return null;
      end = index;
      break;
    }
    if (end < 0) return null;
    let start = end;
    for (let index = end - 1; index >= 0; index -= 1) {
      const message = history[index];
      if (message.role !== 'model' || message.isSystem || message.isRecalled) break;
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
    && !message.sharedPost
    && !message.text.startsWith('[COUPLE_SPACE_INVITE]')
    && !!message.text.trim()
  ), []);
  const canRegenerateMessage = useCallback((index: number, message: ChatMessage | null | undefined) => {
    if (!message || message.role !== 'model' || message.isSystem || message.isRecalled || isLoading) {
      return false;
    }
    const segment = getLatestDirectModelSegment();
    return !!segment && index >= segment.start && index <= segment.end;
  }, [getLatestDirectModelSegment, isLoading]);
  const canGenerateMessageAudio = useCallback((message: ChatMessage | null | undefined) => (
    !!message
    && message.role === 'model'
    && !message.isSystem
    && !message.isRecalled
    && !message.audioUrl
    && !message.imageUrl
    && !message.isInnerVoice
    && !!character.voiceProfile?.enabled
    && !!message.text.trim()
    && message.contentType !== 'game-card'
    && message.contentType !== 'game-card-error'
    && !message.text.startsWith('[GAME_CARD]')
    && !message.text.startsWith('[COUPLE_SPACE_INVITE')
    && !message.text.startsWith('[transfer]')
    && !/^\[转账\s*[\d.]+\]/.test(message.text)
    && !/^TRANSFER\|[\d.]+\|/i.test(message.text)
    && !isLoading
  ), [character.voiceProfile?.enabled, isLoading]);
  const canBacktrackMessage = useCallback((message: ChatMessage | null | undefined) => (
    !!message
    && !message.isSystem
    && !message.isRecalled
    && !isLoading
  ), [isLoading]);
  const directBlockState = getCharacterBlockState(character);
  const isBlockedByUser = isDirectChatBlockedByUser(directBlockState);
  const isBlockedByCharacter = isDirectChatBlockedByCharacter(directBlockState);
  const isRelationshipPendingRepair = isDirectChatRelationshipPendingRepair(character);
  const shouldPauseDirectChatComposer = shouldPauseDirectChatComposerForCharacter(character);
  useEffect(() => {
    if (shouldPauseDirectChatComposer && isVoiceMode) {
      setIsVoiceMode(false);
    }
  }, [isVoiceMode, shouldPauseDirectChatComposer]);
  const showManualReplyButton = !character.autoReplyEnabled && !isBlockedByUser && !isBlockedByCharacter && !isRelationshipPendingRepair;
  const canUseManualSpeakButton = !isLoading && !isBlockedByUser && !isBlockedByCharacter && !isRelationshipPendingRepair;
  const showActionDescriptionButton = !!character.actionDescriptionEnabled;
  const activeInnerVoiceMessage = activeInnerVoiceIndex !== null ? history[activeInnerVoiceIndex] : null;
  const activeInnerVoiceParts = activeInnerVoiceMessage?.isInnerVoice
    ? getLegacyTranslationParts(activeInnerVoiceMessage.text)
    : null;
  const activeInnerVoiceCard = activeInnerVoiceMessage?.isInnerVoice && activeInnerVoiceMessage.role === 'model'
    ? parseInnerVoiceCardContent(sanitizePipeMarkers(activeInnerVoiceParts?.mainText || activeInnerVoiceMessage.text, '\n'))
    : null;
  const activeInnerVoiceTranslation = activeInnerVoiceMessage?.isInnerVoice
    ? sanitizePipeMarkers(
        activeInnerVoiceMessage.translation?.trim() || activeInnerVoiceParts?.translation || '',
        '\n',
      )
    : '';
  const latestModelReplyTimestamp = getLatestModelReplyTimestamp(history);
  const relationshipBlockNotice = getDirectChatRelationshipBlockNotice(character);
  const renderUserMessageStatus = useCallback((message: ChatMessage) => {
    if (message.role !== 'user') {
      return null;
    }

    const statusLabel = getUserReadStatusLabel(message, latestModelReplyTimestamp);
    if (!statusLabel) {
      return null;
    }

    if (message.deliveryStatus === 'failed_blocked') {
      return (
        <span className="ml-1 inline-flex items-center gap-1 text-red-500">
          <AlertCircle size={11} />
          {statusLabel}
        </span>
      );
    }

    return <span className="ml-1">{statusLabel}</span>;
  }, [latestModelReplyTimestamp]);
  const sendCurrentText = useCallback(async () => {
    const speechText = input.trim();
    const actionText = actionInput.trim();
    if (editingMessageIndex !== null) {
      if (!speechText) {
        return;
      }
      editMessageAt(editingMessageIndex, speechText);
      setEditingMessageIndex(null);
      setInput('');
      setActionInput('');
      setShowActionInput(false);
      return;
    }
    if (!speechText && !actionText) {
      return;
    }

    const textToSend = actionText ? `（${actionText}）${speechText}` : speechText;
    await handleSend(textToSend);
    if (activeConfig) {
      setInput('');
      setActionInput('');
      setShowActionInput(false);
    }
  }, [actionInput, activeConfig, editMessageAt, editingMessageIndex, handleSend, input]);

  const drawBlocksRuntimeContext = useMemo<DrawBlocksCharacterRuntimeContext>(() => {
    const temporalState = buildCharacterTemporalState({
      characterId: character.id,
      perception,
      directChatHistory,
      groupMessages: [],
      coupleSpace,
    });
    const relationshipProjection = buildRelationshipProjection({
      character,
      characters,
      chatGroups,
      coupleSpace,
      userName,
      directMessages: history,
      groupMessages: [],
    });
    const recentExchange = history
      .slice(-6)
      .map((message) => {
        const mainText = getMessageMainText(message).trim();
        if (!mainText) {
          return '';
        }
        return `${message.role === 'user' ? userName : character.name}：${mainText}`;
      })
      .filter(Boolean);
    const recentUserMessages = history.filter((message) => message.role === 'user').slice(-3);
    const recentUserJoined = recentUserMessages.map((message) => getMessageMainText(message)).join(' ');
    const recentUserTone: DrawBlocksCharacterRuntimeContext['recentUserTone'] =
      /哈哈|hh|嘿嘿|逗|玩笑|笑死|可爱|好玩/.test(recentUserJoined)
        ? 'playful'
        : /抱抱|想你|喜欢|乖|陪我|晚安|亲|贴贴/.test(recentUserJoined)
          ? 'warm'
          : /烦|生气|别|算了|不想|讨厌|怎么又|无语/.test(recentUserJoined)
            ? 'tense'
            : 'neutral';

    const playDisposition: DrawBlocksCharacterRuntimeContext['playDisposition'] =
      recentUserTone === 'warm'
        ? 'soft'
        : recentUserTone === 'playful'
          ? 'teasing'
          : temporalState.relationshipPull === 'high'
            ? 'competitive'
            : temporalState.socialState === 'reserved'
              ? 'careful'
              : 'balanced';

    return {
      recentExchange,
      relationshipSummary: relationshipProjection.sceneScopedSignals.sharedRecentRelationshipSummary,
      shortTermSummary: relationshipProjection.characterScopedMemory.shortTermSummary,
      longTermMemoryProfile: relationshipProjection.characterScopedMemory.longTermMemoryProfile,
      currentActivity: temporalState.presenceCue.currentActivity,
      attentionNote: temporalState.presenceCue.attentionNote,
      continuityMode: temporalState.continuityMode,
      recentUserTone,
      playDisposition,
    };
  }, [character, coupleSpace, directChatHistory, history, perception, userName]);

  useEffect(() => {
    onStatusBarVisibilityChange?.(!showDatingModal);

    return () => {
      onStatusBarVisibilityChange?.(true);
    };
  }, [showDatingModal, onStatusBarVisibilityChange]);
  
  const showVoiceCallRef = useRef(false);
  const voiceCallSessionIdRef = useRef(0);
  const [voiceCallHistory, setVoiceCallHistory] = useState<{role: 'user' | 'model', text: string, translation?: string}[]>([]);
  const [currentInterimSpeech, setCurrentInterimSpeech] = useState('');
  const voiceCallHistoryRef = useRef<{role: 'user' | 'model', text: string, translation?: string}[]>([]);
  const voiceCallEndRef = useRef<HTMLDivElement>(null);
  const voiceCallAudioRef = useRef<HTMLAudioElement | null>(null);

  const formatVoiceCallDuration = useCallback((seconds: number) => {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
    const remainSeconds = (safeSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainSeconds}`;
  }, []);

  const formatVoiceCallSecondsLabel = useCallback((seconds: number) => {
    if (seconds < 60) {
      return `${seconds} 秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainSeconds = seconds % 60;
    return remainSeconds > 0 ? `${minutes} 分 ${remainSeconds} 秒` : `${minutes} 分钟`;
  }, []);

  const playVoiceCallAudio = useCallback(async (audioUrl?: string) => {
    if (!audioUrl) {
      return;
    }

    try {
      const resolvedAudioUrl = await resolveValueToDisplayUrl(audioUrl);
      if (!resolvedAudioUrl) {
        setVoiceCallAudioNotice('语音已经生成，但当前没拿到可播放地址，所以没有成功播出来。');
        return;
      }
      voiceCallAudioRef.current?.pause();
      const nextAudio = new Audio(resolvedAudioUrl);
      nextAudio.play().catch((error) => {
        console.error('Voice call audio autoplay failed', error);
        setVoiceCallAudioNotice('语音已经生成，但浏览器拦截了自动播放。可以再试一次或手动交互后重试。');
      });
      voiceCallAudioRef.current = nextAudio;
    } catch (error) {
      console.error('Failed to play voice call audio', error);
      setVoiceCallAudioNotice('语音已经生成，但播放阶段失败了。');
    }
  }, []);

  const requestVoiceCallReply = useCallback((text: string, activeSessionId: number) => {
    setIsVoiceCallResponding(true);
    setVoiceCallAudioNotice('');
    void handleVoiceCallAIResponse(text).then((response) => {
      if (!showVoiceCallRef.current || voiceCallSessionIdRef.current !== activeSessionId) return;
      if (!response) {
        setVoiceCallAudioNotice('这次没有拿到角色回复，请检查当前文本模型配置或网络状态。');
        return;
      }
      const aiMsg = {
        role: 'model' as const,
        text: response.text,
        ...(response.translation ? { translation: response.translation } : {}),
      };
      setVoiceCallHistory(prev => {
        const newHistory = [...prev, aiMsg];
        voiceCallHistoryRef.current = newHistory;
        return newHistory;
      });
      if (!response.audioUrl && character.voiceProfile?.enabled) {
        setVoiceCallAudioNotice('这次只回了文字，语音没有成功播报。请检查 MiniMax 额度、TTS Key 和当前绑定音色。');
      }
      playVoiceCallAudio(response.audioUrl);
    }).finally(() => {
      if (voiceCallSessionIdRef.current === activeSessionId) {
        setIsVoiceCallResponding(false);
      }
    });
  }, [character.voiceProfile?.enabled, handleVoiceCallAIResponse, playVoiceCallAudio]);

  useEffect(() => {
    const memoryLimit = getDirectMemoryMessageLimit(character.memoryLimit);
    const shouldShowHint =
      !character.autoSummaryEnabled &&
      history.length > memoryLimit;
    const dismissKey = `memory_window_hint_dismissed_${character.id}`;

    if (!shouldShowHint) return;

    try {
      if (localStorage.getItem(dismissKey) === '1') return;
    } catch (error) {
      // Ignore storage access issues and fall back to in-memory display.
    }

    setShowMemoryWindowHint(true);
  }, [character.id, character.autoSummaryEnabled, character.memoryLimit, history.length]);

  useEffect(() => {
    if (!showDatingModal) {
      resetDatingScenePresentation();
    }
  }, [showDatingModal]);

  useEffect(() => {
    if (!datingResumeSignal) return;
    if (handledDatingResumeSignalRef.current === datingResumeSignal) return;
    handledDatingResumeSignalRef.current = datingResumeSignal;

    if (datingConfig && activeSavedDate) {
      setShowDatingModal(true);
    }
  }, [activeSavedDate, datingConfig, datingResumeSignal]);

  const handleSendVoiceCallText = () => {
    if (!voiceCallInput.trim()) return;
    
    const text = voiceCallInput;
    const activeSessionId = voiceCallSessionIdRef.current;
    setVoiceCallInput('');
    
    const userMsg = { role: 'user' as const, text: text };
    setVoiceCallHistory(prev => {
      const newHistory = [...prev, userMsg];
      voiceCallHistoryRef.current = newHistory;
      return newHistory;
    });
    
    requestVoiceCallReply(text, activeSessionId);
  };

  const startVoiceCall = () => {
    setShowVoiceCall(true);
    showVoiceCallRef.current = true;
    voiceCallSessionIdRef.current += 1;
    setVoiceCallDuration(0);
    setVoiceCallHistory([]);
    setIsVoiceCallResponding(false);
    setVoiceCallAudioNotice('');
    setCurrentInterimSpeech('');
    voiceCallHistoryRef.current = [];
    setShowFunPanel(false);

    if (voiceCallTimerRef.current) clearInterval(voiceCallTimerRef.current);
    voiceCallTimerRef.current = setInterval(() => {
      setVoiceCallDuration(prev => prev + 1);
    }, 1000);

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'zh-CN';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
           const activeSessionId = voiceCallSessionIdRef.current;
           if (!showVoiceCallRef.current || voiceCallSessionIdRef.current !== activeSessionId) {
             return;
           }
           const userMsg = { role: 'user' as const, text: finalTranscript };
           setVoiceCallHistory(prev => {
             const newHistory = [...prev, userMsg];
             voiceCallHistoryRef.current = newHistory;
             return newHistory;
           });
           
           // Trigger AI response if recording is active (or always? User said "react to user's voice")
           // The previous requirement said "Only when recording is active will the transcribed text be saved."
           // But for interaction, it should probably respond.
           // However, if I only save when recording, maybe I should only respond when recording?
           // The user request "ai要在语音通话是对用户的语音做出反应" implies interaction.
           // Let's assume interaction happens always, but saving to "Call Record" depends on the record button.
           // Wait, the previous instruction said: "The voice call content (transcription) will not be sent to the chat history... Only when recording is active will the transcribed text be saved."
           // This implies the "Call Record" feature.
           // For the live interaction, it should probably happen regardless of "recording for history".
           // But if the user is not "recording", maybe they don't want the AI to hear/respond?
           // Standard voice call behavior: AI always listens and responds. "Recording" is for saving the call.
           // So I will trigger AI response always.
           
           requestVoiceCallReply(finalTranscript, activeSessionId);
        }

        setCurrentInterimSpeech(interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Voice call recognition error:', event.error);
        if (event.error === 'no-speech') {
          // Restart recognition on no-speech to keep it listening
          try {
            recognition.stop();
            setTimeout(() => {
              if (showVoiceCallRef.current) {
                recognition.start();
              }
            }, 100);
          } catch (e) {
            console.error('Failed to restart recognition:', e);
          }
        }
      };

      recognition.onend = () => {
        // Automatically restart if it ends unexpectedly while the call is still active
        if (showVoiceCallRef.current) {
          try {
            recognition.start();
          } catch (e) {
            console.error('Failed to restart recognition on end:', e);
          }
        }
      };

      recognition.start();
      voiceCallRecognitionRef.current = recognition;
    }
  };

  const endVoiceCall = () => {
    showVoiceCallRef.current = false;
    voiceCallSessionIdRef.current += 1;
    if (voiceCallTimerRef.current) clearInterval(voiceCallTimerRef.current);
    if (voiceCallRecognitionRef.current) {
      voiceCallRecognitionRef.current.stop();
    }
    voiceCallAudioRef.current?.pause();
    voiceCallAudioRef.current = null;
    
    setShowVoiceCall(false);
    setIsVoiceCallResponding(false);
    setVoiceCallAudioNotice('');

    finalizeVoiceCall({
      duration: voiceCallDuration,
      voiceCallHistory: voiceCallHistoryRef.current,
      isRecordingCall,
    });

    setIsRecordingCall(false);
  };

  // Auto-scroll for voice call
  useEffect(() => {
    if (showVoiceCall && voiceCallEndRef.current) {
      voiceCallEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [voiceCallHistory, currentInterimSpeech, showVoiceCall]);

  useEffect(() => () => {
    voiceCallAudioRef.current?.pause();
    voiceCallAudioRef.current = null;
  }, []);

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

  const handleMessageClick = (e: React.MouseEvent, index: number) => {
    if (multiSelectMode) {
      const targetMessage = history[index];
      if (!targetMessage) {
        return;
      }

      const selectionKey = getMessageSelectionKey(targetMessage);
      const newSelected = new Set(selectedMessages);
      if (newSelected.has(selectionKey)) {
        newSelected.delete(selectionKey);
      } else {
        newSelected.add(selectionKey);
      }
      setSelectedMessages(newSelected);
      return;
    }
    
    e.preventDefault();
    
    const container = document.getElementById('phone-container');
    const targetMessage = history[index];
    if (!targetMessage) {
      return;
    }

    setContextMenu({
      ...getContextMenuPosition({
      containerRect: container?.getBoundingClientRect(),
      clickX: e.clientX,
      clickY: e.clientY,
      index,
      }),
      messageTimestamp: targetMessage.timestamp,
      messageRole: targetMessage.role,
      messageText: targetMessage.text,
    });
  };

  const handleModelAvatarTap = useCallback((e: React.MouseEvent, index: number) => {
    if (multiSelectMode) {
      handleMessageClick(e, index);
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (shouldPauseDirectChatComposer || isLoading) {
      lastModelAvatarTapAtRef.current = 0;
      return;
    }

    const now = Date.now();
    if (now - lastModelAvatarTapAtRef.current <= DIRECT_POKE_DOUBLE_TAP_WINDOW_MS) {
      lastModelAvatarTapAtRef.current = 0;
      void sendPokeInteraction();
      return;
    }

    lastModelAvatarTapAtRef.current = now;
  }, [
    handleMessageClick,
    isLoading,
    multiSelectMode,
    sendPokeInteraction,
    shouldPauseDirectChatComposer,
  ]);

  const closeContextMenu = () => setContextMenu(null);

  const handleRecall = () => {
    if (!contextMenuMessage) {
      closeContextMenu();
      return;
    }

    recallMessageAt(contextMenuMessageIndex);
    closeContextMenu();
  };

  const handleCopy = async () => {
    if (!contextMenuMessage) {
      closeContextMenu();
      return;
    }

    const result = await copyMessageAt(contextMenuMessageIndex);
    closeContextMenu();

    if (!result.ok) {
      alert(result.message);
    }
  };

  const handleFavorite = () => {
    if (!contextMenuMessage) {
      closeContextMenu();
      return;
    }

    toggleFavoriteAt(contextMenuMessageIndex);
    closeContextMenu();
  };

  const handleDeleteMessage = () => {
    if (!contextMenuMessage) {
      closeContextMenu();
      return;
    }

    deleteMessageAt(contextMenuMessageIndex);
    closeContextMenu();
  };

  const handleToggleTranscript = () => {
    if (!contextMenuMessage || !contextMenuMessage.audioUrl || !contextMenuMessage.audioTranscript) {
      closeContextMenu();
      return;
    }

    const messageKey = getMessageSelectionKey(contextMenuMessage);
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

  const handleMultiSelect = () => {
    if (!contextMenuMessage) {
      closeContextMenu();
      return;
    }

    setMultiSelectMode(true);
    setSelectedMessages(new Set([getMessageSelectionKey(contextMenuMessage)]));
    closeContextMenu();
  };

  const handleQuoteReply = () => {
    if (!contextMenuMessage) {
      closeContextMenu();
      return;
    }

    quoteReplyAt(contextMenuMessageIndex);
    closeContextMenu();
  };

  const handleStartEdit = () => {
    if (!contextMenuMessage || contextMenuMessageIndex < 0 || !isEditableMessage(contextMenuMessage)) {
      closeContextMenu();
      return;
    }

    setEditingMessageIndex(contextMenuMessageIndex);
    setInput(contextMenuMessage.text);
    setActionInput('');
    setShowActionInput(false);
    setReplyingTo(null);
    setIsVoiceMode(false);
    closeContextMenu();
    requestAnimationFrame(() => focusTextEntryElement(inputTextareaRef.current));
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
    setInput('');
    setActionInput('');
  };

  const handleRegenerate = async () => {
    if (!contextMenuMessage || contextMenuMessageIndex < 0 || !canRegenerateMessage(contextMenuMessageIndex, contextMenuMessage)) {
      closeContextMenu();
      return;
    }

    closeContextMenu();
    await regenerateLatestReplyAt(contextMenuMessageIndex);
  };

  const handleGenerateAudio = async () => {
    if (!contextMenuMessage || contextMenuMessageIndex < 0 || !canGenerateMessageAudio(contextMenuMessage)) {
      closeContextMenu();
      return;
    }

    closeContextMenu();
    await generateAudioForMessageAt(contextMenuMessageIndex);
  };

  const handleBacktrack = () => {
    if (!contextMenuMessage || contextMenuMessageIndex < 0 || !canBacktrackMessage(contextMenuMessage)) {
      closeContextMenu();
      return;
    }

    backtrackToMessageAt(contextMenuMessageIndex);
    closeContextMenu();
  };

  const handleForward = () => {
    if (!contextMenuMessage) {
      closeContextMenu();
      return;
    }

    forwardMessageAt(contextMenuMessageIndex);
    closeContextMenu();
  };

  const handleShare = () => {
    if (!contextMenuMessage) {
      closeContextMenu();
      return;
    }

    const payload = createSharePayloadAt(contextMenuMessageIndex);
    if (payload) {
      setPendingShare(payload);
    }
    closeContextMenu();
  };

  const openInnerVoiceCard = (messageIndex: number) => {
    setActiveInnerVoiceIndex(messageIndex);
  };

  const closeInnerVoiceCard = () => {
    setActiveInnerVoiceIndex(null);
  };

  const shareInnerVoiceToMoment = (message: ChatMessage) => {
    if (!onPublishMoment) {
      return;
    }

    const legacyParts = getLegacyTranslationParts(message.text);
    const parsedCard = parseInnerVoiceCardContent(sanitizePipeMarkers(legacyParts.mainText || message.text, '\n'));
    const content = [
      parsedCard.headline,
      '',
      parsedCard.body,
      parsedCard.ps ? `P.S. ${parsedCard.ps}` : '',
    ].filter(Boolean).join('\n\n');

    onPublishMoment({
      authorId: character.id,
      content,
      isCollected: !!message.isFavorited,
      sourceChatMessage: {
        characterId: character.id,
        timestamp: message.timestamp,
      },
      imageCard: {
        title: `${character.name} 的心声`,
        description: parsedCard.body.slice(0, 80),
        theme: 'note',
        layout: 'inner-voice',
        overlayText: parsedCard.headline.split('\n')[0] || '心声',
      },
    });

    setActiveInnerVoiceIndex(null);
  };

  const canSetImageAsCharacterAvatar = !!(
    contextMenuMessage
    && contextMenuMessage.role === 'user'
    && contextMenuMessage.imageUrl
    && !/^\[(?:sticker|表情包)\]/i.test((contextMenuMessage.text || '').trim())
  );

  const handleSetCharacterAvatarFromMessage = () => {
    if (!contextMenuMessage?.imageUrl) {
      closeContextMenu();
      return;
    }

    closeContextMenu();

    void handleSend({
      promptText: '[sent an image]',
      userText: '\u628a\u8fd9\u5f20\u6362\u6210\u4f60\u7684\u5934\u50cf\u5427',
      imageUrl: contextMenuMessage.imageUrl,
      forceReply: true,
    });
  };

  const deleteSelectedMessages = () => {
    const selectedIndexes = history.reduce<number[]>((acc, message, index) => {
      if (selectedMessages.has(getMessageSelectionKey(message))) {
        acc.push(index);
      }
      return acc;
    }, []);

    deleteSelectedMessagesFromRuntime(selectedIndexes);
    setMultiSelectMode(false);
    setSelectedMessages(new Set());
  };

  const startRecording = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          sendSpeechTranscript(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          alert('无法访问麦克风。请确保您已允许浏览器使用麦克风权限。');
        } else if (event.error === 'no-speech' || event.error === 'aborted') {
          // Ignore no-speech and aborted errors
          return;
        } else {
          // alert('语音识别出错: ' + event.error);
        }
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } else {
      alert('您的浏览器不支持语音输入');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = scrollRef.current;
    if (!container) {
      messagesEndRef.current?.scrollIntoView({ behavior });
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  };

  const hiddenMessageCount = Math.max(0, history.length - visibleMessageCount);
  const visibleHistory = useMemo(
    () => history.slice(hiddenMessageCount),
    [hiddenMessageCount, history],
  );
  const expandVisibleMessageWindow = useCallback(() => {
    if (hiddenMessageCount <= 0) {
      return;
    }

    if (historyWindowRestoreRef.current) {
      return;
    }

    const container = scrollRef.current;
    if (container) {
      historyWindowRestoreRef.current = {
        previousScrollHeight: container.scrollHeight,
        previousScrollTop: container.scrollTop,
      };
    }

    setVisibleMessageCount((current) => Math.min(history.length, current + CHAT_HISTORY_LOAD_STEP));
  }, [hiddenMessageCount, history.length]);

  const handleMessageListScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (event.currentTarget.scrollTop <= CHAT_HISTORY_LOAD_MORE_THRESHOLD) {
      expandVisibleMessageWindow();
    }
  }, [expandVisibleMessageWindow]);

  const latestMessageKey = history.length > 0
    ? getMessageSelectionKey(history[history.length - 1])
    : '';

  useEffect(() => {
    setVisibleMessageCount((current) => Math.min(current, history.length));
  }, [history.length]);

  useLayoutEffect(() => {
    const wasActive = previousActiveStateRef.current;
    previousActiveStateRef.current = isActive;

    if (!isActive || wasActive === isActive) {
      return;
    }

    latestViewReadyRef.current = false;
    historyWindowRestoreRef.current = null;
    setVisibleMessageCount(Math.min(history.length, CHAT_HISTORY_INITIAL_WINDOW));
  }, [history.length, isActive]);

  useLayoutEffect(() => {
    const previousHistoryAutoscrollState = previousHistoryAutoscrollStateRef.current;
    const contentChanged = (
      latestMessageKey !== previousHistoryAutoscrollState.latestMessageKey
      || isLoading !== previousHistoryAutoscrollState.isLoading
    );
    previousHistoryAutoscrollStateRef.current = {
      latestMessageKey,
      isLoading,
    };

    if (!contentChanged) {
      return;
    }

    if (!isActive) {
      return;
    }

    if (showSettings || showAvatarLibrary) {
      return;
    }

    scrollToBottom('auto');
  }, [isActive, isLoading, latestMessageKey, showAvatarLibrary, showSettings]);

  useLayoutEffect(() => {
    const restore = historyWindowRestoreRef.current;
    const container = scrollRef.current;

    if (!restore || !container) {
      return;
    }

    container.scrollTop = restore.previousScrollTop + (container.scrollHeight - restore.previousScrollHeight);
    historyWindowRestoreRef.current = null;
  }, [visibleMessageCount]);

  useLayoutEffect(() => {
    const transientPanelOpen = showSettings || showAvatarLibrary;
    const wasTransientPanelOpen = previousTransientPanelOpenRef.current;
    previousTransientPanelOpenRef.current = transientPanelOpen;

    if (transientPanelOpen || !wasTransientPanelOpen) {
      return;
    }

    latestViewReadyRef.current = false;
    historyWindowRestoreRef.current = null;
    setVisibleMessageCount(Math.min(history.length, CHAT_HISTORY_INITIAL_WINDOW));
  }, [history.length, showAvatarLibrary, showSettings]);



  const { resolvedUrl: resolvedChatBackgroundUrl } = useResolvedPersistentValue(visualSettings?.chat?.background);
  const { resolvedUrl: resolvedChatMessageBackgroundUrl } = useResolvedPersistentValue(visualSettings?.chat?.messageBackgroundImageUrl);
  const { resolvedUrl: resolvedCharacterBackgroundUrl } = useResolvedPersistentValue(character.background);
  const { resolvedUrl: resolvedCharacterAvatarUrl } = useResolvedPersistentValue(character.avatar);
  const { resolvedUrl: resolvedUserAvatarUrl } = useResolvedPersistentValue(userAvatar);
  const { resolvedUrl: resolvedCharacterBubbleImageUrl } = useResolvedPersistentValue(character.bubbleImage);
  const { resolvedUrl: resolvedUserBubbleImageUrl } = useResolvedPersistentValue(character.userBubbleImage);
  const settingsPanel = (
    <ChatSettingsPanel 
      character={character} 
      characters={characters}
      onUpdate={onUpdateCharacter} 
      onBack={() => setShowSettings(false)} 
      onToggleRelationshipBlock={onToggleCharacterBlock}
      onOpenRelationshipProfile={onOpenCharacterProfile ? () => {
        setShowSettings(false);
        onOpenCharacterProfile();
      } : undefined}
      history={history}
      setHistory={setHistory}
      groups={groups}
      activeConfig={activeConfig}
      worldBooks={worldBook}
      masks={masks}
      callHistory={callHistory}
      favorites={favorites}
      setFavorites={setFavorites}
      onDeleteCallRecord={onDeleteCallRecord}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
      visualSettings={visualSettings}
      onUpdateVisualSettings={onUpdateVisualSettings}
      friendRequests={friendRequests}
    />
  );
  const activeBackground = resolveDirectChatBackground({
    characterBackground: character.background,
    resolvedCharacterBackgroundUrl,
    globalBackground: visualSettings?.chat?.background,
    resolvedGlobalBackgroundUrl: resolvedChatBackgroundUrl,
  });
  const directResolvedTextBubbleStylesByRole = useMemo<Record<'model' | 'user', DirectResolvedTextBubbleStyles>>(() => ({
    model: {
      bubbleStyle: getDirectTextBubbleStyle({
        role: 'model',
        visualSettings,
        activeBackground: activeBackground || undefined,
        resolvedChatMessageBackgroundUrl: resolvedChatMessageBackgroundUrl || undefined,
        resolvedCharacterBubbleImageUrl: resolvedCharacterBubbleImageUrl || undefined,
        resolvedUserBubbleImageUrl: resolvedUserBubbleImageUrl || undefined,
        character,
      }),
      textStyle: getDirectTextContentStyle({
        role: 'model',
        visualSettings,
        character,
      }),
    },
    user: {
      bubbleStyle: getDirectTextBubbleStyle({
        role: 'user',
        visualSettings,
        activeBackground: activeBackground || undefined,
        resolvedChatMessageBackgroundUrl: resolvedChatMessageBackgroundUrl || undefined,
        resolvedCharacterBubbleImageUrl: resolvedCharacterBubbleImageUrl || undefined,
        resolvedUserBubbleImageUrl: resolvedUserBubbleImageUrl || undefined,
        character,
      }),
      textStyle: getDirectTextContentStyle({
        role: 'user',
        visualSettings,
        character,
      }),
    },
  }), [
    activeBackground,
    character,
    resolvedCharacterBubbleImageUrl,
    resolvedChatMessageBackgroundUrl,
    resolvedUserBubbleImageUrl,
    visualSettings,
  ]);
  const directBubbleThemeCss = buildScopedBubbleThemeCss(visualSettings?.chat?.bubbleStyleCss, '.chat-bubble-theme-scope');
  const directModelBubbleThemeCss = buildScopedBubbleVariantCss(
    visualSettings?.chat?.modelBubbleStyleCss,
    '.chat-bubble-theme-scope',
    '.bot-bubble',
  );
  const directUserBubbleThemeCss = buildScopedBubbleVariantCss(
    visualSettings?.chat?.userBubbleStyleCss,
    '.chat-bubble-theme-scope',
    '.user-bubble',
  );
  const directCharacterBubbleThemeCss = hasBubbleThemeCss(character.bubbleStyleCss)
    ? buildScopedBubbleThemeCss(character.bubbleStyleCss, '.chat-bubble-theme-scope')
    : buildScopedBubbleVariantCss(character.bubbleStyleCss, '.chat-bubble-theme-scope', '.chat-bubble-left');
  const directCharacterUserBubbleThemeCss = hasBubbleThemeCss(character.userBubbleStyleCss)
    ? buildScopedBubbleThemeCss(character.userBubbleStyleCss, '.chat-bubble-theme-scope')
    : buildScopedBubbleVariantCss(character.userBubbleStyleCss, '.chat-bubble-theme-scope', '.chat-bubble-right');
  const directAvatarFrameThemeCss = buildScopedAvatarFrameThemeCss(
    visualSettings?.chat?.avatarFrameCss,
    '.chat-avatar-frame-theme',
  );
  const directModelAvatarFrameThemeCss = buildScopedAvatarFrameThemeCss(
    visualSettings?.chat?.modelAvatarFrameCss,
    '.chat-avatar-frame-model',
  );
  const directUserAvatarFrameThemeCss = buildScopedAvatarFrameThemeCss(
    visualSettings?.chat?.userAvatarFrameCss,
    '.chat-avatar-frame-user',
  );
  const directCharacterAvatarFrameThemeCss = buildScopedAvatarFrameThemeCss(
    character.avatarFrameCss,
    '.chat-avatar-frame-model',
  );
  const directCharacterUserAvatarFrameThemeCss = buildScopedAvatarFrameThemeCss(
    character.userAvatarFrameCss,
    '.chat-avatar-frame-user',
  );
  const headerState = useMemo(
    () => getChatHeaderState(character, history, isLoading),
    [character, history, isLoading],
  );
  const layoutConfig = useMemo(() => getChatLayoutConfig(), []);
  const showChatTimeDividers = settings.showChatTimeDividers ?? true;
  const showChatMessageTime = settings.showChatMessageTime ?? character.showTime ?? true;
  const visibleDirectRows = useMemo(
    () => visibleHistory.map((msg, visibleIndex) => {
      const index = hiddenMessageCount + visibleIndex;
      const messageSelectionKey = getMessageSelectionKey(msg);
      const previousMessage = visibleIndex > 0 ? visibleHistory[visibleIndex - 1] : undefined;

      return {
        msg,
        index,
        messageSelectionKey,
        messageRenderKey: `${messageSelectionKey}::${index}`,
        shouldRenderTimeDivider: showChatTimeDividers && shouldShowChatTimeDivider(msg.timestamp, previousMessage?.timestamp),
      };
    }),
    [hiddenMessageCount, showChatTimeDividers, visibleHistory],
  );
  const chatFontFamily = getThemeSelectedFontStack(visualSettings?.themeTypography);
  const chatTextStyle = chatFontFamily ? { fontFamily: chatFontFamily } : undefined;
  const directChatFontCss = chatFontFamily
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
  const bubbleScale = clampChatBubbleScale(visualSettings?.chat?.bubbleScale);
  const textBubbleWidthPercent = Math.min(96, Math.max(76, 88 + (bubbleScale - 1) * 22));
  const mediaBubbleWidthPercent = Math.min(96, Math.max(72, 84 + (bubbleScale - 1) * 18));
  const getDirectBubbleScaleStyle = ({
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

  useEffect(() => {
    const wasKeyboardOpen = previousChatKeyboardOpenRef.current;
    previousChatKeyboardOpenRef.current = chatKeyboardOpen;

    if (
      typeof document === 'undefined'
      || !chatKeyboardOpen
      || wasKeyboardOpen
      || document.activeElement !== inputTextareaRef.current
    ) {
      return;
    }

    let frameOne = 0;
    let frameTwo = 0;
    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        scrollToBottom('auto');
      });
    });

    return () => {
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
    };
  }, [chatKeyboardOpen]);

  useLayoutEffect(() => {
    if (!isActive) {
      latestViewReadyRef.current = false;
      return;
    }

    if (showSettings || showAvatarLibrary) {
      latestViewReadyRef.current = false;
      return;
    }

    if (!latestMessageKey && !isLoading) {
      return;
    }

    if (latestViewReadyRef.current) {
      return;
    }

    scrollToBottom('auto');
    latestViewReadyRef.current = true;
  }, [isActive, isLoading, latestMessageKey, showAvatarLibrary, showSettings, visibleMessageCount]);

  useEffect(() => {
    const textarea = inputTextareaRef.current;
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
  
  const headerStyleType = visualSettings?.chat?.headerStyle || 'default';
  const footerStyleType = visualSettings?.chat?.footerStyle || 'default';
  const directFooterClassName = 'px-3 pt-1 border-t backdrop-blur-md flex flex-col gap-1.5';
  let headerClasses = 'relative z-20 px-4 pb-1.5 min-h-[52px] flex items-center shrink-0 ';
  let headerStyleObj: React.CSSProperties = {};
  let footerStyleObj: React.CSSProperties = {};
  const shouldReduceKeyboardVisualEffects = chatKeyboardOpen;
  const chatHeaderTopPadding = 'calc(env(safe-area-inset-top, 0px) + 12px)';
  const chatHeaderTitleTop = 'calc(env(safe-area-inset-top, 0px) + 8px)';
  let footerClassName = directFooterClassName;
  let footerControlTone = {
    iconButton: activeBackground ? 'bg-white/50 text-zinc-600 hover:bg-white/80' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100',
    inputShell: activeBackground ? 'bg-white/50 border-white/30' : 'bg-zinc-50 border-zinc-100',
    voiceButton: activeBackground ? 'bg-white/50 text-zinc-800 border border-white/30 active:bg-white/70' : 'bg-zinc-50 text-zinc-800 border border-zinc-100 active:bg-zinc-100',
  };
  
  if (headerStyleType === 'default') {
    headerClasses += "backdrop-blur-md border-b";
    headerStyleObj = {
      paddingTop: chatHeaderTopPadding,
      backgroundColor: `rgba(255, 255, 255, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.8) : 1})`,
      borderColor: `rgba(228, 228, 231, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.8) : 1})`
    };
  } else if (headerStyleType === 'glass') {
    headerClasses += "backdrop-blur-xl border-b";
    headerStyleObj = {
      paddingTop: chatHeaderTopPadding,
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      borderColor: 'rgba(255, 255, 255, 0.3)'
    };
  } else if (headerStyleType === 'solid') {
    headerClasses += "border-b";
    headerStyleObj = {
      paddingTop: chatHeaderTopPadding,
      backgroundColor: 'white',
      borderColor: '#e4e4e7'
    };
  } else if (headerStyleType === 'transparent') {
    headerStyleObj = {
      paddingTop: chatHeaderTopPadding,
      backgroundColor: 'transparent',
      borderColor: 'transparent'
    };
  }

  if (footerStyleType === 'default') {
    footerClassName = directFooterClassName;
    footerStyleObj = {
      backgroundColor: `rgba(255, 255, 255, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.8) : 1})`,
      borderColor: `rgba(228, 228, 231, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.8) : 1})`
    };
  } else if (footerStyleType === 'glass') {
    footerClassName = directFooterClassName.replace('backdrop-blur-md', 'backdrop-blur-xl');
    footerStyleObj = {
      backgroundColor: 'rgba(255, 255, 255, 0.42)',
      borderColor: 'rgba(255, 255, 255, 0.34)'
    };
    footerControlTone = {
      iconButton: 'bg-white/70 text-zinc-700 hover:bg-white/85',
      inputShell: 'bg-white/72 border-white/50',
      voiceButton: 'bg-white/72 text-zinc-800 border border-white/45 active:bg-white/85',
    };
  } else if (footerStyleType === 'solid') {
    footerClassName = directFooterClassName.replace('backdrop-blur-md', '');
    footerStyleObj = {
      backgroundColor: '#f4f4f5',
      borderColor: '#e4e4e7'
    };
    footerControlTone = {
      iconButton: 'bg-white text-zinc-600 hover:bg-zinc-100',
      inputShell: 'bg-white border-zinc-200',
      voiceButton: 'bg-white text-zinc-800 border border-zinc-200 active:bg-zinc-100',
    };
  } else if (footerStyleType === 'transparent') {
    footerClassName = directFooterClassName.replace('backdrop-blur-md', '');
    footerStyleObj = {
      backgroundColor: 'transparent',
      borderColor: 'transparent'
    };
    footerControlTone = {
      iconButton: 'bg-white/72 text-zinc-700 hover:bg-white/88',
      inputShell: 'bg-white/78 border-white/55',
      voiceButton: 'bg-white/78 text-zinc-800 border border-white/55 active:bg-white/9',
    };
  }

  if (shouldReduceKeyboardVisualEffects) {
    headerClasses = removeBackdropBlurClassNames(headerClasses);
    footerClassName = removeBackdropBlurClassNames(footerClassName);
    headerStyleObj = {
      ...headerStyleObj,
      backgroundColor: headerStyleType === 'transparent'
        ? 'rgba(255, 255, 255, 0.94)'
        : 'rgba(255, 255, 255, 0.96)',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      boxShadow: 'none',
    };
    footerStyleObj = {
      ...footerStyleObj,
      backgroundColor: footerStyleType === 'transparent'
        ? 'rgba(255, 255, 255, 0.96)'
        : 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      boxShadow: 'none',
    };
  }

  const hasVisibleMessages = history.length > 0 || isLoading || !!error;
  const chatFooterStyle: React.CSSProperties = {
    paddingBottom: 'var(--app-safe-area-bottom-ui, 0px)',
    ...footerStyleObj,
    contain: shouldReduceKeyboardVisualEffects ? 'layout paint style' : undefined,
    transition: shouldReduceKeyboardVisualEffects ? 'none' : 'padding-bottom 180ms ease',
  };
  const chatMessageListStyle: React.CSSProperties = {
    paddingBottom: '8px',
    minHeight: 0,
    scrollPaddingBottom: '12px',
  };
  const chatRootClassName = 'relative z-[60] flex h-full min-h-0 flex-col overflow-hidden bg-zinc-50 chat-bubble-theme-scope';
  const chatRootSizeStyle: React.CSSProperties = {
    height: '100%',
    minHeight: 0,
  };

  if (suspendHeavyRendering) {
    return (
      <div
        ref={chatRootRef}
        className={chatRootClassName}
        style={{
          ...chatRootSizeStyle,
          fontSize: visualSettings?.chat?.fontSize ?? 14,
          ...(chatFontFamily ? { fontFamily: chatFontFamily } : {}),
        }}
        data-session-suspended="true"
      />
    );
  }

  if (showSettings) {
    return settingsPanel;
  }

  if (showAvatarLibrary) {
    return (
      <AvatarLibraryPanel
        character={character}
        onBack={() => setShowAvatarLibrary(false)}
        onPatchCharacter={(patch) => {
          if (onPatchCharacter) {
            onPatchCharacter(patch);
            return;
          }
          onUpdateCharacter({
            ...character,
            ...patch,
          });
        }}
      />
    );
  }

  return (
    <motion.div 
      ref={chatRootRef}
      className={chatRootClassName}
      style={{ 
        ...chatRootSizeStyle,
        backgroundImage: activeBackground ? `url(${activeBackground})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontSize: visualSettings?.chat?.fontSize ?? 14,
        ...(chatFontFamily ? { fontFamily: chatFontFamily } : {}),
        // Android WebView/Chrome is prone to black-screen repaint glitches when
        // keyboard-driven viewport changes are combined with CSS zoom. iOS
        // viewports are also prone to lifting the whole page when a focused
        // textarea lives inside a zoomed container.
        ...((visualSettings?.chat?.uiScale ?? 1) !== 1 && !chatKeyboardOpen ? {
          // @ts-ignore
          zoom: visualSettings?.chat?.uiScale ?? 1,
        } : {}),
      }}
    >
      {(
        directBubbleThemeCss
        || directModelBubbleThemeCss
        || directUserBubbleThemeCss
        || directCharacterBubbleThemeCss
        || directCharacterUserBubbleThemeCss
        || directAvatarFrameThemeCss
        || directModelAvatarFrameThemeCss
        || directUserAvatarFrameThemeCss
        || directCharacterAvatarFrameThemeCss
        || directCharacterUserAvatarFrameThemeCss
        || directChatFontCss
      ) && (
        <style>
          {[
            directBubbleThemeCss,
            directModelBubbleThemeCss,
            directUserBubbleThemeCss,
            directCharacterBubbleThemeCss,
            directCharacterUserBubbleThemeCss,
            directAvatarFrameThemeCss,
            directModelAvatarFrameThemeCss,
            directUserAvatarFrameThemeCss,
            directCharacterAvatarFrameThemeCss,
            directCharacterUserAvatarFrameThemeCss,
            directChatFontCss,
          ].filter(Boolean).join('\n\n')}
        </style>
      )}
      {/* Header */}
      {multiSelectMode ? (
        <div 
          className={`chat-session-header chat-header chat-header--multiselect ${headerClasses} justify-between`}
          style={headerStyleObj}
        >
          <button onClick={() => {
            setMultiSelectMode(false);
            setSelectedMessages(new Set());
          }} className="chat-header-action-button chat-header-cancel-button text-zinc-500 font-medium text-[15px]">
            取消
          </button>
          <h1 className="text-[16px] font-bold text-zinc-900">已选择 {selectedMessages.size} 条</h1>
          <button onClick={deleteSelectedMessages} className="text-red-500 font-medium text-[15px] disabled:opacity-50" disabled={selectedMessages.size === 0}>
            删除
          </button>
        </div>
      ) : (
        <div 
          className={`chat-session-header chat-header ${headerClasses} justify-between`}
          style={headerStyleObj}
        >
          <div className="chat-header-leading flex items-center gap-1 z-10">
            <button onClick={onBack} className="chat-header-back-button p-1 -ml-1 text-zinc-400 active:text-zinc-600">
              <ChevronLeft size={24} className="chat-header-back-icon" />
            </button>
            <button
              onClick={() => onOpenCharacterMoments?.()}
              className="chat-header-avatar-button ml-1 rounded-full active:scale-95 transition-transform cursor-pointer p-0.5"
              aria-label="打开角色主页"
            >
              <PersistentImage value={character.avatar} alt={character.name} className="chat-header-avatar w-8 h-8 rounded-full object-cover bg-zinc-100 border border-zinc-200/50" />
            </button>
          </div>
          
          <div
            className="chat-header-title-block absolute inset-x-0 bottom-0 flex flex-col items-center justify-center px-20 pointer-events-none"
            style={{ top: chatHeaderTitleTop }}
          >
            <h1 className="chat-header-title text-[16px] font-bold text-zinc-900 truncate max-w-full text-center leading-tight">{headerState.title}</h1>
            <p className="chat-header-subtitle text-[10px] text-zinc-500 text-center mt-0.5 truncate max-w-full">{headerState.subtitle}</p>
          </div>

          <div className="chat-header-actions z-10 flex items-center gap-1">
            <button onClick={() => setShowAvatarLibrary(true)} className="chat-header-action-button p-2 text-zinc-400 active:text-zinc-600" aria-label="打开头像库" title="头像库">
              <Images size={20} />
            </button>
            <button onClick={() => setShowSettings(true)} className="chat-header-action-button chat-header-settings-button p-2 text-zinc-400 active:text-zinc-600">
              <Settings size={20} className="chat-header-settings-icon" />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className={`${layoutConfig.messageListClass} min-h-0 ${hasVisibleMessages ? '' : ' flex flex-col justify-end'}`}
        style={chatMessageListStyle}
        onScroll={handleMessageListScroll}
      >
        {hiddenMessageCount > 0 && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={expandVisibleMessageWindow}
              className="rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-[11px] text-zinc-500 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
            >
              查看更早消息 ({hiddenMessageCount})
            </button>
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-[13px] text-red-500">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                {error}
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="shrink-0 rounded-full p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-500"
                aria-label="关闭错误提示"
                title="关闭错误提示"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        {relationshipBlockNotice && (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-[12px] leading-5 ${
              isBlockedByUser
                ? 'border-zinc-200 bg-zinc-100/90 text-zinc-600'
                : 'border-red-100 bg-red-50/90 text-red-500'
            }`}
          >
            {relationshipBlockNotice}
          </div>
        )}
        {showMemoryWindowHint && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-[12px] text-amber-900">
            <div className="flex items-start justify-between gap-3">
              <p className="leading-5">
                较早的聊天内容仍会保留在记录里，但已不再自动带入当前对话。若想保留更长的记忆连续性，可以开启自动总结。
              </p>
              <button
                onClick={() => {
                  setShowMemoryWindowHint(false);
                  try {
                    localStorage.setItem(`memory_window_hint_dismissed_${character.id}`, '1');
                  } catch (storageError) {
                    // Ignore storage access issues for this lightweight hint.
                  }
                }}
                className="shrink-0 text-[11px] font-medium text-amber-700 hover:text-amber-900"
              >
                知道了
              </button>
            </div>
          </div>
        )}
        {visibleDirectRows.map((row) => {
          const {
            msg,
            index: i,
            messageSelectionKey,
            messageRenderKey,
            shouldRenderTimeDivider,
          } = row;
          if (msg.isSystem) {
            return (
              <div key={messageRenderKey}>
                {shouldRenderTimeDivider && (
                  <div className="mb-3 flex justify-center">
                    <div className="rounded-full bg-white/72 px-3 py-1 text-[11px] text-zinc-500 shadow-sm backdrop-blur-sm">
                      {formatChatDividerTime(msg.timestamp)}
                    </div>
                  </div>
                )}
                <div className="mb-4 flex justify-center" style={{ marginTop: visualSettings?.chat?.messageSpacing ?? 16 }}>
                  <div
                    className={`relative max-w-[88%] rounded-full px-3 py-1 pr-8 text-[11px] font-medium backdrop-blur-sm ${
                      msg.systemTone === 'danger'
                        ? 'bg-red-50/90 text-red-500'
                        : 'bg-zinc-200/60 text-zinc-500'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => deleteMessageAt(i)}
                      className={`absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors ${
                        msg.systemTone === 'danger'
                          ? 'text-red-300 hover:bg-red-100 hover:text-red-500'
                          : 'text-zinc-400 hover:bg-zinc-300/60 hover:text-zinc-600'
                      }`}
                      aria-label="删除提示"
                      title="删除提示"
                    >
                      <X size={12} />
                    </button>
                    <span className="block whitespace-pre-wrap break-words pr-1">
                      {msg.text}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={messageRenderKey}>
              {shouldRenderTimeDivider && (
                <div className="mb-3 flex justify-center">
                  <div className="rounded-full bg-white/72 px-3 py-1 text-[11px] text-zinc-500 shadow-sm backdrop-blur-sm">
                    {formatChatDividerTime(msg.timestamp)}
                  </div>
                </div>
              )}
            <div className={`w-full flex items-end gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`} style={{ marginTop: visualSettings?.chat?.messageSpacing ?? 16 }}>
               {multiSelectMode && (
                 <div className={`flex items-center px-2 ${msg.role === 'user' ? 'order-first mr-2' : 'order-first mr-2'}`}>
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       handleMessageClick(e, i);
                     }}
                     className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${selectedMessages.has(messageSelectionKey) ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-300 bg-white'}`}
                   >
                     {selectedMessages.has(messageSelectionKey) && <Check size={12} strokeWidth={3} />}
                   </button>
                 </div>
              )}
              
              <div className={`flex flex-1 min-w-0 items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatars */}
                {msg.role === 'model' && (
                  <div className="w-10 shrink-0 flex justify-center pt-0.5">
                    <AvatarFrame
                      src={getDisplayableAssetValue(character.avatar, resolvedCharacterAvatarUrl)}
                      alt={character.name}
                      size={visualSettings?.chat?.avatarSize ?? 32}
                      borderRadius={visualSettings?.chat?.avatarBorderRadius ?? 16}
                      borderWidth={visualSettings?.chat?.avatarBorderWidth ?? 0}
                      borderColor={visualSettings?.chat?.avatarBorderColor ?? '#e4e4e7'}
                      variant="lite"
                      scopeClassName="chat-avatar-frame-theme chat-avatar-frame-model"
                      className={
                        multiSelectMode
                          ? 'cursor-pointer'
                          : shouldPauseDirectChatComposer || isLoading
                            ? 'cursor-not-allowed opacity-70'
                            : 'cursor-pointer transition-transform active:scale-95'
                      }
                      onClick={(e) => handleModelAvatarTap(e, i)}
                    />
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="w-10 shrink-0 flex justify-center pt-0.5">
                    <AvatarFrame
                      src={getDisplayableAssetValue(userAvatar, resolvedUserAvatarUrl)}
                      alt={userName}
                      size={visualSettings?.chat?.avatarSize ?? 32}
                      borderRadius={visualSettings?.chat?.avatarBorderRadius ?? 16}
                      borderWidth={visualSettings?.chat?.avatarBorderWidth ?? 0}
                      borderColor={visualSettings?.chat?.avatarBorderColor ?? '#e4e4e7'}
                      variant="lite"
                      scopeClassName="chat-avatar-frame-theme chat-avatar-frame-user"
                      className="cursor-pointer"
                      onClick={(e) => !multiSelectMode && handleMessageClick(e, i)}
                    />
                  </div>
                )}
                
                {/* Message Content */}
                <div className={`relative group flex-1 min-w-0 flex flex-col gap-1 pt-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                   {msg.isRecalled ? (
                     <div className="text-zinc-400 text-xs italic py-2 px-3 bg-zinc-100 rounded-lg">
                       {msg.role === 'user' ? '你撤回了一条消息' : '对方撤回了一条消息'}
                     </div>
                  ) : (
                    <>
                      {(() => {
                        if (msg.text.trim() === '[COUPLE_SPACE_INVITE]') {
                          return (
                            <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                              <div
                                onClick={(e) => {
                                  if (multiSelectMode) {
                                    handleMessageClick(e, i);
                                  }
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  handleMessageClick(e, i);
                                }}
                                className="w-64 rounded-2xl overflow-hidden shadow-sm border border-pink-100 bg-gradient-to-br from-pink-50 via-rose-50 to-white"
                              >
                                <div className="p-4 flex items-start gap-3">
                                  <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center shrink-0">
                                    <CoupleSpaceInviteIcon size={22} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[13px] font-bold text-zinc-900">情侣空间邀请</div>
                                    <p className="mt-1 text-[12px] leading-5 text-zinc-600">
                                      你向 {character.name} 发出了建立情侣空间的邀请。
                                    </p>
                                    <div className="mt-3 inline-flex items-center rounded-full bg-pink-100 px-2.5 py-1 text-[10px] font-medium text-pink-500">
                                      等待回应
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {showChatMessageTime && (
                                <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                  {formatChatMessageTime(msg.timestamp)}
                                </span>
                              )}
                            </div>
                          );
                        }

                        if (msg.text.trim() === '[COUPLE_SPACE_INVITE_ACCEPTED]') {
                          return (
                            <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                              <div
                                onClick={(e) => {
                                  if (multiSelectMode) {
                                    handleMessageClick(e, i);
                                  }
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  handleMessageClick(e, i);
                                }}
                                className="w-64 rounded-2xl overflow-hidden shadow-sm border border-pink-100 bg-gradient-to-br from-pink-50 via-rose-50 to-white"
                              >
                                <div className="p-4 flex items-start gap-3">
                                  <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center shrink-0">
                                    <CoupleSpaceInviteIcon size={22} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[13px] font-bold text-zinc-900">情侣空间已建立</div>
                                    <p className="mt-1 text-[12px] leading-5 text-zinc-600">
                                      {character.name} 已经接下这份邀请，你们的情侣空间现在正式开启了。
                                    </p>
                                    <div className="mt-3 inline-flex items-center rounded-full bg-pink-100 px-2.5 py-1 text-[10px] font-medium text-pink-500">
                                      已同意
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {showChatMessageTime && (
                                <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                  {formatChatMessageTime(msg.timestamp)}
                                </span>
                              )}
                            </div>
                          );
                        }

                        if (msg.contentType === 'game-card-error' || msg.text.trim() === GAME_CARD_FAILURE_TOKEN) {
                          return (
                            <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                              <div className="w-64 rounded-2xl border border-red-100 bg-white/95 px-4 py-4 text-center shadow-sm">
                                <div className="text-[12px] font-semibold text-red-500">卡片生成失败</div>
                                <div className="mt-1 text-[10px] text-zinc-400">这次没有生成完整内容，可以手动重试一次</div>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void regenerateLatestReplyAt(i);
                                  }}
                                  disabled={isLoading}
                                  className="mt-3 inline-flex items-center justify-center rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  重新生成卡片
                                </button>
                              </div>
                              {showChatMessageTime && (
                                <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                  {formatChatMessageTime(msg.timestamp)}
                                </span>
                              )}
                            </div>
                          );
                        }

                        const shouldRenderGameCard =
                          msg.contentType === 'game-card'
                          || msg.text.trim().startsWith('[GAME_CARD]');
                        const gameCardPayloadState = shouldRenderGameCard
                          ? parseGameCardPayloadState(msg)
                          : { status: 'invalid' as const, error: null };

                        if (gameCardPayloadState.status === 'ok') {
                          const gameCardPayload = gameCardPayloadState.payload;
                          return (
                              <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div 
                                  onClick={(e) => handleMessageClick(e, i)}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    handleMessageClick(e, i);
                                  }}
                                >
                                  <GameCard 
                                    data={gameCardPayload.data} 
                                    isUser={msg.role === 'user'} 
                                    disabled={multiSelectMode}
                                    translation={gameCardPayload.translation}
                                  />
                                </div>
                                {showChatMessageTime && (
                                  <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                    {formatChatMessageTime(msg.timestamp)}
                                  </span>
                                )}
                              </div>
                            );
                        }

                        if (gameCardPayloadState.status === 'incomplete') {
                          return (
                            <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                              <div className="w-64 rounded-2xl border border-zinc-200 bg-white/90 px-4 py-4 text-center shadow-sm">
                                <div className="text-[12px] font-semibold text-zinc-700">卡片生成中</div>
                                <div className="mt-1 text-[10px] text-zinc-400">等待内容完整后展示</div>
                              </div>
                              {showChatMessageTime && (
                                <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                  {formatChatMessageTime(msg.timestamp)}
                                </span>
                              )}
                            </div>
                          );
                        }

                        if (msg.isVoiceCall) {
                          return (
                            <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                              <div
                                onClick={(e) => !multiSelectMode && handleMessageClick(e, i)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  handleMessageClick(e, i);
                                }}
                                className={`chat-bubble message-bubble ${msg.role === 'user' ? 'user-bubble right chat-bubble-right' : 'bot-bubble left chat-bubble-left'} inline-flex max-w-[min(84%,16rem)] cursor-pointer flex-col gap-1 rounded-2xl border border-zinc-200 bg-white/95 px-3.5 py-3 shadow-sm transition-all active:scale-[0.98]`}
                                style={getDirectBubbleScaleStyle({
                                  basePaddingX: 14,
                                  basePaddingY: 12,
                                  maxWidthPercent: mediaBubbleWidthPercent,
                                  maxWidthRem: 16,
                                })}
                              >
                                <div className="text-[14px] font-semibold text-zinc-800">[语音通话]</div>
                                <div className="text-[12px] text-zinc-500">
                                  通话时长 {formatVoiceCallDuration(msg.duration || 0)}
                                </div>
                              </div>
                              {showChatMessageTime && (
                                <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                  {formatChatMessageTime(msg.timestamp)}
                                </span>
                              )}
                            </div>
                          );
                        }

                        const transferBracketRegex = /\[转账\s*([\d.]+)\]/i;
                        const transferBlockRegex = /\[transfer\]\s*([\d.]+)\s*\[\/transfer\]/i;
                        const transferPipeRegex = /TRANSFER\|([\d.]+)\|([\s\S]*)/i;
                        const transferBracketMatch = msg.text.match(transferBracketRegex);
                        const transferBlockMatch = msg.text.match(transferBlockRegex);
                        const transferPipeMatch = msg.text.match(transferPipeRegex);
                        const transferMatch = transferBracketMatch ?? transferBlockMatch ?? transferPipeMatch;
                        const cleanText = msg.text
                          .replace(/\[转账\s*[\d.]+\]/gi, '')
                          .replace(/\[transfer\]\s*[\d.]+\s*\[\/transfer\]/gi, '')
                          .replace(/TRANSFER\|[\d.]+\|[\s\S]*/gi, '')
                          .trim();
                        const visualText = stripVisualMessageMarker(cleanText);
                        const amount = transferMatch ? transferMatch[1] : '0.00';

                        return (
                          <>
                            {msg.audioUrl && !msg.isInnerVoice && (
                              <>
                                {msg.replyTo && (
                                  <div className={getMessageReplyPreviewClass(msg.role === 'user')}>
                                    <Reply size={13} className="mt-0.5 shrink-0" style={MESSAGE_REPLY_PREVIEW_ICON_STYLE} />
                                    <div className="min-w-0">
                                      <div className={MESSAGE_REPLY_PREVIEW_LABEL_CLASS} style={MESSAGE_REPLY_PREVIEW_LABEL_STYLE}>
                                        回复 {msg.replyTo.authorLabel}
                                      </div>
                                      <div className={MESSAGE_REPLY_PREVIEW_TEXT_CLASS} style={MESSAGE_REPLY_PREVIEW_TEXT_STYLE}>
                                        {getReplyPreviewText(msg)}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <AudioMessageCard
                                  value={msg.audioUrl}
                                  durationSeconds={msg.duration}
                                  transcript={msg.audioTranscript || null}
                                  translation={msg.translation || null}
                                  showTranscript={!!msg.audioTranscript}
                                  autoPlay={
                                    msg.role === 'model'
                                    && !!character.voiceProfile?.autoPlay
                                    && msg.timestamp >= sessionEnteredAtRef.current
                                  }
                                  isUser={msg.role === 'user'}
                                  onClick={(e) => !multiSelectMode && handleMessageClick(e, i)}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    handleMessageClick(e, i);
                                  }}
                                />
                                {(showChatMessageTime || msg.role === 'user') && (
                                  <div className={`text-[10px] text-zinc-400 shrink-0 mt-0.5 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                    {showChatMessageTime && (
                                      <span>{formatChatMessageTime(msg.timestamp)}</span>
                                    )}
                                    {msg.isEdited && <span className="ml-1">已编辑</span>}
                                    {msg.role === 'user' && renderUserMessageStatus(msg)}
                                  </div>
                                )}
                              </>
                            )}

                            {msg.imageUrl && !msg.isInnerVoice && (
                              <>
                                {msg.replyTo && (
                                  <div
                                    className={getMessageReplyPreviewClass(msg.role === 'user')}
                                  >
                                    <Reply size={13} className="mt-0.5 shrink-0" style={MESSAGE_REPLY_PREVIEW_ICON_STYLE} />
                                    <div className="min-w-0">
                                      <div className={MESSAGE_REPLY_PREVIEW_LABEL_CLASS} style={MESSAGE_REPLY_PREVIEW_LABEL_STYLE}>
                                        回复 {msg.replyTo.authorLabel}
                                      </div>
                                      <div className={MESSAGE_REPLY_PREVIEW_TEXT_CLASS} style={MESSAGE_REPLY_PREVIEW_TEXT_STYLE}>
                                        {getReplyPreviewText(msg)}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div
                                  onClick={(e) => !multiSelectMode && handleMessageClick(e, i)}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    handleMessageClick(e, i);
                                  }}
                                  className={`inline-flex max-w-[min(84%,22rem)] cursor-pointer flex-col gap-2 transition-all active:scale-[0.98] ${
                                    isStickerMessage(msg)
                                      ? 'p-0'
                                      : `chat-bubble message-bubble ${msg.role === 'user' ? 'user-bubble right chat-bubble-right' : 'bot-bubble left chat-bubble-left'} overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 px-2.5 py-2.5 shadow-sm`
                                  }`}
                                  style={{
                                    ...(chatTextStyle || {}),
                                    ...(isStickerMessage(msg)
                                      ? {}
                                      : getDirectBubbleScaleStyle({
                                          basePaddingX: 10,
                                          basePaddingY: 10,
                                          maxWidthPercent: mediaBubbleWidthPercent,
                                          maxWidthRem: 22,
                                        })),
                                  }}
                                >
                                  {!isStickerMessage(msg) && <BubbleThemeAnchors />}
                                  <PersistentImage
                                    value={msg.imageUrl}
                                    alt={isStickerMessage(msg) ? '表情包' : '聊天图片'}
                                    className={`chat-message-image rounded-xl object-contain ${
                                      isStickerMessage(msg)
                                        ? 'max-h-36 max-w-[11rem]'
                                        : 'max-h-48 max-w-[14rem] sm:max-h-52 sm:max-w-[16rem]'
                                    }`}
                                  />
                                  {visualText ? (
                                    <span className="whitespace-pre-wrap break-words px-1 text-[14px] leading-6 text-zinc-800" style={chatTextStyle}>
                                      {visualText}
                                    </span>
                                  ) : null}
                                </div>
                                {(showChatMessageTime || msg.role === 'user') && (
                                  <div className={`text-[10px] text-zinc-400 shrink-0 mt-0.5 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                    {showChatMessageTime && (
                                      <span>{formatChatMessageTime(msg.timestamp)}</span>
                                    )}
                                    {msg.isEdited && <span className="ml-1">已编辑</span>}
                                    {msg.role === 'user' && renderUserMessageStatus(msg)}
                                  </div>
                                )}
                              </>
                            )}

                            {!msg.imageUrl && !msg.audioUrl && cleanText && !msg.isInnerVoice && (() => {
                              const legacyTranslationParts = getLegacyTranslationParts(cleanText);
                              const translationText = msg.translation?.trim() || legacyTranslationParts.translation;

                              return (
                                <>
                                  {msg.replyTo && (
                                    <div
                                      className={getMessageReplyPreviewClass(msg.role === 'user')}
                                    >
                                      <Reply size={13} className="mt-0.5 shrink-0" style={MESSAGE_REPLY_PREVIEW_ICON_STYLE} />
                                      <div className="min-w-0">
                                        <div className={MESSAGE_REPLY_PREVIEW_LABEL_CLASS} style={MESSAGE_REPLY_PREVIEW_LABEL_STYLE}>
                                          回复 {msg.replyTo.authorLabel}
                                        </div>
                                        <div className={MESSAGE_REPLY_PREVIEW_TEXT_CLASS} style={MESSAGE_REPLY_PREVIEW_TEXT_STYLE}>
                                          {getReplyPreviewText(msg)}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <div
                                    onClick={(e) => !multiSelectMode && handleMessageClick(e, i)}
                                    className={`chat-bubble message-bubble ${msg.role === 'user' ? 'user-bubble right chat-bubble-right' : 'bot-bubble left chat-bubble-left'} ${getDirectTextBubbleClass(msg.role, layoutConfig.textBubbleMaxWidthClass)} relative cursor-pointer active:scale-[0.98] transition-all border ${
                                      msg.role === 'user' ? 'text-white' : 'text-zinc-800'
                                    }`}
                                    style={{
                                      ...directResolvedTextBubbleStylesByRole[msg.role === 'user' ? 'user' : 'model'].bubbleStyle,
                                      ...(chatTextStyle || {}),
                                      ...getDirectBubbleScaleStyle({
                                        basePaddingX: 16,
                                        basePaddingY: 12,
                                        maxWidthPercent: textBubbleWidthPercent,
                                        maxWidthRem: 32,
                                      }),
                                    }}
                                  >
                                    <BubbleThemeAnchors />
                                    {(() => {
                                      const legacyTranslationParts = getLegacyTranslationParts(cleanText);
                                      const normalizedMainText = sanitizePipeMarkers(legacyTranslationParts.mainText, '\n');
                                      const translationText = msg.translation?.trim() || legacyTranslationParts.translation;

                                      if (translationText) {
                                        const normalizedTranslationText = sanitizePipeMarkers(translationText, '\n');
                                        const bubbleTextStyle = directResolvedTextBubbleStylesByRole[msg.role === 'user' ? 'user' : 'model'].textStyle;
                                        return (
                                          <div className="flex flex-col gap-2">
                                            <span
                                              className="block text-[14px] leading-6 whitespace-pre-wrap break-words text-left"
                                              style={{ ...chatTextStyle, ...bubbleTextStyle, overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                                            >
                                              {normalizedMainText}
                                            </span>
                                            <div className="h-[1px] bg-black/5 w-full" />
                                            <p
                                              className="text-[13px] leading-6 whitespace-pre-wrap break-words text-zinc-500"
                                              style={{ ...chatTextStyle, ...bubbleTextStyle, overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                                            >
                                              {normalizedTranslationText}
                                            </p>
                                          </div>
                                        );
                                      }

                                      return (
                                        <div className="flex flex-col gap-2">
                                            <span
                                              className="block text-[14px] leading-6 whitespace-pre-wrap break-words text-left"
                                              style={{
                                                ...chatTextStyle,
                                                ...directResolvedTextBubbleStylesByRole[msg.role === 'user' ? 'user' : 'model'].textStyle,
                                                overflowWrap: 'anywhere',
                                                wordBreak: 'break-word',
                                              }}
                                            >
                                              {normalizedMainText}
                                            </span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  {(showChatMessageTime || msg.role === 'user') && (
                                    <div className={`text-[10px] text-zinc-400 shrink-0 mt-0.5 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                      {showChatMessageTime && (
                                        <span>{formatChatMessageTime(msg.timestamp)}</span>
                                      )}
                                      {msg.isEdited && <span className="ml-1">已编辑</span>}
                                      {msg.role === 'user' && renderUserMessageStatus(msg)}
                                    </div>
                                  )}
                                </>
                              );
                            })()}

                            {msg.sharedPost && (
                              <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div 
                                  onClick={(e) => {
                                    if (multiSelectMode) {
                                      handleMessageClick(e, i);
                                    } else {
                                      onViewForumPost?.(msg.sharedPost!.id);
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    handleMessageClick(e, i);
                                  }}
                                  className="w-64 bg-white rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer hover:bg-zinc-50 transition-colors"
                                >
                                  <div className="p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <PersistentImage value={msg.sharedPost.authorAvatar} className="w-5 h-5 rounded-full object-cover" />
                                      <span className="text-xs text-zinc-500">{msg.sharedPost.authorName}</span>
                                    </div>
                                    <h4 className="font-bold text-sm text-zinc-900 mb-1 line-clamp-1">{msg.sharedPost.title}</h4>
                                    <p className="text-xs text-zinc-600 line-clamp-2 mb-2">{msg.sharedPost.content}</p>
                                    {msg.sharedPost.images && msg.sharedPost.images.length > 0 && (
                                      <div className="aspect-video rounded-lg overflow-hidden bg-zinc-100">
                                        <PersistentImage value={msg.sharedPost.images[0]} className="w-full h-full object-cover" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="px-3 py-2 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-400">来自 瓜田论坛</span>
                                    <ChevronRight size={12} className="text-zinc-400" />
                                  </div>
                                </div>
                                {showChatMessageTime && (
                                  <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                    {formatChatMessageTime(msg.timestamp)}
                                  </span>
                                )}
                              </div>
                            )}

                            {msg.location && (
                              <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div 
                                  onClick={(e) => {
                                    if (multiSelectMode) {
                                      handleMessageClick(e, i);
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    handleMessageClick(e, i);
                                  }}
                                  className="chat-location-card w-56 bg-white rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer hover:bg-zinc-50 transition-colors"
                                >
                                  <div className="chat-location-card-body p-3">
                                    <div className="chat-location-card-header flex items-center gap-2 mb-2">
                                      <div className="chat-location-card-icon w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                                        <MapPin size={18} />
                                      </div>
                                      <div className="chat-location-card-meta flex flex-col min-w-0">
                                        <span className="text-sm font-bold text-zinc-900 truncate">{msg.location.name}</span>
                                        {msg.location.address && <span className="text-[10px] text-zinc-500 truncate">{msg.location.address}</span>}
                                      </div>
                                    </div>
                                    <div className="chat-location-card-map aspect-video rounded-lg overflow-hidden bg-zinc-100 relative">
                                      <img 
                                        src={`https://picsum.photos/seed/${msg.location.name}/400/225`} 
                                        className="chat-message-image w-full h-full object-cover" 
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="chat-location-card-pin w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg">
                                          <MapPin size={16} />
                                        </div>
                                      </div>
                                      {msg.location.isVirtual && (
                                        <div className="chat-location-card-badge absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full">
                                          虚定位
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="chat-location-card-footer px-3 py-2 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-400">位置分享</span>
                                    <ChevronRight size={12} className="text-zinc-400" />
                                  </div>
                                </div>
                                {showChatMessageTime && (
                                  <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                    {formatChatMessageTime(msg.timestamp)}
                                  </span>
                                )}
                              </div>
                            )}

                            {msg.isInnerVoice && (() => {
                              const legacyInnerVoiceParts = getLegacyTranslationParts(msg.text);
                              const parsedCard = parseInnerVoiceCardContent(
                                sanitizePipeMarkers(legacyInnerVoiceParts.mainText || msg.text, '\n'),
                              );
                              const innerVoiceTranslation = sanitizePipeMarkers(
                                msg.translation?.trim() || legacyInnerVoiceParts.translation,
                                '\n',
                              );
                              const teaserLines = parsedCard.headline.split('\n').filter(Boolean).slice(0, 2);

                              return (
                                <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                  <div 
                                    onClick={(e) => {
                                      if (multiSelectMode) {
                                        handleMessageClick(e, i);
                                        return;
                                      }

                                      if (msg.role === 'model') {
                                        openInnerVoiceCard(i);
                                        return;
                                      }

                                      handleMessageClick(e, i);
                                    }}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      handleMessageClick(e, i);
                                    }}
                                    className={`chat-inner-voice-card inline-block overflow-hidden border cursor-pointer transition-all hover:opacity-95 ${
                                      msg.role === 'user'
                                        ? 'w-[min(66vw,18rem)] max-w-[min(66vw,18rem)] rounded-[24px] bg-white border-zinc-200 shadow-sm'
                                        : 'w-[min(72vw,18.5rem)] max-w-[min(72vw,18.5rem)] rounded-[22px] border-[rgba(200,120,128,0.14)] bg-[#FAF8F4] shadow-[0_2px_6px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]'
                                    }`}
                                    aria-disabled={msg.role === 'user' && isLoading}
                                  >
                                    {msg.role === 'user' ? (
                                      <>
                                        <div className="px-3.5 py-3.5 flex items-center gap-3">
                                          <div className="w-10 h-10 bg-pink-50 text-pink-500 rounded-full flex items-center justify-center shrink-0">
                                            <Heart size={19} fill="currentColor" />
                                          </div>
                                          <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-bold text-zinc-900 truncate">{'倾听心声'}</span>
                                            <span className="text-[10px] text-zinc-500 truncate">{'正在感知对方此刻藏起来的话...'}</span>
                                          </div>
                                        </div>
                                        <div className="px-3.5 py-2.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                                          <span className="text-[10px] text-zinc-400">{'道具使用中'}</span>
                                          <ChevronRight size={12} className="text-zinc-400" />
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex items-center justify-between gap-3 border-b border-[rgba(160,140,120,0.1)] px-4 py-3">
                                          <div className="flex min-w-0 items-center gap-2.5">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#FEF0F2] text-[#C87880]">
                                              <Heart size={14} fill="currentColor" />
                                            </div>
                                            <div className="min-w-0">
                                              <div className="truncate text-[12px] font-semibold text-[#1E1610]" style={{ fontFamily: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif' }}>{'对方的心声'}</div>
                                              <div className="mt-0.5 text-[10px] text-[#B0A090]">{'已解锁 · 点击展开'}</div>
                                            </div>
                                          </div>
                                          <div className="rounded-full border border-[rgba(200,120,128,0.18)] bg-[#FEF0F2] px-2.5 py-1 text-[10px] font-medium text-[#C87880]">{'已解锁'}</div>
                                        </div>
                                        <div className="px-4 py-3.5">
                                          <div className="space-y-1">
                                            {teaserLines.map((line, lineIndex) => (
                                              <div
                                                key={`${line}-${lineIndex}`}
                                                className={`text-[15px] leading-6 ${lineIndex === teaserLines.length - 1 ? 'text-[#C87880]' : 'text-[#1E1610]'}`}
                                                style={{ fontFamily: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif', fontWeight: 600 }}
                                              >
                                                {line}
                                              </div>
                                            ))}
                                          </div>
                                          <p className="mt-3 line-clamp-2 whitespace-pre-wrap break-words text-[12px] leading-6 text-[#7A6A5A]" style={{ fontFamily: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif' }}>
                                            {parsedCard.body}
                                          </p>
                                          {innerVoiceTranslation ? (
                                            <div className="mt-3 border-t border-[rgba(160,140,120,0.1)] pt-3">
                                              <p className="line-clamp-2 whitespace-pre-wrap break-words text-[11px] leading-5 text-[#A08F82]" style={{ fontFamily: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif' }}>
                                                {innerVoiceTranslation}
                                              </p>
                                            </div>
                                          ) : null}
                                        </div>
                                        <div className="flex items-center justify-between border-t border-[rgba(160,140,120,0.1)] px-4 py-2.5 text-[10px] text-[#B0A090]">
                                          <span>{`- ${character.name}`}</span>
                                          <span className="inline-flex items-center gap-1">
                                            <span>{'查看完整卡片'}</span>
                                            <ChevronRight size={12} />
                                          </span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  {showChatMessageTime && (
                                    <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                      {formatChatMessageTime(msg.timestamp)}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}

                            {transferMatch && (
                              <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                {(() => {
                                  const isReceived = msg.transferStatus === 'received';
                                  const isRejected = msg.transferStatus === 'rejected';
                                  const canManualReceive = msg.role === 'model' && !isReceived && !isRejected;
                                  const cardBgClass = isReceived
                                    ? 'bg-[#FBC48A]'
                                    : isRejected
                                      ? 'bg-[#F8B86B]'
                                      : 'bg-[#FA9D3B]';
                                  const cardBodyClass = 'bg-white border-zinc-100';
                                  const cardIconClass = 'bg-white/20 text-white';
                                  const amountClass = 'text-white';
                                  const labelClass = 'text-white/80';
                                  const footerTextClass = 'text-zinc-400';
                                  const transferTargetName = msg.transferTargetLabel || (msg.role === 'user' ? character.name : userName);
                                  const cardLabel = msg.transferDisplayLabel || (
                                    isReceived
                                      ? (msg.role === 'user' ? `${character.name} 已收款` : '你已收款')
                                      : isRejected
                                        ? (msg.role === 'user' ? `${character.name} 已退回` : '已退回')
                                        : (msg.role === 'user' ? `待 ${character.name} 确认` : `待 ${userName} 确认`)
                                  );

                                  return (
                                <div 
                                  onClick={(e) => {
                                    if (multiSelectMode) {
                                      handleMessageClick(e, i);
                                    } else {
                                      if (canManualReceive) {
                                        setActiveIncomingTransferIndex(i);
                                      } else {
                                        handleMessageClick(e, i);
                                      }
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    handleMessageClick(e, i);
                                  }}
                                  className="chat-transfer-card w-60 rounded-xl overflow-hidden shadow-sm cursor-pointer active:opacity-90 transition-opacity"
                                >
                                  <div className={`${cardBgClass} chat-transfer-card-header p-3.5 flex items-center gap-3`}>
                                    <div className={`chat-transfer-card-icon w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${cardIconClass}`}>
                                      {isReceived ? <Check size={24} /> : isRejected ? <X size={24} /> : <Banknote size={24} />}
                                    </div>
                                    <div className="chat-transfer-card-content flex flex-col min-w-0">
                                      <span className={`text-[16px] font-bold ${amountClass}`}>￥{amount}</span>
                                      <span className={`text-[12px] truncate ${labelClass}`}>{cardLabel}</span>
                                    </div>
                                  </div>
                                  <div className={`chat-transfer-card-footer p-2 border border-t-0 ${cardBodyClass}`}>
                                    <div className="flex items-center justify-between gap-3 px-1">
                                      <span className={`text-[10px] ${footerTextClass}`}>{`转账给 ${transferTargetName}`}</span>
                                      {canManualReceive && (
                                        <span className="text-[10px] text-zinc-300">点击处理</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                  );
                                })()}
                                {showChatMessageTime && (
                                  <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                    {formatChatMessageTime(msg.timestamp)}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-2.5">
              <PersistentImage value={character.avatar} className="w-8 h-8 rounded-full object-cover mt-0.5 shrink-0" />
              <div 
                className="chat-bubble message-bubble bot-bubble left chat-bubble-left chat-loading-bubble border rounded-2xl px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                style={{
                  ...directResolvedTextBubbleStylesByRole.model.bubbleStyle,
                  ...getDirectBubbleScaleStyle({
                    basePaddingX: 16,
                    basePaddingY: 12,
                    maxWidthPercent: textBubbleWidthPercent,
                    maxWidthRem: 18,
                  }),
                  ...(chatTextStyle || {}),
                  borderTopLeftRadius: 6,
                }}
              >
                <BubbleThemeAnchors />
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div 
        ref={chatFooterRef}
        className={`chat-session-footer chat-footer shrink-0 ${footerClassName}`}
        style={chatFooterStyle}
      >
        {replyingTo && (
          <div className={getFooterReplyPreviewClass()}>
            <div className="chat-footer-reply-preview-content flex items-center gap-2 truncate">
              <Reply size={14} className="chat-footer-reply-preview-icon shrink-0" style={FOOTER_REPLY_PREVIEW_ICON_STYLE} />
              <span className="font-medium shrink-0">{replyingTo.authorLabel}:</span>
              <span className="truncate">{replyingTo.preview}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className={getFooterReplyCloseButtonClass()}>
              <X size={14} className="chat-footer-reply-close-icon" />
            </button>
          </div>
        )}
        {editingMessageIndex !== null && history[editingMessageIndex] && (
          <div className={getFooterReplyPreviewClass('editing')}>
            <div className="chat-footer-reply-preview-content flex items-center gap-2 truncate">
              <Pencil size={14} className="shrink-0" />
              <span className="shrink-0 font-medium">编辑消息</span>
              <span className="truncate">{history[editingMessageIndex]?.text}</span>
            </div>
            <button onClick={handleCancelEdit} className={getFooterReplyCloseButtonClass('editing')}>
              <X size={14} className="chat-footer-reply-close-icon" />
            </button>
          </div>
        )}
        {showActionDescriptionButton && editingMessageIndex === null && showActionInput && !isVoiceMode && (
          <div className={`chat-footer-action-input-shell flex items-start gap-2 rounded-2xl border px-3 py-2 ${
            footerControlTone.inputShell
          }`}>
            <span className="mt-0.5 shrink-0 text-[13px] font-medium text-zinc-500">（）</span>
            <textarea
              value={actionInput}
              onChange={e => setActionInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendCurrentText();
                }
              }}
              placeholder="动作、神态或场景..."
              className="chat-footer-action-textarea min-h-[22px] max-h-24 w-full resize-none bg-transparent text-[14px] leading-5 text-zinc-800 outline-none placeholder:text-zinc-400"
              rows={1}
            />
          </div>
        )}
        <div className="chat-footer-controls flex items-end gap-1.5">
          <button 
            onClick={() => {
              if (shouldPauseDirectChatComposer) {
                return;
              }
              setIsVoiceMode(!isVoiceMode);
              setIsInputExpanded(false);
            }}
            disabled={shouldPauseDirectChatComposer}
            className={`chat-footer-voice-toggle-button w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0 transition-all ${
              shouldPauseDirectChatComposer
                ? 'bg-zinc-100/70 text-zinc-300 cursor-not-allowed'
                : isVoiceMode
                  ? 'bg-zinc-100 text-zinc-800'
                  : footerControlTone.iconButton
            }`}
          >
            {isVoiceMode ? <Keyboard size={19} className="chat-footer-voice-toggle-icon" /> : <Mic size={19} className="chat-footer-voice-toggle-icon" />}
          </button>

          {showManualReplyButton && (
            <button
              type="button"
              onClick={() => {
                requestManualReply();
                if (showStickerPanel) setShowStickerPanel(false);
                if (showFunPanel) setShowFunPanel(false);
              }}
              disabled={!canUseManualSpeakButton}
              title="让TA说话"
              aria-label="让TA说话"
              className={`chat-footer-manual-reply-button w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0 transition-all ${
                canUseManualSpeakButton
                  ? `${footerControlTone.iconButton} active:scale-90`
                  : 'bg-zinc-100/70 text-zinc-300 cursor-not-allowed'
              }`}
            >
              <MessageCircle size={18} className="chat-footer-manual-reply-icon" />
            </button>
          )}

          {isVoiceMode ? (
            <button
              onPointerDown={audioRecordInteraction.onPointerDown}
              onPointerUp={audioRecordInteraction.onPointerUp}
              onPointerCancel={audioRecordInteraction.onPointerCancel}
              onPointerLeave={audioRecordInteraction.onPointerLeave}
              className={`chat-footer-voice-button flex-1 h-9 rounded-2xl font-medium text-[15px] transition-all active:scale-[0.98] select-none ${
                isAudioRecording 
                  ? 'bg-zinc-200 text-zinc-800' 
                  : footerControlTone.voiceButton
              }`}
            >
              {isRecording ? '松开 发送' : '按住 说话'}
            </button>
          ) : (
            <div className={`chat-footer-input-shell flex-1 min-h-9 border rounded-2xl px-3 py-1.5 focus-within:border-blue-500 transition-colors flex items-end gap-2 ${
              footerControlTone.inputShell
            }`}>
              {showActionDescriptionButton && editingMessageIndex === null && (
                <button
                  type="button"
                  onClick={() => setShowActionInput(prev => !prev)}
                  disabled={shouldPauseDirectChatComposer}
                  className={`chat-footer-action-toggle-button -ml-1 flex h-6 min-w-7 shrink-0 items-center justify-center rounded-full px-1 text-[12px] font-medium transition-colors ${
                    shouldPauseDirectChatComposer
                      ? 'text-zinc-300 cursor-not-allowed'
                      : showActionInput
                        ? 'bg-zinc-100 text-zinc-700 shadow-inner'
                        : 'text-zinc-500 hover:bg-zinc-100'
                  }`}
                  title="场景动作描述"
                  aria-label="场景动作描述"
                >
                  （）
                </button>
              )}
              <textarea 
                ref={inputTextareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={shouldPauseDirectChatComposer}
                onBlur={() => {
                  if (!input.trim()) {
                    setIsInputExpanded(false);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendCurrentText();
                  }
                }}
                placeholder={shouldPauseDirectChatComposer ? '你已拉黑对方，普通聊天已暂停' : '发送消息...'}
                className="chat-footer-textarea w-full bg-transparent outline-none text-[15px] leading-6 text-zinc-900 placeholder:text-zinc-500 resize-none min-h-[24px]"
                rows={1}
              />
              <button
                type="button"
                onClick={() => {
                  setIsInputExpanded(prev => !prev);
                }}
                className={`chat-footer-expand-button shrink-0 p-1 transition-colors ${showExpandInputToggle ? 'text-zinc-400 hover:text-zinc-700' : 'hidden'}`}
                aria-label="展开完整输入"
                title="展开完整输入"
              >
                {isInputExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
              <button 
                onClick={() => {
                  if (shouldPauseDirectChatComposer) {
                    return;
                  }
                  setShowStickerPanel(!showStickerPanel);
                  if (showFunPanel) setShowFunPanel(false);
                }} 
                disabled={shouldPauseDirectChatComposer}
                className={`chat-footer-emoji-button p-1 transition-colors shrink-0 ${
                  shouldPauseDirectChatComposer
                    ? 'text-zinc-300 cursor-not-allowed'
                    : showStickerPanel
                      ? 'text-zinc-900'
                      : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                <Smile size={20} className="chat-footer-emoji-icon" />
              </button>
            </div>
          )}

          {!isVoiceMode && (input.trim() || actionInput.trim()) ? (
            <button 
              onClick={() => void sendCurrentText()}
              disabled={shouldPauseDirectChatComposer}
              className={`chat-footer-send-button w-[34px] h-[34px] rounded-full border border-zinc-200 bg-white/92 shadow-sm flex items-center justify-center transition-all shrink-0 ${
                shouldPauseDirectChatComposer
                  ? 'cursor-not-allowed text-zinc-300'
                  : 'text-zinc-700 active:scale-90 active:bg-zinc-100'
              }`}
            >
              <Send size={16} className="chat-footer-send-icon" />
            </button>
          ) : (
            <button 
              onClick={() => {
                if (shouldPauseDirectChatComposer) {
                  return;
                }
                setShowFunPanel(!showFunPanel);
                if (showStickerPanel) setShowStickerPanel(false);
              }}
              disabled={shouldPauseDirectChatComposer}
              className={`chat-footer-plus-button w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0 transition-all ${
                shouldPauseDirectChatComposer
                  ? 'bg-zinc-100/70 text-zinc-300 cursor-not-allowed'
                  : showFunPanel
                    ? 'bg-zinc-100 text-zinc-800 rotate-45'
                    : footerControlTone.iconButton
              }`}
            >
              <Plus size={20} className="chat-footer-plus-icon" />
            </button>
          )}
        </div>
        
        {/* Panels Container */}
        <div className="relative">
          {/* Sticker Panel */}
          <AnimatePresence>
            {showStickerPanel && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="chat-footer-panel chat-footer-sticker-panel overflow-hidden"
              >
                <div className="pt-4">
                  <div className="chat-footer-sticker-tabs flex border-b border-zinc-100 mb-3">
                    <button 
                      onClick={() => setStickerTab('basic')}
                      className={`chat-footer-sticker-tab-button flex-1 py-2 text-[13px] font-medium transition-colors ${stickerTab === 'basic' ? 'text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-500 hover:bg-zinc-50'}`}
                    >
                      基础表情
                    </button>
                    <button 
                      onClick={() => setStickerTab('custom')}
                      className={`chat-footer-sticker-tab-button flex-1 py-2 text-[13px] font-medium transition-colors ${stickerTab === 'custom' ? 'text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-500 hover:bg-zinc-50'}`}
                    >
                      自定义表情
                    </button>
                  </div>
                  <div className="chat-footer-sticker-scroll h-48 overflow-y-auto">
                    {stickerTab === 'basic' ? (
                      <div className="chat-footer-emoji-grid grid grid-cols-6 gap-2">
                        {BASIC_CHAT_EXPRESSIONS.map((expression) => (
                          <button 
                            key={expression.value}
                            onClick={() => {
                              setInput(prev => prev + expression.value);
                            }}
                            className={`chat-footer-emoji-grid-button rounded-lg flex h-[52px] items-center justify-center transition-colors hover:bg-zinc-50 ${
                              expression.kind === 'kaomoji'
                                ? 'col-span-2 px-1 text-[11px] font-medium leading-tight tracking-[-0.01em] text-zinc-700'
                                : 'text-[26px]'
                            }`}
                          >
                            <span className={expression.kind === 'kaomoji' ? 'whitespace-pre-wrap break-all text-center' : ''}>
                              {expression.value}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div>
                        {availableCustomStickers.length > 0 ? (
                          <div className="chat-footer-custom-sticker-grid grid grid-cols-5 gap-2">
                            {availableCustomStickers.map((sticker, idx) => (
                              <button 
                                key={idx}
                                onClick={() => {
                                  sendStickerMessage(sticker);
                                  setShowStickerPanel(false);
                                }}
                                className="chat-footer-custom-sticker-button aspect-square rounded-lg overflow-hidden border border-zinc-100 hover:border-blue-300 transition-colors"
                              >
                                <PersistentImage value={sticker} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="chat-footer-sticker-empty h-full flex flex-col items-center justify-center text-zinc-400 py-8">
                            <Smile size={32} className="mb-2 opacity-50" />
                            <p className="text-[12px]">暂无自定义表情</p>
                            <p className="text-[10px] mt-1">请在聊天设置中导入</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fun Panel */}
          <AnimatePresence>
            {showFunPanel && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="chat-footer-panel chat-footer-fun-panel overflow-hidden"
              >
                <div className="chat-footer-fun-grid pt-4 grid grid-cols-4 gap-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="chat-footer-fun-action flex flex-col items-center gap-2"
                  >
                    <div className="chat-footer-fun-action-icon w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <ImageIcon size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">发送图片</span>
                  </button>
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleImageUpload} 
                  />

                  <button
                    onClick={() => {
                      setShowFunPanel(false);
                      void sendPokeInteraction();
                    }}
                    disabled={shouldPauseDirectChatComposer || isLoading}
                    className="chat-footer-fun-action flex flex-col items-center gap-2 disabled:cursor-not-allowed"
                  >
                    <div className={`chat-footer-fun-action-icon w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${
                      shouldPauseDirectChatComposer || isLoading
                        ? 'bg-zinc-100/70 text-zinc-300'
                        : 'bg-zinc-100 text-zinc-900 active:scale-95'
                    }`}>
                      <Hand size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">拍一拍</span>
                  </button>
                  
                  <button 
                    onClick={startVoiceCall}
                    className="chat-footer-fun-action flex flex-col items-center gap-2"
                  >
                    <div className="chat-footer-fun-action-icon w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <Phone size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">语音通话</span>
                  </button>

                  <button 
                    onClick={() => {
                      setTransferType('toCharacter');
                      setTransferAmount('');
                      setShowTransferDialog(true);
                      setShowFunPanel(false);
                    }}
                    className="chat-footer-fun-action flex flex-col items-center gap-2"
                  >
                    <div className="chat-footer-fun-action-icon w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <Banknote size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">转给Ta</span>
                  </button>

                  <button 
                    onClick={() => {
                      if (!datingConfig) {
                        setError('当前未选择有效的 API 配置。');
                        setShowFunPanel(false);
                        return;
                      }
                      setShowDatingModal(true);
                      setShowFunPanel(false);
                    }}
                    className="chat-footer-fun-action flex flex-col items-center gap-2"
                  >
                    <div className="chat-footer-fun-action-icon w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <Coffee size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">线下约会</span>
                  </button>

                  <button 
                    onClick={() => {
                      setShowFunPanel(false);
                      if (hasOpenedCoupleSpace) {
                        return;
                      }
                      sendCoupleSpaceInvitation();
                    }}
                    disabled={hasOpenedCoupleSpace}
                    className="chat-footer-fun-action flex flex-col items-center gap-2 disabled:cursor-not-allowed"
                  >
                    <div className={`chat-footer-fun-action-icon w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${
                      hasOpenedCoupleSpace
                        ? 'bg-pink-50 text-pink-300'
                        : 'bg-zinc-100 text-zinc-900 active:scale-95'
                    }`}>
                      <CoupleSpaceInviteIcon size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">情侣空间</span>
                  </button>

                  <button 
                    onClick={() => {
                      setShowGameCenter(true);
                      setShowFunPanel(false);
                    }}
                    className="chat-footer-fun-action flex flex-col items-center gap-2"
                  >
                    <div className="chat-footer-fun-action-icon w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <Gamepad2 size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">小游戏</span>
                  </button>

                  <button 
                    onClick={() => {
                      setShowLocationPicker(true);
                      setShowFunPanel(false);
                    }}
                    className="chat-footer-fun-action flex flex-col items-center gap-2"
                  >
                    <div className="chat-footer-fun-action-icon w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <MapPin size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">发送定位</span>
                  </button>

                  <button 
                    onClick={() => {
                      setShowFunPanel(false);
                      sendInnerVoiceProbe();
                    }}
                    className="chat-footer-fun-action flex flex-col items-center gap-2"
                  >
                    <div className="chat-footer-fun-action-icon w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <Heart size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">心声</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ExpandedInputSheet
        open={false}
        value={input}
        onChange={setInput}
        onClose={() => undefined}
        onSend={() => undefined}
        canSend={!!input.trim() || !!actionInput.trim()}
        placeholder="发送消息..."
        style={chatTextStyle}
      />

      <GroupLocationPickerSheet
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSend={(location) => sendLocationMessage(`[sent location] ${location.name}`, location)}
      />

      {/* Legacy Location Picker */}
      <AnimatePresence>
        {false && showLocationPicker && (
          <div className="absolute inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full rounded-t-[32px] p-6 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[18px] font-bold text-zinc-900">发送位置</h3>
                <button onClick={() => setShowLocationPicker(false)} className="p-2 text-zinc-400">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 mb-8">
                <button 
                  onClick={() => {
                    const loc = {
                      name: '我的当前位置',
                      address: '成都市锦江区春熙路',
                      isVirtual: false
                    };
                    setShowLocationPicker(false);
                    sendLocationMessage('[分享位置]', loc);
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-zinc-50 hover:bg-zinc-100 rounded-2xl transition-colors text-left group"
                >
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0 group-active:scale-95 transition-transform">
                    <MapPin size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-zinc-900">当前定位</div>
                    <div className="text-[12px] text-zinc-500">发送你现在的真实位置</div>
                  </div>
                  <ChevronRight size={18} className="text-zinc-300" />
                </button>

                <button 
                  onClick={() => {
                    const virtualLocations = [
                      { name: '三里屯太古里', address: '北京市朝阳区' },
                      { name: '外滩', address: '上海市黄浦区' },
                      { name: '珠江新城', address: '广州市天河区' },
                      { name: '深圳湾公园', address: '深圳市南山区' },
                      { name: '春熙路', address: '成都市锦江区' },
                      { name: '西湖景区', address: '杭州市西湖区' }
                    ];
                    const loc = virtualLocations[Math.floor(Math.random() * virtualLocations.length)];
                    setShowLocationPicker(false);
                    sendLocationMessage(`[分享位置] ${loc.name}`, {
                      ...loc,
                      isVirtual: true
                    });
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-zinc-50 hover:bg-zinc-100 rounded-2xl transition-colors text-left group"
                >
                  <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shrink-0 group-active:scale-95 transition-transform">
                    <ScanEye size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-zinc-900">虚定位</div>
                    <div className="text-[12px] text-zinc-500">随机发送一个虚拟位置</div>
                  </div>
                  <ChevronRight size={18} className="text-zinc-300" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {datingConfig && (
        <DatingModal
          isOpen={showDatingModal}
          onClose={() => {
            resetDatingScenePresentation();
            setShowDatingModal(false);
          }}
          onEndDateComplete={({ archivedSession, returnChatText }) => {
            resetDatingScenePresentation();
            setShowDatingModal(false);
            const settlement = buildDatingEndedSettlement(character, archivedSession);
            if (onPatchCharacter) {
              onPatchCharacter({
                activeDatingState: undefined,
                sharedContextSnapshots: settlement.sharedContextSnapshots,
                shortTermSummary: settlement.shortTermSummary,
                openLoopRegistry: settlement.openLoopRegistry,
                sharedState: settlement.sharedState,
              });
            } else {
              onUpdateCharacter({
                ...character,
                activeDatingState: undefined,
                sharedContextSnapshots: settlement.sharedContextSnapshots,
                shortTermSummary: settlement.shortTermSummary,
                openLoopRegistry: settlement.openLoopRegistry,
                sharedState: settlement.sharedState,
              });
            }
            void appendWorkingMemorySnapshots({
              characterId: character.id,
              sourceScene: 'dating',
              shortTermSummary: settlement.shortTermSummary,
              sharedState: settlement.sharedState,
              timestamp: archivedSession.endedAt || Date.now(),
            }).catch((error) => {
              console.error('[chat-session] Failed to persist dating settlement memory snapshots', error);
            });
            if (!returnChatText.trim()) {
              return;
            }
            const latestHistoryTimestamp = history[history.length - 1]?.timestamp || 0;
            const endedAt = archivedSession.endedAt || 0;
            const nextReplyTimestamp = Math.max(Date.now(), endedAt, latestHistoryTimestamp + 1);
            setHistory([
              ...history,
              {
                role: 'model',
                text: returnChatText.trim(),
                timestamp: nextReplyTimestamp,
              },
            ]);
          }}
          character={character}
          userProfile={{ name: userName, avatar: userAvatar, id: 'user', bio: '', mood: '' }}
          activeConfig={datingConfig}
          chatHistory={history}
          worldBooks={worldBook || []}
          perception={perception}
          onSaveDate={onSaveDate || (() => {})}
          onCollectDate={onCollectDate || (() => {})}
          initialSession={activeSavedDate}
        />
      )}

      {/* Voice Call UI */}
      <AnimatePresence>
        {showVoiceCall && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[100] overflow-hidden bg-[#0f1115] flex flex-col"
          >
            {/* Background Blur */}
            <div 
              className="absolute inset-0 opacity-70 scale-105"
              style={{
                backgroundImage: (() => {
                  const avatarSrc = getDisplayableAssetValue(character.avatar, resolvedCharacterAvatarUrl);
                  return avatarSrc ? `url(${avatarSrc})` : 'none';
                })(),
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
            
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,0.12),rgba(7,10,16,0.34)_48%,rgba(7,10,16,0.52)_100%)]" />

            <div className="relative z-10 flex w-full flex-col items-center justify-center gap-2 px-6 pt-[92px] text-white/80">
              <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] tracking-[0.18em]">
                语音通话
              </span>
              <p className="text-[13px] text-white/66">
                {isVoiceCallResponding ? '对方正在说话...' : currentInterimSpeech ? '正在听你说...' : '通话中'}
              </p>
              {voiceCallAudioNotice ? (
                <div className="mt-4 max-w-[78%] rounded-2xl border border-amber-200/18 bg-amber-50/10 px-4 py-2.5 text-center text-[12px] leading-5 text-amber-100">
                  {voiceCallAudioNotice}
                </div>
              ) : null}
            </div>

            <div className="relative z-10 w-full pt-10 flex flex-col items-center">
              <h2 className="text-white text-[34px] font-semibold tracking-[0.04em] mb-2">{character.name}</h2>
              <p className="rounded-full border border-white/10 bg-white/8 px-4 py-1.5 text-[12px] text-white/70">
                {formatVoiceCallDuration(voiceCallDuration)} · {formatVoiceCallSecondsLabel(voiceCallDuration)}
              </p>
            </div>

            <div className="relative z-10 w-full flex-1 flex flex-col justify-end px-6 pb-4 overflow-hidden">
              <div 
                className="w-full h-[420px] overflow-y-auto flex flex-col gap-3 px-2 py-2"
                style={{ maskImage: 'linear-gradient(to bottom, transparent, black 7%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 7%)' }}
              >
                <div className="flex-1" /> {/* Spacer to push content down initially */}
                {voiceCallHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`
                      px-4 py-3 rounded-[22px] max-w-[85%] text-[15px] leading-7 shadow-sm
                      ${msg.role === 'user' 
                        ? 'bg-white text-zinc-900 rounded-br-md' 
                        : 'bg-white/12 text-white rounded-bl-md border border-white/10 backdrop-blur-md'}
                    `}>
                      <div>{msg.text}</div>
                      {msg.role === 'model' && msg.translation ? (
                        <div className="mt-2 border-t border-white/10 pt-2 text-[13px] leading-6 text-white/84">
                          翻译：{msg.translation}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {currentInterimSpeech && (
                  <div className="flex justify-end">
                    <div className="bg-white/10 border border-dashed border-white/20 text-white/74 px-4 py-3 rounded-[22px] rounded-br-md max-w-[85%] text-[15px] leading-7">
                      {currentInterimSpeech}
                    </div>
                  </div>
                )}
                {isVoiceCallResponding && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[12px] text-white/70">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/80" />
                      正在回复...
                    </div>
                  </div>
                )}
                <div ref={voiceCallEndRef} />
              </div>
            </div>

            {/* Text Input for Voice Call */}
            <div className="relative z-10 w-full px-6 pb-8 flex gap-3 items-center">
               <div className="flex-1 relative">
                <input
                  type="text"
                  value={voiceCallInput}
                  onChange={(e) => setVoiceCallInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendVoiceCallText()}
                  placeholder="输入文字回复..."
                  className="w-full bg-white/10 text-white placeholder-white/50 pl-4 pr-10 py-3 rounded-[22px] outline-none border border-white/12 focus:bg-white/14 transition-all"
                />
                {voiceCallInput && (
                  <button 
                    onClick={() => setVoiceCallInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button 
                onClick={handleSendVoiceCallText}
                disabled={!voiceCallInput.trim()}
                className="bg-white/12 text-white p-4 rounded-full disabled:opacity-45 transition-all border border-white/12 active:scale-95"
              >
                <Send size={20} />
              </button>
            </div>

            {/* Controls */}
            <div className="relative z-10 w-full flex justify-center gap-7 px-6">
              <button 
                onClick={() => setIsRecordingCall(!isRecordingCall)}
                className={`w-[72px] h-[72px] rounded-full flex items-center justify-center text-white active:scale-95 transition-all ${isRecordingCall ? 'bg-[#ff5f57] shadow-[0_14px_34px_rgba(255,95,87,0.28)]' : 'bg-white/12'}`}
              >
                {isRecordingCall ? <div className="w-6 h-6 bg-white rounded-sm animate-pulse" /> : <div className="w-5 h-5 bg-[#ff5f57] rounded-full" />}
              </button>
              <button 
                onClick={endVoiceCall}
                className="w-[84px] h-[84px] rounded-full bg-[#ff4d4f] flex items-center justify-center text-white shadow-[0_16px_40px_rgba(255,77,79,0.34)] active:scale-95 transition-transform"
              >
                <PhoneOff size={32} />
              </button>
              <button className="w-[72px] h-[72px] rounded-full bg-white/12 flex items-center justify-center text-white active:scale-95 transition-transform">
                <Settings size={30} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeIncomingTransferIndex !== null && history[activeIncomingTransferIndex] && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white w-full max-w-[300px] rounded-2xl p-6 shadow-xl"
            >
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-[#FA9D3B]/12 text-[#FA9D3B] flex items-center justify-center">
                  <Banknote size={28} />
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-zinc-400">转账金额</div>
                <div className="mt-2 text-4xl font-bold text-zinc-900">
                  ￥{(() => {
                    const msg = history[activeIncomingTransferIndex];
                    const transferBracketMatch = msg.text.match(/\[转账\s*([\d.]+)\]/i);
                    const transferBlockMatch = msg.text.match(/\[transfer\]\s*([\d.]+)\s*\[\/transfer\]/i);
                    const transferPipeMatch = msg.text.match(/TRANSFER\|([\d.]+)\|([\s\S]*)/i);
                    return (transferBracketMatch ?? transferBlockMatch ?? transferPipeMatch)?.[1] ?? '0.00';
                  })()}
                </div>
                <div className="mt-2 text-sm text-zinc-500">{character.name} 向你发起转账</div>
              </div>
              <div className="mt-6 rounded-2xl bg-zinc-50 px-4 py-3 text-center text-sm text-zinc-500">
                请确认是否领取这笔转账
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleRejectTransfer(activeIncomingTransferIndex);
                    setActiveIncomingTransferIndex(null);
                  }}
                  className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-500"
                >
                  退回
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleReceiveTransfer(activeIncomingTransferIndex);
                    setActiveIncomingTransferIndex(null);
                  }}
                  className="flex-1 rounded-xl bg-[#FA9D3B] px-4 py-3 text-sm font-medium text-white"
                >
                  领取
                </button>
              </div>
              <button
                type="button"
                onClick={() => setActiveIncomingTransferIndex(null)}
                className="mt-3 w-full text-center text-xs text-zinc-400"
              >
                关闭
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transfer Dialog */}
      <AnimatePresence>
        {showTransferDialog && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-[300px] rounded-2xl p-6 shadow-xl flex flex-col items-center"
            >
              <div className="w-12 h-12 bg-[#FA9D3B]/10 rounded-full flex items-center justify-center text-[#FA9D3B] mb-4">
                <Banknote size={24} />
              </div>
              <h3 className="text-[16px] font-bold text-zinc-800 mb-6">
                {transferType === 'toCharacter' ? `转账给 ${character.name}` : `${character.name} 转账给我`}
              </h3>
              
              <div className="flex items-end justify-center gap-1 mb-8 w-full border-b border-zinc-100 pb-2">
                <span className="text-3xl font-bold text-zinc-900 mb-1">￥</span>
                <input 
                  autoFocus
                  type="number" 
                  value={transferAmount}
                  onChange={e => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                  className="text-4xl font-bold text-zinc-900 outline-none bg-transparent w-full text-center placeholder:text-zinc-200"
                />
              </div>

              {transferType === 'toCharacter' && (
                <div className="w-full mb-6">
                  <label className="text-xs text-zinc-500 mb-1.5 block">支付方式</label>
                  <div className="relative">
                    <select 
                      value={selectedCardId}
                      onChange={e => setSelectedCardId(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-[14px] text-zinc-900 appearance-none outline-none focus:border-zinc-900 transition-colors"
                    >
                      <option value="">选择支付卡片...</option>
                      {(walletData?.cards || MOCK_CARDS).map(card => (
                        <option key={card.id} value={card.id}>
                          {card.bankName} ({card.number.slice(-4)}) - 余额: ￥{card.balance.toFixed(2)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 w-full">
                <button 
                  onClick={() => setShowTransferDialog(false)}
                  className="py-3 rounded-xl bg-zinc-50 text-zinc-600 font-medium active:scale-95 transition-transform text-[15px]"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    const submitted = submitTransfer({
                      transferAmount,
                      transferType,
                      selectedCardId,
                    });
                    if (submitted) {
                      setShowTransferDialog(false);
                    }
                  }}
                  disabled={!transferAmount || (transferType === 'toCharacter' && !selectedCardId)}
                  className="py-3 rounded-xl bg-[#FA9D3B] text-white font-medium active:scale-95 transition-transform text-[15px] disabled:opacity-50 disabled:scale-100"
                >
                  转账
                </button>
              </div>
            </motion.div>
          </div>
        )}
        
      {/* Context Menu */}
        {contextMenu && contextMenuMessage && (
          <>
            <div 
              className="absolute inset-0 z-[90]" 
              onClick={closeContextMenu}
            />
            <div 
              className="absolute z-[95] bg-white/90 backdrop-blur-xl rounded-xl shadow-xl overflow-hidden border border-zinc-200/50 animate-in fade-in zoom-in-95 duration-200"
              style={{ 
                top: contextMenu.y, 
                left: contextMenu.x 
              }}
            >
              <div className="p-1.5 flex items-center gap-1">
                <button 
                  onClick={handleQuoteReply}
                  className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="引用回复"
                >
                  <MessageSquarePlus size={20} />
                </button>
                {isEditableMessage(contextMenuMessage) && (
                  <button
                    onClick={handleStartEdit}
                    className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Pencil size={20} />
                  </button>
                )}
                {canBacktrackMessage(contextMenuMessage) && (
                  <button
                    onClick={handleBacktrack}
                    className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                    title="回溯"
                  >
                    <RotateCcw size={20} />
                  </button>
                )}
                {canRegenerateMessage(contextMenuMessageIndex, contextMenuMessage) && (
                  <button
                    onClick={() => void handleRegenerate()}
                    className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                    title="重回"
                  >
                    <RefreshCw size={20} />
                  </button>
                )}
                {canGenerateMessageAudio(contextMenuMessage) && (
                  <button
                    onClick={() => void handleGenerateAudio()}
                    className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                    title="生成语音"
                  >
                    <Volume2 size={20} />
                  </button>
                )}
                {contextMenuMessage.role === 'user' && !contextMenuMessage.isRecalled && (
                  <button 
                    onClick={handleRecall}
                    className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                    title="撤回"
                  >
                    <Reply size={20} />
                  </button>
                )}
                <button 
                  onClick={handleCopy}
                  className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="复制"
                >
                  <Copy size={20} />
                </button>
                {contextMenuMessage.audioUrl && contextMenuMessage.audioTranscript && (
                  <button
                    onClick={handleToggleTranscript}
                    className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                    title={expandedAudioTranscriptKeys.has(getMessageSelectionKey(contextMenuMessage)) ? '鏀惰捣杞枃瀛?' : '杞枃瀛?'}
                  >
                    <ScanEye size={20} />
                  </button>
                )}
                <button 
                  onClick={handleFavorite}
                  className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                  title={contextMenuMessage.isFavorited ? '取消收藏' : '收藏'}
                >
                  <Star size={20} fill={contextMenuMessage.isFavorited ? "currentColor" : "none"} className={contextMenuMessage.isFavorited ? "text-yellow-400" : ""} />
                </button>
                <button 
                  onClick={handleShare}
                  className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="分享"
                >
                  <Share2 size={20} />
                </button>
                {canSetImageAsCharacterAvatar && (
                  <button
                    onClick={handleSetCharacterAvatarFromMessage}
                    className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                    title="设为Ta头像"
                  >
                    <Cpu size={20} />
                  </button>
                )}
                <div className="w-px h-6 bg-zinc-200 mx-1" />
                <button 
                  onClick={handleMultiSelect}
                  className="p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="多选"
                >
                  <CheckCircle size={20} />
                </button>
                <button 
                  onClick={handleDeleteMessage}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          </>
        )}

        {activeInnerVoiceMessage && activeInnerVoiceCard && (
          <>
            <div
              className="absolute inset-0 z-[96] bg-[#2F241C]/28 backdrop-blur-[2px]"
              onClick={closeInnerVoiceCard}
            />
            <div className="absolute inset-0 z-[97] flex items-center justify-center px-4 py-8">
              <div className="relative max-h-full overflow-y-auto">
                <button
                  type="button"
                  onClick={closeInnerVoiceCard}
                  className="absolute right-2 top-3 z-10 flex h-7 w-7 items-center justify-center text-zinc-500 active:scale-95"
                  aria-label="关闭心声卡片"
                >
                  <X size={16} />
                </button>
                <InnerVoiceUnlockCard
                  characterName={character.name}
                  date={new Date(activeInnerVoiceMessage.timestamp).toLocaleDateString([], {
                    month: '2-digit',
                    day: '2-digit',
                  })}
                  headline={activeInnerVoiceCard.headline}
                  body={activeInnerVoiceCard.body}
                  translation={activeInnerVoiceTranslation || undefined}
                  ps={activeInnerVoiceCard.ps}
                  isSaved={!!activeInnerVoiceMessage.isFavorited}
                  onSave={() => {
                    if (activeInnerVoiceIndex !== null) {
                      toggleFavoriteAt(activeInnerVoiceIndex);
                    }
                  }}
                  onShare={() => shareInnerVoiceToMoment(activeInnerVoiceMessage)}
                />
              </div>
            </div>
          </>
        )}

        {pendingShare && (
          <>
            <div
              className="absolute inset-0 z-[96] bg-black/20"
              onClick={() => setPendingShare(null)}
            />
            <div className="absolute inset-x-3 bottom-3 z-[97] rounded-3xl border border-zinc-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
              <div className="mb-3">
                <div className="text-sm font-semibold text-zinc-900">分享消息</div>
                <div className="mt-2 rounded-2xl bg-zinc-50 px-3 py-2 text-sm text-zinc-600 border border-zinc-200">
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
      </AnimatePresence>

      {/* Game Center */}
      <GameCenter
        isOpen={showGameCenter}
        onClose={() => setShowGameCenter(false)}
        character={character}
        runtimeContext={drawBlocksRuntimeContext}
        onSendToChat={handleSend}
      />
    </motion.div>
  );
}




import React, { useEffect, useRef, useState } from 'react';
import { Wifi, ChevronLeft, ChevronRight, Send, Settings, Trash2, Plus, Check, X, Cpu, Pencil, Save, Link2, Key, RefreshCw, ChevronDown, Image as ImageIcon, Upload, PlusCircle, Smile, Share2, Banknote, Heart, Mic, Keyboard, Copy, Star, Reply, MoreHorizontal, CheckCircle, Search, MessageSquarePlus, MessageCircle, ScanEye, Phone, PhoneOff, MapPin, Gamepad2, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mask, FavoriteMessage, VisualSettings, WorldBookEntry,
  Character, ChatMessage, PerceptionSettings,
  ApiConfig, AppSettings, CallRecord, CoupleSpaceData, DateSession, WalletData,
} from '../../types';
import { ChatSettingsPanel } from '../../components/chat/ChatSettingsPanel';
import { DatingModal } from '../../components/dating/DatingModal';
import { GameCenter } from '../../components/games/GameCenter';
import { GameCard } from '../../components/chat/GameCard';
import { MOCK_CARDS } from '../../components/wallet/WalletApp/Page';
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
import { extractImageUrls } from '../../utils';
import { useResolvedPersistentValue } from '../persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';
import { useDirectChatRuntime } from '../chat-runtime/useDirectChatRuntime';

const getMessageSelectionKey = (message: ChatMessage) => (
  `${message.timestamp}::${message.role}::${message.text}`
);

function parseBubbleStyleCss(styleText?: string) {
  if (!styleText) return {};

  try {
    const parsed = JSON.parse(styleText);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.warn('Ignoring invalid chat bubbleStyleCss JSON.', error);
    return {};
  }
}

function PersistentImage({
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
}

function InlineResolvedImage({
  src,
  className,
  style,
  alt,
}: {
  src?: string | null;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}) {
  if (!src) return null;
  return <img src={src} className={className} style={style} alt={alt} />;
}

function CoupleSpaceInviteIcon({ size = 24, className }: { size?: number; className?: string }) {
  return <Star size={size} className={className} />;
}

export function ChatSessionScreen({ 
  character, 
  history, 
  setHistory, 
  onUpdateCharacter,
  onPatchCharacter,
  settings, 
  onBack,
  userAvatar,
  userName,
  masks,
  favorites,
  setFavorites,
  visualSettings,
  onUpdateVisualSettings,
  groups,
  worldBook = [],
  perception,
  coupleSpace,
  onViewForumPost,
  callHistory,
  onAddCallRecord,
  onDeleteCallRecord,
  onSaveDate,
  onCollectDate,
  savedDates,
  walletData,
  onUpdateWalletData,
  onPublishMoment,
  onOpenCharacterMoments,
  onStatusBarVisibilityChange,
  onAcceptCoupleSpaceInvite,
}: { 
  character: Character;
  history: ChatMessage[];
  setHistory: (h: ChatMessage[]) => void;
  onUpdateCharacter: (c: Character) => void;
  onPatchCharacter?: (patch: Partial<Character>) => void;
  settings: AppSettings;
  onBack: () => void;
  userAvatar: string;
  userName: string;
  masks: Mask[];
  favorites: FavoriteMessage[];
  setFavorites: (f: FavoriteMessage[]) => void;
  visualSettings: VisualSettings;
  onUpdateVisualSettings: (settings: VisualSettings) => void;
  groups: string[];
  worldBook?: WorldBookEntry[];
  key?: string;
  perception?: PerceptionSettings;
  coupleSpace?: CoupleSpaceData;
  onViewForumPost?: (postId: string) => void;
  callHistory?: CallRecord[];
  onAddCallRecord?: (record: CallRecord) => void;
  onDeleteCallRecord?: (recordId: string) => void;
  onSaveDate?: (session: DateSession) => void;
  onCollectDate?: (session: DateSession) => void;
  savedDates?: DateSession[];
  walletData?: WalletData;
  onUpdateWalletData?: (data: WalletData) => void;
  onPublishMoment?: (moment: { authorId: string; content: string; images?: string[] }) => void;
  onOpenCharacterMoments?: () => void;
  onStatusBarVisibilityChange?: (visible: boolean) => void;
  onAcceptCoupleSpaceInvite?: (characterId: string) => void;
}) {
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage['replyTo'] | null>(null);
  const [pendingShare, setPendingShare] = useState<ShareActionResult['payload'] | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showFunPanel, setShowFunPanel] = useState(false);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [stickerTab, setStickerTab] = useState<'basic' | 'custom'>('basic');
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferType, setTransferType] = useState<'toUser' | 'toCharacter'>('toCharacter');
  const [transferAmount, setTransferAmount] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDatingModal, setShowDatingModal] = useState(false);
  const [showGameCenter, setShowGameCenter] = useState(false);

  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [voiceCallDuration, setVoiceCallDuration] = useState(0);
  const [voiceCallInput, setVoiceCallInput] = useState('');
  const [isRecordingCall, setIsRecordingCall] = useState(false);
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
  const [showMemoryWindowHint, setShowMemoryWindowHint] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      sendImageMessage(base64String);
      setShowFunPanel(false);
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const activeConfig = settings?.configs?.find(c => c.id === settings.activeConfigId);
  const activeSavedDate = savedDates?.find(session => session.characterId === character.id) || null;
  const {
    isLoading,
    error,
    setError,
    sendText,
    handleSend,
    handleVoiceCallAIResponse,
    sendImageMessage,
    sendStickerMessage,
    sendLocationMessage,
    sendCoupleSpaceInvitation,
    sendInnerVoiceProbe,
    sendSpeechTranscript,
    finalizeVoiceCall,
    recallMessageAt,
    deleteMessageAt,
    deleteSelectedMessages: deleteSelectedMessagesFromRuntime,
    copyMessageAt,
    toggleFavoriteAt,
    quoteReplyAt,
    forwardMessageAt,
    createSharePayloadAt,
    submitTransfer,
    handleReceiveTransfer,
  } = useDirectChatRuntime({
    character,
    history,
    setHistory,
    activeConfig,
    input,
    setInput,
    replyingTo,
    setReplyingTo,
    masks,
    worldBook,
    perception,
    coupleSpace,
    userName,
    favorites,
    setFavorites,
    walletData,
    onUpdateWalletData,
    onUpdateCharacter,
    onPublishMoment,
    onAddCallRecord,
    onAcceptCoupleSpaceInvite,
  });

  useEffect(() => {
    onStatusBarVisibilityChange?.(!showDatingModal);

    return () => {
      onStatusBarVisibilityChange?.(true);
    };
  }, [showDatingModal, onStatusBarVisibilityChange]);
  
  const showVoiceCallRef = useRef(false);
  const voiceCallSessionIdRef = useRef(0);
  const [voiceCallHistory, setVoiceCallHistory] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [currentInterimSpeech, setCurrentInterimSpeech] = useState('');
  const voiceCallHistoryRef = useRef<{role: 'user' | 'model', text: string}[]>([]);
  const voiceCallEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const memoryLimit = character.memoryLimit || 20;
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
    
    handleVoiceCallAIResponse(text).then((responseText) => {
      if (!responseText || !showVoiceCallRef.current || voiceCallSessionIdRef.current !== activeSessionId) return;
      const aiMsg = { role: 'model' as const, text: responseText };
      setVoiceCallHistory(prev => {
        const newHistory = [...prev, aiMsg];
        voiceCallHistoryRef.current = newHistory;
        return newHistory;
      });
    });
  };

  const startVoiceCall = () => {
    setShowVoiceCall(true);
    showVoiceCallRef.current = true;
    voiceCallSessionIdRef.current += 1;
    setVoiceCallDuration(0);
    setVoiceCallHistory([]);
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
           
           handleVoiceCallAIResponse(finalTranscript).then((responseText) => {
             if (!responseText || !showVoiceCallRef.current || voiceCallSessionIdRef.current !== activeSessionId) return;
             const aiMsg = { role: 'model' as const, text: responseText };
             setVoiceCallHistory(prev => {
               const newHistory = [...prev, aiMsg];
               voiceCallHistoryRef.current = newHistory;
               return newHistory;
             });
           });
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
    
    setShowVoiceCall(false);

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

  const basicEmojis = ['??', '??', '??', '??', '??', '??', '??', '??', '??', '??', '??', '??'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isLoading]);



  const { resolvedUrl: resolvedChatBackgroundUrl } = useResolvedPersistentValue(visualSettings?.chat?.background);
  const { resolvedUrl: resolvedChatAvatarFrameUrl } = useResolvedPersistentValue(visualSettings?.chat?.avatarFrameUrl);
  const { resolvedUrl: resolvedChatMessageBackgroundUrl } = useResolvedPersistentValue(visualSettings?.chat?.messageBackgroundImageUrl);
  const { resolvedUrl: resolvedCharacterAvatarUrl } = useResolvedPersistentValue(character.avatar);
  const { resolvedUrl: resolvedUserAvatarUrl } = useResolvedPersistentValue(userAvatar);
  const { resolvedUrl: resolvedCharacterBubbleImageUrl } = useResolvedPersistentValue(character.bubbleImage);
  const { resolvedUrl: resolvedUserBubbleImageUrl } = useResolvedPersistentValue(character.userBubbleImage);

  if (showSettings) {
    return (
      <ChatSettingsPanel 
        character={character} 
        onUpdate={onUpdateCharacter} 
        onBack={() => setShowSettings(false)} 
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
        visualSettings={visualSettings}
        onUpdateVisualSettings={onUpdateVisualSettings}
      />
    );
  }
  const activeBackground = character.background || resolvedChatBackgroundUrl;
  const headerState = getChatHeaderState(character, history, isLoading);
  const layoutConfig = getChatLayoutConfig();
  const latestModelReplyTimestamp = getLatestModelReplyTimestamp(history);
  
  const headerStyleType = visualSettings?.chat?.headerStyle || 'default';
  let headerClasses = `relative z-10 ${layoutConfig.headerPaddingClass} flex items-center shrink-0 `;
  let headerStyleObj: React.CSSProperties = {};
  
  if (headerStyleType === 'default') {
    headerClasses += "backdrop-blur-md border-b";
    headerStyleObj = {
      backgroundColor: `rgba(255, 255, 255, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.8) : 1})`,
      borderColor: `rgba(228, 228, 231, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.8) : 1})`
    };
  } else if (headerStyleType === 'glass') {
    headerClasses += "backdrop-blur-xl border-b";
    headerStyleObj = {
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      borderColor: 'rgba(255, 255, 255, 0.3)'
    };
  } else if (headerStyleType === 'solid') {
    headerClasses += "border-b";
    headerStyleObj = {
      backgroundColor: 'white',
      borderColor: '#e4e4e7'
    };
  } else if (headerStyleType === 'transparent') {
    headerStyleObj = {
      backgroundColor: 'transparent',
      borderColor: 'transparent'
    };
  }

  return (
    <motion.div 
      className="absolute inset-0 bg-zinc-50 flex flex-col z-[60]"
      style={{ 
        backgroundImage: activeBackground ? `url(${activeBackground})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontSize: visualSettings?.chat?.fontSize ?? 14,
        // @ts-ignore
        zoom: visualSettings?.chat?.uiScale ?? 1
      }}
    >
      {/* Header */}
      {multiSelectMode ? (
        <div 
          className={`chat-session-header ${headerClasses} justify-between`}
          style={headerStyleObj}
        >
          <button onClick={() => {
            setMultiSelectMode(false);
            setSelectedMessages(new Set());
          }} className="text-zinc-500 font-medium text-[15px]">
            取消
          </button>
          <h1 className="text-[16px] font-bold text-zinc-900">已选择 {selectedMessages.size} 条</h1>
          <button onClick={deleteSelectedMessages} className="text-red-500 font-medium text-[15px] disabled:opacity-50" disabled={selectedMessages.size === 0}>
            删除
          </button>
        </div>
      ) : (
        <div 
          className={`chat-session-header ${headerClasses} justify-between`}
          style={headerStyleObj}
        >
          <div className="flex items-center gap-1 z-10">
            <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => onOpenCharacterMoments?.()}
              className="ml-1 rounded-full active:scale-95 transition-transform cursor-pointer p-0.5"
              aria-label="打开角色主页"
            >
              <PersistentImage value={character.avatar} alt={character.name} className="w-9 h-9 rounded-full object-cover bg-zinc-100 border border-zinc-200/50" />
            </button>
          </div>
          
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pt-1.5 pointer-events-none">
            <h1 className="text-[17px] font-bold text-zinc-900 truncate max-w-[180px] text-center">{headerState.title}</h1>
            <p className="text-[11px] text-zinc-500 text-center mt-0.5 truncate max-w-[220px]">{headerState.subtitle}</p>
          </div>

          <div className="z-10">
            <button onClick={() => setShowSettings(true)} className="p-2 text-zinc-400 active:text-zinc-600">
              <Settings size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={layoutConfig.messageListClass}>
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-xl text-[13px] border border-red-100 mb-4">
            {error}
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
        {/* Opening Remark */}
        <div className="w-full flex justify-start">
          <div className="flex flex-1 min-w-0 items-start gap-3">
            <div className="w-10 shrink-0 flex justify-center pt-0.5">
              <div className="relative">
                <InlineResolvedImage
                  src={getDisplayableAssetValue(character.avatar, resolvedCharacterAvatarUrl)}
                  className="object-cover"
                  style={{
                    width: visualSettings?.chat?.avatarSize ?? 32,
                    height: visualSettings?.chat?.avatarSize ?? 32,
                    borderRadius: visualSettings?.chat?.avatarBorderRadius ?? 16,
                    borderWidth: visualSettings?.chat?.avatarBorderWidth ?? 0,
                    borderColor: visualSettings?.chat?.avatarBorderColor ?? '#e4e4e7',
                    borderStyle: 'solid'
                  }}
                />
                {resolvedChatAvatarFrameUrl && (
                  <img 
                    src={resolvedChatAvatarFrameUrl} 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                    style={{ width: (visualSettings?.chat?.avatarSize ?? 32) * 1.4, height: (visualSettings?.chat?.avatarSize ?? 32) * 1.4 }}
                  />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col items-start">
              <div 
                className="inline-block max-w-[min(82%,34rem)] border shadow-sm"
                style={{
                  borderRadius: visualSettings?.chat?.messageBorderRadius ?? 16,
                  borderTopLeftRadius: 0,
                  padding: '10px 16px',
                  backgroundColor: visualSettings?.chat?.messageBackgroundColorModel ?? `rgba(255, 255, 255, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`,
                  borderColor: `rgba(228, 228, 231, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`,
                  ...(resolvedChatMessageBackgroundUrl ? { backgroundImage: `url(${resolvedChatMessageBackgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', border: 'none' } : {}),
                  ...(resolvedCharacterBubbleImageUrl ? { backgroundImage: `url(${resolvedCharacterBubbleImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', border: 'none' } : character.bubbleColor ? { backgroundColor: character.bubbleColor } : {}),
                  ...parseBubbleStyleCss(visualSettings?.chat?.bubbleStyleCss)
                }}
              >
                <p className="text-[14px] text-zinc-800 leading-relaxed whitespace-pre-wrap">{character.openingRemark}</p>
              </div>
            </div>
          </div>
        </div>

        {history.map((msg, i) => {
          const messageSelectionKey = getMessageSelectionKey(msg);
          if (msg.isSystem) {
            return (
              <div key={i} className="flex justify-center mb-4" style={{ marginTop: visualSettings?.chat?.messageSpacing ?? 16 }}>
                <div className="bg-zinc-200/60 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] text-zinc-500 font-medium">
                  {msg.text}
                </div>
              </div>
            );
          }

          return (
            <div key={i} className={`w-full flex items-end gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`} style={{ marginTop: visualSettings?.chat?.messageSpacing ?? 16 }}>
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
                    <div 
                      className="relative cursor-pointer"
                      onClick={(e) => !multiSelectMode && handleMessageClick(e, i)}
                    >
                      <InlineResolvedImage
                        src={getDisplayableAssetValue(character.avatar, resolvedCharacterAvatarUrl)}
                        className="object-cover"
                        style={{
                          width: visualSettings?.chat?.avatarSize ?? 32,
                          height: visualSettings?.chat?.avatarSize ?? 32,
                          borderRadius: visualSettings?.chat?.avatarBorderRadius ?? 16,
                          borderWidth: visualSettings?.chat?.avatarBorderWidth ?? 0,
                          borderColor: visualSettings?.chat?.avatarBorderColor ?? '#e4e4e7',
                          borderStyle: 'solid'
                        }}
                      />
                      {resolvedChatAvatarFrameUrl && (
                        <img 
                          src={resolvedChatAvatarFrameUrl} 
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                          style={{ width: (visualSettings?.chat?.avatarSize ?? 32) * 1.4, height: (visualSettings?.chat?.avatarSize ?? 32) * 1.4 }}
                        />
                      )}
                    </div>
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="w-10 shrink-0 flex justify-center pt-0.5">
                    <div 
                      className="relative cursor-pointer"
                      onClick={(e) => !multiSelectMode && handleMessageClick(e, i)}
                    >
                      <InlineResolvedImage
                        src={getDisplayableAssetValue(userAvatar, resolvedUserAvatarUrl)}
                        className="object-cover"
                        style={{
                          width: visualSettings?.chat?.avatarSize ?? 32,
                          height: visualSettings?.chat?.avatarSize ?? 32,
                          borderRadius: visualSettings?.chat?.avatarBorderRadius ?? 16,
                          borderWidth: visualSettings?.chat?.avatarBorderWidth ?? 0,
                          borderColor: visualSettings?.chat?.avatarBorderColor ?? '#e4e4e7',
                          borderStyle: 'solid'
                        }}
                      />
                      {resolvedChatAvatarFrameUrl && (
                        <img 
                          src={resolvedChatAvatarFrameUrl} 
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                          style={{ width: (visualSettings?.chat?.avatarSize ?? 32) * 1.4, height: (visualSettings?.chat?.avatarSize ?? 32) * 1.4 }}
                        />
                      )}
                    </div>
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
                              {character.showTime && (
                                <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                              {character.showTime && (
                                <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          );
                        }

                        const gameCardRegex = /^\[GAME_CARD\]\s*([\s\S]*?)(?:\n\n---TRANSLATION---\s*[\s\S]*)?$/;
                        const gameCardMatch = msg.text.match(gameCardRegex);
                        
                        if (gameCardMatch) {
                          try {
                            let jsonString = gameCardMatch[1].trim();
                            // Remove markdown code blocks if present
                            if (jsonString.startsWith('```json')) {
                              jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                            } else if (jsonString.startsWith('```')) {
                              jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
                            }
                            
                            // Extract JSON object if there's extra text
                            const jsonStart = jsonString.indexOf('{');
                            const jsonEnd = jsonString.lastIndexOf('}');
                            if (jsonStart !== -1 && jsonEnd !== -1) {
                              jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
                            }

                            const gameData = JSON.parse(jsonString);
                            const sanitizedGameData = {
                              ...gameData,
                              ...(typeof gameData.content === 'string' ? { content: sanitizePipeMarkers(gameData.content, '\n') } : {}),
                              ...(typeof gameData.question === 'string' ? { question: sanitizePipeMarkers(gameData.question, '\n') } : {})
                            };
                            const legacyTranslationParts = getLegacyTranslationParts(msg.text);
                            const translation = sanitizePipeMarkers(msg.translation?.trim() || legacyTranslationParts.translation, '\n');
                            
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
                                    data={sanitizedGameData} 
                                    isUser={msg.role === 'user'} 
                                    disabled={multiSelectMode}
                                    translation={translation}
                                  />
                                </div>
                                {character.showTime && (
                                  <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            );
                          } catch (e) {
                            // Fallback to text if parse fails
                          }
                        }

                        const transferRegex = /\[[^\]]*?转账[^\]]*?([\d\.]+)\]/;
                        const transferRegexGlobal = /\[[^\]]*?转账[^\]]*?([\d\.]+)\]/g;
                        const transferMatch = msg.text.match(transferRegex);
                        const cleanText = msg.text.replace(transferRegexGlobal, '').trim();
                        const amount = transferMatch ? transferMatch[1] : '0.00';

                        return (
                          <>
                            {cleanText && !msg.isInnerVoice && (() => {
                              const legacyTranslationParts = getLegacyTranslationParts(cleanText);
                              const translationText = msg.translation?.trim() || legacyTranslationParts.translation;

                              return (
                                <>
                                  {msg.replyTo && (
                                    <div
                                      className="mb-1 inline-flex max-w-[min(82%,34rem)] items-start gap-2 rounded-xl border border-zinc-200/80 bg-white/65 px-3 py-2 text-zinc-700 backdrop-blur-sm"
                                    >
                                      <Reply size={13} className="mt-0.5 shrink-0 text-zinc-400" />
                                      <div className="min-w-0">
                                        <div className="text-[11px] font-medium text-zinc-500">
                                          回复 {msg.replyTo.authorLabel}
                                        </div>
                                        <div className="mt-0.5 line-clamp-3 text-[12px] leading-5 text-zinc-600 break-words">
                                          {getReplyPreviewText(msg)}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <div
                                    onClick={(e) => !multiSelectMode && handleMessageClick(e, i)}
                                    className={`${
                                      msg.role === 'model'
                                        ? `inline-block ${layoutConfig.textBubbleMaxWidthClass} px-4 py-2.5 rounded-2xl`
                                        : `w-fit ${layoutConfig.textBubbleMaxWidthClass} px-4 py-2.5`
                                    } shadow-sm relative cursor-pointer active:scale-[0.98] transition-all border ${
                                      msg.role === 'user' ? 'text-white' : 'text-zinc-800'
                                    }`}
                                    style={{
                                      borderRadius: visualSettings?.chat?.messageBorderRadius ?? 16,
                                      borderTopRightRadius:
                                        msg.role === 'user'
                                          ? 4
                                          : visualSettings?.chat?.messageBorderRadius ?? 16,
                                      borderTopLeftRadius:
                                        msg.role === 'model'
                                          ? 4
                                          : visualSettings?.chat?.messageBorderRadius ?? 16,
                                      backgroundColor:
                                        msg.role === 'user'
                                          ? (visualSettings?.chat?.messageBackgroundColorUser ||
                                              `rgba(59, 130, 246, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`)
                                          : (visualSettings?.chat?.messageBackgroundColorModel ||
                                              `rgba(255, 255, 255, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`),
                                      borderColor:
                                        msg.role === 'user'
                                          ? (visualSettings?.chat?.messageBackgroundColorUser ||
                                              `rgba(59, 130, 246, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`)
                                          : `rgba(228, 228, 231, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`,
                                      ...(resolvedChatMessageBackgroundUrl
                                        ? {
                                            backgroundImage: `url(${resolvedChatMessageBackgroundUrl})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            border: 'none'
                                          }
                                        : {}),
                                      ...(msg.role === 'model' && resolvedCharacterBubbleImageUrl
                                        ? {
                                            backgroundImage: `url(${resolvedCharacterBubbleImageUrl})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            border: 'none'
                                          }
                                        : msg.role === 'model' && character.bubbleColor
                                        ? { backgroundColor: character.bubbleColor }
                                        : {}),
                                      ...(msg.role === 'user' && resolvedUserBubbleImageUrl
                                        ? {
                                            backgroundImage: `url(${resolvedUserBubbleImageUrl})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            border: 'none'
                                          }
                                        : msg.role === 'user' && character.userBubbleColor
                                        ? {
                                            backgroundColor: character.userBubbleColor,
                                            borderColor: character.userBubbleColor
                                          }
                                        : {})
                                    }}
                                  >
                                    {(() => {
                                      const legacyTranslationParts = getLegacyTranslationParts(cleanText);
                                      const normalizedMainText = sanitizePipeMarkers(legacyTranslationParts.mainText, '\n');
                                      const translationText = msg.translation?.trim() || legacyTranslationParts.translation;

                                      if (translationText) {
                                        const normalizedTranslationText = sanitizePipeMarkers(translationText, '\n');
                                        return (
                                          <div className="flex flex-col gap-2">
                                            <span className="block text-[14px] leading-6 whitespace-normal break-normal text-left">
                                              {normalizedMainText}
                                            </span>
                                            <div className="h-[1px] bg-black/5 w-full" />
                                            <p className="text-[13px] leading-6 whitespace-pre-wrap break-normal text-zinc-500">
                                              {normalizedTranslationText}
                                            </p>
                                          </div>
                                        );
                                      }

                                      return (
                                        <div className="flex flex-col gap-2">
                                          <span className="block text-[14px] leading-6 whitespace-normal break-normal text-left">
                                            {normalizedMainText}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  {(character.showTime || msg.role === 'user') && (
                                    <div className={`text-[10px] text-zinc-400 shrink-0 mt-0.5 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                      {character.showTime && (
                                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      )}
                                      {msg.role === 'user' && (
                                        <span className="ml-1">{getUserReadStatusLabel(msg, latestModelReplyTimestamp)}</span>
                                      )}
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
                                {character.showTime && (
                                  <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                  className="w-56 bg-white rounded-xl overflow-hidden shadow-sm border border-zinc-200 cursor-pointer hover:bg-zinc-50 transition-colors"
                                >
                                  <div className="p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                                        <MapPin size={18} />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-bold text-zinc-900 truncate">{msg.location.name}</span>
                                        {msg.location.address && <span className="text-[10px] text-zinc-500 truncate">{msg.location.address}</span>}
                                      </div>
                                    </div>
                                    <div className="aspect-video rounded-lg overflow-hidden bg-zinc-100 relative">
                                      <img 
                                        src={`https://picsum.photos/seed/${msg.location.name}/400/225`} 
                                        className="w-full h-full object-cover" 
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg">
                                          <MapPin size={16} />
                                        </div>
                                      </div>
                                      {msg.location.isVirtual && (
                                        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full">
                                          虚定位
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="px-3 py-2 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-400">位置分享</span>
                                    <ChevronRight size={12} className="text-zinc-400" />
                                  </div>
                                </div>
                                {character.showTime && (
                                  <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            )}

                            {msg.isInnerVoice && (
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
                                  className={`inline-block max-w-[min(84%,36rem)] rounded-2xl overflow-hidden shadow-sm border cursor-pointer hover:opacity-95 transition-all ${
                                    msg.role === 'user' 
                                      ? 'bg-white border-zinc-200' 
                                      : 'bg-rose-50/95 border-rose-100'
                                  }`}
                                >
                                  {msg.role === 'user' ? (
                                    <>
                                      <div className="p-3 flex items-center gap-3">
                                        <div className="w-10 h-10 bg-pink-50 text-pink-500 rounded-full flex items-center justify-center shrink-0">
                                          <Heart size={20} fill="currentColor" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-sm font-bold text-zinc-900 truncate">倾听心声</span>
                                          <span className="text-[10px] text-zinc-500 truncate">正在感知Ta的内心世界...</span>
                                        </div>
                                      </div>
                                      <div className="px-3 py-2 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                                        <span className="text-[10px] text-zinc-400">道具使用</span>
                                        <ChevronRight size={12} className="text-zinc-400" />
                                      </div>
                                    </>
                                  ) : (
                                    <div className="px-5 py-[18px] flex flex-col gap-3">
                                      <div className="flex items-center gap-2 text-rose-500/90">
                                        <Heart size={14} fill="currentColor" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Ta的心声</span>
                                      </div>
                                      <p className="text-[14.5px] text-rose-950/85 leading-7 italic font-medium whitespace-pre-wrap break-normal">
                                        {sanitizePipeMarkers(msg.text, '\n')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                {character.showTime && (
                                  <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            )}

                            {transferMatch && (
                              <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                {(() => {
                                  const isReceived = msg.transferStatus === 'received';
                                  const isRejected = msg.transferStatus === 'rejected';
                                  const canManualReceive = msg.role === 'model' && !isReceived && !isRejected;
                                  const cardBgClass = isReceived
                                    ? 'bg-[#FBC48A]'
                                    : isRejected
                                      ? 'bg-zinc-400'
                                      : 'bg-[#FA9D3B]';
                                  const cardLabel = isReceived
                                    ? (msg.role === 'user' ? '对方已收钱' : '已收钱')
                                    : isRejected
                                      ? (msg.role === 'user' ? '已退回' : '已失效')
                                      : (msg.role === 'user' ? `待 ${character.name} 确认` : `转账给 ${userName}`);

                                  return (
                                <div 
                                  onClick={(e) => {
                                    if (multiSelectMode) {
                                      handleMessageClick(e, i);
                                    } else {
                                      if (canManualReceive) {
                                        handleReceiveTransfer(i);
                                      } else {
                                        handleMessageClick(e, i);
                                      }
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    handleMessageClick(e, i);
                                  }}
                                  className={`w-60 rounded-xl overflow-hidden shadow-sm cursor-pointer active:opacity-90 transition-opacity ${isReceived || isRejected ? 'opacity-60' : ''}`}
                                >
                                  <div className={`${cardBgClass} p-3.5 flex items-center gap-3`}>
                                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white shrink-0">
                                      {isReceived ? <Check size={24} /> : isRejected ? <X size={24} /> : <Banknote size={24} />}
                                    </div>
                                    <div className="flex flex-col text-white min-w-0">
                                      <span className="text-[16px] font-bold">￥{amount}</span>
                                      <span className="text-[12px] opacity-80 truncate">{cardLabel}</span>
                                    </div>
                                  </div>
                                  <div className="bg-white p-2 border border-zinc-100 border-t-0">
                                    <span className="text-[10px] text-zinc-400 ml-1">微信转账</span>
                                  </div>
                                </div>
                                  );
                                })()}
                                {character.showTime && (
                                  <span className="text-[10px] text-zinc-400 shrink-0 mb-1">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
          );
        })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-2.5">
              <PersistentImage value={character.avatar} className="w-8 h-8 rounded-full object-cover mt-0.5 shrink-0" />
              <div 
                className="border rounded-2xl rounded-tl-none px-4 py-2.5 shadow-sm"
                style={{
                  backgroundColor: `rgba(255, 255, 255, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`,
                  borderColor: `rgba(228, 228, 231, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`,
                  ...(resolvedCharacterBubbleImageUrl ? { backgroundImage: `url(${resolvedCharacterBubbleImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', border: 'none' } : character.bubbleColor ? { backgroundColor: character.bubbleColor } : {})
                }}
              >
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
        className={layoutConfig.inputContainerClass}
        style={{ 
          ...layoutConfig.inputContainerStyle,
          backgroundColor: `rgba(255, 255, 255, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.8) : 1})`,
          borderColor: `rgba(228, 228, 231, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.8) : 1})`
        }}
      >
        {replyingTo && (
          <div className="flex items-center justify-between bg-zinc-100/80 backdrop-blur-sm rounded-xl px-3 py-2 text-[13px] text-zinc-600 border border-zinc-200/50">
            <div className="flex items-center gap-2 truncate">
              <Reply size={14} className="shrink-0" />
              <span className="font-medium shrink-0">{replyingTo.authorLabel}:</span>
              <span className="truncate">{replyingTo.preview}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-zinc-200 rounded-full shrink-0">
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button 
            onClick={() => setIsVoiceMode(!isVoiceMode)}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${isVoiceMode ? 'bg-zinc-100 text-zinc-800' : (character.background ? 'bg-white/50 text-zinc-600 hover:bg-white/80' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100')}`}
          >
            {isVoiceMode ? <Keyboard size={24} /> : <Mic size={24} />}
          </button>

          {isVoiceMode ? (
            <button
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              onPointerCancel={stopRecording}
              onPointerLeave={() => {
                if (isRecording) {
                  stopRecording();
                }
              }}
              className={`flex-1 h-10 rounded-2xl font-medium text-[15px] transition-all active:scale-[0.98] select-none ${
                isRecording 
                  ? 'bg-zinc-200 text-zinc-800' 
                  : (character.background ? 'bg-white/50 text-zinc-800 border border-white/30 active:bg-white/70' : 'bg-zinc-50 text-zinc-800 border border-zinc-100 active:bg-zinc-100')
              }`}
            >
              {isRecording ? '松开 发送' : '按住 说话'}
            </button>
          ) : (
            <div className={`flex-1 border rounded-2xl px-4 py-2.5 focus-within:border-blue-500 transition-colors flex items-end gap-2 ${
              character.background ? 'bg-white/50 border-white/30' : 'bg-zinc-50 border-zinc-100'
            }`}>
              <textarea 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendText();
                  }
                }}
                placeholder="发送消息..."
                className="w-full bg-transparent outline-none text-[15px] text-zinc-900 placeholder:text-zinc-500 resize-none max-h-32 min-h-[24px]"
                rows={1}
              />
              <button 
                onClick={() => {
                  setShowStickerPanel(!showStickerPanel);
                  if (showFunPanel) setShowFunPanel(false);
                }} 
                className={`p-1 transition-colors shrink-0 ${showStickerPanel ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
              >
                <Smile size={20} />
              </button>
            </div>
          )}

          {!isVoiceMode && input.trim() ? (
            <button 
              onClick={sendText}
              className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-white active:scale-90 transition-all shrink-0"
            >
              <Send size={18} />
            </button>
          ) : (
            <button 
              onClick={() => {
                setShowFunPanel(!showFunPanel);
                if (showStickerPanel) setShowStickerPanel(false);
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${showFunPanel ? 'bg-zinc-100 text-zinc-800 rotate-45' : (character.background ? 'bg-white/50 text-zinc-600 hover:bg-white/80' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100')}`}
            >
              <Plus size={24} />
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
                className="overflow-hidden"
              >
                <div className="pt-4">
                  <div className="flex border-b border-zinc-100 mb-3">
                    <button 
                      onClick={() => setStickerTab('basic')}
                      className={`flex-1 py-2 text-[13px] font-medium transition-colors ${stickerTab === 'basic' ? 'text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-500 hover:bg-zinc-50'}`}
                    >
                      基础表情
                    </button>
                    <button 
                      onClick={() => setStickerTab('custom')}
                      className={`flex-1 py-2 text-[13px] font-medium transition-colors ${stickerTab === 'custom' ? 'text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-500 hover:bg-zinc-50'}`}
                    >
                      自定义表情
                    </button>
                  </div>
                  <div className="h-48 overflow-y-auto">
                    {stickerTab === 'basic' ? (
                      <div className="grid grid-cols-7 gap-2">
                        {basicEmojis.map((emoji, idx) => (
                          <button 
                            key={idx}
                            onClick={() => {
                              setInput(prev => prev + emoji);
                            }}
                            className="text-2xl hover:bg-zinc-50 rounded-lg aspect-square flex items-center justify-center transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div>
                        {character.stickers && character.stickers.length > 0 ? (
                          <div className="grid grid-cols-5 gap-2">
                            {character.stickers.map((sticker, idx) => (
                              <button 
                                key={idx}
                                onClick={() => {
                                  sendStickerMessage();
                                  setShowStickerPanel(false);
                                }}
                                className="aspect-square rounded-lg overflow-hidden border border-zinc-100 hover:border-blue-300 transition-colors"
                              >
                                <PersistentImage value={sticker} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-zinc-400 py-8">
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
                className="overflow-hidden"
              >
                <div className="pt-4 grid grid-cols-4 gap-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
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
                    onClick={startVoiceCall}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
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
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <Banknote size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">转给Ta</span>
                  </button>

                  <button 
                    onClick={() => {
                      if (!activeConfig) {
                        setError('当前未选择有效的 API 配置。');
                        setShowFunPanel(false);
                        return;
                      }
                      setShowDatingModal(true);
                      setShowFunPanel(false);
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <Coffee size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">线下约会</span>
                  </button>

                  <button 
                    onClick={() => {
                      setShowFunPanel(false);
                      sendCoupleSpaceInvitation();
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <CoupleSpaceInviteIcon size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">情侣空间</span>
                  </button>

                  <button 
                    onClick={() => {
                      setShowGameCenter(true);
                      setShowFunPanel(false);
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <Gamepad2 size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">小游戏</span>
                  </button>

                  <button 
                    onClick={() => {
                      setShowLocationPicker(true);
                      setShowFunPanel(false);
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <MapPin size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">发送定位</span>
                  </button>

                  <button 
                    onClick={() => {
                      setShowFunPanel(false);
                      sendInnerVoiceProbe();
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 active:scale-95 transition-transform">
                      <Heart size={28} />
                    </div>
                    <span className="text-[12px] text-zinc-600">Ta的心声</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Location Picker */}
      <AnimatePresence>
        {showLocationPicker && (
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

      {activeConfig && (
        <DatingModal
          isOpen={showDatingModal}
          onClose={() => setShowDatingModal(false)}
          character={character}
          userProfile={{ name: userName, avatar: userAvatar, id: 'user', bio: '', mood: '' }}
          activeConfig={activeConfig}
          chatHistory={history}
          onSaveDate={onSaveDate || (() => {})}
          onCollectDate={onCollectDate || (() => {})}
          initialSession={savedDates?.find(s => s.characterId === character.id) || null}
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
            className="absolute inset-0 z-[100] bg-zinc-900 flex flex-col items-center justify-between pb-12 overflow-hidden"
          >
            {/* Background Blur */}
            <div 
              className="absolute inset-0 opacity-40 scale-110 blur-2xl"
              style={{
                backgroundImage: (() => {
                  const avatarSrc = getDisplayableAssetValue(character.avatar, resolvedCharacterAvatarUrl);
                  return avatarSrc ? `url(${avatarSrc})` : 'none';
                })(),
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
            
            {/* Header */}
            <div className="relative z-10 w-full pt-16 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/20 mb-4 shadow-2xl">
                <PersistentImage value={character.avatar} className="w-full h-full object-cover" />
              </div>
              <h2 className="text-white text-2xl font-medium mb-2">{character.name}</h2>
              <p className="text-white/60 text-sm font-mono">
                {Math.floor(voiceCallDuration / 60).toString().padStart(2, '0')}:
                {(voiceCallDuration % 60).toString().padStart(2, '0')}
              </p>
            </div>

            {/* Transcription Area */}
            <div className="relative z-10 w-full flex-1 flex flex-col justify-end px-6 pb-4 overflow-hidden">
              <div 
                className="w-full h-[360px] overflow-y-auto flex flex-col gap-4 pr-2"
                style={{ maskImage: 'linear-gradient(to bottom, transparent, black 10%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%)' }}
              >
                <div className="flex-1" /> {/* Spacer to push content down initially */}
                {voiceCallHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`
                      px-4 py-3 rounded-2xl max-w-[85%] text-[15px] leading-relaxed backdrop-blur-md shadow-sm
                      ${msg.role === 'user' 
                        ? 'bg-white/20 text-white rounded-br-sm' 
                        : 'bg-black/40 text-white rounded-bl-sm border border-white/10'}
                    `}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {currentInterimSpeech && (
                  <div className="flex justify-end">
                    <div className="bg-white/10 backdrop-blur-md text-white/70 px-4 py-3 rounded-2xl rounded-br-sm max-w-[85%] text-[15px] leading-relaxed animate-pulse">
                      {currentInterimSpeech}
                    </div>
                  </div>
                )}
                <div ref={voiceCallEndRef} />
              </div>
            </div>

            {/* Text Input for Voice Call */}
            <div className="relative z-10 w-full px-8 pb-8 flex gap-3 items-center">
               <div className="flex-1 relative">
                <input
                  type="text"
                  value={voiceCallInput}
                  onChange={(e) => setVoiceCallInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendVoiceCallText()}
                  placeholder="输入文字回复..."
                  className="w-full bg-white/10 backdrop-blur-md text-white placeholder-white/50 pl-4 pr-10 py-3 rounded-2xl outline-none border border-white/10 focus:bg-white/20 transition-all shadow-lg shadow-black/10"
                />
                {voiceCallInput && (
                  <button 
                    onClick={() => setVoiceCallInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button 
                onClick={handleSendVoiceCallText}
                disabled={!voiceCallInput.trim()}
                className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-2xl disabled:opacity-50 transition-all backdrop-blur-md border border-white/10 shadow-lg shadow-black/10 active:scale-95"
              >
                <Send size={20} />
              </button>
            </div>

            {/* Controls */}
            <div className="relative z-10 w-full flex justify-center gap-8 px-8">
              <button 
                onClick={() => setIsRecordingCall(!isRecordingCall)}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white active:scale-95 transition-all ${isRecordingCall ? 'bg-red-500 shadow-lg shadow-red-500/30' : 'bg-white/10 backdrop-blur-md'}`}
              >
                {isRecordingCall ? <div className="w-6 h-6 bg-white rounded-sm animate-pulse" /> : <div className="w-6 h-6 bg-red-500 rounded-full" />}
              </button>
              <button 
                onClick={endVoiceCall}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/30 active:scale-95 transition-transform"
              >
                <PhoneOff size={28} />
              </button>
              <button className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition-transform">
                <Settings size={28} />
              </button>
            </div>
          </motion.div>
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
      </AnimatePresence>

      {/* Game Center */}
      <GameCenter
        isOpen={showGameCenter}
        onClose={() => setShowGameCenter(false)}
        character={character}
        onSendToChat={handleSend}
      />
    </motion.div>
  );
}




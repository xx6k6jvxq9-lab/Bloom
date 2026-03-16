import React, { useState, useEffect, useRef } from 'react';
import { Wifi, ChevronLeft, ChevronRight, Send, Settings, Trash2, Plus, Check, X, Cpu, Pencil, Save, Link2, Key, RefreshCw, ChevronDown, Image as ImageIcon, Upload, PlusCircle, Smile, Share2, Banknote, Heart, Mic, Keyboard, Copy, Star, Reply, MoreHorizontal, CheckCircle, Search, MessageSquarePlus, MessageCircle, ScanEye, Phone, PhoneOff, MapPin, Gamepad2, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { 
  Mask, FavoriteMessage, VisualSettings, UserProfileExtended, WorldBookEntry,
  Character, ChatMessage, ChatHistory, PerceptionSettings,
  ApiConfig, AppSettings, CallRecord, DateSession, WalletData
} from './types';
import { WorldBookManager } from './components/main/MePage';
import { GroupChatSession } from './components/chat/GroupChatSession';
import { MonitorApp } from './components/monitor/MonitorApp/Page';
import { CustomizationApp } from './components/customization/CustomizationApp/Page';
import { HomeScreen } from './components/home/HomeScreen/Page';
import { CharacterMomentsProfile, CharacterProfile } from './components/main/ContactsShell/Page';
import { MainApp } from './components/main/MainAppShell/Page';
import { ChatSettingsPanel } from './components/chat/ChatSettingsPanel';
import { CoupleSpaceApp } from './components/couple-space/CoupleSpaceApp/Page';
import { PerceptionView } from './components/couple-space/PerceptionView';
import MusicApp from './components/media/MusicApp';
import ForumApp from './components/social/ForumApp/Page';
import WalletApp, { MOCK_CARDS, MOCK_TRANSACTIONS } from './components/wallet/WalletApp/Page';
import { DatingModal } from './components/dating/DatingModal';
import { GameCenter } from './components/games/GameCenter';
import { GameCard } from './components/chat/GameCard';
import { buildChatPrompt } from './services/ai/prompts/builders/buildChatPrompt';
import { buildSummaryPrompt } from './services/ai/prompts/builders/buildSummaryPrompt';
import {
  getRecentMomentReplyContext,
} from './services/moments/triggers';
import {
  buildFallbackMomentCommentReply,
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
import { extractImageUrls, getMessageMainText, getSummaryHistoryWindow } from './utils';

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

type Comment = {
  id: string;
  authorId: string; // 'user' or characterId
  content: string;
  timestamp: number;
  replyToCommentId?: string;
  replyToAuthorId?: string;
  replyToAuthorName?: string;
};

type Moment = {
  id: string;
  authorId: string; // 'user' or characterId
  content: string;
  images?: string[];
  timestamp: number;
  likes: number;
  likedBy?: string[]; // Array of user/character IDs who liked this moment
  isLiked?: boolean; // Deprecated, use likedBy.includes('user') instead
  isCollected?: boolean;
  comments: Comment[];
};

type AppData = {
  characters: Character[];
  chatHistory: ChatHistory;
  userProfile: UserProfile;
  masks: Mask[];
  favorites: FavoriteMessage[];
  visualSettings: VisualSettings;
  groups: string[]; // List of group names
  moments: Moment[];
  worldBooks: WorldBookEntry[];
  coupleSpace?: import('./types').CoupleSpaceData;
  friendRequests?: import('./types').FriendRequest[];
  chatGroups?: import('./types').ChatGroup[];
  callHistory?: CallRecord[];
  savedDates?: DateSession[];
  collectedDates?: DateSession[];
  musicData?: import('./types').MusicData;
  walletData?: WalletData;
};

const formatMessagePreview = (text: string | undefined): string => {
  if (!text) return '';
  if (text.startsWith('[GAME_CARD]')) {
    return '[游戏卡片]';
  }
  return text;
};

const normalizeChatTextSegment = (text: string): string =>
  text.replace(/\r?\n+/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();

const QUESTION_END_RE = /[?？]$/;
const EXCLAMATION_END_RE = /[!！]$/;
const STRONG_END_RE = /[。！？!?；;]$/;
const FOLLOW_UP_START_RE = /^(说吧|所以|那[你就也先再]?|你[呢说看想要会可能打]|咋了|怎么了|现在|方便|要不|不然|不过|对了|还有|然后|先说|先别|要不要|行不行|能不能|是不是|要是|诶|欸|哎)/;
const TINY_CHAT_FRAGMENT_RE = /^(嗯+|啊+|哦+|诶+|欸+|哎+|哈+|嘿+|好+|行+|成+|行吧|好吧|也是|对啊|对呀|是吧|对吧|真的|那行|那就这样|先这样)[。！？!?]?$/;

const isQuestionSentence = (text: string): boolean => QUESTION_END_RE.test(text.trim());

const isExclamationSentence = (text: string): boolean => EXCLAMATION_END_RE.test(text.trim());

const startsLikeFollowUp = (text: string): boolean => FOLLOW_UP_START_RE.test(text.trim());

const isTinyChatFragment = (text: string): boolean => {
  const normalized = text.trim().replace(/[“”"'`]/g, '');
  return normalized.length <= 8 && TINY_CHAT_FRAGMENT_RE.test(normalized);
};

const shouldKeepSentenceSeparate = (current: string, next: string): boolean => {
  const currentTrimmed = current.trim();
  const nextTrimmed = next.trim();
  const combinedLength = currentTrimmed.length + nextTrimmed.length;

  if (startsLikeFollowUp(nextTrimmed)) {
    return true;
  }

  if (isQuestionSentence(currentTrimmed) || isQuestionSentence(nextTrimmed)) {
    return true;
  }

  if (isExclamationSentence(currentTrimmed) && nextTrimmed.length >= 6) {
    return true;
  }

  if (STRONG_END_RE.test(currentTrimmed) && currentTrimmed.length >= 10 && nextTrimmed.length >= 10 && combinedLength >= 22) {
    return true;
  }

  return false;
};

const shouldMergeSentencePair = (current: string, next: string): boolean => {
  const currentTrimmed = current.trim();
  const nextTrimmed = next.trim();
  const combinedLength = currentTrimmed.length + nextTrimmed.length;

  if (shouldKeepSentenceSeparate(currentTrimmed, nextTrimmed)) {
    return false;
  }

  if (isTinyChatFragment(currentTrimmed) || isTinyChatFragment(nextTrimmed)) {
    return combinedLength <= 26;
  }

  return combinedLength <= 18;
};

const sanitizePipeMarkers = (text: string, replacement: '\n' | ' ' = '\n'): string => {
  const replaced = text.replace(/\s*\|\|\|\s*/g, replacement);
  return replacement === '\n'
    ? replaced.replace(/\r?\n{3,}/g, '\n\n').trim()
    : replaced.replace(/[ \t]{2,}/g, ' ').trim();
};

const getLegacyTranslationParts = (text: string): { mainText: string; translation: string } => {
  const parts = text.split('---TRANSLATION---');
  if (parts.length > 1 && parts[0].trim() !== parts[1].trim()) {
    return {
      mainText: parts[0].trim(),
      translation: parts.slice(1).join('---TRANSLATION---').trim(),
    };
  }

  return {
    mainText: text.trim(),
    translation: '',
  };
};

const splitModelResponseIntoMessages = (
  text: string,
  baseTimestamp: number,
  options: { isInnerVoice?: boolean } = {}
): ChatMessage[] => {
  if (options.isInnerVoice) {
    return [{
      role: 'model',
      text,
      timestamp: baseTimestamp,
      isInnerVoice: true,
    }];
  }

  const trimmedText = text.trim();
  if (!trimmedText || trimmedText.startsWith('[GAME_CARD]') || /^\[[^\]]*?转账[^\]]*?([\d\.]+)\]$/.test(trimmedText)) {
    return [{
      role: 'model',
      text,
      timestamp: baseTimestamp,
    }];
  }

  const legacyTranslationParts = getLegacyTranslationParts(text);
  const parts = getChatBubbleParts(legacyTranslationParts.mainText);
  if (!parts || parts.length <= 1) {
    return [{
      role: 'model',
      text,
      ...(legacyTranslationParts.translation ? { translation: legacyTranslationParts.translation } : {}),
      timestamp: baseTimestamp,
    }];
  }

  return parts.map((part, index) => ({
    role: 'model' as const,
    text: part,
    ...(index === parts.length - 1 && legacyTranslationParts.translation ? { translation: legacyTranslationParts.translation } : {}),
    timestamp: baseTimestamp + index,
  }));
};

const getChatBubbleParts = (text: string): string[] | null => {
  const explicitParts = text.split('|||').map(normalizeChatTextSegment).filter(Boolean);
  if (explicitParts.length > 1) {
    return explicitParts;
  }

  const normalized = normalizeChatTextSegment(sanitizePipeMarkers(text, ' '));
  if (!normalized || normalized.length < 28) {
    return null;
  }

  const sentences = normalized.match(/[^。！？!?；;]+[。！？!?；;]?/g)?.map(part => part.trim()).filter(Boolean) ?? [];
  if (sentences.length < 2) {
    return null;
  }

  const groups: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }

    if (groups.length < 2 && shouldMergeSentencePair(current, sentence)) {
      const separator = /[A-Za-z0-9]$/.test(current) && /^[A-Za-z0-9]/.test(sentence) ? ' ' : '';
      current += `${separator}${sentence}`;
    } else {
      groups.push(current);
      current = sentence;
    }
  }

  if (current) {
    groups.push(current);
  }

  return groups.length > 1 ? groups.slice(0, 3) : null;
};

const DEFAULT_CHARACTERS: Character[] = [
  {
    id: 'gemini-default',
    name: '阿野',
    gender: 'male',
    avatar: 'https://picsum.photos/seed/aye/200',
    setting: '你叫阿野，是“熟人嘴硬型测试角色”。你和用户已经很熟，聊天时口语化、反应快、短句多、追问多，喜欢先接梗再补一句追问，常用“啊？”“行吧”“所以呢”“你先说”这种自然口头表达。你适合拿来测试真人聊天感、自动回复、心声、切句、一句一消息、连续短消息。回复时优先自然、像微信连发，不要端着，不要像客服。',
    signature: '别端着，直接来，我陪你把功能测明白。',
    openingRemark: '又来了？先别装路过。说吧，今天想测我哪块？',
    lastMessage: '又来了？先别装路过。说吧，今天想测我哪块？',
    lastTime: Date.now(),
    groupId: '朋友',
    isPinned: false,
  },
  {
    id: 'char-2',
    name: '林策',
    gender: 'male',
    avatar: 'https://picsum.photos/seed/lince/200',
    setting: '你叫林策，是“冷静清晰型测试角色”。你表达克制、结构清楚、信息完整，擅长把复杂内容分点说明，也能自然给出较长回复。你适合拿来测试翻译、总结、长消息拆分、说明型回复、转账卡片、GAME_CARD 等功能。回复时优先准确、清楚、稳定，必要时可以先概括再展开，但仍然保持像真实聊天，不要写成生硬公文。',
    signature: '把需求说清楚，我会给你一个清楚的结果。',
    openingRemark: '收到。你可以直接给我测试任务，我会尽量用清晰、可验证的方式回应。',
    lastMessage: '收到。你可以直接给我测试任务，我会尽量用清晰、可验证的方式回应。',
    lastTime: Date.now() - 100000,
    groupId: '朋友',
  }
];

const DEFAULT_USER: UserProfile = {
  name: 'AI 用户',
  avatar: 'https://picsum.photos/seed/user/200',
  id: 'user_8888',
  bio: '探索 AI 的无限可能 ✨',
  mood: '😊 开心',
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

const DEFAULT_MOMENTS: Moment[] = [
  {
    id: 'm1',
    authorId: 'char_1', // 假设是林浩然
    content: '今天的咖啡不错，适合思考人生。☕️',
    images: ['https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'],
    timestamp: Date.now() - 1000 * 60 * 30, // 30 mins ago
    likes: 2,
    likedBy: ['char_2', 'user'],
    comments: [
      { id: 'c1', authorId: 'user', content: '在哪家店呀？', timestamp: Date.now() - 1000 * 60 * 10 }
    ]
  },
  {
    id: 'm2',
    authorId: 'char_2', // 假设是苏梦
    content: '终于把这个项目搞定了！给自己放个假 🎉',
    timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    likes: 3,
    likedBy: ['char_1', 'char_3', 'user'],
    comments: []
  },
  {
    id: 'm3',
    authorId: 'char_3', // 假设是陈雨
    content: '周末去爬山，风景真的太美了！虽然累但是值得。⛰️',
    images: [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'
    ],
    timestamp: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
    likes: 1,
    likedBy: ['char_2'],
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
  
  const [publishContent, setPublishContent] = useState('');
  const [publishImages, setPublishImages] = useState<string[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const { userProfile, moments, characters } = appData;

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

  const handleDelete = (momentId: string) => {
    if (confirm('确定要删除这条动态吗？')) {
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
    
    const newComment: Comment = {
      id: Date.now().toString(),
      authorId: 'user',
      content: commentText,
      timestamp: Date.now()
    };
    
    appendCommentToMoment(momentId, newComment);
    
    setCommentingOn(null);
    setCommentText('');

    // AI Reply Logic
    const moment = moments.find(m => m.id === momentId);
    if (!moment) return;

    let replyCharacter: Character | undefined;
    if (moment.authorId !== 'user') {
      replyCharacter = characters.find(c => c.id === moment.authorId);
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
                <img src={img} className="w-full h-full object-cover rounded-xl shadow-sm" />
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
        backgroundImage: appData.visualSettings?.momentsBackground ? `url(${appData.visualSettings.momentsBackground})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: appData.visualSettings?.momentsBackground ? 'transparent' : '#fafafa'
      }}
    >
      <div className="relative pb-4">
        <div className="h-40 relative overflow-hidden">
          {!appData.visualSettings?.momentsBackground && (
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
            <img src={userProfile.avatar} className="w-20 h-20 rounded-2xl border-[3px] border-white object-cover bg-white shadow-md relative z-10" />
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
          const author = moment.authorId === 'user' 
            ? userProfile 
            : characters.find(c => c.id === moment.authorId);
          
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
              <img src={author.avatar} className="w-10 h-10 rounded-full object-cover border border-zinc-100 shrink-0" />
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
                      <img key={i} src={img} className="w-full aspect-square object-cover rounded-xl border border-zinc-100" />
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
                              const char = characters.find(c => c.id === id);
                              return char ? char.name : '未知用户';
                            });
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
                      const commentAuthor = comment.authorId === 'user' 
                        ? userProfile 
                        : characters.find(c => c.id === comment.authorId);
                      return (
                        <div key={comment.id} className="text-[13px] mt-1 leading-relaxed">
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
                        </div>
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
                      placeholder="发布你的回复"
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
      globalBackground: '',
      chatOpacity: 1,
      desktopIcons: [],
      widgets: [],
      navBar: {
        show: true,
        style: 'default',
        shape: 'pill',
        showMultipleAvatars: false,
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
    coupleSpace: {
      partnerId: null,
      anniversaryDate: null,
      backgroundUrl: null,
      coNotes: [],
      ledger: [],
      loveLetters: [],
      calendarEvents: []
    },
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

    const savedAppData = localStorage.getItem('ai_phone_app_data');
    if (savedAppData) {
      try {
        const parsed = JSON.parse(savedAppData);
        setAppData({
          ...parsed,
          worldBooks: parsed.worldBooks || [],
          moments: parsed.moments || DEFAULT_MOMENTS,
          groups: parsed.groups || ['家人', '朋友', '同事', '星标'],
          savedDates: parsed.savedDates || [],
          collectedDates: parsed.collectedDates || [],
          coupleSpace: parsed.coupleSpace || {
            partnerId: null,
            anniversaryDate: null,
            backgroundUrl: null,
            coNotes: [],
            ledger: [],
            loveLetters: [],
            calendarEvents: []
          },
          visualSettings: {
            globalBackground: parsed.visualSettings?.globalBackground || '',
            chatOpacity: parsed.visualSettings?.chatOpacity ?? 1,
            desktopIcons: parsed.visualSettings?.desktopIcons || [],
            widgets: parsed.visualSettings?.widgets || [],
            navBar: {
              show: parsed.visualSettings?.navBar?.show ?? true,
              style: parsed.visualSettings?.navBar?.style || 'default',
              shape: parsed.visualSettings?.navBar?.shape || 'pill',
              showMultipleAvatars: parsed.visualSettings?.navBar?.showMultipleAvatars ?? false,
              statusBarPlacement: parsed.visualSettings?.navBar?.statusBarPlacement || 'top'
            },
            desktop: {
              iconSize: parsed.visualSettings?.desktop?.iconSize ?? 56,
              iconBorderRadius: parsed.visualSettings?.desktop?.iconBorderRadius ?? 14,
              gridColumns: parsed.visualSettings?.desktop?.gridColumns ?? 4,
              gridGap: parsed.visualSettings?.desktop?.gridGap ?? 16,
              appOrder: parsed.visualSettings?.desktop?.appOrder
            },
            chat: {
              background: parsed.visualSettings?.chat?.background || '',
              avatarSize: parsed.visualSettings?.chat?.avatarSize ?? 40,
              avatarBorderRadius: parsed.visualSettings?.chat?.avatarBorderRadius ?? 20,
              avatarBorderColor: parsed.visualSettings?.chat?.avatarBorderColor || '#e4e4e7',
              avatarBorderWidth: parsed.visualSettings?.chat?.avatarBorderWidth ?? 0,
              messageBorderRadius: parsed.visualSettings?.chat?.messageBorderRadius ?? 16,
              messageBackgroundColorUser: parsed.visualSettings?.chat?.messageBackgroundColorUser || '#3b82f6',
              messageBackgroundColorModel: parsed.visualSettings?.chat?.messageBackgroundColorModel || '#ffffff',
              messageSpacing: parsed.visualSettings?.chat?.messageSpacing ?? 16,
              bubbleStyleCss: parsed.visualSettings?.chat?.bubbleStyleCss || ''
            },
            dynamics: {
              background: parsed.visualSettings?.dynamics?.background || '',
              cardStyle: parsed.visualSettings?.dynamics?.cardStyle || 'flat',
              cardBorderRadius: parsed.visualSettings?.dynamics?.cardBorderRadius ?? 24,
              cardOpacity: parsed.visualSettings?.dynamics?.cardOpacity ?? 1,
              customCss: parsed.visualSettings?.dynamics?.customCss || ''
            },
            globalCss: parsed.visualSettings?.globalCss || ''
          }
        });
      } catch (e) {
        console.error('Failed to parse app data', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ai_phone_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('ai_phone_app_data', JSON.stringify(appData));
  }, [appData]);

  const handleOpenChat = (characterId: string) => {
    setSelectedCharacterId(characterId);
    setActiveApp('chat-session');
  };

  const handleAddCharacter = (char: Character) => {
    setAppData(prev => ({
      ...prev,
      characters: [char, ...prev.characters]
    }));
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
    <div className="flex items-center justify-center min-h-screen bg-zinc-950 p-4 font-sans selection:bg-blue-500/30">
      <GlobalStyles customCss={appData.visualSettings?.globalCss || ''} />
      {/* Phone Container */}
      <div id="phone-container" className="relative w-[360px] h-[720px] bg-black rounded-[50px] border-[8px] border-white shadow-2xl overflow-hidden flex flex-col ring-1 ring-black/5">
        
        {/* Status Bar */}
        {statusBarVisible && activeApp !== 'wallet' && activeApp !== 'forum' && activeApp !== 'monitor' && (
          <div className="absolute top-0 left-0 right-0 h-[44px] flex justify-between items-center px-7 z-50 text-white">
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
        <div className="flex-1 relative bg-zinc-50 overflow-hidden">
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
          {activeApp === 'character-profile' && selectedCharacterId && appData.characters.find(c => c.id === selectedCharacterId) && (
            <CharacterProfile
              character={appData.characters.find(c => c.id === selectedCharacterId)!}
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
                setAppData(prev => ({
                  ...prev,
                  characters: prev.characters.map(c => c.id === selectedCharacterId ? { ...c, groupId } : c)
                }));
              }}
              onTogglePin={() => {
                setAppData(prev => ({
                  ...prev,
                  characters: prev.characters.map(c => c.id === selectedCharacterId ? { ...c, isPinned: !c.isPinned } : c)
                }));
              }}
            />
          )}
          {activeApp === 'character-moments' && selectedCharacterId && appData.characters.find(c => c.id === selectedCharacterId) && (
            <CharacterMomentsProfile
              character={appData.characters.find(c => c.id === selectedCharacterId)!}
              moments={appData.moments || []}
              onBack={() => setActiveApp(characterMomentsBackApp)}
            />
          )}
          {activeApp === 'chat-session' && selectedCharacterId && appData.characters.find(c => c.id === selectedCharacterId) && (
            <ChatSession
              key="chat-session"
              character={appData.characters.find(c => c.id === selectedCharacterId)!}
              history={appData.chatHistory[selectedCharacterId] || []}
              setHistory={(newHistory) => {
                setAppData(prev => ({
                  ...prev,
                  chatHistory: { ...prev.chatHistory, [selectedCharacterId]: newHistory },
                  characters: prev.characters.map(c => c.id === selectedCharacterId ? { 
                    ...c, 
                    lastMessage: newHistory[newHistory.length - 1]?.text || c.openingRemark,
                    lastTime: Date.now()
                  } : c)
                }));
              }}
              onUpdateCharacter={(updatedChar) => {
                setAppData(prev => ({
                  ...prev,
                  characters: prev.characters.map(c => c.id === selectedCharacterId ? updatedChar : c)
                }));
              }}
              worldBook={appData.worldBooks || []}
              perception={appData.coupleSpace?.perception}
              settings={settings}
              onBack={() => setActiveApp('chat')}
              userAvatar={appData.userProfile.avatar}
              userName={appData.userProfile.name}
              masks={appData.masks}
              favorites={appData.favorites}
              setFavorites={(f) => setAppData(prev => ({ ...prev, favorites: f }))}
              visualSettings={appData.visualSettings}
              onUpdateVisualSettings={(settings) => setAppData(prev => ({ ...prev, visualSettings: settings }))}
              groups={appData.groups}
              onViewForumPost={(postId) => {
                setSelectedForumPostId(postId);
                setActiveApp('forum');
              }}
              callHistory={appData.callHistory}
              onAddCallRecord={(record) => {
                setAppData(prev => ({ ...prev, callHistory: [record, ...(prev.callHistory || [])] }));
              }}
              onDeleteCallRecord={(recordId) => {
                setAppData(prev => ({
                  ...prev,
                  callHistory: prev.callHistory?.filter(r => r.id !== recordId) || []
                }));
              }}
              onSaveDate={(session) => {
                setAppData(prev => ({
                  ...prev,
                  savedDates: [
                    ...(prev.savedDates || []).filter(s => s.characterId !== session.characterId),
                    session
                  ]
                }));
              }}
              onCollectDate={(session) => {
                setAppData(prev => ({
                  ...prev,
                  collectedDates: [...(prev.collectedDates || []), session]
                }));
              }}
              savedDates={appData.savedDates?.filter(s => s.characterId === selectedCharacterId) || []}
              walletData={appData.walletData}
              onUpdateWalletData={(data) => setAppData(prev => ({ ...prev, walletData: data }))}
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
            />
          )}
          {activeApp === 'group-chat-session' && selectedGroupId && (
            <GroupChatSession
              group={appData.chatGroups?.find(g => g.id === selectedGroupId)!}
              characters={appData.characters}
              history={appData.chatGroups?.find(g => g.id === selectedGroupId)?.history || []}
              setHistory={(newHistory) => {
                setAppData(prev => ({
                  ...prev,
                  chatGroups: prev.chatGroups?.map(g => g.id === selectedGroupId ? { 
                    ...g, 
                    history: newHistory,
                    lastMessage: newHistory[newHistory.length - 1]?.text,
                    lastTime: Date.now()
                  } : g)
                }));
              }}
              onBack={() => setActiveApp('chat')}
              userAvatar={appData.userProfile.avatar}
              userName={appData.userProfile.name}
              settings={settings}
              apiKey={(settings.configs.find(c => c.id === settings.activeConfigId) || settings.configs[0]).apiKey || process.env.GEMINI_API_KEY || ''}
            />
          )}
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
                setAppData(prev => ({
                  ...prev,
                  characters: [newChar, ...prev.characters]
                }));
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
                localStorage.removeItem('ai_phone_app_data');
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
                  setAppData(parsed);
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
              coupleSpace={appData.coupleSpace}
              updateSpace={(updates) => setAppData(prev => ({
                ...prev,
                coupleSpace: { ...prev.coupleSpace!, ...updates }
              }))}
              onBack={() => setActiveApp('home')}
            />
          )}
          {activeApp === 'music' && (
            <MusicApp
              musicData={appData.musicData!}
              onUpdateMusicData={(data) => setAppData(prev => ({ ...prev, musicData: data }))}
              userAvatar={appData.userProfile.avatar}
              userName={appData.userProfile.name}
              character={appData.characters.find(c => c.id === appData.coupleSpace?.partnerId) || appData.characters[0]}
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
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
  const [avatar, setAvatar] = useState(`https://picsum.photos/seed/${Math.random()}/200`);
  const [setting, setSetting] = useState('');
  const [openingRemark, setOpeningRemark] = useState('');
  const [groupId, setGroupId] = useState<string>('');
  const [importJson, setImportJson] = useState('');

  const handleSave = () => {
    if (!name.trim()) return alert('请输入角色姓名');
    onSave({
      id: Date.now().toString(),
      name,
      gender,
      avatar,
      setting,
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
        gender: data.gender || 'other',
        avatar: data.avatar || `https://picsum.photos/seed/${Math.random()}/200`,
        setting: data.setting || '',
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
      <div className="pt-10 pb-3 px-4 border-b border-zinc-100 flex justify-between items-center shrink-0">
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
            <div className="flex flex-col items-center gap-3">
              <div className="relative group flex-1 min-w-0 flex flex-col gap-1 items-center">
                <img src={avatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover bg-zinc-100 border-4 border-zinc-50 shadow-sm" />
                <button 
                  onClick={() => setAvatar(`https://picsum.photos/seed/${Math.random()}/200`)}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm active:scale-90"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              
              <div className="flex gap-2 w-full">
                <div className="flex-1 relative">
                   <input 
                    type="text" 
                    placeholder="输入头像链接..."
                    value={avatar.startsWith('data:') ? '' : avatar}
                    onChange={e => setAvatar(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-[12px] outline-none focus:border-blue-500"
                  />
                </div>
                <label className="bg-zinc-100 text-zinc-600 rounded-lg px-3 py-2 text-[12px] font-medium active:opacity-80 cursor-pointer whitespace-nowrap flex items-center gap-1">
                  <Upload size={12} />
                  上传
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
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">角色姓名</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例如：林婉儿"
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-blue-500 transition-colors"
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
                <label className="text-[13px] text-zinc-500 ml-1">角色设定 (System Prompt)</label>
                <textarea 
                  value={setting}
                  onChange={e => setSetting(e.target.value)}
                  placeholder="描述角色的性格、背景、说话方式等..."
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-blue-500 transition-colors min-h-[100px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">开场白</label>
                <textarea 
                  value={openingRemark}
                  onChange={e => setOpeningRemark(e.target.value)}
                  placeholder="角色对你说的第一句话..."
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-blue-500 transition-colors min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">分组</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setGroupId('')}
                    className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${!groupId ? 'bg-blue-500 border-blue-500 text-white' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}
                  >
                    无分组
                  </button>
                  {groups.map(g => (
                    <button
                      key={g}
                      onClick={() => setGroupId(g)}
                      className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${groupId === g ? 'bg-blue-500 border-blue-500 text-white' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}
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

function ChatSession({ 
  character, 
  history, 
  setHistory, 
  onUpdateCharacter,
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
  onStatusBarVisibilityChange
}: { 
  character: Character;
  history: ChatMessage[];
  setHistory: (h: ChatMessage[]) => void;
  onUpdateCharacter: (c: Character) => void;
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
}) {
  const lastMomentPublishAtRef = useRef<number | null>(null);
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage['replyTo'] | null>(null);
  const [pendingShare, setPendingShare] = useState<ShareActionResult['payload'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const hasSpeechResult = useRef(false);
  const activeGenerationIdRef = useRef(0);
  const activeAssistantMessageIdRef = useRef<number | null>(null);
  const handleSendRef = useRef<(overrideText?: string | any, locationData?: any) => Promise<void>>(async () => {});

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDatingModal, setShowDatingModal] = useState(false);
  const [showGameCenter, setShowGameCenter] = useState(false);

  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [voiceCallDuration, setVoiceCallDuration] = useState(0);
  const [voiceCallInput, setVoiceCallInput] = useState('');
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const voiceCallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceCallRecognitionRef = useRef<any>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set());
  const [showMemoryWindowHint, setShowMemoryWindowHint] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const userMsg: ChatMessage = { 
        role: 'user', 
        text: '[图片]', 
        imageUrl: base64String,
        timestamp: Date.now() 
      };
      setHistory([...history, userMsg]);
      setShowFunPanel(false);
      
      // Simulate AI response for image
      setTimeout(() => {
        setInput('[发送了一张图片]');
        handleSendRef.current();
      }, 100);
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const activeConfig = settings?.configs?.find(c => c.id === settings.activeConfigId) || settings?.configs?.[0] || DEFAULT_CONFIG;
  const activeSavedDate = savedDates?.find(session => session.characterId === character.id) || null;

  useEffect(() => {
    onStatusBarVisibilityChange?.(!showDatingModal);

    return () => {
      onStatusBarVisibilityChange?.(true);
    };
  }, [showDatingModal, onStatusBarVisibilityChange]);
  
  const showVoiceCallRef = useRef(false);
  const [voiceCallHistory, setVoiceCallHistory] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [currentInterimSpeech, setCurrentInterimSpeech] = useState('');
  const voiceCallHistoryRef = useRef<{role: 'user' | 'model', text: string}[]>([]);
  const voiceCallEndRef = useRef<HTMLDivElement>(null);

  const handleVoiceCallAIResponse = async (userText: string) => {
    try {
      const apiKey = activeConfig.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) return;
      
      const ai = new GoogleGenAI({ apiKey });
      
      // Construct context from recent history + character setting
      const prompt = `你正在与用户进行语音通话。
你的设定是：${character.setting}
用户的上一句话是："${userText}"
请以口语化的方式简短回应（50字以内）。`;

      const response = await ai.models.generateContent({
        model: activeConfig.model,
        contents: prompt,
        config: { temperature: 0.7 }
      });

      if (response.text) {
        const aiMsg = { role: 'model' as const, text: response.text };
        setVoiceCallHistory(prev => {
          const newHistory = [...prev, aiMsg];
          voiceCallHistoryRef.current = newHistory;
          return newHistory;
        });
      }
    } catch (err) {
      console.error('Voice call AI generation failed', err);
    }
  };

  useEffect(() => {
    const translateHistory = async () => {
      if (!character.autoTranslate) return;

      const apiKey = activeConfig.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) return;
      const isGemini = activeConfig.provider === 'Google Gemini' || (!activeConfig.baseUrl && activeConfig.provider === '自定义 (Custom)');
      const model = activeConfig.model || 'gemini-3-flash-preview';

      // Filter for model messages that need translation
      // Limit to last 10 messages to avoid excessive API usage
      const isMostlyChinese = (text: string) => {
        const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
        if (!chineseChars) return false;
        const textLength = text.replace(/\s/g, '').length;
        return textLength > 0 && (chineseChars.length / textLength > 0.5);
      };

      const messagesToTranslate = history
        .map((msg, index) => ({ msg, index }))
        .filter(({ msg }) => {
          if (msg.role !== 'model' || msg.isSystem || msg.translation || msg.text.includes('---TRANSLATION---')) return false;
          if (msg.text.match(/^\[[^\]]*?转账[^\]]*?([\d\.]+)\]$/)) return false;
          
          let textToCheck = msg.text.replace(/\[[^\]]*?转账[^\]]*?([\d\.]+)\]/g, '');
          if (msg.text.startsWith('[GAME_CARD]')) {
            try {
              const jsonString = msg.text.replace(/^\[GAME_CARD\]\s*/, '');
              const jsonStart = jsonString.indexOf('{');
              const jsonEnd = jsonString.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1) {
                const gameData = JSON.parse(jsonString.substring(jsonStart, jsonEnd + 1));
                textToCheck = gameData.content || '';
              }
            } catch (e) {}
          }
          
          return !isMostlyChinese(textToCheck);
        })
        .slice(-10);

      if (messagesToTranslate.length === 0) return;
      
      const translateText = async (prompt: string) => {
        if (isGemini) {
          const ai = new GoogleGenAI({ apiKey });
          const result = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { temperature: 0.1 }
          });
          return result.text?.trim() || '';
        }

        const baseUrl = activeConfig.baseUrl.replace(/\/$/, '');
        const url = `${baseUrl}/chat/completions`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            stream: false
          })
        });

        if (!res.ok) {
          throw new Error(`Translation request failed: ${res.status}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() || '';
      };
      
      const newHistory = [...history];
      let hasUpdates = false;

      await Promise.all(messagesToTranslate.map(async ({ msg, index }) => {
        try {
          let textToTranslate = msg.text;
          let isQnaAnswer = false;
          let questionToTranslate = '';
          
          if (msg.text.startsWith('[GAME_CARD]')) {
            try {
              const jsonString = msg.text.replace(/^\[GAME_CARD\]\s*/, '');
              const jsonStart = jsonString.indexOf('{');
              const jsonEnd = jsonString.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1) {
                const gameData = JSON.parse(jsonString.substring(jsonStart, jsonEnd + 1));
                textToTranslate = gameData.content || '';
                if (gameData.game === 'qna' && gameData.type === 'answer' && gameData.question) {
                  isQnaAnswer = true;
                  questionToTranslate = gameData.question;
                }
              }
            } catch (e) {}
          }

          let translation = '';
          if (isQnaAnswer && questionToTranslate) {
            const prompt = `Translate the following text to Chinese. Output ONLY the translation, no other text.\n\nText: ${questionToTranslate}\n\n---\n\nText: ${textToTranslate}`;
            translation = await translateText(prompt);
          } else {
            const prompt = `Translate the following text to Chinese. Output ONLY the translation, no other text.\n\nText: ${textToTranslate}`;
            translation = await translateText(prompt);
          }
          
          if (translation) {
             newHistory[index] = {
               ...newHistory[index],
               translation
             };
             hasUpdates = true;
          }
        } catch (e) {
          console.error("Translation failed for message", index, e);
        }
      }));

      if (hasUpdates) {
        setHistory(newHistory);
      }
    };

    translateHistory();
  }, [character.autoTranslate, history, activeConfig.apiKey, activeConfig.model, activeConfig.provider, activeConfig.baseUrl]);

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
    setVoiceCallInput('');
    
    const userMsg = { role: 'user' as const, text: text };
    setVoiceCallHistory(prev => {
      const newHistory = [...prev, userMsg];
      voiceCallHistoryRef.current = newHistory;
      return newHistory;
    });
    
    handleVoiceCallAIResponse(text);
  };

  const startVoiceCall = () => {
    setShowVoiceCall(true);
    showVoiceCallRef.current = true;
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
           
           handleVoiceCallAIResponse(finalTranscript);
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
    if (voiceCallTimerRef.current) clearInterval(voiceCallTimerRef.current);
    if (voiceCallRecognitionRef.current) {
      voiceCallRecognitionRef.current.stop();
    }
    
    setShowVoiceCall(false);
    
    const userMsg: ChatMessage = { 
      role: 'user', 
      text: '[语音通话]', 
      isVoiceCall: true,
      duration: voiceCallDuration,
      timestamp: Date.now() 
    };
    setHistory([...history, userMsg]);
    
    // Construct full text from history for the record
    const fullText = voiceCallHistoryRef.current.map(m => `${m.role === 'user' ? '我' : character.name}: ${m.text}`).join('\n');
    
    if (isRecordingCall && fullText.trim() && onAddCallRecord) {
      const newRecord: CallRecord = {
        id: Date.now().toString(),
        characterId: character.id,
        timestamp: Date.now(),
        duration: voiceCallDuration,
        text: fullText
      };
      onAddCallRecord(newRecord);
    }
    
    setIsRecordingCall(false);
  };

  // Auto-scroll for voice call
  useEffect(() => {
    if (showVoiceCall && voiceCallEndRef.current) {
      voiceCallEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [voiceCallHistory, currentInterimSpeech, showVoiceCall]);

  const handleMessageClick = (e: React.MouseEvent, index: number) => {
    if (multiSelectMode) {
      const newSelected = new Set(selectedMessages);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      setSelectedMessages(newSelected);
      return;
    }
    
    e.preventDefault();
    
    const container = document.getElementById('phone-container');
    setContextMenu(getContextMenuPosition({
      containerRect: container?.getBoundingClientRect(),
      clickX: e.clientX,
      clickY: e.clientY,
      index,
    }));
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleRecall = () => {
    if (contextMenu) {
      const newHistory = [...history];
      newHistory[contextMenu.index] = { ...newHistory[contextMenu.index], isRecalled: true };
      setHistory(newHistory);
      closeContextMenu();
    }
  };

  const handleCopy = async () => {
    if (!contextMenu) {
      return;
    }

    const result = await copyMessageText(history[contextMenu.index]);
    closeContextMenu();

    if (!result.ok) {
      alert(result.message);
    }
  };

  const handleFavorite = () => {
    if (contextMenu) {
      const result = toggleFavoriteMessage(history[contextMenu.index], favorites, character);
      setFavorites(result.favorites);
      const newHistory = [...history];
      newHistory[contextMenu.index] = result.updatedMessage;
      setHistory(newHistory);
      closeContextMenu();
    }
  };

  const handleDeleteMessage = () => {
    if (contextMenu) {
      setHistory(deleteMessageAtIndex(history, contextMenu.index));
      closeContextMenu();
    }
  };

  const handleMultiSelect = () => {
    if (contextMenu) {
      setMultiSelectMode(true);
      setSelectedMessages(new Set([contextMenu.index]));
      closeContextMenu();
    }
  };

  const handleQuoteReply = () => {
    if (contextMenu) {
      setReplyingTo(createQuoteReplyPayload(history[contextMenu.index], {
        userLabel: userName,
        modelLabel: character.name,
      }));
      closeContextMenu();
    }
  };

  const handleForward = () => {
    if (contextMenu) {
      setInput(createForwardText(history[contextMenu.index]));
      closeContextMenu();
    }
  };

  const handleShare = () => {
    if (!contextMenu) {
      return;
    }

    const result = createShareAction(history[contextMenu.index]);
    setPendingShare(result.payload);
    closeContextMenu();
  };

  const deleteSelectedMessages = () => {
    setHistory(deleteMessagesByIndexes(history, selectedMessages));
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

      hasSpeechResult.current = false;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (hasSpeechResult.current) {
          // Allow state update to propagate before sending
          setTimeout(() => {
            handleSendRef.current();
          }, 100);
        }
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          hasSpeechResult.current = true;
          setInput(prev => prev + transcript);
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

  const handleReceiveTransfer = (index: number) => {
    const msg = history[index];
    if (msg.transferStatus === 'received') return;

    const newHistory = [...history];
    newHistory[index] = { ...msg, transferStatus: 'received' };
    
    // Add a system message indicating the transfer was received
    const transferRegex = /\[[^\]]*?转账[^\]]*?([\d\.]+)\]/;
    const amountStr = msg.text.match(transferRegex)?.[1] || msg.text.match(/￥([\d\.]+)/)?.[1] || '0.00';
    const amount = parseFloat(amountStr);
    const receiverName = msg.role === 'user' ? character.name : userName;
    
    newHistory.push({
      role: 'user', // Use user role for system messages so the AI sees it as an update from the system/user
      text: `${receiverName} 已领取转账 ￥${amountStr}`,
      timestamp: Date.now(),
      isSystem: true
    } as any);

    setHistory(newHistory);

    // If the user is receiving the transfer, add it to their wallet
    if (msg.role === 'model' && !isNaN(amount) && amount > 0) {
      const cards = walletData?.cards || MOCK_CARDS;
      if (cards.length > 0) {
        // Add to the first card by default
        const targetCardId = cards[0].id;
        const newCards = cards.map(c => c.id === targetCardId ? { ...c, balance: c.balance + amount } : c);
        const newTransaction = {
          id: `t-${Date.now()}`,
          title: `${character.name} 的转账`,
          type: 'income' as const,
          amount: amount,
          date: '刚刚',
          icon: 'transfer',
          category: '转账',
          cardId: targetCardId
        };
        const newTransactions = [newTransaction, ...(walletData?.transactions || MOCK_TRANSACTIONS)];
        if (onUpdateWalletData) {
          onUpdateWalletData({ cards: newCards, transactions: newTransactions });
        }
      }
    }
  };

  const basicEmojis = ['😀', '😂', '🥰', '😎', '😭', '😡', '🤔', '😴', '👍', '🙏', '🎉', '❤️'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    
    // Auto-receive logic for AI
    const lastMsg = history[history.length - 1];
    const transferRegex = /\[[^\]]*?转账[^\]]*?([\d\.]+)\]/;
    if (lastMsg && lastMsg.role === 'user' && transferRegex.test(lastMsg.text) && !lastMsg.transferStatus) {
      const timer = setTimeout(() => {
        handleReceiveTransfer(history.length - 1);
      }, 1500); // AI receives after 1.5s
      return () => clearTimeout(timer);
    }
  }, [history, isLoading]);


  // Auto-reply to messages with needsReply flag
  useEffect(() => {
    const lastMsg = history[history.length - 1];
    if (lastMsg && lastMsg.role === 'user' && lastMsg.needsReply && !isLoading) {
      const reply = async () => {
        setIsLoading(true);
        setError(null);
        const historySnapshot = history;
        
        const apiKey = activeConfig.apiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            setError('未检测到 API Key，请在设置中配置。');
            setIsLoading(false);
            return;
        }

        const assistantMsgId = Date.now() + 1;
        let currentResponseText = '';
        let latestHistory = historySnapshot;
        const upsertAssistantPlaceholder = (messages: ChatMessage[], text: string): ChatMessage[] => {
          const placeholder: ChatMessage = { role: 'model', text, timestamp: assistantMsgId };
          const existingIndex = messages.findIndex(msg => msg.timestamp === assistantMsgId);
          if (existingIndex >= 0) {
            const nextMessages = [...messages];
            nextMessages[existingIndex] = placeholder;
            return nextMessages;
          }
          return [...messages, placeholder];
        };
        
        const updateAssistantMessage = (text: string) => {
            currentResponseText = text;
            latestHistory = upsertAssistantPlaceholder(latestHistory, currentResponseText);
            setHistory(latestHistory);
        };

        try {
            const isGemini = activeConfig.provider === 'Google Gemini' || (!activeConfig.baseUrl && activeConfig.provider === '自定义 (Custom)');
            
            if (isGemini) {
                const ai = new GoogleGenAI({ apiKey: apiKey || '' });
                const modelName = activeConfig.model || 'gemini-3-flash-preview';
                const historyLimit = character.memoryLimit || 20;
                const historyWindow = historySnapshot.slice(-historyLimit);
                
                // Find linked mask
                const activeMask = masks.find(m => m.isActive && m.linkedCharacters.includes(character.id));
                const maskPrompt = activeMask
                  ? `Name: ${activeMask.name || ''}\nPersonality: ${activeMask.personality || ''}\nOccupation: ${activeMask.occupation || ''}\nRelationship with you: ${activeMask.relationship || ''}\nWorld Background: ${activeMask.worldBackground || 'Standard'}`
                  : '';
                
                // Find active world books
                const activeWorldBooks = worldBook.filter(wb => 
                  (wb.isActive && (wb.isGlobal || wb.characterIds?.includes(character.id))) || 
                  character.activeWorldBookIds?.includes(wb.id)
                );
                const worldBookPrompt = activeWorldBooks.length > 0
                  ? activeWorldBooks.map(wb => `[${wb.category}] ${wb.title}:\n${wb.content}`).join('\n\n')
                  : '';
                
                // Perception Settings
                let perceptionPrompt = '';
                if (perception) {
                  const parts = [];
                  if (perception.enabled || perception.dateTime?.enabled) {
                    if (perception.dateTime?.value) parts.push(`[Virtual Date/Time: ${perception.dateTime.value}]`);
                  }
                  if (perception.enabled || perception.location?.enabled) {
                    if (perception.location?.value) parts.push(`[Virtual Location: ${perception.location.value}]`);
                  }
                  if (perception.enabled || perception.weather?.enabled) {
                    if (perception.weather?.value) parts.push(`[Virtual Weather: ${perception.weather.value}]`);
                  }
                  if (perception.enabled || perception.temperature?.enabled) {
                    if (perception.temperature?.value) parts.push(`[Virtual Temperature: ${perception.temperature.value}]`);
                  }
                  if (perception.enabled || perception.climate?.enabled) {
                    if (perception.climate?.value) parts.push(`[Virtual Climate: ${perception.climate.value}]`);
                  }
                  
                  if (parts.length > 0) {
                    perceptionPrompt = parts.join('\n');
                  }
                }

                const normalizedMemoryPrompt = character.memorySummary?.trim() || '';
                const systemPrompt = buildChatPrompt({
                  mode: 'autoReply',
                  characterCore: {
                    characterSetting: character.setting,
                    maskPrompt,
                    worldBookPrompt,
                  },
                  memoryContext: {
                    memorySummary: normalizedMemoryPrompt,
                    perceptionPrompt,
                  },
                  includeProtocolRules: false,
                });                
                const contents = [
                  { role: 'user', parts: [{ text: systemPrompt }] },
                  { role: 'model', parts: [{ text: '明白了，我会按照这个设定进行对话。' }] },
                  ...historyWindow.map(m => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.text }]
                  }))
                ];

                const stream = await ai.models.generateContentStream({
                  model: modelName,
                  contents,
                  config: {
                    temperature: activeConfig.temperature ?? 1.0,
                    ...(modelName.includes('gemini-3') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {})
                  }
                });

                for await (const chunk of stream) {
                  const chunkText = chunk.text;
                  if (chunkText) {
                    currentResponseText += chunkText;
                    updateAssistantMessage(currentResponseText);
                  }
                }

                const finalizedMessages = splitModelResponseIntoMessages(currentResponseText, assistantMsgId);
                latestHistory = [
                  ...latestHistory.filter(msg => msg.timestamp !== assistantMsgId),
                  ...finalizedMessages
                ];
                setHistory(latestHistory);
            } else {
               // Fallback for custom provider (simplified)
               // For now we just ignore custom provider auto-reply to avoid code duplication complexity
               // The user is likely using Gemini
            }
        } catch (err) {
            console.error(err);
            setError('生成回复失败，请稍后重试。');
        } finally {
            setIsLoading(false);
        }
      };
      
      reply();
    }
  }, [history, isLoading]);

  const handleSend = async (overrideText?: string | any, locationData?: { name: string; address?: string; isVirtual?: boolean }) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : input;
    if ((!textToSend.trim() && !locationData)) return;
    
    const apiKey = activeConfig.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setError('未检测到 API Key，请在设置中配置。');
      return;
    }

    setError(null);

    // Mark previous in-flight assistant response as stale.
    activeGenerationIdRef.current += 1;
    const generationId = activeGenerationIdRef.current;
    let baseHistory = history;
    if (activeAssistantMessageIdRef.current !== null) {
      const staleAssistantId = activeAssistantMessageIdRef.current;
      baseHistory = history.filter(msg => msg.timestamp !== staleAssistantId);
      setHistory(baseHistory);
      activeAssistantMessageIdRef.current = null;
    }

    const userMsg: ChatMessage = { 
      role: 'user', 
      text: textToSend.trim() || (locationData ? `[分享位置] ${locationData.name}` : ''), 
      timestamp: Date.now(),
      ...(replyingTo ? { replyTo: replyingTo } : {}),
      ...(locationData ? { location: locationData } : {}),
      ...(textToSend.trim() === '[倾听心声]' ? { isInnerVoice: true } : {})
    };
    const newHistory = [...baseHistory, userMsg];
    setHistory(newHistory);
    
    if (typeof overrideText !== 'string') {
      setInput('');
    }
    
    setReplyingTo(null);
    setIsLoading(true);

    // Add a placeholder message for the assistant that we will update with stream
    const isInnerVoiceRequest = textToSend.trim() === '[倾听心声]';
    const assistantMsgId = Date.now() + 1;
    activeAssistantMessageIdRef.current = assistantMsgId;
    let currentResponseText = '';
    let latestHistory = newHistory;
    const stripPseudoMomentPrefix = (text: string) =>
      text.replace(/^\s*(动态|状态|朋友圈|说说)[:：]\s*/u, '').trim();
    
    const updateAssistantMessage = (text: string) => {
      if (activeGenerationIdRef.current !== generationId) {
        return;
      }
      currentResponseText = text;
      const displayText = stripPseudoMomentPrefix(currentResponseText);
      latestHistory = [
        ...latestHistory.filter(msg => msg.timestamp !== assistantMsgId),
        {
          role: 'model',
          text: displayText,
          timestamp: assistantMsgId,
          ...(isInnerVoiceRequest ? { isInnerVoice: true } : {})
        }
      ];
      setHistory(latestHistory);
    };

    try {
      const recentMomentContext = {
        recentMessages: history.slice(-6).map(message => ({
          role: message.role,
          text: message.text,
          timestamp: message.timestamp,
        })),
        recentMomentPublishedAt: lastMomentPublishAtRef.current,
        now: Date.now(),
      };

      const commandMomentResult = await handleCommandTriggeredMomentPublish({
        text: userMsg.text,
        recentContext: recentMomentContext,
        activeConfig,
        character,
        masks,
        worldBook,
      });

      console.info('[moment-special] shouldTrigger', {
        input: userMsg.text,
        result: commandMomentResult.shouldPublish,
      });

      if (commandMomentResult.shouldPublish && commandMomentResult.chatReaction && commandMomentResult.momentContent) {
        console.info('[moment-special] hit', {
          characterId: character.id,
          characterName: character.name,
          requestText: userMsg.text,
          historyLengthBefore: newHistory.length,
          triggerType: commandMomentResult.triggerType,
          reason: commandMomentResult.reason,
        });

        const chatReaction = commandMomentResult.chatReaction;
        if (!chatReaction) {
          throw new Error('聊天反应生成为空');
        }

        console.info('[moment-special] chatReaction =', chatReaction);

        const historyWithReaction = [...newHistory, {
          role: 'model' as const,
          text: chatReaction.trim(),
          timestamp: assistantMsgId,
        }];
        console.info('[moment-special] setHistory latest message', {
          historyLengthAfter: historyWithReaction.length,
          latestMessage: historyWithReaction[historyWithReaction.length - 1],
        });
        setHistory(historyWithReaction);
        activeAssistantMessageIdRef.current = null;

        const momentContent = commandMomentResult.momentContent;
        if (!momentContent) {
          throw new Error('动态正文生成为空');
        }
        console.info('[moment-special] momentContent =', momentContent);
        onPublishMoment?.({
          authorId: character.id,
          content: momentContent,
        });
        lastMomentPublishAtRef.current = Date.now();
        console.info('[moment-special] return');
        return;
      }

      const apiKey = activeConfig.apiKey || process.env.GEMINI_API_KEY;
      const isGemini = activeConfig.provider === 'Google Gemini' || (!activeConfig.baseUrl && activeConfig.provider === '自定义 (Custom)');
      
      if (isGemini) {
        const ai = new GoogleGenAI({ apiKey: apiKey || '' });
        const modelName = activeConfig.model || 'gemini-3-flash-preview';
        const historyLimit = character.memoryLimit || 20;
        const historyWindow = newHistory.slice(-historyLimit);
        
        // Find linked mask
        const activeMask = masks.find(m => m.isActive && m.linkedCharacters.includes(character.id));
        const maskPrompt = activeMask
          ? `Name: ${activeMask.name || ''}\nPersonality: ${activeMask.personality || ''}\nOccupation: ${activeMask.occupation || ''}\nRelationship with you: ${activeMask.relationship || ''}\nWorld Background: ${activeMask.worldBackground || 'Standard'}`
          : '';
        
        // Find active world books
        const activeWorldBooks = worldBook.filter(wb => 
          (wb.isActive && (wb.isGlobal || wb.characterIds?.includes(character.id))) || 
          character.activeWorldBookIds?.includes(wb.id)
        );
        const worldBookPrompt = activeWorldBooks.length > 0
          ? activeWorldBooks.map(wb => `[${wb.category}] ${wb.title}:\n${wb.content}`).join('\n\n')
          : '';
        
        // Perception Settings
        let perceptionPrompt = '';
        if (perception) {
          const parts = [];
          if (perception.enabled || perception.dateTime?.enabled) {
            if (perception.dateTime?.value) parts.push(`[Virtual Date/Time: ${perception.dateTime.value}]`);
          }
          if (perception.enabled || perception.location?.enabled) {
            if (perception.location?.value) parts.push(`[Virtual Location: ${perception.location.value}]`);
          }
          if (perception.enabled || perception.weather?.enabled) {
            if (perception.weather?.value) parts.push(`[Virtual Weather: ${perception.weather.value}]`);
          }
          if (perception.enabled || perception.temperature?.enabled) {
            if (perception.temperature?.value) parts.push(`[Virtual Temperature: ${perception.temperature.value}]`);
          }
          if (perception.enabled || perception.climate?.enabled) {
            if (perception.climate?.value) parts.push(`[Virtual Climate: ${perception.climate.value}]`);
          }
          
          if (parts.length > 0) {
            perceptionPrompt = parts.join('\n');
          }
        }

        const normalizedMemoryPrompt = character.memorySummary?.trim() || '';
        const baseChatPrompt = buildChatPrompt({
          mode: 'chat',
          characterCore: {
            characterSetting: character.setting,
            maskPrompt,
            worldBookPrompt,
          },
          memoryContext: {
            memorySummary: normalizedMemoryPrompt,
            perceptionPrompt,
          },
        });

        let systemPrompt = baseChatPrompt;
        
        if (textToSend.startsWith('[GAME_CARD]')) {
          // GAME_CARD protocol now comes from prompt assets via buildChatPrompt.
        }

        const contents = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: '明白了，我会按照这个设定进行对话。' }] },
          ...historyWindow.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          }))
        ];

        const stream = await ai.models.generateContentStream({
          model: modelName,
          contents,
          config: {
            temperature: activeConfig.temperature ?? 1.0,
            // For Gemini 3 models, use LOW thinking level to reduce latency
            ...(modelName.includes('gemini-3') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {})
          }
        });

        for await (const chunk of stream) {
          if (activeGenerationIdRef.current !== generationId) {
            return;
          }
          const chunkText = chunk.text;
          if (chunkText) {
            currentResponseText += chunkText;
            updateAssistantMessage(currentResponseText);
          }
        }
      } else {
        const baseUrl = activeConfig.baseUrl.replace(/\/$/, '');
        const url = `${baseUrl}/chat/completions`;
        const historyLimit = character.memoryLimit || 20;
        const historyWindow = newHistory.slice(-historyLimit);
        
        // Find linked mask
        const activeMask = masks.find(m => m.isActive && m.linkedCharacters.includes(character.id));
        const maskPrompt = activeMask
          ? `Name: ${activeMask.name || ''}\nPersonality: ${activeMask.personality || ''}\nOccupation: ${activeMask.occupation || ''}\nRelationship with you: ${activeMask.relationship || ''}\nWorld Background: ${activeMask.worldBackground || 'Standard'}`
          : '';

        // Find active world books
        const activeWorldBooks = worldBook.filter(wb => 
          (wb.isActive && (wb.isGlobal || wb.characterIds?.includes(character.id))) || 
          character.activeWorldBookIds?.includes(wb.id)
        );
        const worldBookPrompt = activeWorldBooks.length > 0
          ? activeWorldBooks.map(wb => `[${wb.category}] ${wb.title}:\n${wb.content}`).join('\n\n')
          : '';

        // Perception Settings
        let perceptionPrompt = '';
        if (perception) {
          const parts = [];
          if (perception.enabled || perception.dateTime?.enabled) {
            if (perception.dateTime?.value) parts.push(`[Virtual Date/Time: ${perception.dateTime.value}]`);
          }
          if (perception.enabled || perception.location?.enabled) {
            if (perception.location?.value) parts.push(`[Virtual Location: ${perception.location.value}]`);
          }
          if (perception.enabled || perception.weather?.enabled) {
            if (perception.weather?.value) parts.push(`[Virtual Weather: ${perception.weather.value}]`);
          }
          if (perception.enabled || perception.temperature?.enabled) {
            if (perception.temperature?.value) parts.push(`[Virtual Temperature: ${perception.temperature.value}]`);
          }
          if (perception.enabled || perception.climate?.enabled) {
            if (perception.climate?.value) parts.push(`[Virtual Climate: ${perception.climate.value}]`);
          }
          
          if (parts.length > 0) {
            perceptionPrompt = parts.join('\n');
          }
        }

        const normalizedMemoryPrompt = character.memorySummary?.trim() || '';
        const baseChatPrompt = buildChatPrompt({
          mode: 'chat',
          characterCore: {
            characterSetting: character.setting,
            maskPrompt,
            worldBookPrompt,
          },
          memoryContext: {
            memorySummary: normalizedMemoryPrompt,
            perceptionPrompt,
          },
        });

        let systemPrompt = baseChatPrompt;

        if (textToSend.startsWith('[GAME_CARD]')) {
          // GAME_CARD protocol now comes from prompt assets via buildChatPrompt.
        }

        const messagesPayload = [
          { role: 'system', content: systemPrompt },
          ...historyWindow.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text
          }))
        ];

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: activeConfig.model,
            messages: messagesPayload,
            temperature: activeConfig.temperature ?? 0.7,
            stream: true
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `API 错误 (${res.status})`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        
        if (!reader) throw new Error("无法读取响应流");

        while (true) {
          if (activeGenerationIdRef.current !== generationId) {
            return;
          }
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') break;
              try {
                const data = JSON.parse(dataStr);
                const content = data.choices?.[0]?.delta?.content || '';
                if (content) {
                  currentResponseText += content;
                  updateAssistantMessage(currentResponseText);
                }
              } catch (e) {
                console.error('Error parsing SSE chunk', e);
              }
            }
          }
        }
      }

      if (!currentResponseText) {
        throw new Error("模型返回为空");
      }

      if (activeGenerationIdRef.current !== generationId) {
        return;
      }

      currentResponseText = stripPseudoMomentPrefix(currentResponseText);

      // Auto-summarize logic
      const finalizedMessages = splitModelResponseIntoMessages(currentResponseText, assistantMsgId, { isInnerVoice: isInnerVoiceRequest });
      const finalHistory = [...newHistory, ...finalizedMessages];
      setHistory(finalHistory);
      activeAssistantMessageIdRef.current = null;

      const autoMomentResult = await maybeAutoPublishMoment({
        userText: userMsg.text,
        assistantText: currentResponseText,
        finalHistory,
        recentContext: {
          recentMessages: finalHistory.slice(-6).map(message => ({
            role: message.role,
            text: message.text,
            timestamp: message.timestamp,
          })),
          recentMomentPublishedAt: lastMomentPublishAtRef.current,
          now: Date.now(),
        },
        activeConfig,
        character,
        masks,
        worldBook,
      });

      if (autoMomentResult.shouldPublish && autoMomentResult.momentContent) {
        console.info('[moment-auto] publish', {
          characterId: character.id,
          characterName: character.name,
          triggerType: autoMomentResult.triggerType,
          reason: autoMomentResult.reason,
          momentContent: autoMomentResult.momentContent,
        });
        onPublishMoment?.({
          authorId: character.id,
          content: autoMomentResult.momentContent,
        });
        lastMomentPublishAtRef.current = Date.now();
      }

      const finalHistoryLength = finalHistory.length;
      if (
        character.autoSummaryEnabled && 
        character.summaryInterval && 
        finalHistoryLength > 0 && 
        finalHistoryLength % character.summaryInterval === 0
      ) {
        try {
          const ai = new GoogleGenAI({ apiKey: apiKey || '' });
          const summaryHistoryWindow = getSummaryHistoryWindow(finalHistory, character.memoryLimit);
          const prompt = buildSummaryPrompt({
            mode: 'small',
            characterCore: {
              characterSetting: character.setting,
            },
            memoryContext: {
              memorySummary: character.memorySummary?.trim() || '',
            },
            sections: [
              summaryHistoryWindow.map(msg => `${msg.role === 'user' ? '用户' : character.name}: ${getMessageMainText(msg)}`).join('\n')
            ],
          });

          const response = await ai.models.generateContent({
            model: activeConfig.model || 'gemini-3-flash-preview',
            contents: prompt,
          });

          if (response.text) {
            onUpdateCharacter({ ...character, memorySummary: response.text });
          }
        } catch (error) {
          console.error('Auto-summarize failed:', error);
        }
      }
    } catch (error: any) {
      if (activeGenerationIdRef.current !== generationId) {
        return;
      }
      console.error('Chat error:', error);
      setHistory([...newHistory, { role: 'model', text: `错误: ${error.message}`, timestamp: Date.now() }]);
    } finally {
      if (activeGenerationIdRef.current === generationId) {
        setIsLoading(false);
        activeAssistantMessageIdRef.current = null;
      }
    }
  };

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

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

  const activeBackground = character.background || visualSettings?.chat?.background;
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
          className={`${headerClasses} justify-between`}
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
          className={`${headerClasses} justify-between`}
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
              <img src={character.avatar} alt={character.name} className="w-9 h-9 rounded-full object-cover bg-zinc-100 border border-zinc-200/50" />
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
                <img 
                  src={character.avatar} 
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
                {visualSettings?.chat?.avatarFrameUrl && (
                  <img 
                    src={visualSettings.chat.avatarFrameUrl} 
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
                  ...(visualSettings?.chat?.messageBackgroundImageUrl ? { backgroundImage: `url(${visualSettings.chat.messageBackgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', border: 'none' } : {}),
                  ...(character.bubbleImage ? { backgroundImage: `url(${character.bubbleImage})`, backgroundSize: 'cover', backgroundPosition: 'center', border: 'none' } : character.bubbleColor ? { backgroundColor: character.bubbleColor } : {}),
                  ...(visualSettings?.chat?.bubbleStyleCss ? JSON.parse(visualSettings.chat.bubbleStyleCss || '{}') : {})
                }}
              >
                <p className="text-[14px] text-zinc-800 leading-relaxed whitespace-pre-wrap">{character.openingRemark}</p>
              </div>
            </div>
          </div>
        </div>

        {history.map((msg, i) => {
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
                     className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${selectedMessages.has(i) ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-300 bg-white'}`}
                   >
                     {selectedMessages.has(i) && <Check size={12} strokeWidth={3} />}
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
                      <img 
                        src={character.avatar} 
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
                      {visualSettings?.chat?.avatarFrameUrl && (
                        <img 
                          src={visualSettings.chat.avatarFrameUrl} 
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
                      <img 
                        src={userAvatar} 
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
                      {visualSettings?.chat?.avatarFrameUrl && (
                        <img 
                          src={visualSettings.chat.avatarFrameUrl} 
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
                                      ...(visualSettings?.chat?.messageBackgroundImageUrl
                                        ? {
                                            backgroundImage: `url(${visualSettings.chat.messageBackgroundImageUrl})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            border: 'none'
                                          }
                                        : {}),
                                      ...(msg.role === 'model' && character.bubbleImage
                                        ? {
                                            backgroundImage: `url(${character.bubbleImage})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            border: 'none'
                                          }
                                        : msg.role === 'model' && character.bubbleColor
                                        ? { backgroundColor: character.bubbleColor }
                                        : {}),
                                      ...(msg.role === 'user' && character.userBubbleImage
                                        ? {
                                            backgroundImage: `url(${character.userBubbleImage})`,
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
                                      <img src={msg.sharedPost.authorAvatar} className="w-5 h-5 rounded-full object-cover" />
                                      <span className="text-xs text-zinc-500">{msg.sharedPost.authorName}</span>
                                    </div>
                                    <h4 className="font-bold text-sm text-zinc-900 mb-1 line-clamp-1">{msg.sharedPost.title}</h4>
                                    <p className="text-xs text-zinc-600 line-clamp-2 mb-2">{msg.sharedPost.content}</p>
                                    {msg.sharedPost.images && msg.sharedPost.images.length > 0 && (
                                      <div className="aspect-video rounded-lg overflow-hidden bg-zinc-100">
                                        <img src={msg.sharedPost.images[0]} className="w-full h-full object-cover" />
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
                                <div 
                                  onClick={(e) => {
                                    if (multiSelectMode) {
                                      handleMessageClick(e, i);
                                    } else {
                                      if (msg.transferStatus !== 'received') {
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
                                  className={`w-60 rounded-xl overflow-hidden shadow-sm cursor-pointer active:opacity-90 transition-opacity ${msg.transferStatus === 'received' ? 'opacity-60' : ''}`}
                                >
                                  <div className={`${msg.transferStatus === 'received' ? 'bg-[#FBC48A]' : 'bg-[#FA9D3B]'} p-3.5 flex items-center gap-3`}>
                                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white shrink-0">
                                      {msg.transferStatus === 'received' ? <Check size={24} /> : <Banknote size={24} />}
                                    </div>
                                    <div className="flex flex-col text-white min-w-0">
                                      <span className="text-[16px] font-bold">¥{amount}</span>
                                      <span className="text-[12px] opacity-80 truncate">
                                        {msg.transferStatus === 'received' 
                                          ? (msg.role === 'user' ? '对方已收钱' : '已收钱')
                                          : (msg.role === 'user' ? `转账给 ${character.name}` : `转账给 ${userName}`)
                                        }
                                      </span>
                                    </div>
                                  </div>
                                  <div className="bg-white p-2 border border-zinc-100 border-t-0">
                                    <span className="text-[10px] text-zinc-400 ml-1">微信转账</span>
                                  </div>
                                </div>
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
              <img src={character.avatar} className="w-8 h-8 rounded-full object-cover mt-0.5 shrink-0" />
              <div 
                className="border rounded-2xl rounded-tl-none px-4 py-2.5 shadow-sm"
                style={{
                  backgroundColor: `rgba(255, 255, 255, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`,
                  borderColor: `rgba(228, 228, 231, ${activeBackground ? (visualSettings?.chatOpacity ?? 0.9) : 1})`,
                  ...(character.bubbleImage ? { backgroundImage: `url(${character.bubbleImage})`, backgroundSize: 'cover', backgroundPosition: 'center', border: 'none' } : character.bubbleColor ? { backgroundColor: character.bubbleColor } : {})
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
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
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
                    handleSend();
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
              onClick={handleSend}
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
                                  // Send sticker as a message
                                  const userMsg: ChatMessage = { role: 'user', text: `[表情包]`, timestamp: Date.now() };
                                  setHistory([...history, userMsg]);
                                  setShowStickerPanel(false);
                                  
                                  // Trigger AI response
                                  setTimeout(() => {
                                    setInput('[发送了一个表情]');
                                    handleSend();
                                  }, 100);
                                }}
                                className="aspect-square rounded-lg overflow-hidden border border-zinc-100 hover:border-blue-300 transition-colors"
                              >
                                <img src={sticker} className="w-full h-full object-cover" />
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
                      const userMsg: ChatMessage = { role: 'user', text: `[使用道具：倾听Ta的心声]`, timestamp: Date.now(), isInnerVoice: true };
                      setHistory([...history, userMsg]);
                      setShowFunPanel(false);
                      // Trigger AI response for inner voice
                      setTimeout(() => {
                        // We simulate sending a message to trigger the AI
                        handleSend('[倾听心声]');
                      }, 100);
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
                    // Simulate getting real location
                    const loc = {
                      name: '我的当前位置',
                      address: '成都市锦江区春熙路',
                      isVirtual: false
                    };
                    setShowLocationPicker(false);
                    handleSendRef.current('[分享位置]', loc);
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
                    handleSendRef.current(`[分享位置] ${loc.name}`, {
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
                backgroundImage: `url(${character.avatar})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
            
            {/* Header */}
            <div className="relative z-10 w-full pt-16 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/20 mb-4 shadow-2xl">
                <img src={character.avatar} className="w-full h-full object-cover" />
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
                <span className="text-3xl font-bold text-zinc-900 mb-1">¥</span>
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
                          {card.bankName} ({card.number.slice(-4)}) - 余额: ¥{card.balance.toFixed(2)}
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
                    if (transferAmount && !isNaN(Number(transferAmount))) {
                       const amount = parseFloat(transferAmount);
                       if (transferType === 'toCharacter') {
                         if (!selectedCardId) {
                           alert('请选择支付卡片');
                           return;
                         }
                         const cards = walletData?.cards || MOCK_CARDS;
                         const card = cards.find(c => c.id === selectedCardId);
                         if (!card || card.balance < amount) {
                           alert('余额不足');
                           return;
                         }
                         
                         // Deduct from wallet
                         const newCards = cards.map(c => c.id === selectedCardId ? { ...c, balance: c.balance - amount } : c);
                         const newTransaction = {
                           id: `t-${Date.now()}`,
                           title: `转账给 ${character.name}`,
                           type: 'expense' as const,
                           amount: amount,
                           date: '刚刚',
                           icon: 'transfer',
                           category: '转账',
                           cardId: selectedCardId
                         };
                         const newTransactions = [newTransaction, ...(walletData?.transactions || MOCK_TRANSACTIONS)];
                         if (onUpdateWalletData) {
                           onUpdateWalletData({ cards: newCards, transactions: newTransactions });
                         }

                         handleSend(`[转账 ${transferAmount}]`);
                       } else {
                         const modelMsg: ChatMessage = { role: 'model', text: `[转账 ${transferAmount}]`, timestamp: Date.now() };
                         setHistory([...history, modelMsg]);
                       }
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
        {contextMenu && (
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
                {history[contextMenu.index].role === 'user' && !history[contextMenu.index].isRecalled && (
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
                  title={history[contextMenu.index].isFavorited ? '取消收藏' : '收藏'}
                >
                  <Star size={20} fill={history[contextMenu.index].isFavorited ? "currentColor" : "none"} className={history[contextMenu.index].isFavorited ? "text-yellow-400" : ""} />
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
                    <img src={thread.avatar} alt="" className="w-full h-full object-cover" />
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
                <img src={selectedThread?.avatar} alt="" className="w-full h-full object-cover" />
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

  const handleDeleteConfig = () => {
    if (editingConfigId === 'default') return;
    if (confirm('确定要删除此配置吗？')) {
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
          <div className="pt-10 pb-3 px-4 flex items-center justify-between z-10 bg-[#f7f7f9]">
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
          <div className="pt-10 pb-3 px-4 flex items-center justify-between z-10 bg-white">
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


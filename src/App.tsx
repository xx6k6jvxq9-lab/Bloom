import React, { Suspense, lazy, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Wifi, ChevronLeft, ChevronRight, Send, Settings, Trash2, Plus, Check, X, Cpu, Pencil, Save, Link2, Key, RefreshCw, ChevronDown, Image as ImageIcon, Upload, PlusCircle, Smile, Share2, Banknote, Heart, Mic, Keyboard, Copy, Star, Reply, MoreHorizontal, CheckCircle, Search, MessageSquarePlus, MessageCircle, ScanEye, Phone, PhoneOff, MapPin, Gamepad2, Coffee, Moon, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AppData, Mask, FavoriteMessage, VisualSettings, UserProfileExtended, WorldBookEntry,
  Character, ChatMessage, PerceptionSettings,
  ApiConfig, AppSettings, CallRecord, DateSession, WalletData, WidgetConfig, DesktopIconConfig
} from './types';
import { WorldBookManager } from './components/main/WorldBookManager';
import { HomeScreen } from './components/home/HomeScreen/Page';
import { CharacterMomentsProfile, CharacterProfile } from './components/main/ContactsShell/Page';
import { MainApp } from './components/main/MainAppShell/Page';
import { MomentsApp } from './components/moments/Page';
import { ChatSessionMount } from './features/chat-session/ChatSessionMount';
import { createCharacterDirectory } from './features/character-domain/useCharacterDirectory';
import {
  DEFAULT_DESKTOP_WALLPAPER,
  DEFAULT_HOME_ICONS,
  DEFAULT_HOME_WIDGETS,
  DEFAULT_NAV_BAR_BACKGROUND,
  DEFAULT_ZHOU_JIBAI_AVATAR,
} from './features/app-shell/defaultAppConstants';
import {
  AppPanelFallback as AppPanelFallbackPrimitive,
  GlobalStyles,
  ResolvedAssetImage as ResolvedAssetImagePrimitive,
} from './features/app-shell/AppShellPrimitives';
import type {
  CoupleSpaceUpdateToast,
  IdleWindow,
  MomentPublishToast,
  UserProfile,
} from './features/app-shell/appShellTypes';
import { createAppShellHandlers } from './features/app-shell/appShellHandlers';
import { formatMessagePreview } from './features/app-shell/formatMessagePreview';
import {
  fetchSettingsModels,
  filterAvailableModels,
  fetchAllPagedModelNames,
  extractModelNamesFromResponse,
  resolveNextModelsPageUrl,
  testSettingsConnection,
} from './features/app-shell/settingsModelHelpers';
import {
  loadCoupleSpaceApp,
  loadCustomizationApp,
  loadForumApp,
  loadMonitorApp,
  loadMusicApp,
  loadPerceptionView,
  loadWalletApp,
} from './features/app-shell/lazyApps';
import { ChatSettingsPanel } from './components/chat/ChatSettingsPanel';
import { DreamAppPage } from './components/dream/Page';
import { DatingModal } from './components/dating/DatingModal';
import { GameCenter } from './components/games/GameCenter';
import { GameCard } from './components/chat/GameCard';
import { AppSelect } from './components/shared/AppSelect';
import { SettingsApp as SettingsAppScreen } from './components/settings/SettingsApp';
import { streamTextWithConfig } from './services/ai/runtimeClient';
import { buildChatPrompt } from './services/ai/prompts/builders/buildChatPrompt';
import { buildSummaryPrompt } from './services/ai/prompts/builders/buildSummaryPrompt';
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
import { APP_DIALOG_EVENT, extractImageUrls, getMessageMainText, getSummaryHistoryWindow, showInAppConfirm, type AppDialogRequest } from './utils';
import { STORAGE_KEYS } from './features/persistence/storageKeys';
import { loadCharacters, resetCharacters } from './features/persistence/charactersStore';
import {
  DEFAULT_MOMENTS,
  getPersistableAppData as getPersistableAppDataFromStore,
  hydratePersistedCharacters as hydratePersistedCharactersFromStore,
  sanitizeChatGroupsWithCharacters as sanitizeChatGroupsWithCharactersFromStore,
  sanitizePersistedCharacters as sanitizePersistedCharactersFromStore,
  sanitizePersistedMoments as sanitizePersistedMomentsFromStore,
} from './features/persistence/appDataSanitizers';
import { usePersistedCharactersBridge } from './features/persistence/usePersistedCharactersBridge';
import { clearPersistedVisualSettings, loadPersistedVisualSettings, persistVisualSettings } from './features/persistence/visualSettingsStore';
import { buildThemeScopedCss } from './features/theme/themeScopedCss';
import { useResolvedThemeTypographyCss } from './features/theme/useResolvedThemeTypographyCss';
import { getThemeSelectedFontStack } from './features/theme/themeTypography';
import { loadChatHistoryRecords, mergeGroupSessionsIntoChatGroups } from './features/persistence/chatHistoryStore';
import { sanitizeTransientAssetValue } from './features/persistence/sanitizeTransientAssetValue';
import { AddCharacterSheet } from './components/main/AddCharacterSheet';
import { patchCharacterById, replaceCharacters, updateCharacterById, upsertCharacter } from './features/character-domain/characterMutations';
import { createDefaultCoupleSpaceInitiativeSettings } from './services/ai/couple-space/initiative/coupleSpaceTriggerPolicy';
import { runCoupleSpaceInitiativeAutoCheck } from './services/ai/couple-space/initiative/runCoupleSpaceInitiativeAutoCheck';
import { evaluateCoupleSpaceInitiativeAutoCheckGate } from './services/ai/couple-space/initiative/coupleSpaceInitiativeAutoCheckGate';
import { applyCoupleSpaceInitiativeRunResult } from './services/ai/couple-space/initiative/coupleSpaceInitiativeResultApplier';
import {
  acceptCoupleSpaceInviteState,
  createDefaultCoupleSpaceData,
  createDefaultCoupleSpaceState,
  hydratePersistedCoupleSpacePayload,
  hydrateCoupleSpaceState,
  resolveCoupleSpaceState,
  resolveCurrentCoupleSpace,
  switchCurrentCoupleSpaceState,
  updatePartnerCoupleSpaceState,
  updateCurrentCoupleSpaceState,
} from './features/persistence/coupleSpaceStore';

const PANEL_PRELOAD_LOADERS: Array<() => Promise<unknown>> = [];

const MonitorApp = lazy(loadMonitorApp);
const CustomizationApp = lazy(loadCustomizationApp);
const CoupleSpaceApp = lazy(loadCoupleSpaceApp);
const PerceptionView = lazy(loadPerceptionView);
const MusicApp = lazy(loadMusicApp);
const ForumApp = lazy(loadForumApp);
const WalletApp = lazy(loadWalletApp);

const DEFAULT_CHARACTERS: Character[] = [
  {
    id: 'char-2',
    name: '林策',
    gender: 'male',
    avatar: '',
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
  sharedStickers: [],
  showChatTimeDividers: true,
  showChatMessageTime: true,
};

export default function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeApp, setActiveApp] = useState<'home' | 'chat' | 'settings' | 'chat-session' | 'add-character' | 'dream' | 'character-profile' | 'character-moments' | 'worldbook' | 'monitor' | 'customization' | 'couple-space' | 'perception' | 'music' | 'forum' | 'wallet' | 'group-chat-session'>('home');
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
    characters: sanitizePersistedCharactersFromStore(
      DEFAULT_CHARACTERS,
      DEFAULT_CHARACTERS,
      DEFAULT_ZHOU_JIBAI_AVATAR,
    ),
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
      themeTypography: {
        importedFonts: [],
        selectedFontId: '',
        fontPriority: 'lock-imported',
        textColor: '#18181b',
        previewText: '晚风轻轻吹过，气泡、标题和正文都应该有自己的气质。',
      },
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
      globalCss: '',
      themeScopedCss: {},
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
  const hasPrefetchedPanelChunksRef = useRef(false);
  const [appDialog, setAppDialog] = useState<AppDialogRequest | null>(null);
  const [appDialogInput, setAppDialogInput] = useState('');
  const [coupleSpaceUpdateToast, setCoupleSpaceUpdateToast] = useState<CoupleSpaceUpdateToast | null>(null);
  const [momentPublishToast, setMomentPublishToast] = useState<MomentPublishToast | null>(null);
  const [useDesktopStageLayout, setUseDesktopStageLayout] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    const isAndroid = /Android/i.test(window.navigator.userAgent || '');
    if (isAndroid) {
      root.setAttribute('data-android', 'true');
    } else {
      root.removeAttribute('data-android');
    }

    const updateViewportHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty('--app-viewport-height', `${Math.round(viewportHeight)}px`);
    };

    updateViewportHeight();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', updateViewportHeight);
    viewport?.addEventListener('scroll', updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);

    return () => {
      viewport?.removeEventListener('resize', updateViewportHeight);
      viewport?.removeEventListener('scroll', updateViewportHeight);
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      root.style.removeProperty('--app-viewport-height');
      root.removeAttribute('data-android');
    };
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined' || hasPrefetchedPanelChunksRef.current) {
      return undefined;
    }

    const idleWindow = window as IdleWindow;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isIosLike = /iphone|ipad|ipod/.test(userAgent);
    const preloadDelayMs = isIosLike && isStandalone ? 3200 : 900;
    const idleTimeoutMs = isIosLike && isStandalone ? 4000 : 1800;

    if (!isStandalone && !isIosLike) {
      return undefined;
    }

    hasPrefetchedPanelChunksRef.current = true;
    let cancelled = false;
    let fallbackHandle: number | null = null;

    const preloadHighTrafficPanels = async () => {
      for (const loadPanel of PANEL_PRELOAD_LOADERS) {
        if (cancelled) {
          return;
        }

        try {
          await loadPanel();
        } catch (error) {
          console.warn('Panel preload failed', error);
        }
      }
    };

    const schedulePreload = () => {
      fallbackHandle = window.setTimeout(() => {
        if (!cancelled) {
          void preloadHighTrafficPanels();
        }
      }, preloadDelayMs);
    };

    let idleHandle: number | null = null;
    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleHandle = idleWindow.requestIdleCallback(schedulePreload, { timeout: idleTimeoutMs });
    } else {
      schedulePreload();
    }

    return () => {
      cancelled = true;
      if (fallbackHandle !== null) {
        window.clearTimeout(fallbackHandle);
      }
      if (idleHandle !== null && typeof idleWindow.cancelIdleCallback === 'function') {
        idleWindow.cancelIdleCallback(idleHandle);
      }
    };
  }, []);
  const coupleSpaceAutoGateRef = React.useRef<Record<string, { lastCheckedAt: number | null; lastPartnerId: string | null }>>({});
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

  const activeConfig = useMemo(
    () => settings.configs.find((config) => config.id === settings.activeConfigId) ?? settings.configs[0] ?? DEFAULT_CONFIG,
    [settings.activeConfigId, settings.configs],
  );

  useEffect(() => {
    const savedSettings = localStorage.getItem('ai_phone_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.configs && Array.isArray(parsed.configs)) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...parsed,
            sharedStickers: Array.isArray(parsed.sharedStickers)
              ? parsed.sharedStickers.filter((item: unknown): item is string => typeof item === 'string')
              : [],
          });
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
        const characters = sanitizePersistedCharactersFromStore(
          loadCharacters(parsed.characters || DEFAULT_CHARACTERS),
          DEFAULT_CHARACTERS,
          DEFAULT_ZHOU_JIBAI_AVATAR,
        );
        const persistedChatHistory = loadChatHistoryRecords();
        const { coupleSpaceState, coupleSpace } = hydratePersistedCoupleSpacePayload(
          parsed.coupleSpaceState ?? parsed.coupleSpace ?? null,
        );
        const chatGroups = mergeGroupSessionsIntoChatGroups(
          sanitizeChatGroupsWithCharactersFromStore(parsed.chatGroups || [], characters),
          persistedChatHistory.groupSessions,
        );
        setAppData({
          ...parsed,
          characters,
          chatHistory: parsed.chatHistory || {},
          userProfile: parsed.userProfile
            ? {
                ...parsed.userProfile,
                avatar: sanitizeTransientAssetValue(parsed.userProfile.avatar),
              }
            : parsed.userProfile,
          worldBooks: parsed.worldBooks || [],
          moments: sanitizePersistedMomentsFromStore(parsed.moments),
          groups: parsed.groups || ['家人', '朋友', '同事', '星标'],
          chatGroups,
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
    localStorage.setItem(STORAGE_KEYS.appData, JSON.stringify(getPersistableAppDataFromStore(appData)));
  }, [appData, hasHydratedStorage]);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    persistVisualSettings(appData.visualSettings);
  }, [appData.visualSettings, hasHydratedStorage]);

  usePersistedCharactersBridge(appData.characters, setCharacters, {
    hydrate: (source, fallback) =>
      hydratePersistedCharactersFromStore(source, fallback, DEFAULT_ZHOU_JIBAI_AVATAR),
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

  useEffect(() => {
    if (!coupleSpaceUpdateToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCoupleSpaceUpdateToast(null);
    }, 4500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [coupleSpaceUpdateToast]);

  useEffect(() => {
    if (!momentPublishToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMomentPublishToast(null);
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [momentPublishToast]);

  useEffect(() => {
    if (!hasHydratedStorage || activeApp === 'couple-space') {
      return;
    }

    let cancelled = false;

    const runBackgroundCoupleSpaceChecks = async () => {
      const resolvedState = resolveCoupleSpaceState(appData.coupleSpaceState, appData.coupleSpace);
      const spaces = resolvedState.spacesByPartnerId || {};

      for (const [partnerId, coupleSpace] of Object.entries(spaces)) {
        const partner = getCharacterById(partnerId);
        if (!partner) {
          continue;
        }

        const now = Date.now();
        const gateResult = evaluateCoupleSpaceInitiativeAutoCheckGate({
          now,
          partnerId,
          previousState: coupleSpaceAutoGateRef.current[partnerId],
        });
        coupleSpaceAutoGateRef.current[partnerId] = gateResult.nextState;

        if (!gateResult.allowed) {
          continue;
        }

        try {
          const result = await runCoupleSpaceInitiativeAutoCheck({
            user: appData.userProfile,
            partner,
            coupleSpace,
            chatHistory: appData.chatHistory,
            masks: appData.masks,
            worldBooks: appData.worldBooks,
            appSettings: settings,
            now,
          });

          if (cancelled) {
            return;
          }

          const applied = applyCoupleSpaceInitiativeRunResult(
            result.nextCoupleSpace,
            result.runResult,
            'auto_check',
            now,
          );

          if (applied.nextCoupleSpace !== coupleSpace) {
            setAppData((prev) => {
              const next = updatePartnerCoupleSpaceState(
                prev.coupleSpaceState,
                prev.coupleSpace,
                partnerId,
                applied.nextCoupleSpace,
              );
              return {
                ...prev,
                coupleSpaceState: next.coupleSpaceState,
                coupleSpace: next.coupleSpace,
              };
            });
          }

          if (applied.updatedModuleLabel) {
            setCoupleSpaceUpdateToast({
              id: `${partnerId}-${now}`,
              partnerId,
              partnerName: partner.name,
              partnerAvatar: partner.avatar,
              moduleLabel: applied.updatedModuleLabel,
            });
          }
        } catch (error) {
          console.error('Background couple-space auto check failed:', error);
        }
      }
    };

    void runBackgroundCoupleSpaceChecks();
    const intervalId = window.setInterval(() => {
      void runBackgroundCoupleSpaceChecks();
    }, 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    activeApp,
    appData.chatHistory,
    appData.characters,
    appData.coupleSpace,
    appData.coupleSpaceState,
    appData.userProfile,
    getCharacterById,
    hasHydratedStorage,
    settings,
  ]);

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

  const { handleAddCharacter, handleOpenApp, handleOpenChat } = createAppShellHandlers({
    handleUpsertCharacter,
    setActiveApp,
    setActiveTab,
    setSelectedCharacterId,
  });
  const { generatedCss: themeTypographyCss } = useResolvedThemeTypographyCss(appData.visualSettings?.themeTypography);
  const appFontFamily = getThemeSelectedFontStack(appData.visualSettings?.themeTypography);

  return (
    <div
      className={`app-shell relative bg-black font-sans selection:bg-blue-500/30 ${
        useDesktopStageLayout ? 'md:flex md:min-h-screen md:items-center md:justify-center md:bg-zinc-950 md:p-4' : ''
      }`}
      style={appFontFamily ? { fontFamily: appFontFamily } : undefined}
    >
      <GlobalStyles
        customCss={`${appData.visualSettings?.globalCss || ''}\n${buildThemeScopedCss(appData.visualSettings?.themeScopedCss)}\n${themeTypographyCss}`}
      />
      {/* Phone Container */}
      <div
        id="phone-container"
        className={`app-phone-container relative flex h-full w-full flex-col overflow-hidden bg-zinc-50 ring-0 ${
          useDesktopStageLayout
            ? 'md:h-[720px] md:w-[360px] md:rounded-[50px] md:border-[8px] md:border-white md:bg-black md:shadow-2xl md:ring-1 md:ring-black/5'
            : ''
        }`}
        style={appFontFamily ? { fontFamily: appFontFamily } : undefined}
      >
        
        {/* Status Bar */}
        {statusBarVisible && activeApp !== 'wallet' && activeApp !== 'forum' && activeApp !== 'monitor' && activeApp !== 'dream' && !window.matchMedia?.('(display-mode: standalone)')?.matches && (
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
          {coupleSpaceUpdateToast && (
            <button
              type="button"
              onClick={() => {
                setAppData((prev) => {
                  const switched = switchCurrentCoupleSpaceState(
                    prev.coupleSpaceState,
                    prev.coupleSpace,
                    coupleSpaceUpdateToast.partnerId,
                  );
                  return {
                    ...prev,
                    coupleSpaceState: switched.coupleSpaceState,
                    coupleSpace: switched.coupleSpace,
                  };
                });
                setActiveApp('couple-space');
                setCoupleSpaceUpdateToast(null);
              }}
              className="absolute left-4 right-4 top-4 z-[70] rounded-3xl border border-white/70 bg-white/92 p-4 text-left shadow-lg backdrop-blur-md"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 overflow-hidden rounded-2xl bg-[#fff3f7]">
                  {coupleSpaceUpdateToast.partnerAvatar ? (
                    <ResolvedAssetImagePrimitive
                      value={coupleSpaceUpdateToast.partnerAvatar}
                      alt={coupleSpaceUpdateToast.partnerName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#d99ab5]">
                      <Heart size={18} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-zinc-400">情侣空间</div>
                  <div className="mt-0.5 text-sm font-bold text-zinc-800">
                    {coupleSpaceUpdateToast.partnerName} 更新了{coupleSpaceUpdateToast.moduleLabel}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    点开看看这次的新内容
                  </div>
                </div>
              </div>
            </button>
          )}
          {momentPublishToast && (
            <button
              type="button"
              onClick={() => {
                setActiveApp('chat');
                setActiveTab('moments');
                setMomentPublishToast(null);
              }}
              className={`absolute left-4 right-4 ${coupleSpaceUpdateToast ? 'top-[98px]' : 'top-4'} z-[69] rounded-3xl border border-white/70 bg-white/92 p-4 text-left shadow-lg backdrop-blur-md`}
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 overflow-hidden rounded-2xl bg-zinc-100">
                  {momentPublishToast.authorAvatar ? (
                    <ResolvedAssetImagePrimitive
                      value={momentPublishToast.authorAvatar}
                      alt={momentPublishToast.authorName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-500">
                      <ImageIcon size={18} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-zinc-400">角色动态</div>
                  <div className="mt-0.5 text-sm font-bold text-zinc-800">
                    {momentPublishToast.authorName} 发布了一条动态
                  </div>
                  <div className="mt-1 truncate text-xs text-zinc-500">
                    {momentPublishToast.preview || '点开看看这次的新内容'}
                  </div>
                </div>
              </div>
            </button>
          )}
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
              appData={appData}
              setAppData={setAppData}
              settings={settings}
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
            setChatGroups={(chatGroupsOrUpdater) => setAppData((prev) => {
              const resolvedChatGroups =
                typeof chatGroupsOrUpdater === 'function'
                  ? chatGroupsOrUpdater(prev.chatGroups || [])
                  : chatGroupsOrUpdater;

              return {
                ...prev,
                chatGroups: sanitizeChatGroupsWithCharactersFromStore(resolvedChatGroups, prev.characters),
              };
            })}
            chatHistory={appData.chatHistory}
            setChatHistory={(chatHistory) => setAppData(prev => ({ ...prev, chatHistory }))}
            settings={settings}
            setSettings={setSettings}
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
            onPublishMoment={({ authorId, content, images, imageCard }) => {
              const author = getCharacterById(authorId);
              console.info('[moment-special] onPublishMoment called', {
                authorId,
                content,
                imagesCount: images?.length || 0,
                hasImageCard: !!imageCard,
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
                  imageCard,
                  timestamp: Date.now(),
                  likes: 0,
                  comments: []
                }, ...(prev.moments || [])]
              }));
              if (author) {
                setMomentPublishToast({
                  id: `${authorId}-${Date.now()}`,
                  authorId,
                  authorName: author.name,
                  authorAvatar: author.avatar,
                  preview: content.slice(0, 26),
                });
              }
            }}
            onOpenCharacterMoments={() => {
              setCharacterMomentsBackApp('chat-session');
              setActiveApp('character-moments');
            }}
            onStatusBarVisibilityChange={setStatusBarVisible}
            onAcceptCoupleSpaceInvite={handleAcceptCoupleSpaceInvite}
          />
          {activeApp === 'add-character' && (
            <AddCharacterSheet
              key="add-character"
              onSave={handleAddCharacter}
              onBack={() => setActiveApp('chat')}
              groups={appData.groups}
            />
          )}
          {activeApp === 'settings' && (
            <SettingsAppScreen 
              key="settings" 
              onBack={() => setActiveApp('home')} 
              settings={settings}
              defaultConfig={DEFAULT_CONFIG}
              setSettings={(s) => {
                setSettings(s);
                localStorage.setItem('ai_phone_settings', JSON.stringify(s));
              }}
            />
          )}
          {activeApp === 'dream' && (
            <DreamAppPage
              key="dream"
              onBack={() => setActiveApp('home')}
              characters={appData.characters}
              userName={appData.userProfile.name}
              activeConfig={activeConfig}
              masks={appData.masks || []}
              worldBooks={appData.worldBooks || []}
            />
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
            <Suspense fallback={<AppPanelFallbackPrimitive label="监控中心" />}>
              <MonitorApp 
                characters={appData.characters}
                onBack={() => setActiveApp('home')}
                visualSettings={appData.visualSettings}
              />
            </Suspense>
          )}
          {activeApp === 'customization' && (
            <Suspense fallback={<AppPanelFallbackPrimitive label="自定义中心" />}>
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
                      characters: sanitizePersistedCharactersFromStore(
                        parsed.characters,
                        DEFAULT_CHARACTERS,
                        DEFAULT_ZHOU_JIBAI_AVATAR,
                      ),
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
            </Suspense>
          )}
          {activeApp === 'couple-space' && (
            <Suspense fallback={<AppPanelFallbackPrimitive label="情侣空间" />}>
              <CoupleSpaceApp
                appData={appData}
                setAppData={setAppData}
                onBack={() => setActiveApp('home')}
                settings={settings}
              />
            </Suspense>
          )}
          {activeApp === 'perception' && (
            <Suspense fallback={<AppPanelFallbackPrimitive label="感知视图" />}>
              <PerceptionView
                coupleSpace={currentCoupleSpace}
                updateSpace={handleUpdateCurrentCoupleSpace}
                onBack={() => setActiveApp('home')}
              />
            </Suspense>
          )}
          <audio
            ref={audioRef}
            preload="auto"
            playsInline
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            aria-hidden="true"
          />
          {activeApp === 'music' && (
            <Suspense fallback={<AppPanelFallbackPrimitive label="音乐" />}>
              <MusicApp
                musicData={appData.musicData!}
                onUpdateMusicData={(data) => setAppData(prev => ({ ...prev, musicData: data }))}
                userAvatar={appData.userProfile.avatar}
                userName={appData.userProfile.name}
                character={couplePartnerCharacter}
                directChatHistory={appData.chatHistory}
                visualSettings={appData.visualSettings}
                settings={settings}
                onPatchCharacter={handlePatchCharacterById}
                allCharacters={appData.characters}
                onBack={() => setActiveApp('home')}
                audioRef={audioRef}
              />
            </Suspense>
          )}
          {activeApp === 'forum' && (
            <Suspense fallback={<AppPanelFallbackPrimitive label="论坛" />}>
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
            </Suspense>
          )}
          {activeApp === 'wallet' && (
            <Suspense fallback={<AppPanelFallbackPrimitive label="钱包" />}>
              <WalletApp
                appData={appData}
                onUpdateAppData={(newData) => setAppData(prev => ({ ...prev, ...newData }))}
                onClose={() => setActiveApp('home')}
              />
            </Suspense>
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
          className="app-home-indicator-wrap absolute bottom-0 left-0 right-0 z-50 flex justify-center bg-transparent pb-2 pt-0"
        >
          <div
            className="app-home-indicator h-[4px] w-[100px] cursor-pointer rounded-full bg-white/80 transition-colors hover:bg-white"
            onClick={() => setActiveApp('home')}
          />
        </div>
      </div>
    </div>
  );
}

function AddCharacter({ onSave, onBack, groups }: { onSave: (char: Character) => void; onBack: () => void; groups: string[]; key?: string }) {
  const CHARACTER_FIELD_LIMITS = {
    name: 32,
    remarkName: 32,
    setting: 6000,
    signature: 200,
    openingRemark: 300,
    avatar: 4000,
    importText: 20000,
  } as const;

  const MAX_CHARACTER_IMPORT_FILE_SIZE = 512 * 1024;

  const clampText = (value: unknown, max: number) => {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, max);
  };

  const normalizeImportedGender = (value: unknown): 'male' | 'female' | 'other' => {
    if (typeof value !== 'string') return 'other';
    const normalized = value.trim().toLowerCase();
    if (['male', 'man', 'm', '男'].includes(normalized)) return 'male';
    if (['female', 'woman', 'f', '女'].includes(normalized)) return 'female';
    return 'other';
  };

  const appendSectionValue = (target: Record<string, string>, key: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    target[key] = target[key] ? `${target[key]}\n${trimmed}` : trimmed;
  };

  const mapImportKey = (rawKey: string): string | null => {
    const key = rawKey
      .replace(/^#+\s*/, '')
      .replace(/[：:]\s*$/, '')
      .trim()
      .toLowerCase();

    if (['name', '角色名', '角色姓名', '姓名', '名字'].includes(key)) return 'name';
    if (['remarkname', 'remark', '备注', '备注名', '称呼'].includes(key)) return 'remarkName';
    if (['gender', '性别'].includes(key)) return 'gender';
    if (['avatar', '头像', '头像链接', '头像地址'].includes(key)) return 'avatar';
    if (['setting', 'persona', 'profile', '角色设定', '设定', '人设'].includes(key)) return 'setting';
    if (['signature', '个性签名', '签名'].includes(key)) return 'signature';
    if (['openingremark', 'opening', '开场白', '第一句话'].includes(key)) return 'openingRemark';
    if (['group', 'groupid', '分组'].includes(key)) return 'groupId';
    return null;
  };

  const parseLooseCharacterImport = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error('导入内容为空');

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fallback to labeled text/markdown parsing.
    }

    const sections: Record<string, string> = {};
    let currentKey: string | null = null;

    trimmed.split(/\r?\n/).forEach((line) => {
      const cleaned = line.trim();
      if (!cleaned) return;

      const headingLike = cleaned.replace(/^[-*]\s*/, '');
      const headingKey = mapImportKey(headingLike);
      if (headingKey && !/[：:]/.test(headingLike)) {
        currentKey = headingKey;
        return;
      }

      const pairMatch = cleaned.match(/^#{0,6}\s*([^：:]+)\s*[：:]\s*(.*)$/);
      if (pairMatch) {
        const mapped = mapImportKey(pairMatch[1]);
        if (mapped) {
          currentKey = mapped;
          appendSectionValue(sections, mapped, pairMatch[2]);
          return;
        }
      }

      if (currentKey) {
        appendSectionValue(sections, currentKey, cleaned);
      } else {
        appendSectionValue(sections, 'setting', cleaned);
      }
    });

    if (!sections.name) {
      throw new Error('缺少角色姓名');
    }

    return sections;
  };

  const buildImportedCharacter = (raw: string) => {
    const data = parseLooseCharacterImport(raw);
    const nameValue = clampText(data.name, CHARACTER_FIELD_LIMITS.name);
    if (!nameValue) throw new Error('缺少角色姓名');

    return {
      id: Date.now().toString(),
      name: nameValue,
      remarkName: clampText(data.remarkName, CHARACTER_FIELD_LIMITS.remarkName) || undefined,
      gender: normalizeImportedGender(data.gender),
      avatar: clampText(data.avatar, CHARACTER_FIELD_LIMITS.avatar),
      setting: clampText(data.setting, CHARACTER_FIELD_LIMITS.setting),
      signature: clampText(data.signature, CHARACTER_FIELD_LIMITS.signature) || undefined,
      openingRemark: clampText(data.openingRemark, CHARACTER_FIELD_LIMITS.openingRemark),
      groupId: clampText(data.groupId, CHARACTER_FIELD_LIMITS.remarkName) || undefined,
    } satisfies Character;
  };

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
      name: name.trim().slice(0, CHARACTER_FIELD_LIMITS.name),
      remarkName: remarkName.trim().slice(0, CHARACTER_FIELD_LIMITS.remarkName) || undefined,
      gender,
      avatar: avatar.trim().slice(0, CHARACTER_FIELD_LIMITS.avatar),
      setting: setting.slice(0, CHARACTER_FIELD_LIMITS.setting),
      signature: signature.trim().slice(0, CHARACTER_FIELD_LIMITS.signature) || undefined,
      openingRemark: openingRemark.slice(0, CHARACTER_FIELD_LIMITS.openingRemark),
      groupId: groupId || undefined,
    });
  };

  const handleImport = () => {
    try {
      onSave(buildImportedCharacter(importJson));
    } catch (e: any) {
      alert('导入失败: ' + e.message);
    }
  };

  const handleImportFile = (file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_CHARACTER_IMPORT_FILE_SIZE) {
      alert('导入失败: 文件过大，请控制在 512KB 以内。');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result || '');
        setImportJson(raw.slice(0, CHARACTER_FIELD_LIMITS.importText));
        onSave(buildImportedCharacter(raw));
      } catch (e: any) {
        alert('导入失败: ' + e.message);
      }
    };
    reader.readAsText(file);
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
              <ResolvedAssetImagePrimitive value={avatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover bg-zinc-100 border-4 border-zinc-50 shadow-sm" />

              <div className="w-full max-w-[320px] space-y-3">
                <p className="text-[12px] text-zinc-400 text-center">支持链接、Markdown或HTML图片</p>
                <input
                  type="text"
                  placeholder="输入头像链接..."
                  value={avatarDraft}
                  onChange={e => setAvatarDraft(e.target.value.slice(0, CHARACTER_FIELD_LIMITS.avatar))}
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
                    className="bg-zinc-100 border border-zinc-200 text-zinc-800 text-[14px] py-3 rounded-xl font-semibold active:opacity-90"
                  >
                    确认
                  </button>
                  <label className="bg-zinc-50 text-zinc-700 text-[14px] py-3 rounded-xl font-medium text-center cursor-pointer border border-zinc-200 active:opacity-80">
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
                  onChange={e => setName(e.target.value.slice(0, CHARACTER_FIELD_LIMITS.name))}
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
                  onChange={e => setRemarkName(e.target.value.slice(0, CHARACTER_FIELD_LIMITS.remarkName))}
                  placeholder="例如：阿白、学长、小周"
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-zinc-900 transition-colors"
                />
                <p className="text-[12px] text-zinc-400 text-right">{remarkName.length}/{CHARACTER_FIELD_LIMITS.remarkName}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">性别</label>
                <div className="flex gap-2">
                  {(['male', 'female', 'other'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                    className={`flex-1 py-2.5 rounded-xl text-[14px] font-medium border transition-all ${gender === g ? 'bg-zinc-100 border-zinc-200 text-zinc-800' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}
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
                  onChange={e => setSetting(e.target.value.slice(0, CHARACTER_FIELD_LIMITS.setting))}
                  placeholder="写这个角色是谁、怎么说话、关系气质和核心设定..."
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-zinc-900 transition-colors min-h-[120px] resize-none"
                />
                <p className="text-[12px] text-zinc-400 ml-1">先写完整设定，后续可在设置里细化。</p>
                <p className="text-[12px] text-zinc-400 text-right">{setting.length}/{CHARACTER_FIELD_LIMITS.setting}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">个性签名</label>
                <textarea
                  value={signature}
                  onChange={e => setSignature(e.target.value.slice(0, CHARACTER_FIELD_LIMITS.signature))}
                  placeholder="这个角色在资料页里显示的一句签名..."
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-zinc-900 transition-colors min-h-[80px] resize-none"
                />
                <p className="text-[12px] text-zinc-400 text-right">{signature.length}/{CHARACTER_FIELD_LIMITS.signature}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">开场白</label>
                <textarea 
                  value={openingRemark}
                  onChange={e => setOpeningRemark(e.target.value.slice(0, CHARACTER_FIELD_LIMITS.openingRemark))}
                  placeholder="角色对你说的第一句话..."
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-zinc-900 transition-colors min-h-[80px] resize-none"
                />
                <p className="text-[12px] text-zinc-400 text-right">{openingRemark.length}/{CHARACTER_FIELD_LIMITS.openingRemark}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500 ml-1">分组</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setGroupId('')}
                    className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${!groupId ? 'bg-zinc-100 border-zinc-200 text-zinc-800' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}
                  >
                    无分组
                  </button>
                  {groups.map(g => (
                    <button
                      key={g}
                      onClick={() => setGroupId(g)}
                      className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${groupId === g ? 'bg-zinc-100 border-zinc-200 text-zinc-800' : 'bg-zinc-50 border-zinc-100 text-zinc-500'}`}
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
                  onChange={e => setImportJson(e.target.value.slice(0, CHARACTER_FIELD_LIMITS.importText))}
                  placeholder={'{"name": "角色名", "setting": "角色设定", ...}\n\n或使用文本 / Markdown：\n角色名：阿白\n性别：男\n角色设定：...\n个性签名：...\n开场白：...'}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-[13px] font-mono outline-none focus:border-blue-500 transition-colors min-h-[300px] resize-none"
                />
              </div>
            <div className="space-y-3 px-1">
              <p className="text-[12px] text-zinc-400">
                支持 `JSON / TXT / Markdown`。文本格式可用“字段名：内容”的方式导入。
              </p>
              <p className="text-[12px] text-zinc-400 text-right">
                {importJson.length}/{CHARACTER_FIELD_LIMITS.importText}
              </p>
              <label className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-zinc-200 text-zinc-600 text-[14px] font-medium active:bg-zinc-50 cursor-pointer">
                <Upload size={18} />
                从文件导入（JSON / TXT / MD）
                <input
                  type="file"
                  accept=".json,.txt,.md,application/json,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleImportFile(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              <p className="text-[12px] text-zinc-400">
                为了避免本地存储爆掉，单个导入文件目前限制在 512KB 以内。
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

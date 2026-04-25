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
import { DEFAULT_CHARACTERS } from './features/app-shell/defaultCharacters';
import {
  DEFAULT_CONFIG,
  DEFAULT_SETTINGS,
  DEFAULT_USER,
} from './features/app-shell/defaultSettings';
import { createDefaultAppData } from './features/app-shell/defaultAppData';
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
import {
  handleCustomizationExportData,
  handleCustomizationImportData,
  handleCustomizationResetData,
  handleCustomizationUpdateAppData,
} from './features/app-shell/customizationHandlers';
import { useAppDialogBridge } from './features/app-shell/useAppDialogBridge';
import { useAutoDismissToast } from './features/app-shell/useAutoDismissToast';
import { useCoupleSpaceAutoChecks } from './features/app-shell/useCoupleSpaceAutoChecks';
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
  CoupleSpaceApp,
  CustomizationApp,
  ForumApp,
  MonitorApp,
  MusicApp,
  PANEL_PRELOAD_LOADERS,
  PerceptionView,
  WalletApp,
} from './features/app-shell/lazyPanels';
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
import { extractImageUrls, getMessageMainText, getSummaryHistoryWindow, showInAppConfirm } from './utils';
import { STORAGE_KEYS } from './features/persistence/storageKeys';
import { loadCharacters } from './features/persistence/charactersStore';
import { bootstrapLocalAppState } from './features/persistence/bootstrapLocalAppState';
import {
  DEFAULT_MOMENTS,
  getPersistableAppData as getPersistableAppDataFromStore,
  hydratePersistedCharacters as hydratePersistedCharactersFromStore,
  sanitizeChatGroupsWithCharacters as sanitizeChatGroupsWithCharactersFromStore,
  sanitizePersistedCharacters as sanitizePersistedCharactersFromStore,
  sanitizePersistedMoments as sanitizePersistedMomentsFromStore,
} from './features/persistence/appDataSanitizers';
import { usePersistedCharactersBridge } from './features/persistence/usePersistedCharactersBridge';
import { loadPersistedVisualSettings, persistVisualSettings } from './features/persistence/visualSettingsStore';
import { buildThemeScopedCss } from './features/theme/themeScopedCss';
import { useResolvedThemeTypographyCss } from './features/theme/useResolvedThemeTypographyCss';
import { getThemeSelectedFontStack } from './features/theme/themeTypography';
import { loadChatHistoryRecords, mergeGroupSessionsIntoChatGroups } from './features/persistence/chatHistoryStore';
import { sanitizeTransientAssetValue } from './features/persistence/sanitizeTransientAssetValue';
import { AddCharacterSheet } from './components/main/AddCharacterSheet';
import { patchCharacterById, replaceCharacters, updateCharacterById, upsertCharacter } from './features/character-domain/characterMutations';
import { createDefaultCoupleSpaceInitiativeSettings } from './services/ai/couple-space/initiative/coupleSpaceTriggerPolicy';
import {
  acceptCoupleSpaceInviteState,
  createDefaultCoupleSpaceData,
  createDefaultCoupleSpaceState,
  hydratePersistedCoupleSpacePayload,
  hydrateCoupleSpaceState,
  resolveCurrentCoupleSpace,
  switchCurrentCoupleSpaceState,
  updateCurrentCoupleSpaceState,
} from './features/persistence/coupleSpaceStore';

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
  const [appData, setAppData] = useState<AppData>(() => createDefaultAppData());
  const hasPrefetchedPanelChunksRef = useRef(false);
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
    const bootstrapped = bootstrapLocalAppState({
      createDefaultAppData,
      defaultCharacters: DEFAULT_CHARACTERS,
      defaultConfig: DEFAULT_CONFIG,
      defaultDesktopWallpaper: DEFAULT_DESKTOP_WALLPAPER,
      defaultSettings: DEFAULT_SETTINGS,
      defaultUser: DEFAULT_USER,
      defaultZhouJibaiAvatar: DEFAULT_ZHOU_JIBAI_AVATAR,
    });

    setSettings(bootstrapped.settings);
    setAppData(bootstrapped.appData);
    if (bootstrapped.migratedSettings) {
      localStorage.setItem('ai_phone_settings', JSON.stringify(bootstrapped.migratedSettings));
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

  useAutoDismissToast(coupleSpaceUpdateToast, setCoupleSpaceUpdateToast, 4500);
  useAutoDismissToast(momentPublishToast, setMomentPublishToast, 4200);
  useCoupleSpaceAutoChecks({
    activeApp,
    appData,
    hasHydratedStorage,
    setAppData,
    setCoupleSpaceUpdateToast,
    settings,
  });

  const {
    appDialog,
    appDialogInput,
    closeAppDialog,
    handleDialogConfirm,
    setAppDialogInput,
  } = useAppDialogBridge();

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
                onResetData={handleCustomizationResetData}
                onExportData={() => handleCustomizationExportData(appData)}
                onImportData={(data) =>
                  handleCustomizationImportData({
                    data,
                    defaultCharacters: DEFAULT_CHARACTERS,
                    defaultZhouJibaiAvatar: DEFAULT_ZHOU_JIBAI_AVATAR,
                    setAppData,
                  })
                }
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
                onUpdateAppData={(newData) => handleCustomizationUpdateAppData(newData, setAppData)}
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
                onUpdateAppData={(newData) => handleCustomizationUpdateAppData(newData, setAppData)}
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


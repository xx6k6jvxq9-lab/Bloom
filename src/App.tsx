import React, { Suspense, lazy, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { startTransition } from 'react';
import { Wifi, ChevronLeft, ChevronRight, Send, Settings, Trash2, Plus, Check, X, Cpu, Pencil, Save, Link2, Key, RefreshCw, ChevronDown, Upload, PlusCircle, Smile, Share2, Banknote, Mic, Keyboard, Copy, Star, Reply, MoreHorizontal, CheckCircle, Search, MessageSquarePlus, MessageCircle, ScanEye, Phone, PhoneOff, MapPin, Gamepad2, Coffee, Moon, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mask, FavoriteMessage, VisualSettings, UserProfileExtended, WorldBookEntry,
  ChatMessage, PerceptionSettings,
  ApiConfig, CallRecord, DateSession, WalletData, WidgetConfig, DesktopIconConfig
} from './types';
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
import { GlobalStyles } from './features/app-shell/AppShellPrimitives';
import { ForumLaunchOverlay } from './features/app-shell/ForumLaunchOverlay';
import type {
  CoupleSpaceUpdateToast,
  DatingGenerationToast,
  DreamGenerationToast,
  MomentPublishToast,
} from './features/app-shell/appShellTypes';
import { AppScreenContent } from './features/app-shell/AppScreenContent';
import { createAppShellHandlers, navigateToAppWithTransition, type AppScreen, type AppTab } from './features/app-shell/appShellHandlers';
import { preloadPanelForApp } from './features/app-shell/lazyPanels';
import { useAppEnvironment } from './features/app-shell/useAppEnvironment';
import { useAppDialogBridge } from './features/app-shell/useAppDialogBridge';
import { useAutoDismissToast } from './features/app-shell/useAutoDismissToast';
import { useCoupleSpaceAutoChecks } from './features/app-shell/useCoupleSpaceAutoChecks';
import { DatingModal } from './components/dating/DatingModal';
import { GameCenter } from './components/games/GameCenter';
import { GameCard } from './components/chat/GameCard';
import { AppSelect } from './components/shared/AppSelect';
import { streamTextWithConfig } from './services/ai/runtimeClient';
import { DATING_BACKGROUND_EVENT } from './services/dating/datingBackgroundEvents';
import { DREAM_BACKGROUND_EVENT, DREAM_BACKGROUND_TOAST_READY_EVENT } from './services/dream/dreamBackgroundGeneration';
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
import { DEFAULT_MOMENTS } from './features/persistence/appDataSanitizers';
import { useAppPersistence } from './features/persistence/useAppPersistence';
import { useCoupleSpaceStateActions } from './features/persistence/useCoupleSpaceStateActions';
import { buildThemeScopedCss } from './features/theme/themeScopedCss';
import { useResolvedThemeTypographyCss } from './features/theme/useResolvedThemeTypographyCss';
import { getThemeSelectedFontStack } from './features/theme/themeTypography';
import { getDisplayableAssetValue, getPreviewAssetValue } from './features/persistence/persistentAssetRef';
import { useResolvedPersistentValue } from './features/persistence/useResolvedPersistentValue';
import { useCharacterStateActions } from './features/character-domain/useCharacterStateActions';
import { createDefaultCoupleSpaceInitiativeSettings } from './services/ai/couple-space/initiative/coupleSpaceTriggerPolicy';
import {
  hydrateCoupleSpaceState,
  resolveCurrentCoupleSpace,
} from './features/persistence/coupleSpaceStore';

type ForumLaunchState = {
  token: number;
  ready: boolean;
  entering: boolean;
  targetPostId: string | null;
};

export default function App() {
  const activeAppRef = useRef<AppScreen>('home');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const forumLaunchTokenRef = useRef(0);
  const forumLaunchEnterTimerRef = useRef<number | null>(null);
  const forumLaunchDismissFrameRef = useRef<number | null>(null);
  const [activeApp, setActiveApp] = useState<AppScreen>('home');
  const [datingResumeSignal, setDatingResumeSignal] = useState(0);
  const [dreamResumeSignal, setDreamResumeSignal] = useState(0);
  const [datingGenerationToast, setDatingGenerationToast] = useState<DatingGenerationToast | null>(null);
  const [dreamGenerationToast, setDreamGenerationToast] = useState<DreamGenerationToast | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('chat');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedForumPostId, setSelectedForumPostId] = useState<string | null>(null);
  const [forumLaunchState, setForumLaunchState] = useState<ForumLaunchState | null>(null);
  const [characterMomentsBackApp, setCharacterMomentsBackApp] = useState<'chat' | 'chat-session' | 'character-profile'>('character-profile');
  const [statusBarVisible, setStatusBarVisible] = useState(true);
  const [coupleSpaceUpdateToast, setCoupleSpaceUpdateToast] = useState<CoupleSpaceUpdateToast | null>(null);
  const [momentPublishToast, setMomentPublishToast] = useState<MomentPublishToast | null>(null);
  const {
    isStandalone,
    keyboardVisible,
    layoutViewportHeight,
    time,
    useDesktopStageLayout,
    visualViewportHeight,
  } = useAppEnvironment();
  const {
    appData,
    hasHydratedStorage,
    shouldShowHydrationFallback,
    setAppData,
    setSettings,
    settings,
  } = useAppPersistence({
    createDefaultAppData,
    defaultCharacters: DEFAULT_CHARACTERS,
    defaultConfig: DEFAULT_CONFIG,
    defaultDesktopWallpaper: DEFAULT_DESKTOP_WALLPAPER,
    defaultSettings: DEFAULT_SETTINGS,
    defaultUser: DEFAULT_USER,
    defaultZhouJibaiAvatar: DEFAULT_ZHOU_JIBAI_AVATAR,
  });
  const { getCharacterById } = createCharacterDirectory({ characters: appData.characters });
  const selectedCharacter = getCharacterById(selectedCharacterId);
  const currentCoupleSpace = resolveCurrentCoupleSpace(appData.coupleSpaceState, appData.coupleSpace);
  const couplePartnerId = appData.coupleSpaceState?.currentPartnerId ?? currentCoupleSpace.partnerId;
  const couplePartnerCharacter = getCharacterById(couplePartnerId) || appData.characters[0] || DEFAULT_CHARACTERS[0];
  const { handleMergeCharacter, handlePatchCharacterById, handleUpsertCharacter } = useCharacterStateActions(setAppData);
  const { handleAcceptCoupleSpaceInvite, handleUpdateCurrentCoupleSpace } = useCoupleSpaceStateActions(setAppData);

  const activeConfig = useMemo(
    () => settings.configs.find((config) => config.id === settings.activeConfigId) ?? settings.configs[0] ?? DEFAULT_CONFIG,
    [settings.activeConfigId, settings.configs],
  );

  useAutoDismissToast(coupleSpaceUpdateToast, setCoupleSpaceUpdateToast, 4500);
  useAutoDismissToast(momentPublishToast, setMomentPublishToast, 4200);
  useAutoDismissToast(datingGenerationToast, setDatingGenerationToast, 5200);
  useAutoDismissToast(dreamGenerationToast, setDreamGenerationToast, 5200);
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

  const clearForumLaunchTimer = useCallback(() => {
    if (forumLaunchEnterTimerRef.current !== null) {
      window.clearTimeout(forumLaunchEnterTimerRef.current);
      forumLaunchEnterTimerRef.current = null;
    }
  }, []);

  const clearForumLaunchDismissFrame = useCallback(() => {
    if (forumLaunchDismissFrameRef.current !== null) {
      window.cancelAnimationFrame(forumLaunchDismissFrameRef.current);
      forumLaunchDismissFrameRef.current = null;
    }
  }, []);

  const closeForumLaunch = useCallback(() => {
    forumLaunchTokenRef.current += 1;
    clearForumLaunchTimer();
    clearForumLaunchDismissFrame();
    setForumLaunchState(null);
  }, [clearForumLaunchDismissFrame, clearForumLaunchTimer]);

  const enterForumFromLaunch = useCallback((token: number, targetPostId: string | null) => {
    if (forumLaunchTokenRef.current !== token) {
      return;
    }

    clearForumLaunchTimer();
    setForumLaunchState((current) => current?.token === token ? { ...current, ready: true, entering: true } : current);
    startTransition(() => {
      setSelectedForumPostId(targetPostId);
      setActiveApp('forum');
    });
  }, [clearForumLaunchTimer]);

  const openForumApp = useCallback((postId?: string | null) => {
    const targetPostId = postId ?? null;
    const token = forumLaunchTokenRef.current + 1;
    forumLaunchTokenRef.current = token;
    clearForumLaunchTimer();
    setForumLaunchState({
      token,
      ready: false,
      entering: false,
      targetPostId,
    });

    const preloadTask = preloadPanelForApp('forum');
    const minimumSplashTask = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 820);
    });

    void Promise.all([preloadTask ?? Promise.resolve(), minimumSplashTask])
      .then(() => {
        if (forumLaunchTokenRef.current !== token) {
          return;
        }

        setForumLaunchState((current) => current?.token === token ? { ...current, ready: true } : current);
        forumLaunchEnterTimerRef.current = window.setTimeout(() => {
          enterForumFromLaunch(token, targetPostId);
        }, 160);
      })
      .catch((error) => {
        console.warn('[app-shell] Forum launch preload failed', error);
        if (forumLaunchTokenRef.current !== token) {
          return;
        }
        setForumLaunchState((current) => current?.token === token ? { ...current, ready: true } : current);
      });
  }, [clearForumLaunchTimer, enterForumFromLaunch]);

  useEffect(() => () => {
    clearForumLaunchTimer();
    clearForumLaunchDismissFrame();
  }, [clearForumLaunchDismissFrame, clearForumLaunchTimer]);

  useEffect(() => {
    if (activeApp !== 'forum' || !forumLaunchState?.entering) {
      return undefined;
    }

    clearForumLaunchDismissFrame();
    forumLaunchDismissFrameRef.current = window.requestAnimationFrame(() => {
      forumLaunchDismissFrameRef.current = window.requestAnimationFrame(() => {
        setForumLaunchState((current) => (
          current?.token === forumLaunchState.token && current.entering
            ? null
            : current
        ));
        forumLaunchDismissFrameRef.current = null;
      });
    });

    return () => {
      clearForumLaunchDismissFrame();
    };
  }, [activeApp, clearForumLaunchDismissFrame, forumLaunchState]);

  const { handleAddCharacter, handleOpenApp, handleOpenChat } = createAppShellHandlers({
    handleUpsertCharacter,
    openForumApp,
    setActiveApp,
    setActiveTab,
    setSelectedCharacterId,
  });
  const { generatedCss: themeTypographyCss } = useResolvedThemeTypographyCss(appData.visualSettings?.themeTypography);
  const appFontFamily = getThemeSelectedFontStack(appData.visualSettings?.themeTypography);
  const { resolvedUrl: resolvedHomeWallpaperUrl } = useResolvedPersistentValue(appData.visualSettings?.globalBackground);
  const homeWallpaperDisplayUrl =
    getDisplayableAssetValue(appData.visualSettings?.globalBackground, resolvedHomeWallpaperUrl)
    || getPreviewAssetValue(appData.visualSettings?.globalBackgroundPreviewUrl);
  const isStorageReady = hasHydratedStorage;
  const appChromeBackground = activeApp === 'home' || activeApp === 'dream' ? '#09090b' : '#f8fafc';
  const phoneContainerBackgroundClass =
    activeApp === 'home' || activeApp === 'dream'
      ? 'bg-black'
      : 'bg-zinc-50';
  const browserKeyboardViewportCollapsed = !isStandalone
    && visualViewportHeight > 0
    && layoutViewportHeight > 0
    && visualViewportHeight < layoutViewportHeight - 40;
  const hideMockSystemChrome = !useDesktopStageLayout && !isStandalone && (keyboardVisible || browserKeyboardViewportCollapsed);
  const appSafeAreaBottomFull = 'env(safe-area-inset-bottom, 0px)';
  const appSafeAreaBottomUi = isStandalone
    ? 'env(safe-area-inset-bottom, 0px)'
    : hideMockSystemChrome
      ? '0px'
      : '12px';
  const homeWallpaperBackgroundStyle =
    activeApp === 'home' && homeWallpaperDisplayUrl
      ? {
          backgroundImage: `url(${homeWallpaperDisplayUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {};
  const shellWallpaperBackgroundStyle = useDesktopStageLayout ? {} : homeWallpaperBackgroundStyle;
  const phoneContainerStyle = {
    ...(appFontFamily ? { fontFamily: appFontFamily } : {}),
    backgroundColor: appChromeBackground,
    ...homeWallpaperBackgroundStyle,
    '--app-safe-area-bottom-full': appSafeAreaBottomFull,
    '--app-safe-area-bottom': appSafeAreaBottomFull,
    '--app-safe-area-bottom-ui': appSafeAreaBottomUi,
    '--app-mock-home-indicator-space': !isStandalone && !hideMockSystemChrome ? '12px' : '0px',
  } as React.CSSProperties & Record<string, string>;

  const loadPendingDreamToast = () => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem('dream_background_toast_pending');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { taskId?: string; title?: string; roleName?: string; roleId?: string; roleAvatar?: string; shouldNotify?: boolean } | null;
      if (!parsed?.taskId || !parsed?.roleId) return;
      setDreamGenerationToast({
        id: parsed.taskId,
        roleId: parsed.roleId,
        roleName: parsed.roleName || '角色',
        roleAvatar: parsed.roleAvatar,
        title: parsed.title || '梦境已生成',
        preview: `${parsed.roleName || '角色'} 的梦已经织好，点开继续进入。`,
      });
    } catch {
      // ignore malformed toast cache
    }
  };

  useEffect(() => {
    activeAppRef.current = activeApp;
  }, [activeApp]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const rootElement = document.getElementById('root');
    const previousHtmlBackground = html.style.backgroundColor;
    const previousBodyBackground = body.style.backgroundColor;
    const previousRootBackground = rootElement?.style.backgroundColor ?? '';

    html.style.backgroundColor = appChromeBackground;
    body.style.backgroundColor = appChromeBackground;
    if (rootElement) {
      rootElement.style.backgroundColor = appChromeBackground;
    }

    return () => {
      html.style.backgroundColor = previousHtmlBackground;
      body.style.backgroundColor = previousBodyBackground;
      if (rootElement) {
        rootElement.style.backgroundColor = previousRootBackground;
      }
    };
  }, [appChromeBackground]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleDreamBackgroundEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ kind: string; taskId: string; title: string; roleName: string; roleId: string; roleAvatar?: string; shouldNotify?: boolean }>).detail;
      if (!detail || detail.kind !== 'completed') {
        return;
      }

      loadPendingDreamToast();

      if (!detail.shouldNotify) {
        return;
      }

      setDreamGenerationToast({
        id: detail.taskId,
        roleId: detail.roleId,
        roleName: detail.roleName,
        roleAvatar: detail.roleAvatar,
        title: detail.title || '梦境已生成',
        preview: `${detail.roleName} 的梦已经织好，点开继续进入。`,
      });
    };

    const handleDreamToastReady = () => {
      loadPendingDreamToast();
    };

    loadPendingDreamToast();
    window.addEventListener(DREAM_BACKGROUND_EVENT, handleDreamBackgroundEvent as EventListener);
    window.addEventListener(DREAM_BACKGROUND_TOAST_READY_EVENT, handleDreamToastReady as EventListener);
    return () => {
      window.removeEventListener(DREAM_BACKGROUND_EVENT, handleDreamBackgroundEvent as EventListener);
      window.removeEventListener(DREAM_BACKGROUND_TOAST_READY_EVENT, handleDreamToastReady as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const refreshPendingDreamToast = () => {
      loadPendingDreamToast();
    };

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        refreshPendingDreamToast();
      }
    };

    window.addEventListener('focus', refreshPendingDreamToast);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);
    refreshPendingDreamToast();
    return () => {
      window.removeEventListener('focus', refreshPendingDreamToast);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, [activeApp]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleDatingBackgroundEvent = (event: Event) => {
      const detail = (event as CustomEvent<{
        kind: string;
        characterId: string;
        characterName: string;
        characterAvatar?: string;
        scenario: string;
      }>).detail;

      if (!detail || detail.kind !== 'completed') {
        return;
      }

      setDatingGenerationToast({
        id: `${detail.characterId}-${Date.now()}`,
        characterId: detail.characterId,
        characterName: detail.characterName,
        characterAvatar: detail.characterAvatar,
        preview: detail.scenario || '约会已生成完成',
      });
    };

    window.addEventListener(DATING_BACKGROUND_EVENT, handleDatingBackgroundEvent as EventListener);
    return () => {
      window.removeEventListener(DATING_BACKGROUND_EVENT, handleDatingBackgroundEvent as EventListener);
    };
  }, []);

  return (
    <div
      className={`app-shell relative bg-black font-sans selection:bg-blue-500/30 ${
        useDesktopStageLayout ? 'md:flex md:min-h-screen md:items-center md:justify-center md:bg-zinc-950 md:p-4' : ''
      }`}
      style={{
        ...(appFontFamily ? { fontFamily: appFontFamily } : {}),
        backgroundColor: appChromeBackground,
        ...shellWallpaperBackgroundStyle,
      }}
    >
      <GlobalStyles
        customCss={`${appData.visualSettings?.globalCss || ''}\n${buildThemeScopedCss(appData.visualSettings?.themeScopedCss)}\n${themeTypographyCss}`}
      />
      {/* Phone Container */}
      <div
        id="phone-container"
        className={`app-phone-container relative flex h-full w-full flex-col overflow-hidden ${phoneContainerBackgroundClass} ring-0 ${
          useDesktopStageLayout
            ? 'md:h-[720px] md:w-[360px] md:rounded-[50px] md:border-[8px] md:border-white md:bg-black md:shadow-2xl md:ring-1 md:ring-black/5'
            : ''
        }`}
        style={phoneContainerStyle}
      >
        
        {/* Status Bar */}
        {statusBarVisible && activeApp !== 'wallet' && activeApp !== 'forum' && activeApp !== 'monitor' && activeApp !== 'dream' && !isStandalone && !hideMockSystemChrome && (
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
        {isStorageReady || !shouldShowHydrationFallback ? (
          <AppScreenContent
            activeApp={activeApp}
            activeConfig={activeConfig}
            activeTab={activeTab}
            appData={appData}
            audioRef={audioRef}
            characterMomentsBackApp={characterMomentsBackApp}
            couplePartnerCharacter={couplePartnerCharacter}
            coupleSpaceUpdateToast={coupleSpaceUpdateToast}
            currentCoupleSpace={currentCoupleSpace}
            datingGenerationToast={datingGenerationToast}
            datingResumeSignal={datingResumeSignal}
            dreamGenerationToast={dreamGenerationToast}
            dreamResumeSignal={dreamResumeSignal}
            handleAcceptCoupleSpaceInvite={handleAcceptCoupleSpaceInvite}
            handleAddCharacter={handleAddCharacter}
            handleMergeCharacter={handleMergeCharacter}
            handleOpenApp={handleOpenApp}
            handleOpenChat={handleOpenChat}
            handlePatchCharacterById={handlePatchCharacterById}
            handleUpdateCurrentCoupleSpace={handleUpdateCurrentCoupleSpace}
            handleUpsertCharacter={handleUpsertCharacter}
            momentPublishToast={momentPublishToast}
            selectedCharacter={selectedCharacter}
            selectedCharacterId={selectedCharacterId}
            selectedForumPostId={selectedForumPostId}
            selectedGroupId={selectedGroupId}
            setActiveApp={setActiveApp}
            setActiveTab={setActiveTab}
            setAppData={setAppData}
            setCharacterMomentsBackApp={setCharacterMomentsBackApp}
            setCoupleSpaceUpdateToast={setCoupleSpaceUpdateToast}
            setMomentPublishToast={setMomentPublishToast}
            setSelectedCharacterId={setSelectedCharacterId}
            setSelectedForumPostId={setSelectedForumPostId}
            setSelectedGroupId={setSelectedGroupId}
            setSettings={setSettings}
            setStatusBarVisible={setStatusBarVisible}
            settings={settings}
            openForumApp={openForumApp}
            onOpenReadyDating={(characterId) => {
              setSelectedCharacterId(characterId);
              setDatingResumeSignal((prev) => prev + 1);
              navigateToAppWithTransition('chat-session', setActiveApp);
              setDatingGenerationToast(null);
            }}
            onDismissDatingToast={() => setDatingGenerationToast(null)}
            onOpenReadyDream={() => {
              setDreamResumeSignal((prev) => prev + 1);
              navigateToAppWithTransition('dream', setActiveApp);
              if (typeof window !== 'undefined') {
                window.localStorage.removeItem('dream_background_toast_pending');
              }
              setDreamGenerationToast(null);
            }}
            onDismissDreamToast={() => {
              if (typeof window !== 'undefined') {
                window.localStorage.removeItem('dream_background_toast_pending');
              }
              setDreamGenerationToast(null);
            }}
            onDreamResumeHandled={() => setDreamResumeSignal(0)}
          />
        ) : (
          <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-zinc-50 px-8 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
            <div className="mt-5 text-[16px] font-semibold text-zinc-900">正在读取本地数据</div>
            <div className="mt-2 text-[13px] leading-6 text-zinc-500">
              请稍等片刻，等历史角色和聊天记录恢复后再继续操作。
            </div>
          </div>
        )}

        <ForumLaunchOverlay
          visible={forumLaunchState != null}
          ready={forumLaunchState?.ready ?? false}
          time={time}
          onEnter={() => {
            if (!forumLaunchState) {
              return;
            }
            enterForumFromLaunch(forumLaunchState.token, forumLaunchState.targetPostId);
          }}
          onCancel={closeForumLaunch}
        />

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
        {!isStandalone && !hideMockSystemChrome && (
          <div
            className="app-home-indicator-wrap absolute bottom-0 left-0 right-0 z-50 flex justify-center bg-transparent pb-2 pt-0"
          >
            <div
              className="app-home-indicator h-[4px] w-[100px] cursor-pointer rounded-full bg-white/80 transition-colors hover:bg-white"
              onClick={() => navigateToAppWithTransition('home', setActiveApp)}
            />
          </div>
        )}

      </div>
    </div>
  );
}


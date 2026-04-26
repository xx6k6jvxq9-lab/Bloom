import React, { Suspense, lazy, useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import type {
  CoupleSpaceUpdateToast,
  MomentPublishToast,
} from './features/app-shell/appShellTypes';
import { AppScreenContent } from './features/app-shell/AppScreenContent';
import { createAppShellHandlers, type AppScreen, type AppTab } from './features/app-shell/appShellHandlers';
import { useAppEnvironment } from './features/app-shell/useAppEnvironment';
import { useAppDialogBridge } from './features/app-shell/useAppDialogBridge';
import { useAutoDismissToast } from './features/app-shell/useAutoDismissToast';
import { useCoupleSpaceAutoChecks } from './features/app-shell/useCoupleSpaceAutoChecks';
import {
  fetchSettingsModels,
  filterAvailableModels,
  fetchAllPagedModelNames,
  extractModelNamesFromResponse,
  resolveNextModelsPageUrl,
  testSettingsConnection,
} from './features/app-shell/settingsModelHelpers';
import { DatingModal } from './components/dating/DatingModal';
import { GameCenter } from './components/games/GameCenter';
import { GameCard } from './components/chat/GameCard';
import { AppSelect } from './components/shared/AppSelect';
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
import { DEFAULT_MOMENTS } from './features/persistence/appDataSanitizers';
import { useAppPersistence } from './features/persistence/useAppPersistence';
import { useCoupleSpaceStateActions } from './features/persistence/useCoupleSpaceStateActions';
import { buildThemeScopedCss } from './features/theme/themeScopedCss';
import { useResolvedThemeTypographyCss } from './features/theme/useResolvedThemeTypographyCss';
import { getThemeSelectedFontStack } from './features/theme/themeTypography';
import { useCharacterStateActions } from './features/character-domain/useCharacterStateActions';
import { useWechatBridgeRuntime } from './features/wechat-bridge/useWechatBridgeRuntime';
import { createDefaultCoupleSpaceInitiativeSettings } from './services/ai/couple-space/initiative/coupleSpaceTriggerPolicy';
import {
  hydrateCoupleSpaceState,
  resolveCurrentCoupleSpace,
} from './features/persistence/coupleSpaceStore';

export default function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeApp, setActiveApp] = useState<AppScreen>('home');
  const [activeTab, setActiveTab] = useState<AppTab>('chat');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedForumPostId, setSelectedForumPostId] = useState<string | null>(null);
  const [characterMomentsBackApp, setCharacterMomentsBackApp] = useState<'chat' | 'chat-session' | 'character-profile'>('character-profile');
  const [statusBarVisible, setStatusBarVisible] = useState(true);
  const [coupleSpaceUpdateToast, setCoupleSpaceUpdateToast] = useState<CoupleSpaceUpdateToast | null>(null);
  const [momentPublishToast, setMomentPublishToast] = useState<MomentPublishToast | null>(null);
  const { time, useDesktopStageLayout } = useAppEnvironment();
  const {
    appData,
    hasHydratedStorage,
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
  useCoupleSpaceAutoChecks({
    activeApp,
    appData,
    hasHydratedStorage,
    setAppData,
    setCoupleSpaceUpdateToast,
    settings,
  });
  useWechatBridgeRuntime({
    hasHydratedStorage,
    setAppData,
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
  const isStorageReady = hasHydratedStorage;

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
        {isStorageReady ? (
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
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-zinc-50 px-8 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
            <div className="mt-5 text-[16px] font-semibold text-zinc-900">正在读取本地数据</div>
            <div className="mt-2 text-[13px] leading-6 text-zinc-500">
              请稍等片刻，等历史角色和聊天记录恢复后再继续操作。
            </div>
          </div>
        )}

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


import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Settings, Heart, Calendar, BookOpen, Banknote, Edit3, Trash2, Plus, Send, Image as ImageIcon, X, MessageCircle, Archive, ArchiveRestore, Search, Pin, PinOff, Sparkles } from 'lucide-react';
import Cropper from 'react-easy-crop';
import {
  AppDataExtended,
  CoNote,
  CoupleSpaceData,
  CoupleSpaceInitiativeDraftEntry,
  LedgerEntry,
  LoveLetter,
  CalendarEvent,
  CouplePost,
} from '../../../types';
import { extractImageUrls, showInAppConfirm } from '../../../utils';
import { saveUploadedDataUrl } from '../../../features/persistence/persistentAssetService';
import { usePersistentFieldActions } from '../../../features/persistence/usePersistentFieldActions';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';
import {
  deletePartnerCoupleSpaceState,
  createDefaultCoupleSpaceData,
  resolveCurrentCoupleSpace,
  resolveCoupleSpaceState,
  switchCurrentCoupleSpaceState,
  updateCurrentCoupleSpaceState,
  updatePartnerCoupleSpaceState,
} from '../../../features/persistence/coupleSpaceStore';
import { clearCoupleSpaceCharacterMemory } from '../../../features/character-domain/clearCoupleSpaceCharacterMemory';
import { createCharacterDirectory } from '../../../features/character-domain/useCharacterDirectory';
import {
  generateCoupleCoNote,
  generateCoupleDailyComment,
  generateCoupleDailyCommentReply,
  generateCoupleLoveLetterReply,
  generateCoupleMessageBoardReply,
} from '../../../services/ai/couple-space/prompt/coupleSpacePromptService';
import { createCoupleSpacePromptCommonInput } from '../../../services/ai/couple-space/context/createCoupleSpacePromptCommonInput';
import { evaluateCoupleSpaceInitiativeAutoCheckGate } from '../../../services/ai/couple-space/initiative/coupleSpaceInitiativeAutoCheckGate';
import {
  publishCoupleSpaceInitiativeDraft,
  removeCoupleSpaceInitiativeDraft,
} from '../../../services/ai/couple-space/initiative/coupleSpaceDraftBuffer';
import {
  applyCoupleSpaceInitiativeRunResult,
  buildAppliedInitiativeStatusText,
} from '../../../services/ai/couple-space/initiative/coupleSpaceInitiativeResultApplier';
import { normalizeCoupleSpaceInitiativeSettings } from '../../../services/ai/couple-space/initiative/coupleSpaceTriggerPolicy';
import { runCoupleSpaceInitiativeAutoCheck } from '../../../services/ai/couple-space/initiative/runCoupleSpaceInitiativeAutoCheck';
import { runCoupleSpaceInitiativeManualCheck } from '../../../services/ai/couple-space/initiative/runCoupleSpaceInitiativeManualCheck';
import type { RunCoupleSpaceInitiativeCandidateResult } from '../../../services/ai/couple-space/initiative/runCoupleSpaceInitiativeCandidate';
import { runCoupleSpaceInitiativeRandomRefresh } from '../../../services/ai/couple-space/initiative/runCoupleSpaceInitiativeRandomRefresh';
import { CoupleSpaceInitiativeCheckCard } from '../settings/CoupleSpaceInitiativeCheckCard';
import { CoupleSpaceInitiativeSettingsCard } from '../settings/CoupleSpaceInitiativeSettingsCard';
import { LoveLetterDetailPage } from '../loveletters/LoveLetterDetailPage';
import { CoupleSpaceArchiveCenter } from '../archive/CoupleSpaceArchiveCenter';
import { CoupleSpaceCalendarView } from '../calendar/CoupleSpaceCalendarView';
import { CoupleSpaceInteractionCenter } from '../interaction/CoupleSpaceInteractionCenter';
import { resolveSceneTextApiConfig } from '../../../services/ai/apiCenter/resolveSceneApiConfig';
import { buildCoupleSpaceSharedSettlement } from '../../../services/couple-space/buildCoupleSpaceSharedSettlement';
import { persistSceneSettlement } from '../../../services/memory/sceneSettlement';

const CHAT_RUNTIME_BUSY_COUNT_KEY = '__bloomChatRuntimeBusyCount';
const CHAT_RUNTIME_LAST_ACTIVE_AT_KEY = '__bloomChatRuntimeLastActiveAt';
const CHAT_RUNTIME_IDLE_GRACE_MS = 4000;
const COUPLE_SPACE_AUTO_RETRY_DELAY_MS = 1800;

function isChatRuntimeBusyNow() {
  const scope = globalThis as typeof globalThis & Record<string, unknown>;
  const activeCount = typeof scope[CHAT_RUNTIME_BUSY_COUNT_KEY] === 'number'
    ? Math.max(0, scope[CHAT_RUNTIME_BUSY_COUNT_KEY] as number)
    : 0;
  if (activeCount > 0) {
    return true;
  }

  const lastActiveAt = typeof scope[CHAT_RUNTIME_LAST_ACTIVE_AT_KEY] === 'number'
    ? scope[CHAT_RUNTIME_LAST_ACTIVE_AT_KEY] as number
    : 0;
  return lastActiveAt > 0 && Date.now() - lastActiveAt < CHAT_RUNTIME_IDLE_GRACE_MS;
}

const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => (image.onload = resolve));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL('image/jpeg');
};

type ImageModalType =
  | 'background'
  | 'avatarFrameUser'
  | 'avatarFramePartner'
  | 'loveLetterEnvelopeBg'
  | 'calendarBg'
  | 'loveLetterPaperBg';

function isImageModalType(value: string | null): value is ImageModalType {
  return ['background', 'avatarFrameUser', 'avatarFramePartner', 'loveLetterEnvelopeBg', 'calendarBg', 'loveLetterPaperBg'].includes(value || '');
}

function buildCoupleSpaceImageUpdates(activeModal: ImageModalType, value: string | null) {
  const nextValue = value ?? '';
  if (activeModal === 'background') return { backgroundUrl: nextValue };
  if (activeModal === 'avatarFrameUser') return { userAvatarFrame: nextValue };
  if (activeModal === 'avatarFramePartner') return { partnerAvatarFrame: nextValue };
  if (activeModal === 'loveLetterEnvelopeBg') return { loveLetterEnvelopeBg: nextValue };
  if (activeModal === 'calendarBg') return { calendarBg: nextValue };
  return { loveLetterPaperBg: nextValue };
}

function getImageModalFileName(activeModal: ImageModalType): string {
  if (activeModal === 'background') return 'couple-space-background.jpg';
  if (activeModal === 'avatarFrameUser') return 'couple-space-user-frame.jpg';
  if (activeModal === 'avatarFramePartner') return 'couple-space-partner-frame.jpg';
  if (activeModal === 'loveLetterEnvelopeBg') return 'couple-space-envelope.jpg';
  if (activeModal === 'calendarBg') return 'couple-space-calendar.jpg';
  return 'couple-space-paper.jpg';
}

function getCoupleSpaceInteractionSettings(coupleSpace?: CoupleSpaceData | null) {
  return normalizeCoupleSpaceInitiativeSettings(coupleSpace?.initiativeSettings).interaction;
}

function getCoupleSpaceMemoSettings(coupleSpace?: CoupleSpaceData | null) {
  return normalizeCoupleSpaceInitiativeSettings(coupleSpace?.initiativeSettings).memo;
}

function ResolvedImage({
  value,
  fallbackValue,
  alt = '',
  className,
}: {
  value?: string | null;
  fallbackValue?: string | null;
  alt?: string;
  className?: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const { resolvedUrl: resolvedFallbackUrl } = useResolvedPersistentValue(fallbackValue);
  const src = resolvedUrl || resolvedFallbackUrl;

  if (!src) return null;

  return <img src={src} className={className} alt={alt} />;
}

function sortPinnedByTimestampDesc<T extends { isPinned?: boolean; timestamp: number }>(items: T[]) {
  return [...items].sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return a.isPinned ? -1 : 1;
    }
    return b.timestamp - a.timestamp;
  });
}

type Props = {
  appData: any;
  setAppData: any;
  onBack: () => void;
  settings: any;
};

export function CoupleSpaceApp({ appData, setAppData, onBack, settings }: Props) {
  const [activeView, setActiveView] = useState<'main' | 'settings' | 'conotes' | 'ledger' | 'loveletters' | 'loveletter-detail' | 'calendar' | 'anniversaries' | 'messageboard' | 'post-feed' | 'archive' | 'interaction'>('main');
  const [loveLetterReturnView, setLoveLetterReturnView] = useState<'loveletters' | 'archive'>('loveletters');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'date' | 'background' | 'avatarFrameUser' | 'avatarFramePartner' | 'deletePartner' | 'dataManagement' | 'loveLetterEnvelopeBg' | 'loveLetterEnvelopeColor' | 'loveLetterPaperTexture' | 'calendarBg' | 'loveLetterPaperBg' | null>(null);
  const [partnerToDelete, setPartnerToDelete] = useState<string | null>(null);
  const [deletePartnerMode, setDeletePartnerMode] = useState<'space_only' | 'space_and_memory'>('space_only');
  const [isPartnerManageMode, setIsPartnerManageMode] = useState(false);
  const [tempInput, setTempInput] = useState('');
  const [selectedPaperTexture, setSelectedPaperTexture] = useState<'default' | 'vintage' | 'grid' | 'floral'>('default');
  const [selectedEnvelopeColor, setSelectedEnvelopeColor] = useState('#f5e6d3');
  const [manageAction, setManageAction] = useState<'export' | 'delete'>('export');
  const [manageDataTypes, setManageDataTypes] = useState<string[]>(['posts', 'conotes', 'ledger', 'loveletters']);
  const [manageTargets, setManageTargets] = useState<string[]>(['user', 'partner']);
  const [isModuleCustomizationOpen, setIsModuleCustomizationOpen] = useState(false);
  const [isInitiativeSettingsOpen, setIsInitiativeSettingsOpen] = useState(false);
  const [isInitiativeCheckOpen, setIsInitiativeCheckOpen] = useState(false);
  const [selectedLoveLetterId, setSelectedLoveLetterId] = useState<string | null>(null);
  const [initiativeCheckBusy, setInitiativeCheckBusy] = useState(false);
  const [initiativeAutoCheckBusy, setInitiativeAutoCheckBusy] = useState(false);
  const [initiativeRefreshBusy, setInitiativeRefreshBusy] = useState(false);
  const [initiativeCheckStatus, setInitiativeCheckStatus] = useState<string | null>(null);
  const [initiativeArtifactPreview, setInitiativeArtifactPreview] = useState<{
    kind: 'draft' | 'confirmation';
    title: string;
    content: string;
    note?: string;
  } | null>(null);
  const initiativeAutoCheckGateRef = React.useRef<any>(null);
  const initiativeRequestVersionRef = React.useRef(0);
  const initiativeAutoRetryTimerRef = React.useRef<number | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [initiativeAutoCheckTick, setInitiativeAutoCheckTick] = useState(0);

  const coupleSpaceState = resolveCoupleSpaceState(appData.coupleSpaceState, appData.coupleSpace);
  const resolvedCoupleSpace = resolveCurrentCoupleSpace(coupleSpaceState, appData.coupleSpace);
  const coupleSpace = appData.perception
    ? {
        ...resolvedCoupleSpace,
        perception: appData.perception,
      }
    : resolvedCoupleSpace;

  // Ensure addedPartnerIds is initialized
  useEffect(() => {
    if (!activeModal) {
      setIsCropping(false);
      setImageToCrop(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [activeModal]);

  useEffect(() => {
    if (activeView !== 'settings') {
      setIsPartnerManageMode(false);
    }
  }, [activeView]);

  const addedPartnerIds = Object.keys(coupleSpaceState.spacesByPartnerId).length > 0
    ? Object.keys(coupleSpaceState.spacesByPartnerId)
    : (coupleSpace.addedPartnerIds || (coupleSpace.partnerId ? [coupleSpace.partnerId] : []));
  const initiativeSettings = normalizeCoupleSpaceInitiativeSettings(coupleSpace.initiativeSettings);
  const initiativeDraftEntries = coupleSpace.initiativeDrafts || [];
  const { getCharacterById, getCharactersByIds } = createCharacterDirectory({ characters: appData.characters });
  const coupleSpaceConfig = resolveSceneTextApiConfig({
    settings,
    scene: 'default',
  }).runtimeConfig;
  const partner = getCharacterById(coupleSpace.partnerId);
  const addedPartners = getCharactersByIds(addedPartnerIds);
  const selectedLoveLetter = (coupleSpace.loveLetters || []).find((letter: LoveLetter) => letter.id === selectedLoveLetterId) || null;
  const user = appData.userProfile;
  const { setRemoteUrl, clearValue } = usePersistentFieldActions();
  const { resolvedUrl: resolvedBackgroundUrl } = useResolvedPersistentValue(coupleSpace.backgroundUrl);
  const { resolvedUrl: resolvedUserAvatarUrl } = useResolvedPersistentValue(user?.avatar);
  const { resolvedUrl: resolvedPartnerAvatarUrl } = useResolvedPersistentValue(partner?.avatar);
  const { resolvedUrl: resolvedUserAvatarFrameUrl } = useResolvedPersistentValue(coupleSpace.userAvatarFrame);
  const { resolvedUrl: resolvedPartnerAvatarFrameUrl } = useResolvedPersistentValue(coupleSpace.partnerAvatarFrame);

  // Calculate days together
  const daysTogether = coupleSpace.anniversaryDate 
    ? Math.floor((Date.now() - coupleSpace.anniversaryDate) / (1000 * 60 * 60 * 24))
    : 0;

  const handleUpdateCoupleSpace = (updates: any | ((prevCoupleSpace: any) => any)) => {
    setAppData((prev: any) => {
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
  };

  const handleUpdatePartnerSpace = (
    partnerId: string,
    updates: any | ((prevCoupleSpace: any) => any),
  ) => {
    setAppData((prev: any) => {
      const { coupleSpaceState, coupleSpace } = updatePartnerCoupleSpaceState(
        prev.coupleSpaceState,
        prev.coupleSpace,
        partnerId,
        updates,
      );
      return {
        ...prev,
        coupleSpaceState,
        coupleSpace,
      };
    });
  };

  const handleDeletePartnerSpace = (
    partnerId: string,
    options?: {
      clearCharacterMemory?: boolean;
    },
  ) => {
    setAppData((prev: any) => {
      const { coupleSpaceState, coupleSpace } = deletePartnerCoupleSpaceState(
        prev.coupleSpaceState,
        prev.coupleSpace,
        partnerId,
      );
      const nextCharacters = options?.clearCharacterMemory
        ? (prev.characters || []).map((item: any) => (
            item?.id === partnerId ? clearCoupleSpaceCharacterMemory(item) : item
          ))
        : prev.characters;
      return {
        ...prev,
        characters: nextCharacters,
        coupleSpaceState,
        coupleSpace,
      };
    });
  };

  const handleRecordPartnerSettlement = async (
    partnerId: string,
    event: {
      type: 'post' | 'message_board' | 'love_letter' | 'co_note' | 'ledger' | 'comment_reply';
      content: string;
      timestamp: number;
      authorRole: 'user' | 'partner';
    },
  ) => {
    const targetCharacter = (appData.characters || []).find((item: any) => item && item.id === partnerId);
    if (!targetCharacter) {
      return;
    }

    const settlement = buildCoupleSpaceSharedSettlement(targetCharacter, event);

    try {
      const result = await persistSceneSettlement({
        characterId: targetCharacter.id,
        sourceScene: 'couple_space',
        settlement,
        timestamp: event.timestamp,
      });
      setAppData((prev: any) => ({
        ...prev,
        characters: (prev.characters || []).map((item: any) => (
          !item || item.id !== partnerId
            ? item
            : {
                ...item,
                ...result.characterPatch,
              }
        )),
      }));
    } catch (error) {
      console.error('[couple-space] Failed to persist settlement memory snapshots', error);
      alert('情侣空间记忆写入失败了，请稍后再试。');
    }
  };

  const handleUpdateInitiativeSettings = (next: typeof initiativeSettings) => {
    handleUpdateCoupleSpace({ initiativeSettings: next });
  };

  const handleSwitchCoupleSpace = (partnerId: string) => {
    setAppData((prev: any) => {
      const { coupleSpaceState, coupleSpace } = switchCurrentCoupleSpaceState(
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
  };

  const persistInitiativeDraftResult = (
    baseCoupleSpace: CoupleSpaceData,
    runResult: RunCoupleSpaceInitiativeCandidateResult | null,
    source: CoupleSpaceInitiativeDraftEntry['source'],
  ): ReturnType<typeof applyCoupleSpaceInitiativeRunResult> => {
    return applyCoupleSpaceInitiativeRunResult(
      baseCoupleSpace,
      runResult,
      source,
      Date.now(),
    );
  };

  const handlePublishInitiativeDraft = (draftId: string) => {
    if (!partner) return;

    handleUpdateCoupleSpace((prev: CoupleSpaceData) =>
      publishCoupleSpaceInitiativeDraft(prev, draftId, partner.id, Date.now()),
    );
    setInitiativeCheckStatus('这条草稿已发布到情侣空间。');
    setInitiativeArtifactPreview(null);
  };

  const handleDeleteInitiativeDraft = (draftId: string) => {
    handleUpdateCoupleSpace((prev: CoupleSpaceData) =>
      removeCoupleSpaceInitiativeDraft(prev, draftId),
    );
    setInitiativeCheckStatus('这条草稿已从草稿箱移除。');
    setInitiativeArtifactPreview(null);
  };

  const handleRefreshInitiativeContent = async () => {
    if (!partner || initiativeRefreshBusy) return;

    setIsInitiativeSettingsOpen(true);
    setIsInitiativeCheckOpen(true);
    setInitiativeRefreshBusy(true);
    try {
      const result = await runCoupleSpaceInitiativeRandomRefresh({
        user,
        partner,
        coupleSpace,
        perception: appData.perception,
        chatHistory: appData.chatHistory,
        masks: appData.masks,
        worldBooks: appData.worldBooks,
        appSettings: settings,
        now: Date.now(),
      });

      const persistedResult = applyCoupleSpaceInitiativeRunResult(
        result.nextCoupleSpace,
        result.runResult,
        'manual_check',
        Date.now(),
      );

      handleUpdateCoupleSpace(persistedResult.nextCoupleSpace);
      setInitiativeCheckStatus(buildAppliedInitiativeStatusText(result.statusText, persistedResult));
      setInitiativeArtifactPreview(result.artifactPreview);
    } catch (error) {
      console.error('Random initiative refresh failed:', error);
      setInitiativeCheckStatus('随机刷新主动内容失败，请查看控制台日志。');
      setInitiativeArtifactPreview(null);
    } finally {
      setInitiativeRefreshBusy(false);
    }
  };

  const handleManualInitiativeCheck = async () => {
    if (!partner || initiativeCheckBusy) return;

    initiativeRequestVersionRef.current += 1;
    setInitiativeCheckBusy(true);
    try {
      const result = await runCoupleSpaceInitiativeManualCheck({
        user,
        partner,
        coupleSpace,
        perception: appData.perception,
        chatHistory: appData.chatHistory,
        masks: appData.masks,
        worldBooks: appData.worldBooks,
        appSettings: settings,
        now: Date.now(),
      });

      const persistedDraftResult = persistInitiativeDraftResult(
        result.nextCoupleSpace,
        result.runResult,
        'manual_check',
      );

      handleUpdateCoupleSpace(persistedDraftResult.nextCoupleSpace);
      setInitiativeCheckStatus(buildAppliedInitiativeStatusText(result.statusText, persistedDraftResult));
      setInitiativeArtifactPreview(result.artifactPreview);
    } catch (error) {
      console.error('Manual initiative check failed:', error);
      setInitiativeCheckStatus('主动内容检查失败，请查看控制台日志。');
      setInitiativeArtifactPreview(null);
    } finally {
      setInitiativeCheckBusy(false);
    }
  };

  useEffect(() => {
    if (activeView !== 'main' || !partner) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setInitiativeAutoCheckTick((prev) => prev + 1);
    }, 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeView, partner?.id]);

  useEffect(() => {
    if (activeView !== 'main' || !partner || initiativeCheckBusy || initiativeAutoCheckBusy) {
      return;
    }

    if (isChatRuntimeBusyNow()) {
      if (initiativeAutoRetryTimerRef.current === null) {
        initiativeAutoRetryTimerRef.current = window.setTimeout(() => {
          initiativeAutoRetryTimerRef.current = null;
          setInitiativeAutoCheckTick((prev) => prev + 1);
        }, COUPLE_SPACE_AUTO_RETRY_DELAY_MS);
      }
      return;
    }

    if (initiativeAutoRetryTimerRef.current !== null) {
      window.clearTimeout(initiativeAutoRetryTimerRef.current);
      initiativeAutoRetryTimerRef.current = null;
    }

    const now = Date.now();
    const gateResult = evaluateCoupleSpaceInitiativeAutoCheckGate({
      now,
      partnerId: partner.id,
      previousState: initiativeAutoCheckGateRef.current,
    });
    initiativeAutoCheckGateRef.current = gateResult.nextState;

    if (!gateResult.allowed) {
      return;
    }

    let cancelled = false;
    const requestVersion = initiativeRequestVersionRef.current;

    void (async () => {
      setInitiativeAutoCheckBusy(true);
      try {
        const result = await runCoupleSpaceInitiativeAutoCheck({
          user,
          partner,
          coupleSpace,
          perception: appData.perception,
          chatHistory: appData.chatHistory,
          masks: appData.masks,
          worldBooks: appData.worldBooks,
          appSettings: settings,
          now,
        });

        if (cancelled) {
          return;
        }

        if (requestVersion !== initiativeRequestVersionRef.current) {
          return;
        }

        const persistedDraftResult = persistInitiativeDraftResult(
          result.nextCoupleSpace,
          result.runResult,
          'auto_check',
        );

        handleUpdateCoupleSpace(persistedDraftResult.nextCoupleSpace);
        setInitiativeCheckStatus(buildAppliedInitiativeStatusText(result.statusText, persistedDraftResult));
        setInitiativeArtifactPreview(result.artifactPreview);
      } catch (error) {
        console.error('Auto initiative check failed:', error);
        if (!cancelled) {
          setInitiativeCheckStatus('自动主动内容检查失败，请查看控制台日志。');
          setInitiativeArtifactPreview(null);
        }
      } finally {
        if (!cancelled) {
          setInitiativeAutoCheckBusy(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeView, partner, initiativeCheckBusy, initiativeAutoCheckBusy, user, coupleSpace, appData.chatHistory, settings, initiativeAutoCheckTick]);

  useEffect(() => (
    () => {
      if (initiativeAutoRetryTimerRef.current !== null) {
        window.clearTimeout(initiativeAutoRetryTimerRef.current);
        initiativeAutoRetryTimerRef.current = null;
      }
    }
  ), []);

  if (!partner && activeView === 'main') {
    const selectedPartner = getCharacterById(selectedPartnerId);
    const hasEstablishedPartners = addedPartners.length > 0;
    
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-rose-100 via-pink-50 to-stone-50 flex flex-col items-center justify-center z-50">
        <button 
          onClick={onBack}
          className="couple-space-floating-back absolute top-12 left-6 p-3 rounded-full bg-white/85 text-rose-400 shadow-sm active:scale-95 transition-transform"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex flex-col items-center gap-8">
          {hasEstablishedPartners ? (
            <>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden">
                    <ResolvedImage value={user.avatar} className="w-full h-full object-cover" alt="User" />
                  </div>
                  <div className="absolute -top-2 -right-2 bg-white rounded-full p-1.5 shadow-md">
                    <Heart size={16} className="text-rose-400 fill-rose-400 animate-pulse" />
                  </div>
                </div>

                <Heart size={32} className="text-rose-200 animate-bounce" />

                <div className="relative">
                  <button 
                    onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                    className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white flex items-center justify-center active:scale-95 transition-transform"
                  >
                    {selectedPartner ? (
                      <ResolvedImage value={selectedPartner.avatar} className="w-full h-full object-cover" alt="Partner" />
                    ) : (
                      <Plus size={32} className="text-rose-200" />
                    )}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isSelectorOpen && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, y: -20 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -20 }}
                    className="w-64 bg-white/85 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden"
                  >
                    <div className="p-2">
                      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                        {addedPartners.map((c: any) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedPartnerId(c.id);
                              setIsSelectorOpen(false);
                            }}
                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${selectedPartnerId === c.id ? 'border-rose-300 scale-95' : 'border-transparent hover:border-rose-200'}`}
                          >
                            <ResolvedImage value={c.avatar} className="w-full h-full object-cover" alt={c.name} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                onClick={() => {
                  if (selectedPartnerId) {
                    handleUpdateCoupleSpace({
                      partnerId: selectedPartnerId,
                    });
                  }
                }}
                disabled={!selectedPartnerId}
                className={`mt-8 px-12 py-3 rounded-full font-bold text-lg shadow-lg transition-all ${
                  selectedPartnerId 
                    ? 'border border-[#d9e6f7] bg-[#eef5ff] text-[#4b6788] shadow-[#dbe7f7]/60 active:scale-95' 
                    : 'bg-zinc-200 text-white cursor-not-allowed'
                }`}
              >
                开启
              </button>
            </>
          ) : (
            <div className="w-[288px] text-center space-y-4">
              <div className="flex items-center justify-center gap-4">
                <div className="w-[90px] h-[90px] rounded-full border-2 border-white/85 shadow-md overflow-hidden">
                  <ResolvedImage value={user.avatar} className="w-full h-full object-cover" alt="User" />
                </div>
                <Heart
                  size={52}
                  className="text-rose-300 fill-rose-300 animate-bounce drop-shadow-[0_12px_24px_rgba(244,114,182,0.22)]"
                />
                <div className="w-[90px] h-[90px] rounded-full border-2 border-white/85 bg-white/35 shadow-md" />
              </div>
              <div className="space-y-2">
                <h2 className="text-[17px] font-bold tracking-[0.01em] text-zinc-800">还没有建立情侣空间</h2>
                <p className="text-[15px] leading-7 text-zinc-500">
                  先去聊天里邀请角色，等 TA 同意后，
                  这里才会开启属于你们的情侣空间。
                </p>
              </div>
              <button
                onClick={onBack}
                className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-rose-100 bg-white/85 text-rose-400 font-semibold shadow-[0_8px_24px_rgba(244,114,182,0.10)] active:scale-95 transition-transform"
              >
                去聊天邀请
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-zinc-50 z-50 overflow-hidden flex flex-col">
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0">
        {resolvedBackgroundUrl ? (
          <img src={resolvedBackgroundUrl} className="w-full h-full object-cover opacity-60" alt="bg" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-rose-100 via-pink-50 to-stone-50" />
        )}
      </div>

      {/* Header */}
      {activeView !== 'loveletter-detail' && (
        <div
          className="couple-space-topbar absolute top-0 left-0 right-0 z-20 px-4 pb-4 flex items-center justify-between transition-colors bg-transparent"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 30px)' }}
        >
          <button onClick={activeView === 'main' ? onBack : () => setActiveView('main')} className={`p-2 rounded-full backdrop-blur-md ${activeView === 'main' ? 'bg-black/20 text-white' : 'bg-white/50 text-zinc-800'}`}>
            <ChevronLeft size={24} />
          </button>
          <h1 className={`text-lg font-bold ${activeView === 'main' ? 'text-white drop-shadow-md' : 'text-zinc-800'}`}>
            {activeView === 'main' && '情侣空间'}
            {activeView === 'settings' && '空间设置'}
            {activeView === 'conotes' && '情侣互记'}
            {activeView === 'ledger' && '小账本'}
            {activeView === 'loveletters' && '情书'}
            {activeView === 'calendar' && '情侣日历'}
            {activeView === 'anniversaries' && '纪念日'}
            {activeView === 'messageboard' && '留言板'}
            {activeView === 'post-feed' && '情侣动态'}
            {activeView === 'archive' && '归档'}
            {activeView === 'interaction' && '互动'}
          </h1>
          {activeView === 'main' ? (
            <button onClick={() => setActiveView('settings')} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white">
              <Settings size={20} />
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>
      )}

      {/* Content */}
      <div className={`relative z-10 flex-1 flex flex-col ${activeView === 'main' ? 'overflow-y-auto' : activeView === 'loveletter-detail' ? 'overflow-hidden' : 'couple-space-subview pt-[112px] overflow-hidden'}`}>
        <AnimatePresence mode="wait">
          {activeView === 'main' && partner && (
            <motion.div 
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] flex-shrink-0"
            >
              {/* Cover Photo */}
              <div className="relative w-full h-64 bg-zinc-200">
                {resolvedBackgroundUrl ? (
                  <img src={resolvedBackgroundUrl} className="w-full h-full object-cover" alt="cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-rose-300 via-pink-200 to-stone-200" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                {/* Avatars & Info */}
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center">
                      <div className="relative w-16 h-16 z-10">
                        {resolvedUserAvatarUrl ? (
                          <img src={resolvedUserAvatarUrl} className="w-full h-full rounded-full border-2 border-white object-cover shadow-md" alt="user" />
                        ) : (
                          <div className="w-full h-full rounded-full border-2 border-white bg-zinc-200 shadow-md" />
                        )}
                        {resolvedUserAvatarFrameUrl && (
                          <img src={resolvedUserAvatarFrameUrl} className="absolute inset-0 w-full h-full object-cover scale-[1.2] pointer-events-none" alt="" />
                        )}
                      </div>
                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center absolute left-12 z-20 shadow-sm">
                        <Heart size={12} className="fill-rose-400 text-rose-400" />
                      </div>
                      <div className="relative w-16 h-16 -ml-4 z-0">
                        {resolvedPartnerAvatarUrl ? (
                          <img src={resolvedPartnerAvatarUrl} className="w-full h-full rounded-full border-2 border-white object-cover shadow-md" alt="partner" />
                        ) : (
                          <div className="w-full h-full rounded-full border-2 border-white bg-zinc-200 shadow-md" />
                        )}
                        {resolvedPartnerAvatarFrameUrl && (
                          <img src={resolvedPartnerAvatarFrameUrl} className="absolute inset-0 w-full h-full object-cover scale-[1.2] pointer-events-none" alt="" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-white drop-shadow-md">
                    <h3 className="font-bold text-lg">{user.name} & {partner.name}</h3>
                    <p className="text-sm opacity-90">相恋 {daysTogether} 天</p>
                  </div>
                </div>
              </div>

              {/* Apps Scroll Row */}
              <div className="px-4 py-6 bg-white/40 backdrop-blur-xl rounded-t-3xl -mt-4 relative z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  <MiniAppIcon icon={<Edit3 size={24} className="text-rose-300" />} title="互记" onClick={() => setActiveView('conotes')} />
                  <MiniAppIcon icon={<Banknote size={24} className="text-rose-300" />} title="账本" onClick={() => setActiveView('ledger')} />
                  <MiniAppIcon icon={<BookOpen size={24} className="text-rose-300" />} title="情书" onClick={() => setActiveView('loveletters')} />
                  <MiniAppIcon icon={<Calendar size={24} className="text-rose-300" />} title="日历" onClick={() => setActiveView('calendar')} />
                  <MiniAppIcon icon={<Heart size={24} className="text-rose-300" />} title="纪念日" onClick={() => setActiveView('anniversaries')} />
                  <MiniAppIcon icon={<Edit3 size={24} className="text-rose-300" />} title="留言板" onClick={() => setActiveView('messageboard')} />
                  <MiniAppIcon icon={<Archive size={24} className="text-rose-300" />} title="归档" onClick={() => setActiveView('archive')} />
                  <MiniAppIcon icon={<Sparkles size={24} className="text-rose-300" />} title="互动" onClick={() => setActiveView('interaction')} />
                </div>
              </div>

              {/* Feed Section */}
              <div className="px-4 space-y-4">
                <h3 className="font-bold text-zinc-800 text-lg mb-2">情侣动态</h3>
                {sortPinnedByTimestampDesc((coupleSpace.posts || []).filter((post: CouplePost) => !post.isArchived)).length > 0 ? (
                  sortPinnedByTimestampDesc((coupleSpace.posts || []).filter((post: CouplePost) => !post.isArchived))
                    .map((post: any) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      user={user}
                      partner={partner}
                      updateSpace={handleUpdateCoupleSpace}
                      updateSpaceForPartner={handleUpdatePartnerSpace}
                      recordSettlement={handleRecordPartnerSettlement}
                      coupleSpace={coupleSpace}
                      settings={settings}
                      chatHistory={appData.chatHistory}
                      masks={appData.masks || []}
                      worldBooks={appData.worldBooks || []}
                    />
                  ))
                ) : (
                  <div className="text-center text-zinc-400 py-10">
                    <p>还没有动态哦，快来发布第一条动态吧。</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeView === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 space-y-4 flex-1 overflow-y-auto pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] no-scrollbar">
              <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-zinc-800">选择伴侣</h3>
                  <span className="text-[11px] text-zinc-400">仅显示已建立空间的角色</span>
                </div>
                {addedPartners.length > 0 && (
                  <div className="mb-3 flex items-center justify-between rounded-2xl bg-zinc-50 px-3 py-2">
                    <span className="text-[11px] text-zinc-500">
                      {isPartnerManageMode ? '当前为管理模式，点下方删除即可移除对应情侣空间。' : '点管理后再选择要删除的情侣空间。'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPartnerManageMode((current) => !current)}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all active:scale-95 ${
                        isPartnerManageMode
                          ? 'bg-rose-100 text-rose-500'
                          : 'bg-white text-zinc-500 shadow-sm'
                      }`}
                    >
                      {isPartnerManageMode ? '完成' : '管理'}
                    </button>
                  </div>
                )}
                <div className="flex gap-3 overflow-x-auto pb-2 px-1">
                  {addedPartners.map((c: any) => (
                    <div key={c.id} className="flex min-w-[70px] flex-col items-center gap-2">
                      <button
                        onClick={() => handleSwitchCoupleSpace(c.id)}
                        className={`flex flex-col items-center gap-2 p-2 rounded-xl min-w-[70px] transition-all ${coupleSpace.partnerId === c.id ? 'bg-rose-100 ring-2 ring-rose-300' : 'hover:bg-zinc-100'}`}
                      >
                        <ResolvedImage value={c.avatar} className="w-12 h-12 rounded-full object-cover" alt={c.name} />
                        <span className="text-xs font-medium text-zinc-700 truncate w-full text-center">{c.name}</span>
                      </button>
                      {isPartnerManageMode && (
                        <button
                          type="button"
                          onClick={() => {
                            setPartnerToDelete(c.id);
                            setDeletePartnerMode('space_only');
                            setActiveModal('deletePartner');
                          }}
                          className="inline-flex items-center justify-center rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-500 transition-transform active:scale-95"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-md rounded-2xl overflow-hidden shadow-sm">
                <div
                  onClick={() => setActiveModal('date')}
                  className="flex items-center justify-between p-4 border-b border-zinc-100 active:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <span className="font-bold text-zinc-800">相恋日期</span>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="text-sm">{coupleSpace.anniversaryDate ? new Date(coupleSpace.anniversaryDate).toLocaleDateString() : '未设置'}</span>
                    <ChevronLeft size={16} className="rotate-180" />
                  </div>
                </div>

                <div
                  onClick={() => {
                    setTempInput(coupleSpace.backgroundUrl || '');
                    setActiveModal('background');
                  }}
                  className="flex items-center justify-between p-4 border-b border-zinc-100 active:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <span className="font-bold text-zinc-800">空间背景</span>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="text-sm">{coupleSpace.backgroundUrl ? '已设置' : '默认'}</span>
                    <ChevronLeft size={16} className="rotate-180" />
                  </div>
                </div>

                <div
                  onClick={() => {
                    setTempInput(coupleSpace.userAvatarFrame || '');
                    setActiveModal('avatarFrameUser');
                  }}
                  className="flex items-center justify-between p-4 border-b border-zinc-100 active:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <span className="font-bold text-zinc-800">我的头像框</span>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="text-sm">{coupleSpace.userAvatarFrame ? '已设置' : '默认'}</span>
                    <ChevronLeft size={16} className="rotate-180" />
                  </div>
                </div>

                <div
                  onClick={() => {
                    setTempInput(coupleSpace.partnerAvatarFrame || '');
                    setActiveModal('avatarFramePartner');
                  }}
                  className="flex items-center justify-between p-4 active:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <span className="font-bold text-zinc-800">TA的头像框</span>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="text-sm">{coupleSpace.partnerAvatarFrame ? '已设置' : '默认'}</span>
                    <ChevronLeft size={16} className="rotate-180" />
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-md rounded-2xl overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsModuleCustomizationOpen((prev) => !prev)}
                  className="w-full p-4 flex items-center justify-between text-left active:bg-zinc-50 transition-colors"
                >
                  <h3 className="font-bold text-zinc-800">模块自定义</h3>
                  <ChevronLeft
                    size={16}
                    className={`text-zinc-400 transition-transform ${isModuleCustomizationOpen ? '-rotate-90' : 'rotate-180'}`}
                  />
                </button>

                {isModuleCustomizationOpen && (
                  <>
                    <div className="p-4 border-t border-zinc-100 border-b border-zinc-100">
                      <p className="text-xs font-bold text-zinc-400 uppercase mb-3">情书设置</p>
                      <div className="space-y-3">
                        <div
                          onClick={() => {
                            setTempInput(coupleSpace.loveLetterEnvelopeBg || '');
                            setActiveModal('loveLetterEnvelopeBg');
                          }}
                          className="flex items-center justify-between active:bg-zinc-50 transition-colors cursor-pointer py-1"
                        >
                          <span className="text-sm text-zinc-700">信封背景图</span>
                          <div className="flex items-center gap-2 text-zinc-500">
                            <span className="text-xs">{coupleSpace.loveLetterEnvelopeBg ? '已设置' : '默认'}</span>
                            <ChevronLeft size={14} className="rotate-180" />
                          </div>
                        </div>
                        <div
                          onClick={() => {
                            setSelectedEnvelopeColor(coupleSpace.loveLetterEnvelopeColor || '#f5e6d3');
                            setActiveModal('loveLetterEnvelopeColor');
                          }}
                          className="flex items-center justify-between active:bg-zinc-50 transition-colors cursor-pointer py-1"
                        >
                          <span className="text-sm text-zinc-700">信封颜色</span>
                          <div className="flex items-center gap-2 text-zinc-500">
                            <div className="w-4 h-4 rounded-full border border-zinc-200" style={{ backgroundColor: coupleSpace.loveLetterEnvelopeColor || '#f5e6d3' }} />
                            <ChevronLeft size={14} className="rotate-180" />
                          </div>
                        </div>
                        <div
                          onClick={() => {
                            setSelectedPaperTexture(coupleSpace.loveLetterPaperTexture || 'default');
                            setActiveModal('loveLetterPaperTexture');
                          }}
                          className="flex items-center justify-between active:bg-zinc-50 transition-colors cursor-pointer py-1"
                        >
                          <span className="text-sm text-zinc-700">信纸质感</span>
                          <div className="flex items-center gap-2 text-zinc-500">
                            <span className="text-xs">
                              {coupleSpace.loveLetterPaperTexture === 'vintage'
                                ? '复古'
                                : coupleSpace.loveLetterPaperTexture === 'grid'
                                  ? '网格'
                                  : coupleSpace.loveLetterPaperTexture === 'floral'
                                    ? '花草'
                                    : '默认'}
                            </span>
                            <ChevronLeft size={14} className="rotate-180" />
                          </div>
                        </div>
                        <div
                          onClick={() => {
                            setTempInput(coupleSpace.loveLetterPaperBg || '');
                            setActiveModal('loveLetterPaperBg');
                          }}
                          className="flex items-center justify-between active:bg-zinc-50 transition-colors cursor-pointer py-1"
                        >
                          <span className="text-sm text-zinc-700">信纸背景图</span>
                          <div className="flex items-center gap-2 text-zinc-500">
                            <span className="text-xs">{coupleSpace.loveLetterPaperBg ? '已设置' : '默认'}</span>
                            <ChevronLeft size={14} className="rotate-180" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-xs font-bold text-zinc-400 uppercase mb-3">日历设置</p>
                      <div
                        onClick={() => {
                          setTempInput(coupleSpace.calendarBg || '');
                          setActiveModal('calendarBg');
                        }}
                        className="flex items-center justify-between active:bg-zinc-50 transition-colors cursor-pointer py-1"
                      >
                        <span className="text-sm text-zinc-700">日历背景图</span>
                        <div className="flex items-center gap-2 text-zinc-500">
                          <span className="text-xs">{coupleSpace.calendarBg ? '已设置' : '默认'}</span>
                          <ChevronLeft size={14} className="rotate-180" />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <CoupleSpaceInitiativeSettingsCard
                isOpen={isInitiativeSettingsOpen}
                onToggle={() => setIsInitiativeSettingsOpen((prev) => !prev)}
                settings={initiativeSettings}
                onChange={handleUpdateInitiativeSettings}
                onRefresh={handleRefreshInitiativeContent}
                refreshBusy={initiativeRefreshBusy}
              />

              <CoupleSpaceInitiativeCheckCard
                isOpen={isInitiativeCheckOpen}
                onToggle={() => setIsInitiativeCheckOpen((prev) => !prev)}
                busy={initiativeCheckBusy}
                statusText={initiativeCheckStatus}
                artifactPreview={initiativeArtifactPreview}
                draftEntries={initiativeDraftEntries}
                onCheck={handleManualInitiativeCheck}
                onPublishDraft={handlePublishInitiativeDraft}
                onDeleteDraft={handleDeleteInitiativeDraft}
              />

              <div className="bg-white/80 backdrop-blur-md rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-zinc-100">
                  <h3 className="font-bold text-zinc-800">数据管理</h3>
                </div>
                <div
                  onClick={() => setActiveModal('dataManagement')}
                  className="flex items-center justify-between p-4 active:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <span className="text-zinc-800">高级数据管理</span>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="text-xs">导出/清空</span>
                    <ChevronLeft size={16} className="rotate-180" />
                  </div>
                </div>
              </div>

              {/* Modals */}
              <AnimatePresence>
                {activeModal && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setActiveModal(null)}
                  >
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-white w-full max-w-[320px] rounded-3xl p-5 shadow-2xl max-h-[80%] overflow-y-auto"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-zinc-800">
                          {activeModal === 'date' && '选择日期'}
                          {activeModal === 'background' && '设置背景'}
                          {activeModal === 'avatarFrameUser' && '我的头像框'}
                          {activeModal === 'avatarFramePartner' && 'TA的头像框'}
                          {activeModal === 'deletePartner' && '删除伴侣'}
                          {activeModal === 'dataManagement' && '数据管理'}
                          {activeModal === 'loveLetterEnvelopeColor' && '信封颜色'}
                          {activeModal === 'loveLetterPaperTexture' && '信纸质感'}
                          {activeModal === 'calendarBg' && '日历背景图'}
                        </h3>
                        <button onClick={() => setActiveModal(null)} className="p-1.5 bg-zinc-100 rounded-full text-zinc-500">
                          <X size={18} />
                        </button>
                      </div>


                      {activeModal === 'dataManagement' && (
                        <div className="space-y-5">
                          {/* Action Toggle */}
                          <div className="flex bg-zinc-100 p-1 rounded-xl">
                            <button 
                              onClick={() => setManageAction('export')}
                              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${manageAction === 'export' ? 'bg-white text-[#f6b6cd] shadow-sm' : 'text-zinc-500'}`}
                            >
                              导出数据
                            </button>
                            <button 
                              onClick={() => setManageAction('delete')}
                              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${manageAction === 'delete' ? 'bg-white text-[#f6b6cd] shadow-sm' : 'text-zinc-500'}`}
                            >
                              清空数据
                            </button>
                          </div>

                          {/* Data Types */}
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">数据类型</label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: 'posts', label: '情侣动态' },
                                { id: 'conotes', label: '互记' },
                                { id: 'ledger', label: '账本' },
                                { id: 'loveletters', label: '情书' }
                              ].map(type => (
                                <button
                                  key={type.id}
                                  onClick={() => {
                                    if (manageDataTypes.includes(type.id)) {
                                      setManageDataTypes(manageDataTypes.filter(t => t !== type.id));
                                    } else {
                                      setManageDataTypes([...manageDataTypes, type.id]);
                                    }
                                  }}
                                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all flex items-center justify-between ${
                                    manageDataTypes.includes(type.id) 
                                      ? 'bg-[#fff7fb] border-[#f2cddd] text-[#d99ab5]' 
                                      : 'bg-white border-zinc-200 text-zinc-600'
                                  }`}
                                >
                                  {type.label}
                                  {manageDataTypes.includes(type.id) && <div className="w-2 h-2 rounded-full bg-[#f6b6cd]" />}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Targets */}
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">数据来源</label>
                            <div className="flex gap-2">
                              {[
                                { id: 'user', label: user.name || '我' },
                                { id: 'partner', label: partner ? partner.name : 'TA' }
                              ].map(target => (
                                <button
                                  key={target.id}
                                  onClick={() => {
                                    if (manageTargets.includes(target.id)) {
                                      setManageTargets(manageTargets.filter(t => t !== target.id));
                                    } else {
                                      setManageTargets([...manageTargets, target.id]);
                                    }
                                  }}
                                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                                    manageTargets.includes(target.id) 
                                      ? 'bg-[#fff7fb] border-[#f2cddd] text-[#d99ab5]' 
                                      : 'bg-white border-zinc-200 text-zinc-600'
                                  }`}
                                >
                                  {target.label}
                                  {manageTargets.includes(target.id) && <div className="w-2 h-2 rounded-full bg-[#f6b6cd]" />}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2">
                            <button 
                              onClick={async () => {
                                const filterData = (items: any[]) => {
                                  if (!items) return [];
                                  return items.filter((item: any) => {
                                    const isUser = item.authorId === 'user' || item.payerId === 'user';
                                    const isPartner = item.authorId !== 'user' && item.payerId !== 'user';
                                    if (manageTargets.includes('user') && isUser) return true;
                                    if (manageTargets.includes('partner') && isPartner) return true;
                                    return false;
                                  });
                                };

                                if (manageAction === 'export') {
                                  const exportData: any = {};
                                  if (manageDataTypes.includes('posts')) exportData.posts = filterData(coupleSpace.posts);
                                  if (manageDataTypes.includes('conotes')) exportData.coNotes = filterData(coupleSpace.coNotes);
                                  if (manageDataTypes.includes('ledger')) exportData.ledger = filterData(coupleSpace.ledger);
                                  if (manageDataTypes.includes('loveletters')) exportData.loveLetters = filterData(coupleSpace.loveLetters);

                                  const dataStr = JSON.stringify(exportData, null, 2);
                                  const blob = new Blob([dataStr], { type: 'application/json' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `couple_space_data_${new Date().toISOString().split('T')[0]}.json`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                  setActiveModal(null);
                                } else {
                                  if (await showInAppConfirm('确定要清空选中的数据吗？此操作无法撤销。')) {
                                    handleUpdateCoupleSpace((prev: any) => {
                                      const updates: any = {};
                                      if (manageDataTypes.includes('posts')) {
                                        updates.posts = prev.posts.filter((item: any) => {
                                          const isUser = item.authorId === 'user';
                                          if (manageTargets.includes('user') && isUser) return false;
                                          if (manageTargets.includes('partner') && !isUser) return false;
                                          return true;
                                        });
                                      }
                                      if (manageDataTypes.includes('conotes')) {
                                        updates.coNotes = prev.coNotes.filter((item: any) => {
                                          const isUser = item.authorId === 'user';
                                          if (manageTargets.includes('user') && isUser) return false;
                                          if (manageTargets.includes('partner') && !isUser) return false;
                                          return true;
                                        });
                                      }
                                      if (manageDataTypes.includes('ledger')) {
                                        updates.ledger = prev.ledger.filter((item: any) => {
                                          const isUser = item.payerId === 'user';
                                          if (manageTargets.includes('user') && isUser) return false;
                                          if (manageTargets.includes('partner') && !isUser) return false;
                                          return true;
                                        });
                                      }
                                      if (manageDataTypes.includes('loveletters')) {
                                        updates.loveLetters = prev.loveLetters.filter((item: any) => {
                                          const isUser = item.authorId === 'user';
                                          if (manageTargets.includes('user') && isUser) return false;
                                          if (manageTargets.includes('partner') && !isUser) return false;
                                          return true;
                                        });
                                      }
                                      return updates;
                                    });
                                    setActiveModal(null);
                                  }
                                }
                              }}
                              className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${
                                manageAction === 'delete' 
                                  ? 'bg-[#f6b6cd] shadow-[#f6b6cd]/30' 
                                  : 'bg-[#f6b6cd] shadow-[#f6b6cd]/30'
                              }`}
                            >
                              {manageAction === 'export' ? '导出选中数据' : '确认清空'}
                            </button>
                          </div>
                        </div>
                      )}

                      {activeModal === 'deletePartner' && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setDeletePartnerMode('space_only')}
                              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                                deletePartnerMode === 'space_only'
                                  ? 'border-rose-200 bg-rose-50/80 shadow-sm'
                                  : 'border-zinc-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-zinc-800">只删除情侣空间</div>
                                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                                    保留聊天记录和角色记忆，只移除这个角色的情侣空间内容。
                                  </div>
                                </div>
                                <div className={`h-4 w-4 rounded-full border ${
                                  deletePartnerMode === 'space_only'
                                    ? 'border-rose-300 bg-rose-300'
                                    : 'border-zinc-300 bg-white'
                                }`} />
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletePartnerMode('space_and_memory')}
                              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                                deletePartnerMode === 'space_and_memory'
                                  ? 'border-rose-200 bg-rose-50/80 shadow-sm'
                                  : 'border-zinc-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-zinc-800">连角色记忆一起清除</div>
                                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                                    会同时清除这个角色因情侣空间留下的近期关系记忆与共享余波。
                                  </div>
                                </div>
                                <div className={`h-4 w-4 rounded-full border ${
                                  deletePartnerMode === 'space_and_memory'
                                    ? 'border-rose-300 bg-rose-300'
                                    : 'border-zinc-300 bg-white'
                                }`} />
                              </div>
                            </button>
                          </div>
                          <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-xs leading-5 text-zinc-500">
                            不会删除普通聊天记录。删除后如果你想重新开启，可以再发送一次情侣空间邀请。
                          </div>
                          <p className="text-zinc-600 text-center py-2">确定要删除这位伴侣吗？</p>
                          <div className="flex gap-3">
                            <button 
                              onClick={() => {
                                setActiveModal(null);
                                setPartnerToDelete(null);
                                setDeletePartnerMode('space_only');
                              }}
                              className="flex-1 bg-zinc-100 text-zinc-600 py-2.5 rounded-xl font-bold active:scale-95 transition-transform"
                            >
                              取消
                            </button>
                            <button 
                              onClick={() => {
                                if (partnerToDelete) {
                                  handleDeletePartnerSpace(partnerToDelete, {
                                    clearCharacterMemory: deletePartnerMode === 'space_and_memory',
                                  });
                                }
                                setActiveModal(null);
                                setPartnerToDelete(null);
                                setDeletePartnerMode('space_only');
                              }} 
                              className="flex-1 bg-[#f6b6cd] text-white py-2.5 rounded-xl font-bold shadow-lg shadow-[#f6b6cd]/30 active:scale-95 transition-transform"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      )}

                      {activeModal === 'loveLetterEnvelopeColor' && (
                        <div className="space-y-4">
                          <p className="text-sm text-zinc-500">选择信封的基础颜色</p>
                          <div className="grid grid-cols-5 gap-3">
                            {['#f5e6d3', '#ebdcc8', '#fce7f3', '#dcfce7', '#fef9c3', '#e0f2fe', '#f3e8ff', '#ffedd5', '#f1f5f9', '#ffffff'].map(color => (
                              <button
                                key={color}
                                onClick={() => setSelectedEnvelopeColor(color)}
                                className={`aspect-square rounded-full border-2 transition-all ${selectedEnvelopeColor === color ? 'border-zinc-300 scale-110 shadow-md shadow-zinc-200/70' : 'border-transparent hover:scale-105'}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                            <button 
                              onClick={() => {
                                handleUpdateCoupleSpace({ loveLetterEnvelopeColor: selectedEnvelopeColor });
                                setActiveModal(null);
                              }}
                              className="w-full bg-zinc-100 text-zinc-700 py-3 rounded-xl font-bold shadow-sm shadow-zinc-200/60 active:scale-95 transition-transform"
                            >
                              确定
                            </button>
                        </div>
                      )}

                      {activeModal === 'loveLetterPaperTexture' && (
                        <div className="space-y-4">
                          <p className="text-sm text-zinc-500">选择信纸的质感样式</p>
                          <div className="relative">
                            <select 
                              value={selectedPaperTexture}
                              onChange={(e) => setSelectedPaperTexture(e.target.value as any)}
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-300 appearance-none"
                            >
                              <option value="default">默认 - 经典信纸</option>
                              <option value="vintage">复古 - 做旧质感</option>
                              <option value="grid">网格 - 清新格纹</option>
                              <option value="floral">花草 - 浪漫碎花</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                              <ChevronLeft size={16} className="-rotate-90" />
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              handleUpdateCoupleSpace({ loveLetterPaperTexture: selectedPaperTexture });
                              setActiveModal(null);
                            }}
                            className="w-full bg-zinc-100 text-zinc-700 py-3 rounded-xl font-bold shadow-sm shadow-zinc-200/60 active:scale-95 transition-transform"
                          >
                            确定
                          </button>
                        </div>
                      )}

                      {activeModal === 'date' && (
                        <div className="space-y-4">
                          <input 
                            type="date" 
                            value={coupleSpace.anniversaryDate ? new Date(coupleSpace.anniversaryDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => handleUpdateCoupleSpace({ anniversaryDate: e.target.value ? new Date(e.target.value).getTime() : null })}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 outline-none focus:border-zinc-300 text-lg"
                          />
                          <button onClick={() => setActiveModal(null)} className="w-full bg-zinc-100 text-zinc-700 py-3 rounded-xl font-bold shadow-sm shadow-zinc-200/60">确定</button>
                        </div>
                      )}

                      {isImageModalType(activeModal) && (
                        <div className="space-y-4">
                          {isCropping && imageToCrop ? (
                            <div className="space-y-4">
                              <div className="relative h-64 w-full bg-zinc-100 rounded-xl overflow-hidden">
                                <Cropper
                                  image={imageToCrop}
                                  crop={crop}
                                  zoom={zoom}
                                  aspect={['background', 'calendarBg', 'loveLetterEnvelopeBg', 'loveLetterPaperBg'].includes(activeModal) ? 9 / 16 : 1}
                                  onCropChange={setCrop}
                                  onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                                  onZoomChange={setZoom}
                                />
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-zinc-400">缩放</span>
                                <input
                                  type="range"
                                  value={zoom}
                                  min={1}
                                  max={3}
                                  step={0.1}
                                  aria-labelledby="Zoom"
                                  onChange={(e) => setZoom(Number(e.target.value))}
                                  className="flex-1 accent-pink-500"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    setIsCropping(false);
                                    setImageToCrop(null);
                                  }}
                                  className="flex-1 bg-zinc-100 text-zinc-500 py-2.5 rounded-xl font-bold active:scale-95 transition-transform"
                                >
                                  取消
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (imageToCrop && croppedAreaPixels && isImageModalType(activeModal)) {
                                      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
                                      const persistedValue = await saveUploadedDataUrl(croppedImage, getImageModalFileName(activeModal));
                                      handleUpdateCoupleSpace(buildCoupleSpaceImageUpdates(activeModal, persistedValue));
                                      setIsCropping(false);
                                      setImageToCrop(null);
                                      setActiveModal(null);
                                    }
                                  }}
                                  className="flex-1 bg-zinc-100 text-zinc-700 py-2.5 rounded-xl font-bold shadow-sm shadow-zinc-200/60 active:scale-95 transition-transform"
                                >
                                  完成裁剪
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <p className="text-sm text-zinc-500">输入图片 URL 或上传图片</p>
                              <input 
                                type="text" 
                                value={tempInput}
                                onChange={e => setTempInput(e.target.value)}
                                placeholder="支持链接、Markdown或HTML图片"
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-300"
                              />
                              <div className="flex gap-2">
                                <button 
                                  onClick={async () => {
                                    if (!isImageModalType(activeModal)) return;
                                    const finalUrl = await setRemoteUrl(tempInput);
                                    handleUpdateCoupleSpace(buildCoupleSpaceImageUpdates(activeModal, finalUrl));
                                    setActiveModal(null);
                                  }}
                                  className="flex-1 bg-zinc-100 text-zinc-700 py-3 rounded-xl font-bold shadow-sm shadow-zinc-200/60 active:scale-95 transition-transform"
                                >
                                  保存
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (!isImageModalType(activeModal)) return;
                                    const nextValue = await clearValue();
                                    handleUpdateCoupleSpace(buildCoupleSpaceImageUpdates(activeModal, nextValue));
                                    setActiveModal(null);
                                  }}
                                  className="flex-1 bg-zinc-100 text-zinc-500 py-3 rounded-xl font-bold active:scale-95 transition-transform"
                                >
                                  重置
                                </button>
                              </div>

                              <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                  <div className="w-full border-t border-zinc-100"></div>
                                </div>
                                <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-zinc-400">
                                  <span className="px-2 bg-white">或者上传文件</span>
                                </div>
                              </div>

                              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-200 rounded-2xl cursor-pointer hover:bg-pink-50 hover:border-pink-200 transition-all group">
                                <div className="flex flex-col items-center justify-center pt-2 pb-3">
                                  <ImageIcon className="w-6 h-6 text-zinc-300 mb-1 group-hover:text-pink-400 transition-colors" />
                                  <p className="text-xs text-zinc-400 group-hover:text-pink-500 transition-colors">点击上传文件</p>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setImageToCrop(reader.result as string);
                                      setIsCropping(true);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }} />
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeView === 'conotes' && partner && (
            <CoNotesView
              coupleSpace={coupleSpace}
              updateSpace={handleUpdateCoupleSpace}
              updateSpaceForPartner={handleUpdatePartnerSpace}
              recordSettlement={handleRecordPartnerSettlement}
              user={user}
              partner={partner}
              settings={settings}
              chatHistory={appData.chatHistory}
              masks={appData.masks || []}
              worldBooks={appData.worldBooks || []}
            />
          )}

          {activeView === 'ledger' && partner && (
            <LedgerView
              coupleSpace={coupleSpace}
              updateSpace={handleUpdateCoupleSpace}
              recordSettlement={handleRecordPartnerSettlement}
              user={user}
              partner={partner}
            />
          )}

          {activeView === 'loveletters' && partner && (
            <LoveLettersView
              coupleSpace={coupleSpace}
              updateSpace={handleUpdateCoupleSpace}
              updateSpaceForPartner={handleUpdatePartnerSpace}
              recordSettlement={handleRecordPartnerSettlement}
              user={user}
              partner={partner}
              settings={settings}
              chatHistory={appData.chatHistory}
              masks={appData.masks || []}
              worldBooks={appData.worldBooks || []}
              onOpenLetter={(letterId: string) => {
                setLoveLetterReturnView('loveletters');
                setSelectedLoveLetterId(letterId);
                setActiveView('loveletter-detail');
              }}
            />
          )}

          {activeView === 'loveletter-detail' && partner && selectedLoveLetter && (
            <LoveLetterDetailPage
              letter={selectedLoveLetter}
              user={user}
              partner={partner}
              appearance={{
                envelopeBg: coupleSpace.loveLetterEnvelopeBg,
                envelopeColor: coupleSpace.loveLetterEnvelopeColor,
                paperTexture: coupleSpace.loveLetterPaperTexture,
                paperBg: coupleSpace.loveLetterPaperBg,
              }}
              onClose={() => setActiveView(loveLetterReturnView)}
              onArchive={() => {
                handleUpdateCoupleSpace((prev: any) => ({
                  loveLetters: (prev.loveLetters || []).map((letter: LoveLetter) =>
                    letter.id === selectedLoveLetter.id
                      ? { ...letter, isArchived: true, isPinned: false }
                      : letter
                  ),
                }));
                setActiveView(loveLetterReturnView);
              }}
              onRestore={() => {
                handleUpdateCoupleSpace((prev: any) => ({
                  loveLetters: (prev.loveLetters || []).map((letter: LoveLetter) =>
                    letter.id === selectedLoveLetter.id
                      ? { ...letter, isArchived: false }
                      : letter
                  ),
                }));
                setActiveView(loveLetterReturnView);
              }}
              onPin={() => {
                handleUpdateCoupleSpace((prev: any) => ({
                  loveLetters: (prev.loveLetters || []).map((letter: LoveLetter) =>
                    letter.id === selectedLoveLetter.id
                      ? { ...letter, isPinned: true }
                      : letter
                  ),
                }));
              }}
              onUnpin={() => {
                handleUpdateCoupleSpace((prev: any) => ({
                  loveLetters: (prev.loveLetters || []).map((letter: LoveLetter) =>
                    letter.id === selectedLoveLetter.id
                      ? { ...letter, isPinned: false }
                      : letter
                  ),
                }));
              }}
              onDelete={async () => {
                if (!(await showInAppConfirm('确定要删除这封情书吗？删除后无法恢复。'))) {
                  return;
                }
                handleUpdateCoupleSpace((prev: any) => ({
                  loveLetters: (prev.loveLetters || []).filter((letter: LoveLetter) => letter.id !== selectedLoveLetter.id),
                }));
                setActiveView(loveLetterReturnView);
              }}
              onAddComment={
                selectedLoveLetter.authorId !== 'user'
                  ? (content: string) => {
                      const newComment = {
                        id: Date.now().toString(),
                        authorId: 'user',
                        content,
                        timestamp: Date.now(),
                      };
                      handleUpdateCoupleSpace((prev: any) => ({
                        loveLetters: (prev.loveLetters || []).map((letter: LoveLetter) =>
                          letter.id === selectedLoveLetter.id
                            ? { ...letter, comments: [...(letter.comments || []), newComment] }
                            : letter
                        ),
                      }));
                    }
                  : undefined
              }
            />
          )}

          {activeView === 'calendar' && partner && (
            <CoupleSpaceCalendarView
              coupleSpace={coupleSpace}
              updateSpace={handleUpdateCoupleSpace}
              user={user}
              partner={partner}
              chatHistory={appData.chatHistory}
            />
          )}

          {activeView === 'post-feed' && partner && (
            <PostFeedView
              coupleSpace={coupleSpace}
              updateSpace={handleUpdateCoupleSpace}
              updateSpaceForPartner={handleUpdatePartnerSpace}
              recordSettlement={handleRecordPartnerSettlement}
              user={user}
              partner={partner}
              settings={settings}
              onBack={() => setActiveView('main')}
              chatHistory={appData.chatHistory}
              masks={appData.masks || []}
              worldBooks={appData.worldBooks || []}
            />
          )}

          {activeView === 'archive' && partner && (
            <CoupleSpaceArchiveCenter
              loveLetters={coupleSpace.loveLetters || []}
              posts={coupleSpace.posts || []}
              coNotes={coupleSpace.coNotes || []}
              messageBoard={coupleSpace.messageBoard || []}
              user={user}
              partner={partner}
              updateSpace={handleUpdateCoupleSpace}
              onOpenLetter={(letterId: string) => {
                setLoveLetterReturnView('archive');
                setSelectedLoveLetterId(letterId);
                setActiveView('loveletter-detail');
              }}
            />
          )}

          {activeView === 'interaction' && partner && (
            <CoupleSpaceInteractionCenter
                user={user}
                partner={partner}
                coupleSpace={coupleSpace}
                chatHistory={appData.chatHistory}
                activeConfig={coupleSpaceConfig || undefined}
                updateSpace={handleUpdateCoupleSpace}
              />
          )}

          {activeView === 'anniversaries' && partner && (
            <AnniversariesView coupleSpace={coupleSpace} updateSpace={handleUpdateCoupleSpace} user={user} partner={partner} />
          )}

          {activeView === 'messageboard' && partner && (
            <MessageBoardView
              coupleSpace={coupleSpace}
              updateSpace={handleUpdateCoupleSpace}
              updateSpaceForPartner={handleUpdatePartnerSpace}
              recordSettlement={handleRecordPartnerSettlement}
              user={user}
              partner={partner}
              settings={settings}
              chatHistory={appData.chatHistory}
              masks={appData.masks || []}
              worldBooks={appData.worldBooks || []}
            />
          )}

        </AnimatePresence>
      </div>

      {activeView === 'main' && partner && (
        <button 
          onClick={() => setActiveView('post-feed')}
          className="absolute bottom-6 right-6 w-14 h-14 bg-rose-300 text-white rounded-full shadow-lg shadow-rose-200/50 flex items-center justify-center active:scale-90 transition-transform z-50"
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
}

function MiniAppIcon({ icon, title, onClick }: { icon: React.ReactNode, title: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-2 min-w-[64px] active:scale-95 transition-transform"
    >
      <div className="w-14 h-14 bg-zinc-50 rounded-2xl shadow-sm border border-zinc-100 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-xs font-medium text-zinc-700">{title}</span>
    </button>
  );
}

// --- Sub Views ---

function PostCard({ post, user, partner, updateSpace, updateSpaceForPartner, recordSettlement, coupleSpace, settings, chatHistory, masks, worldBooks }: any) {
  const [commentText, setCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const author = post.authorId === 'user' ? user : partner;
  const isLiked = post.likes.includes('user');
  const isArchived = Boolean(post.isArchived);
  const scopedPartnerId = coupleSpace.partnerId || partner.id;

  const handleLike = () => {
    updateSpace((prev: any) => ({
      posts: (prev.posts || []).map((p: any) => {
        if (p.id === post.id) {
          const newLikes = isLiked 
            ? p.likes.filter((id: string) => id !== 'user')
            : [...p.likes, 'user'];
          return { ...p, likes: newLikes };
        }
        return p;
      })
    }));
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    const operationNow = Date.now();
    const shouldTriggerPartnerReply = post.authorId === partner.id || replyingTo?.authorId === partner.id;
    const newComment = {
      id: operationNow.toString(),
      authorId: 'user',
      content: commentText,
      timestamp: operationNow,
      replyToCommentId: replyingTo?.id,
      replyToAuthorId: replyingTo?.authorId,
      replyToAuthorName: replyingTo
        ? (replyingTo.authorId === 'user' ? user.name : partner.name)
        : undefined
    };
    
    updateSpace((prev: any) => ({
      posts: (prev.posts || []).map((p: any) => 
        p.id === post.id ? { ...p, comments: [...(p.comments || []), newComment] } : p
      )
    }));
    await recordSettlement(scopedPartnerId, {
      type: 'comment_reply',
      content: newComment.content,
      timestamp: operationNow,
      authorRole: 'user',
    });
    
    setCommentText('');
    setShowCommentInput(false);
    setReplyingTo(null);

    // If user commented on AI's post or directly replied to AI's comment, AI might continue the thread
    if (shouldTriggerPartnerReply && getCoupleSpaceInteractionSettings(coupleSpace).replyDailyComment.enabled) {
      try {
        const commonInputEnvelope = createCoupleSpacePromptCommonInput({
          source: {
            user,
            partner,
            coupleSpace,
            perception: coupleSpace.perception,
            chatHistory,
            masks,
            worldBooks,
            settings: {
              initiativeSettings: coupleSpace.initiativeSettings,
            },
            now: operationNow,
          },
          scene: {
            mode: 'passive',
            actionType: 'reply_daily_comment',
          },
        });

        const responseText = await generateCoupleDailyCommentReply(settings, {
          ...commonInputEnvelope.common,
          dailyCommentReplyContext: {
            coupleDailyContent: post.content,
            userComment: newComment.content,
            contentAuthor: post.authorId === partner.id ? 'character' : 'user',
            replyIntent: replyingTo
              ? '顺着这条评论线程回一句，像评论区里自然接话'
              : '回一句贴合这个角色本人、短而自然的评论回复',
          },
        });
        if (responseText) {
          setTimeout(() => {
            const aiComment = {
              id: Date.now().toString() + '_ai',
              authorId: partner.id,
              content: responseText,
              timestamp: Date.now(),
              replyToCommentId: newComment.id,
              replyToAuthorId: newComment.authorId,
              replyToAuthorName: user.name
            };
            updateSpaceForPartner(scopedPartnerId, (prev: any) => ({
              posts: (prev.posts || []).map((p: any) => 
                p.id === post.id ? { ...p, comments: [...(p.comments || []), aiComment] } : p
              )
            }));
            void recordSettlement(scopedPartnerId, {
              type: 'comment_reply',
              content: aiComment.content,
              timestamp: aiComment.timestamp,
              authorRole: 'partner',
            });
          }, 3000);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const deletePost = async () => {
    if (await showInAppConfirm('确定要删除这条动态吗？')) {
      updateSpace((prev: any) => ({
        posts: (prev.posts || []).filter((p: any) => p.id !== post.id)
      }));
    }
  };

  const archivePost = async () => {
    if (await showInAppConfirm('要把这条动态归档吗？归档后会从主列表移到已归档里。')) {
      updateSpace((prev: any) => ({
        posts: (prev.posts || []).map((p: any) =>
          p.id === post.id ? { ...p, isArchived: true, isPinned: false } : p
        )
      }));
    }
  };

  const restorePost = () => {
    updateSpace((prev: any) => ({
      posts: (prev.posts || []).map((p: any) =>
        p.id === post.id ? { ...p, isArchived: false } : p
      )
    }));
  };

  const pinPost = () => {
    updateSpace((prev: any) => ({
      posts: (prev.posts || []).map((p: any) =>
        p.id === post.id ? { ...p, isPinned: true } : p
      )
    }));
  };

  const unpinPost = () => {
    updateSpace((prev: any) => ({
      posts: (prev.posts || []).map((p: any) =>
        p.id === post.id ? { ...p, isPinned: false } : p
      )
    }));
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <ResolvedImage value={author.avatar} className="w-full h-full rounded-full object-cover" alt={author.name} />
            {post.authorId === 'user' && (
              <ResolvedImage value={coupleSpace.userAvatarFrame} className="absolute inset-0 w-full h-full object-cover scale-[1.2] pointer-events-none" alt="" />
            )}
            {post.authorId !== 'user' && (
              <ResolvedImage value={coupleSpace.partnerAvatarFrame} className="absolute inset-0 w-full h-full object-cover scale-[1.2] pointer-events-none" alt="" />
            )}
          </div>
          <div>
            <div className="font-bold text-zinc-800 text-sm">{author.name}</div>
            <div className="text-xs text-zinc-400">{new Date(post.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.isPinned ? (
            <button onClick={unpinPost} className="text-rose-300 hover:text-rose-400" aria-label="取消置顶动态">
              <PinOff size={16} />
            </button>
          ) : (
            <button onClick={pinPost} className="text-zinc-300 hover:text-rose-400" aria-label="置顶动态">
              <Pin size={16} />
            </button>
          )}
          {isArchived ? (
            <button onClick={restorePost} className="text-zinc-300 hover:text-rose-400" aria-label="恢复动态">
              <ArchiveRestore size={16} />
            </button>
          ) : (
            <button onClick={archivePost} className="text-zinc-300 hover:text-rose-400" aria-label="归档动态">
              <Archive size={16} />
            </button>
          )}
          <button onClick={deletePost} className="text-zinc-300 hover:text-red-500" aria-label="删除动态">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      <p className="text-zinc-800 text-[15px] mb-3 whitespace-pre-wrap">{post.content}</p>
      
      {post.images && post.images.length > 0 && (
        <div
          className={
            'grid gap-2 mb-3 ' +
            (post.images.length === 1
              ? 'grid-cols-1'
              : post.images.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-3')
          }
        >
          {post.images.map((img: string, idx: number) => (
            <div
              key={String(post.id) + '-' + String(idx)}
              className={
                'w-full overflow-hidden rounded-xl bg-zinc-50 flex items-center justify-center ' +
                (post.images.length === 1
                  ? 'h-56'
                  : post.images.length === 2
                    ? 'h-40'
                    : 'h-32')
              }
            >
              <ResolvedImage value={img} className="w-full h-full object-contain" alt="" />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-zinc-50">
        <div className="flex gap-4">
          <button
            onClick={handleLike}
            className={
              'flex items-center gap-1.5 text-sm transition-colors ' +
              (isLiked ? 'text-red-500' : 'text-zinc-500')
            }
          >
            <Heart size={18} className={isLiked ? 'fill-red-500' : ''} />
            <span>赞</span>
          </button>
          <button onClick={() => setShowCommentInput(!showCommentInput)} className="flex items-center gap-1.5 text-sm text-zinc-500">
            <Edit3 size={18} />
            <span>评论</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {(post.comments?.length > 0 || showCommentInput) && (
        <div className="mt-4 bg-zinc-50 rounded-xl p-3 space-y-2">
          {post.comments?.map((c: any) => {
            const cAuthor = c.authorId === 'user' ? user : partner;
            const replyTarget = c.replyToCommentId
              ? post.comments?.find((item: any) => item.id === c.replyToCommentId)
              : null;
            const replyTargetName = c.replyToAuthorName
              || (replyTarget ? (replyTarget.authorId === 'user' ? user.name : partner.name) : null);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setReplyingTo(c);
                  setShowCommentInput(true);
                }}
                className="block w-full px-1 py-1 text-left text-sm"
              >
                <div>
                  <span className="font-bold text-zinc-700">
                    {replyTargetName ? `${cAuthor.name} 回复 ${replyTargetName}: ` : `${cAuthor.name}: `}
                  </span>
                  <span className="text-zinc-600">{c.content}</span>
                </div>
              </button>
            );
          })}
          
          {showCommentInput && (
            <div className="mt-2 pt-2 border-t border-zinc-200/50">
              <div className="flex gap-2">
              <input 
                type="text" 
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={replyingTo ? `回复 ${replyingTo.authorId === 'user' ? user.name : partner.name}...` : '评论...'}
                className="flex-1 bg-white border border-zinc-200 rounded-full px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleComment()}
              />
              <button onClick={handleComment} className="text-zinc-800"><Send size={18} /></button>
              </div>
              {replyingTo && (
                <div className="mt-2 text-right">
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setCommentText('');
                      setShowCommentInput(false);
                    }}
                    className="text-[12px] text-zinc-400 transition-colors hover:text-zinc-600"
                  >
                    取消回复
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CoNotesView({ coupleSpace, updateSpace, updateSpaceForPartner, recordSettlement, user, partner, settings, chatHistory, masks, worldBooks }: any) {
  const [text, setText] = useState('');
  const allNotes: CoNote[] = coupleSpace.coNotes || [];
  const noteMap = new Map(allNotes.map((note) => [note.id, note]));
  const topLevelNotes = allNotes.filter((note) => !note.isArchived && (!note.replyToNoteId || !noteMap.has(note.replyToNoteId)));
  const scopedPartnerId = coupleSpace.partnerId || partner.id;
  const repliesByNoteId = allNotes.reduce((acc: Record<string, CoNote[]>, note: CoNote) => {
    if (note.isArchived || !note.replyToNoteId) return acc;
    if (!acc[note.replyToNoteId]) {
      acc[note.replyToNoteId] = [];
    }
    acc[note.replyToNoteId].push(note);
    return acc;
  }, {});

  const handleAdd = async () => {
    if (!text.trim()) return;
    const operationNow = Date.now();
    const newNote: CoNote = {
      id: operationNow.toString(),
      authorId: 'user',
      content: text,
      timestamp: operationNow,
      isCompleted: false,
    };
    updateSpace({ coNotes: [newNote, ...allNotes] });
    await recordSettlement(scopedPartnerId, {
      type: 'co_note',
      content: newNote.content,
      timestamp: operationNow,
      authorRole: 'user',
    });
    setText('');

    try {
      const memoSettings = getCoupleSpaceMemoSettings(coupleSpace);
      if (memoSettings.writeCoNote.enabled) {
        const commonInputEnvelope = createCoupleSpacePromptCommonInput({
          source: {
            user,
            partner,
            coupleSpace,
            perception: coupleSpace.perception,
            chatHistory,
            masks,
            worldBooks,
            settings: {
              initiativeSettings: coupleSpace.initiativeSettings,
            },
            now: operationNow,
          },
          scene: {
            mode: 'passive',
            actionType: 'write_co_note',
          },
        });

        const responseText = await generateCoupleCoNote(settings, {
          ...commonInputEnvelope.common,
          coNoteContext: {
            userNoteContent: newNote.content,
            noteThemeHint: '接住 user 刚写下的这条互记，像在这条互记下面顺手回一句简短自然的话。',
            maxLength: 20,
          },
        });

        if (responseText) {
          setTimeout(() => {
            const aiReply: CoNote = {
              id: Date.now().toString() + '_ai',
              authorId: partner.id,
              content: responseText,
              timestamp: Date.now(),
              isCompleted: false,
              replyToNoteId: newNote.id,
              replyToAuthorId: newNote.authorId,
              replyToAuthorName: user.name,
            };
            updateSpaceForPartner(scopedPartnerId, (prev: any) => ({
              coNotes: [...(prev.coNotes || []), aiReply],
            }));
            void recordSettlement(scopedPartnerId, {
              type: 'co_note',
              content: aiReply.content,
              timestamp: aiReply.timestamp,
              authorRole: 'partner',
            });
          }, 2000);
        }
        return;
      }

      /* Legacy co-note prompt path retained only as historical reference after migration.
      const activeConfig = settings.configs.find((c: any) => c.id === settings.activeConfigId) || settings.configs[0];
      if (memoSettings.writeCoNote.enabled && activeConfig.apiKey) {
        const prompt = `你扮演 ${partner.name}，${partner.corePersona || '未提供人设'}。
我和你正在使用情侣空间的“情侣互记”功能，记录想一起做的事情。
我刚刚写了一条互记：“${newNote.content}”
请你像在这条互记下面顺手回复我一样，接一句回应，简短自然，20字以内。`;
        const responseText = await generateTextWithConfig({
          activeConfig,
          prompt,
          temperature: 0.9,
        });
        if (responseText) {
          setTimeout(() => {
            const aiReply: CoNote = {
              id: Date.now().toString() + '_ai',
              authorId: partner.id,
              content: responseText,
              timestamp: Date.now(),
              isCompleted: false,
              replyToNoteId: newNote.id,
              replyToAuthorId: newNote.authorId,
              replyToAuthorName: user.name,
            };
            updateSpace((prev: any) => ({
              coNotes: [...(prev.coNotes || []), aiReply],
            }));
          }, 2000);
        }
      }
      */
    } catch (e) {
      console.error(e);
    }
  };

  const toggleNote = (id: string) => {
    updateSpace((prev: any) => ({
      coNotes: (prev.coNotes || []).map((n: CoNote) => (n.id === id ? { ...n, isCompleted: !n.isCompleted } : n)),
    }));
  };

  const deleteNote = (id: string) => {
    updateSpace((prev: any) => ({
      coNotes: (prev.coNotes || []).filter((n: CoNote) => n.id !== id && n.replyToNoteId !== id),
    }));
  };

  const archiveNote = (id: string) => {
    updateSpace((prev: any) => ({
      coNotes: (prev.coNotes || []).map((n: CoNote) =>
        n.id === id || n.replyToNoteId === id
          ? { ...n, isArchived: true, isPinned: false }
          : n,
      ),
    }));
  };

  const renderNoteMeta = (note: CoNote) => {
    const author = note.authorId === 'user' ? user : partner;
    return (
      <div className="mt-2 flex items-center gap-2">
        <div className="relative h-4 w-4">
          <ResolvedImage value={author.avatar} className="h-full w-full rounded-full object-cover" alt={author.name} />
          {note.authorId === 'user' && (
            <ResolvedImage value={coupleSpace.userAvatarFrame} className="absolute inset-0 h-full w-full scale-[1.2] object-cover pointer-events-none" alt="" />
          )}
          {note.authorId !== 'user' && (
            <ResolvedImage value={coupleSpace.partnerAvatarFrame} className="absolute inset-0 h-full w-full scale-[1.2] object-cover pointer-events-none" alt="" />
          )}
        </div>
        <span className="text-[11px] text-zinc-400">{new Date(note.timestamp).toLocaleDateString()}</span>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 flex-1 flex flex-col w-full overflow-y-auto pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] no-scrollbar">
      <div className="mb-4 flex gap-2 shrink-0">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="写下想一起做的事..."
          className="flex-1 rounded-full border border-white bg-white/80 px-4 py-3 text-sm outline-none shadow-sm backdrop-blur-md"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd} className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-300 text-white shadow-md shadow-rose-200/50 transition-transform active:scale-95">
          <Plus size={20} />
        </button>
      </div>
      <div className="space-y-3 pb-20">
        {topLevelNotes.map((note: CoNote) => {
          const replies = (repliesByNoteId[note.id] || []).sort((a, b) => a.timestamp - b.timestamp);
          return (
            <div
              key={note.id}
              className={
                'flex items-start gap-3 rounded-2xl border border-white bg-white/80 p-4 shadow-sm backdrop-blur-md transition-opacity ' +
                (note.isCompleted ? 'opacity-60' : '')
              }
            >
              <button
                onClick={() => toggleNote(note.id)}
                className={
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ' +
                  (note.isCompleted ? 'border-zinc-800 bg-zinc-800 text-white' : 'border-zinc-300')
                }
              >
                {note.isCompleted && <Heart size={14} className="fill-white" />}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={
                    'text-[15px] text-zinc-800 ' +
                    (note.isCompleted ? 'text-zinc-500 line-through' : '')
                  }
                >
                  {note.content}
                </p>
                {renderNoteMeta(note)}

                {replies.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-2xl bg-zinc-50/80 p-3">
                    {replies.map((reply) => (
                      <div key={reply.id} className="rounded-xl bg-white/90 px-3 py-2 shadow-sm">
                        <p className="text-[14px] text-zinc-700">{reply.content}</p>
                        {renderNoteMeta(reply)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => archiveNote(note.id)} className="p-2 text-zinc-300 hover:text-rose-400">
                  <Archive size={16} />
                </button>
                <button onClick={() => deleteNote(note.id)} className="p-2 text-zinc-300 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
        {topLevelNotes.length === 0 && (
          <div className="mt-10 text-center text-zinc-400">还没有互记，写下第一条想一起做的事吧。</div>
        )}
      </div>
    </motion.div>
  );
}

function LedgerView({ coupleSpace, updateSpace, recordSettlement, user, partner }: any) {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [payer, setPayer] = useState<'user' | 'partner'>('user');

  const handleAdd = async () => {
    if (!amount || isNaN(Number(amount)) || !desc.trim()) return;
    const newEntry: LedgerEntry = {
      id: Date.now().toString(),
      payerId: payer === 'user' ? 'user' : partner.id,
      amount: Number(amount),
      description: desc,
      timestamp: Date.now()
    };
    updateSpace({ ledger: [newEntry, ...(coupleSpace.ledger || [])] });
    await recordSettlement(coupleSpace.partnerId || partner.id, {
      type: 'ledger',
      content: `${payer === 'user' ? user.name : partner.name} 记了一笔：${newEntry.description} ${newEntry.amount}`,
      timestamp: newEntry.timestamp,
      authorRole: payer === 'user' ? 'user' : 'partner',
    });
    setAmount('');
    setDesc('');
  };

  const deleteEntry = (id: string) => {
    updateSpace((prev: any) => ({ 
      ledger: (prev.ledger || []).filter((l: LedgerEntry) => l.id !== id) 
    }));
  };

  const totalUser = (coupleSpace.ledger || []).filter((l: LedgerEntry) => l.payerId === 'user').reduce((sum: number, l: LedgerEntry) => sum + l.amount, 0);
  const totalPartner = (coupleSpace.ledger || []).filter((l: LedgerEntry) => l.payerId !== 'user').reduce((sum: number, l: LedgerEntry) => sum + l.amount, 0);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 flex-1 flex flex-col w-full overflow-y-auto pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] no-scrollbar">
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-5 shadow-sm border border-white mb-4 flex justify-between items-center shrink-0">
        <div className="text-center flex-1">
          <div className="relative w-10 h-10 mx-auto mb-2">
            <ResolvedImage value={user.avatar} className="w-full h-full rounded-full object-cover" alt={user.name} />
            <ResolvedImage value={coupleSpace.userAvatarFrame} className="absolute inset-0 w-full h-full object-cover scale-[1.2] pointer-events-none" alt="" />
          </div>
          <div className="text-xs text-zinc-500">我支出</div>
          <div className="font-bold text-zinc-800">￥{totalUser.toFixed(2)}</div>
        </div>
        <div className="w-px h-12 bg-zinc-200 mx-4" />
        <div className="text-center flex-1">
          <div className="relative w-10 h-10 mx-auto mb-2">
            <ResolvedImage value={partner.avatar} className="w-full h-full rounded-full object-cover" alt={partner.name} />
            <ResolvedImage value={coupleSpace.partnerAvatarFrame} className="absolute inset-0 w-full h-full object-cover scale-[1.2] pointer-events-none" alt="" />
          </div>
          <div className="text-xs text-zinc-500">{partner.name}支出</div>
          <div className="font-bold text-zinc-800">￥{totalPartner.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white mb-4 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setPayer('user')}
            className={
              'flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ' +
              (payer === 'user' ? 'bg-[#f6b6cd] text-white shadow-md shadow-[#f6b6cd]/30' : 'bg-zinc-100 text-zinc-500')
            }
          >
            我付的
          </button>
          <button
            onClick={() => setPayer('partner')}
            className={
              'flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ' +
              (payer === 'partner' ? 'bg-[#f6b6cd] text-white shadow-md shadow-[#f6b6cd]/30' : 'bg-zinc-100 text-zinc-500')
            }
          >
            {partner.name}付的
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="金额" className="flex-1 min-w-[80px] bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-2.5 text-sm outline-none focus:border-[#f6b6cd]" />
          <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="用途..." className="flex-[2] min-w-[120px] bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-2.5 text-sm outline-none focus:border-[#f6b6cd]" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} className="bg-[#f6b6cd] text-white px-5 py-2.5 rounded-2xl font-bold shadow-md shadow-[#f6b6cd]/30 active:scale-95 transition-transform">记</button>
        </div>
      </div>

      <div className="space-y-2 pb-20">
        {(coupleSpace.ledger || []).map((entry: LedgerEntry) => {
          const isUser = entry.payerId === 'user';
          return (
            <div key={entry.id} className="bg-white/60 backdrop-blur-sm rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={
                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ' +
                    (isUser ? 'bg-[#f6b6cd]' : 'bg-[#efadc7]')
                  }
                >
                  {isUser ? '我' : 'TA'}
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-800">{entry.description}</div>
                  <div className="text-[10px] text-zinc-400">{new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-[#d98cab]">￥{entry.amount.toFixed(2)}</span>
                <button onClick={() => deleteEntry(entry.id)} className="text-zinc-300 hover:text-[#f6b6cd]"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function LoveLettersView({ coupleSpace, updateSpace, updateSpaceForPartner, recordSettlement, user, partner, settings, chatHistory, masks = [], worldBooks = [], onOpenLetter }: any) {
  const [writing, setWriting] = useState(false);
  const [content, setContent] = useState('');
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [expandedLetterId, setExpandedLetterId] = useState<string | null>(null);
  const scopedPartnerId = coupleSpace.partnerId || partner.id;
  const { resolvedUrl: resolvedLoveLetterPaperBgUrl } = useResolvedPersistentValue(coupleSpace.loveLetterPaperBg);
  const { resolvedUrl: resolvedLoveLetterEnvelopeBgUrl } = useResolvedPersistentValue(coupleSpace.loveLetterEnvelopeBg);
  const allLetters: LoveLetter[] = coupleSpace.loveLetters || [];
  const activeLetters = sortPinnedByTimestampDesc(
    allLetters.filter((letter: LoveLetter) => !letter.isArchived),
  );

  const startWriting = () => {
    setContent('Dear: \n\n');
    setWriting(true);
  };

  const handleSend = async () => {
    if (!content.trim()) return;
    const operationNow = Date.now();
    const newLetter: LoveLetter = {
      id: operationNow.toString(),
      authorId: 'user',
      content,
      timestamp: operationNow,
      comments: []
    };
    const updatedLetters = [newLetter, ...(coupleSpace.loveLetters || [])];
    updateSpace({ loveLetters: updatedLetters });
    await recordSettlement(scopedPartnerId, {
      type: 'love_letter',
      content: newLetter.content,
      timestamp: operationNow,
      authorRole: 'user',
    });
    setWriting(false);
    setContent('');

    // AI Partner replies with a comment or a new letter
    try {
      if (!getCoupleSpaceInteractionSettings(coupleSpace).replyLoveLetter.enabled) {
        return;
      }

      const commonInputEnvelope = createCoupleSpacePromptCommonInput({
        source: {
          user,
          partner,
          coupleSpace,
          perception: coupleSpace.perception,
          chatHistory,
          masks,
          worldBooks,
            settings: {
              initiativeSettings: coupleSpace.initiativeSettings,
            },
            now: operationNow,
          },
          scene: {
            mode: 'passive',
            actionType: 'reply_love_letter',
        },
      });

      const responseText = await generateCoupleLoveLetterReply(settings, {
        ...commonInputEnvelope.common,
        loveLetterReplyContext: {
          receivedLetterContent: newLetter.content,
          replyIntent: '回复 user 刚写下的情书，像真正收到信后的回信',
        },
      });
      if (responseText) {
        setTimeout(() => {
          const aiComment = {
            id: Date.now().toString() + '_ai',
            authorId: partner.id,
            content: responseText,
            timestamp: Date.now()
          };
          updateSpaceForPartner(scopedPartnerId, (prev: any) => ({
            loveLetters: (prev.loveLetters || []).map((l: LoveLetter) =>
              l.id === newLetter.id ? { ...l, comments: [...(l.comments || []), aiComment] } : l
            )
          }));
          void recordSettlement(scopedPartnerId, {
            type: 'comment_reply',
            content: aiComment.content,
            timestamp: aiComment.timestamp,
            authorRole: 'partner',
          });
        }, 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleComment = async (letterId: string) => {
    if (!commentText.trim()) return;
    const now = Date.now();
    const newComment = {
      id: now.toString(),
      authorId: 'user',
      content: commentText,
      timestamp: now
    };
    updateSpace((prev: any) => ({ 
      loveLetters: (prev.loveLetters || []).map((l: LoveLetter) => 
        l.id === letterId ? { ...l, comments: [...(l.comments || []), newComment] } : l
      ) 
    }));
    await recordSettlement(scopedPartnerId, {
      type: 'comment_reply',
      content: newComment.content,
      timestamp: newComment.timestamp,
      authorRole: 'user',
    });
    setCommentingOn(null);
    setCommentText('');
  };

  const archiveLetter = (id: string) => {
    updateSpace((prev: any) => ({
      loveLetters: (prev.loveLetters || []).map((l: LoveLetter) =>
        l.id === id ? { ...l, isArchived: true, isPinned: false } : l
      )
    }));
    if (expandedLetterId === id) setExpandedLetterId(null);
  };

  const restoreLetter = (id: string) => {
    updateSpace((prev: any) => ({
      loveLetters: (prev.loveLetters || []).map((l: LoveLetter) =>
        l.id === id ? { ...l, isArchived: false } : l
      )
    }));
  };

  const deleteLetter = async (id: string) => {
    if (!(await showInAppConfirm('确定要删除这封情书吗？删除后无法恢复。'))) {
      return;
    }
    updateSpace((prev: any) => ({ 
      loveLetters: (prev.loveLetters || []).filter((l: LoveLetter) => l.id !== id) 
    }));
    if (expandedLetterId === id) setExpandedLetterId(null);
  };

  const pinLetter = (id: string) => {
    updateSpace((prev: any) => ({
      loveLetters: (prev.loveLetters || []).map((l: LoveLetter) =>
        l.id === id ? { ...l, isPinned: true } : l
      )
    }));
  };

  const unpinLetter = (id: string) => {
    updateSpace((prev: any) => ({
      loveLetters: (prev.loveLetters || []).map((l: LoveLetter) =>
        l.id === id ? { ...l, isPinned: false } : l
      )
    }));
  };

  const paperStyle = coupleSpace.loveLetterPaperTexture === 'vintage' ? {
    bg: resolvedLoveLetterPaperBgUrl ? "url('" + resolvedLoveLetterPaperBgUrl + "')" : 'none',
    bgColor: 'bg-[#f4ecd8]',
    overlay: 'https://www.transparenttextures.com/patterns/old-paper.png',
    overlayOpacity: 'opacity-[0.08]',
    lineColor: '#d4c4a8'
  } : coupleSpace.loveLetterPaperTexture === 'grid' ? {
    bg: resolvedLoveLetterPaperBgUrl ? "url('" + resolvedLoveLetterPaperBgUrl + "')" : 'none',
    bgColor: 'bg-white',
    overlay: 'https://www.transparenttextures.com/patterns/graphy.png',
    overlayOpacity: 'opacity-[0.05]',
    lineColor: '#e5e7eb'
  } : coupleSpace.loveLetterPaperTexture === 'floral' ? {
    bg: resolvedLoveLetterPaperBgUrl ? "url('" + resolvedLoveLetterPaperBgUrl + "')" : 'none',
    bgColor: 'bg-[#fff9fb]',
    overlay: 'https://www.transparenttextures.com/patterns/flowers.png',
    overlayOpacity: 'opacity-[0.1]',
    lineColor: '#fbcfe8'
  } : {
    bg: resolvedLoveLetterPaperBgUrl ? "url('" + resolvedLoveLetterPaperBgUrl + "')" : 'none',
    bgColor: 'bg-[#fdf7f9]',
    overlay: 'https://www.transparenttextures.com/patterns/paper-fibers.png',
    overlayOpacity: 'opacity-[0.03]',
    lineColor: '#ebcad4'
  };

  if (writing) {
    return (
      <div className="px-4 flex-1 flex flex-col w-full relative">
        <div
          className={'flex-1 ' + paperStyle.bgColor + ' rounded-2xl p-8 shadow-xl border border-[#f5e6d3] relative overflow-hidden'}
          style={{ backgroundImage: paperStyle.bg, backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <textarea 
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="亲爱的，我想对你说..."
            className="w-full h-full bg-transparent text-zinc-800 outline-none resize-none font-serif text-lg relative z-10"
            autoFocus
          />
        </div>
        <div className="flex justify-between items-center mt-4 mb-2">
          <button onClick={() => setWriting(false)} className="text-zinc-500 font-bold px-4 py-2">取消</button>
          <button onClick={handleSend} className="bg-rose-300 text-white px-8 py-2 rounded-full font-bold shadow-lg shadow-rose-200/50 active:scale-95 transition-transform">发送</button>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 flex-1 flex flex-col w-full relative overflow-y-auto pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] no-scrollbar">
      <div className="mb-4 text-[13px] font-medium text-zinc-400">
        当前 {activeLetters.length} 封
      </div>
      <div className="space-y-6">
        {activeLetters.map((letter: LoveLetter) => {
          const author = letter.authorId === 'user' ? user : partner;

          return (
            <div key={letter.id} className="relative">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onOpenLetter(letter.id)}
                className="cursor-pointer group"
              >
                {/* Envelope UI */}
                <div 
                  className="rounded-xl shadow-lg p-1 relative overflow-hidden aspect-[3/2] flex flex-col items-center justify-center border-2 border-black/5"
                  style={{ backgroundColor: coupleSpace.loveLetterEnvelopeColor || '#f5e6d3' }}
                >
                  {resolvedLoveLetterEnvelopeBgUrl && (
                    <img src={resolvedLoveLetterEnvelopeBgUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 z-0" alt="" />
                  )}
                  {/* Envelope Flap */}
                  <div className="absolute top-0 left-0 right-0 h-1/2 bg-black/5 rounded-b-[50%] shadow-inner z-10" />
                  
                  <div className="relative z-20 flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full border-2 border-white shadow-md overflow-hidden">
                      <ResolvedImage value={author.avatar} className="w-full h-full object-cover" alt={author.name} />
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                      <span className="text-xs font-bold text-zinc-700">{author.name} 的情书</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-medium">{new Date(letter.timestamp).toLocaleDateString()}</span>
                  </div>

                  {letter.isPinned && (
                    <div className="absolute top-4 left-4 z-30 rounded-full bg-white/85 p-1.5 shadow-sm">
                      <Pin size={14} className="fill-rose-300 text-rose-300" />
                    </div>
                  )}

                  {/* Heart Seal */}
                  <div className="absolute bottom-4 right-4 z-30 opacity-40 group-hover:opacity-100 transition-opacity">
                    <Heart size={24} className="text-rose-300 fill-rose-300" />
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
        {!activeLetters.length && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen size={32} className="text-rose-200" />
            </div>
            <p className="text-zinc-400 font-medium">还没有情书哦，给 TA 写一封吧！</p>
          </div>
        )}
      </div>

      {/* Full Screen Expanded Letter Modal */}
      <AnimatePresence>
        {expandedLetterId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setExpandedLetterId(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.9 }}
              className={'w-full max-w-[340px] h-[70vh] ' + paperStyle.bgColor + ' rounded-lg shadow-2xl border border-[#f5e6d3] overflow-hidden flex flex-col relative'}
              style={{ backgroundImage: paperStyle.bg, backgroundSize: 'cover', backgroundPosition: 'center' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close Button */}
              <button 
                onClick={() => setExpandedLetterId(null)} 
                className="absolute top-4 right-4 z-50 p-2 bg-black/5 rounded-full text-zinc-500 active:scale-90 transition-transform"
              >
                <X size={20} />
              </button>

              {/* Paper Content */}
              <div className="flex-1 overflow-y-auto p-10 relative z-10 no-scrollbar">
                {(() => {
                  const letter = allLetters.find((l: any) => l.id === expandedLetterId);
                  if (!letter) return null;
                  return (
                    <div className="relative z-10 pt-4">
                      <p className="text-[17px] text-zinc-800 whitespace-pre-wrap leading-relaxed font-serif">{letter.content}</p>
                    </div>
                  );
                })()}
              </div>
              
              {/* Comments & Actions */}
              <div className="bg-[#fcf9f2] border-t border-[#f5e6d3] p-6 relative z-10">
                {(() => {
                  const letter = allLetters.find((l: any) => l.id === expandedLetterId);
                  if (!letter) return null;
                  return (
                    <>
                      <div className="space-y-4 mb-6 max-h-40 overflow-y-auto no-scrollbar">
                        {letter.comments.map((c: any) => {
                          const cAuthor = c.authorId === 'user' ? user : partner;
                          return (
                            <div key={c.id} className="flex gap-3">
                              <ResolvedImage value={cAuthor.avatar} className="w-7 h-7 rounded-full shrink-0 shadow-sm border border-white" alt={cAuthor.name} />
                              <div className="bg-white rounded-2xl rounded-tl-none px-4 py-2 shadow-sm border border-[#f5e6d3] text-sm text-zinc-700 max-w-[80%]">
                                {c.content}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {commentingOn === letter.id ? (
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="写下你的回复..."
                            className="flex-1 bg-white border border-[#f5e6d3] rounded-full px-4 py-2.5 text-sm outline-none focus:border-zinc-800 shadow-inner"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleComment(letter.id)}
                          />
                          <button
                            onClick={() => handleComment(letter.id)}
                            className="rounded-full border border-[#d9e6f7] bg-[#eef5ff] p-2.5 text-[#4b6788] shadow-lg shadow-[#dbe7f7]/60 active:scale-90 transition-transform"
                          >
                            <Send size={20} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div className="flex gap-6">
                            <button onClick={() => setCommentingOn(letter.id)} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-500 font-bold transition-colors">
                              <MessageCircle size={20} />
                              <span>评论</span>
                            </button>
                          </div>
                          <div className="flex items-center gap-1 text-zinc-800">
                            <Heart size={20} className="fill-current" />
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={startWriting}
        className="fixed bottom-6 right-6 w-14 h-14 bg-rose-300 text-white rounded-full shadow-lg shadow-rose-200/50 flex items-center justify-center active:scale-90 transition-transform z-30"
      >
        <Plus size={28} />
      </button>
    </motion.div>
  );
}

function PostFeedView({ coupleSpace, updateSpace, updateSpaceForPartner, recordSettlement, user, partner, settings, onBack, chatHistory, masks, worldBooks }: any) {
  const [content, setContent] = useState('');
  const [imgUrls, setImgUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const scopedPartnerId = coupleSpace.partnerId || partner.id;
  const { setRemoteUrl, setUploadedFile } = usePersistentFieldActions();

  const handlePost = async () => {
    if (!content.trim() && imgUrls.length === 0) return;
    const operationNow = Date.now();
    const newPost = {
      id: operationNow.toString(),
      authorId: 'user',
      content,
      images: imgUrls,
      timestamp: operationNow,
      likes: [],
      comments: []
    };
    updateSpace((prev: any) => ({
      posts: [newPost, ...(prev.posts || [])]
    }));
    await recordSettlement(scopedPartnerId, {
      type: 'post',
      content: newPost.content || (newPost.images?.length ? '发了一条带图片的情侣动态' : ''),
      timestamp: operationNow,
      authorRole: 'user',
    });
    const nextCoupleSpaceForPrompt = {
      ...coupleSpace,
      posts: [newPost, ...(coupleSpace.posts || [])],
    };
    setContent('');
    setImgUrls([]);
    setUrlInput('');
    onBack();

    // AI Partner might comment on the new post
    try {
      const interactionSettings = getCoupleSpaceInteractionSettings(coupleSpace);
      if (interactionSettings.reactToExistingPost.enabled) {
        const commonInputEnvelope = createCoupleSpacePromptCommonInput({
          source: {
            user,
            partner,
            coupleSpace: nextCoupleSpaceForPrompt,
            perception: nextCoupleSpaceForPrompt.perception,
            chatHistory,
            masks,
            worldBooks,
            settings: {
              initiativeSettings: coupleSpace.initiativeSettings,
            },
            now: operationNow,
          },
          scene: {
            mode: 'passive',
            actionType: 'react_to_existing_post',
          },
        });

        const responseText = await generateCoupleDailyComment(settings, {
          ...commonInputEnvelope.common,
          dailyCommentContext: {
            coupleDailyContent: newPost.content,
            contentAuthor: 'user',
            commentIntent: '留一句贴合这个角色本人、短而自然的动态评论',
            maxLength: 30,
          },
        });
        if (responseText) {
          setTimeout(() => {
            const aiComment = {
              id: Date.now().toString() + '_ai',
              authorId: partner.id,
              content: responseText,
              timestamp: Date.now()
            };
            updateSpaceForPartner(scopedPartnerId, (prev: any) => ({
              posts: (prev.posts || []).map((p: any) => 
                p.id === newPost.id ? { ...p, comments: [...(p.comments || []), aiComment] } : p
              )
            }));
            void recordSettlement(scopedPartnerId, {
              type: 'comment_reply',
              content: aiComment.content,
              timestamp: aiComment.timestamp,
              authorRole: 'partner',
            });
          }, 3000);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="px-4 flex-1 flex flex-col w-full overflow-y-auto pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] no-scrollbar">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <span className="font-bold text-zinc-800">发布动态</span>
        <button onClick={handlePost} className="bg-rose-300 text-white px-5 py-1.5 rounded-full font-bold shadow-sm shadow-rose-200/50 active:scale-95 transition-transform">发布</button>
      </div>
      <textarea 
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="这一刻的想法..."
        className="w-full bg-white rounded-2xl p-4 text-zinc-800 outline-none resize-none h-32 shadow-sm border border-zinc-100 mb-4"
      />
      <div className="flex flex-wrap gap-2 mb-4">
        {imgUrls.map((url, idx) => (
          <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden shadow-sm border border-zinc-100">
            <ResolvedImage value={url} className="w-full h-full object-cover" alt="" />
            <button 
              onClick={() => setImgUrls(imgUrls.filter((_, i) => i !== idx))}
              className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {imgUrls.length < 9 && (
          <>
            <button 
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="w-20 h-20 bg-white rounded-xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-zinc-400 hover:bg-zinc-50 transition-colors"
            >
              <Plus size={20} />
              <span className="text-[10px] mt-1">Add URL</span>
            </button>
            <label className="w-20 h-20 bg-white rounded-xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-zinc-400 hover:bg-zinc-50 transition-colors cursor-pointer">
              <ImageIcon size={20} />
              <span className="text-[10px] mt-1">Upload</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const inputElement = e.currentTarget;
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  const persistedValues = await Promise.all(files.slice(0, 9 - imgUrls.length).map((file) => setUploadedFile(file)));
                  setImgUrls((prev) => [...prev, ...persistedValues].slice(0, 9));
                  inputElement.value = '';
                }}
              />
            </label>
          </>
        )}
      </div>

      {showUrlInput && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-zinc-500">添加图片链接</span>
            <button onClick={() => setShowUrlInput(false)} className="text-zinc-400 hover:text-zinc-600">
              <X size={14} />
            </button>
          </div>
          <textarea 
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="支持输入图片链接、Markdown 图片格式或 HTML img 标签"
            className="w-full h-24 bg-zinc-50 rounded-xl p-3 text-sm outline-none border border-zinc-100 mb-3 resize-none"
          />
          <button 
            onClick={async () => {
              const urls = extractImageUrls(urlInput);
              if (urls.length > 0) {
                const normalizedUrls = await Promise.all(urls.map((url) => setRemoteUrl(url)));
                setImgUrls(prev => [...prev, ...normalizedUrls].slice(0, 9));
                setUrlInput('');
                setShowUrlInput(false);
              }
            }}
            className="w-full rounded-xl border border-[#d9e6f7] bg-[#eef5ff] py-2 text-sm font-bold text-[#4b6788] active:scale-95"
          >
            确认添加
          </button>
        </div>
      )}
    </motion.div>
  );
}

function AnniversariesView({ coupleSpace, updateSpace, user, partner }: any) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleAdd = () => {
    if (!title.trim() || !date) return;
    const newAnniv = {
      id: Date.now().toString(),
      title,
      date,
      isCountdown: new Date(date).getTime() > Date.now()
    };
    updateSpace((prev: any) => ({
      anniversaries: [...(prev.anniversaries || []), newAnniv].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }));
    setTitle('');
  };

  const deleteAnniv = (id: string) => {
    updateSpace((prev: any) => ({
      anniversaries: (prev.anniversaries || []).filter((a: any) => a.id !== id)
    }));
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 flex-1 flex flex-col w-full overflow-y-auto pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] no-scrollbar">
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white mb-4 space-y-3 shrink-0">
        <h3 className="font-bold text-zinc-800 text-sm">添加纪念日</h3>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="纪念日名称（如：TA 的生日）" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#f6b6cd]" />
        <div className="flex gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#f6b6cd]" />
          <button onClick={handleAdd} className="bg-[#f6b6cd] text-white px-4 rounded-xl font-bold shadow-sm shadow-[#f6b6cd]/40 active:scale-95">添加</button>
        </div>
      </div>

      <div className="space-y-3 pb-20">
        {(coupleSpace.anniversaries || []).map((anniv: any) => {
          const targetTime = new Date(anniv.date).getTime();
          const now = Date.now();
          const diffDays = Math.ceil(Math.abs(targetTime - now) / (1000 * 60 * 60 * 24));
          const isFuture = targetTime > now;

          return (
            <div key={anniv.id} className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100 flex items-center justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#f6b6cd]" />
              <div className="pl-2">
                <div className="font-bold text-zinc-800 mb-1">{anniv.title}</div>
                <div className="text-xs text-zinc-500">{anniv.date}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 mb-0.5">{isFuture ? '还有' : '已经'}</div>
                <div className="text-[#d98cab] font-bold"><span className="text-2xl">{diffDays}</span> 天</div>
              </div>
              <button onClick={() => deleteAnniv(anniv.id)} className="absolute top-2 right-2 text-zinc-200 hover:text-[#f6b6cd]">
                <X size={14} />
              </button>
            </div>
          );
        })}
        {(!coupleSpace.anniversaries || coupleSpace.anniversaries.length === 0) && (
          <div className="text-center text-zinc-400 mt-10">还没有添加纪念日哦</div>
        )}
      </div>
    </motion.div>
  );
}

function MessageBoardView({ coupleSpace, updateSpace, updateSpaceForPartner, recordSettlement, user, partner, settings, chatHistory, masks, worldBooks }: any) {
  const [content, setContent] = useState('');
  const scopedPartnerId = coupleSpace.partnerId || partner.id;
  const visibleMessages = sortPinnedByTimestampDesc(
    (coupleSpace.messageBoard || []).filter((msg: any) => !msg.isArchived)
  );

  const handleLeaveMessage = async () => {
    if (!content.trim()) return;
    const operationNow = Date.now();
    const newMsg = {
      id: operationNow.toString(),
      authorId: 'user',
      content,
      timestamp: operationNow
    };
    updateSpace((prev: any) => ({
      messageBoard: [newMsg, ...(prev.messageBoard || [])]
    }));
    await recordSettlement(scopedPartnerId, {
      type: 'message_board',
      content: newMsg.content,
      timestamp: operationNow,
      authorRole: 'user',
    });
    setContent('');

    // AI Partner might reply
    try {
      const interactionSettings = getCoupleSpaceInteractionSettings(coupleSpace);
      if (interactionSettings.replyMessageBoard.enabled) {
        const commonInputEnvelope = createCoupleSpacePromptCommonInput({
          source: {
            user,
            partner,
            coupleSpace,
            perception: coupleSpace.perception,
            chatHistory,
            masks,
            worldBooks,
            settings: {
              initiativeSettings: coupleSpace.initiativeSettings,
            },
            now: operationNow,
          },
          scene: {
            mode: 'passive',
            actionType: 'reply_message_board',
          },
        });

        const responseText = await generateCoupleMessageBoardReply(settings, {
          ...commonInputEnvelope.common,
          messageBoardContext: {
            latestUserMessage: newMsg.content,
            boardToneHint: '接住 user 刚留在留言板里的这句话，像空间里顺手回的一句温柔留言',
            maxLength: 30,
          },
        });
        if (responseText) {
          setTimeout(() => {
            const aiMsg = {
              id: Date.now().toString() + '_ai',
              authorId: partner.id,
              content: responseText,
              timestamp: Date.now()
            };
            updateSpaceForPartner(scopedPartnerId, (prev: any) => ({
              messageBoard: [aiMsg, ...(prev.messageBoard || [])]
            }));
            void recordSettlement(scopedPartnerId, {
              type: 'message_board',
              content: aiMsg.content,
              timestamp: aiMsg.timestamp,
              authorRole: 'partner',
            });
          }, 2000);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteMessage = (id: string) => {
    updateSpace((prev: any) => ({
      messageBoard: (prev.messageBoard || []).filter((m: any) => m.id !== id)
    }));
  };

  const archiveMessage = (id: string) => {
    updateSpace((prev: any) => ({
      messageBoard: (prev.messageBoard || []).map((m: any) =>
        m.id === id ? { ...m, isArchived: true, isPinned: false } : m
      )
    }));
  };

  const restoreMessage = (id: string) => {
    updateSpace((prev: any) => ({
      messageBoard: (prev.messageBoard || []).map((m: any) =>
        m.id === id ? { ...m, isArchived: false } : m
      )
    }));
  };

  const pinMessage = (id: string) => {
    updateSpace((prev: any) => ({
      messageBoard: (prev.messageBoard || []).map((m: any) =>
        m.id === id ? { ...m, isPinned: true } : m
      )
    }));
  };

  const unpinMessage = (id: string) => {
    updateSpace((prev: any) => ({
      messageBoard: (prev.messageBoard || []).map((m: any) =>
        m.id === id ? { ...m, isPinned: false } : m
      )
    }));
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 flex-1 flex flex-col w-full overflow-y-auto pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] no-scrollbar">
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white mb-4 shrink-0">
        <textarea 
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="留下这次想说的话..."
          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-sm outline-none focus:border-[#f6b6cd] resize-none h-20 mb-3"
        />
        <div className="flex justify-end">
          <button onClick={handleLeaveMessage} className="bg-[#f6b6cd] text-white px-6 py-1.5 rounded-full font-bold shadow-sm shadow-[#f6b6cd]/40 active:scale-95 transition-transform">留言</button>
        </div>
      </div>

      <div className="space-y-4 pb-20">
        {visibleMessages.map((msg: any) => {
          const author = msg.authorId === 'user' ? user : partner;
          return (
            <div key={msg.id} className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100 flex gap-3">
              <div className="relative w-10 h-10 shrink-0">
                <ResolvedImage value={author.avatar} className="w-full h-full rounded-full object-cover" alt={author.name} />
                {msg.authorId === 'user' && (
                  <ResolvedImage value={coupleSpace.userAvatarFrame} className="absolute inset-0 w-full h-full object-cover scale-[1.2] pointer-events-none" alt="" />
                )}
                {msg.authorId !== 'user' && (
                  <ResolvedImage value={coupleSpace.partnerAvatarFrame} className="absolute inset-0 w-full h-full object-cover scale-[1.2] pointer-events-none" alt="" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-bold text-zinc-800 text-sm">{author.name}</div>
                  <div className="text-[10px] text-zinc-400">{new Date(msg.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <p className="text-zinc-700 text-sm whitespace-pre-wrap">{msg.content}</p>
                <div className="mt-2 flex items-center justify-end gap-4 text-right">
                  {msg.isPinned ? (
                    <button onClick={() => unpinMessage(msg.id)} className="text-xs text-rose-300 hover:text-[#f6b6cd]">取消置顶</button>
                  ) : (
                    <button onClick={() => pinMessage(msg.id)} className="text-xs text-zinc-300 hover:text-[#f6b6cd]">置顶</button>
                  )}
                  {msg.isArchived ? (
                    <button onClick={() => restoreMessage(msg.id)} className="text-xs text-zinc-300 hover:text-[#f6b6cd]">恢复</button>
                  ) : (
                    <button onClick={() => archiveMessage(msg.id)} className="text-xs text-zinc-300 hover:text-[#f6b6cd]">归档</button>
                  )}
                  <button onClick={() => deleteMessage(msg.id)} className="text-xs text-zinc-300 hover:text-[#f6b6cd]">删除</button>
                </div>
              </div>
            </div>
          );
        })}
        {visibleMessages.length === 0 && (
          <div className="text-center text-zinc-400 mt-10">留言板空空如也，快来踩一踩吧！</div>
        )}
      </div>
    </motion.div>
  );
}

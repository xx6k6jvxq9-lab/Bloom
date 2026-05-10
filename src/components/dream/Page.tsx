import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { generateDreamAftermath } from '../../services/dream/generateDreamAftermath';
import { buildDreamBackgroundRequestKey, getCurrentDreamBackgroundTask, startDreamBackgroundGeneration } from '../../services/dream/dreamBackgroundGeneration';
import { generateDreamContinuation } from '../../services/dream/generateDreamContinuation';
import { generateDreamEnding } from '../../services/dream/generateDreamEnding';
import { buildDreamPreflightPlan } from '../../services/dream/buildDreamPreflightPlan';
import { buildDreamPromptInput } from '../../services/dream/buildDreamPromptInput';
import { hydrateDreamRuntimeScenario } from '../../services/dream/dreamRuntimeSummaries';
import {
  buildDreamPromptWorldBooks,
  normalizeDreamWorldBookConfig,
  resolveDreamInheritedWorldBooks,
} from '../../services/dream/dreamWorldBooks';
import type {
  DreamCustomTag,
  DreamPreflightPlan,
  DreamRuntimeScenario,
} from '../../services/dream/dreamRuntimeTypes';
import type { ApiConfig, Character, Mask, WorldBookEntry } from '../../types';
import { DreamGenerationModeTriggerButton } from './DreamGenerationModePanel';
import { Shell } from './DreamPagePrimitives';
import type { DreamConfirmPreview, DreamStage } from './dreamPageTypes';
import { DreamConfirmStage, DreamHomeEntryStage } from './DreamSetupStages';
import { DreamTagsStage } from './DreamTagsStage';
import {
  DreamAftermathStage,
  DreamChoiceStage,
  DreamEndingStage,
  DreamLoadingStage,
  DreamReactionStage,
  DreamRolePickerStage,
  DreamSceneStage,
} from './DreamRuntimeStages';
import { DreamArchiveStage } from './DreamArchiveStage';
import {
  type ActiveDreamChoice,
  type DreamAftermathView,
  type DreamEndingView,
  appendDecisionRecord,
  buildCharacterDreamPreset,
  buildCustomVisibleStoryFrame,
  buildPresetEndingView,
  buildQuickDreamPreset,
  buildReactionBlocks,
  buildRoles,
  buildRuntimeAftermathView,
  buildRuntimeEndingView,
  buildSimpleTypewriterBlocks,
  createDecisionRecord,
  debugDreamStagePayload,
  formatDreamTime,
  hasStoryFrameContent,
  upsertDreamAct,
  useNarrativeTypewriter,
} from './dreamPageRuntime';
import { useDreamGenerationModePreference } from './useDreamGenerationModePreference';
import { useDreamWorldBookControls } from './useDreamWorldBookControls';
import { buildDreamArchiveRecord, exportDreamArchiveRecords, getSelectedTagLabels, loadDreamArchiveRecords, saveDreamArchiveRecords, upsertDreamArchiveRecord, type DreamArchiveRecord } from './dreamArchive';
import { defaultTagSelection, dreamTagGroups, resolveDomainName, resolveScenario } from './dreamContent';
import {
  type PersistedDreamSession,
  buildDreamResumableState,
  clearDreamBackgroundResumeRequest,
  clearPersistedDreamSession,
  formatPersistedDreamTime,
  isDreamResumeStage,
  isPersistedDreamUnfinished,
  readPersistedDreamSelectedRoleId,
  readPersistedDreamSession,
  writeDreamBackgroundResumeRequest,
  writePersistedDreamSelectedRoleId,
  writePersistedDreamSession,
} from './dreamSessionPersistence';
import type { DreamDepth, DreamDomainId, DreamEntryMode, DreamTagCategory } from './types';

export function DreamAppPage({
  onBack,
  characters,
  userName,
  activeConfig,
  masks,
  worldBooks,
  resumeBackgroundSignal = 0,
  onResumeBackgroundHandled,
}: {
  onBack: () => void;
  characters: Character[];
  userName: string;
  activeConfig: ApiConfig;
  masks: Mask[];
  worldBooks: WorldBookEntry[];
  resumeBackgroundSignal?: number;
  onResumeBackgroundHandled?: () => void;
}) {
  const roles = useMemo(() => buildRoles(characters), [characters]);
  const [time, setTime] = useState(formatDreamTime);
  const [stage, setStage] = useState<DreamStage>('splash');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(() => readPersistedDreamSelectedRoleId());
  const [entryMode, setEntryMode] = useState<DreamEntryMode>('quick');
  const [selectedDomain, setSelectedDomain] = useState<DreamDomainId>('shared');
  const [dreamDepth, setDreamDepth] = useState<DreamDepth>('shallow');
  const [selectedTags, setSelectedTags] = useState<Record<DreamTagCategory, string[]>>(defaultTagSelection);
  const [customTags, setCustomTags] = useState<DreamCustomTag[]>(() => readPersistedDreamSession()?.customTags || []);
  const [supplementNote, setSupplementNote] = useState(() => readPersistedDreamSession()?.supplementNote || '');
  const [tagBatchIndex, setTagBatchIndex] = useState<Partial<Record<DreamTagCategory, number>>>({});
  const [confirmPreview, setConfirmPreview] = useState<DreamConfirmPreview | null>(null);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [actIndex, setActIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<ActiveDreamChoice | null>(null);
  const [previewChoiceId, setPreviewChoiceId] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [customInputOpen, setCustomInputOpen] = useState(false);
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);
  const [isGeneratingNextAct, setIsGeneratingNextAct] = useState(false);
  const [isEndingDeepDream, setIsEndingDeepDream] = useState(false);
  const [isGeneratingEnding, setIsGeneratingEnding] = useState(false);
  const [isGeneratingAftermath, setIsGeneratingAftermath] = useState(false);
  const [closingActId, setClosingActId] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [runtimeScenario, setRuntimeScenario] = useState<DreamRuntimeScenario | null>(null);
  const [archiveRecords, setArchiveRecords] = useState<DreamArchiveRecord[]>(() => loadDreamArchiveRecords());
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [archiveView, setArchiveView] = useState<'all' | 'deep'>('all');
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [latestSavedSession, setLatestSavedSession] = useState<PersistedDreamSession | null>(() => readPersistedDreamSession());
  const endingRequestActiveRef = useRef(false);
  const aftermathRequestActiveRef = useRef(false);
  const dreamWorldBookImportInputRef = useRef<HTMLInputElement | null>(null);
  const {
    defaultDreamGenerationMode,
    dreamGenerationMode,
    rememberDreamGenerationMode,
    showDreamGenerationModeSheet,
    setDreamGenerationMode,
    setRememberDreamGenerationMode,
    openDreamGenerationModeSheet,
    closeDreamGenerationModeSheet,
    handleSelectDefaultDreamGenerationMode,
    handleClearDefaultDreamGenerationMode,
    handleConfirmDreamMode,
    resetDreamGenerationModeForNewEntry,
    adoptDreamGenerationMode,
  } = useDreamGenerationModePreference();
  const backgroundTask = getCurrentDreamBackgroundTask();
  const persistedLatestSession = readPersistedDreamSession();
  const resumableDream = buildDreamResumableState(persistedLatestSession);
  const selectedCharacter = useMemo(() => characters.find((character) => character.id === selectedRoleId) ?? characters[0] ?? null, [characters, selectedRoleId]);
  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null, [roles, selectedRoleId]);
  const inheritedDreamWorldBooks = useMemo(() => (selectedCharacter ? resolveDreamInheritedWorldBooks(selectedCharacter, worldBooks) : []), [selectedCharacter, worldBooks]);
  const {
    showDreamWorldBookSheet,
    setShowDreamWorldBookSheet,
    setDreamWorldBookConfig,
    normalizedDreamWorldBookConfig,
    dreamWorldBookNote,
    setDreamWorldBookNote,
    openDreamWorldBookSheet,
    closeDreamWorldBookSheet,
    dreamWorldBookImportDrafts,
    showAdvancedDreamWorldBookImportReview,
    setShowAdvancedDreamWorldBookImportReview,
    toggleDreamInheritedWorldBook,
    removeDreamLocalWorldBook,
    closeDreamWorldBookImportReview,
    handleDreamWorldBookImportDefault,
    toggleDreamWorldBookImportDraftInclude,
    updateDreamWorldBookImportDraftMergeGroup,
    confirmReviewedDreamWorldBookImport,
    handleImportDreamWorldBookFile,
    triggerDreamWorldBookImport,
    restoreAllInheritedDreamWorldBooks,
    muteAllInheritedDreamWorldBooks,
    resetDreamWorldBookOverrides,
  } = useDreamWorldBookControls({
    initialConfig: persistedLatestSession?.dreamWorldBookConfig,
    selectedCharacter,
    inheritedDreamWorldBooks,
    dreamWorldBookImportInputRef,
    onRequireRolePicker: () => setStage('role-picker'),
  });
  const dreamPromptWorldBooks = useMemo(
    () => (
      selectedCharacter
        ? buildDreamPromptWorldBooks({
            character: selectedCharacter,
            inheritedWorldBooks: inheritedDreamWorldBooks,
            config: normalizedDreamWorldBookConfig,
          })
        : []
    ),
    [selectedCharacter, inheritedDreamWorldBooks, normalizedDreamWorldBookConfig],
  );
  const hasDreamWorldBookConfig = (
    (normalizedDreamWorldBookConfig.excludedInheritedIds?.length || 0)
    + (normalizedDreamWorldBookConfig.localEntries?.length || 0)
  ) > 0;
  const hasDreamWorldBookSignal = dreamPromptWorldBooks.length > 0;
  const dreamPreflightPlan = useMemo<DreamPreflightPlan | null>(() => {
    if (!selectedCharacter) return null;

    const promptInput = buildDreamPromptInput({
      activeConfig,
      character: selectedCharacter,
      masks,
      worldBooks: dreamPromptWorldBooks,
      dreamWorldBookConfig: normalizedDreamWorldBookConfig,
      selection: {
        entryMode,
        domainId: selectedDomain,
        depth: dreamDepth,
        selectedTags,
        customTags,
        supplementNote,
      },
    });

    return buildDreamPreflightPlan({
      selection: {
        entryMode,
        domainId: selectedDomain,
        depth: dreamDepth,
        selectedTags,
        customTags,
        supplementNote,
      },
      worldBooks: dreamPromptWorldBooks,
      worldBookConflictSummary: promptInput.worldBookConflictSummary,
      affectedWorldBookTitles: promptInput.worldBookConflictAffectedTitles,
      personaFloor: promptInput.personaFloor,
    });
  }, [
    activeConfig,
    customTags,
    dreamDepth,
    dreamPromptWorldBooks,
    entryMode,
    masks,
    normalizedDreamWorldBookConfig,
    selectedCharacter,
    selectedDomain,
    selectedTags,
    supplementNote,
  ]);
  const previewScenario = useMemo(() => resolveScenario(selectedDomain, dreamDepth), [selectedDomain, dreamDepth]);
  const scenario = runtimeScenario ?? previewScenario;
  const act = runtimeScenario?.acts[actIndex] ?? null;
  const choiceAct = stage === 'choices' ? act : null;
  const presentation = runtimeScenario?.presentation ?? {
    accent: 'var(--gold)',
    accentSoft: 'rgba(196,169,106,.12)',
    dialogueText: 'var(--gold-bright)',
    frameBorder: 'rgba(196,169,106,.28)',
    frameFill: 'rgba(13,18,32,.72)',
    layoutId: 'soft-overlay-monologue',
  };
  const storyFrame = runtimeScenario?.storyFrame ?? null;
  const displayStoryFrame = useMemo(
    () => (entryMode === 'custom' ? buildCustomVisibleStoryFrame(storyFrame, selectedTags, customTags) : storyFrame),
    [customTags, entryMode, selectedTags, storyFrame],
  );
  const sceneBlocks = useMemo(() => act?.narrative.pages[0]?.blocks ?? [], [act]);
  const typedSceneBlocks = useNarrativeTypewriter(sceneBlocks, stage === 'scene', `${runtimeScenario?.id || 'preview'}-${act?.id || 'none'}-scene`);
  const hasSceneContent = sceneBlocks.length > 0 && sceneBlocks.some((block) => block.text.trim());
  const sceneReady =
    hasSceneContent
    && typedSceneBlocks.length === sceneBlocks.length
    && typedSceneBlocks.every((block, index) => block.text === sceneBlocks[index]?.text);
  const isDeepDream = runtimeScenario?.depth === 'deep';
  const isClosingAct = Boolean(act && closingActId && act.id === closingActId);
  const isLastGeneratedAct = Boolean(runtimeScenario && actIndex === runtimeScenario.acts.length - 1);
  const endingView = runtimeScenario && selectedRole ? buildRuntimeEndingView(runtimeScenario, selectedRole.name, userName) : buildPresetEndingView(previewScenario);
  const aftermathView = runtimeScenario ? buildRuntimeAftermathView(runtimeScenario) : previewScenario.aftermath;
  const aftermathMetaLine = useMemo(() => {
    const relationshipShift = runtimeScenario?.aftermathInput.relationshipShift?.trim() || '';
    const toneDrift = runtimeScenario?.aftermathInput.toneDrift?.trim() || '';
    const parts = [relationshipShift, toneDrift].filter(Boolean);
    return parts.join(' · ');
  }, [runtimeScenario?.aftermathInput.relationshipShift, runtimeScenario?.aftermathInput.toneDrift]);
  const reactionBlocks = useMemo(() => buildReactionBlocks(selectedChoice, act), [act, selectedChoice]);
  const typedReactionBlocks = useNarrativeTypewriter(
    reactionBlocks,
    stage === 'reaction',
    `${runtimeScenario?.id || 'preview'}-${act?.id || 'none'}-${selectedChoice?.id || 'choice'}-reaction`,
  );
  const reactionReady =
    reactionBlocks.length > 0
    && typedReactionBlocks.length === reactionBlocks.length
    && typedReactionBlocks.every((block, index) => block.text === reactionBlocks[index]?.text);
  const endingTextBlocks = useMemo(
    () => buildSimpleTypewriterBlocks([
      { id: 'ending-body', text: endingView.body || '' },
      { id: 'ending-excerpt', text: endingView.excerpt || '' },
    ]),
    [endingView.body, endingView.excerpt],
  );
  const typedEndingTextBlocks = useNarrativeTypewriter(
    endingTextBlocks,
    stage === 'ending' && Boolean(runtimeScenario?.endingOutput) && !isGeneratingEnding,
    `${runtimeScenario?.id || 'preview'}-${runtimeScenario?.endingOutput?.title || 'ending'}-ending`,
  );
  const endingTextReady =
    Boolean(runtimeScenario?.endingOutput)
    && typedEndingTextBlocks.length === endingTextBlocks.length
    && typedEndingTextBlocks.every((block, index) => block.text === endingTextBlocks[index]?.text);
  const typedEndingBody = typedEndingTextBlocks[0]?.text || '';
  const typedEndingExcerpt = typedEndingTextBlocks[1]?.text || '';
  const aftermathMessageBlocks = useMemo(
    () => buildSimpleTypewriterBlocks(
      aftermathView.previewMessages.map((message, index) => ({
        id: `aftermath-message-${index + 1}`,
        text: message || '',
      })),
    ),
    [aftermathView.previewMessages],
  );
  const typedAftermathMessageBlocks = useNarrativeTypewriter(
    aftermathMessageBlocks,
    stage === 'aftermath' && Boolean(runtimeScenario?.aftermathOutput) && !isGeneratingAftermath,
    `${runtimeScenario?.id || 'preview'}-${runtimeScenario?.aftermathOutput?.summary || 'aftermath'}-messages`,
  );
  const aftermathTextBlocks = useMemo(
    () => buildSimpleTypewriterBlocks([
      { id: 'aftermath-summary', text: aftermathView.summary || '' },
      { id: 'aftermath-detail', text: aftermathView.detail || '' },
    ]),
    [aftermathView.detail, aftermathView.summary],
  );
  const typedAftermathTextBlocks = useNarrativeTypewriter(
    aftermathTextBlocks,
    stage === 'aftermath' && Boolean(runtimeScenario?.aftermathOutput) && !isGeneratingAftermath,
    `${runtimeScenario?.id || 'preview'}-${runtimeScenario?.aftermathOutput?.detail || 'aftermath'}-detail`,
  );
  const aftermathTextReady =
    Boolean(runtimeScenario?.aftermathOutput)
    && typedAftermathMessageBlocks.length === aftermathMessageBlocks.length
    && typedAftermathMessageBlocks.every((block, index) => block.text === aftermathMessageBlocks[index]?.text)
    && typedAftermathTextBlocks.length === aftermathTextBlocks.length
    && typedAftermathTextBlocks.every((block, index) => block.text === aftermathTextBlocks[index]?.text);
  const typedAftermathMessages = typedAftermathMessageBlocks.map((block) => block.text);
  const typedAftermathSummary = typedAftermathTextBlocks[0]?.text || '';
  const typedAftermathDetail = typedAftermathTextBlocks[1]?.text || '';
  const choiceHoldTimerRef = useRef<number | null>(null);

  const persistDreamProgress = (
    scenarioToPersist: DreamRuntimeScenario,
    overrides?: Partial<NonNullable<PersistedDreamSession['progress']>>,
  ) => {
    if (!selectedCharacter) return;

    const progressStage = overrides?.stage ?? stage;
    const nextSession: PersistedDreamSession = {
      resumeKind: 'saved',
      mode: entryMode,
      generationMode: dreamGenerationMode || undefined,
      roleId: selectedCharacter.id,
      domain: selectedDomain,
      depth: dreamDepth,
      selectedTags,
      customTags,
      supplementNote,
      dreamWorldBookConfig: normalizedDreamWorldBookConfig,
      scenario: scenarioToPersist,
      createdAt: Date.now(),
      progress: isDreamResumeStage(progressStage)
        ? {
            stage: progressStage,
            actIndex: overrides?.actIndex ?? actIndex,
            selectedChoice: overrides?.selectedChoice ?? selectedChoice,
            closingActId: overrides?.closingActId ?? closingActId,
            customInput: overrides?.customInput ?? customInput,
            customInputOpen: overrides?.customInputOpen ?? customInputOpen,
          }
        : undefined,
    };

    writePersistedDreamSession(nextSession);
    setLatestSavedSession(nextSession);
  };

  const clearDreamProgress = () => {
    clearPersistedDreamSession();
    clearDreamBackgroundResumeRequest();
    setLatestSavedSession(null);
    setDreamWorldBookConfig(normalizeDreamWorldBookConfig());
    setDreamWorldBookNote(null);
    closeDreamWorldBookSheet();
    closeDreamWorldBookImportReview();
  };

  const refreshLatestSavedSession = () => {
    setLatestSavedSession(readPersistedDreamSession());
  };

  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatDreamTime()), 20000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roles.length) return;
    if (!selectedRoleId || !roles.some((role) => role.id === selectedRoleId)) setSelectedRoleId(roles[0].id);
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (!selectedRoleId) return;
    writePersistedDreamSelectedRoleId(selectedRoleId);
  }, [selectedRoleId]);

  useEffect(() => {
    if (stage !== 'splash') return;
    const timer = window.setTimeout(() => setStage('home'), 3200);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'loading' || !selectedRole || !selectedCharacter) return;
    let cancelled = false;
    setLoadingError(null);
    setRuntimeScenario(null);
    setLoadingProgress(12);
    const progressTimer = window.setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 92) return prev;
        return Math.min(92, prev + 1 + Math.random() * 3.5);
      });
    }, 180);

    const dreamOptions = {
      activeConfig,
      character: selectedCharacter,
      masks,
      worldBooks: dreamPromptWorldBooks,
      dreamWorldBookConfig: normalizedDreamWorldBookConfig,
      generationMode: dreamGenerationMode || undefined,
      selection: {
        entryMode,
        domainId: selectedDomain,
        depth: dreamDepth,
        selectedTags,
        customTags,
        supplementNote,
      },
    } as const;

    startDreamBackgroundGeneration(dreamOptions)
      .then((generatedScenario) => {
        if (cancelled) return;
        window.clearInterval(progressTimer);
        setRuntimeScenario(generatedScenario);
        setLoadingProgress(100);
        setActIndex(0);
        setSelectedChoice(null);
        setClosingActId(null);
        setCustomInput('');
        window.setTimeout(() => {
          if (!cancelled) setStage('scene');
        }, 260);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        window.clearInterval(progressTimer);
        setLoadingProgress(0);
        setLoadingError(error instanceof Error ? error.message : '梦境生成失败');
      });

    return () => {
      cancelled = true;
      window.clearInterval(progressTimer);
    };
  }, [
    activeConfig,
    customTags,
    dreamDepth,
    dreamPromptWorldBooks,
    entryMode,
    masks,
    normalizedDreamWorldBookConfig,
    selectedCharacter,
    selectedDomain,
    selectedRole,
    selectedTags,
    supplementNote,
    stage,
  ]);

  useEffect(() => {
    if (stage !== 'choices') {
      setPreviewChoiceId(null);
      setCustomInputOpen(false);
      if (choiceHoldTimerRef.current) {
        window.clearTimeout(choiceHoldTimerRef.current);
        choiceHoldTimerRef.current = null;
      }
    }
  }, [stage]);

  useEffect(() => {
    if (!resumeBackgroundSignal) return;

    const backgroundTask = getCurrentDreamBackgroundTask();
    if (backgroundTask?.status === 'resolved') {
      const backgroundCharacterId = backgroundTask.options.character.id;
      setSelectedRoleId(backgroundCharacterId);
      setEntryMode(backgroundTask.options.selection.entryMode);
      setSelectedDomain(backgroundTask.options.selection.domainId);
      setDreamDepth(backgroundTask.options.selection.depth);
      setSelectedTags(backgroundTask.options.selection.selectedTags);
      setCustomTags(backgroundTask.options.selection.customTags || []);
      setSupplementNote(backgroundTask.options.selection.supplementNote || '');
      setDreamWorldBookConfig(normalizeDreamWorldBookConfig(backgroundTask.options.dreamWorldBookConfig));
      setDreamWorldBookNote(null);
      setConfirmPreview(null);
      setLoadingError(null);
      setLoadingProgress(100);
      setRuntimeScenario(backgroundTask.scenario);
      adoptDreamGenerationMode(backgroundTask.options.generationMode || null);
      setActIndex(0);
      setSelectedChoice(null);
      setClosingActId(null);
      setCustomInput('');
      setCustomInputOpen(false);
      setStage('scene');
      clearDreamBackgroundResumeRequest();
      onResumeBackgroundHandled?.();
      return;
    }

    const persisted = readPersistedDreamSession();
    if (!persisted || !isPersistedDreamUnfinished(persisted)) {
      onResumeBackgroundHandled?.();
      return;
    }

    setSelectedRoleId(persisted.roleId);
    setEntryMode(persisted.mode);
    setSelectedDomain(persisted.domain);
    setDreamDepth(persisted.depth);
    setSelectedTags(persisted.selectedTags);
    setCustomTags(persisted.customTags || []);
    setSupplementNote(persisted.supplementNote || '');
    setDreamWorldBookConfig(normalizeDreamWorldBookConfig(persisted.dreamWorldBookConfig));
    setDreamWorldBookNote(null);
    setConfirmPreview(null);
    setLoadingError(null);
    setLoadingProgress(100);
    setRuntimeScenario(hydrateDreamRuntimeScenario(persisted.scenario));
    adoptDreamGenerationMode(persisted.generationMode || null);
    setActIndex(persisted.progress?.actIndex ?? 0);
    setSelectedChoice(persisted.progress?.selectedChoice ?? null);
    setClosingActId(persisted.progress?.closingActId ?? null);
    setCustomInput(persisted.progress?.customInput ?? '');
    setCustomInputOpen(persisted.progress?.customInputOpen ?? false);
    setStage(isDreamResumeStage(persisted.progress?.stage) ? persisted.progress.stage : 'scene');
    clearDreamBackgroundResumeRequest();
    onResumeBackgroundHandled?.();
  }, [adoptDreamGenerationMode, onResumeBackgroundHandled, resumeBackgroundSignal]);

  useEffect(() => {
    if (!runtimeScenario?.endingOutput || !selectedCharacter) return;
    const nextRecord = buildDreamArchiveRecord({
      character: selectedCharacter,
      scenario: runtimeScenario,
      selectedTags,
      customTags,
    });
    setArchiveRecords((prev) => {
      const next = upsertDreamArchiveRecord(prev, nextRecord);
      saveDreamArchiveRecords(next);
      return next;
    });
  }, [customTags, runtimeScenario, selectedCharacter, selectedTags, supplementNote]);

  useEffect(() => {
    if (!runtimeScenario?.endingOutput || !runtimeScenario.aftermathOutput) return;
    clearDreamProgress();
  }, [runtimeScenario?.aftermathOutput, runtimeScenario?.endingOutput]);

  useEffect(() => {
    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        refreshLatestSavedSession();
      }
    };

    const handleFocusRefresh = () => {
      refreshLatestSavedSession();
    };

    window.addEventListener('focus', handleFocusRefresh);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);
    return () => {
      window.removeEventListener('focus', handleFocusRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, []);

  useEffect(() => {
    if (!persistedLatestSession) return;
    if (isPersistedDreamUnfinished(persistedLatestSession)) return;
    clearDreamProgress();
  }, [persistedLatestSession]);

  useEffect(() => {
    endingRequestActiveRef.current = isGeneratingEnding;
  }, [isGeneratingEnding]);

  useEffect(() => {
    aftermathRequestActiveRef.current = isGeneratingAftermath;
  }, [isGeneratingAftermath]);

  useEffect(() => {
    if (
      stage !== 'ending'
      || !runtimeScenario
      || !selectedCharacter
      || runtimeScenario.endingOutput
      || endingRequestActiveRef.current
    ) {
      return;
    }

    let cancelled = false;
    setLoadingError(null);
    endingRequestActiveRef.current = true;
    setIsGeneratingEnding(true);
    debugDreamStagePayload('[dream][ending] request:start', {
      scenarioId: runtimeScenario.id,
      stage,
      actCount: runtimeScenario.acts.length,
      hasEndingOutput: Boolean(runtimeScenario.endingOutput),
      endingDirection: runtimeScenario.endingInput?.endingDirection || '',
    });

    generateDreamEnding({
      activeConfig,
      character: selectedCharacter,
      masks,
      worldBooks: dreamPromptWorldBooks,
      selection: {
        entryMode,
        domainId: selectedDomain,
        depth: dreamDepth,
        selectedTags,
        customTags,
        supplementNote,
      },
      scenario: runtimeScenario,
      userName,
    })
      .then((endingOutput) => {
        if (cancelled) return;
        debugDreamStagePayload('[dream][ending] request:resolved', {
          scenarioId: runtimeScenario.id,
          title: endingOutput.title,
          chapter: endingOutput.chapter,
          bodyLength: endingOutput.body.length,
          excerptLength: endingOutput.excerpt.length,
        });
        setRuntimeScenario((prev) => (
          prev
            ? hydrateDreamRuntimeScenario({
                ...prev,
                endingOutput,
              })
            : prev
        ));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[dream][ending] request:failed', error);
        setLoadingError(error instanceof Error ? error.message : '结局生成失败');
      })
      .finally(() => {
        if (!cancelled) {
          debugDreamStagePayload('[dream][ending] request:finalized', {
            scenarioId: runtimeScenario.id,
            cancelled: false,
          });
          endingRequestActiveRef.current = false;
          setIsGeneratingEnding(false);
        }
      });

    return () => {
      cancelled = true;
      debugDreamStagePayload('[dream][ending] request:cleanup', {
        scenarioId: runtimeScenario.id,
      });
    };
  }, [
    activeConfig,
    customTags,
    dreamDepth,
    dreamPromptWorldBooks,
    entryMode,
    masks,
    normalizedDreamWorldBookConfig,
    runtimeScenario,
    selectedCharacter,
    selectedDomain,
    selectedTags,
    supplementNote,
    stage,
    userName,
  ]);

  useEffect(() => {
    if (
      stage !== 'aftermath'
      || !runtimeScenario
      || !selectedCharacter
      || !runtimeScenario.endingOutput
      || runtimeScenario.aftermathOutput
      || aftermathRequestActiveRef.current
    ) {
      return;
    }

    let cancelled = false;
    setLoadingError(null);
    aftermathRequestActiveRef.current = true;
    setIsGeneratingAftermath(true);
    debugDreamStagePayload('[dream][aftermath] request:start', {
      scenarioId: runtimeScenario.id,
      stage,
      hasEndingOutput: Boolean(runtimeScenario.endingOutput),
      hasAftermathOutput: Boolean(runtimeScenario.aftermathOutput),
    });

    generateDreamAftermath({
      activeConfig,
      character: selectedCharacter,
      masks,
      worldBooks: dreamPromptWorldBooks,
      selection: {
        entryMode,
        domainId: selectedDomain,
        depth: dreamDepth,
        selectedTags,
        customTags,
        supplementNote,
      },
      scenario: runtimeScenario,
      userName,
    })
      .then((aftermathOutput) => {
        if (cancelled) return;
        debugDreamStagePayload('[dream][aftermath] request:resolved', {
          scenarioId: runtimeScenario.id,
          summaryLength: aftermathOutput.summary.length,
          detailLength: aftermathOutput.detail.length,
          previewCount: aftermathOutput.previewMessages.length,
        });
        setRuntimeScenario((prev) => (
          prev
            ? hydrateDreamRuntimeScenario({
                ...prev,
                aftermathOutput,
              })
            : prev
        ));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[dream][aftermath] request:failed', error);
        setLoadingError(error instanceof Error ? error.message : '余响生成失败');
      })
      .finally(() => {
        if (!cancelled) {
          debugDreamStagePayload('[dream][aftermath] request:finalized', {
            scenarioId: runtimeScenario.id,
            cancelled: false,
          });
          aftermathRequestActiveRef.current = false;
          setIsGeneratingAftermath(false);
        }
      });

    return () => {
      cancelled = true;
      debugDreamStagePayload('[dream][aftermath] request:cleanup', {
        scenarioId: runtimeScenario.id,
      });
    };
  }, [
    activeConfig,
    customTags,
    dreamDepth,
    dreamPromptWorldBooks,
    entryMode,
    masks,
    normalizedDreamWorldBookConfig,
    runtimeScenario,
    selectedCharacter,
    selectedDomain,
    selectedTags,
    supplementNote,
    stage,
    userName,
  ]);

  const openEntry = () => {
    if (!selectedRole) {
      setStage('role-picker');
      return;
    }
    resetDreamGenerationModeForNewEntry();
    setStage('entry');
  };

  const chooseMode = (mode: DreamEntryMode) => {
    setEntryMode(mode);
    if (mode === 'quick') {
      const preset = buildQuickDreamPreset();
      setSelectedDomain(preset.domainId);
      setDreamDepth(preset.depth);
      setSelectedTags(preset.selectedTags);
      setCustomTags([]);
      setSupplementNote('');
      setConfirmPreview(preset.preview);
      setStage('confirm');
      return;
    }
    if (mode === 'character') {
      const preset = buildCharacterDreamPreset();
      setSelectedDomain(preset.domainId);
      setDreamDepth(preset.depth);
      setSelectedTags(preset.selectedTags);
      setCustomTags([]);
      setSupplementNote('');
      setConfirmPreview(null);
      setStage('confirm');
      return;
    }
    setSelectedDomain('shared');
    setDreamDepth('shallow');
    setCustomTags([]);
    setSupplementNote('');
    setConfirmPreview(null);
    setStage('tags');
  };

  const toggleTag = (category: DreamTagCategory, optionId: string, max: number) => {
    setSelectedTags((prev) => {
      const current = prev[category] ?? [];
      const group = dreamTagGroups.find((item) => item.category === category);
      const isSingleSelect = category === 'world';
      const isUnlimitedDetailed = Boolean(group?.detailed);
      let next: string[];
      if (isSingleSelect) {
        next = [optionId];
      } else if (isUnlimitedDetailed) {
        next = current.includes(optionId)
          ? current.filter((item) => item !== optionId)
          : [...current, optionId];
      } else {
        next = current.includes(optionId)
          ? current.filter((item) => item !== optionId)
          : [...current.slice(-(Math.max(max - 1, 0))), optionId];
      }
      if (category === 'world' && next[0]) setSelectedDomain(next[0] as DreamDomainId);
      return { ...prev, [category]: next };
    });
  };

  const addCustomTag = (category: Exclude<DreamTagCategory, 'world'>, label: string) => {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) return false;

    const exists = customTags.some((tag) => (
      tag.category === category && tag.label.trim().toLowerCase() === normalizedLabel.toLowerCase()
    ));
    if (exists) return false;

    setCustomTags((prev) => [
      ...prev,
      {
        id: `dream-custom-tag-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        category,
        label: normalizedLabel,
      },
    ]);
    return true;
  };

  const removeCustomTag = (id: string) => {
    setCustomTags((prev) => prev.filter((tag) => tag.id !== id));
  };

  const cycleTagBatch = (category: DreamTagCategory) => {
    setTagBatchIndex((prev) => ({
      ...prev,
      [category]: (prev[category] ?? 0) + 1,
    }));
  };

  const continueDeeper = async () => {
    if (!runtimeScenario || !selectedCharacter || !selectedChoice || isGeneratingNextAct || isEndingDeepDream) return;
    setLoadingError(null);
    setIsGeneratingNextAct(true);
    try {
      const payload = await generateDreamContinuation({
        activeConfig,
        character: selectedCharacter,
        masks,
        worldBooks: dreamPromptWorldBooks,
        dreamWorldBookConfig: normalizedDreamWorldBookConfig,
        selection: {
          entryMode,
          domainId: selectedDomain,
          depth: dreamDepth,
          selectedTags,
          customTags,
          supplementNote,
        },
        scenario: runtimeScenario,
        actIndex,
        mode: 'deeper',
        selectedChoice,
      });

      const nextActs = payload.nextActs ?? [];
      if (nextActs.length === 0) {
        throw new Error('深梦续写没有返回新的下沉段。');
      }

      setRuntimeScenario((prev) =>
        prev
          ? hydrateDreamRuntimeScenario({
              ...prev,
              acts: [...prev.acts, ...nextActs],
            })
          : prev,
      );
      setActIndex((prev) => prev + 1);
      setSelectedChoice(null);
      setStage('scene');
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : '深梦继续失败');
    } finally {
      setIsGeneratingNextAct(false);
    }
  };

  const submitCustomChoice = async () => {
    if (!runtimeScenario || !selectedCharacter || !act || !customInput.trim() || isSubmittingCustom || isGeneratingNextAct || isEndingDeepDream) return;
    const currentAct = act;
    const needsNextAct = isDeepDream || actIndex < runtimeScenario.acts.length - 1;
    setLoadingError(null);
    setIsSubmittingCustom(true);
    try {
      const payload = await generateDreamContinuation({
        activeConfig,
        character: selectedCharacter,
        masks,
        worldBooks: dreamPromptWorldBooks,
        dreamWorldBookConfig: normalizedDreamWorldBookConfig,
        selection: {
          entryMode,
          domainId: selectedDomain,
          depth: dreamDepth,
          selectedTags,
          customTags,
          supplementNote,
        },
        scenario: runtimeScenario,
        actIndex,
        mode: 'custom',
        userInput: customInput.trim(),
      });

      if (needsNextAct) {
        if (!payload.nextAct) {
          throw new Error('自定义续写没有返回下一幕。');
        }

        setRuntimeScenario((prev) =>
          prev
            ? hydrateDreamRuntimeScenario({
                ...prev,
                acts: upsertDreamAct(prev.acts, payload.nextAct!, actIndex + 1),
              })
            : prev,
        );
      }

      const nextChoice = {
        id: `custom-${Date.now()}`,
        title: '自定义描述',
        direction: '按你的描述推进',
        detail: customInput.trim(),
        reactionHint: payload.reactionText || '梦按你的描述发生了偏转。',
        storyPush: payload.storyPush || payload.nextAct?.progression.plotAdvance || act.progression.plotAdvance || '主线沿着你的输入继续下沉。',
        emotion: payload.emotion || '回响',
        reaction: payload.reactionText || '梦按你的描述继续往下走。',
        fromCustom: true,
      };
      setRuntimeScenario((prev) =>
        prev
          ? hydrateDreamRuntimeScenario({
              ...prev,
              decisionTrail: appendDecisionRecord(prev.decisionTrail, createDecisionRecord(currentAct, nextChoice)),
            })
          : prev,
      );
      setSelectedChoice(nextChoice);
      setCustomInput('');
      setCustomInputOpen(false);
      setStage('reaction');
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : '自定义续写失败');
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  const endDeepDream = async () => {
    if (!runtimeScenario || !selectedCharacter || isGeneratingNextAct || isEndingDeepDream) return;
    setLoadingError(null);
    setIsEndingDeepDream(true);
    try {
      const payload = await generateDreamContinuation({
        activeConfig,
        character: selectedCharacter,
        masks,
        worldBooks: dreamPromptWorldBooks,
        dreamWorldBookConfig: normalizedDreamWorldBookConfig,
        selection: {
          entryMode,
          domainId: selectedDomain,
          depth: dreamDepth,
          selectedTags,
          customTags,
          supplementNote,
        },
        scenario: runtimeScenario,
        actIndex,
        mode: 'deep-end',
        selectedChoice,
      });

      if (!payload.finalAct || !payload.endingInput || !payload.aftermathInput) {
        throw new Error('深梦收束没有返回完整的最后一幕与结局。');
      }

      setRuntimeScenario((prev) =>
        prev
          ? hydrateDreamRuntimeScenario({
              ...prev,
              acts: [...prev.acts, payload.finalAct!],
              endingInput: payload.endingInput!,
              aftermathInput: payload.aftermathInput!,
            })
          : prev,
      );
      setClosingActId(payload.finalAct.id);
      setActIndex((prev) => prev + 1);
      setSelectedChoice(null);
      setStage('scene');
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : '结束做梦失败');
    } finally {
      setIsEndingDeepDream(false);
    }
  };

  const goNextFromReaction = async () => {
    if (actIndex < scenario.acts.length - 1) {
      setActIndex((prev) => prev + 1);
      setSelectedChoice(null);
      setStage('scene');
      return;
    }
    if (isDeepDream && !isClosingAct) {
      await continueDeeper();
      return;
    }
    setStage('ending');
  };

  const restart = () => {
    setEntryMode('quick');
    setSelectedDomain('shared');
    setDreamDepth('shallow');
    setSelectedTags(defaultTagSelection);
    setCustomTags([]);
    setSupplementNote('');
    setDreamWorldBookConfig(normalizeDreamWorldBookConfig());
    setDreamWorldBookNote(null);
    closeDreamWorldBookSheet();
    closeDreamWorldBookImportReview();
    setDetailExpanded(false);
    setActIndex(0);
    setSelectedChoice(null);
    setPreviewChoiceId(null);
    setLoadingProgress(0);
    setCustomInput('');
    setCustomInputOpen(false);
    setConfirmPreview(null);
    setIsSubmittingCustom(false);
    setIsGeneratingNextAct(false);
    setIsEndingDeepDream(false);
    setClosingActId(null);
    setRuntimeScenario(null);
    setStage('home');
  };

  const deleteArchiveRecord = (id: string) => {
    setArchiveRecords((prev) => {
      const next = prev.filter((record) => record.id !== id);
      saveDreamArchiveRecords(next);
      return next;
    });
    setSelectedArchiveId(null);
  };

  const exportCurrentArchiveRecords = () => {
    const filename = archiveView === 'deep' ? 'dream-yuan-archive.json' : 'dream-echo-archive.json';
    exportDreamArchiveRecords(visibleArchiveRecords, filename);
  };

  const exportSingleArchiveRecord = (id: string) => {
    const record = archiveRecords.find((item) => item.id === id);
    if (!record) return;
    exportDreamArchiveRecords([record], `dream-${record.id}.json`);
  };

  const selectedLabels = getSelectedTagLabels(selectedTags, customTags);
  const visibleArchiveRecords = archiveView === 'deep'
    ? archiveRecords.filter((record) => record.depth === 'deep')
    : archiveRecords;
  const deepArchiveCount = archiveRecords.filter((record) => record.depth === 'deep').length;
  const canContinueDream = Boolean(resumableDream);

  const loadingLabel =
    loadingProgress < 25
      ? '正在入梦'
      : loadingProgress < 50
        ? '梦域生成中'
        : loadingProgress < 75
          ? '场景浮现'
          : '进入其中';

  const beginChoicePreview = (choiceId: string) => {
    if (choiceHoldTimerRef.current) {
      window.clearTimeout(choiceHoldTimerRef.current);
    }
    choiceHoldTimerRef.current = window.setTimeout(() => {
      setPreviewChoiceId(choiceId);
    }, 620);
  };

  const cancelChoicePreview = () => {
    if (choiceHoldTimerRef.current) {
      window.clearTimeout(choiceHoldTimerRef.current);
      choiceHoldTimerRef.current = null;
    }
  };

  const retryDreamGeneration = () => {
    setLoadingError(null);
    setLoadingProgress(0);
    setStage('confirm');
    window.requestAnimationFrame(() => {
      setStage('loading');
    });
  };

  const handleLeaveDuringDreamLoading = () => {
    const backgroundResumeTask = getCurrentDreamBackgroundTask();
    const dreamOptions = selectedCharacter
      ? {
          activeConfig,
          character: selectedCharacter,
          masks,
          worldBooks: dreamPromptWorldBooks,
          dreamWorldBookConfig: normalizedDreamWorldBookConfig,
          generationMode: dreamGenerationMode || undefined,
          selection: {
            entryMode,
            domainId: selectedDomain,
            depth: dreamDepth,
            selectedTags,
            customTags,
            supplementNote,
          },
        }
      : null;
    if (!backgroundResumeTask && dreamOptions) {
      void startDreamBackgroundGeneration(dreamOptions);
    }
    const requestKey = dreamOptions ? buildDreamBackgroundRequestKey(dreamOptions) : undefined;
    writeDreamBackgroundResumeRequest({
      taskId: backgroundResumeTask?.status === 'pending' ? backgroundResumeTask.id : undefined,
      requestKey: backgroundResumeTask?.requestKey ?? requestKey,
    });
    onBack();
  };

  const retryEndingGeneration = () => {
    setLoadingError(null);
    setStage('scene');
    window.requestAnimationFrame(() => {
      setStage('ending');
    });
  };

  const retryAftermathGeneration = () => {
    setLoadingError(null);
    setStage('ending');
    window.requestAnimationFrame(() => {
      setStage('aftermath');
    });
  };

  const handleSaveAndExit = () => {
    if (runtimeScenario) {
      persistDreamProgress(runtimeScenario);
    }
    onBack();
  };

  const handleResumeLatestDream = () => {
    const resumable = buildDreamResumableState(readPersistedDreamSession());
    if (!resumable) {
      setLatestSavedSession(readPersistedDreamSession());
      return;
    }

    const persistedCharacter = characters.find((character) => character.id === resumable.roleId) ?? null;
    if (!persistedCharacter) {
      clearDreamProgress();
      return;
    }

    const savedSession = latestSavedSession && latestSavedSession.roleId === resumable.roleId
      ? latestSavedSession
      : readPersistedDreamSession();
    const resumeStage = isDreamResumeStage(resumable.progress?.stage) ? resumable.progress.stage : 'scene';
    setSelectedRoleId(resumable.roleId);
    if (savedSession?.roleId === resumable.roleId) {
      setEntryMode(savedSession.mode);
      setSelectedDomain(savedSession.domain);
      setDreamDepth(savedSession.depth);
      setSelectedTags(savedSession.selectedTags);
      setCustomTags(savedSession.customTags || []);
      setSupplementNote(savedSession.supplementNote || '');
    }
    adoptDreamGenerationMode(resumable.generationMode ?? savedSession?.generationMode ?? null);
    setDreamWorldBookConfig(normalizeDreamWorldBookConfig(
      resumable.dreamWorldBookConfig
      ?? savedSession?.dreamWorldBookConfig,
    ));
    setDreamWorldBookNote(null);
    setConfirmPreview(null);
    setLoadingError(null);
    setRuntimeScenario(hydrateDreamRuntimeScenario(resumable.scenario));
    setActIndex(resumable.progress?.actIndex ?? 0);
    setSelectedChoice(resumable.progress?.selectedChoice ?? null);
    setClosingActId(resumable.progress?.closingActId ?? null);
    setCustomInput(resumable.progress?.customInput ?? '');
    setCustomInputOpen(resumable.progress?.customInputOpen ?? false);
    setStage(resumeStage);
    if (savedSession) {
      setLatestSavedSession(savedSession);
    }
    clearDreamBackgroundResumeRequest();
  };

  return (
    <>
        {stage === 'splash' && (
          <Shell time={time} contentClassName="pb-[calc(4.75rem+var(--app-safe-area-bottom-ui,0px))]">
            <div className="flex min-h-[calc(100%-5rem)] flex-1 items-start justify-center pt-[24vh] sm:pt-[22vh]">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4 }} className="space-y-6 text-center">
                <div className="text-[72px] font-[200] tracking-[0.2em] text-[var(--paper)]">梦</div>
                <div className="mx-auto h-px w-20 bg-[var(--border-mid)]" />
                <div className="text-[11px] tracking-[0.52em] text-[var(--paper-60)]">局 · 梦 · 夜</div>
              </motion.div>
            </div>
          </Shell>
        )}
        {(stage === 'home' || stage === 'entry') && (
          <DreamHomeEntryStage
            stage={stage}
            time={time}
            role={selectedRole}
            archiveCount={archiveRecords.length}
            deepArchiveCount={deepArchiveCount}
            unfinishedDreamTitle={resumableDream?.scenario.coverTitle || resumableDream?.scenario.storyFrame.worldTitle || '继续上次梦境'}
            unfinishedDreamMeta={
              canContinueDream
                ? [
                    resumableDream?.scenario.storyFrame.dreamRelationship,
                    formatPersistedDreamTime(resumableDream?.createdAt || 0),
                  ].filter(Boolean).join(' · ')
                : ''
            }
            canContinueDream={canContinueDream}
            hasWorldBookConfig={hasDreamWorldBookConfig}
            hasWorldBookSignal={hasDreamWorldBookSignal}
            topRightSlot={(
              <DreamGenerationModeTriggerButton
                mode={defaultDreamGenerationMode}
                onClick={openDreamGenerationModeSheet}
              />
            )}
            fileInputRef={dreamWorldBookImportInputRef}
            onImportFileChange={handleImportDreamWorldBookFile}
            onPickRole={() => setStage('role-picker')}
            onOpenWorldBooks={openDreamWorldBookSheet}
            onEnter={openEntry}
            onContinueDream={handleResumeLatestDream}
            onOpenArchive={(view) => {
              setArchiveView(view);
              setSelectedArchiveId(null);
              setStage('archive');
            }}
            onExit={onBack}
            onChooseEntryMode={chooseMode}
            onCloseEntry={() => setStage('home')}
            showDreamGenerationModeSheet={showDreamGenerationModeSheet}
            selectedDefaultMode={defaultDreamGenerationMode}
            onSelectDefaultMode={handleSelectDefaultDreamGenerationMode}
            onClearDefaultMode={handleClearDefaultDreamGenerationMode}
            onCloseDreamGenerationModeSheet={closeDreamGenerationModeSheet}
            showDreamWorldBookSheet={showDreamWorldBookSheet}
            roleName={selectedRole?.name}
            inheritedWorldBooks={inheritedDreamWorldBooks}
            excludedInheritedIds={normalizedDreamWorldBookConfig.excludedInheritedIds || []}
            localWorldBooks={normalizedDreamWorldBookConfig.localEntries || []}
            activeWorldBookCount={dreamPromptWorldBooks.length}
            worldBookNote={dreamWorldBookNote}
            onCloseWorldBookSheet={closeDreamWorldBookSheet}
            onPickRoleFromWorldBookSheet={() => {
              closeDreamWorldBookSheet();
              setStage('role-picker');
            }}
            onImportWorldBooks={triggerDreamWorldBookImport}
            onToggleInheritedWorldBook={toggleDreamInheritedWorldBook}
            onRemoveLocalWorldBook={removeDreamLocalWorldBook}
            onSelectAllInheritedWorldBooks={restoreAllInheritedDreamWorldBooks}
            onMuteInheritedWorldBooks={muteAllInheritedDreamWorldBooks}
            onResetWorldBookOverrides={resetDreamWorldBookOverrides}
            dreamWorldBookImportDrafts={dreamWorldBookImportDrafts}
            showAdvancedDreamWorldBookImportReview={showAdvancedDreamWorldBookImportReview}
            onBackWorldBookImportReview={closeDreamWorldBookImportReview}
            onImportWorldBookDefault={handleDreamWorldBookImportDefault}
            onToggleAdvancedDreamWorldBookImportReview={() => setShowAdvancedDreamWorldBookImportReview((prev) => !prev)}
            onConfirmWorldBookImport={confirmReviewedDreamWorldBookImport}
            onToggleWorldBookImportDraftInclude={toggleDreamWorldBookImportDraftInclude}
            onChangeWorldBookImportDraftMergeGroup={updateDreamWorldBookImportDraftMergeGroup}
          />
        )}
        {stage === 'archive' && (
          <DreamArchiveStage
            time={time}
            title={archiveView === 'deep' ? '梦渊档案' : '梦境档案'}
            subtitle={archiveView === 'deep' ? '只收更深处的梦线' : '已经收好的梦会留在这里'}
            emptyTitle={archiveView === 'deep' ? '暂无梦渊' : '暂无残响'}
            emptyHint={archiveView === 'deep' ? '深梦完成结局后会收入这里，方便回看更长的梦线。' : '梦完成结局后会自动收入档案，余响生成后也会同步补进来。'}
            records={visibleArchiveRecords}
            selectedId={selectedArchiveId}
            onSelect={setSelectedArchiveId}
            onBack={() => {
              setSelectedArchiveId(null);
              setStage('home');
            }}
            onDelete={deleteArchiveRecord}
            onExportAll={exportCurrentArchiveRecords}
            onExportRecord={exportSingleArchiveRecord}
          />
        )}
        {stage === 'role-picker' && (
          <DreamRolePickerStage
            time={time}
            roles={roles}
            selectedRoleId={selectedRoleId}
            onBack={() => setStage('home')}
            onPickRole={(roleId) => {
              setSelectedRoleId(roleId);
              setStage('home');
            }}
          />
        )}
        {stage === 'tags' && selectedRole && (
          <DreamTagsStage
            time={time}
            dreamDepth={dreamDepth}
            setDreamDepth={setDreamDepth}
            selectedTags={selectedTags}
            customTags={customTags}
            supplementNote={supplementNote}
            setSupplementNote={setSupplementNote}
            toggleTag={toggleTag}
            onAddCustomTag={addCustomTag}
            onRemoveCustomTag={removeCustomTag}
            tagBatchIndex={tagBatchIndex}
            cycleTagBatch={cycleTagBatch}
            detailExpanded={detailExpanded}
            setDetailExpanded={setDetailExpanded}
            selectedLabels={selectedLabels}
            onBack={() => setStage('entry')}
            onConfirm={() => setStage('confirm')}
          />
        )}
        {stage === 'confirm' && selectedRole && (
          <DreamConfirmStage
            time={time}
            entryMode={entryMode}
            selectedRole={selectedRole}
            selectedDomain={selectedDomain}
            scenario={scenario}
            preview={confirmPreview}
            preflightPlan={entryMode === 'character' ? null : dreamPreflightPlan}
            selectedLabels={selectedLabels}
            dreamGenerationMode={dreamGenerationMode}
            rememberDreamGenerationMode={rememberDreamGenerationMode}
            hasStoredDefaultDreamGenerationMode={Boolean(defaultDreamGenerationMode)}
            onSelectDreamGenerationMode={setDreamGenerationMode}
            onToggleRememberDreamGenerationMode={() => setRememberDreamGenerationMode((prev) => !prev)}
            onBack={() => setStage(entryMode === 'custom' ? 'tags' : 'entry')}
            onConfirm={() => handleConfirmDreamMode(() => setStage('loading'))}
          />
        )}
        {stage === 'loading' && selectedRole && (
          <DreamLoadingStage
            time={time}
            selectedRoleName={selectedRole.name}
            loadingError={loadingError}
            loadingLabel={loadingLabel}
            loadingProgress={loadingProgress}
            onRetry={retryDreamGeneration}
            onBackConfirm={() => setStage('confirm')}
            onLeaveHome={handleLeaveDuringDreamLoading}
          />
        )}
        {stage === 'scene' && act && (
          <DreamSceneStage
            time={time}
            scenarioTitle={scenario.coverTitle}
            actLabel={act.label}
            scenarioActs={scenario.acts}
            actIndex={actIndex}
            displayStoryFrame={actIndex === 0 && hasStoryFrameContent(displayStoryFrame as DreamRuntimeScenario['storyFrame']) ? displayStoryFrame : null}
            presentation={presentation}
            typedSceneBlocks={typedSceneBlocks}
            act={act}
            loadingError={loadingError}
            sceneReady={sceneReady}
            isClosingAct={isClosingAct}
            isDeepDream={isDeepDream}
            isEndingDeepDream={isEndingDeepDream}
            isGeneratingNextAct={isGeneratingNextAct}
            onSaveAndExit={handleSaveAndExit}
            onProceed={() => (isClosingAct ? setStage('ending') : setStage('choices'))}
            onEndDeepDream={() => {
              void endDeepDream();
            }}
          />
        )}
        {choiceAct && (
          <DreamChoiceStage
            time={time}
            domainLabel={resolveDomainName(selectedDomain)}
            scenarioTitle={scenario.coverTitle}
            actLabel={choiceAct.label}
            choiceAct={choiceAct}
            previewChoiceId={previewChoiceId}
            customInputOpen={customInputOpen}
            customInput={customInput}
            isSubmittingCustom={isSubmittingCustom}
            loadingError={loadingError}
            presentation={presentation}
            isDeepDream={isDeepDream}
            isEndingDeepDream={isEndingDeepDream}
            isGeneratingNextAct={isGeneratingNextAct}
            onBeginChoicePreview={beginChoicePreview}
            onCancelChoicePreview={cancelChoicePreview}
            onSelectGeneratedChoice={(choiceIndex) => {
              cancelChoicePreview();
              const choice = choiceAct.choiceSet.generated[choiceIndex];
              const nextChoice = {
                ...choice,
                reaction: choice.reactionHint,
              };
              setRuntimeScenario((prev) => (
                prev
                  ? hydrateDreamRuntimeScenario({
                      ...prev,
                      decisionTrail: appendDecisionRecord(prev.decisionTrail, createDecisionRecord(choiceAct, nextChoice)),
                    })
                  : prev
              ));
              setSelectedChoice(nextChoice);
              setStage('reaction');
            }}
            onToggleCustomInput={() => setCustomInputOpen((prev) => !prev)}
            onCustomInputChange={setCustomInput}
            onSubmitCustomChoice={() => {
              void submitCustomChoice();
            }}
            onCloseCustomInput={() => setCustomInputOpen(false)}
            onSaveAndExit={handleSaveAndExit}
            onEndDeepDream={() => {
              void endDeepDream();
            }}
          />
        )}
        {stage === 'reaction' && selectedChoice && (
          <DreamReactionStage
            time={time}
            selectedChoiceTitle={selectedChoice.title}
            selectedChoiceEmotion={selectedChoice.emotion}
            typedReactionBlocks={typedReactionBlocks}
            reactionReady={reactionReady}
            loadingError={loadingError}
            presentation={presentation}
            isDeepDream={isDeepDream}
            isLastGeneratedAct={isLastGeneratedAct}
            isClosingAct={isClosingAct}
            isGeneratingNextAct={isGeneratingNextAct}
            isEndingDeepDream={isEndingDeepDream}
            onContinue={() => {
              void goNextFromReaction();
            }}
            onSaveAndExit={handleSaveAndExit}
            onEndDeepDream={() => {
              void endDeepDream();
            }}
          />
        )}
        {stage === 'ending' && (
          <DreamEndingStage
            time={time}
            endingView={endingView}
            isGeneratingEnding={isGeneratingEnding}
            typedEndingBody={typedEndingBody}
            typedEndingExcerpt={typedEndingExcerpt}
            loadingError={loadingError}
            presentation={presentation}
            endingTextReady={endingTextReady}
            hasEndingOutput={Boolean(runtimeScenario?.endingOutput)}
            onRetry={retryEndingGeneration}
            onExit={onBack}
            onNextAftermath={() => {
              if (runtimeScenario?.endingOutput) setStage('aftermath');
            }}
          />
        )}
        {stage === 'aftermath' && (
          <DreamAftermathStage
            time={time}
            role={selectedRole}
            aftermathView={aftermathView}
            typedAftermathMessages={typedAftermathMessages}
            typedAftermathSummary={typedAftermathSummary}
            typedAftermathDetail={typedAftermathDetail}
            aftermathMetaLine={aftermathMetaLine}
            isGeneratingAftermath={isGeneratingAftermath}
            loadingError={loadingError}
            presentation={presentation}
            aftermathTextReady={aftermathTextReady}
            onRetry={retryAftermathGeneration}
            onExit={onBack}
            onRestart={restart}
          />
        )}
    </>
  );
}





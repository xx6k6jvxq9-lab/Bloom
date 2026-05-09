import { useCallback, useMemo, useState, type RefObject } from 'react';

import { createDreamLocalWorldBooksFromFile, mergeDreamLocalWorldBooks, normalizeDreamWorldBookConfig } from '../../services/dream/dreamWorldBooks';
import type { DreamWorldBookConfig } from '../../services/dream/dreamRuntimeTypes';
import type { Character, WorldBookEntry } from '../../types';
import { buildDreamImportedWorldBooksFromDrafts, buildDreamWorldBookImportDrafts } from './dreamPageRuntime';
import type { DreamWorldBookImportDraft } from './DreamWorldBookImportReviewSheet';

type DreamWorldBookNote = {
  tone: 'info' | 'success' | 'error';
  text: string;
} | null;

export function useDreamWorldBookControls({
  initialConfig,
  selectedCharacter,
  inheritedDreamWorldBooks,
  dreamWorldBookImportInputRef,
  onRequireRolePicker,
}: {
  initialConfig?: DreamWorldBookConfig;
  selectedCharacter: Character | null;
  inheritedDreamWorldBooks: WorldBookEntry[];
  dreamWorldBookImportInputRef: RefObject<HTMLInputElement | null>;
  onRequireRolePicker: () => void;
}) {
  const [showDreamWorldBookSheet, setShowDreamWorldBookSheet] = useState(false);
  const [dreamWorldBookConfig, setDreamWorldBookConfig] = useState<DreamWorldBookConfig>(() => (
    normalizeDreamWorldBookConfig(initialConfig)
  ));
  const [dreamWorldBookNote, setDreamWorldBookNote] = useState<DreamWorldBookNote>(null);
  const [dreamWorldBookImportDrafts, setDreamWorldBookImportDrafts] = useState<DreamWorldBookImportDraft[] | null>(null);
  const [showAdvancedDreamWorldBookImportReview, setShowAdvancedDreamWorldBookImportReview] = useState(false);

  const normalizedDreamWorldBookConfig = useMemo(
    () => normalizeDreamWorldBookConfig(dreamWorldBookConfig),
    [dreamWorldBookConfig],
  );

  const updateDreamWorldBookConfig = useCallback((
    updater: DreamWorldBookConfig | ((prev: DreamWorldBookConfig) => DreamWorldBookConfig),
  ) => {
    setDreamWorldBookConfig((prev) => {
      const resolved = typeof updater === 'function'
        ? (updater as (prev: DreamWorldBookConfig) => DreamWorldBookConfig)(prev)
        : updater;
      return normalizeDreamWorldBookConfig(resolved);
    });
  }, []);

  const clearDreamWorldBookNote = useCallback(() => {
    setDreamWorldBookNote(null);
  }, []);

  const closeDreamWorldBookSheet = useCallback(() => {
    setShowDreamWorldBookSheet(false);
    setDreamWorldBookNote(null);
  }, []);

  const openDreamWorldBookSheet = useCallback(() => {
    setDreamWorldBookNote(null);
    setShowDreamWorldBookSheet(true);
  }, []);

  const toggleDreamInheritedWorldBook = useCallback((worldBookId: string) => {
    updateDreamWorldBookConfig((prev) => {
      const excluded = new Set(prev.excludedInheritedIds || []);
      if (excluded.has(worldBookId)) {
        excluded.delete(worldBookId);
      } else {
        excluded.add(worldBookId);
      }
      return {
        ...prev,
        excludedInheritedIds: Array.from(excluded),
      };
    });
    setDreamWorldBookNote(null);
  }, [updateDreamWorldBookConfig]);

  const removeDreamLocalWorldBook = useCallback((worldBookId: string) => {
    updateDreamWorldBookConfig((prev) => ({
      ...prev,
      localEntries: (prev.localEntries || []).filter((entry) => entry.id !== worldBookId),
    }));
    setDreamWorldBookNote(null);
  }, [updateDreamWorldBookConfig]);

  const closeDreamWorldBookImportReview = useCallback(() => {
    setDreamWorldBookImportDrafts(null);
    setShowAdvancedDreamWorldBookImportReview(false);
  }, []);

  const commitDreamImportedWorldBooks = useCallback((entries: WorldBookEntry[]) => {
    if (!selectedCharacter) {
      setDreamWorldBookNote({
        tone: 'info',
        text: '先选一个入梦角色，再决定今夜私藏书页要带给谁。',
      });
      closeDreamWorldBookImportReview();
      return;
    }

    if (entries.length === 0) {
      setDreamWorldBookNote({
        tone: 'info',
        text: '至少选一条书页，再把它带进今夜。',
      });
      return;
    }

    updateDreamWorldBookConfig((prev) => ({
      ...prev,
      localEntries: mergeDreamLocalWorldBooks(prev.localEntries || [], entries, selectedCharacter.id),
    }));
    closeDreamWorldBookImportReview();
    setDreamWorldBookNote({
      tone: 'success',
      text: entries.length > 1
        ? `整理后带进今夜 ${entries.length} 条书页。`
        : '整理后带进今夜 1 条书页。',
    });
  }, [closeDreamWorldBookImportReview, selectedCharacter, updateDreamWorldBookConfig]);

  const handleDreamWorldBookImportDefault = useCallback(() => {
    if (!dreamWorldBookImportDrafts) return;
    commitDreamImportedWorldBooks(buildDreamImportedWorldBooksFromDrafts(
      dreamWorldBookImportDrafts.map((draft) => ({ ...draft, mergeGroup: '' })),
    ));
  }, [commitDreamImportedWorldBooks, dreamWorldBookImportDrafts]);

  const toggleDreamWorldBookImportDraftInclude = useCallback((draftId: string) => {
    setDreamWorldBookImportDrafts((prev) => prev
      ? prev.map((draft) => (
        draft.draftId === draftId
          ? { ...draft, include: !draft.include }
          : draft
      ))
      : prev);
  }, []);

  const updateDreamWorldBookImportDraftMergeGroup = useCallback((draftId: string, value: string) => {
    setDreamWorldBookImportDrafts((prev) => prev
      ? prev.map((draft) => (
        draft.draftId === draftId
          ? { ...draft, mergeGroup: value }
          : draft
      ))
      : prev);
  }, []);

  const confirmReviewedDreamWorldBookImport = useCallback(() => {
    if (!dreamWorldBookImportDrafts) return;
    commitDreamImportedWorldBooks(buildDreamImportedWorldBooksFromDrafts(dreamWorldBookImportDrafts));
  }, [commitDreamImportedWorldBooks, dreamWorldBookImportDrafts]);

  const handleImportDreamWorldBookFile = useCallback(async (file?: File | null) => {
    if (!file) return;
    if (!selectedCharacter) {
      setDreamWorldBookNote({
        tone: 'info',
        text: '先选一个入梦角色，再把今夜要读的书页放进来。',
      });
      onRequireRolePicker();
      return;
    }

    try {
      const importedEntries = await createDreamLocalWorldBooksFromFile(file, selectedCharacter.id);
      if (importedEntries.length === 0) {
        throw new Error('没有认出可导入的世界书内容。');
      }

      setDreamWorldBookImportDrafts(buildDreamWorldBookImportDrafts(importedEntries));
      setShowAdvancedDreamWorldBookImportReview(false);
      setDreamWorldBookNote({
        tone: 'info',
        text: `识别到 ${importedEntries.length} 条书页，先整理一下再带进今夜吧。`,
      });
    } catch (error) {
      setDreamWorldBookNote({
        tone: 'error',
        text: error instanceof Error ? error.message : '导入失败了，换一个 JSON 或 TXT 文件再试试。',
      });
    }
  }, [onRequireRolePicker, selectedCharacter]);

  const triggerDreamWorldBookImport = useCallback(() => {
    if (!selectedCharacter) {
      setDreamWorldBookNote({
        tone: 'info',
        text: '先选角色，再给这场梦带书页。',
      });
      setShowDreamWorldBookSheet(true);
      return;
    }

    dreamWorldBookImportInputRef.current?.click();
  }, [dreamWorldBookImportInputRef, selectedCharacter]);

  const restoreAllInheritedDreamWorldBooks = useCallback(() => {
    updateDreamWorldBookConfig((prev) => ({
      ...prev,
      excludedInheritedIds: [],
    }));
    setDreamWorldBookNote({
      tone: 'info',
      text: '这一场梦会重新读取角色原本能读到的世界书。',
    });
  }, [updateDreamWorldBookConfig]);

  const muteAllInheritedDreamWorldBooks = useCallback(() => {
    updateDreamWorldBookConfig((prev) => ({
      ...prev,
      excludedInheritedIds: inheritedDreamWorldBooks.map((entry) => entry.id),
    }));
    setDreamWorldBookNote({
      tone: 'info',
      text: inheritedDreamWorldBooks.length > 0 ? '角色自带的世界书先都静下来了。' : '这个角色现在没有可继承的世界书。',
    });
  }, [inheritedDreamWorldBooks, updateDreamWorldBookConfig]);

  const resetDreamWorldBookOverrides = useCallback(() => {
    setDreamWorldBookConfig(normalizeDreamWorldBookConfig());
    setDreamWorldBookNote({
      tone: 'info',
      text: '已经回到默认状态，只读角色原本能读到的世界书。',
    });
  }, []);

  return {
    showDreamWorldBookSheet,
    setShowDreamWorldBookSheet,
    dreamWorldBookConfig,
    setDreamWorldBookConfig,
    normalizedDreamWorldBookConfig,
    dreamWorldBookNote,
    setDreamWorldBookNote,
    clearDreamWorldBookNote,
    closeDreamWorldBookSheet,
    openDreamWorldBookSheet,
    dreamWorldBookImportDrafts,
    setDreamWorldBookImportDrafts,
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
  };
}

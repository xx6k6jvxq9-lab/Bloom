import { AnimatePresence, motion } from 'motion/react';
import { type CSSProperties, type ReactNode, type RefObject } from 'react';

import type { DreamCustomTag, DreamGenerationMode, DreamPreflightPlan } from '../../services/dream/dreamRuntimeTypes';
import { DreamGenerationModePreferenceSheet, DreamGenerationModeSection } from './DreamGenerationModePanel';
import { Avatar, dreamThemeStyle, SealButton, SecondaryAction, Shell } from './DreamPagePrimitives';
import type { DreamConfirmPreview, DreamRole } from './dreamPageTypes';
import { DreamWorldBookGlyph, DreamWorldBookSheet } from './DreamWorldBookSheet';
import { DreamWorldBookImportReviewSheet, type DreamWorldBookImportDraft } from './DreamWorldBookImportReviewSheet';
import { resolveDomainName } from './dreamContent';
import type { WorldBookEntry } from '../../types';
import type { DreamDepth, DreamDomainId, DreamEntryMode, DreamScenario, DreamTagCategory } from './types';

type DreamEntryOption = {
  id: DreamEntryMode;
  title: string;
  detail: string;
  glyph: string;
  advanced?: boolean;
};

const dreamModeEntryToneStyle = {
  '--gold': '#E7C983',
  '--gold-bright': '#F3DEAC',
  '--paper': '#F3DEAC',
  '--paper-60': 'rgba(243,222,172,.86)',
  '--mist': 'rgba(231,201,131,.82)',
  '--jade': '#E7C983',
  '--border': 'rgba(231,201,131,.38)',
  '--border-mid': 'rgba(231,201,131,.5)',
} as CSSProperties;

export function DreamHomeEntryStage({
  stage,
  time,
  role,
  archiveCount,
  deepArchiveCount,
  unfinishedDreamTitle,
  unfinishedDreamMeta,
  canContinueDream,
  hasWorldBookConfig,
  hasWorldBookSignal,
  topRightSlot,
  fileInputRef,
  onImportFileChange,
  onPickRole,
  onOpenWorldBooks,
  onEnter,
  onContinueDream,
  onOpenArchive,
  onExit,
  onChooseEntryMode,
  onCloseEntry,
  showDreamGenerationModeSheet,
  selectedDefaultMode,
  onSelectDefaultMode,
  onClearDefaultMode,
  onCloseDreamGenerationModeSheet,
  showDreamWorldBookSheet,
  roleName,
  inheritedWorldBooks,
  excludedInheritedIds,
  localWorldBooks,
  activeWorldBookCount,
  worldBookNote,
  onCloseWorldBookSheet,
  onPickRoleFromWorldBookSheet,
  onImportWorldBooks,
  onToggleInheritedWorldBook,
  onRemoveLocalWorldBook,
  onSelectAllInheritedWorldBooks,
  onMuteInheritedWorldBooks,
  onResetWorldBookOverrides,
  dreamWorldBookImportDrafts,
  showAdvancedDreamWorldBookImportReview,
  onBackWorldBookImportReview,
  onImportWorldBookDefault,
  onToggleAdvancedDreamWorldBookImportReview,
  onConfirmWorldBookImport,
  onToggleWorldBookImportDraftInclude,
  onChangeWorldBookImportDraftMergeGroup,
}: {
  stage: 'home' | 'entry';
  time: string;
  role: DreamRole | null;
  archiveCount: number;
  deepArchiveCount: number;
  unfinishedDreamTitle?: string;
  unfinishedDreamMeta?: string;
  canContinueDream?: boolean;
  hasWorldBookConfig?: boolean;
  hasWorldBookSignal?: boolean;
  topRightSlot?: ReactNode;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImportFileChange: (file?: File | null) => Promise<void> | void;
  onPickRole: () => void;
  onOpenWorldBooks: () => void;
  onEnter: () => void;
  onContinueDream: () => void;
  onOpenArchive: (view: 'all' | 'deep') => void;
  onExit: () => void;
  onChooseEntryMode: (mode: DreamEntryMode) => void;
  onCloseEntry: () => void;
  showDreamGenerationModeSheet: boolean;
  selectedDefaultMode: DreamGenerationMode | null;
  onSelectDefaultMode: (mode: DreamGenerationMode) => void;
  onClearDefaultMode: () => void;
  onCloseDreamGenerationModeSheet: () => void;
  showDreamWorldBookSheet: boolean;
  roleName?: string;
  inheritedWorldBooks: WorldBookEntry[];
  excludedInheritedIds: string[];
  localWorldBooks: WorldBookEntry[];
  activeWorldBookCount: number;
  worldBookNote: {
    tone: 'info' | 'success' | 'error';
    text: string;
  } | null;
  onCloseWorldBookSheet: () => void;
  onPickRoleFromWorldBookSheet: () => void;
  onImportWorldBooks: () => void;
  onToggleInheritedWorldBook: (worldBookId: string) => void;
  onRemoveLocalWorldBook: (worldBookId: string) => void;
  onSelectAllInheritedWorldBooks: () => void;
  onMuteInheritedWorldBooks: () => void;
  onResetWorldBookOverrides: () => void;
  dreamWorldBookImportDrafts: DreamWorldBookImportDraft[] | null;
  showAdvancedDreamWorldBookImportReview: boolean;
  onBackWorldBookImportReview: () => void;
  onImportWorldBookDefault: () => void;
  onToggleAdvancedDreamWorldBookImportReview: () => void;
  onConfirmWorldBookImport: () => void;
  onToggleWorldBookImportDraftInclude: (draftId: string) => void;
  onChangeWorldBookImportDraftMergeGroup: (draftId: string, value: string) => void;
}) {
  return (
    <div className="relative h-full min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json,text/plain,.txt,.md,.csv,.tsv,.yml,.yaml,.docx"
        className="hidden"
        onChange={async (event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          await onImportFileChange(file);
          input.value = '';
        }}
      />
      <DreamHomeStage
        time={time}
        role={role}
        archiveCount={archiveCount}
        deepArchiveCount={deepArchiveCount}
        unfinishedDreamTitle={unfinishedDreamTitle}
        unfinishedDreamMeta={unfinishedDreamMeta}
        canContinueDream={canContinueDream}
        hasWorldBookConfig={hasWorldBookConfig}
        hasWorldBookSignal={hasWorldBookSignal}
        onPickRole={onPickRole}
        onOpenWorldBooks={onOpenWorldBooks}
        onEnter={onEnter}
        onContinueDream={onContinueDream}
        onOpenArchive={onOpenArchive}
        onExit={onExit}
        topRightSlot={topRightSlot}
      />
      <AnimatePresence initial={false}>
        {stage === 'entry' && role ? (
          <DreamEntrySheet key="dream-entry-sheet" role={role} onChoose={onChooseEntryMode} onClose={onCloseEntry} />
        ) : null}
        {showDreamGenerationModeSheet ? (
          <DreamGenerationModePreferenceSheet
            key="dream-generation-mode-sheet"
            selectedDefaultMode={selectedDefaultMode}
            onSelectDefaultMode={onSelectDefaultMode}
            onClearDefaultMode={onClearDefaultMode}
            onClose={onCloseDreamGenerationModeSheet}
          />
        ) : null}
        {showDreamWorldBookSheet ? (
          <DreamWorldBookSheet
            key="dream-worldbook-sheet"
            roleName={roleName}
            inheritedWorldBooks={inheritedWorldBooks}
            excludedInheritedIds={excludedInheritedIds}
            localWorldBooks={localWorldBooks}
            activeWorldBookCount={activeWorldBookCount}
            note={worldBookNote}
            onClose={onCloseWorldBookSheet}
            onPickRole={onPickRoleFromWorldBookSheet}
            onImport={onImportWorldBooks}
            onToggleInherited={onToggleInheritedWorldBook}
            onRemoveLocal={onRemoveLocalWorldBook}
            onSelectAllInherited={onSelectAllInheritedWorldBooks}
            onMuteInherited={onMuteInheritedWorldBooks}
            onReset={onResetWorldBookOverrides}
          />
        ) : null}
        {dreamWorldBookImportDrafts ? (
          <DreamWorldBookImportReviewSheet
            key="dream-worldbook-import-review"
            drafts={dreamWorldBookImportDrafts}
            advancedMode={showAdvancedDreamWorldBookImportReview}
            onBack={onBackWorldBookImportReview}
            onImportDefault={onImportWorldBookDefault}
            onToggleAdvancedMode={onToggleAdvancedDreamWorldBookImportReview}
            onConfirmImport={onConfirmWorldBookImport}
            onToggleInclude={onToggleWorldBookImportDraftInclude}
            onChangeMergeGroup={onChangeWorldBookImportDraftMergeGroup}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function DreamHomeStage({
  time,
  role,
  archiveCount,
  deepArchiveCount,
  unfinishedDreamTitle,
  unfinishedDreamMeta,
  canContinueDream,
  hasWorldBookConfig,
  hasWorldBookSignal,
  onPickRole,
  onOpenWorldBooks,
  onEnter,
  onContinueDream,
  onOpenArchive,
  onExit,
  topRightSlot,
}: {
  time: string;
  role: DreamRole | null;
  archiveCount: number;
  deepArchiveCount: number;
  unfinishedDreamTitle?: string;
  unfinishedDreamMeta?: string;
  canContinueDream?: boolean;
  hasWorldBookConfig?: boolean;
  hasWorldBookSignal?: boolean;
  onPickRole: () => void;
  onOpenWorldBooks: () => void;
  onEnter: () => void;
  onContinueDream: () => void;
  onOpenArchive: (view: 'all' | 'deep') => void;
  onExit: () => void;
  topRightSlot?: ReactNode;
}) {
  return (
    <Shell time={time} contentClassName="pb-[calc(5.75rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col pb-[calc(2rem+var(--app-safe-area-bottom-ui,0px))]">
        <div className="flex items-center justify-between pb-4 text-[12px] tracking-[0.08em] text-[var(--mist)]">
          <div>{time}</div>
          <div className="h-[6px] w-[6px] rounded-full bg-[var(--gold)] animate-[pulse_2.4s_ease-in-out_infinite]" />
        </div>
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-[30px] font-[200] tracking-[0.32em] text-[var(--paper)]">梦境</div>
          <div className="flex items-center gap-3">
            {topRightSlot}
            <button
              type="button"
              onClick={onOpenWorldBooks}
              aria-label="打开梦境世界书"
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition duration-300 hover:scale-[1.02]"
              style={{
                borderColor: hasWorldBookSignal ? 'rgba(196,169,106,.34)' : 'rgba(123,168,196,.18)',
                background: hasWorldBookSignal
                  ? 'radial-gradient(circle, rgba(196,169,106,.14) 0%, rgba(123,168,196,.08) 58%, transparent 100%)'
                  : 'radial-gradient(circle, rgba(123,168,196,.08) 0%, rgba(123,168,196,.03) 58%, transparent 100%)',
                boxShadow: hasWorldBookSignal ? '0 0 24px rgba(196,169,106,.12)' : 'none',
              }}
            >
              <DreamWorldBookGlyph active={hasWorldBookSignal} className={`h-5 w-5 ${hasWorldBookSignal ? 'text-[var(--gold)]' : 'text-[var(--mist)]'}`} />
              {(hasWorldBookConfig || hasWorldBookSignal) ? (
                <span
                  className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full"
                  style={{
                    backgroundColor: hasWorldBookConfig ? 'var(--gold)' : '#7BA8C4',
                    boxShadow: hasWorldBookConfig ? '0 0 12px rgba(196,169,106,.44)' : '0 0 12px rgba(123,168,196,.36)',
                  }}
                />
              ) : null}
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center justify-start gap-4 pb-[calc(1.25rem+var(--app-safe-area-bottom-ui,0px))] pt-2 text-center sm:gap-6 sm:py-8">
          <button type="button" onClick={onPickRole}>
            <Avatar role={role} />
          </button>
          {role ? (
            <>
              <div className="space-y-2">
                <div className="text-[22px] font-[300] tracking-[0.18em] text-[var(--paper)]">{role.name}</div>
                <div className="text-[12px] font-[300] tracking-[0.18em] text-[var(--mist)]">今夜在做梦</div>
              </div>
              <div className="relative w-full max-w-[320px] border border-[var(--border)] bg-[rgba(196,169,106,.04)] px-7 py-5 text-center">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-[var(--ink)] px-3 text-[10px] tracking-[0.4em] text-[var(--gold)]">今夜</div>
                <div className="text-[15px] font-[300] leading-[2] tracking-[0.12em] text-[var(--paper)]">有一场梦等待进入</div>
                <div className="mt-2 text-[11px] tracking-[0.12em] text-[var(--mist)]">梦会在 06:00 消散</div>
              </div>
              {canContinueDream ? (
                <div className="w-full max-w-[334px] border border-[rgba(123,168,196,.28)] bg-[rgba(123,168,196,.08)] px-5 py-5 text-left">
                  <div className="text-[11px] tracking-[0.26em] text-[#9EBEE2]">未做完的梦</div>
                  <div className="mt-3 text-[15px] font-[300] tracking-[0.12em] text-[var(--paper)]">
                    {unfinishedDreamTitle || '继续上次梦境'}
                  </div>
                  {unfinishedDreamMeta ? (
                    <div className="mt-2 text-[11px] leading-[1.8] tracking-[0.08em] text-[var(--mist)]">{unfinishedDreamMeta}</div>
                  ) : null}
                  <div className="mt-4">
                    <SecondaryAction label="继 续 上 次" onClick={onContinueDream} />
                  </div>
                </div>
              ) : null}
              <div className="w-full max-w-[334px]">
                <SealButton label="进入今夜" onClick={onEnter} />
              </div>
              <div className="w-full max-w-[334px]">
                <SecondaryAction label="退出梦境" onClick={onExit} className="mt-1" />
              </div>
            </>
          ) : (
            <div className="pt-2 text-[14px] font-[300] tracking-[0.22em] text-[var(--mist)]">点击头像，选择今夜入梦的角色</div>
          )}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t px-5 pb-[calc(1rem+var(--app-safe-area-bottom-ui,0px))] pt-4 backdrop-blur-md" style={{ borderColor: 'rgba(196,169,106,.26)', backgroundColor: 'rgba(9,14,25,.68)' }}>
          <div className="grid grid-cols-3 text-center text-[12px] tracking-[0.28em]">
            <button type="button" className="space-y-2" style={{ color: '#D9C08A', textShadow: '0 0 14px rgba(196,169,106,.32)' }}>
              <div>今夜</div>
              <div className="mx-auto h-[4px] w-[4px] border border-[var(--border)]"><div className="h-full w-full bg-[var(--gold)]" /></div>
            </button>
            <button type="button" onClick={() => onOpenArchive('all')} className="space-y-2 transition duration-300" style={{ color: '#9EBEE2' }}>
              <div>余响</div>
              <div className="mx-auto h-[4px] w-[4px] border" style={{ borderColor: archiveCount > 0 ? 'rgba(123,168,196,.55)' : 'rgba(123,168,196,.22)' }} />
            </button>
            <button type="button" onClick={() => onOpenArchive('deep')} className="space-y-2 transition duration-300" style={{ color: 'rgba(158,190,226,.78)' }}>
              <div>梦深</div>
              <div className="mx-auto h-[4px] w-[4px] border" style={{ borderColor: deepArchiveCount > 0 ? 'rgba(123,168,196,.45)' : 'rgba(123,168,196,.18)' }} />
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function DreamConfirmStage({
  time,
  entryMode,
  selectedRole,
  selectedDomain,
  scenario,
  preview,
  preflightPlan,
  selectedLabels,
  dreamGenerationMode,
  rememberDreamGenerationMode,
  hasStoredDefaultDreamGenerationMode,
  onSelectDreamGenerationMode,
  onToggleRememberDreamGenerationMode,
  onBack,
  onConfirm,
}: {
  time: string;
  entryMode: DreamEntryMode;
  selectedRole: DreamRole;
  selectedDomain: DreamDomainId;
  scenario: Pick<DreamScenario, 'coverTitle' | 'coverSubtitle' | 'confirmHint'>;
  preview?: DreamConfirmPreview | null;
  preflightPlan?: DreamPreflightPlan | null;
  selectedLabels: string[];
  dreamGenerationMode: DreamGenerationMode | null;
  rememberDreamGenerationMode: boolean;
  hasStoredDefaultDreamGenerationMode: boolean;
  onSelectDreamGenerationMode: (mode: DreamGenerationMode) => void;
  onToggleRememberDreamGenerationMode: () => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Shell time={time} scrollable contentClassName="pb-[calc(5rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col pb-[calc(1.5rem+var(--app-safe-area-bottom-ui,0px))]">
        <div className="mt-6 text-center text-[11px] tracking-[0.52em] text-[var(--mist)]">
          {entryMode === 'character' ? '角色入梦' : `${resolveDomainName(selectedDomain)} · ${scenario.coverTitle}`}
        </div>

        {entryMode === 'character' ? (
          <div className="mt-10 flex flex-1 flex-col items-center justify-start pb-[calc(3rem+var(--app-safe-area-bottom-ui,0px))] text-center sm:mt-12 sm:justify-center">
            <div className="relative px-7">
              <div className="absolute left-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
              <div className="absolute right-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
              <Avatar role={selectedRole} small />
            </div>
            <div className="mt-10 text-[34px] font-[200] tracking-[0.12em] text-[var(--paper)]">{selectedRole.name}</div>
            <div className="mt-4 text-[13px] tracking-[0.2em] text-[#9EBEE2]">TA 的梦，由 TA 决定</div>
            <div className="mt-8 space-y-4 text-[15px] leading-[2.1] tracking-[0.18em] text-[var(--jade)]">
              <div className="text-[#9EBEE2]">这场梦由 TA 决定</div>
              <div>你进入后才会逐渐知道</div>
              <div>身份 · 阵营 · 你们之间是什么关系</div>
            </div>
            <div className="mt-10 w-full max-w-[420px]">
              <DreamGenerationModeSection
                selectedMode={dreamGenerationMode}
                rememberAsDefault={rememberDreamGenerationMode}
                hasStoredDefault={hasStoredDefaultDreamGenerationMode}
                onSelectMode={onSelectDreamGenerationMode}
                onToggleRememberAsDefault={onToggleRememberDreamGenerationMode}
              />
            </div>
            <div className="mt-8 w-full max-w-[420px]"><SealButton label="确认入梦" onClick={onConfirm} disabled={!dreamGenerationMode} /></div>
            <div className="w-full max-w-[420px]">
              <SecondaryAction label="← 换一种入梦方式" onClick={onBack} className="mt-5" />
            </div>
          </div>
        ) : (
          <>
            <div className="mt-10 flex flex-col items-center text-center">
              <div className="relative px-7">
                <div className="absolute left-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                <div className="absolute right-0 top-1/2 h-20 w-px -translate-y-1/2 bg-[var(--border-mid)]" />
                <Avatar role={selectedRole} small />
              </div>
              <div className="mt-8 text-[28px] font-[200] tracking-[0.18em] text-[var(--paper)]">{selectedRole.name}</div>
              <div className="mt-3 text-[13px] tracking-[0.18em] text-[var(--mist)]">{preview?.coverSubtitle || scenario.coverSubtitle}</div>
            </div>
            <div className="mt-10 flex-1">
              <div className="flex flex-wrap justify-center gap-3">
                {selectedLabels.map((label, index) => (
                  <div key={`${label}-${index}`} className="border px-4 py-3 text-[12px] tracking-[0.2em] text-[var(--gold)]" style={{ borderColor: 'rgba(196,169,106,.18)', backgroundColor: 'rgba(13,18,32,.7)' }}>
                    {label}
                  </div>
                ))}
              </div>
              {preflightPlan ? (
                <div className="mt-8 space-y-4">
                  <div className="border px-4 py-4" style={{ borderColor: 'rgba(196,169,106,.16)', backgroundColor: 'rgba(13,18,32,.58)' }}>
                    <div className="text-[11px] tracking-[0.28em] text-[var(--gold)]">入梦预览</div>
                    <div className="mt-3 text-[12px] tracking-[0.14em] text-[var(--paper)]">
                      今夜会读取 {preflightPlan.worldBookCount} 条世界书
                    </div>
                    <div className="mt-2 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--mist)]">
                      {preflightPlan.worldBookConflictSummary && preflightPlan.worldBookConflictSummary !== '未触发程序裁剪'
                        ? preflightPlan.worldBookConflictSummary
                        : '当前没有发现需要按标签先压掉的世界书冲突。'}
                    </div>
                    {preflightPlan.activeWorldBookTitles.length > 0 ? (
                      <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--paper-60)]">
                        实际读取：{preflightPlan.activeWorldBookTitles.join(' / ')}
                      </div>
                    ) : null}
                    {preflightPlan.supplementNote ? (
                      <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--paper)]">
                        补充说明：{preflightPlan.supplementNote}
                      </div>
                    ) : null}
                    {preflightPlan.affectedWorldBookTitles.length > 0 ? (
                      <div className="mt-2 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--jade)]">
                        受影响书页：{preflightPlan.affectedWorldBookTitles.join(' / ')}
                      </div>
                    ) : null}
                  </div>

                  <div className="border px-4 py-4" style={{ borderColor: 'rgba(196,169,106,.16)', backgroundColor: 'rgba(13,18,32,.58)' }}>
                    <div className="text-[11px] tracking-[0.28em] text-[var(--gold)]">人设底线</div>
                    {preflightPlan.customTagLabels.length > 0 ? (
                      <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--jade)]">
                        自定义标签：{preflightPlan.customTagLabels.join(' / ')}
                      </div>
                    ) : null}
                    <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--paper)]">
                      {preflightPlan.personaFloor.mustKeep.slice(0, 2).map((line, index) => (
                        <div key={`keep-${index}`}>{index + 1}. {line}</div>
                      ))}
                    </div>
                    <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--jade)]">
                      {preflightPlan.personaFloor.mayAmplify.slice(0, 2).map((line, index) => (
                        <div key={`amp-${index}`}>可放大：{line}</div>
                      ))}
                    </div>
                    <div className="mt-3 text-[11px] leading-[1.9] tracking-[0.1em] text-[var(--mist)]">
                      {preflightPlan.personaFloor.mustNotBecome.slice(0, 2).map((line, index) => (
                        <div key={`not-${index}`}>不要写成：{line}</div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="mt-8 text-center text-[13px] leading-[2.2] tracking-[0.16em] text-[var(--mist)]">{preview?.confirmHint || scenario.confirmHint}</div>
            </div>
            <div className="mt-10 w-full">
              <DreamGenerationModeSection
                selectedMode={dreamGenerationMode}
                rememberAsDefault={rememberDreamGenerationMode}
                hasStoredDefault={hasStoredDefaultDreamGenerationMode}
                onSelectMode={onSelectDreamGenerationMode}
                onToggleRememberAsDefault={onToggleRememberDreamGenerationMode}
              />
            </div>
            <div className="mt-8 w-full pb-2"><SealButton label="确认入梦" onClick={onConfirm} disabled={!dreamGenerationMode} /></div>
            <div className="w-full">
              <SecondaryAction label="← 换一种入梦方式" onClick={onBack} className="mt-3" />
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

export function DreamEntrySheet({
  role,
  onChoose,
  onClose,
}: {
  role: DreamRole;
  onChoose: (mode: DreamEntryMode) => void;
  onClose: () => void;
}) {
  const options: DreamEntryOption[] = [
    {
      id: 'quick',
      title: '一键入梦',
      detail: '系统自动给出世界观、关系张力、剧情驱动与情绪底色。',
      glyph: '梦',
    },
    {
      id: 'custom',
      title: '自定义入梦',
      detail: '你先挑标签，再决定这场梦该往哪里沉。',
      glyph: '定',
    },
    {
      id: 'character',
      title: '角色入梦',
      detail: `这一场梦由 ${role.name} 来决定。你进入之后，才会逐渐知道自己的位置。`,
      glyph: '隐',
      advanced: true,
    },
  ];

  return (
    <div className="absolute inset-0 z-20 bg-[rgba(3,5,9,.44)]" style={dreamThemeStyle}>
      <button type="button" aria-label="关闭入梦方式" className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.65, ease: [0.2, 0.8, 0.4, 1] }}
        className="absolute inset-x-0 bottom-0 max-h-[calc(100%-16px)] overflow-y-auto overscroll-contain touch-pan-y border-t border-[var(--border)] bg-[var(--deep)] px-8 pb-[calc(4.25rem+var(--app-safe-area-bottom-ui,0px))] pt-5 [webkit-overflow-scrolling:touch]"
        style={dreamModeEntryToneStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto h-[3px] w-10 rounded-[2px] bg-[var(--gold)] opacity-40" />
        <div className="mt-7 text-center text-[12px] tracking-[0.42em] text-[var(--gold)]">入梦方式</div>
        <div className="mt-7">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChoose(option.id)}
              className="flex w-full items-start gap-4 border-b border-[var(--border)] px-1 py-5 text-left transition duration-300 hover:bg-[rgba(196,169,106,.04)]"
            >
              <div className="mt-1 flex h-10 w-10 flex-none items-center justify-center border border-[var(--border)] text-[16px] text-[var(--gold)]">
                {option.glyph}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[16px] font-[400] tracking-[0.12em] text-[var(--gold)]">{option.title}</div>
                  {option.advanced ? (
                    <span className="inline-flex border border-[rgba(196,169,106,.25)] px-2 py-[2px] text-[9px] tracking-[0.18em] text-[var(--gold)]">
                      高级
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-[12px] leading-[1.7] tracking-[0.08em] text-[var(--mist)]">{option.detail}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-6 text-center">
          <button type="button" onClick={onClose} className="text-[11px] tracking-[0.3em] text-[var(--gold)] opacity-80">
            返 回 今 夜
          </button>
        </div>
      </motion.div>
    </div>
  );
}

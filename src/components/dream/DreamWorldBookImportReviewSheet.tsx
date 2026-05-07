import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { Check, ChevronLeft, Sparkles } from 'lucide-react';
import type { WorldBookEntry } from '../../types';
import { getWorldBookPriorityLabel, normalizeWorldBookCategory } from '../../services/world-book/worldBookMeta';
import { DreamWorldBookGlyph } from './DreamWorldBookSheet';

const dreamImportReviewThemeStyle = {
  '--gold': '#D9C08A',
  '--gold-bright': '#F1E2B7',
  '--paper': '#E4D0A0',
  '--paper-60': 'rgba(228,208,160,.86)',
  '--mist': 'rgba(217,192,138,.72)',
  '--jade': '#B9D8F3',
  '--azure': '#8FCFFF',
  '--azure-bright': '#CBE8FF',
  fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', Georgia, serif",
} as CSSProperties;

export type DreamWorldBookImportDraft = WorldBookEntry & {
  draftId: string;
  include: boolean;
  mergeGroup: string;
};

type DreamWorldBookImportReviewSheetProps = {
  drafts: DreamWorldBookImportDraft[];
  advancedMode: boolean;
  onBack: () => void;
  onImportDefault: () => void;
  onToggleAdvancedMode: () => void;
  onConfirmImport: () => void;
  onToggleInclude: (draftId: string) => void;
  onChangeMergeGroup: (draftId: string, value: string) => void;
};

function buildPreview(text: string, maxLength = 124) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

export function DreamWorldBookImportReviewSheet({
  drafts,
  advancedMode,
  onBack,
  onImportDefault,
  onToggleAdvancedMode,
  onConfirmImport,
  onToggleInclude,
  onChangeMergeGroup,
}: DreamWorldBookImportReviewSheetProps) {
  const selectedCount = drafts.filter((draft) => draft.include).length;
  const mergedCount = new Set(
    drafts
      .filter((draft) => draft.include && draft.mergeGroup.trim())
      .map((draft) => draft.mergeGroup.trim().toLowerCase()),
  ).size;

  return (
    <motion.div
      key="dream-worldbook-import-review"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[140]"
      style={dreamImportReviewThemeStyle}
    >
      <div className="absolute inset-0 bg-[rgba(2,5,12,.38)] backdrop-blur-[6px]" onClick={onBack} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 240, damping: 30 }}
        className="absolute inset-y-0 right-0 flex w-full max-w-[388px] flex-col border-l"
        style={{
          borderColor: 'rgba(196,169,106,.18)',
          background:
            'radial-gradient(circle at top, rgba(123,168,196,.14), transparent 30%), linear-gradient(180deg, rgba(7,11,19,.99) 0%, rgba(4,7,13,.99) 100%)',
          boxShadow: '-24px 0 60px rgba(0,0,0,.42)',
        }}
      >
        <div className="border-b px-5 pb-4 pt-12" style={{ borderColor: 'rgba(196,169,106,.12)' }}>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[var(--gold)] transition duration-300 hover:text-[var(--gold-bright)]"
              style={{ borderColor: 'rgba(196,169,106,.18)', backgroundColor: 'rgba(196,169,106,.04)' }}
              aria-label="返回梦境世界书"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] tracking-[0.22em] text-[var(--mist)]">梦中世界书 / 导入整理</div>
              <div className="mt-1 inline-flex items-center gap-2 text-[16px] font-[300] tracking-[0.18em] text-[var(--paper)]">
                <DreamWorldBookGlyph active className="h-4 w-4 text-[var(--gold)]" />
                <span>整理今夜书页</span>
              </div>
              <div className="mt-1 text-[10px] tracking-[0.16em] text-[var(--mist)]">
                识别到 {drafts.length} 条。先整理，再带进这场梦。
              </div>
            </div>
            <button
              type="button"
              onClick={onConfirmImport}
              disabled={selectedCount === 0}
              className="rounded-full border px-4 py-2 text-[11px] tracking-[0.2em] text-[var(--gold)] transition duration-300 hover:text-[var(--gold-bright)] disabled:opacity-40"
              style={{ borderColor: 'rgba(196,169,106,.24)', backgroundColor: 'rgba(196,169,106,.06)' }}
            >
              带入今夜
            </button>
          </div>
        </div>

        <div className="border-b px-5 py-4" style={{ borderColor: 'rgba(196,169,106,.12)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onImportDefault}
              className="rounded-full border px-3 py-2 text-[11px] tracking-[0.18em] text-[var(--gold)] transition duration-300 hover:text-[var(--gold-bright)]"
              style={{ borderColor: 'rgba(196,169,106,.24)', backgroundColor: 'rgba(196,169,106,.06)' }}
            >
              按默认导入
            </button>
            <button
              type="button"
              onClick={onToggleAdvancedMode}
              className="rounded-full border px-3 py-2 text-[11px] tracking-[0.18em] transition duration-300"
              style={{
                borderColor: advancedMode ? 'rgba(143,207,255,.34)' : 'rgba(143,207,255,.24)',
                backgroundColor: advancedMode ? 'rgba(143,207,255,.14)' : 'rgba(143,207,255,.07)',
                color: 'var(--azure-bright)',
              }}
            >
              高级整理
            </button>
            <span className="rounded-full border px-3 py-2 text-[10px] tracking-[0.16em] text-[var(--mist)]" style={{ borderColor: 'rgba(196,169,106,.12)' }}>
              已选 {selectedCount} 条{advancedMode && mergedCount > 0 ? ` · ${mergedCount} 组会合并` : ''}
            </span>
          </div>
          <div
            className="mt-3 rounded-[20px] border px-3 py-3 text-[10px] leading-[1.9] tracking-[0.14em] text-[var(--mist)]"
            style={{ borderColor: 'rgba(196,169,106,.12)', backgroundColor: 'rgba(255,255,255,.02)' }}
          >
            标签还是这场梦的骨架。世界书只负责补兼容细节，撞标签的内容不会算进今夜。
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-8 pt-5">
          {drafts.map((draft, index) => {
            const active = draft.include;
            const mergeGroup = draft.mergeGroup.trim();

            return (
              <div
                key={draft.draftId}
                className="rounded-[24px] border px-4 py-4 transition duration-300"
                style={{
                  borderColor: active ? 'rgba(196,169,106,.24)' : 'rgba(123,168,196,.14)',
                  background: active
                    ? 'linear-gradient(180deg, rgba(18,24,38,.94) 0%, rgba(10,15,25,.9) 100%)'
                    : 'linear-gradient(180deg, rgba(10,15,25,.8) 0%, rgba(7,11,19,.74) 100%)',
                  boxShadow: active ? '0 0 24px rgba(196,169,106,.06)' : 'none',
                  opacity: active ? 1 : 0.74,
                }}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleInclude(draft.draftId)}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition duration-300"
                    style={{
                      borderColor: active ? 'rgba(123,168,196,.28)' : 'rgba(123,168,196,.22)',
                      backgroundColor: active ? 'rgba(123,168,196,.12)' : 'rgba(123,168,196,.05)',
                      color: active ? 'var(--jade)' : 'transparent',
                    }}
                    aria-label={active ? `取消导入 ${draft.title}` : `导入 ${draft.title}`}
                  >
                    <Check size={12} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-[300] leading-[1.7] tracking-[0.12em] text-[var(--paper)]">
                          {index + 1}. {draft.title}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] tracking-[0.16em]">
                          <span className="rounded-full border px-2 py-[3px] text-[var(--mist)]" style={{ borderColor: 'rgba(123,168,196,.18)' }}>
                            {normalizeWorldBookCategory(draft.category)}
                          </span>
                          <span className="rounded-full border px-2 py-[3px] text-[var(--gold)]" style={{ borderColor: 'rgba(196,169,106,.2)' }}>
                            {getWorldBookPriorityLabel(draft.priorityLevel)}优先
                          </span>
                          {advancedMode && mergeGroup ? (
                            <span className="rounded-full border px-2 py-[3px] text-[var(--jade)]" style={{ borderColor: 'rgba(123,168,196,.22)' }}>
                              合并到：{mergeGroup}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {advancedMode ? (
                        <div className="mt-0.5 flex shrink-0 items-center gap-1 text-[var(--jade)]">
                          <Sparkles size={14} />
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 text-[11px] leading-[1.95] tracking-[0.08em] text-[var(--paper-60)]">
                      {buildPreview(draft.content)}
                    </div>

                    {advancedMode ? (
                      <div className="mt-4 space-y-1.5">
                        <label className="text-[10px] tracking-[0.14em] text-[var(--mist)]">合并名（可空）</label>
                        <input
                          type="text"
                          value={draft.mergeGroup}
                          onChange={(event) => onChangeMergeGroup(draft.draftId, event.target.value)}
                          placeholder="留空就单独导入；同名会合并成一条"
                          className="w-full rounded-2xl border bg-transparent px-3 py-2 text-[13px] text-[var(--paper)] outline-none transition duration-300 placeholder:text-[rgba(228,208,160,.42)]"
                          style={{
                            borderColor: 'rgba(196,169,106,.16)',
                            backgroundColor: 'rgba(255,255,255,.02)',
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

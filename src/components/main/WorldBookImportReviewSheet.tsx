import React from 'react';
import type { WorldBookEntry } from '../../types';
import { Check, ChevronLeft, Sparkles } from 'lucide-react';
import {
  getWorldBookPriorityLabel,
  normalizeWorldBookCategory,
} from '../../services/world-book/worldBookMeta';

export type WorldBookImportDraft = WorldBookEntry & {
  draftId: string;
  include: boolean;
  mergeGroup: string;
};

type WorldBookImportReviewSheetProps = {
  drafts: WorldBookImportDraft[];
  advancedMode: boolean;
  onBack: () => void;
  onImportDefault: () => void;
  onToggleAdvancedMode: () => void;
  onConfirmImport: () => void;
  onToggleInclude: (draftId: string) => void;
  onChangeMergeGroup: (draftId: string, value: string) => void;
};

function buildPreview(text: string, maxLength = 180) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

export function WorldBookImportReviewSheet({
  drafts,
  advancedMode,
  onBack,
  onImportDefault,
  onToggleAdvancedMode,
  onConfirmImport,
  onToggleInclude,
  onChangeMergeGroup,
}: WorldBookImportReviewSheetProps) {
  const selectedCount = drafts.filter((draft) => draft.include).length;
  const mergedCount = new Set(
    drafts
      .filter((draft) => draft.include && draft.mergeGroup.trim())
      .map((draft) => draft.mergeGroup.trim().toLowerCase()),
  ).size;

  return (
    <div className="absolute inset-0 z-[120] flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 pb-4 pt-12">
        <button onClick={onBack} className="-ml-2 rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100">
          <ChevronLeft size={22} />
        </button>
        <div className="text-center">
          <div className="text-[17px] font-bold text-zinc-900">导入整理</div>
          <div className="mt-1 text-[11px] text-zinc-500">识别到 {drafts.length} 条，你可以直接导入，也可以先整理。</div>
        </div>
        <button
          onClick={onConfirmImport}
          disabled={selectedCount === 0}
          className="rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-40"
        >
          导入
        </button>
      </div>

      <div className="border-b border-zinc-100 bg-zinc-50/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onImportDefault}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            按默认导入
          </button>
          <button
            onClick={onToggleAdvancedMode}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              advancedMode
                ? 'border-violet-200 bg-violet-50 text-violet-700'
                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            高级整理
          </button>
          <span className="text-[11px] text-zinc-500">
            已选 {selectedCount} 条
            {advancedMode && mergedCount > 0 ? ` · ${mergedCount} 组会合并` : ''}
          </span>
        </div>
        <div className="mt-2 text-[11px] leading-[1.7] text-zinc-500">
          {advancedMode
            ? '同一个“合并名”的条目会变成一条世界书；留空就是单独导入。'
            : '默认会把每一条都单独导入。'}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {drafts.map((draft, index) => {
          const active = draft.include;
          return (
            <div
              key={draft.draftId}
              className={`rounded-2xl border p-4 transition-colors ${
                active ? 'border-zinc-200 bg-white shadow-sm' : 'border-zinc-100 bg-zinc-50 opacity-70'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onToggleInclude(draft.draftId)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    active ? 'border-zinc-200 bg-zinc-100 text-zinc-600' : 'border-zinc-300 bg-white text-transparent'
                  }`}
                  aria-label={active ? `取消导入 ${draft.title}` : `导入 ${draft.title}`}
                >
                  <Check size={12} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold leading-[1.5] text-zinc-900">
                        {index + 1}. {draft.title}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                          {normalizeWorldBookCategory(draft.category)}
                        </span>
                        <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                          {getWorldBookPriorityLabel(draft.priorityLevel)}优先
                        </span>
                        {advancedMode && draft.mergeGroup.trim() ? (
                          <span className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700">
                            合并到：{draft.mergeGroup.trim()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {advancedMode ? (
                      <div className="mt-0.5 flex shrink-0 items-center gap-1 text-violet-500">
                        <Sparkles size={14} />
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 text-[13px] leading-[1.8] text-zinc-600">
                    {buildPreview(draft.content)}
                  </div>

                  {advancedMode ? (
                    <div className="mt-4 space-y-1.5">
                      <label className="text-[11px] text-zinc-500">合并名（可空）</label>
                      <input
                        type="text"
                        value={draft.mergeGroup}
                        onChange={(event) => onChangeMergeGroup(draft.draftId, event.target.value)}
                        placeholder="留空就单独导入；同名会合并成一条"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] outline-none transition-colors focus:border-violet-300"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

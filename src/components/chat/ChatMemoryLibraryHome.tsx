import { BarChart3, ChevronLeft, Download, FolderOpen, Hash, LibraryBig, Share2 } from 'lucide-react';
import type { MemoryLibraryKind } from '../../types';
import type { MemoryLibraryYearGroup } from '../../services/memory/memoryLibrary';

export type MemoryLibraryStatsCard = {
  label: string;
  value: string;
  helper: string;
};

type ChatMemoryLibraryHomeProps = {
  kind: MemoryLibraryKind;
  title: string;
  description: string;
  activeTab: 'library' | 'stats';
  statsCards: MemoryLibraryStatsCard[];
  yearGroups: MemoryLibraryYearGroup[];
  onBack: () => void;
  onImport: () => void;
  onExport: () => void;
  onOpenYear: (group: MemoryLibraryYearGroup) => void;
  onTabChange: (tab: 'library' | 'stats') => void;
};

function getKindBadge(kind: MemoryLibraryKind): string {
  return kind === 'short-term' ? '短期记忆库' : '长期记忆库';
}

function buildYearSubtitle(group: MemoryLibraryYearGroup): string {
  return `${group.totalEntries} 条 · ${group.totalChars} 字`;
}

function renderLibraryEmptyState() {
  return (
    <div className="rounded-[22px] border border-white/85 bg-white/72 px-5 py-6 text-center shadow-[0_10px_28px_rgba(17,24,39,0.05)] backdrop-blur-xl">
      <div className="text-[14px] font-medium text-zinc-700">还没有记忆记录</div>
      <div className="mt-1 text-[12px] text-zinc-400">触发一次总结后，这里就会出现对应年份。</div>
    </div>
  );
}

export function ChatMemoryLibraryHome({
  kind,
  title,
  description,
  activeTab,
  statsCards,
  yearGroups,
  onBack,
  onImport,
  onExport,
  onOpenYear,
  onTabChange,
}: ChatMemoryLibraryHomeProps) {
  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-[linear-gradient(180deg,rgba(248,248,250,0.96),rgba(242,242,245,0.98))]">
      <div className="shrink-0 border-b border-white/60 bg-white/55 px-4 pb-3 pt-12 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-[44rem] items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-full p-1 text-zinc-600 transition-colors active:text-zinc-900"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-semibold tracking-[-0.02em] text-zinc-950">{title}</div>
            <div className="mt-1 text-[12px] leading-5 text-zinc-500">{description}</div>
          </div>
          <div className="rounded-full border border-white/80 bg-white/70 px-3 py-1 text-[11px] text-zinc-600 shadow-sm backdrop-blur-xl">
            {getKindBadge(kind)}
          </div>
        </div>

        <div className="mx-auto mt-4 flex w-full max-w-[44rem] items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-zinc-200/80 bg-white/72 p-1 shadow-[0_8px_22px_rgba(17,24,39,0.05)] backdrop-blur-xl">
            <button
              onClick={() => onTabChange('library')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium transition-all ${
                activeTab === 'library'
                  ? 'border border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm'
                  : 'text-zinc-600 active:bg-zinc-100/80'
              }`}
            >
              <LibraryBig size={14} />
              记忆库
            </button>
            <button
              onClick={() => onTabChange('stats')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium transition-all ${
                activeTab === 'stats'
                  ? 'border border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm'
                  : 'text-zinc-600 active:bg-zinc-100/80'
              }`}
            >
              <BarChart3 size={14} />
              统计
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onExport}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/78 px-4 py-2 text-[12px] font-medium text-zinc-900 shadow-[0_8px_22px_rgba(17,24,39,0.05)] backdrop-blur-xl transition-colors active:bg-zinc-100"
            >
              <Share2 size={14} />
              导出记忆
            </button>
            <button
              onClick={onImport}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/78 px-4 py-2 text-[12px] font-medium text-zinc-900 shadow-[0_8px_22px_rgba(17,24,39,0.05)] backdrop-blur-xl transition-colors active:bg-zinc-100"
            >
              <Download size={14} />
              导入记忆
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-4">
          {activeTab === 'library' ? (
            yearGroups.length > 0 ? (
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {yearGroups.map((group) => (
                  <button
                    key={group.key}
                    onClick={() => onOpenYear(group)}
                    className="aspect-square rounded-[26px] border border-white/85 bg-white/64 p-4 text-left shadow-[0_18px_40px_rgba(17,24,39,0.08)] backdrop-blur-2xl transition-transform active:scale-[0.98]"
                  >
                    <div className="flex h-full flex-col">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-zinc-100/85 text-zinc-700 shadow-sm">
                        <FolderOpen size={18} />
                      </div>
                      <div className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-zinc-950">{group.year}</div>
                      <div className="mt-1 text-[12px] leading-5 text-zinc-500">{buildYearSubtitle(group)}</div>
                      <div className="mt-auto flex items-center justify-between text-[11px] text-zinc-400">
                        <span>{group.months.length} 个月</span>
                        <span className="inline-flex items-center gap-1">
                          <Hash size={11} />
                          {group.totalChars}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </section>
            ) : (
              renderLibraryEmptyState()
            )
          ) : (
            <section className="rounded-[24px] border border-white/80 bg-white/58 p-3 shadow-[0_18px_40px_rgba(17,24,39,0.08)] backdrop-blur-2xl">
              <div className="grid grid-cols-2 gap-2.5">
                {statsCards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-[18px] border border-white/85 bg-white/72 px-4 py-3 shadow-[0_8px_24px_rgba(17,24,39,0.05)] backdrop-blur-xl"
                  >
                    <div className="text-[11px] text-zinc-500">{card.label}</div>
                    <div className="mt-1 text-[19px] font-semibold tracking-[-0.03em] text-zinc-950">{card.value}</div>
                    <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-zinc-400">{card.helper}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

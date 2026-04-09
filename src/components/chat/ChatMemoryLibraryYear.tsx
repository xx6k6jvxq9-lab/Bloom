import { ChevronLeft, ChevronRight, Clock3, FileText, Hash, FolderOpen } from 'lucide-react';
import type { MemoryLibraryKind } from '../../types';
import type { MemoryLibraryMonthGroup, MemoryLibraryYearGroup } from '../../services/memory/memoryLibrary';

type ChatMemoryLibraryYearProps = {
  kind: MemoryLibraryKind;
  group: MemoryLibraryYearGroup;
  onBack: () => void;
  onOpenMonth: (group: MemoryLibraryMonthGroup) => void;
};

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp);
}

function getKindLabel(kind: MemoryLibraryKind): string {
  return kind === 'short-term' ? '短期记忆' : '长期记忆';
}

export function ChatMemoryLibraryYear({
  kind,
  group,
  onBack,
  onOpenMonth,
}: ChatMemoryLibraryYearProps) {
  return (
    <div className="absolute inset-0 z-[81] flex flex-col bg-[linear-gradient(180deg,rgba(248,248,250,0.96),rgba(242,242,245,0.98))]">
      <div className="shrink-0 border-b border-white/60 bg-white/55 px-4 pb-3 pt-12 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-[44rem] items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-full p-1 text-zinc-600 transition-colors active:text-zinc-900"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-semibold tracking-[-0.02em] text-zinc-950">{group.label}</div>
            <div className="mt-1 text-[12px] leading-5 text-zinc-500">
              查看这一年沉淀下来的所有{getKindLabel(kind)}月份。
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-4">
          <section className="rounded-[28px] border border-white/80 bg-white/58 p-4 shadow-[0_18px_40px_rgba(17,24,39,0.08)] backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/75 text-zinc-700 shadow-sm">
                <FolderOpen size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold tracking-[-0.02em] text-zinc-950">年度概览</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <FileText size={12} />
                    {group.totalEntries} 条
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Hash size={12} />
                    {group.totalChars} 字
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/58 shadow-[0_18px_40px_rgba(17,24,39,0.08)] backdrop-blur-2xl">
            {group.months.map((month, index) => (
              <button
                key={month.key}
                onClick={() => onOpenMonth(month)}
                className={`block w-full px-4 py-4 text-left transition-colors active:bg-white/75 ${index === 0 ? '' : 'border-t border-zinc-200/60'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100/80 text-zinc-700">
                    <Clock3 size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold tracking-[-0.02em] text-zinc-950">{month.label}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                      <span>{month.entries.length} 条</span>
                      <span>{month.totalChars} 字</span>
                    </div>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-zinc-400 shadow-sm">
                    <ChevronRight size={16} />
                  </div>
                </div>
                <div className="mt-3 text-[12px] leading-6 text-zinc-500">
                  最近更新：{formatDateTime(month.latestCreatedAt)}
                </div>
              </button>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

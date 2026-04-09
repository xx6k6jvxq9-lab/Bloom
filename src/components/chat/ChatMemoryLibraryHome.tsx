import { BarChart3, ChevronLeft, ChevronRight, Clock3, FileText, Hash, LibraryBig } from 'lucide-react';
import type { MemoryLibraryKind } from '../../types';
import type { MemoryLibraryMonthGroup } from '../../services/memory/memoryLibrary';

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
  monthGroups: MemoryLibraryMonthGroup[];
  onBack: () => void;
  onOpenMonth: (group: MemoryLibraryMonthGroup) => void;
  onTabChange: (tab: 'library' | 'stats') => void;
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

function getKindBadge(kind: MemoryLibraryKind): string {
  return kind === 'short-term' ? '短期记忆库' : '长期记忆库';
}

function renderLibraryEmptyState() {
  return (
    <div className="rounded-[24px] border border-white/85 bg-white/72 px-5 py-8 text-center shadow-[0_10px_28px_rgba(17,24,39,0.05)] backdrop-blur-xl">
      <div className="text-[14px] font-medium text-zinc-700">还没有记忆记录</div>
      <div className="mt-2 text-[12px] leading-6 text-zinc-400">
        触发一次总结后，这里就会按真实时间收进记忆库。
      </div>
    </div>
  );
}

export function ChatMemoryLibraryHome({
  kind,
  title,
  description,
  activeTab,
  statsCards,
  monthGroups,
  onBack,
  onOpenMonth,
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

        <div className="mx-auto mt-4 w-full max-w-[44rem]">
          <div className="inline-flex rounded-full border border-white/85 bg-white/70 p-1 shadow-[0_8px_22px_rgba(17,24,39,0.05)] backdrop-blur-xl">
            <button
              onClick={() => onTabChange('library')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium transition-all ${
                activeTab === 'library'
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-zinc-600 active:bg-white/70'
              }`}
            >
              <LibraryBig size={14} />
              记忆库
            </button>
            <button
              onClick={() => onTabChange('stats')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium transition-all ${
                activeTab === 'stats'
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-zinc-600 active:bg-white/70'
              }`}
            >
              <BarChart3 size={14} />
              统计
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-4">
          {activeTab === 'library' ? (
            <>
              <section className="rounded-[28px] border border-white/80 bg-white/58 p-4 shadow-[0_18px_40px_rgba(17,24,39,0.08)] backdrop-blur-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/75 text-zinc-700 shadow-sm">
                    <Clock3 size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-semibold tracking-[-0.02em] text-zinc-950">按年月查看</div>
                    <div className="mt-1 text-[12px] leading-5 text-zinc-500">
                      点击某个月后，进入该月页面查看从上到下排列的每条记忆。
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[24px] border border-white/85 bg-white/68 shadow-[0_10px_30px_rgba(17,24,39,0.05)] backdrop-blur-xl">
                  {monthGroups.length > 0 ? (
                    monthGroups.map((group, index) => (
                      <button
                        key={group.key}
                        onClick={() => onOpenMonth(group)}
                        className={`block w-full px-4 py-4 text-left transition-colors active:bg-white/75 ${index === 0 ? '' : 'border-t border-zinc-200/60'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100/80 text-zinc-700">
                            <Clock3 size={17} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-semibold tracking-[-0.02em] text-zinc-950">{group.label}</div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                              <span className="inline-flex items-center gap-1">
                                <FileText size={12} />
                                {group.entries.length} 条
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Hash size={12} />
                                {group.totalChars} 字
                              </span>
                            </div>
                          </div>
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-zinc-400 shadow-sm">
                            <ChevronRight size={16} />
                          </div>
                        </div>
                        <div className="mt-3 text-[12px] leading-6 text-zinc-500">
                          最近更新：{formatDateTime(group.latestCreatedAt)}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4">
                      {renderLibraryEmptyState()}
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-[28px] border border-white/80 bg-white/58 p-4 shadow-[0_18px_40px_rgba(17,24,39,0.08)] backdrop-blur-2xl">
              <div className="grid grid-cols-2 gap-3">
                {statsCards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-[22px] border border-white/85 bg-white/72 px-4 py-3 shadow-[0_8px_24px_rgba(17,24,39,0.05)] backdrop-blur-xl"
                  >
                    <div className="text-[11px] text-zinc-500">{card.label}</div>
                    <div className="mt-1 text-[21px] font-semibold tracking-[-0.03em] text-zinc-950">{card.value}</div>
                    <div className="mt-1 text-[11px] leading-5 text-zinc-400">{card.helper}</div>
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

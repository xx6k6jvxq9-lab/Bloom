import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, FileText, Hash } from 'lucide-react';
import type { MemoryLibraryEntry, MemoryLibraryKind } from '../../types';
import type { MemoryLibraryMonthGroup, MemoryLibraryYearGroup } from '../../services/memory/memoryLibrary';

type ChatMemoryLibraryYearProps = {
  kind: MemoryLibraryKind;
  group: MemoryLibraryYearGroup;
  onBack: () => void;
  onSelectEntry: (entry: MemoryLibraryEntry) => void;
};

function formatDateTime(entry: MemoryLibraryEntry): string {
  const month = String(entry.month).padStart(2, '0');
  const day = String(entry.day).padStart(2, '0');
  const hour = String(entry.hour).padStart(2, '0');
  const minute = String(entry.minute).padStart(2, '0');
  return `${entry.year}-${month}-${day} ${hour}:${minute}`;
}

function getSourceLabel(source: MemoryLibraryEntry['source']): string {
  return source === 'auto' ? '自动总结' : '手动总结';
}

function getKindLabel(kind: MemoryLibraryKind): string {
  return kind === 'short-term' ? '短期记忆' : '长期记忆';
}

function buildPreviewText(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > 72 ? `${normalized.slice(0, 72)}...` : normalized;
}

function buildMonthChipLabel(group: MemoryLibraryMonthGroup): string {
  return `${String(group.month).padStart(2, '0')} 月`;
}

export function ChatMemoryLibraryYear({
  kind,
  group,
  onBack,
  onSelectEntry,
}: ChatMemoryLibraryYearProps) {
  const [selectedMonthKey, setSelectedMonthKey] = useState(group.months[0]?.key ?? '');

  useEffect(() => {
    setSelectedMonthKey(group.months[0]?.key ?? '');
  }, [group]);

  const selectedMonth = useMemo(
    () => group.months.find((month) => month.key === selectedMonthKey) ?? group.months[0] ?? null,
    [group, selectedMonthKey],
  );

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
            <div className="text-[18px] font-semibold tracking-[-0.02em] text-zinc-950">{group.year} 年</div>
            <div className="mt-1 text-[12px] leading-5 text-zinc-500">
              用月份筛选查看这一年收进来的每条{getKindLabel(kind)}。
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-4">
          <section className="rounded-[28px] border border-white/80 bg-white/58 p-4 shadow-[0_18px_40px_rgba(17,24,39,0.08)] backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/75 text-zinc-700 shadow-sm">
                <Clock3 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold tracking-[-0.02em] text-zinc-950">{group.year} 年概览</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <FileText size={12} />
                    {group.totalEntries} 条
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Hash size={12} />
                    {group.totalChars} 字
                  </span>
                  <span>{group.months.length} 个月</span>
                </div>
              </div>
            </div>

            {group.months.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {group.months.map((month) => {
                  const isActive = selectedMonth?.key === month.key;
                  return (
                    <button
                      key={month.key}
                      onClick={() => setSelectedMonthKey(month.key)}
                      className={`shrink-0 rounded-full border px-4 py-2 text-[12px] font-medium transition-all ${
                        isActive
                          ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm'
                          : 'border-white/80 bg-white/78 text-zinc-500 active:bg-zinc-100/80'
                      }`}
                    >
                      {buildMonthChipLabel(month)}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {selectedMonth ? (
            <>
              <section className="rounded-[24px] border border-white/85 bg-white/64 px-4 py-3 shadow-[0_12px_28px_rgba(17,24,39,0.05)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-semibold tracking-[-0.02em] text-zinc-950">
                      {selectedMonth.year} 年 {String(selectedMonth.month).padStart(2, '0')} 月
                    </div>
                    <div className="mt-1 text-[12px] text-zinc-500">
                      {selectedMonth.entries.length} 条记录 · {selectedMonth.totalChars} 字
                    </div>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/58 shadow-[0_18px_40px_rgba(17,24,39,0.08)] backdrop-blur-2xl">
                {selectedMonth.entries.map((entry, index) => (
                  <button
                    key={entry.id}
                    onClick={() => onSelectEntry(entry)}
                    className={`block w-full px-4 py-4 text-left transition-colors active:bg-white/75 ${index === 0 ? '' : 'border-t border-zinc-200/60'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100/80 text-zinc-700">
                        <FileText size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[15px] font-semibold leading-6 tracking-[-0.02em] text-zinc-950">
                          {buildPreviewText(entry.content)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                          <span>{formatDateTime(entry)}</span>
                          <span>{getSourceLabel(entry.source)}</span>
                          <span>{entry.charCount} 字</span>
                        </div>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-zinc-400 shadow-sm">
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </button>
                ))}
              </section>
            </>
          ) : (
            <section className="rounded-[24px] border border-white/85 bg-white/72 px-5 py-7 text-center shadow-[0_10px_28px_rgba(17,24,39,0.05)] backdrop-blur-xl">
              <div className="text-[14px] font-medium text-zinc-700">这一年还没有记忆记录</div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

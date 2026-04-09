import { ChevronLeft, Clock3, FileText, Hash, Layers3 } from 'lucide-react';
import type { MemoryLibraryEntry, MemoryLibraryKind } from '../../types';

type ChatMemoryLibraryEntryProps = {
  kind: MemoryLibraryKind;
  entry: MemoryLibraryEntry;
  onBack: () => void;
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

function getEntryTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 28) {
    return normalized;
  }
  return `${normalized.slice(0, 28)}...`;
}

export function ChatMemoryLibraryEntry({
  kind,
  entry,
  onBack,
}: ChatMemoryLibraryEntryProps) {
  return (
    <div className="absolute inset-0 z-[82] flex flex-col bg-[linear-gradient(180deg,rgba(248,248,250,0.96),rgba(242,242,245,0.98))]">
      <div className="shrink-0 border-b border-white/60 bg-white/55 px-4 pb-3 pt-12 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-[44rem] items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-full p-1 text-zinc-600 transition-colors active:text-zinc-900"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-semibold tracking-[-0.02em] text-zinc-950">记忆详情</div>
            <div className="mt-1 text-[12px] leading-5 text-zinc-500">
              查看这条{getKindLabel(kind)}的完整内容和记录信息。
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-3">
          <section className="rounded-[24px] border border-white/80 bg-white/58 p-4 shadow-[0_18px_40px_rgba(17,24,39,0.08)] backdrop-blur-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-white/75 text-zinc-700 shadow-sm">
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[17px] font-semibold leading-7 tracking-[-0.03em] text-zinc-950">
                  {getEntryTitle(entry.content)}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-zinc-500">
                  <span>{formatDateTime(entry)}</span>
                  <span>{getSourceLabel(entry.source)}</span>
                  <span>{getKindLabel(kind)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[18px] border border-white/85 bg-white/72 px-4 py-3 shadow-[0_10px_24px_rgba(17,24,39,0.05)] backdrop-blur-xl">
              <div className="inline-flex items-center gap-2 text-[11px] text-zinc-500">
                <Clock3 size={12} />
                记录时间
              </div>
              <div className="mt-1.5 text-[14px] font-semibold tracking-[-0.02em] text-zinc-950">
                {formatDateTime(entry)}
              </div>
            </div>

            <div className="rounded-[18px] border border-white/85 bg-white/72 px-4 py-3 shadow-[0_10px_24px_rgba(17,24,39,0.05)] backdrop-blur-xl">
              <div className="inline-flex items-center gap-2 text-[11px] text-zinc-500">
                <Hash size={12} />
                字数
              </div>
              <div className="mt-1.5 text-[14px] font-semibold tracking-[-0.02em] text-zinc-950">
                {entry.charCount} 字
              </div>
            </div>

            <div className="rounded-[18px] border border-white/85 bg-white/72 px-4 py-3 shadow-[0_10px_24px_rgba(17,24,39,0.05)] backdrop-blur-xl">
              <div className="inline-flex items-center gap-2 text-[11px] text-zinc-500">
                <Layers3 size={12} />
                所属年月
              </div>
              <div className="mt-1.5 text-[14px] font-semibold tracking-[-0.02em] text-zinc-950">
                {entry.year} 年 {String(entry.month).padStart(2, '0')} 月
              </div>
            </div>

            <div className="rounded-[18px] border border-white/85 bg-white/72 px-4 py-3 shadow-[0_10px_24px_rgba(17,24,39,0.05)] backdrop-blur-xl">
              <div className="inline-flex items-center gap-2 text-[11px] text-zinc-500">
                <FileText size={12} />
                来源
              </div>
              <div className="mt-1.5 text-[14px] font-semibold tracking-[-0.02em] text-zinc-950">
                {getSourceLabel(entry.source)}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/80 bg-white/58 p-4 shadow-[0_18px_40px_rgba(17,24,39,0.08)] backdrop-blur-2xl">
            <div className="text-[15px] font-semibold tracking-[-0.02em] text-zinc-950">完整内容</div>
            <div className="mt-3 rounded-[18px] border border-white/85 bg-white/72 px-4 py-4 text-[14px] leading-7 text-zinc-700 shadow-[0_10px_24px_rgba(17,24,39,0.05)] backdrop-blur-xl whitespace-pre-wrap break-words">
              {entry.content}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

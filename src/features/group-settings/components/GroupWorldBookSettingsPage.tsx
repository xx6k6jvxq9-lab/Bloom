import { Check, ChevronLeft } from 'lucide-react';
import type { WorldBookEntry } from '../../../types';

type GroupWorldBookSettingsPageProps = {
  worldBooks: WorldBookEntry[];
  activeWorldBookIds: string[];
  onBack: () => void;
  onToggleWorldBook: (worldBookId: string) => void;
};

const TEXT = {
  title: '\u7fa4\u4e16\u754c\u4e66',
  subtitle: '\u7ed9\u5f53\u524d\u7fa4\u804a\u7ed1\u5b9a\u4f1a\u88ab\u8bfb\u53d6\u7684\u4e16\u754c\u4e66',
  empty: '\u6682\u65e0\u4e16\u754c\u4e66\uff0c\u8bf7\u5148\u53bb\u201c\u6211\u7684\u201d\u9875\u9762\u6dfb\u52a0\u3002',
} as const;

export function GroupWorldBookSettingsPage({
  worldBooks = [],
  activeWorldBookIds = [],
  onBack,
  onToggleWorldBook,
}: GroupWorldBookSettingsPageProps) {
  return (
    <div className="absolute inset-0 z-[121] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[16px] font-bold text-zinc-900">{TEXT.title}</h2>
          <span className="text-[11px] text-zinc-500">{TEXT.subtitle}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {worldBooks.length === 0 ? (
          <div className="rounded-[28px] bg-white px-4 py-10 text-center text-sm text-zinc-400 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
            {TEXT.empty}
          </div>
        ) : (
          <div className="space-y-3">
            {worldBooks.map((worldBook) => {
              const isActive = activeWorldBookIds.includes(worldBook.id);
              return (
                <button
                  key={worldBook.id}
                  type="button"
                  onClick={() => onToggleWorldBook(worldBook.id)}
                  className={`flex w-full items-start justify-between rounded-[28px] border px-4 py-4 text-left shadow-[0_8px_32px_rgba(15,23,42,0.06)] transition-all ${
                    isActive
                      ? 'border-zinc-200 bg-zinc-100 text-zinc-900'
                      : 'border-zinc-100 bg-white text-zinc-900'
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <div className="truncate text-[15px] font-semibold">{worldBook.title}</div>
                    <div className={`mt-1 text-[12px] ${isActive ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      {worldBook.category}
                    </div>
                    {worldBook.content?.trim() ? (
                      <div className={`mt-2 line-clamp-2 text-[12px] leading-5 ${isActive ? 'text-zinc-600' : 'text-zinc-500'}`}>
                        {worldBook.content.trim()}
                      </div>
                    ) : null}
                  </div>
                  {isActive ? <Check size={18} className="mt-0.5 shrink-0 text-zinc-700" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

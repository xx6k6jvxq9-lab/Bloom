import { Check, ChevronLeft } from 'lucide-react';
import type { WorldBookEntry } from '../../../types';
import { getWorldBookPriorityLabel, normalizeWorldBookCategory, sortWorldBooksByPriority } from '../../../services/world-book/worldBookMeta';
import type { WorldBookPromptDiagnostics } from '../../../services/world-book/worldBookBudget';

type GroupWorldBookSettingsPageProps = {
  worldBooks: WorldBookEntry[];
  activeWorldBookIds: string[];
  diagnostics?: WorldBookPromptDiagnostics | null;
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
  diagnostics = null,
  onBack,
  onToggleWorldBook,
}: GroupWorldBookSettingsPageProps) {
  const orderedWorldBooks = sortWorldBooksByPriority(worldBooks);

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
        {diagnostics && (
          <div className="mb-4 rounded-[28px] border border-zinc-100 bg-white px-4 py-4 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
            <div className="text-[14px] font-semibold text-zinc-900">当前群聊世界书读取参考</div>
            <div className="mt-1 text-[11px] leading-5 text-zinc-500">
              群聊会先读总览和必读规则，再按这轮聊天内容动态补读相关正文片段。正文细节为 0，不等于没读，只表示这轮暂时不需要额外展开。
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-zinc-600">
              <div className="rounded-2xl bg-zinc-50 px-3 py-2">已读总览 {diagnostics.overviewCount} 本</div>
              <div className="rounded-2xl bg-zinc-50 px-3 py-2">必读规则 {diagnostics.mustReadFactCount} 条</div>
              <div className="rounded-2xl bg-zinc-50 px-3 py-2">正文细节 {diagnostics.detailCount} 条</div>
              <div className="rounded-2xl bg-zinc-50 px-3 py-2">总字符 {diagnostics.totalChars}</div>
            </div>
            {(diagnostics.highRiskCount > 0 || diagnostics.detailOnlyCount > 0 || diagnostics.suppressedPinnedCount > 0) && (
              <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-3">
                <div className="text-[11px] font-medium text-amber-800">高风险世界书暴露诊断</div>
                <div className="mt-1 text-[10px] leading-5 text-amber-700">
                  当前启用世界书里有 {diagnostics.highRiskCount} 本被判定为高风险 raw 语料，其中 {diagnostics.detailOnlyCount} 本已自动切到 detail-only 常驻策略，{diagnostics.suppressedPinnedCount} 本会关闭 raw 正文的 always-on 钉住。
                </div>
              </div>
            )}
          </div>
        )}

        {worldBooks.length === 0 ? (
          <div className="rounded-[28px] bg-white px-4 py-10 text-center text-sm text-zinc-400 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
            {TEXT.empty}
          </div>
        ) : (
          <div className="space-y-3">
            {orderedWorldBooks.map((worldBook) => {
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
                    <div className={`mt-1 flex flex-wrap gap-1.5 text-[12px] ${isActive ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      <span>{normalizeWorldBookCategory(worldBook.category)}</span>
                      <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                        {getWorldBookPriorityLabel(worldBook.priorityLevel)}优先
                      </span>
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

import { ChevronLeft, Clock, FileText, History, Sparkles } from 'lucide-react';

type ChatMemoryDetailViewProps = {
  title: string;
  description: string;
  currentValue: string;
  emptyPlaceholder: string;
  helperTitle: string;
  helperText: string;
  historyPreviewTitle: string;
  historyPreviewLines: string[];
  onBack: () => void;
};

export function ChatMemoryDetailView({
  title,
  description,
  currentValue,
  emptyPlaceholder,
  helperTitle,
  helperText,
  historyPreviewTitle,
  historyPreviewLines,
  onBack,
}: ChatMemoryDetailViewProps) {
  const hasCurrentValue = currentValue.trim().length > 0;

  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-[#fafafa]">
      <div className="min-h-[64px] shrink-0 border-b border-zinc-200/80 bg-white/90 px-4 pb-3 pt-12 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 -ml-1 text-zinc-600 active:text-zinc-900"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold text-zinc-900">{title}</div>
            <div className="mt-0.5 text-[11px] leading-5 text-zinc-500">{description}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-4">
          <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-zinc-900">当前生效内容</div>
                <div className="mt-1 text-[12px] leading-5 text-zinc-500">
                  这里展示现在真正会被聊天主链读取的记忆内容。
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
              {hasCurrentValue ? (
                <div className="whitespace-pre-wrap break-words text-[14px] leading-7 text-zinc-800">
                  {currentValue}
                </div>
              ) : (
                <div className="text-[14px] leading-7 text-zinc-400">
                  {emptyPlaceholder}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-zinc-900">{helperTitle}</div>
                <div className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-zinc-500">
                  {helperText}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Clock size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-zinc-900">{historyPreviewTitle}</div>
                <div className="mt-1 text-[12px] leading-5 text-zinc-500">
                  这里先展示当前用于总结的最近对话窗口，后续再接入正式历史版本列表。
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
              {historyPreviewLines.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {historyPreviewLines.map((line, index) => (
                    <div key={`${index}-${line.slice(0, 16)}`} className="text-[13px] leading-6 text-zinc-700">
                      {line}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] leading-6 text-zinc-400">
                  还没有足够的聊天记录可以展示。
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                <History size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-zinc-900">历史记录区</div>
                <div className="mt-1 text-[12px] leading-5 text-zinc-500">
                  下一步会在这里接入正式的记忆历史版本列表、生成时间和手动整理记录。
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

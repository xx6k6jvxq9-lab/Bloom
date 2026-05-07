import { useEffect, useRef, type CSSProperties } from 'react';
import { Maximize2, Send, X } from 'lucide-react';
import { focusTextEntryElement } from '../app-shell/keyboardUtils';

type ExpandedInputSheetProps = {
  open: boolean;
  value: string;
  placeholder?: string;
  title?: string;
  sendLabel?: string;
  canSend?: boolean;
  style?: CSSProperties;
  onChange: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
};

export function ExpandedInputSheet({
  open,
  value,
  placeholder,
  title = '完整输入',
  sendLabel = '发送',
  canSend = true,
  style,
  onChange,
  onClose,
  onSend,
}: ExpandedInputSheetProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      focusTextEntryElement(textareaRef.current);
      const length = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(length, length);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || !textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = '0px';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [open, value]);

  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-[120] flex items-end bg-black/28 backdrop-blur-[2px]">
      <div
        className="w-full rounded-t-[28px] border border-zinc-200 bg-white/98 px-4 pb-4 pt-3 shadow-2xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-zinc-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100">
              <Maximize2 size={15} />
            </div>
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-[11px] text-zinc-500">在这里可以完整查看和编辑当前输入内容</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
            aria-label="关闭完整输入面板"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (canSend) {
                onSend();
              }
            }
          }}
          placeholder={placeholder}
          className="min-h-[220px] max-h-[52vh] w-full resize-none overflow-y-auto rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-[15px] leading-7 text-zinc-900 outline-none transition-colors focus:border-blue-500"
          style={style}
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-[12px] text-zinc-500">回车发送，Shift + Enter 换行</div>
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            <Send size={16} />
            {sendLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

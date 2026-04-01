import { X } from 'lucide-react';
import type { TaRememberedEntry } from '../../../services/couple-space/interaction/buildTaRememberedEntries';

type Props = {
  entry: TaRememberedEntry;
  onClose: () => void;
};

export function TaRememberedNoteSheet({ entry, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-6 backdrop-blur-[2px]">
      <div className="relative w-full max-w-sm rounded-[32px] border border-[#f2e7bc] bg-gradient-to-br from-white via-[#fffdf4] to-white px-6 pb-7 pt-8 shadow-[0_18px_45px_rgba(213,191,111,0.16)]">
        <div className="absolute left-8 top-0 h-7 w-20 rotate-[-7deg] rounded-full bg-[#f5ebbb]/80 opacity-80" />
        <div className="absolute right-7 top-1 h-6 w-14 rotate-[8deg] rounded-full bg-[#fbf3d3] opacity-95" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-[#fff7d7] p-2 text-[#c9b56a] transition hover:bg-[#fff2bf]"
          aria-label="关闭记忆卡片"
        >
          <X size={16} />
        </button>

        <div className="text-[11px] uppercase tracking-[0.22em] text-[#d3c17d]">remembered</div>
        <div className="mt-5 rounded-[26px] border border-dashed border-[#f2e7bc] bg-white/80 px-5 py-6">
          <p className="text-[23px] leading-[1.95] text-zinc-800">{entry.text}</p>
          <div className="mt-5 text-sm text-[#a39052]">
            {entry.sourceLabel}
            {entry.sourceDateText ? ` · ${entry.sourceDateText}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

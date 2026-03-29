import { ChevronLeft } from 'lucide-react';

type ArtifactPreview = {
  kind: 'draft' | 'confirmation';
  title: string;
  content: string;
  note?: string;
} | null;

type Props = {
  isOpen: boolean;
  onToggle: () => void;
  busy: boolean;
  statusText: string | null;
  artifactPreview: ArtifactPreview;
  onCheck: () => void;
};

export function CoupleSpaceInitiativeCheckCard({
  isOpen,
  onToggle,
  busy,
  statusText,
  artifactPreview,
  onCheck,
}: Props) {
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <h3 className="font-bold text-zinc-800">主动内容检查</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            手动检查并尝试一次，不会开启自动调度。
          </p>
        </div>
        <ChevronLeft
          size={18}
          className={`text-zinc-500 transition-transform ${isOpen ? '-rotate-90' : 'rotate-180'}`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-zinc-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm leading-6 text-zinc-500">
              会按当前主动设置，尝试一次最合适的主动内容。
            </p>
            <button
              type="button"
              onClick={onCheck}
              disabled={busy}
              className="whitespace-nowrap rounded-full bg-[#f6b6cd] px-5 py-1.5 text-xs font-bold text-white shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {busy ? '检查中' : '检查一次'}
            </button>
          </div>

          {(statusText || artifactPreview) && (
            <div className="mt-4 space-y-3">
              {statusText && <p className="text-sm leading-6 text-zinc-600">{statusText}</p>}
              {artifactPreview && (
                <div className="rounded-2xl border border-[#f7d7e3] bg-[#fff8fb] p-4">
                  <p className="font-bold text-zinc-800">{artifactPreview.title}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                    {artifactPreview.content}
                  </p>
                  {artifactPreview.note && (
                    <p className="mt-2 text-xs leading-5 text-zinc-500">{artifactPreview.note}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

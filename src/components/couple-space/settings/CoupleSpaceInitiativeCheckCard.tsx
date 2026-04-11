import { ChevronLeft } from 'lucide-react';
import type { CoupleSpaceInitiativeDraftEntry } from '../../../types';
import { getCoupleSpaceDraftLabel } from '../../../services/ai/couple-space/initiative/coupleSpaceDraftBuffer';

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
  draftEntries: CoupleSpaceInitiativeDraftEntry[];
  onCheck: () => void;
  onPublishDraft: (draftId: string) => void;
  onDeleteDraft: (draftId: string) => void;
};

function formatDraftSource(source: CoupleSpaceInitiativeDraftEntry['source']) {
  return source === 'manual_check' ? '手动检查' : '自动检查';
}

export function CoupleSpaceInitiativeCheckCard({
  isOpen,
  onToggle,
  busy,
  statusText,
  artifactPreview,
  draftEntries,
  onCheck,
  onPublishDraft,
  onDeleteDraft,
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

          {draftEntries.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-zinc-800">草稿箱</p>
                <p className="text-xs text-zinc-400">已保存 {draftEntries.length} 条</p>
              </div>
              {draftEntries.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-2xl border border-zinc-100 bg-white/80 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-zinc-800">
                        {getCoupleSpaceDraftLabel(draft.actionType)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {formatDraftSource(draft.source)} ·{' '}
                        {new Date(draft.createdAt).toLocaleString([], {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onDeleteDraft(draft.id)}
                        className="rounded-full px-3 py-1 text-xs font-bold text-zinc-500 transition-colors hover:text-rose-400"
                      >
                        删除
                      </button>
                      <button
                        type="button"
                        onClick={() => onPublishDraft(draft.id)}
                        className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
                      >
                        发布到空间
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                    {draft.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

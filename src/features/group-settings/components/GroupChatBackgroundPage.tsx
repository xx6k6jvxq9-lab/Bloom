import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Image as ImageIcon, Link2, Upload, X } from 'lucide-react';
import { extractSingleImageUrl } from '../../../utils';
import { getDisplayableAssetValue } from '../../persistence/persistentAssetRef';
import { usePersistentFieldActions } from '../../persistence/usePersistentFieldActions';
import { useResolvedPersistentValue } from '../../persistence/useResolvedPersistentValue';

type GroupChatBackgroundPageProps = {
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
};

const TEXT = {
  title: '\u7fa4\u804a\u5929\u80cc\u666f',
  subtitle: '\u652f\u6301\u56fe\u7247\u94fe\u63a5\u3001\u4e0a\u4f20\u548c\u5b9e\u65f6\u9884\u89c8',
  previewTitle: '\u7fa4\u804a\u80cc\u666f\u9884\u89c8',
  previewSummary: '\u4fdd\u5b58\u540e\u4f1a\u5e94\u7528\u5230\u5f53\u524d\u7fa4\u804a\u6d88\u606f\u533a',
  previewIncoming: '\u4eca\u5929\u8fd9\u4e2a\u7fa4\u7684\u80cc\u666f\u7ec8\u4e8e\u5355\u72ec\u914d\u597d\u4e86\u3002',
  previewOutgoing: '\u94fe\u63a5\u3001\u4e0a\u4f20\u548c\u9884\u89c8\u90fd\u4f1a\u8d70\u8fd9\u91cc\u3002',
  sourceTitle: '\u80cc\u666f\u6765\u6e90',
  sourceSummary:
    '\u652f\u6301\u76f4\u63a5\u7c98\u8d34\u56fe\u7247\u94fe\u63a5\u3001Markdown \u56fe\u7247\u3001HTML \u56fe\u7247\u6807\u7b7e\uff0c\u4e5f\u652f\u6301\u672c\u5730\u4e0a\u4f20\u3002',
  urlLabel: '\u56fe\u7247\u94fe\u63a5',
  urlPlaceholder: '\u652f\u6301 https \u94fe\u63a5\u3001Markdown \u56fe\u7247\u6216 HTML \u56fe\u7247\u6807\u7b7e',
  apply: '\u5e94\u7528',
  upload: '\u76f4\u63a5\u4e0a\u4f20',
  clear: '\u6e05\u7a7a\u80cc\u666f',
  guideTitle: '\u4f7f\u7528\u8bf4\u660e',
  guide1: '\u80cc\u666f\u56fe\u53ea\u5f71\u54cd\u5f53\u524d\u7fa4\u804a\uff0c\u4e0d\u4f1a\u8986\u76d6\u5355\u804a\u80cc\u666f\u3002',
  guide2: '\u4e0a\u4f20\u540e\u4f1a\u4fdd\u5b58\u4e3a\u6301\u4e45\u8d44\u6e90\uff0c\u5bfc\u5165\u5bfc\u51fa\u65f6\u80fd\u8ddf\u7740\u7fa4\u6570\u636e\u4e00\u8d77\u8d70\u3002',
  guide3: '\u5efa\u8bae\u4f7f\u7528\u6e05\u6670\u4f46\u4e0d\u8fc7\u4eae\u7684\u80cc\u666f\uff0c\u907f\u514d\u5f71\u54cd\u6d88\u606f\u53ef\u8bfb\u6027\u3002',
  previewAlt: '\u7fa4\u804a\u80cc\u666f\u9884\u89c8',
} as const;

function PreviewPhone({ src }: { src: string | null }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="border-b border-zinc-100 bg-white px-4 py-3">
        <div className="text-[14px] font-semibold text-zinc-900">{TEXT.previewTitle}</div>
        <div className="mt-1 text-[12px] text-zinc-500">{TEXT.previewSummary}</div>
      </div>

      <div className="relative h-72 overflow-hidden bg-zinc-100">
        {src ? (
          <>
            <img src={src} alt={TEXT.previewAlt} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-white/55" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_50%,#fdf2f8_100%)]" />
        )}

        <div className="relative flex h-full flex-col justify-end gap-3 px-4 py-4">
          <div className="max-w-[78%] self-start rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[13px] text-zinc-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
            {TEXT.previewIncoming}
          </div>
          <div className="max-w-[72%] self-end rounded-2xl rounded-tr-sm bg-zinc-900 px-3 py-2 text-[13px] text-white shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
            {TEXT.previewOutgoing}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GroupChatBackgroundPage({
  value,
  onChange,
  onBack,
}: GroupChatBackgroundPageProps) {
  const [draftInput, setDraftInput] = useState('');
  const { setRemoteUrl, setUploadedFile, clearValue } = usePersistentFieldActions();

  useEffect(() => {
    const isDirectValue = /^(https?:|data:)/i.test(value.trim());
    setDraftInput(isDirectValue ? value : '');
  }, [value]);

  const previewCandidate = useMemo(() => {
    const normalizedDraft = extractSingleImageUrl(draftInput).trim();
    return normalizedDraft || value;
  }, [draftInput, value]);

  const { resolvedUrl } = useResolvedPersistentValue(previewCandidate);
  const previewSrc = getDisplayableAssetValue(previewCandidate, resolvedUrl);

  const handleApplyLink = async () => {
    const normalized = draftInput.trim() ? await setRemoteUrl(draftInput) : await clearValue();
    setDraftInput(normalized);
    onChange(normalized);
  };

  const handleUpload = async (file: File) => {
    const nextValue = await setUploadedFile(file);
    setDraftInput('');
    onChange(nextValue);
  };

  const handleClear = async () => {
    const cleared = await clearValue();
    setDraftInput('');
    onChange(cleared);
  };

  return (
    <div className="absolute inset-0 z-[122] flex flex-col bg-zinc-50">
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
        <div className="space-y-4">
          <PreviewPhone src={previewSrc} />

          <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
            <div className="border-b border-zinc-100 px-4 py-3">
              <div className="text-[15px] font-semibold text-zinc-900">{TEXT.sourceTitle}</div>
              <div className="mt-1 text-[12px] leading-5 text-zinc-500">{TEXT.sourceSummary}</div>
            </div>

            <div className="space-y-3 px-4 py-4">
              <label className="text-[13px] font-medium text-zinc-700">{TEXT.urlLabel}</label>
              <div className="flex items-start gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                  <Link2 size={16} className="mt-0.5 shrink-0 text-zinc-400" />
                  <textarea
                    value={draftInput}
                    onChange={(event) => setDraftInput(event.target.value)}
                    rows={3}
                    placeholder={TEXT.urlPlaceholder}
                    className="w-full resize-none bg-transparent text-[13px] leading-5 text-zinc-700 outline-none placeholder:text-zinc-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleApplyLink();
                  }}
                  className="rounded-2xl bg-zinc-900 px-4 py-3 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  {TEXT.apply}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
                  <Upload size={16} />
                  {TEXT.upload}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUpload(file);
                      }
                      event.target.value = '';
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    void handleClear();
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  <X size={16} />
                  {TEXT.clear}
                </button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
            <div className="border-b border-zinc-100 px-4 py-3">
              <div className="text-[15px] font-semibold text-zinc-900">{TEXT.guideTitle}</div>
            </div>
            <div className="space-y-2 px-4 py-4 text-[13px] leading-6 text-zinc-600">
              <div className="flex items-start gap-2">
                <ImageIcon size={16} className="mt-1 shrink-0 text-zinc-400" />
                <span>{TEXT.guide1}</span>
              </div>
              <div className="flex items-start gap-2">
                <ImageIcon size={16} className="mt-1 shrink-0 text-zinc-400" />
                <span>{TEXT.guide2}</span>
              </div>
              <div className="flex items-start gap-2">
                <ImageIcon size={16} className="mt-1 shrink-0 text-zinc-400" />
                <span>{TEXT.guide3}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

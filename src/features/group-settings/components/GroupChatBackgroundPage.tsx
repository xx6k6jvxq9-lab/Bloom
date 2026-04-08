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
  title: '群聊天背景',
  subtitle: '支持图片链接、上传和实时预览',
  previewTitle: '群聊背景预览',
  previewSummary: '保存后会应用到当前群聊消息区',
  previewIncoming: '今天这个群的背景终于单独配好了。',
  previewOutgoing: '链接、上传和预览都会走这里。',
  sourceTitle: '背景来源',
  sourceSummary:
    '支持直接粘贴图片链接、Markdown 图片、HTML 图片标签，也支持本地上传。',
  urlLabel: '图片链接',
  urlPlaceholder: '支持 https 链接、Markdown 图片或 HTML 图片标签',
  apply: '应用',
  upload: '直接上传',
  clear: '清空背景',
  guideTitle: '使用说明',
  guide1: '背景图只影响当前群聊，不会覆盖单聊背景。',
  guide2: '上传后会保存为持久资源，导入导出时能跟着群数据一起走。',
  guide3: '建议使用清晰但不过亮的背景，避免影响消息可读性。',
  previewAlt: '群聊背景预览',
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
    if (!draftInput.trim()) {
      return;
    }

    const normalized = await setRemoteUrl(draftInput);
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
                  disabled={!draftInput.trim()}
                  className={`rounded-2xl px-4 py-3 text-[13px] font-medium text-white transition-colors ${
                    draftInput.trim()
                      ? 'bg-zinc-900 hover:bg-zinc-800'
                      : 'cursor-not-allowed bg-zinc-300'
                  }`}
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

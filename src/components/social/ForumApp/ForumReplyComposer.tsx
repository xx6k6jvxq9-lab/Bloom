import { useEffect, useRef, useState } from 'react';
import { useAppKeyboard } from '../../../features/app-shell/AppKeyboardContext';
import { useKeyboardSafeViewport } from '../../../features/app-shell/useKeyboardSafeViewport';
import { ForumResolvedImage } from './ForumResolvedImage';

type ForumReplyComposerProps = {
  currentUserAvatar: string;
  anonymousMainAvatar: string;
  availableCommentMasks: Array<{ id: string; name: string }>;
  defaultMaskId?: string;
  mainReplyText: string;
  onMainReplyTextChange: (value: string) => void;
  onSubmitSelfReply: (maskId?: string) => void;
  onSubmitAnonymousReply: () => void;
};

export function ForumReplyComposer({
  currentUserAvatar,
  anonymousMainAvatar,
  availableCommentMasks,
  defaultMaskId,
  mainReplyText,
  onMainReplyTextChange,
  onSubmitSelfReply,
  onSubmitAnonymousReply,
}: ForumReplyComposerProps) {
  const composerRef = useRef<HTMLDivElement | null>(null);
  const [identity, setIdentity] = useState<'self' | 'anonymous'>('self');
  const [maskId, setMaskId] = useState<string | undefined>(defaultMaskId);
  const [showMaskPicker, setShowMaskPicker] = useState(false);
  const [preferPlainSelf, setPreferPlainSelf] = useState(() => !defaultMaskId);
  const { keyboardInset, keyboardVisible: appKeyboardVisible } = useAppKeyboard();
  const { keyboardVisible: ownsFocusedKeyboard } = useKeyboardSafeViewport({
    containerRef: composerRef,
    enabled: true,
  });

  const selectedMaskName = availableCommentMasks.find((mask) => mask.id === maskId)?.name;
  const displaySelfLabel = selectedMaskName || '本人';

  useEffect(() => {
    if (!availableCommentMasks.length) {
      setMaskId(undefined);
      setShowMaskPicker(false);
      return;
    }

    setMaskId((current) => (
      preferPlainSelf
        ? undefined
        : (
      current && availableCommentMasks.some((mask) => mask.id === current)
        ? current
        : (defaultMaskId && availableCommentMasks.some((mask) => mask.id === defaultMaskId)
          ? defaultMaskId
          : availableCommentMasks[0]?.id)
        )
    ));
  }, [availableCommentMasks, defaultMaskId, preferPlainSelf]);

  const submit = () => {
    if (!mainReplyText.trim()) return;
    if (identity === 'anonymous') {
      onSubmitAnonymousReply();
    } else {
      onSubmitSelfReply(maskId);
    }
    setIdentity('self');
    setShowMaskPicker(false);
  };

  return (
    <div
      ref={composerRef}
      className="z-20 shrink-0 border-t border-zinc-100 bg-white px-3 py-2 [padding-bottom:calc(var(--app-safe-area-bottom-ui,0px)+0.5rem)] flex items-center gap-3"
      style={{
        transform: ownsFocusedKeyboard && appKeyboardVisible && keyboardInset > 0
          ? `translateY(-${keyboardInset}px)`
          : 'translateY(0)',
        transition: 'transform 180ms ease',
      }}
    >
      <ForumResolvedImage
        value={identity === 'anonymous' ? anonymousMainAvatar : currentUserAvatar}
        className="w-7 h-7 rounded-full object-cover"
      />

      <div className="relative flex gap-2 shrink-0">
        {identity === 'self' && showMaskPicker && availableCommentMasks.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 flex min-w-28 flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setPreferPlainSelf(true);
                setMaskId(undefined);
                setShowMaskPicker(false);
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
                !maskId
                  ? 'border-sky-200 bg-sky-50 text-sky-700'
                  : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              本人
            </button>
            {availableCommentMasks.map((mask) => (
              <button
                key={mask.id}
                type="button"
                onClick={() => {
                  setPreferPlainSelf(false);
                  setMaskId(mask.id);
                  setShowMaskPicker(false);
                }}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
                  maskId === mask.id
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                {mask.name}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setIdentity('self');
            if (availableCommentMasks.length > 0) {
              setShowMaskPicker((current) => !current);
            }
          }}
          className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
            identity === 'self'
              ? 'border-sky-200 bg-sky-50 text-sky-700'
              : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
          }`}
        >
          {displaySelfLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            setIdentity('anonymous');
            setShowMaskPicker(false);
          }}
          className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
            identity === 'anonymous'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
          }`}
        >
          匿名
        </button>
      </div>

      <input
        type="text"
        value={mainReplyText}
        onChange={(event) => onMainReplyTextChange(event.target.value)}
        placeholder="发布你的回复"
        className="flex-1 bg-transparent text-[14px] outline-none placeholder-zinc-500"
        onKeyDown={(event) => {
          if (event.key === 'Enter' && mainReplyText.trim()) {
            submit();
          }
        }}
      />
      <button
        onClick={submit}
        disabled={!mainReplyText.trim()}
        className={`px-3 py-1.5 rounded-full font-bold text-[12px] transition-all shrink-0 whitespace-nowrap ${
          mainReplyText.trim()
            ? 'border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
            : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
        }`}
      >
        回复
      </button>
    </div>
  );
}

import { Mic } from 'lucide-react';
import { useResolvedPersistentValue } from '../persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';

function formatDuration(durationSeconds?: number) {
  if (!durationSeconds || durationSeconds <= 0) {
    return null;
  }

  const totalSeconds = Math.max(1, Math.round(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function AudioMessageCard({
  value,
  durationSeconds,
  caption,
  isUser,
  className = '',
  onClick,
  onContextMenu,
}: {
  value?: string | null;
  durationSeconds?: number;
  caption?: string | null;
  isUser?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl);

  if (!src) {
    return null;
  }

  const durationText = formatDuration(durationSeconds);

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`inline-flex max-w-[min(84%,22rem)] cursor-pointer flex-col gap-3 rounded-2xl border px-3 py-3 transition-all active:scale-[0.98] ${
        isUser
          ? 'chat-bubble message-bubble user-bubble right border-blue-400 bg-blue-500 text-white'
          : 'chat-bubble message-bubble bot-bubble left border-zinc-200 bg-white/95 text-zinc-800'
      } ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              isUser ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-500'
            }`}
          >
            <Mic size={16} />
          </span>
          <div className="flex flex-col">
            <span className={`text-[13px] font-medium ${isUser ? 'text-white' : 'text-zinc-800'}`}>语音消息</span>
            {durationText ? (
              <span className={`text-[11px] ${isUser ? 'text-white/75' : 'text-zinc-500'}`}>{durationText}</span>
            ) : null}
          </div>
        </div>
      </div>
      <audio controls src={src} className="w-[18rem] max-w-full" preload="metadata" />
      {caption ? (
        <span className={`whitespace-pre-wrap break-words px-1 text-[14px] leading-6 ${isUser ? 'text-white' : 'text-zinc-800'}`}>
          {caption}
        </span>
      ) : null}
    </div>
  );
}

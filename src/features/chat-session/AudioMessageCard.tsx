import { Pause, Play, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  transcript,
  showTranscript = false,
  isUser,
  className = '',
  onClick,
  onContextMenu,
}: {
  value?: string | null;
  durationSeconds?: number;
  transcript?: string | null;
  showTranscript?: boolean;
  isUser?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  if (!src) {
    return null;
  }

  const effectiveDuration = durationSeconds || 0;
  const durationText = formatDuration(effectiveDuration);
  const progressRatio = effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;
  const waveformHeights = useMemo(() => [0.4, 0.8, 0.55, 0.95, 0.62, 0.72, 0.46, 0.86, 0.58, 0.76], []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const syncTime = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    const syncPlay = () => setIsPlaying(true);
    const syncPause = () => setIsPlaying(false);
    const syncEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', syncTime);
    audio.addEventListener('play', syncPlay);
    audio.addEventListener('pause', syncPause);
    audio.addEventListener('ended', syncEnded);

    return () => {
      audio.removeEventListener('timeupdate', syncTime);
      audio.removeEventListener('play', syncPlay);
      audio.removeEventListener('pause', syncPause);
      audio.removeEventListener('ended', syncEnded);
    };
  }, [src]);

  const togglePlay = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      return;
    }
    audio.pause();
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`inline-flex max-w-[min(84%,18rem)] cursor-pointer flex-col gap-2 rounded-[22px] border px-3 py-2.5 transition-all active:scale-[0.98] ${
        isUser
          ? 'chat-bubble message-bubble user-bubble right border-[#3b82f6] bg-[#3b82f6] text-white shadow-[0_10px_24px_rgba(59,130,246,0.2)]'
          : 'chat-bubble message-bubble bot-bubble left border-zinc-200 bg-white/95 text-zinc-800 shadow-[0_8px_18px_rgba(15,23,42,0.06)]'
      } ${className}`.trim()}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
            isUser ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-700'
          }`}
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Volume2 size={13} className={isUser ? 'text-white/85' : 'text-zinc-500'} />
            <span className={`text-[12px] font-medium ${isUser ? 'text-white/90' : 'text-zinc-700'}`}>
              语音消息
            </span>
            {durationText ? (
              <span className={`ml-auto text-[12px] tabular-nums ${isUser ? 'text-white/80' : 'text-zinc-400'}`}>
                {durationText}
              </span>
            ) : null}
          </div>
          <div className={`mt-2 flex items-end gap-1 rounded-full px-2 py-2 ${
            isUser ? 'bg-white/10' : 'bg-zinc-100/90'
          }`}>
            {waveformHeights.map((height, index) => {
              const filled = progressRatio >= (index + 1) / waveformHeights.length;
              return (
                <span
                  key={index}
                  className={`block w-1 rounded-full transition-colors ${
                    filled
                      ? isUser ? 'bg-white' : 'bg-zinc-700'
                      : isUser ? 'bg-white/35' : 'bg-zinc-300'
                  }`}
                  style={{ height: `${18 * height}px` }}
                />
              );
            })}
            <span className={`ml-2 text-[11px] tabular-nums ${isUser ? 'text-white/70' : 'text-zinc-400'}`}>
              {formatDuration(currentTime) || '0:00'}
            </span>
          </div>
        </div>
      </div>
      {showTranscript && transcript ? (
        <span className={`whitespace-pre-wrap break-words px-1 text-[12px] leading-5 ${
          isUser ? 'text-white/88' : 'text-zinc-500'
        }`}>
          转文字：{transcript}
        </span>
      ) : null}
    </div>
  );
}

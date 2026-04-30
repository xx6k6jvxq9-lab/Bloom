import { Pause, Play, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useResolvedPersistentValue } from '../persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';

let sequentialAutoPlayActiveKey: string | null = null;
let sequentialAutoPlayActiveAudio: HTMLAudioElement | null = null;
const sequentialAutoPlayQueue = new Map<string, () => void>();

function runNextSequentialAutoPlay() {
  const nextEntry = sequentialAutoPlayQueue.entries().next();
  if (nextEntry.done) {
    sequentialAutoPlayActiveKey = null;
    sequentialAutoPlayActiveAudio = null;
    return;
  }

  const [nextKey, start] = nextEntry.value;
  sequentialAutoPlayQueue.delete(nextKey);
  start();
}

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
  translation,
  showTranscript = false,
  autoPlay = false,
  isUser,
  className = '',
  onClick,
  onContextMenu,
}: {
  value?: string | null;
  durationSeconds?: number;
  transcript?: string | null;
  translation?: string | null;
  showTranscript?: boolean;
  autoPlay?: boolean;
  isUser?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayedSrcRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [metadataDuration, setMetadataDuration] = useState(0);
  const effectiveDuration = durationSeconds || metadataDuration || 0;
  const durationText = formatDuration(effectiveDuration);
  const progressRatio = effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;
  const waveformHeights = useMemo(
    () => [0.45, 0.72, 0.58, 0.9, 0.66, 0.48, 0.82],
    [],
  );

  useEffect(() => {
    if (!src || !autoPlay || autoPlayedSrcRef.current === src) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const queueKey = src;
    const startPlayback = () => {
      sequentialAutoPlayActiveKey = queueKey;
      sequentialAutoPlayActiveAudio = audio;
      autoPlayedSrcRef.current = src;
      void audio.play().catch(() => {
        autoPlayedSrcRef.current = null;
        if (sequentialAutoPlayActiveKey === queueKey) {
          sequentialAutoPlayActiveKey = null;
          sequentialAutoPlayActiveAudio = null;
          runNextSequentialAutoPlay();
        }
      });
    };

    if (!sequentialAutoPlayActiveKey || sequentialAutoPlayActiveKey === queueKey) {
      startPlayback();
      return;
    }

    sequentialAutoPlayQueue.set(queueKey, startPlayback);
  }, [autoPlay, src]);

  useEffect(() => {
    if (!src) {
      autoPlayedSrcRef.current = null;
    }
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) {
      setIsPlaying(false);
      setCurrentTime(0);
      return undefined;
    }

    const syncTime = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    const syncLoadedMetadata = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setMetadataDuration(nextDuration > 0 ? nextDuration : 0);
    };
    const syncPlay = () => setIsPlaying(true);
    const syncPause = () => setIsPlaying(false);
    const syncEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (sequentialAutoPlayActiveAudio === audio) {
        sequentialAutoPlayActiveAudio = null;
        sequentialAutoPlayActiveKey = null;
        runNextSequentialAutoPlay();
      }
    };

    audio.addEventListener('timeupdate', syncTime);
    audio.addEventListener('loadedmetadata', syncLoadedMetadata);
    audio.addEventListener('durationchange', syncLoadedMetadata);
    audio.addEventListener('play', syncPlay);
    audio.addEventListener('pause', syncPause);
    audio.addEventListener('ended', syncEnded);

    syncLoadedMetadata();

    return () => {
      sequentialAutoPlayQueue.delete(src);
      if (sequentialAutoPlayActiveAudio === audio) {
        sequentialAutoPlayActiveAudio = null;
        sequentialAutoPlayActiveKey = null;
      }
      audio.removeEventListener('timeupdate', syncTime);
      audio.removeEventListener('loadedmetadata', syncLoadedMetadata);
      audio.removeEventListener('durationchange', syncLoadedMetadata);
      audio.removeEventListener('play', syncPlay);
      audio.removeEventListener('pause', syncPause);
      audio.removeEventListener('ended', syncEnded);
    };
  }, [src]);

  if (!src) {
    return null;
  }

  const togglePlay = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (sequentialAutoPlayActiveAudio && sequentialAutoPlayActiveAudio !== audio) {
      sequentialAutoPlayActiveAudio.pause();
      sequentialAutoPlayActiveAudio = null;
      sequentialAutoPlayActiveKey = null;
    }
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
      className={`inline-flex max-w-[min(84%,15rem)] cursor-pointer flex-col gap-2 rounded-[20px] border px-3 py-2.5 transition-all active:scale-[0.98] ${
        isUser
          ? 'chat-bubble message-bubble user-bubble right border-[#95c8ff] bg-[#95c8ff] text-white shadow-[0_8px_18px_rgba(59,130,246,0.18)]'
          : 'chat-bubble message-bubble bot-bubble left border-zinc-200 bg-white/95 text-zinc-800 shadow-[0_8px_18px_rgba(15,23,42,0.06)]'
      } ${className}`.trim()}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
            isUser ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-700'
          }`}
        >
          {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Volume2 size={12} className={isUser ? 'text-white/80' : 'text-zinc-400'} />
          <div className="flex min-w-0 flex-1 items-end gap-1">
            {waveformHeights.map((height, index) => {
              const filled = progressRatio >= (index + 1) / waveformHeights.length;
              return (
                <span
                  key={index}
                  className={`block w-[3px] rounded-full transition-colors ${
                    filled
                      ? isUser
                        ? 'bg-white'
                        : 'bg-zinc-700'
                      : isUser
                        ? 'bg-white/35'
                        : 'bg-zinc-300'
                  }`}
                  style={{ height: `${16 * height}px` }}
                />
              );
            })}
          </div>
          <span className={`shrink-0 text-[12px] tabular-nums ${isUser ? 'text-white/78' : 'text-zinc-500'}`}>
            {durationText || formatDuration(currentTime) || '0:00'}
          </span>
        </div>
      </div>

      {showTranscript && transcript ? (
        <div className="space-y-1 px-1">
          <span
            className={`block whitespace-pre-wrap break-words text-[12px] leading-5 ${
              isUser ? 'text-white/88' : 'text-zinc-500'
            }`}
          >
            转文字：{transcript}
          </span>
          {translation ? (
            <span
              className={`block whitespace-pre-wrap break-words text-[12px] leading-5 ${
                isUser ? 'text-white/80' : 'text-zinc-700'
              }`}
            >
              翻译：{translation}
            </span>
          ) : null}
        </div>
      ) : translation ? (
        <span
          className={`whitespace-pre-wrap break-words px-1 text-[12px] leading-5 ${
            isUser ? 'text-white/88' : 'text-zinc-500'
          }`}
        >
          翻译：{translation}
        </span>
      ) : null}
    </div>
  );
}

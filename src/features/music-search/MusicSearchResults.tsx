import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock3, LoaderCircle, Music2, Play, Plus, Search, Sparkles } from 'lucide-react';
import type { Song } from '../../types';
import { getMusicSearchSources, searchMusicAcrossSources } from './musicSearchSources';
import type { MusicSearchResult } from './musicSearchTypes';

function formatDuration(seconds: number) {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getPlaybackBadge(result: MusicSearchResult) {
  switch (result.playbackStatus) {
    case 'supported':
      return {
        label: '可播放',
        className: 'bg-emerald-100 text-emerald-600',
      };
    case 'search-only':
      return {
        label: '仅展示',
        className: 'bg-amber-100 text-amber-600',
      };
    default:
      return {
        label: '待校验',
        className: 'bg-zinc-100 text-zinc-500',
      };
  }
}

export function MusicSearchResults({
  query,
  onPlaySong,
  onQueueSong,
}: {
  query: string;
  onPlaySong: (song: Song) => void;
  onQueueSong: (song: Song) => void;
}) {
  const [results, setResults] = useState<MusicSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setErrorMessage('');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage('');

    const timer = setTimeout(async () => {
      try {
        const nextResults = await searchMusicAcrossSources(trimmedQuery);
        if (cancelled) return;
        setResults(nextResults);
      } catch (error) {
        if (cancelled) return;
        setResults([]);
        setErrorMessage(error instanceof Error ? error.message : '搜索失败，请稍后再试');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const activeSources = useMemo(() => getMusicSearchSources(), []);

  if (!query.trim()) return null;

  return (
    <section className="space-y-5">
      <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-pink-100 via-white to-orange-50 p-5 shadow-[0_18px_60px_rgba(244,114,182,0.10)]">
        <div className="absolute -top-12 right-0 h-32 w-32 rounded-full bg-pink-200/30 blur-3xl" />
        <div className="absolute -bottom-10 left-6 h-24 w-24 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-pink-500/80">
              <Sparkles size={12} />
              即时搜索
            </div>
            <h3 className="text-[26px] font-black tracking-tight text-zinc-900">搜索结果</h3>
            <p className="mt-1 text-[13px] font-medium leading-6 text-zinc-500">
              当前接入 {activeSources.map((source) => source.label).join(' / ')}，歌曲和播客会一起展示。
            </p>
          </div>
          <div className="shrink-0 rounded-full bg-white/85 px-3 py-1.5 text-[12px] font-bold leading-5 text-zinc-500 shadow-sm">
            {isLoading ? '搜索中...' : `${results.length} 个结果`}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-[28px] border border-white/70 bg-white/80 px-6 py-16 text-zinc-400 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <LoaderCircle size={34} className="mb-4 animate-spin text-pink-400" />
          <p className="text-[15px] font-bold text-zinc-700">正在搜索内容</p>
          <p className="mt-1 text-[12px] font-medium text-zinc-400">会同时尝试歌曲、免费源和网易云播客</p>
        </div>
      ) : errorMessage ? (
        <div className="rounded-[28px] border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-orange-50 px-6 py-10 shadow-[0_10px_30px_rgba(244,63,94,0.06)]">
          <div className="flex flex-col items-center justify-center text-center text-zinc-400">
            <Search size={34} className="mb-4 text-rose-300" />
            <p className="text-[15px] font-bold text-zinc-700">{errorMessage}</p>
            <p className="mt-2 text-[12px] font-medium text-zinc-400">
              如果上游接口暂时波动，这里会直接提示，不再混入错误页面。
            </p>
          </div>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-3">
          {results.map((result, index) => {
            const badge = getPlaybackBadge(result);
            return (
              <div
                key={`${result.sourceId}-${result.song.id}`}
                onClick={() => onPlaySong(result.song)}
                className="group flex cursor-pointer items-center gap-4 rounded-[24px] border border-white/80 bg-white/85 p-3 shadow-[0_14px_40px_rgba(15,23,42,0.05)] transition-all active:scale-[0.99] hover:-translate-y-0.5"
              >
                <div className="relative h-18 w-18 shrink-0 overflow-hidden rounded-[20px] shadow-lg shadow-pink-100/40">
                  <img
                    src={result.song.albumArt}
                    alt={result.song.title}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                  <div className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-1 text-[10px] font-black text-white">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-[16px] font-black tracking-tight text-zinc-900">
                        {result.song.title}
                      </h4>
                      <p className="mt-1 truncate text-[13px] font-medium text-zinc-500">{result.song.artist}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="rounded-full bg-zinc-100/80 px-2.5 py-1 text-[11px] font-bold text-zinc-500">
                        {result.sourceLabel}
                      </div>
                      <div className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.className}`}>
                        {badge.label}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
                        <Clock3 size={12} />
                        {formatDuration(result.song.duration)}
                      </div>
                      {result.note ? (
                        <div className="mt-1 flex min-w-0 items-start gap-1.5 text-[11px] font-bold leading-5 text-amber-500">
                          <AlertCircle size={12} className="mt-1 shrink-0" />
                          <span className="break-words">{result.note}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onQueueSong(result.song);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-pink-100 hover:text-pink-500"
                        title="加入队列"
                      >
                        <Plus size={17} />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onPlaySong(result.song);
                        }}
                        className="flex h-9 min-w-9 items-center justify-center rounded-full bg-pink-500 px-3 text-white shadow-lg shadow-pink-200 transition-transform active:scale-95"
                        title="播放内容"
                      >
                        <Play size={16} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[28px] border border-white/70 bg-white/80 px-6 py-16 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col items-center justify-center text-center text-zinc-400">
            <Music2 size={34} className="mb-4 text-zinc-300" />
            <p className="text-[15px] font-bold text-zinc-700">这次没有找到可用内容</p>
            <p className="mt-1 text-[12px] font-medium text-zinc-400">换个关键词试试，也可以搜歌名、歌手名或播客名。</p>
          </div>
        </div>
      )}
    </section>
  );
}

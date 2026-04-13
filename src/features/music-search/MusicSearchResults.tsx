import { useEffect, useState } from 'react';
import { Music2, Play, Plus, Search } from 'lucide-react';
import type { Song } from '../../types';
import { searchNeteaseMusic } from './searchNeteaseMusic';

function formatDuration(seconds: number) {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  const [results, setResults] = useState<Song[]>([]);
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
        const nextResults = await searchNeteaseMusic(trimmedQuery);
        if (cancelled) return;
        setResults(nextResults);
      } catch (error) {
        if (cancelled) return;
        setResults([]);
        setErrorMessage(error instanceof Error ? error.message : '搜索失败');
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

  if (!query.trim()) return null;

  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-bold tracking-tight text-zinc-900">搜索结果</h3>
        <span className="text-[12px] font-bold text-zinc-400">
          {isLoading ? '搜索中' : `${results.length} 个结果`}
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-300">
          <Music2 size={48} className="mb-4 animate-pulse opacity-20" />
          <p className="font-bold">正在搜索音乐…</p>
        </div>
      ) : errorMessage ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-300">
          <Search size={48} className="mb-4 opacity-20" />
          <p className="font-bold text-zinc-400">{errorMessage}</p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          {results.map(song => (
            <div
              key={song.id}
              onClick={() => onPlaySong(song)}
              className="group flex cursor-pointer items-center gap-4 transition-opacity active:opacity-70"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-zinc-100 shadow-md">
                <img src={song.albumArt} alt={song.title} className="h-full w-full object-cover" draggable={false} />
              </div>
              <div className="min-w-0 flex-1 border-b border-zinc-100 pb-4">
                <h4 className="truncate text-[15px] font-bold text-zinc-800">{song.title}</h4>
                <p className="mt-0.5 truncate text-[12px] font-medium text-zinc-400">{song.artist}</p>
                <p className="mt-1 text-[11px] font-bold text-zinc-300">{formatDuration(song.duration)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={event => {
                    event.stopPropagation();
                    onQueueSong(song);
                  }}
                  className="p-2 text-zinc-300 transition-colors hover:text-pink-500"
                  title="添加到队列"
                >
                  <Plus size={18} />
                </button>
                <button
                  onClick={event => {
                    event.stopPropagation();
                    onPlaySong(song);
                  }}
                  className="p-2 text-zinc-300 transition-colors hover:text-zinc-500"
                  title="播放"
                >
                  <Play size={18} fill="currentColor" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-300">
          <Search size={48} className="mb-4 opacity-20" />
          <p className="font-bold">没有找到相关歌曲</p>
        </div>
      )}
    </section>
  );
}

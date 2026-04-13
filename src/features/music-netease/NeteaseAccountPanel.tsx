import { useMemo, useState } from 'react';
import { Link2, LogIn, RefreshCw, ShieldCheck, Unlink2 } from 'lucide-react';
import type { MusicData } from '../../types';
import { parseNeteaseAccountInput } from './neteaseAccount';

type NeteaseAccountPanelProps = {
  value?: MusicData['neteaseAccount'];
  onChange: (next: MusicData['neteaseAccount']) => void;
  onSyncPlaylists?: () => void | Promise<void>;
  isSyncing?: boolean;
};

function formatLinkedAt(timestamp?: number | null) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
  });
}

export function NeteaseAccountPanel({
  value,
  onChange,
  onSyncPlaylists,
  isSyncing = false,
}: NeteaseAccountPanelProps) {
  const [input, setInput] = useState(value?.profileUrl || value?.uid || '');
  const [error, setError] = useState('');

  const statusLabel = useMemo(() => {
    if (!value?.uid) return '还没有绑定网易云 UID';
    return `已绑定 UID ${value.uid}`;
  }, [value]);

  const handleConnect = () => {
    const parsed = parseNeteaseAccountInput(input);
    if (!parsed) {
      setError('请输入网易云个人主页链接或 UID。');
      return;
    }

    setError('');
    onChange(parsed);
    setInput(parsed.profileUrl);
  };

  return (
    <section className="rounded-[28px] border border-white bg-white p-5 shadow-lg shadow-zinc-200/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-rose-400">
            <ShieldCheck size={13} />
            网易云歌单
          </div>
          <h3 className="mt-2 text-[22px] font-black tracking-tight text-zinc-900">直接导入入口</h3>
          <p className="mt-1 text-[13px] font-medium leading-6 text-zinc-500">
            这里不再跳去外面。你只需要粘贴网易云个人主页链接或 UID，就能直接把公开歌单同步到音乐页里。
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-[22px] bg-gradient-to-br from-pink-50 via-white to-orange-50 p-4">
        <div className="flex items-center gap-2 text-[13px] font-bold text-zinc-700">
          <div className={`h-2.5 w-2.5 rounded-full ${value?.uid ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
          {statusLabel}
        </div>
        {value?.uid ? (
          <p className="mt-1 text-[12px] font-medium text-zinc-400">
            {formatLinkedAt(value.linkedAt)} 已保存 UID，接下来可以直接同步你的公开歌单。
          </p>
        ) : (
          <p className="mt-1 text-[12px] font-medium text-zinc-400">
            登录动作你可以自己在网易云完成，这里只负责接收 UID 或主页链接并同步歌单。
          </p>
        )}

        <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-white px-4 py-3 shadow-sm">
          <Link2 size={17} className="shrink-0 text-zinc-300" />
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="粘贴网易云个人主页链接或 UID"
            className="flex-1 bg-transparent text-[13px] font-bold text-zinc-800 outline-none placeholder:text-zinc-300"
          />
        </div>
        {error ? <p className="mt-2 text-[12px] font-bold text-rose-500">{error}</p> : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={handleConnect}
            className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-4 py-2.5 text-[12px] font-bold text-white shadow-lg shadow-pink-200 active:scale-95 transition-transform"
          >
            <LogIn size={15} />
            保存 UID
          </button>
          {value?.uid && onSyncPlaylists ? (
            <button
              onClick={() => void onSyncPlaylists()}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-[12px] font-bold text-white shadow-lg shadow-zinc-200 active:scale-95 transition-transform disabled:opacity-60"
            >
              <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? '同步中...' : '同步歌单'}
            </button>
          ) : null}
          {value?.uid ? (
            <button
              onClick={() => {
                onChange(null);
                setError('');
                setInput('');
              }}
              className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2.5 text-[12px] font-bold text-rose-500 active:scale-95 transition-transform"
            >
              <Unlink2 size={15} />
              清除 UID
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

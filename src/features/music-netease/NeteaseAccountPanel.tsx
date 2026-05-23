import { useEffect, useMemo, useState } from 'react';
import { Link2, ListMusic, LogIn, RefreshCw, ShieldCheck, Unlink2 } from 'lucide-react';
import type { MusicData } from '../../types';
import {
  parseNeteaseAccountInput,
  parseNeteasePlaylistInput,
  type NeteasePlaylistBinding,
} from './neteaseAccount';

type NeteaseAccountPanelProps = {
  value?: MusicData['neteaseAccount'];
  onChange: (next: MusicData['neteaseAccount']) => void;
  onSyncPlaylists?: () => void | Promise<void>;
  isSyncing?: boolean;
  onImportPlaylist?: (playlist: NeteasePlaylistBinding) => void | Promise<boolean> | boolean;
  isImportingPlaylist?: boolean;
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
  onImportPlaylist,
  isImportingPlaylist = false,
}: NeteaseAccountPanelProps) {
  const [accountInput, setAccountInput] = useState(value?.profileUrl || value?.uid || '');
  const [playlistInput, setPlaylistInput] = useState('');
  const [accountError, setAccountError] = useState('');
  const [playlistError, setPlaylistError] = useState('');

  useEffect(() => {
    setAccountInput(value?.profileUrl || value?.uid || '');
  }, [value?.profileUrl, value?.uid]);

  const statusLabel = useMemo(() => {
    if (!value?.uid) return '还没有绑定网易云 UID';
    return `已绑定 UID ${value.uid}`;
  }, [value]);

  const handleConnect = () => {
    const parsed = parseNeteaseAccountInput(accountInput);
    if (!parsed) {
      setAccountError('请输入网易云个人主页链接或 UID。');
      return;
    }

    setAccountError('');
    onChange(parsed);
    setAccountInput(parsed.profileUrl);
  };

  const handleImportPlaylist = async () => {
    if (!onImportPlaylist || isImportingPlaylist) return;

    const parsed = parseNeteasePlaylistInput(playlistInput);
    if (!parsed) {
      setPlaylistError('请输入网易云歌单链接或歌单 ID。');
      return;
    }

    setPlaylistError('');
    const didImport = await onImportPlaylist(parsed);
    if (didImport !== false) {
      setPlaylistInput('');
    }
  };

  return (
    <section className="rounded-[28px] border border-white bg-white p-5 shadow-lg shadow-zinc-200/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-rose-400">
            <ShieldCheck size={13} />
            网易云歌单
          </div>
          <h3 className="mt-2 text-[22px] font-black tracking-tight text-zinc-900">网易云导入</h3>
          <p className="mt-1 text-[13px] font-medium leading-6 text-zinc-500">
            这里现在分成两条路: 想拉某个歌单里的歌曲，就走歌单直导；想整批同步某个账号下的公开歌单，再走 UID 同步。
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-[22px] bg-gradient-to-br from-pink-50 via-white to-orange-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-black text-zinc-800">
              <ListMusic size={15} />
              歌单直导入口
            </div>
            <span className="rounded-full bg-pink-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
              推荐
            </span>
          </div>
          <p className="mt-2 text-[12px] font-medium leading-6 text-zinc-500">
            粘贴歌单链接或歌单 ID，直接把这个歌单里当前可播放的歌曲导入进来，不经过 UID 同步。
          </p>

          <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-white px-4 py-3 shadow-sm">
            <Link2 size={17} className="shrink-0 text-zinc-300" />
            <input
              type="text"
              value={playlistInput}
              onChange={(event) => setPlaylistInput(event.target.value)}
              placeholder="粘贴网易云歌单链接或歌单 ID"
              className="flex-1 bg-transparent text-[13px] font-bold text-zinc-800 outline-none placeholder:text-zinc-300"
              disabled={isImportingPlaylist}
            />
          </div>
          {playlistError ? <p className="mt-2 text-[12px] font-bold text-rose-500">{playlistError}</p> : null}

          <button
            onClick={() => void handleImportPlaylist()}
            disabled={!playlistInput.trim() || isImportingPlaylist || !onImportPlaylist}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-pink-500 px-4 py-2.5 text-[12px] font-bold text-white shadow-lg shadow-pink-200 active:scale-95 transition-transform disabled:opacity-60"
          >
            <RefreshCw size={15} className={isImportingPlaylist ? 'animate-spin' : ''} />
            {isImportingPlaylist ? '导入中...' : '导入歌单歌曲'}
          </button>
        </div>

        <div className="rounded-[22px] border border-rose-100 bg-white p-4">
          <div className="flex items-center gap-2 text-[13px] font-black text-zinc-800">
            <ShieldCheck size={15} className="text-rose-400" />
            账号同步入口
          </div>
          <p className="mt-2 text-[12px] font-medium leading-6 text-zinc-500">
            适合想一次性同步某个网易云账号下的公开歌单。这里会保存 UID，再按账号批量同步。
          </p>

          <div className="mt-4 flex items-center gap-2 text-[13px] font-bold text-zinc-700">
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

          <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-zinc-50 px-4 py-3 shadow-sm">
            <Link2 size={17} className="shrink-0 text-zinc-300" />
            <input
              type="text"
              value={accountInput}
              onChange={(event) => setAccountInput(event.target.value)}
              placeholder="粘贴网易云个人主页链接或 UID"
              className="flex-1 bg-transparent text-[13px] font-bold text-zinc-800 outline-none placeholder:text-zinc-300"
            />
          </div>
          {accountError ? <p className="mt-2 text-[12px] font-bold text-rose-500">{accountError}</p> : null}

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
                className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2.5 text-[12px] font-bold text-rose-500 active:scale-95 transition-transform disabled:opacity-60"
              >
                <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? '同步中...' : '同步公开歌单'}
              </button>
            ) : null}
            {value?.uid ? (
              <button
                onClick={() => {
                  onChange(null);
                  setAccountError('');
                  setAccountInput('');
                }}
                className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2.5 text-[12px] font-bold text-rose-500 active:scale-95 transition-transform"
              >
                <Unlink2 size={15} />
                清除 UID
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

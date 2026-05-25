import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  Link2,
  ListMusic,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Unlink2,
} from 'lucide-react';
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

type ExpandedSection = 'playlist' | 'account' | null;

const PANEL_CLASS = 'rounded-[30px] border border-white/72 bg-white/72 shadow-[0_20px_48px_rgba(15,23,42,0.09)] backdrop-blur-2xl';
const ROW_CLASS = 'overflow-hidden rounded-[24px] border border-zinc-100/70 bg-white/80 shadow-[0_10px_24px_rgba(15,23,42,0.05)]';
const LIGHT_PILL_CLASS = 'rounded-full border border-white/70 bg-white/78 px-3 py-1 text-[10px] font-semibold text-zinc-500 shadow-[0_8px_18px_rgba(15,23,42,0.05)]';
const ACCENT_PILL_CLASS = 'rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-[10px] font-semibold text-rose-500';

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
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);

  useEffect(() => {
    setAccountInput(value?.profileUrl || value?.uid || '');
  }, [value?.profileUrl, value?.uid]);

  const statusLabel = useMemo(() => {
    if (!value?.uid) return '未绑定';
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

  const togglePanel = () => {
    setIsPanelExpanded((current) => {
      const next = !current;
      if (next) {
        setExpandedSection((section) => section || (value?.uid ? 'account' : 'playlist'));
      }
      return next;
    });
  };

  const toggleSection = (nextSection: Exclude<ExpandedSection, null>) => {
    if (!isPanelExpanded) {
      setIsPanelExpanded(true);
    }
    setExpandedSection((current) => (current === nextSection ? null : nextSection));
  };

  return (
    <section className={PANEL_CLASS}>
      <button
        type="button"
        onClick={togglePanel}
        className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left"
      >
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-400">
            <ShieldCheck size={13} />
            NETEASE
          </div>
          <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-zinc-900">
            网易云导入
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={value?.uid ? ACCENT_PILL_CLASS : LIGHT_PILL_CLASS}>
            {statusLabel}
          </span>
          <ChevronLeft
            size={18}
            className={`text-zinc-400 transition-transform ${isPanelExpanded ? '-rotate-90' : 'rotate-180'}`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isPanelExpanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/60 px-5 pb-5 pt-4">
              <div className="space-y-3">
                <div className={ROW_CLASS}>
                  <button
                    type="button"
                    onClick={() => toggleSection('playlist')}
                    className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ListMusic size={15} className="text-zinc-400" />
                        <span className="text-[14px] font-semibold text-zinc-900">
                          歌单直导入口
                        </span>
                        <span className={ACCENT_PILL_CLASS}>推荐</span>
                      </div>
                      <p className="mt-2 text-[12px] leading-5 text-zinc-500">
                        贴歌单链接或歌单 ID，直接导入当前可播放的歌曲。
                      </p>
                    </div>
                    <ChevronLeft
                      size={16}
                      className={`mt-1 shrink-0 text-zinc-300 transition-transform ${expandedSection === 'playlist' ? '-rotate-90' : 'rotate-180'}`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {expandedSection === 'playlist' ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-zinc-100/70 px-4 pb-4 pt-3">
                          <div className="flex items-center gap-3 rounded-[18px] border border-zinc-100 bg-white px-4 py-3 shadow-sm">
                            <Link2 size={17} className="shrink-0 text-zinc-300" />
                            <input
                              type="text"
                              value={playlistInput}
                              onChange={(event) => setPlaylistInput(event.target.value)}
                              placeholder="粘贴网易云歌单链接或歌单 ID"
                              className="flex-1 bg-transparent text-[13px] font-semibold text-zinc-800 outline-none placeholder:text-zinc-300"
                              disabled={isImportingPlaylist}
                            />
                          </div>
                          {playlistError ? (
                            <p className="mt-2 text-[12px] font-semibold text-rose-500">{playlistError}</p>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => void handleImportPlaylist()}
                            disabled={!playlistInput.trim() || isImportingPlaylist || !onImportPlaylist}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-pink-500 px-4 py-2.5 text-[12px] font-semibold text-white shadow-lg shadow-pink-200 transition-transform active:scale-95 disabled:opacity-60"
                          >
                            <RefreshCw size={15} className={isImportingPlaylist ? 'animate-spin' : ''} />
                            {isImportingPlaylist ? '导入中...' : '导入歌单歌曲'}
                          </button>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <div className={ROW_CLASS}>
                  <button
                    type="button"
                    onClick={() => toggleSection('account')}
                    className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={15} className="text-rose-400" />
                        <span className="text-[14px] font-semibold text-zinc-900">
                          账号同步入口
                        </span>
                        <span className={value?.uid ? ACCENT_PILL_CLASS : LIGHT_PILL_CLASS}>
                          {value?.uid ? '已绑定' : '未绑定'}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] leading-5 text-zinc-500">
                        保存 UID 后，可按账号批量同步公开歌单。
                      </p>
                    </div>
                    <ChevronLeft
                      size={16}
                      className={`mt-1 shrink-0 text-zinc-300 transition-transform ${expandedSection === 'account' ? '-rotate-90' : 'rotate-180'}`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {expandedSection === 'account' ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-zinc-100/70 px-4 pb-4 pt-3">
                          <div className="flex items-center gap-2 text-[13px] font-semibold text-zinc-700">
                            <div className={`h-2.5 w-2.5 rounded-full ${value?.uid ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                            {statusLabel}
                          </div>
                          <p className="mt-2 text-[12px] leading-5 text-zinc-500">
                            {value?.uid
                              ? `${formatLinkedAt(value.linkedAt)} 已保存 UID，接下来可以直接同步你的公开歌单。`
                              : '登录动作你可以自己在网易云完成，这里只负责接收 UID 或主页链接并同步歌单。'}
                          </p>

                          <div className="mt-4 flex items-center gap-3 rounded-[18px] border border-zinc-100 bg-white px-4 py-3 shadow-sm">
                            <Link2 size={17} className="shrink-0 text-zinc-300" />
                            <input
                              type="text"
                              value={accountInput}
                              onChange={(event) => setAccountInput(event.target.value)}
                              placeholder="粘贴网易云个人主页链接或 UID"
                              className="flex-1 bg-transparent text-[13px] font-semibold text-zinc-800 outline-none placeholder:text-zinc-300"
                            />
                          </div>
                          {accountError ? (
                            <p className="mt-2 text-[12px] font-semibold text-rose-500">{accountError}</p>
                          ) : null}

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={handleConnect}
                              className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-4 py-2.5 text-[12px] font-semibold text-white shadow-lg shadow-pink-200 transition-transform active:scale-95"
                            >
                              <LogIn size={15} />
                              保存 UID
                            </button>
                            {value?.uid && onSyncPlaylists ? (
                              <button
                                type="button"
                                onClick={() => void onSyncPlaylists()}
                                disabled={isSyncing}
                                className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2.5 text-[12px] font-semibold text-rose-500 transition-transform active:scale-95 disabled:opacity-60"
                              >
                                <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                                {isSyncing ? '同步中...' : '同步公开歌单'}
                              </button>
                            ) : null}
                            {value?.uid ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onChange(null);
                                  setAccountError('');
                                  setAccountInput('');
                                }}
                                className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2.5 text-[12px] font-semibold text-rose-500 transition-transform active:scale-95"
                              >
                                <Unlink2 size={15} />
                                清除 UID
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

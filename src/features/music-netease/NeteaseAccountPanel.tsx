import { useMemo, useState } from 'react';
import { ExternalLink, Link2, LogIn, ShieldCheck, Unlink2 } from 'lucide-react';
import type { MusicData } from '../../types';
import { getNeteaseLoginUrl, parseNeteaseAccountInput } from './neteaseAccount';

type NeteaseAccountPanelProps = {
  value?: MusicData['neteaseAccount'];
  onChange: (next: MusicData['neteaseAccount']) => void;
};

function formatLinkedAt(timestamp?: number | null) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
  });
}

export function NeteaseAccountPanel({ value, onChange }: NeteaseAccountPanelProps) {
  const [input, setInput] = useState(value?.profileUrl || value?.uid || '');
  const [error, setError] = useState('');

  const statusLabel = useMemo(() => {
    if (!value?.uid) return '未连接网易云账号';
    return `已连接 UID ${value.uid}`;
  }, [value]);

  const openExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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
            网易云账号
          </div>
          <h3 className="mt-2 text-[22px] font-black tracking-tight text-zinc-900">登录入口</h3>
          <p className="mt-1 text-[13px] font-medium leading-6 text-zinc-500">
            先连接你的网易云主页，后面可以在这个基础上继续做歌单同步。登录账号不等于让当前网页播放器直接获得所有版权歌播放权限。
          </p>
        </div>
        <button
          onClick={() => openExternal(getNeteaseLoginUrl())}
          className="shrink-0 rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-bold text-white shadow-lg shadow-zinc-200 active:scale-95 transition-transform"
        >
          打开登录
        </button>
      </div>

      <div className="mt-5 rounded-[22px] bg-gradient-to-br from-pink-50 via-white to-orange-50 p-4">
        <div className="flex items-center gap-2 text-[13px] font-bold text-zinc-700">
          <div className={`h-2.5 w-2.5 rounded-full ${value?.uid ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
          {statusLabel}
        </div>
        {value?.uid ? (
          <p className="mt-1 text-[12px] font-medium text-zinc-400">
            {formatLinkedAt(value.linkedAt)} 已保存主页链接，后面可以直接继续做歌单同步。
          </p>
        ) : (
          <p className="mt-1 text-[12px] font-medium text-zinc-400">
            登录后把“个人主页链接”或 UID 贴到下面，就能把账号连接状态留在音乐页里。
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
            连接账号
          </button>
          <button
            onClick={() => openExternal(value?.profileUrl || getNeteaseLoginUrl())}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2.5 text-[12px] font-bold text-zinc-600 active:scale-95 transition-transform"
          >
            <ExternalLink size={15} />
            {value?.profileUrl ? '打开主页' : '打开网易云'}
          </button>
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
              断开连接
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

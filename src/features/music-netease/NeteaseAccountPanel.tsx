import { useEffect, useMemo, useState } from 'react';
import { Link2, LogIn, RefreshCw, ShieldCheck, Unlink2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { MusicData } from '../../types';
import { parseNeteaseAccountInput } from './neteaseAccount';

type NeteaseAccountPanelProps = {
  value?: MusicData['neteaseAccount'];
  onChange: (next: MusicData['neteaseAccount']) => void;
  onSyncPlaylists?: () => void | Promise<void>;
  isSyncing?: boolean;
};

type ServerAuthStatus = {
  loggedIn: boolean;
  source: 'none' | 'env' | 'qr';
  profile: {
    userId: string;
    nickname: string;
    avatarUrl?: string;
  } | null;
  vipType: number;
  isVip: boolean;
  hasCookie: boolean;
};

function formatLinkedAt(timestamp?: number | null) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
  });
}

function getQrStatusText(code: number) {
  switch (code) {
    case 800:
      return '二维码已过期，重新获取即可。';
    case 801:
      return '请使用网易云音乐 App 扫码。';
    case 802:
      return '已扫码，请在手机上确认登录。';
    case 803:
      return '登录成功，正在同步账号信息。';
    default:
      return '正在等待扫码状态。';
  }
}

export function NeteaseAccountPanel({
  value,
  onChange,
  onSyncPlaylists,
  isSyncing = false,
}: NeteaseAccountPanelProps) {
  const [input, setInput] = useState(value?.profileUrl || value?.uid || '');
  const [error, setError] = useState('');
  const [isLoadingAuthStatus, setIsLoadingAuthStatus] = useState(false);
  const [serverAuthStatus, setServerAuthStatus] = useState<ServerAuthStatus | null>(null);
  const [showQrLogin, setShowQrLogin] = useState(false);
  const [qrKey, setQrKey] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [qrStatusText, setQrStatusText] = useState('');
  const [isPreparingQr, setIsPreparingQr] = useState(false);
  const [isPollingQr, setIsPollingQr] = useState(false);

  const syncBindingFromServerStatus = (status: ServerAuthStatus | null) => {
    if (!status?.loggedIn || !status.profile?.userId) {
      return;
    }

    const userId = status.profile.userId;
    if (value?.uid === userId) {
      return;
    }

    onChange({
      uid: userId,
      profileUrl: `https://music.163.com/#/user/home?id=${userId}`,
      linkedAt: Date.now(),
    });
  };

  const refreshServerAuthStatus = async () => {
    setIsLoadingAuthStatus(true);
    try {
      const response = await fetch('/api/netease/auth/status');
      const data = (await response.json().catch(() => null)) as ServerAuthStatus | null;
      if (!response.ok || !data) {
        setServerAuthStatus(null);
        return;
      }

      setServerAuthStatus(data);
      syncBindingFromServerStatus(data);
    } catch (fetchError) {
      console.error('Failed to fetch NetEase auth status', fetchError);
      setServerAuthStatus(null);
    } finally {
      setIsLoadingAuthStatus(false);
    }
  };

  useEffect(() => {
    void refreshServerAuthStatus();
  }, []);

  useEffect(() => {
    setInput(value?.profileUrl || value?.uid || '');
  }, [value?.profileUrl, value?.uid]);

  useEffect(() => {
    if (!showQrLogin || !qrKey) {
      return undefined;
    }

    let cancelled = false;
    setIsPollingQr(true);

    const poll = async () => {
      try {
        const response = await fetch(`/api/netease/auth/qr/check?key=${encodeURIComponent(qrKey)}`);
        const data = await response.json().catch(() => null);
        if (cancelled || !response.ok || !data) return;

        const code = Number(data.code || 0);
        setQrStatusText(getQrStatusText(code));

        if (code === 803) {
          await refreshServerAuthStatus();
          if (!cancelled) {
            setShowQrLogin(false);
            setQrKey('');
            setQrUrl('');
          }
        }
      } catch (pollError) {
        if (!cancelled) {
          console.error('Failed to poll NetEase QR login status', pollError);
          setQrStatusText('扫码状态获取失败，请稍后再试。');
        }
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      setIsPollingQr(false);
    };
  }, [qrKey, showQrLogin]);

  const statusLabel = useMemo(() => {
    if (serverAuthStatus?.loggedIn && serverAuthStatus.profile) {
      return `已登录 ${serverAuthStatus.profile.nickname}`;
    }
    if (!value?.uid) return '还没有绑定网易云 UID';
    return `已绑定 UID ${value.uid}`;
  }, [serverAuthStatus, value]);

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

  const handleStartQrLogin = async () => {
    setError('');
    setIsPreparingQr(true);
    try {
      const keyResponse = await fetch('/api/netease/auth/qr/key');
      const keyData = await keyResponse.json().catch(() => null);
      const key = String(keyData?.key || '');
      if (!keyResponse.ok || !key) {
        throw new Error('Failed to create QR login key');
      }

      const qrResponse = await fetch(`/api/netease/auth/qr/create?key=${encodeURIComponent(key)}`);
      const qrData = await qrResponse.json().catch(() => null);
      const nextQrUrl = String(qrData?.qrUrl || '');
      if (!qrResponse.ok || !nextQrUrl) {
        throw new Error('Failed to create QR login image');
      }

      setQrKey(key);
      setQrUrl(nextQrUrl);
      setQrStatusText('请使用网易云音乐 App 扫码。');
      setShowQrLogin(true);
    } catch (qrError) {
      console.error('Failed to start NetEase QR login', qrError);
      setError('二维码登录初始化失败，请稍后再试。');
    } finally {
      setIsPreparingQr(false);
    }
  };

  const handleLogoutServerSession = async () => {
    try {
      await fetch('/api/netease/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      setShowQrLogin(false);
      setQrKey('');
      setQrUrl('');
      setQrStatusText('');
      await refreshServerAuthStatus();
    } catch (logoutError) {
      console.error('Failed to clear NetEase auth session', logoutError);
      setError('退出网易云登录失败，请稍后再试。');
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
          <h3 className="mt-2 text-[22px] font-black tracking-tight text-zinc-900">账号与歌单</h3>
          <p className="mt-1 text-[13px] font-medium leading-6 text-zinc-500">
            现在既支持手动绑定 UID 同步公开歌单，也支持二维码登录，让 VIP 歌曲优先按你的网易云登录态去解析播放地址。
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-[22px] bg-gradient-to-br from-pink-50 via-white to-orange-50 p-4">
        <div className="flex items-center gap-2 text-[13px] font-bold text-zinc-700">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              serverAuthStatus?.loggedIn ? 'bg-emerald-500' : value?.uid ? 'bg-amber-400' : 'bg-zinc-300'
            }`}
          />
          {statusLabel}
        </div>
        {serverAuthStatus?.loggedIn ? (
          <p className="mt-1 text-[12px] font-medium text-zinc-400">
            {serverAuthStatus.isVip ? '当前服务器已带网易云会员态。' : '当前服务器已带网易云登录态。'}
            {serverAuthStatus.profile?.nickname ? ` 账号：${serverAuthStatus.profile.nickname}` : ''}
          </p>
        ) : value?.uid ? (
          <p className="mt-1 text-[12px] font-medium text-zinc-400">
            {formatLinkedAt(value.linkedAt)} 已保存 UID，可以同步公开歌单；如果想让 VIP 歌按账号权限解析，请用下面的二维码登录。
          </p>
        ) : (
          <p className="mt-1 text-[12px] font-medium text-zinc-400">
            还没有服务器侧网易云登录态。先扫码登录可以解锁会员态播放解析；也可以只保存 UID，同步公开歌单。
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
          <button
            onClick={() => void handleStartQrLogin()}
            disabled={isPreparingQr}
            className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2.5 text-[12px] font-bold text-rose-500 active:scale-95 transition-transform disabled:opacity-60"
          >
            <ShieldCheck size={15} />
            {isPreparingQr ? '准备二维码...' : serverAuthStatus?.loggedIn ? '切换登录' : '扫码登录'}
          </button>
          {value?.uid && onSyncPlaylists ? (
            <button
              onClick={() => void onSyncPlaylists()}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2.5 text-[12px] font-bold text-rose-500 active:scale-95 transition-transform disabled:opacity-60"
            >
              <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? '同步中...' : '同步歌单'}
            </button>
          ) : null}
          {serverAuthStatus?.loggedIn ? (
            <button
              onClick={() => void handleLogoutServerSession()}
              className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2.5 text-[12px] font-bold text-rose-500 active:scale-95 transition-transform"
            >
              <Unlink2 size={15} />
              退出登录
            </button>
          ) : null}
          {value?.uid ? (
            <button
              onClick={() => {
                onChange(null);
                setError('');
                setInput('');
              }}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2.5 text-[12px] font-bold text-zinc-500 active:scale-95 transition-transform"
            >
              <Unlink2 size={15} />
              清除 UID
            </button>
          ) : null}
        </div>

        {showQrLogin && qrUrl ? (
          <div className="mt-5 rounded-[20px] border border-rose-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col items-center gap-3 text-center">
              <QRCodeSVG value={qrUrl} size={180} includeMargin />
              <div>
                <p className="text-[13px] font-bold text-zinc-800">使用网易云音乐 App 扫码登录</p>
                <p className="mt-1 text-[12px] font-medium text-zinc-400">
                  {qrStatusText || (isPollingQr ? '正在等待扫码...' : '二维码已生成')}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-[18px] bg-white/75 px-4 py-3 text-[12px] leading-6 text-zinc-500">
          <p>登录态只保存在本地开发服务侧，不会直接写进浏览器存储。</p>
          <p className="mt-1">
            {isLoadingAuthStatus
              ? '正在检查服务器登录状态...'
              : serverAuthStatus?.loggedIn
                ? '当前已经接入网易云登录态，VIP 歌会优先按账号权限解析。'
                : '当前还没接入服务器登录态，VIP 歌仍只能走公开试听链路。'}
          </p>
        </div>
      </div>
    </section>
  );
}

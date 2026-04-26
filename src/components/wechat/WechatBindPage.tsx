import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LoaderCircle, RefreshCw, Smartphone, Unlink, XCircle } from 'lucide-react';
import type { WechatBindSession } from '../../features/wechat-bridge/types';
import {
  getWechatBindSessionByCharacterIdRequest,
  getWechatBindSessionByTokenRequest,
  markWechatBindSessionBoundRequest,
} from '../../features/wechat-bridge/api';

type BindFlowState = 'loading' | 'waiting' | 'binding' | 'success' | 'expired' | 'invalid' | 'error';

type ResolvedWechatPayload = {
  conversationId?: string;
  displayName?: string;
  avatarUrl?: string;
};

function pickFirstSearchParam(searchParams: URLSearchParams, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function resolveWechatPayload(searchParams: URLSearchParams): ResolvedWechatPayload {
  return {
    conversationId: pickFirstSearchParam(searchParams, ['conversationId', 'chatId', 'sessionId', 'roomId', 'talker']),
    displayName: pickFirstSearchParam(searchParams, ['displayName', 'nickname', 'name', 'remark', 'senderDisplayName']),
    avatarUrl: pickFirstSearchParam(searchParams, ['avatarUrl', 'avatar', 'headImgUrl']),
  };
}

function formatRelativeExpire(expiresAt?: number): string | null {
  if (!expiresAt) return null;
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) return '绑定二维码已过期';
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  return `绑定窗口剩余约 ${remainingMinutes} 分钟`;
}

export function WechatBindPage() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = searchParams.get('token')?.trim() || '';
  const characterIdFromQuery = searchParams.get('characterId')?.trim() || '';
  const payload = useMemo(() => resolveWechatPayload(searchParams), [searchParams]);

  const [session, setSession] = useState<WechatBindSession | null>(null);
  const [flowState, setFlowState] = useState<BindFlowState>('loading');
  const [message, setMessage] = useState('正在读取绑定状态...');
  const [manualConversationId, setManualConversationId] = useState(payload.conversationId || '');
  const [manualDisplayName, setManualDisplayName] = useState(payload.displayName || '');

  useEffect(() => {
    let cancelled = false;

    const syncBinding = async () => {
      if (!token) {
        if (!cancelled) {
          setFlowState('invalid');
          setMessage('缺少绑定 token，这个链接暂时不能完成微信接入。');
        }
        return;
      }

      try {
        const nextSession = await getWechatBindSessionByTokenRequest(token);
        if (cancelled) return;

        if (!nextSession) {
          setSession(null);
          setFlowState('invalid');
          setMessage('没有找到对应的绑定任务，可能已经失效或被刷新过。');
          return;
        }

        setSession(nextSession);

        if (nextSession.status === 'expired') {
          setFlowState('expired');
          setMessage('这个绑定二维码已经过期了，请回到 Bloom 里重新生成。');
          return;
        }

        if (nextSession.status === 'bound') {
          setFlowState('success');
          setMessage('这个微信会话已经绑定完成，现在可以回到 Bloom。');
          return;
        }

        if (!payload.conversationId) {
          setFlowState('waiting');
          setMessage('已识别到绑定任务，等待微信侧带着会话信息再次打开这个链接。');
          return;
        }

        setFlowState('binding');
        setMessage('已拿到微信会话信息，正在完成绑定...');

        const result = await markWechatBindSessionBoundRequest(token, {
          conversationId: payload.conversationId,
          displayName: payload.displayName,
          avatarUrl: payload.avatarUrl,
        });

        if (cancelled) return;
        setSession(result.session);
        setFlowState('success');
        setMessage('绑定成功，后续这个微信会话发来的消息会只回流到记忆层。');
      } catch (error) {
        if (cancelled) return;
        setFlowState('error');
        setMessage(error instanceof Error ? error.message : '绑定失败，请稍后重试。');
      }
    };

    void syncBinding();

    return () => {
      cancelled = true;
    };
  }, [payload.avatarUrl, payload.conversationId, payload.displayName, token]);

  const handleRetry = async () => {
    setFlowState('loading');
    setMessage('正在重新检查绑定状态...');

    try {
      const nextSession = token ? await getWechatBindSessionByTokenRequest(token) : null;
      setSession(nextSession);

      if (!token || !nextSession) {
        setFlowState('invalid');
        setMessage('没有找到可用的绑定任务。');
        return;
      }

      if (nextSession.status === 'expired') {
        setFlowState('expired');
        setMessage('这个绑定二维码已经过期了，请回到 Bloom 里重新生成。');
        return;
      }

      if (nextSession.status === 'bound') {
        setFlowState('success');
        setMessage('这个微信会话已经绑定完成，现在可以回到 Bloom。');
        return;
      }

      setFlowState('waiting');
      setMessage('绑定任务还在等待微信会话信息。');
    } catch (error) {
      setFlowState('error');
      setMessage(error instanceof Error ? error.message : '重新检查失败，请稍后再试。');
    }
  };

  const handleManualBind = async () => {
    if (!token || !manualConversationId.trim()) {
      return;
    }

    setFlowState('binding');
    setMessage('正在写入绑定关系...');

    try {
      const result = await markWechatBindSessionBoundRequest(token, {
        conversationId: manualConversationId.trim(),
        displayName: manualDisplayName.trim() || undefined,
      });

      setSession(result.session);
      setFlowState('success');
      setMessage('绑定成功，后续这个微信会话发来的消息会只回流到记忆层。');
    } catch (error) {
      setFlowState('error');
      setMessage(error instanceof Error ? error.message : '手动绑定失败，请稍后重试。');
    }
  };

  const statusMeta = {
    loading: {
      icon: <LoaderCircle className="animate-spin text-sky-600" size={22} />,
      title: '读取绑定状态',
    },
    waiting: {
      icon: <Smartphone className="text-amber-600" size={22} />,
      title: '等待微信侧回调',
    },
    binding: {
      icon: <LoaderCircle className="animate-spin text-sky-600" size={22} />,
      title: '正在完成绑定',
    },
    success: {
      icon: <CheckCircle2 className="text-emerald-600" size={22} />,
      title: '绑定完成',
    },
    expired: {
      icon: <Unlink className="text-zinc-500" size={22} />,
      title: '绑定已过期',
    },
    invalid: {
      icon: <XCircle className="text-rose-600" size={22} />,
      title: '链接不可用',
    },
    error: {
      icon: <XCircle className="text-rose-600" size={22} />,
      title: '绑定失败',
    },
  } satisfies Record<BindFlowState, { icon: React.ReactNode; title: string }>;

  const activeMeta = statusMeta[flowState];
  const expireHint = formatRelativeExpire(session?.expiresAt);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#ecfdf5_100%)] px-4 py-8 text-zinc-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[420px] items-center">
        <div className="w-full rounded-[32px] border border-white/70 bg-white/88 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
            Bloom 微信接入
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100">
              {activeMeta.icon}
            </div>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight">{activeMeta.title}</h1>
              <p className="mt-1 text-[13px] leading-5 text-zinc-500">{message}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4 text-[13px] leading-6 text-zinc-600">
            <div>角色 ID: {session?.characterId || characterIdFromQuery || '未知'}</div>
            <div>绑定 token: {token || '缺失'}</div>
            <div>会话 ID: {session?.boundConversationId || payload.conversationId || '等待回填'}</div>
            {payload.displayName ? <div>微信备注: {payload.displayName}</div> : null}
            {expireHint ? <div>{expireHint}</div> : null}
          </div>

          <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-[12px] leading-5 text-emerald-800">
            这次接入只会把微信侧消息回流到角色记忆和统一语境，不会直接出现在单聊界面里。
          </div>

          {(flowState === 'waiting' || flowState === 'error') && (
            <div className="mt-5 rounded-2xl border border-dashed border-zinc-200 p-4">
              <div className="text-[13px] font-semibold text-zinc-800">开发兜底绑定</div>
              <p className="mt-1 text-[12px] leading-5 text-zinc-500">
                如果微信侧暂时还没把会话参数带回来，可以先手动填一个 conversationId 完成联调。
              </p>
              <div className="mt-3 space-y-2">
                <input
                  value={manualConversationId}
                  onChange={(event) => setManualConversationId(event.target.value)}
                  placeholder="输入 conversationId / chatId / talker"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-emerald-500"
                />
                <input
                  value={manualDisplayName}
                  onChange={(event) => setManualDisplayName(event.target.value)}
                  placeholder="可选：微信昵称或备注"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => {
                  void handleManualBind();
                }}
                disabled={!token || !manualConversationId.trim()}
                className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                写入绑定
              </button>
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => {
                void handleRetry();
              }}
              className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw size={15} />
                刷新状态
              </span>
            </button>
            <a
              href="/"
              className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-center text-[13px] font-medium text-white transition hover:bg-emerald-500"
            >
              返回 Bloom
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

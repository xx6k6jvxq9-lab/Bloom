import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Link2, QrCode, RefreshCw, Smartphone, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import type { Character } from '../../types';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import type { WechatBindSession, WechatRoleBinding } from '../../features/wechat-bridge/types';
import {
  createWechatBindSessionRequest,
  disableWechatBindingByCharacterIdRequest,
  getWechatBindingByCharacterIdRequest,
  getWechatBindSessionByCharacterIdRequest,
  markWechatBindSessionBoundRequest,
} from '../../features/wechat-bridge/api';
import { showInAppConfirm } from '../../utils';

function ResolvedCharacterAvatar({ value, alt }: { value?: string | null; alt: string }) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) {
    return <div className="h-14 w-14 rounded-2xl bg-zinc-100" aria-label={alt} />;
  }

  return <img src={resolvedUrl} alt={alt} className="h-14 w-14 rounded-2xl object-cover" />;
}

type WechatBindModalProps = {
  character: Character;
  open: boolean;
  onClose: () => void;
};

function notifyWechatBindingChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wechat-binding-changed'));
}

export function WechatBindModal({ character, open, onClose }: WechatBindModalProps) {
  const [session, setSession] = useState<WechatBindSession | null>(null);
  const [binding, setBinding] = useState<WechatRoleBinding | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [simulatedConversationId, setSimulatedConversationId] = useState('');
  const [simulatedDisplayName, setSimulatedDisplayName] = useState('');

  const loadState = async (options?: { forceCreateSession?: boolean }) => {
    if (!open) return;
    setLoading(true);
    try {
      const [nextBinding, existingSession] = await Promise.all([
        getWechatBindingByCharacterIdRequest(character.id),
        getWechatBindSessionByCharacterIdRequest(character.id),
      ]);

      let nextSession = existingSession;
      if (options?.forceCreateSession || !nextSession || nextSession.status === 'expired') {
        nextSession = await createWechatBindSessionRequest(character.id);
      }

      setBinding(nextBinding);
      setSession(nextSession);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadState();
  }, [character.id, open]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const displayName = character.remarkName?.trim() || character.name;

  const remainingSeconds = session ? Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000)) : 0;

  const handleRefresh = () => {
    void loadState({ forceCreateSession: true });
  };

  const handleCopy = async () => {
    if (!session?.qrText || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(session.qrText);
    setCopied(true);
  };

  const handleSimulateBinding = () => {
    if (!session || !simulatedConversationId.trim()) return;
    void markWechatBindSessionBoundRequest(session.token, {
      conversationId: simulatedConversationId.trim(),
      displayName: simulatedDisplayName.trim() || undefined,
    }).then(() => {
      setSimulatedConversationId('');
      setSimulatedDisplayName('');
      notifyWechatBindingChanged();
      return loadState();
    });
  };

  const handleDisableBinding = async () => {
    if (!binding) return;
    const confirmed = await showInAppConfirm(`确定要解绑角色 "${displayName}" 的微信接入吗？`);
    if (!confirmed) return;
    await disableWechatBindingByCharacterIdRequest(character.id);
    notifyWechatBindingChanged();
    await loadState();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[140] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="max-h-[calc(100%-32px)] w-full max-w-[340px] overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ResolvedCharacterAvatar value={character.avatar} alt={displayName} />
                <div>
                  <div className="text-[16px] font-bold text-zinc-900">接入微信</div>
                  <div className="mt-1 text-[12px] text-zinc-500">{displayName}</div>
                </div>
              </div>
              <button onClick={onClose} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-700">
                <QrCode size={16} />
                绑定二维码
              </div>
              <div className="mt-3 flex justify-center rounded-2xl bg-white p-4">
                {session?.qrText ? (
                  <QRCodeSVG value={session.qrText} size={180} includeMargin />
                ) : (
                  <div className="flex h-[180px] w-[180px] items-center justify-center text-[12px] text-zinc-400">
                    正在生成二维码...
                  </div>
                )}
              </div>
              <div className="mt-3 text-center text-[11px] text-zinc-500">
                扫码后，这个微信会话会默认绑定到当前角色。
              </div>
              <div className="mt-2 text-center text-[11px] text-zinc-400">
                {session ? `二维码约 ${remainingSeconds}s 后过期` : '等待生成中'}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleRefresh}
                  className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  <span className="inline-flex items-center gap-1">
                    <RefreshCw size={14} />
                    刷新二维码
                  </span>
                </button>
                <button
                  onClick={() => {
                    void handleCopy();
                  }}
                  className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  <span className="inline-flex items-center gap-1">
                    <Copy size={14} />
                    {copied ? '已复制' : '复制链接'}
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-700">
                <Link2 size={16} />
                当前绑定状态
              </div>
              {binding ? (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700">
                    <CheckCircle2 size={16} />
                    已绑定
                  </div>
                  <div className="mt-2 text-[12px] text-emerald-700">
                    会话 ID: {binding.conversationId}
                  </div>
                  {binding.displayName && (
                    <div className="mt-1 text-[12px] text-emerald-700">
                      微信备注: {binding.displayName}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      void handleDisableBinding();
                    }}
                    className="mt-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[12px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                  >
                    解绑微信
                  </button>
                </div>
              ) : (
                <div className="mt-3 text-[12px] text-zinc-500">{loading ? '正在读取绑定状态...' : '当前还没有绑定到微信会话。'}</div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-700">
                <Smartphone size={16} />
                本地联调占位
              </div>
              <div className="mt-2 text-[11px] leading-5 text-zinc-500">
                这一块是前端联调用的，后面接真 ClawBot 回调时会由服务端自动写入绑定关系。
              </div>
              <div className="mt-3 space-y-2">
                <input
                  value={simulatedConversationId}
                  onChange={(event) => setSimulatedConversationId(event.target.value)}
                  placeholder="输入模拟微信会话 ID"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] text-zinc-700 outline-none focus:border-zinc-900"
                />
                <input
                  value={simulatedDisplayName}
                  onChange={(event) => setSimulatedDisplayName(event.target.value)}
                  placeholder="可选：微信昵称 / 备注"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] text-zinc-700 outline-none focus:border-zinc-900"
                />
                <button
                  onClick={handleSimulateBinding}
                  disabled={!session || !simulatedConversationId.trim()}
                  className="w-full rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-[12px] font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  写入模拟绑定
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

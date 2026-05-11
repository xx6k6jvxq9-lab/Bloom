import React, { useMemo, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { FriendRequest } from '../../types';
import { useKeyboardSafeViewport } from '../../features/app-shell/useKeyboardSafeViewport';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { getLegacyTranslationParts, sanitizePipeMarkers } from '../../services/chat/messageText';
import { getFriendRequestThreadKey } from '../../features/contacts/friendRequestThreads';
import {
  getFriendRequestStatusLabel,
  isIncomingFriendRequest,
} from '../../features/contacts/contactRelationship';

function ResolvedThreadAvatar({
  value,
  alt,
}: {
  value?: string | null;
  alt: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) {
    return <div className="h-10 w-10 rounded-full bg-zinc-100" aria-label={alt} />;
  }

  return <img src={resolvedUrl} alt={alt} className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />;
}

function formatRequestTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function ThreadTextBlock({
  label,
  text,
  tone = 'default',
}: {
  label: string;
  text: string;
  tone?: 'default' | 'response';
}) {
  const legacyTranslationParts = getLegacyTranslationParts(text);
  const mainText = sanitizePipeMarkers(legacyTranslationParts.mainText || text, '\n');
  const translation = sanitizePipeMarkers(legacyTranslationParts.translation, '\n');

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        tone === 'response'
          ? 'border-rose-100 bg-rose-50/75'
          : 'border-zinc-100 bg-white'
      }`}
    >
      <div className="text-[11px] font-medium text-zinc-400">{label}</div>
      <div className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-6 text-zinc-800">
        {mainText}
      </div>
      {translation && (
        <>
          <div className="mt-3 h-px bg-black/5" />
          <div className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-6 text-zinc-500">
            {translation}
          </div>
        </>
      )}
    </div>
  );
}

export function RelationshipThreadPage({
  requests,
  threadKey,
  onAccept,
  onReject,
  onBack,
}: {
  requests: FriendRequest[];
  threadKey: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onBack: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const threadRequests = useMemo(() => (
    requests
      .filter((request) => getFriendRequestThreadKey(request) === threadKey)
      .sort((left, right) => {
        const leftAttempt = left.attemptNo ?? 0;
        const rightAttempt = right.attemptNo ?? 0;
        if (leftAttempt !== rightAttempt) {
          return leftAttempt - rightAttempt;
        }
        return left.timestamp - right.timestamp;
      })
  ), [requests, threadKey]);
  const latestRequest = threadRequests[threadRequests.length - 1] || null;
  const displayName = latestRequest?.fromUserName || '关系记录';
  const pendingIncomingRequest = threadRequests.find((request) => (
    request.status === 'pending' && isIncomingFriendRequest(request)
  )) || null;

  useKeyboardSafeViewport({
    containerRef,
    enabled: true,
    clampViewportHeight: true,
  });

  if (!latestRequest) {
    return (
      <div ref={containerRef} className="absolute inset-0 z-[60] flex flex-col bg-zinc-50">
        <div className="min-h-[64px] border-b border-zinc-100 bg-white px-4 pb-3 pt-12 flex items-center gap-2">
          <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold text-zinc-900">关系线程</h1>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 text-center text-sm text-zinc-400">
          这条关系线程暂时还没有可展示的记录。
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 z-[60] flex flex-col bg-zinc-50">
      <div className="min-h-[64px] border-b border-zinc-100 bg-white px-4 pb-3 pt-12 flex items-center gap-2">
        <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold text-zinc-900">关系线程</h1>
          <div className="mt-0.5 text-[11px] text-zinc-400">{displayName}</div>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{
          paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 18px)',
          transition: 'padding-bottom 180ms ease',
        }}
      >
        <div className="mb-4 rounded-3xl border border-zinc-100 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <ResolvedThreadAvatar value={latestRequest.fromUserAvatar} alt={displayName} />
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-zinc-900">{displayName}</div>
              <div className="mt-1 text-[12px] text-zinc-500">{getFriendRequestStatusLabel(latestRequest)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {threadRequests.map((request, index) => {
            const isIncoming = isIncomingFriendRequest(request);
            const isPending = request.status === 'pending';
            const attemptLabel = `第 ${request.attemptNo || index + 1} 次`;
            const statusLabel = getFriendRequestStatusLabel(request);

            return (
              <div key={request.id} className="rounded-[28px] border border-zinc-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-zinc-900">
                      {attemptLabel} · {isIncoming ? `${displayName} 发起` : '你发起'}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400">{formatRequestTime(request.timestamp)}</div>
                  </div>
                  <div
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      request.status === 'accepted'
                        ? 'bg-emerald-50 text-emerald-600'
                        : request.status === 'pending'
                          ? 'bg-amber-50 text-amber-600'
                          : request.status === 'rejected'
                            ? 'bg-zinc-100 text-zinc-500'
                            : 'bg-zinc-50 text-zinc-400'
                    }`}
                  >
                    {statusLabel}
                  </div>
                </div>

                {!!request.message && (
                  <div className="mt-4">
                    <ThreadTextBlock
                      label={isIncoming ? `${displayName} 的附言` : '你的附言'}
                      text={request.message}
                    />
                  </div>
                )}

                {!!request.responseText && (
                  <div className="mt-3">
                    <ThreadTextBlock
                      label={`${displayName} 的回应`}
                      text={request.responseText}
                      tone="response"
                    />
                  </div>
                )}

                {!!request.resolutionMessage && request.status !== 'pending' && (
                  <div className="mt-3 rounded-2xl bg-zinc-50 px-3 py-2.5 text-[12px] leading-5 text-zinc-500">
                    {request.resolutionMessage}
                  </div>
                )}

                {isPending && isIncoming && (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onReject(request.id)}
                      className="flex-1 rounded-2xl bg-zinc-100 px-4 py-3 text-[13px] font-medium text-zinc-600"
                    >
                      拒绝
                    </button>
                    <button
                      type="button"
                      onClick={() => onAccept(request.id)}
                      className="flex-1 rounded-2xl bg-zinc-900 px-4 py-3 text-[13px] font-medium text-white"
                    >
                      通过
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!pendingIncomingRequest && (
          <div className="mt-4 rounded-2xl border border-zinc-100 bg-white/80 px-4 py-3 text-[12px] leading-5 text-zinc-400">
            这里会保留同一个角色的申请历史。当前不会把所有修关系内容都重新塞回主聊天里。
          </div>
        )}
      </div>
    </div>
  );
}

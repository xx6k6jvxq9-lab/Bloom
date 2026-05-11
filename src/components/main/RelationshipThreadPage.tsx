import React, { useMemo, useRef, useState } from 'react';
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

function getStatusBadgeClass(status: FriendRequest['status'], isEventRecord: boolean) {
  if (isEventRecord) {
    return 'bg-zinc-100 text-zinc-500';
  }

  if (status === 'accepted') {
    return 'bg-emerald-50 text-emerald-600';
  }

  if (status === 'pending') {
    return 'bg-amber-50 text-amber-600';
  }

  if (status === 'rejected') {
    return 'bg-zinc-100 text-zinc-500';
  }

  return 'bg-zinc-50 text-zinc-400';
}

function getStatusDotClass(_status: FriendRequest['status'], _isEventRecord: boolean) {
  return 'bg-zinc-900';
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
      className={`rounded-2xl border px-3.5 py-3 ${
        tone === 'response'
          ? 'border-rose-100 bg-rose-50/65'
          : 'border-zinc-100 bg-zinc-50/80'
      }`}
    >
      <div className="text-[11px] font-medium text-zinc-400">{label}</div>
      <div className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-6 text-zinc-800">
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

function getEventTitle(request: FriendRequest, displayName: string) {
  switch (request.eventKind) {
    case 'user_unblocked_character':
      return '你解除了拉黑';
    case 'character_counter_blocked':
      return `${displayName} 也把你拉黑了`;
    case 'user_blocked_character':
    default:
      return '你把对方拉黑了';
  }
}

export function RelationshipThreadPage({
  requests,
  threadKey,
  onAccept,
  onReject,
  onSubmitRequest,
  onBack,
}: {
  requests: FriendRequest[];
  threadKey: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onSubmitRequest?: (characterId: string, message: string) => void;
  onBack: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [showComposer, setShowComposer] = useState(false);
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
  const characterId = latestRequest?.characterId || latestRequest?.fromUserId || '';
  const pendingIncomingRequest = threadRequests.find((request) => (
    !request.isRelationshipEvent
    && request.status === 'pending'
    && isIncomingFriendRequest(request)
  )) || null;
  const latestStatusLabel = latestRequest?.isRelationshipEvent
    ? '关系记录'
    : latestRequest
      ? getFriendRequestStatusLabel(latestRequest)
      : '';
  const summaryStatusLabel = pendingIncomingRequest
    ? '待处理'
    : latestStatusLabel;
  const summaryStatusClass = pendingIncomingRequest
    ? getStatusBadgeClass(pendingIncomingRequest.status, false)
    : latestRequest
      ? getStatusBadgeClass(latestRequest.status, !!latestRequest.isRelationshipEvent)
      : 'bg-zinc-50 text-zinc-400';
  const summaryLine = pendingIncomingRequest
    ? '当前有一条新的申请等待你处理'
    : `累计 ${threadRequests.length} 条记录 · 最近更新 ${formatRequestTime(latestRequest?.timestamp || Date.now())}`;

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
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{
          paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 18px)',
          transition: 'padding-bottom 180ms ease',
        }}
      >
        <div className="mb-3 rounded-2xl border border-zinc-100 bg-white px-3.5 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <ResolvedThreadAvatar value={latestRequest.fromUserAvatar} alt={displayName} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-[15px] font-semibold text-zinc-900">{displayName}</div>
                <div className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${summaryStatusClass}`}>
                  {summaryStatusLabel}
                </div>
              </div>
              <div className="mt-1 text-[12px] text-zinc-500">{summaryLine}</div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-zinc-100 bg-white shadow-sm">
          {threadRequests.map((request, index) => {
            const isIncoming = isIncomingFriendRequest(request);
            const isPending = request.status === 'pending';
            const isEventRecord = !!request.isRelationshipEvent;
            const attemptLabel = isEventRecord ? '关系动作' : `第 ${request.attemptNo || index + 1} 次`;
            const statusLabel = isEventRecord ? '关系记录' : getFriendRequestStatusLabel(request);
            const entryTitle = isEventRecord
              ? getEventTitle(request, displayName)
              : `${attemptLabel} · ${isIncoming ? `${displayName} 发起` : '你发起'}`;
            const metaLine = isEventRecord
              ? '关系动作记录'
              : isIncoming
                ? '对方发起的好友申请'
                : '你发起的好友申请';

            return (
              <div
                key={request.id}
                className={`px-4 py-4 ${index > 0 ? 'border-t border-zinc-100/80' : ''}`}
              >
                <div className="flex gap-3">
                  <div className="flex w-4 shrink-0 flex-col items-center">
                    <span className={`mt-2 h-2 w-2 rounded-full ${getStatusDotClass(request.status, isEventRecord)}`} />
                    {index < threadRequests.length - 1 && <span className="mt-2 w-px flex-1 bg-zinc-100" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold leading-5 text-zinc-900">{entryTitle}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
                          <span>{formatRequestTime(request.timestamp)}</span>
                          <span>{metaLine}</span>
                        </div>
                      </div>
                      <div
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${getStatusBadgeClass(request.status, isEventRecord)}`}
                      >
                        {statusLabel}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2.5">
                      {!!request.message && (
                        <ThreadTextBlock
                          label={isIncoming ? `${displayName} 的附言` : '你的附言'}
                          text={request.message}
                        />
                      )}

                      {!!request.responseText && (
                        <ThreadTextBlock
                          label={`${displayName} 的回应`}
                          text={request.responseText}
                          tone="response"
                        />
                      )}

                      {!!request.resolutionMessage && request.status !== 'pending' && (
                        <div className="rounded-xl border border-zinc-100 bg-zinc-50/85 px-3 py-2.5 text-[12px] leading-5 text-zinc-500">
                          {request.resolutionMessage}
                        </div>
                      )}
                    </div>

                    {isPending && isIncoming && !isEventRecord && (
                      <div className="mt-3 flex gap-2">
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
                          className="flex-1 rounded-2xl bg-zinc-100 px-4 py-3 text-[13px] font-medium text-zinc-600"
                        >
                          通过
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!pendingIncomingRequest && (
          <div className="mt-3 px-1 text-[12px] leading-5 text-zinc-400">
            这里会保留同一个角色的申请历史和关系动作记录，主聊天只保留少量必要提示。
          </div>
        )}

        {!pendingIncomingRequest && !!onSubmitRequest && !!characterId && (
          <div className="mt-4">
            {!showComposer ? (
              <button
                type="button"
                onClick={() => {
                  setDraftMessage('');
                  setShowComposer(true);
                }}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[14px] font-medium text-zinc-700 shadow-sm"
              >
                再写一条新的附言
              </button>
            ) : (
              <div className="rounded-[26px] border border-zinc-100 bg-white p-4 shadow-sm">
                <div className="text-[14px] font-semibold text-zinc-900">新的附言</div>
                <div className="mt-1 text-[12px] text-zinc-400">像微信好友验证那样，这次重新写一句给对方。</div>
                <textarea
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value.slice(0, 120))}
                  placeholder="比如：这次我想把话说清楚，不想再用情绪把你推开。"
                  className="mt-4 min-h-[110px] w-full resize-none rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] leading-6 text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:bg-white"
                />
                <div className="mt-2 text-right text-[11px] text-zinc-400">{draftMessage.length}/120</div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowComposer(false);
                      setDraftMessage('');
                    }}
                    className="flex-1 rounded-2xl border border-zinc-200 bg-white py-3 text-[14px] font-medium text-zinc-600"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSubmitRequest(characterId, draftMessage.trim());
                      setShowComposer(false);
                      setDraftMessage('');
                    }}
                    disabled={!draftMessage.trim()}
                    className={`flex-1 rounded-2xl border py-3 text-[14px] font-semibold ${
                      draftMessage.trim()
                        ? 'border-zinc-200 bg-zinc-100 text-zinc-700'
                        : 'border-zinc-100 bg-zinc-50 text-zinc-300'
                    }`}
                  >
                    发出申请
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { FriendRequest } from '../../types';
import { useKeyboardSafeViewport } from '../../features/app-shell/useKeyboardSafeViewport';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { RelationshipThreadPage } from './RelationshipThreadPage';
import { getFriendRequestThreadKey } from '../../features/contacts/friendRequestThreads';
import {
  getFriendRequestStatusLabel,
  isIncomingFriendRequest,
} from '../../features/contacts/contactRelationship';

function ResolvedNewFriendAvatar({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) {
    return <div className={`${className} bg-zinc-100`} aria-label={alt} />;
  }

  return <img src={resolvedUrl} alt={alt} className={className} referrerPolicy="no-referrer" />;
}

export function NewFriendsPage({
  requests,
  onAccept,
  onReject,
  onSubmitRequest,
  defaultThreadKey,
  onThreadClosed,
  onAddById,
  onBack,
}: {
  requests: FriendRequest[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onSubmitRequest?: (characterId: string, message: string) => void;
  defaultThreadKey?: string | null;
  onThreadClosed?: () => void;
  onAddById: (id: string) => void;
  onBack: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [searchId, setSearchId] = useState('');
  const [activeThreadKey, setActiveThreadKey] = useState<string | null>(null);
  const sortedRequests = [...requests]
    .filter((request) => !request.isRelationshipEvent)
    .sort((left, right) => right.timestamp - left.timestamp);
  const latestRequests = Array.from(new Map(
    sortedRequests.map((request) => [getFriendRequestThreadKey(request), request]),
  ).values());

  useKeyboardSafeViewport({
    containerRef,
    enabled: true,
    clampViewportHeight: true,
  });

  useEffect(() => {
    if (defaultThreadKey) {
      setActiveThreadKey(defaultThreadKey);
    }
  }, [defaultThreadKey]);

  if (activeThreadKey) {
    return (
      <RelationshipThreadPage
        requests={requests}
        threadKey={activeThreadKey}
        onAccept={onAccept}
        onReject={onReject}
        onSubmitRequest={onSubmitRequest}
        onBack={() => {
          setActiveThreadKey(null);
          onThreadClosed?.();
        }}
      />
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 z-50 flex flex-col bg-zinc-50">
      <div className="min-h-[64px] border-b border-zinc-100 bg-white px-4 pb-3 pt-12 flex items-center gap-2">
        <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[18px] font-bold text-zinc-900">新的朋友</h1>
      </div>

      <div className="bg-white p-4 mb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            placeholder="输入虚拟 ID 添加朋友"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchId.trim()) {
                onAddById(searchId.trim());
                setSearchId('');
              }
            }}
            className="w-full rounded-xl bg-zinc-100 py-2 pl-10 pr-4 text-[14px] outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 16px)',
          transition: 'padding-bottom 180ms ease',
        }}
      >
        <div className="px-4 py-2 text-[13px] text-zinc-500">好友申请</div>
        {latestRequests.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">暂时还没有好友申请</div>
        ) : (
          latestRequests.map((request) => {
            const isIncoming = isIncomingFriendRequest(request);
            const isPending = request.status === 'pending';
            const statusLabel = getFriendRequestStatusLabel(request);

            return (
              <div
                key={request.id}
                onClick={() => setActiveThreadKey(getFriendRequestThreadKey(request))}
                className="flex cursor-pointer items-center gap-3 border-b border-zinc-50 bg-white p-4 active:bg-zinc-50"
              >
                <ResolvedNewFriendAvatar
                  value={request.fromUserAvatar}
                  alt={request.fromUserName}
                  className="h-10 w-10 rounded-full bg-zinc-100 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-zinc-900">{request.fromUserName}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">
                    {isIncoming ? '对方申请添加你' : '你发出的申请'}
                  </div>
                  <div className="mt-1 break-words text-[12px] text-zinc-500">
                    {request.message || (isIncoming ? '请求添加你为好友' : '等待对方处理你的申请')}
                  </div>
                  {!!request.resolutionMessage && request.status !== 'pending' && (
                    <div className="mt-1 text-[11px] text-zinc-400">{request.resolutionMessage}</div>
                  )}
                </div>
                {isPending && isIncoming ? (
                  <div className="flex gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onReject(request.id);
                      }}
                      className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-600"
                    >
                      拒绝
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onAccept(request.id);
                      }}
                      className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-600"
                    >
                      通过
                    </button>
                  </div>
                ) : (
                  <span
                    className={`text-[12px] ${
                      request.status === 'accepted'
                        ? 'text-emerald-500'
                        : request.status === 'pending'
                          ? 'text-amber-500'
                          : request.status === 'rejected'
                            ? 'text-zinc-400'
                            : 'text-zinc-300'
                    }`}
                  >
                    {statusLabel}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

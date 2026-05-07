import React, { useRef, useState } from 'react';
import { ChevronLeft, Search, UserPlus, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { FriendRequest } from '../../types';
import { useKeyboardSafeViewport } from '../../features/app-shell/useKeyboardSafeViewport';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';

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
  onAddById,
  onBack
}: {
  requests: FriendRequest[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAddById: (id: string) => void;
  onBack: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [searchId, setSearchId] = useState('');
  useKeyboardSafeViewport({
    containerRef,
    enabled: true,
  });

  return (
    <div ref={containerRef} className="absolute inset-0 bg-zinc-50 flex flex-col z-50">
      {/* Header */}
      <div className="min-h-[64px] pt-12 pb-3 px-4 flex items-center gap-2 bg-white border-b border-zinc-100">
        <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[18px] font-bold text-zinc-900">新的朋友</h1>
      </div>

      {/* Search */}
      <div className="p-4 bg-white mb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            placeholder="输入虚拟ID添加朋友"
            value={searchId}
            onChange={e => setSearchId(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && searchId.trim()) {
                onAddById(searchId.trim());
                setSearchId('');
              }
            }}
            className="w-full bg-zinc-100 rounded-xl py-2 pl-10 pr-4 text-[14px] outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* List */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 16px)',
          transition: 'padding-bottom 180ms ease',
        }}
      >
        <div className="px-4 py-2 text-[13px] text-zinc-500">好友申请</div>
        {requests.length === 0 ? (
          <div className="text-center py-10 text-zinc-400 text-sm">暂无好友申请</div>
        ) : (
          requests.map(req => (
            <div key={req.id} className="flex items-center gap-3 p-4 bg-white border-b border-zinc-50">
              <ResolvedNewFriendAvatar
                value={req.fromUserAvatar}
                alt={req.fromUserName}
                className="w-10 h-10 rounded-full bg-zinc-100 object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-900">{req.fromUserName}</div>
                <div className="text-[12px] text-zinc-500 truncate">{req.message || '请求添加你为好友'}</div>
              </div>
              {req.status === 'pending' ? (
                <div className="flex gap-2">
                  <button onClick={() => onReject(req.id)} className="px-3 py-1.5 bg-zinc-100 text-zinc-600 text-[12px] font-medium rounded-lg">拒绝</button>
                  <button onClick={() => onAccept(req.id)} className="px-3 py-1.5 bg-blue-500 text-white text-[12px] font-medium rounded-lg">接受</button>
                </div>
              ) : (
                <span className="text-[12px] text-zinc-400">{req.status === 'accepted' ? '已添加' : '已拒绝'}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

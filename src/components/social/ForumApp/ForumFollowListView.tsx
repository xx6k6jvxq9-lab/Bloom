import React from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { ForumResolvedImage } from './ForumResolvedImage';

type FollowListUser = {
  id: string;
  name: string;
  avatar: string;
  handle: string;
  bio?: string;
  description?: string;
  isFollowed: boolean;
  canChat: boolean;
};

type ForumFollowListViewProps = {
  mode: 'following' | 'followers';
  targetUserName: string;
  rawCount: number;
  searchValue: string;
  users: FollowListUser[];
  emptyBySearch: boolean;
  onBack: () => void;
  onSearchChange: (value: string) => void;
  onOpenUser: (userId: string) => void;
  onOpenChat: (userId: string) => void;
  onToggleFollow: (userId: string) => void;
  topInsetStyle?: React.CSSProperties;
  bottomInsetStyle?: React.CSSProperties;
};

export function ForumFollowListView({
  mode,
  targetUserName,
  rawCount,
  searchValue,
  users,
  emptyBySearch,
  onBack,
  onSearchChange,
  onOpenUser,
  onOpenChat,
  onToggleFollow,
  topInsetStyle,
  bottomInsetStyle,
}: ForumFollowListViewProps) {
  return (
    <div className="bg-white h-full min-h-0 flex flex-col">
      <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 px-4 pb-3 flex items-center gap-6" style={topInsetStyle}>
        <button onClick={onBack} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h2 className="font-bold text-lg text-zinc-900">
            {mode === 'following' ? '正在关注' : '关注者'}
          </h2>
          <div className="text-[12px] text-zinc-500 truncate">
            {targetUserName} · {rawCount}
          </div>
        </div>
      </div>

      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={mode === 'following' ? '搜索你关注的人' : '搜索关注你的人'}
            className="w-full bg-transparent text-[13px] text-zinc-900 outline-none placeholder-zinc-400"
          />
        </div>
      </div>

      <div className="forum-app-scroll flex-1 min-h-0 overflow-y-auto bg-white" style={bottomInsetStyle}>
        {users.length === 0 ? (
          <div className="px-8 pt-16 text-center text-[14px] text-zinc-500">
            <h3 className="mb-3 text-[18px] font-bold text-zinc-900">这里还没有名单</h3>
            <p className="leading-7">
              {emptyBySearch
                ? '没有搜到匹配的人。'
                : mode === 'following'
                  ? '还没有关注任何人。'
                  : '目前还没有整理出关注者。'}
            </p>
          </div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="flex items-center gap-3 border-b border-zinc-100 px-4 py-4">
              <button type="button" onClick={() => onOpenUser(user.id)} className="shrink-0">
                <ForumResolvedImage value={user.avatar} className="h-12 w-12 rounded-full object-cover" />
              </button>
              <button type="button" onClick={() => onOpenUser(user.id)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-[15px] font-bold text-zinc-900">{user.name}</div>
                <div className="mt-1 truncate text-[12px] text-zinc-500">{user.handle}</div>
                <div className="mt-1 truncate text-[12px] text-zinc-400">
                  {user.bio || user.description || '这个人还没有留下简介。'}
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                {user.canChat && (
                  <button
                    type="button"
                    onClick={() => onOpenChat(user.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-50"
                  >
                    <MessageCircle size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onToggleFollow(user.id)}
                  className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition-colors ${
                    user.isFollowed
                      ? 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                      : 'border border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                  }`}
                >
                  {user.isFollowed ? '已关注' : '关注'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

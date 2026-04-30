import React from 'react';
import { AlertTriangle, BarChart2, Bookmark, Heart, Link2, MessageCircle, MoreHorizontal, Repeat, Share2, Trash2 } from 'lucide-react';
import type { ForumPost } from '../../../types';
import { ForumResolvedImage } from './ForumResolvedImage';

type IdentityMeta = {
  label: string;
  className: string;
} | null;

type ForumPostCardProps = {
  post: ForumPost;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  handle: string;
  identityMeta: IdentityMeta;
  isOwner: boolean;
  threadTypeLabel: string;
  threadTypeClassName: string;
  timeStr: string;
  currentUserId: string;
  showMenu: boolean;
  onOpen: (postId: string) => void;
  onOpenAuthor: (authorId: string) => void;
  onToggleMenu: (postId: string) => void;
  onCloseMenu: () => void;
  onCollect: (postId: string) => void;
  onDelete: (postId: string) => void;
  onReport: () => void;
  onLike: (postId: string) => void;
  onShare: (postId: string) => void;
};

export function ForumPostCard({
  post,
  author,
  handle,
  identityMeta,
  isOwner,
  threadTypeLabel,
  threadTypeClassName,
  timeStr,
  currentUserId,
  showMenu,
  onOpen,
  onOpenAuthor,
  onToggleMenu,
  onCloseMenu,
  onCollect,
  onDelete,
  onReport,
  onLike,
  onShare,
}: ForumPostCardProps) {
  const likedByCurrentUser = post.likes.includes(currentUserId);

  return (
    <div
      onClick={() => onOpen(post.id)}
      className="bg-white p-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer flex gap-3"
    >
      <button
        type="button"
        className="shrink-0 self-start pt-0.5"
        onClick={(event) => {
          event.stopPropagation();
          onOpenAuthor(author.id);
        }}
      >
        <ForumResolvedImage value={author.avatar} className="w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[14px] truncate">
            <span className="font-bold text-zinc-900 truncate hover:underline">{author.name}</span>
            {identityMeta && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${identityMeta.className}`}>{identityMeta.label}</span>}
            {author.id !== 'user_8888' && <span className="text-zinc-500">●</span>}
            <span className="text-zinc-500 truncate">{handle}</span>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-500 hover:underline">{timeStr}</span>
          </div>
          <div className="relative">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onToggleMenu(post.id);
              }}
              className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 p-1.5 rounded-full transition-colors -mr-1.5"
            >
              <MoreHorizontal size={18} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={(event) => { event.stopPropagation(); onCloseMenu(); }} />
                <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-50 overflow-hidden">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onCollect(post.id);
                      onCloseMenu();
                    }}
                    className="w-full px-4 py-2 text-left text-[14px] hover:bg-zinc-50 flex items-center gap-2"
                  >
                    <Bookmark size={16} />
                    {post.collections.includes(currentUserId) ? '取消收藏' : '收藏'}
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      navigator.clipboard.writeText(window.location.href);
                      alert('链接已复制');
                      onCloseMenu();
                    }}
                    className="w-full px-4 py-2 text-left text-[14px] hover:bg-zinc-50 flex items-center gap-2"
                  >
                    <Link2 size={16} />
                    复制链接
                  </button>
                  {isOwner ? (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(post.id);
                        onCloseMenu();
                      }}
                      className="w-full px-4 py-2 text-left text-[14px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      删除
                    </button>
                  ) : (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onReport();
                        onCloseMenu();
                      }}
                      className="w-full px-4 py-2 text-left text-[14px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                    >
                      <AlertTriangle size={16} />
                      举报
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${threadTypeClassName}`}>
            {threadTypeLabel}
          </span>
          {post.title && <h3 className="text-[14px] font-bold text-zinc-900">{post.title}</h3>}
        </div>
        <p className="text-[14px] text-zinc-900 mt-0.5 whitespace-pre-wrap leading-snug">{post.content}</p>

        {post.images && post.images.length > 0 && (
          <div className={`mt-3 grid gap-0.5 overflow-hidden rounded-2xl border border-zinc-100 ${post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : post.images.length === 3 ? 'grid-cols-2' : 'grid-cols-2'}`}>
            {post.images.map((img, index) => (
              <ForumResolvedImage key={index} value={img} className={`w-full object-cover ${post.images!.length === 1 ? 'max-h-80' : 'h-32'} ${post.images!.length === 3 && index === 0 ? 'row-span-2 h-full' : ''}`} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-3 text-zinc-500 max-w-md pr-4">
          <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
            <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
              <MessageCircle size={18} />
            </div>
            <span className="text-[12px]">{post.comments.length > 0 ? post.comments.length : ''}</span>
          </button>
          <button className="flex items-center gap-1 hover:text-green-500 group transition-colors">
            <div className="p-1.5 rounded-full group-hover:bg-green-50 transition-colors -ml-1.5">
              <Repeat size={18} />
            </div>
            <span className="text-[12px]">{post.collections.length > 0 ? post.collections.length : ''}</span>
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onLike(post.id);
            }}
            className={`flex items-center gap-1 group transition-colors ${likedByCurrentUser ? 'text-pink-500' : 'hover:text-pink-500'}`}
          >
            <div className="p-1.5 rounded-full group-hover:bg-pink-50 transition-colors -ml-1.5">
              <Heart size={18} className={likedByCurrentUser ? 'fill-pink-500' : ''} />
            </div>
            <span className="text-[12px]">{post.likes.length > 0 ? post.likes.length : ''}</span>
          </button>
          <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
            <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
              <BarChart2 size={18} />
            </div>
            <span className="text-[12px]">{post.viewCount > 0 ? post.viewCount : ''}</span>
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onShare(post.id);
            }}
            className="flex items-center gap-1 hover:text-zinc-900 group transition-colors"
          >
            <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
              <Share2 size={18} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

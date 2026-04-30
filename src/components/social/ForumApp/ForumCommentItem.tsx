import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart2,
  Heart,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Repeat,
  Share2,
  Trash2,
} from 'lucide-react';
import type { ForumComment, ForumPost } from '../../../types';
import { ForumResolvedImage } from './ForumResolvedImage';

type IdentityMeta = {
  label: string;
  className: string;
} | null;

type ForumCommentItemProps = {
  comment: ForumComment;
  post: ForumPost;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  handle: string;
  identityMeta: IdentityMeta;
  isOwner: boolean;
  isPostOwner: boolean;
  floorNumber: number;
  replyToFloor: number | null;
  replyToAuthorName?: string;
  currentUserAvatar: string;
  anonymousAvatar: string;
  likedByCurrentUser: boolean;
  repliesCount: number;
  timeStr: string;
  onReply: (postId: string, content: string, replyToId?: string, rootId?: string, identity?: 'self' | 'anonymous') => void;
  onLike: (postId: string, commentId: string) => void;
  onDelete: (postId: string, commentId: string) => void;
  onReport: () => void;
  onUserClick: (userId: string) => void;
};

export function ForumCommentItem({
  comment,
  post,
  author,
  handle,
  identityMeta,
  isOwner,
  isPostOwner,
  floorNumber,
  replyToFloor,
  replyToAuthorName,
  currentUserAvatar,
  anonymousAvatar,
  likedByCurrentUser,
  repliesCount,
  timeStr,
  onReply,
  onLike,
  onDelete,
  onReport,
  onUserClick,
}: ForumCommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyIdentity, setReplyIdentity] = useState<'self' | 'anonymous'>('self');
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);

  return (
    <div className="border-b border-zinc-100">
      <div className="flex gap-2.5 px-4 py-3">
        <button
          type="button"
          className="shrink-0 self-start pt-0.5"
          onClick={(event) => {
            event.stopPropagation();
            onUserClick(author.id);
          }}
        >
          <ForumResolvedImage value={author.avatar} className="w-8 h-8 rounded-full object-cover shrink-0 cursor-pointer" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1 text-[13px]">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600">{floorNumber}L</span>
              <span className="font-bold text-zinc-900 break-all hover:underline">{author.name}</span>
              {identityMeta && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${identityMeta.className}`}>{identityMeta.label}</span>}
              {isPostOwner && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700">楼主</span>}
              {author.id !== 'user_8888' && <span className="text-zinc-500">●</span>}
              <span className="text-zinc-500 break-all">{handle}</span>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-500 shrink-0 hover:underline">{timeStr}</span>
            </div>
            <div className="relative">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setShowPostMenu(showPostMenu === comment.id ? null : comment.id);
                }}
                className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 p-1 rounded-full transition-colors -mr-1"
              >
                <MoreHorizontal size={16} />
              </button>
              {showPostMenu === comment.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={(event) => { event.stopPropagation(); setShowPostMenu(null); }} />
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-50 overflow-hidden">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        navigator.clipboard.writeText(window.location.href);
                        alert('链接已复制');
                        setShowPostMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left text-[13px] hover:bg-zinc-50 flex items-center gap-2"
                    >
                      <Link2 size={14} />
                      复制链接
                    </button>
                    {isOwner ? (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(post.id, comment.id);
                          setShowPostMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    ) : (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onReport();
                          setShowPostMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                      >
                        <AlertTriangle size={14} />
                        举报
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {replyToFloor && replyToAuthorName && (
            <div className="mt-1 text-[12px] text-zinc-500 break-all">
              回复 {replyToFloor}L @{replyToAuthorName}
            </div>
          )}

          <p className="text-[14px] text-zinc-900 mt-0.5 whitespace-pre-wrap leading-snug">{comment.content}</p>

          <div className="flex items-center justify-between mt-2 text-zinc-500 max-w-md pr-2">
            <button
              onClick={() => setShowReply(!showReply)}
              className="flex items-center gap-1 hover:text-zinc-900 group transition-colors"
            >
              <div className="p-1 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1">
                <MessageCircle size={16} />
              </div>
              <span className="text-[12px]">{repliesCount > 0 ? repliesCount : ''}</span>
            </button>
            <button className="flex items-center gap-1 hover:text-green-500 group transition-colors">
              <div className="p-1 rounded-full group-hover:bg-green-50 transition-colors -ml-1">
                <Repeat size={16} />
              </div>
            </button>
            <button
              onClick={() => onLike(post.id, comment.id)}
              className={`flex items-center gap-1 group transition-colors ${likedByCurrentUser ? 'text-pink-500' : 'hover:text-pink-500'}`}
            >
              <div className="p-1 rounded-full group-hover:bg-pink-50 transition-colors -ml-1">
                <Heart size={16} className={likedByCurrentUser ? 'fill-pink-500' : ''} />
              </div>
              <span className="text-[12px]">{comment.likes.length > 0 ? comment.likes.length : ''}</span>
            </button>
            <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
              <div className="p-1 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1">
                <BarChart2 size={16} />
              </div>
            </button>
            <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
              <div className="p-1 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1">
                <Share2 size={16} />
              </div>
            </button>
          </div>

          {showReply && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReplyIdentity('self')}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${replyIdentity === 'self' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'}`}
                >
                  本人
                </button>
                <button
                  type="button"
                  onClick={() => setReplyIdentity('anonymous')}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${replyIdentity === 'anonymous' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'}`}
                >
                  匿名
                </button>
              </div>
              <div className="flex gap-3 items-center">
                <ForumResolvedImage value={replyIdentity === 'anonymous' ? anonymousAvatar : currentUserAvatar} className="w-8 h-8 rounded-full object-cover" />
                <input
                  type="text"
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="发布你的回复"
                  className="flex-1 bg-transparent text-[14px] outline-none placeholder-zinc-500"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && replyText.trim()) {
                      onReply(post.id, replyText.trim(), comment.id, comment.rootCommentId || comment.id, replyIdentity);
                      setReplyText('');
                      setReplyIdentity('self');
                      setShowReply(false);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (replyText.trim()) {
                      onReply(post.id, replyText.trim(), comment.id, comment.rootCommentId || comment.id, replyIdentity);
                      setReplyText('');
                      setReplyIdentity('self');
                      setShowReply(false);
                    }
                  }}
                  disabled={!replyText.trim()}
                  className={`px-4 py-1.5 rounded-full font-bold text-[14px] transition-all ${replyText.trim() ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'}`}
                >
                  回复
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

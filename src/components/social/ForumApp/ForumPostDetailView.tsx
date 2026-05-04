import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Heart,
  Link2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ForumComment, ForumPost } from '../../../types';
import { useAppKeyboard } from '../../../features/app-shell/AppKeyboardContext';
import { useKeyboardSafeViewport } from '../../../features/app-shell/useKeyboardSafeViewport';
import { ForumCommentItem } from './ForumCommentItem';
import { ForumResolvedImage } from './ForumResolvedImage';
import { ForumReplyComposer } from './ForumReplyComposer';
import { ForumRichText } from './ForumRichText';
import { getForumHotBadgeLabel } from '../../../services/forum/forumHotState';

type IdentityMeta = {
  label: string;
  className: string;
} | null;

type ForumPostDetailViewProps = {
  post: ForumPost;
  author: { id: string; name: string; avatar: string };
  handle: string;
  isOwner: boolean;
  identityMeta: IdentityMeta;
  threadTypeLabel: string;
  threadTypeClassName: string;
  sortedComments: ForumComment[];
  floorMap: Record<string, number>;
  timeStr: string;
  dateStr: string;
  currentUserId: string;
  currentUserAvatar: string;
  anonymousMainAvatar: string;
  anonymousReplyAvatar: string;
  defaultCommentMaskId?: string;
  availableCommentMasks: Array<{ id: string; name: string }>;
  mainReplyText: string;
  showPostMenu: boolean;
  isPinned?: boolean;
  forumAiLoading: boolean;
  topInsetStyle?: React.CSSProperties;
  onBack: () => void;
  onOpenAuthor: (authorId: string) => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onCollect: (postId: string) => void;
  onTogglePin?: (postId: string) => void;
  onDelete: (postId: string) => void;
  onReport: () => void;
  onLike: (postId: string) => void;
  onShare: (postId: string) => void;
  onRefreshReplies: (postId: string) => void;
  onVotePoll: (postId: string, optionId: string) => void;
  onMainReplyTextChange: (value: string) => void;
  onSubmitSelfReply: (maskId?: string) => void;
  onSubmitAnonymousReply: () => void;
  resolveCommentAuthor: (comment: ForumComment) => { id: string; name: string; avatar: string };
  resolveCommentHandle: (comment: ForumComment) => string;
  resolveCommentIdentityMeta: (comment: ForumComment) => IdentityMeta;
  isCurrentUserCommentAuthor: (comment: ForumComment) => boolean;
  resolveReplyToAuthorName: (comment: ForumComment) => string | undefined;
  resolveCommentTime: (comment: ForumComment) => string;
  resolveRepliesCount: (comment: ForumComment) => number;
  onReply: (postId: string, content: string, replyToId?: string, rootId?: string, identity?: 'self' | 'anonymous') => void;
  onLikeComment: (postId: string, commentId: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
  onUserClick: (userId: string) => void;
  children?: React.ReactNode;
};

export function ForumPostDetailView(props: ForumPostDetailViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const composerShellRef = useRef<HTMLDivElement | null>(null);
  const {
    post,
    author,
    handle,
    isOwner,
    identityMeta,
    threadTypeLabel,
    threadTypeClassName,
    sortedComments,
    floorMap,
    timeStr,
    dateStr,
    currentUserId,
    currentUserAvatar,
    anonymousMainAvatar,
    anonymousReplyAvatar,
    defaultCommentMaskId,
    availableCommentMasks,
    mainReplyText,
    showPostMenu,
    isPinned = false,
    forumAiLoading,
    topInsetStyle,
    onBack,
    onOpenAuthor,
    onToggleMenu,
    onCloseMenu,
    onCollect,
    onTogglePin,
    onDelete,
    onReport,
    onLike,
    onShare,
    onRefreshReplies,
    onVotePoll,
    onMainReplyTextChange,
    onSubmitSelfReply,
    onSubmitAnonymousReply,
    resolveCommentAuthor,
    resolveCommentHandle,
    resolveCommentIdentityMeta,
    isCurrentUserCommentAuthor,
    resolveReplyToAuthorName,
    resolveCommentTime,
    resolveRepliesCount,
    onReply,
    onLikeComment,
    onDeleteComment,
    onUserClick,
    children,
  } = props;

  const postImages = post.images || [];
  const hotBadge = getForumHotBadgeLabel(post);
  const { keyboardInset, keyboardVisible: appKeyboardVisible } = useAppKeyboard();
  const { keyboardVisible: ownsFocusedKeyboard } = useKeyboardSafeViewport({
    containerRef,
    enabled: true,
  });
  const [composerHeight, setComposerHeight] = useState(76);

  useEffect(() => {
    const node = composerShellRef.current;
    if (!node || typeof window === 'undefined') {
      return undefined;
    }

    const updateHeight = () => {
      const nextHeight = Math.ceil(node.getBoundingClientRect().height);
      if (nextHeight > 0) {
        setComposerHeight(nextHeight);
      }
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => {
        window.removeEventListener('resize', updateHeight);
      };
    }

    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(node);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  return (
    <div ref={containerRef} className="bg-white h-full min-h-0 flex flex-col relative">
      <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 px-4 pb-2 flex items-center gap-6" style={topInsetStyle}>
        <button onClick={onBack} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-bold text-lg text-zinc-900">帖子</h2>
      </div>

      <div
        className="px-4 pt-2 flex-1 min-h-0 overflow-y-auto pb-6"
        style={{
          paddingBottom: `${composerHeight + (ownsFocusedKeyboard && appKeyboardVisible && keyboardInset > 0 ? keyboardInset : 0) + 24}px`,
          transition: 'padding-bottom 180ms ease',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button className="shrink-0" onClick={() => onOpenAuthor(author.id)}>
              <ForumResolvedImage value={author.avatar} className="w-9 h-9 rounded-full object-cover cursor-pointer" />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="font-bold text-[14px] text-zinc-900 hover:underline">{author.name}</span>
                {identityMeta && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${identityMeta.className}`}>{identityMeta.label}</span>}
                {isPinned && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">置顶</span>}
                {author.id !== 'user_8888' && <CheckCircle2 size={14} className="text-zinc-900 fill-zinc-900" />}
              </div>
              <span className="text-[13px] text-zinc-500">{handle}</span>
            </div>
          </div>
          <div className="relative">
            <button onClick={onToggleMenu} className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-full transition-colors">
              <MoreHorizontal size={18} />
            </button>
            {showPostMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={onCloseMenu} />
                <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      onCollect(post.id);
                      onCloseMenu();
                    }}
                    className="w-full px-3 py-2 text-left text-[13px] hover:bg-zinc-50 flex items-center gap-2"
                  >
                    <Bookmark size={14} />
                    {post.collections.includes(currentUserId) ? '取消收藏' : '收藏'}
                  </button>
                  {isOwner && onTogglePin && (
                    <button
                      onClick={() => {
                        onTogglePin(post.id);
                        onCloseMenu();
                      }}
                      className="w-full px-3 py-2 text-left text-[13px] hover:bg-zinc-50 flex items-center gap-2"
                    >
                      {isPinned ? '取消置顶' : '置顶帖子'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      alert('链接已复制');
                      onCloseMenu();
                    }}
                    className="w-full px-3 py-2 text-left text-[13px] hover:bg-zinc-50 flex items-center gap-2"
                  >
                    <Link2 size={14} />
                    复制链接
                  </button>
                  {isOwner ? (
                    <button
                      onClick={() => {
                        onDelete(post.id);
                        onCloseMenu();
                      }}
                      className="w-full px-3 py-2 text-left text-[13px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      删除
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        onReport();
                        onCloseMenu();
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

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${threadTypeClassName}`}>{threadTypeLabel}</span>
          {hotBadge && <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">{hotBadge}</span>}
          {post.title && <h1 className="text-base font-bold text-zinc-900">{post.title}</h1>}
        </div>

        <ForumRichText content={post.content} className="mb-3" threadType={post.threadType} post={post} currentUserId={currentUserId} onVote={onVotePoll} />

        {postImages.length > 0 && (
          <div className={`mb-2 grid gap-0.5 overflow-hidden rounded-2xl border border-zinc-100 ${postImages.length === 1 ? 'grid-cols-1' : postImages.length === 2 ? 'grid-cols-2' : postImages.length === 3 ? 'grid-cols-2' : 'grid-cols-2'}`}>
            {postImages.map((img, index) => (
              <ForumResolvedImage
                key={index}
                value={img}
                className={`w-full object-cover ${postImages.length === 1 ? 'max-h-80' : 'h-32'} ${postImages.length === 3 && index === 0 ? 'row-span-2 h-full' : ''}`}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 text-[13px] text-zinc-500 py-2 border-b border-zinc-100">
          <span>{timeStr}</span>
          <span>·</span>
          <span>{dateStr}</span>
          <span>·</span>
          <span className="font-bold text-zinc-900">{post.viewCount}</span>
          <span>查看</span>
        </div>

        <div className="flex items-center gap-6 py-2 border-b border-zinc-100 text-[13px]">
          <div className="flex items-center gap-1">
            <span className="font-bold text-zinc-900">{post.comments.length}</span>
            <span className="text-zinc-500">回复</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-zinc-900">{post.collections.length}</span>
            <span className="text-zinc-500">转发</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-zinc-900">{post.likes.length}</span>
            <span className="text-zinc-500">喜欢</span>
          </div>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-zinc-100">
          <div className="text-[12px] text-zinc-500">手动刷新一次，补这栋楼新的接楼和评论</div>
          <button
            type="button"
            onClick={() => onRefreshReplies(post.id)}
            disabled={forumAiLoading}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
              forumAiLoading
                ? 'border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed'
                : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            <RefreshCw size={14} className={forumAiLoading ? '' : 'text-sky-700'} />
            {forumAiLoading ? '补楼中...' : '刷新补楼'}
          </button>
        </div>

        <div className="mt-0">
          {forumAiLoading && <div className="px-4 py-3 text-[12px] text-zinc-500">网友正在接楼...</div>}
          {sortedComments.map((comment) => (
            <ForumCommentItem
              key={comment.id}
              comment={comment}
              post={post}
              author={resolveCommentAuthor(comment)}
              handle={resolveCommentHandle(comment)}
              identityMeta={resolveCommentIdentityMeta(comment)}
              isOwner={isCurrentUserCommentAuthor(comment)}
              isPostOwner={comment.authorId === post.authorId}
              floorNumber={floorMap[comment.id] || 0}
              replyToFloor={comment.replyToId ? (floorMap[comment.replyToId] || null) : null}
              replyToAuthorName={resolveReplyToAuthorName(comment)}
              currentUserAvatar={currentUserAvatar}
              anonymousAvatar={anonymousReplyAvatar}
              availableReplyMasks={availableCommentMasks}
              defaultReplyMaskId={defaultCommentMaskId}
              likedByCurrentUser={comment.likes.includes(currentUserId)}
              repliesCount={resolveRepliesCount(comment)}
              timeStr={resolveCommentTime(comment)}
              onReply={onReply}
              onLike={onLikeComment}
              onDelete={onDeleteComment}
              onReport={onReport}
              onUserClick={onUserClick}
            />
          ))}
        </div>
      </div>

      <div
        ref={composerShellRef}
        className="absolute inset-x-0 bottom-0 z-20"
        style={{
          bottom: ownsFocusedKeyboard && appKeyboardVisible && keyboardInset > 0
            ? `${keyboardInset}px`
            : '0px',
          transition: 'bottom 180ms ease',
        }}
      >
        <ForumReplyComposer
          currentUserAvatar={currentUserAvatar}
          anonymousMainAvatar={anonymousMainAvatar}
          defaultMaskId={defaultCommentMaskId}
          availableCommentMasks={availableCommentMasks}
          mainReplyText={mainReplyText}
          onMainReplyTextChange={onMainReplyTextChange}
          onSubmitSelfReply={onSubmitSelfReply}
          onSubmitAnonymousReply={onSubmitAnonymousReply}
        />
      </div>

      {children}
    </div>
  );
}

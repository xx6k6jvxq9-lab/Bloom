import React from 'react';
import { ArrowLeft, MessageCircle, PencilLine } from 'lucide-react';
import type { ForumPost } from '../../../types';
import { ForumProfilePostCard } from './ForumProfilePostCard';
import { ForumResolvedImage } from './ForumResolvedImage';

type IdentityMeta = {
  label: string;
  className: string;
} | null;

type ForumUserProfilePostItem = {
  post: ForumPost;
  timeStr: string;
  threadTypeLabel: string;
  threadTypeClassName: string;
  showMenu: boolean;
  isOwner: boolean;
  isPinned: boolean;
  identityMeta: IdentityMeta;
};

type ForumUserProfileViewProps = {
  user: {
    id: string;
    numericId?: string;
    name: string;
    avatar: string;
    handle: string;
    bio?: string;
    description?: string;
  };
  postCount: number;
  followingCount: number;
  followerCount: number;
  isFollowed: boolean;
  canChat: boolean;
  canEditProfile?: boolean;
  posts: ForumUserProfilePostItem[];
  currentUserId: string;
  topInsetStyle?: React.CSSProperties;
  bottomInsetStyle?: React.CSSProperties;
  onBack: () => void;
  onOpenChat: () => void;
  onEditProfile?: () => void;
  onToggleFollow: () => void;
  onOpenFollowing: () => void;
  onOpenFollowers: () => void;
  onOpenPost: (postId: string) => void;
  onTogglePostMenu: (postId: string) => void;
  onClosePostMenu: () => void;
  onCollectPost: (postId: string) => void;
  onTogglePinnedPost?: (postId: string) => void;
  onDeletePost: (postId: string) => void;
  onReport: () => void;
  onLikePost: (postId: string) => void;
  onSharePost: (postId: string) => void;
};

export function ForumUserProfileView({
  user,
  postCount,
  followingCount,
  followerCount,
  isFollowed,
  canChat,
  canEditProfile,
  posts,
  currentUserId,
  topInsetStyle,
  bottomInsetStyle,
  onBack,
  onOpenChat,
  onEditProfile,
  onToggleFollow,
  onOpenFollowing,
  onOpenFollowers,
  onOpenPost,
  onTogglePostMenu,
  onClosePostMenu,
  onCollectPost,
  onTogglePinnedPost,
  onDeletePost,
  onReport,
  onLikePost,
  onSharePost,
}: ForumUserProfileViewProps) {
  return (
    <div className="forum-app-scroll bg-white h-full min-h-0 overflow-y-auto" style={bottomInsetStyle}>
      <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 px-4 pb-3 flex items-center gap-6" style={topInsetStyle}>
        <button onClick={onBack} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col">
          <h2 className="font-bold text-lg text-zinc-900 leading-tight">{user.name}</h2>
          <span className="text-[12px] text-zinc-500">{postCount} 帖子</span>
        </div>
      </div>

      <div className="px-4 pt-12 pb-6">
        <div className="rounded-[28px] border border-zinc-100 bg-zinc-50/60 p-4">
          <div className="flex items-start gap-4">
            <ForumResolvedImage value={user.avatar} className="w-24 h-24 rounded-full border-2 border-white object-cover shadow-sm shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[20px] font-bold text-zinc-900 leading-tight break-words">{user.name}</h2>
                  <p className="mt-1 text-[12px] text-zinc-500 break-all">{user.handle}</p>
                  {user.numericId ? (
                    <p className="mt-1 text-[11px] text-zinc-400 break-all">好友ID {user.numericId}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-1">
                  {canEditProfile && (
                    <button
                      onClick={onEditProfile}
                      className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-900 hover:bg-zinc-50 transition-colors"
                    >
                      <PencilLine size={17} />
                    </button>
                  )}
                  {canChat && (
                    <button
                      onClick={onOpenChat}
                      className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-900 hover:bg-zinc-50 transition-colors"
                    >
                      <MessageCircle size={18} />
                    </button>
                  )}
                  <button
                    onClick={onToggleFollow}
                    className={`px-5 py-1.5 rounded-full font-bold text-[13px] transition-colors ${
                      isFollowed
                        ? 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                        : 'border border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                    }`}
                  >
                    {isFollowed ? '已关注' : '关注'}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-[13px] leading-7 text-zinc-600 break-words">
                {user.bio || user.description || '暂无简介。'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-100 pt-4">
            <div className="rounded-2xl bg-white px-3 py-3 text-center">
              <div className="text-[18px] font-bold text-zinc-900">{postCount}</div>
              <div className="mt-1 text-[11px] text-zinc-400">帖子</div>
            </div>
            <button
              type="button"
              onClick={onOpenFollowing}
              className="rounded-2xl bg-white px-3 py-3 text-center transition-colors hover:bg-zinc-50"
            >
              <div className="text-[18px] font-bold text-zinc-900">{followingCount}</div>
              <div className="mt-1 text-[11px] text-zinc-400">正在关注</div>
            </button>
            <button
              type="button"
              onClick={onOpenFollowers}
              className="rounded-2xl bg-white px-3 py-3 text-center transition-colors hover:bg-zinc-50"
            >
              <div className="text-[18px] font-bold text-zinc-900">{followerCount}</div>
              <div className="mt-1 text-[11px] text-zinc-400">关注者</div>
            </button>
          </div>
        </div>
      </div>

      <div className="flex border-b border-zinc-100">
        <button className="flex-1 py-4 text-[14px] font-bold text-zinc-900 relative hover:bg-zinc-50 transition-colors">
          帖子
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />
        </button>
        <button className="flex-1 py-4 text-[14px] font-bold text-zinc-500 relative hover:bg-zinc-50 transition-colors">
          回复
        </button>
        <button className="flex-1 py-4 text-[14px] font-bold text-zinc-500 relative hover:bg-zinc-50 transition-colors">
          喜欢
        </button>
      </div>

      <div className="space-y-0">
        {posts.length > 0 ? posts.map((item) => (
          <ForumProfilePostCard
            key={item.post.id}
            post={item.post}
            author={{
              id: user.id,
              name: user.name,
              avatar: user.avatar,
            }}
            handle={user.handle}
            identityMeta={item.identityMeta}
            isOwner={item.isOwner}
            threadTypeLabel={item.threadTypeLabel}
            threadTypeClassName={item.threadTypeClassName}
            timeStr={item.timeStr}
            currentUserId={currentUserId}
            showMenu={item.showMenu}
            isPinned={item.isPinned}
            onOpen={onOpenPost}
            onOpenAuthor={() => {}}
            onToggleMenu={onTogglePostMenu}
            onCloseMenu={onClosePostMenu}
            onCollect={onCollectPost}
            onTogglePin={onTogglePinnedPost || (() => {})}
            onDelete={onDeletePost}
            onReport={onReport}
            onLike={onLikePost}
            onShare={onSharePost}
          />
        )) : (
          <div className="text-center py-10 text-zinc-500 text-[14px]">
            <h3 className="font-bold text-lg text-zinc-900 mb-2">还没有帖子</h3>
            <p>当该用户发布帖子时，它会显示在这里。</p>
          </div>
        )}
      </div>
    </div>
  );
}

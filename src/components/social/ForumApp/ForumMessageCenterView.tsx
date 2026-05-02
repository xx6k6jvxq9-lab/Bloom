import { Bell, Heart, MessageCircle, MoreHorizontal, User, UserPlus } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ForumNotification } from '../../../types';
import type {
  ForumMessageCenterData,
  ForumMessageChatSessionItem,
  ForumMessageNotificationItem,
} from '../../../services/forum/forumMessageCenter';
import { ForumResolvedImage } from './ForumResolvedImage';
import { ForumMessageRowMenu } from './ForumMessageRowMenu';

type ForumMessageCenterViewProps = {
  data: ForumMessageCenterData;
  notificationItems: ForumMessageNotificationItem[];
  messageTab: 'chats' | 'activity';
  chatListTab: 'mutual' | 'strangers';
  openMessageRowMenuId: string | null;
  forumTopInsetStyle?: CSSProperties;
  forumBottomInsetStyle?: CSSProperties;
  onOpenManageSheet: () => void;
  onChangeMessageTab: (value: 'chats' | 'activity') => void;
  onChangeChatListTab: (value: 'mutual' | 'strangers') => void;
  onOpenChat: (authorId: string) => void;
  onMarkChatViewed: (authorId: string) => void;
  onToggleMessageRowMenu: (id: string | null) => void;
  onTogglePinnedChat: (authorId: string) => void;
  onRemoveChat: (authorId: string) => void;
  onOpenNotificationPost: (postId: string) => void;
  onRemoveNotification: (notificationId: string) => void;
  isPinnedChat: (authorId: string) => boolean;
};

function resolveNotificationIcon(notification: ForumNotification) {
  if (notification.type === 'like_post' || notification.type === 'like_comment') {
    return { Icon: Heart, iconColor: 'text-pink-500 fill-pink-500' };
  }
  if (notification.type === 'follow') {
    return { Icon: User, iconColor: 'text-sky-600 fill-sky-600' };
  }
  if (notification.type === 'friend_request') {
    return { Icon: UserPlus, iconColor: 'text-emerald-600 fill-emerald-600' };
  }
  return { Icon: MessageCircle, iconColor: 'text-zinc-900 fill-zinc-900' };
}

function formatRelativeTime(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function PendingReplyBadge(props: { session: ForumMessageChatSessionItem['session'] }) {
  const { session } = props;
  if (!session.pendingReply) return null;

  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
      {session.pendingReply.status === 'typing' ? '对方输入中' : session.pendingReply.status === 'ghosted' ? '已读未回' : '等待回复'}
    </span>
  );
}

function ChatSessionRow(props: {
  item: ForumMessageChatSessionItem;
  openMessageRowMenuId: string | null;
  onOpenChat: (authorId: string) => void;
  onMarkChatViewed: (authorId: string) => void;
  onToggleMenu: (id: string | null) => void;
  onTogglePinnedChat: (authorId: string) => void;
  onRemoveChat: (authorId: string) => void;
  isPinnedChat: (authorId: string) => boolean;
}) {
  const {
    item,
    openMessageRowMenuId,
    onOpenChat,
    onMarkChatViewed,
    onToggleMenu,
    onTogglePinnedChat,
    onRemoveChat,
    isPinnedChat,
  } = props;

  const menuId = `chat-${item.session.authorId}`;

  return (
    <div className="flex gap-3 border-b border-zinc-100 bg-white px-4 py-4 text-left transition-colors hover:bg-zinc-50">
      <div className="relative shrink-0">
        <ForumResolvedImage value={item.author.avatar} className="h-12 w-12 rounded-full object-cover" />
        {item.isUnread && <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500" />}
      </div>
      <button
        type="button"
        onClick={() => {
          onMarkChatViewed(item.session.authorId);
          onOpenChat(item.session.authorId);
        }}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-[15px] font-bold text-zinc-900">{item.author.name}</span>
              {isPinnedChat(item.session.authorId) && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">置顶</span>
              )}
              {item.isMutual && (
                <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-600">互关</span>
              )}
              {item.session.addedAsFriend && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">已加好友</span>
              )}
            </div>
            <div className="truncate text-[12px] text-zinc-500">{item.handleText}</div>
          </div>
          <div className="shrink-0 text-[11px] text-zinc-400">
            {item.lastMessage ? formatRelativeTime(item.lastMessage.timestamp) : ''}
          </div>
        </div>
        <div className="mt-1 line-clamp-2 text-[13px] leading-5 text-zinc-600">
          {item.lastMessage?.text || '还没有开始聊天'}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-zinc-400">
          <PendingReplyBadge session={item.session} />
          {item.relatedPost && (
            <span className="truncate">
              相关帖子：{item.relatedPost.title || item.relatedPost.content.slice(0, 18)}
            </span>
          )}
        </div>
      </button>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => onToggleMenu(openMessageRowMenuId === menuId ? null : menuId)}
          className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <MoreHorizontal size={16} />
        </button>
        {openMessageRowMenuId === menuId && (
          <ForumMessageRowMenu
            onClose={() => onToggleMenu(null)}
            actions={[
              {
                label: isPinnedChat(item.session.authorId) ? '取消置顶' : '置顶聊天',
                onClick: () => onTogglePinnedChat(item.session.authorId),
              },
              {
                label: '删除聊天',
                tone: 'danger',
                onClick: () => onRemoveChat(item.session.authorId),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}

function NotificationRow(props: {
  item: ForumMessageNotificationItem;
  openMessageRowMenuId: string | null;
  onOpenPost: (postId: string) => void;
  onToggleMenu: (id: string | null) => void;
  onRemoveNotification: (notificationId: string) => void;
}) {
  const { item, openMessageRowMenuId, onOpenPost, onToggleMenu, onRemoveNotification } = props;
  const menuId = `notification-${item.notification.id}`;
  const { Icon, iconColor } = resolveNotificationIcon(item.notification);

  return (
    <div className="bg-white p-4 border-b border-zinc-100 flex gap-3 hover:bg-zinc-50 transition-colors">
      <div className="w-10 flex justify-end pt-1">
        <Icon size={24} className={iconColor} />
      </div>
      <button
        type="button"
        onClick={() => {
          if (item.post) onOpenPost(item.post.id);
        }}
        className="flex-1 text-left"
      >
        <ForumResolvedImage value={item.sourceUser.avatar} className="w-8 h-8 rounded-full object-cover mb-2" />
        <p className="text-[14px] text-zinc-900 mb-2">
          <span className="font-bold hover:underline">{item.sourceUser.name}</span>
          <span className="text-zinc-500 ml-1">{item.actionText}</span>
        </p>
        {item.post && (
          <div className="text-[15px] text-zinc-500 line-clamp-3">
            {item.post.content}
          </div>
        )}
      </button>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => onToggleMenu(openMessageRowMenuId === menuId ? null : menuId)}
          className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <MoreHorizontal size={16} />
        </button>
        {openMessageRowMenuId === menuId && (
          <ForumMessageRowMenu
            onClose={() => onToggleMenu(null)}
            actions={[
              {
                label: '删除通知',
                tone: 'danger',
                onClick: () => onRemoveNotification(item.notification.id),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}

export function ForumMessageCenterView(props: ForumMessageCenterViewProps) {
  const {
    data,
    notificationItems,
    messageTab,
    chatListTab,
    openMessageRowMenuId,
    forumTopInsetStyle,
    forumBottomInsetStyle,
    onOpenManageSheet,
    onChangeMessageTab,
    onChangeChatListTab,
    onOpenChat,
    onMarkChatViewed,
    onToggleMessageRowMenu,
    onTogglePinnedChat,
    onRemoveChat,
    onOpenNotificationPost,
    onRemoveNotification,
    isPinnedChat,
  } = props;

  const visibleChatSessions = chatListTab === 'mutual' ? data.mutualChatSessions : data.strangerChatSessions;

  return (
    <div className="forum-app-scroll bg-white h-full min-h-0 overflow-y-auto" style={forumBottomInsetStyle}>
      <div className="px-4 pb-3 bg-white/90 backdrop-blur-md sticky top-0 z-10 border-b border-zinc-100 flex items-center justify-between" style={forumTopInsetStyle}>
        <div className="text-[20px] font-black tracking-tight text-zinc-900">消息</div>
        <button
          type="button"
          onClick={onOpenManageSheet}
          className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
        >
          <MoreHorizontal size={20} className="text-zinc-900" />
        </button>
      </div>

      <div className="flex border-b border-zinc-100">
        <button
          onClick={() => onChangeMessageTab('chats')}
          className={`flex-1 py-4 text-[14px] font-bold relative hover:bg-zinc-50 transition-colors ${messageTab === 'chats' ? 'text-zinc-900' : 'text-zinc-500'}`}
        >
          聊天
          {messageTab === 'chats' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />}
        </button>
        <button
          onClick={() => onChangeMessageTab('activity')}
          className={`flex-1 py-4 text-[14px] font-bold relative hover:bg-zinc-50 transition-colors ${messageTab === 'activity' ? 'text-zinc-900' : 'text-zinc-500'}`}
        >
          通知
          {messageTab === 'activity' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />}
          {data.unreadNotificationCount > 0 && messageTab !== 'activity' && (
            <span className="ml-2 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {data.unreadNotificationCount}
            </span>
          )}
        </button>
      </div>

      {messageTab === 'chats' ? (
        <div className="space-y-0">
          <div className="flex border-b border-zinc-100 bg-white px-4">
            <button
              type="button"
              onClick={() => onChangeChatListTab('mutual')}
              className={`relative flex-1 py-3 text-[13px] font-medium transition-colors ${chatListTab === 'mutual' ? 'text-zinc-900' : 'text-zinc-500'}`}
            >
              互相关注
              <span className="ml-1 text-[11px] text-zinc-400">{data.mutualChatSessions.length}</span>
              {data.mutualUnreadCount > 0 && (
                <span className="ml-1 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {data.mutualUnreadCount}
                </span>
              )}
              {chatListTab === 'mutual' && <div className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-zinc-900" />}
            </button>
            <button
              type="button"
              onClick={() => onChangeChatListTab('strangers')}
              className={`relative flex-1 py-3 text-[13px] font-medium transition-colors ${chatListTab === 'strangers' ? 'text-zinc-900' : 'text-zinc-500'}`}
            >
              陌生人
              <span className="ml-1 text-[11px] text-zinc-400">{data.strangerChatSessions.length}</span>
              {data.strangerUnreadCount > 0 && (
                <span className="ml-1 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {data.strangerUnreadCount}
                </span>
              )}
              {chatListTab === 'strangers' && <div className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-zinc-900" />}
            </button>
          </div>
          {visibleChatSessions.length > 0 && (
            <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 text-[12px] text-zinc-500">
              {chatListTab === 'mutual'
                ? `按未读优先展示互相关注会话，共 ${data.mutualChatSessions.length} 条`
                : `按未读优先展示陌生人会话，共 ${data.strangerChatSessions.length} 条`}
            </div>
          )}
          {visibleChatSessions.map((item) => (
            <ChatSessionRow
              key={item.session.authorId}
              item={item}
              openMessageRowMenuId={openMessageRowMenuId}
              onOpenChat={onOpenChat}
              onMarkChatViewed={onMarkChatViewed}
              onToggleMenu={onToggleMessageRowMenu}
              onTogglePinnedChat={onTogglePinnedChat}
              onRemoveChat={onRemoveChat}
              isPinnedChat={isPinnedChat}
            />
          ))}
          {visibleChatSessions.length === 0 && (
            <div className="px-8 pt-16 text-center text-[14px] text-zinc-500">
              <h3 className="mb-3 text-[18px] font-bold text-zinc-900">
                {chatListTab === 'mutual' ? '这里还没有互关聊天' : '这里还没有陌生人聊天'}
              </h3>
              <p className="leading-7">
                {chatListTab === 'mutual'
                  ? '当你和论坛网友互相关注后，你们的会话会整理到这里。'
                  : '在论坛里点进网友主页并发起临时单聊后，来自陌生网友的会话会先留在这里。'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-0">
          {notificationItems.map((item) => (
            <NotificationRow
              key={item.notification.id}
              item={item}
              openMessageRowMenuId={openMessageRowMenuId}
              onOpenPost={onOpenNotificationPost}
              onToggleMenu={onToggleMessageRowMenu}
              onRemoveNotification={onRemoveNotification}
            />
          ))}
          {data.myNotifications.length === 0 && (
            <div className="px-8 pt-16 text-center text-[14px] text-zinc-500">
              <Bell size={30} className="mx-auto mb-3 text-zinc-300" />
              <h3 className="mb-2 text-[18px] font-bold text-zinc-900">这里还没有通知</h3>
              <p className="leading-7">等楼里有人来回复你、关注你，或者向你发好友申请时，这里会出现提醒。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React from 'react';

type ForumMessageManageSheetProps = {
  unreadNotificationCount: number;
  unreadChatCount: number;
  strangerChatCount: number;
  onClose: () => void;
  onMarkAllNotificationsRead: () => void;
  onMarkAllChatsRead: () => void;
  onClearStrangerChats: () => void;
  onClearNotifications: () => void;
};

export function ForumMessageManageSheet({
  unreadNotificationCount,
  unreadChatCount,
  strangerChatCount,
  onClose,
  onMarkAllNotificationsRead,
  onMarkAllChatsRead,
  onClearStrangerChats,
  onClearNotifications,
}: ForumMessageManageSheetProps) {
  return (
    <div className="absolute right-4 top-[58px] z-40 w-[260px] rounded-2xl border border-zinc-100 bg-white p-2 shadow-xl">
      <button
        type="button"
        onClick={onClose}
        className="mb-1 block w-full rounded-xl px-3 py-2 text-left text-[13px] font-bold text-zinc-900 transition-colors hover:bg-zinc-50"
      >
        管理消息
      </button>
      <button
        type="button"
        onClick={onMarkAllNotificationsRead}
        className="block w-full rounded-xl px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        全部通知设为已读
        <span className="ml-1 text-zinc-400">({unreadNotificationCount})</span>
      </button>
      <button
        type="button"
        onClick={onMarkAllChatsRead}
        className="block w-full rounded-xl px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        全部聊天设为已读
        <span className="ml-1 text-zinc-400">({unreadChatCount})</span>
      </button>
      <button
        type="button"
        onClick={onClearStrangerChats}
        className="block w-full rounded-xl px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        清空陌生人聊天
        <span className="ml-1 text-zinc-400">({strangerChatCount})</span>
      </button>
      <button
        type="button"
        onClick={onClearNotifications}
        className="block w-full rounded-xl px-3 py-2 text-left text-[13px] text-rose-600 transition-colors hover:bg-rose-50"
      >
        清空全部通知
      </button>
    </div>
  );
}

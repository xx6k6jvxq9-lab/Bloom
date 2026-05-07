import React, { useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ForumTempChatSession } from '../../../types';
import { useKeyboardSafeViewport } from '../../../features/app-shell/useKeyboardSafeViewport';
import { ForumResolvedImage } from './ForumResolvedImage';

type ForumTempChatViewProps = {
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  session: ForumTempChatSession;
  currentUserAvatar: string;
  tempChatInput: string;
  tempChatLoading: boolean;
  onBack: () => void;
  onUpgrade: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  topInsetStyle?: React.CSSProperties;
};

function formatChatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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

function shouldShowTimeDivider(previousTimestamp: number | null, currentTimestamp: number) {
  if (!previousTimestamp) return true;
  return currentTimestamp - previousTimestamp >= 15 * 60 * 1000;
}

export function ForumTempChatView({
  author,
  session,
  currentUserAvatar,
  tempChatInput,
  tempChatLoading,
  onBack,
  onUpgrade,
  onInputChange,
  onSend,
  topInsetStyle,
}: ForumTempChatViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingReply = session.pendingReply;
  const inputLocked = !!pendingReply;
  const sortedMessages = [...session.messages].sort((a, b) => a.timestamp - b.timestamp);
  useKeyboardSafeViewport({
    containerRef,
    enabled: true,
  });

  return (
    <div ref={containerRef} className="bg-white h-full min-h-0 flex flex-col">
      <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 px-4 pb-3 flex items-center justify-between" style={topInsetStyle}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <ForumResolvedImage value={author.avatar} className="w-9 h-9 rounded-full object-cover" />
          <div>
            <div className="text-[15px] font-bold text-zinc-900">{author.name}</div>
            <div className="text-[12px] text-zinc-500">论坛临时单聊</div>
          </div>
        </div>
        {session.friendRequestState === 'sent' && !session.addedAsFriend && (
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-[12px] font-bold text-emerald-700">
            已发好友申请
          </div>
        )}
        {session.addedAsFriend && (
          <button
            onClick={onUpgrade}
            className="rounded-full border border-zinc-200 px-4 py-1.5 text-[12px] font-bold text-zinc-900 hover:bg-zinc-50"
          >
            进入正式单聊
          </button>
        )}
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3"
        style={{
          paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 16px)',
          transition: 'padding-bottom 180ms ease',
        }}
      >
        {sortedMessages.map((message, index) => {
          const isUser = message.role === 'user';
          const previousTimestamp = index > 0 ? sortedMessages[index - 1].timestamp : null;
          const showDivider = shouldShowTimeDivider(previousTimestamp, message.timestamp);
          const readLabel = isUser && message.readAt ? '已读' : '';
          return (
            <React.Fragment key={message.id}>
              {showDivider && (
                <div className="flex justify-center py-1">
                  <div className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] text-zinc-500">
                    {formatRelativeTime(message.timestamp)}
                  </div>
                </div>
              )}
              <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <ForumResolvedImage value={author.avatar} className="h-8 w-8 self-start rounded-full object-cover" />
                )}
                <div className={`max-w-[72%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`rounded-2xl px-4 py-3 text-[14px] leading-6 ${
                    isUser ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-900'
                  }`}>
                    {message.text}
                  </div>
                  <div className={`mt-1 flex items-center gap-1 text-[11px] text-zinc-400 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span>{formatChatTime(message.timestamp)}</span>
                    {readLabel && <span>{readLabel}</span>}
                  </div>
                </div>
                {isUser && (
                  <ForumResolvedImage value={currentUserAvatar} className="h-8 w-8 self-start rounded-full object-cover" />
                )}
              </div>
            </React.Fragment>
          );
        })}
        {pendingReply?.status === 'typing' && (
          <div className="flex justify-start">
            <ForumResolvedImage value={author.avatar} className="mr-2 h-8 w-8 rounded-full object-cover" />
            <div className="max-w-[78%] rounded-2xl bg-zinc-100 px-4 py-3 text-[13px] text-zinc-500">
              对方正在输入...
            </div>
          </div>
        )}
      </div>

      <div
        className="border-t border-zinc-100 px-3 py-2 flex items-center gap-3"
        style={{
          paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 8px)',
        }}
      >
        <ForumResolvedImage value={currentUserAvatar} className="h-8 w-8 rounded-full object-cover" />
        <input
          type="text"
          value={tempChatInput}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={
            pendingReply?.status === 'ghosted'
              ? '对方已读但没有继续回你'
              : inputLocked
                ? '等对方回你之后再继续说'
                : '在论坛里和TA说点什么'
          }
          className="flex-1 bg-transparent text-[14px] outline-none placeholder-zinc-500"
          disabled={inputLocked}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && tempChatInput.trim() && !inputLocked) {
              onSend();
            }
          }}
        />
        <button
          onClick={onSend}
          disabled={!tempChatInput.trim() || tempChatLoading || inputLocked}
          className={`px-4 py-1.5 rounded-full font-bold text-[13px] transition-all ${
            tempChatInput.trim() && !tempChatLoading && !inputLocked
              ? 'border border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
          }`}
        >
          发送
        </button>
      </div>
    </div>
  );
}

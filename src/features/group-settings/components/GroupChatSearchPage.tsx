import { useMemo, useState } from 'react';
import { ChevronLeft, Search, X } from 'lucide-react';
import type { ChatMessage } from '../../../types';
import { searchGroupMessages } from '../searchGroupMessages';

type GroupChatSearchPageProps = {
  groupName: string;
  messages: ChatMessage[];
  onBack: () => void;
  onSelectResult: (result: { timestamp: number; text: string }) => void;
  resolveSenderLabel: (message: ChatMessage) => string;
};

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

export function GroupChatSearchPage({
  groupName,
  messages,
  onBack,
  onSelectResult,
  resolveSenderLabel,
}: GroupChatSearchPageProps) {
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();

  const results = useMemo(
    () => searchGroupMessages(messages, trimmedQuery, resolveSenderLabel),
    [messages, trimmedQuery, resolveSenderLabel],
  );

  return (
    <div className="absolute inset-0 z-[121] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-bold text-zinc-900">查找聊天内容</h2>
          <span className="text-[11px] text-zinc-500">{groupName}</span>
        </div>
      </div>

      <div className="border-b border-zinc-100 bg-white px-4 py-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索当前群聊天记录"
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-3 pl-11 pr-11 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
          />
          {trimmedQuery ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 active:bg-zinc-100"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!trimmedQuery ? (
          <div className="rounded-[28px] bg-white px-6 py-10 text-center text-zinc-500 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
            输入关键词后，会在当前群聊记录里查找相关消息。
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-[28px] bg-white px-6 py-10 text-center text-zinc-500 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
            没有找到包含“{trimmedQuery}”的聊天内容。
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              <button
                key={result.key}
                type="button"
                onClick={() => onSelectResult({
                  timestamp: result.message.timestamp,
                  text: result.message.text,
                })}
                className="rounded-[28px] bg-white px-4 py-4 shadow-[0_8px_32px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate text-[14px] font-medium text-zinc-900">
                    {result.senderLabel}
                  </div>
                  <div className="shrink-0 text-[12px] text-zinc-400">
                    {formatTimestamp(result.message.timestamp)}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-6 text-zinc-600">
                  {result.preview}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

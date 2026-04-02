import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Send, MoreVertical } from 'lucide-react';
import { ChatGroup, Character, ChatMessage, AppSettings } from '../../types';
import { createCharacterDirectory } from '../character-domain/useCharacterDirectory';
import { useGroupChatRuntime } from '../chat-runtime/useGroupChatRuntime';
import { useResolvedPersistentValue } from '../persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';

const formatMessagePreview = (text: string | undefined): string => {
  if (!text) return '';
  if (text.startsWith('[GAME_CARD]')) {
    return '[游戏卡片]';
  }
  return text;
};

function GroupMessageAvatar({
  value,
  fallbackValue,
  alt,
}: {
  value?: string | null;
  fallbackValue?: string | null;
  alt: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const { resolvedUrl: resolvedFallbackUrl } = useResolvedPersistentValue(fallbackValue);
  const src =
    getDisplayableAssetValue(value, resolvedUrl)
    || getDisplayableAssetValue(fallbackValue, resolvedFallbackUrl)
    || null;

  if (!src) {
    return <div className="w-10 h-10 rounded-full bg-zinc-200 shrink-0" aria-label={alt} />;
  }

  return <img src={src} alt={alt} className="w-10 h-10 rounded-full bg-zinc-200 shrink-0 object-cover" />;
}

export function GroupChatSessionScreen({
  group,
  members,
  history,
  setHistory,
  onBack,
  userAvatar,
  userName,
  settings,
}: {
  group: ChatGroup;
  members: Character[];
  history: ChatMessage[];
  setHistory: (h: ChatMessage[]) => void;
  onBack: () => void;
  userAvatar: string;
  userName: string;
  settings: AppSettings;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { getCharacterByName } = createCharacterDirectory({ characters: members });
  const activeConfig = settings.configs.find(c => c.id === settings.activeConfigId) || settings.configs[0];
  const { isLoading, error, sendText } = useGroupChatRuntime({
    members,
    history,
    setHistory,
    input,
    setInput,
    userName,
    activeConfig,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  return (
    <div className="absolute inset-0 bg-zinc-50 flex flex-col z-50">
      <div className="min-h-[64px] pt-12 pb-3 px-4 flex justify-between items-center bg-white border-b border-zinc-100 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[16px] font-bold text-zinc-900">{group.name}</h1>
            <span className="text-[11px] text-zinc-500">{members.length} 人</span>
          </div>
        </div>
        <button className="p-2 text-zinc-400">
          <MoreVertical size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-xl text-[13px] border border-red-100 mb-4">
            {error}
          </div>
        )}
        {history.map((msg, idx) => {
          const isUser = msg.role === 'user';
          let senderName = 'AI';
          let content = formatMessagePreview(msg.text);
          let avatar = '';

          if (!isUser) {
            const match = msg.text.match(/^([^:]+): (.*)/);
            if (match) {
              senderName = match[1];
              content = formatMessagePreview(match[2]);
              const char = getCharacterByName(senderName);
              if (char) avatar = char.avatar;
            }
          }

          return (
            <div key={idx} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
              <GroupMessageAvatar
                value={isUser ? userAvatar : avatar}
                fallbackValue={isUser ? null : 'https://picsum.photos/seed/unknown/200'}
                alt={isUser ? userName : senderName}
              />
              <div className={`max-w-[70%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isUser && <span className="text-[11px] text-zinc-400 mb-1 ml-1">{senderName}</span>}
                <div className={`px-4 py-2.5 rounded-2xl text-[15px] ${
                  isUser
                    ? 'bg-blue-500 text-white rounded-tr-sm'
                    : 'bg-white text-zinc-800 border border-zinc-100 rounded-tl-sm shadow-sm'
                }`}>
                  {content}
                </div>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-100 animate-pulse" />
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-zinc-100 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-75" />
                <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-150" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-zinc-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendText()}
            placeholder="发送消息..."
            className="flex-1 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500"
          />
          <button
            onClick={sendText}
            disabled={!input.trim() || isLoading}
            className="bg-zinc-900 text-white p-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

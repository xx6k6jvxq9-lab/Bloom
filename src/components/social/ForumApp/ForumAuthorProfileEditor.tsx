import React, { useRef } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { useAppKeyboard } from '../../../features/app-shell/AppKeyboardContext';
import { useKeyboardSafeViewport } from '../../../features/app-shell/useKeyboardSafeViewport';
import { ForumResolvedImage } from './ForumResolvedImage';

type ForumAuthorProfileEditorProps = {
  title: string;
  avatar: string;
  displayName: string;
  handle: string;
  bio: string;
  topInsetStyle?: React.CSSProperties;
  onBack: () => void;
  onSave: () => void;
  onChangeDisplayName: (value: string) => void;
  onChangeHandle: (value: string) => void;
  onChangeBio: (value: string) => void;
};

export function ForumAuthorProfileEditor({
  title,
  avatar,
  displayName,
  handle,
  bio,
  topInsetStyle,
  onBack,
  onSave,
  onChangeDisplayName,
  onChangeHandle,
  onChangeBio,
}: ForumAuthorProfileEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { keyboardInset, keyboardVisible: appKeyboardVisible } = useAppKeyboard();
  const { keyboardVisible: ownsFocusedKeyboard } = useKeyboardSafeViewport({
    containerRef,
    enabled: true,
  });

  return (
    <div ref={containerRef} className="bg-white h-full min-h-0 flex flex-col">
      <div className="px-4 pb-3 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10" style={topInsetStyle}>
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-bold text-lg text-zinc-900">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onSave}
          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-4 py-1.5 text-[14px] font-bold text-zinc-900 hover:bg-zinc-200"
        >
          <Check size={16} />
          保存
        </button>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6"
        style={{
          paddingBottom: ownsFocusedKeyboard && appKeyboardVisible && keyboardInset > 0
            ? `${keyboardInset + 16}px`
            : undefined,
          transition: 'padding-bottom 180ms ease',
        }}
      >
        <div className="flex items-center gap-4 rounded-[24px] border border-zinc-100 bg-zinc-50/70 p-4">
          <ForumResolvedImage value={avatar} className="w-16 h-16 rounded-full border-2 border-white object-cover shadow-sm shrink-0" />
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-zinc-900">论坛角色资料</div>
            <div className="mt-1 text-[12px] leading-5 text-zinc-500">
              这里只改这个角色在论坛里的昵称、ID 和简介，不影响角色本体名称。生成过的论坛号会稳定保留，除非你手动改它。
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative border border-zinc-200 rounded-md px-3 py-2 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 transition-all">
            <label className="block text-[12px] text-zinc-500">论坛昵称</label>
            <input
              value={displayName}
              onChange={(event) => onChangeDisplayName(event.target.value)}
              className="w-full bg-transparent text-[14px] text-zinc-900 outline-none"
            />
          </div>
          <div className="relative border border-zinc-200 rounded-md px-3 py-2 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 transition-all">
            <label className="block text-[12px] text-zinc-500">论坛 ID</label>
            <input
              value={handle}
              onChange={(event) => onChangeHandle(event.target.value)}
              className="w-full bg-transparent text-[14px] text-zinc-900 outline-none font-mono"
            />
            <div className="mt-1 text-[11px] text-zinc-400">显示为 @{handle.replace(/^@/, '').trim() || '未设置'}</div>
          </div>
          <div className="relative border border-zinc-200 rounded-md px-3 py-2 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 transition-all">
            <label className="block text-[12px] text-zinc-500">论坛简介</label>
            <textarea
              value={bio}
              onChange={(event) => onChangeBio(event.target.value)}
              className="w-full bg-transparent text-[14px] text-zinc-900 outline-none h-20 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

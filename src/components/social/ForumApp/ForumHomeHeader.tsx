import React from 'react';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import type { ForumSpectatorSettings } from '../../../types';

type ForumHomeHeaderProps = {
  forumBoard: 'public' | 'spectator';
  publicLabel: string;
  publicFilterLabel: string;
  publicBlurb: string;
  spectatorSettings: ForumSpectatorSettings;
  feedRefreshLoading: boolean;
  forumConfigEnabled: boolean;
  onClose: () => void;
  onSwitchBoard: (board: 'public' | 'spectator') => void;
  onRefresh: () => void;
  onOpenFilter: () => void;
  onOpenSpectatorSettings: () => void;
  topInsetStyle?: React.CSSProperties;
};

export function ForumHomeHeader({
  forumBoard,
  publicLabel,
  publicFilterLabel,
  publicBlurb,
  spectatorSettings,
  feedRefreshLoading,
  forumConfigEnabled,
  onClose,
  onSwitchBoard,
  onRefresh,
  onOpenFilter,
  onOpenSpectatorSettings,
  topInsetStyle,
}: ForumHomeHeaderProps) {
  return (
    <div className="bg-white/90 backdrop-blur-md sticky top-0 z-10 border-b border-zinc-100" style={topInsetStyle}>
      <div className="px-4 flex items-center justify-between">
        <button onClick={onClose} className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors">
          <ChevronLeft size={24} className="text-zinc-900" />
        </button>
        <div className="flex gap-6 text-[14px] font-bold">
          <button
            onClick={() => onSwitchBoard('public')}
            className={`relative pb-3 transition-all ${forumBoard === 'public' ? 'text-sky-700' : 'text-zinc-500'}`}
          >
            公共区
            {forumBoard === 'public' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-sky-400" />}
          </button>
          <button
            onClick={() => onSwitchBoard('spectator')}
            className={`relative pb-3 transition-all ${forumBoard === 'spectator' ? 'text-rose-700' : 'text-zinc-500'}`}
          >
            围观
            {forumBoard === 'spectator' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-rose-300" />}
          </button>
        </div>
        <button
          onClick={onRefresh}
          disabled={feedRefreshLoading}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            feedRefreshLoading
              ? 'text-zinc-300'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
          title={forumBoard === 'spectator' ? '补围观帖' : forumConfigEnabled ? '刷新帖子' : '未启用论坛接口'}
        >
          <RefreshCw size={18} className={feedRefreshLoading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="px-4 pb-3">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {forumBoard === 'public' ? (
                  <>
                    <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                      {publicLabel}
                    </span>
                    <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                      {publicFilterLabel}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                      围观板块
                    </span>
                    <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                      {spectatorSettings.tone}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-2 text-[12px] text-zinc-500">
                {forumBoard === 'public'
                  ? publicBlurb
                  : spectatorSettings.relationshipSummary || '把想围观的关系线收在这个板块里，单独发酵。'}
              </div>
            </div>
            <button
              type="button"
              onClick={forumBoard === 'public' ? onOpenFilter : onOpenSpectatorSettings}
              className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              {forumBoard === 'public' ? '筛选' : '设置'}
            </button>
          </div>
          {feedRefreshLoading && forumBoard === 'public' && (
            <div className="mt-2 text-[12px] text-zinc-500">正在补新帖...</div>
          )}
        </div>
      </div>
    </div>
  );
}

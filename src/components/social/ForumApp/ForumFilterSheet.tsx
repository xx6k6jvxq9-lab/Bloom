import React from 'react';
import { FORUM_CHANNEL_TABS, FORUM_FILTER_THREAD_TYPES } from '../../../features/forum-domain/forumPresentation';
import { FORUM_THREAD_TYPE_LABELS } from '../../../features/forum-domain/constants';
import type { ForumChannel, ForumThreadType } from '../../../features/forum-domain/types';
import type { ForumOpenMode } from '../../../services/forum/openForumThreads';

type ForumFilterSheetProps = {
  open: boolean;
  mode: ForumOpenMode;
  selectedChannels: ForumChannel[];
  selectedThreadTypes: ForumThreadType[];
  preferredTopicText: string;
  excludedTopicText: string;
  onClose: () => void;
  onReset: () => void;
  onModeChange: (mode: ForumOpenMode) => void;
  onToggleChannel: (channel: ForumChannel) => void;
  onToggleThreadType: (threadType: ForumThreadType) => void;
  onClearThreadTypeFilter: () => void;
  onPreferredTopicTextChange: (value: string) => void;
  onExcludedTopicTextChange: (value: string) => void;
  onSubmit: () => void;
};

export function ForumFilterSheet({
  open,
  mode,
  selectedChannels,
  selectedThreadTypes,
  preferredTopicText,
  excludedTopicText,
  onClose,
  onReset,
  onModeChange,
  onToggleChannel,
  onToggleThreadType,
  onClearThreadTypeFilter,
  onPreferredTopicTextChange,
  onExcludedTopicTextChange,
  onSubmit,
}: ForumFilterSheetProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="absolute inset-0 z-40 bg-black/35"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 z-50 rounded-t-[28px] bg-white px-4 pb-6 pt-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-200" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[17px] font-bold text-zinc-900">开楼</h3>
            <p className="mt-1 text-[12px] text-zinc-500">
              随机开楼会一次生成 10 帖，普通帖至少一半，新网友占大多数。
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-600 transition-colors hover:bg-zinc-200"
          >
            重置
          </button>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[13px] font-semibold text-zinc-900">模式</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onModeChange('random')}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                mode === 'random'
                  ? 'border-sky-200 bg-sky-50 text-zinc-900'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              <div className="text-[13px] font-semibold">随机开楼</div>
              <div className="mt-1 text-[11px] leading-5 text-zinc-500">
                自动配 10 帖，普通帖保底，新网友为主。
              </div>
            </button>
            <button
              type="button"
              onClick={() => onModeChange('configured')}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                mode === 'configured'
                  ? 'border-sky-200 bg-sky-50 text-zinc-900'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              <div className="text-[13px] font-semibold">按设置开楼</div>
              <div className="mt-1 text-[11px] leading-5 text-zinc-500">
                只按你选中的区域和帖型开。
              </div>
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[13px] font-semibold text-zinc-900">区域</div>
          <div className="flex flex-wrap gap-2">
            {FORUM_CHANNEL_TABS.map((channel) => {
              const selected = selectedChannels.includes(channel.id);
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => onToggleChannel(channel.id)}
                  className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${
                    selected
                      ? 'border-sky-200 bg-sky-50 text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {channel.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[13px] font-semibold text-zinc-900">帖型</div>
            <div className="text-[12px] text-zinc-400">可多选</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClearThreadTypeFilter}
              className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${
                selectedThreadTypes.length === 0
                  ? 'border-sky-200 bg-sky-50 text-zinc-900'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              全部帖型
            </button>
            {FORUM_FILTER_THREAD_TYPES.map((threadType) => {
              const selected = selectedThreadTypes.includes(threadType);
              return (
                <button
                  key={threadType}
                  type="button"
                  onClick={() => onToggleThreadType(threadType)}
                  className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${
                    selected
                      ? 'border-sky-200 bg-sky-50 text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {FORUM_THREAD_TYPE_LABELS[threadType]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[13px] font-semibold text-zinc-900">这轮想看什么</div>
          <textarea
            value={preferredTopicText}
            onChange={(event) => onPreferredTopicTextChange(event.target.value)}
            placeholder="可选：例如 豪门饭局后 / 留学圈冷暴力 / 电竞后台事故"
            className="min-h-20 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[13px] leading-6 text-zinc-900 outline-none transition-colors focus:border-sky-200"
          />
        </div>

        <div className="mt-4">
          <div className="mb-2 text-[13px] font-semibold text-zinc-900">这轮不想看什么</div>
          <textarea
            value={excludedTopicText}
            onChange={(event) => onExcludedTopicTextChange(event.target.value)}
            placeholder="可选：例如 宿舍暧昧 / 老一套道侣味 / 纯泛关系分析"
            className="min-h-20 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[13px] leading-6 text-zinc-900 outline-none transition-colors focus:border-sky-200"
          />
        </div>

        <button
          type="button"
          onClick={onSubmit}
          className="mt-6 w-full rounded-full border border-zinc-200 bg-white py-3 text-[14px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
        >
          开 10 帖
        </button>
      </div>
    </>
  );
}

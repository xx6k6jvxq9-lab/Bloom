import React from 'react';
import { FORUM_CHANNEL_TABS } from '../../../features/forum-domain/forumPresentation';
import type { ForumChannel } from '../../../features/forum-domain/types';

type ForumBrowseFilterSheetProps = {
  open: boolean;
  selectedChannels: ForumChannel[];
  onClose: () => void;
  onReset: () => void;
  onToggleChannel: (channel: ForumChannel) => void;
};

export function ForumBrowseFilterSheet(props: ForumBrowseFilterSheetProps) {
  const { open, selectedChannels, onClose, onReset, onToggleChannel } = props;
  if (!open) return null;

  return (
    <>
      <div className="absolute inset-0 z-40 bg-black/35" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 z-50 rounded-t-[28px] bg-white px-4 pb-6 pt-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-200" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[17px] font-bold text-zinc-900">筛选</h3>
            <p className="mt-1 text-[12px] text-zinc-500">
              默认显示全部帖子；选中某个分区后，只看那个区，不会开新帖。
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
              selectedChannels.length === 0
                ? 'bg-sky-50 text-sky-700'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            全部
          </button>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[13px] font-semibold text-zinc-900">分区查看</div>
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
      </div>
    </>
  );
}

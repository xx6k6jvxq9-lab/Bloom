import { FORUM_CHANNEL_TABS } from '../../features/forum-domain/forumPresentation';
import type { ForumChannel } from '../../features/forum-domain/types';

export function getAllForumChannels(): ForumChannel[] {
  return FORUM_CHANNEL_TABS.map((item) => item.id);
}

export function buildPublicViewSummary(selectedChannels: ForumChannel[]) {
  if (selectedChannels.length === 0) {
    return {
      label: '全部',
      blurb: '正在查看全部公共区帖子',
    };
  }

  if (selectedChannels.length === 1) {
    const matched = FORUM_CHANNEL_TABS.find((item) => item.id === selectedChannels[0]);
    return {
      label: matched?.label || '分区查看',
      blurb: matched?.blurb || '按分区查看帖子',
    };
  }

  return {
    label: `已选${selectedChannels.length}区`,
    blurb: '正在按多个分区查看帖子',
  };
}

export function toggleForumChannelSelection(
  current: ForumChannel[],
  channel: ForumChannel,
): ForumChannel[] {
  return current.includes(channel)
    ? current.filter((item) => item !== channel)
    : [...current, channel];
}

import type { CSSProperties } from 'react';
import type { ForumGlobalSettings, ForumPost, ForumSpectatorSettings, Mask, WorldBookEntry } from '../../../types';
import { ForumSettingsView } from './ForumSettingsView';

type HotFollowupRecord = {
  id: string;
  title: string;
  category?: string;
  hotContinuationCount: number;
  remainingCount: number;
  lastHotContinuationAt?: number;
  lastHotContinuationSource?: 'feed_refresh' | 'detail_refresh';
};

type ForumSettingsRouteProps = {
  handle: string;
  profile: {
    name: string;
    bio?: string;
    avatar: string;
  };
  settings: ForumGlobalSettings;
  posts: ForumPost[];
  spectatorSettings: ForumSpectatorSettings;
  masks: Mask[];
  worldBooks: WorldBookEntry[];
  topInsetStyle?: CSSProperties;
  onBack: () => void;
  onChange: (next: ForumGlobalSettings) => void;
  onEditProfile: () => void;
};

export function ForumSettingsRoute(props: ForumSettingsRouteProps) {
  const {
    handle,
    profile,
    settings,
    posts,
    spectatorSettings,
    masks,
    worldBooks,
    topInsetStyle,
    onBack,
    onChange,
    onEditProfile,
  } = props;

  const hotFollowupUsageCount = posts.reduce((sum, post) => sum + (post.hotContinuationCount || 0), 0);
  const hotFollowupRecords: HotFollowupRecord[] = posts
    .filter((post) => (post.hotContinuationCount || 0) > 0)
    .sort((left, right) => (right.lastHotContinuationAt || 0) - (left.lastHotContinuationAt || 0))
    .map((post) => ({
      id: post.id,
      title: post.title,
      category: post.category,
      hotContinuationCount: post.hotContinuationCount || 0,
      remainingCount: Math.max(0, 3 - (post.hotContinuationCount || 0)),
      lastHotContinuationAt: post.lastHotContinuationAt,
      lastHotContinuationSource: post.lastHotContinuationSource,
    }));

  return (
    <ForumSettingsView
      handle={handle}
      profile={profile}
      settings={settings}
      worldBooks={worldBooks}
      masks={masks}
      worldBookCount={worldBooks.length}
      maskCount={masks.length}
      presetLabels={(spectatorSettings.targetPresets || []).map((item) => item.label)}
      hotFollowupUsageCount={hotFollowupUsageCount}
      hotFollowupRecords={hotFollowupRecords}
      topInsetStyle={topInsetStyle}
      onBack={onBack}
      onChange={onChange}
      onEditProfile={onEditProfile}
    />
  );
}

import { lazy } from 'react';

import {
  loadCoupleSpaceApp,
  loadCustomizationApp,
  loadForumApp,
  loadMonitorApp,
  loadMusicApp,
  loadPerceptionView,
  loadWalletApp,
} from './lazyApps';

const PANEL_PRELOADERS = {
  monitor: loadMonitorApp,
  customization: loadCustomizationApp,
  'couple-space': loadCoupleSpaceApp,
  perception: loadPerceptionView,
  music: loadMusicApp,
  forum: loadForumApp,
  wallet: loadWalletApp,
} as const;

export const PANEL_PRELOAD_LOADERS: Array<() => Promise<unknown>> = [
  PANEL_PRELOADERS['couple-space'],
  PANEL_PRELOADERS.forum,
  PANEL_PRELOADERS.music,
  PANEL_PRELOADERS.wallet,
  PANEL_PRELOADERS.customization,
  PANEL_PRELOADERS.perception,
  PANEL_PRELOADERS.monitor,
];

export function preloadPanelForApp(app: string): Promise<unknown> | null {
  const loader = (PANEL_PRELOADERS as Record<string, (() => Promise<unknown>) | undefined>)[app];
  if (!loader) {
    return null;
  }

  return loader();
}

export const MonitorApp = lazy(loadMonitorApp);
export const CustomizationApp = lazy(loadCustomizationApp);
export const CoupleSpaceApp = lazy(loadCoupleSpaceApp);
export const PerceptionView = lazy(loadPerceptionView);
export const MusicApp = lazy(loadMusicApp);
export const ForumApp = lazy(loadForumApp);
export const WalletApp = lazy(loadWalletApp);

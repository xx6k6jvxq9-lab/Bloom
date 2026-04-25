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

export const PANEL_PRELOAD_LOADERS: Array<() => Promise<unknown>> = [];

export const MonitorApp = lazy(loadMonitorApp);
export const CustomizationApp = lazy(loadCustomizationApp);
export const CoupleSpaceApp = lazy(loadCoupleSpaceApp);
export const PerceptionView = lazy(loadPerceptionView);
export const MusicApp = lazy(loadMusicApp);
export const ForumApp = lazy(loadForumApp);
export const WalletApp = lazy(loadWalletApp);

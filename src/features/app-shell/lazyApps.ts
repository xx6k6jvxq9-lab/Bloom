export const loadMonitorApp = () =>
  import('../../components/monitor/MonitorApp/Page').then((module) => ({ default: module.MonitorApp }));

export const loadCustomizationApp = () =>
  import('../../components/customization/CustomizationApp/Page').then((module) => ({
    default: module.CustomizationApp,
  }));

export const loadCoupleSpaceApp = () =>
  import('../../components/couple-space/CoupleSpaceApp/Page').then((module) => ({
    default: module.CoupleSpaceApp,
  }));

export const loadPerceptionView = () =>
  import('../../components/couple-space/PerceptionView').then((module) => ({
    default: module.PerceptionView,
  }));

export const loadMusicApp = () => import('../../components/media/MusicApp');
export const loadForumApp = () => import('../../components/social/ForumApp/Page');
export const loadWalletApp = () => import('../../components/wallet/WalletApp/Page');

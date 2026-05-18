const CHUNK_RELOAD_ONCE_KEY = 'app:chunk-reload-once';
const CHUNK_RETRY_DELAY_MS = 140;

function shouldRecoverChunkLoadError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(error.message);
}

function clearChunkReloadFlag() {
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(CHUNK_RELOAD_ONCE_KEY);
  }
}

async function loadWithChunkRecovery<T>(loader: () => Promise<T>) {
  try {
    const module = await loader();
    clearChunkReloadFlag();
    return module;
  } catch (error) {
    const isRecoverableChunkError = shouldRecoverChunkLoadError(error);
    if (!isRecoverableChunkError) {
      clearChunkReloadFlag();
      throw error;
    }

    try {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, CHUNK_RETRY_DELAY_MS);
      });
      const recoveredModule = await loader();
      clearChunkReloadFlag();
      return recoveredModule;
    } catch (retryError) {
      if (
        typeof window !== 'undefined'
        && typeof sessionStorage !== 'undefined'
        && sessionStorage.getItem(CHUNK_RELOAD_ONCE_KEY) !== '1'
      ) {
        sessionStorage.setItem(CHUNK_RELOAD_ONCE_KEY, '1');
        window.location.reload();
        return new Promise<T>(() => {});
      }

      clearChunkReloadFlag();
      throw retryError;
    }
  }
}

export const loadMonitorApp = () =>
  loadWithChunkRecovery(() =>
    import('../../components/monitor/MonitorApp/Page').then((module) => ({ default: module.MonitorApp })),
  );

export const loadCustomizationApp = () =>
  loadWithChunkRecovery(() =>
    import('../../components/customization/CustomizationApp/Page').then((module) => ({
      default: module.CustomizationApp,
    })),
  );

export const loadCoupleSpaceApp = () =>
  loadWithChunkRecovery(() =>
    import('../../components/couple-space/CoupleSpaceApp/Page').then((module) => ({
      default: module.CoupleSpaceApp,
    })),
  );

export const loadPerceptionView = () =>
  loadWithChunkRecovery(() =>
    import('../../components/couple-space/PerceptionView').then((module) => ({
      default: module.PerceptionView,
    })),
  );

export const loadMomentsApp = () =>
  loadWithChunkRecovery(() =>
    import('../../components/moments/Page').then((module) => ({
      default: module.MomentsApp,
    })),
  );

export const loadChatSessionMount = () =>
  loadWithChunkRecovery(() =>
    import('../chat-session/ChatSessionMount').then((module) => ({
      default: module.ChatSessionMount,
    })),
  );

export const loadDreamAppPage = () =>
  loadWithChunkRecovery(() =>
    import('../../components/dream/Page').then((module) => ({
      default: module.DreamAppPage,
    })),
  );

export const loadWorldBookManager = () =>
  loadWithChunkRecovery(() =>
    import('../../components/main/WorldBookManager').then((module) => ({
      default: module.WorldBookManager,
    })),
  );

export const loadSettingsAppScreen = () =>
  loadWithChunkRecovery(() =>
    import('../../components/settings/SettingsApp').then((module) => ({
      default: module.SettingsApp,
    })),
  );

export const loadMusicApp = () => loadWithChunkRecovery(() => import('../../components/media/MusicApp'));
export const loadForumApp = () => loadWithChunkRecovery(() => import('../../components/social/ForumApp/Page'));
export const loadWalletApp = () => loadWithChunkRecovery(() => import('../../components/wallet/WalletApp/Page'));
export const loadMallApp = () => loadWithChunkRecovery(() => import('../../components/mall/MallApp/Page'));

export function preloadAppScreen(app: string): Promise<unknown> | null {
  switch (app) {
    case 'chat':
      return null;
    case 'chat-session':
    case 'group-chat-session':
      return loadChatSessionMount();
    case 'dream':
      return loadDreamAppPage();
    case 'worldbook':
      return loadWorldBookManager();
    case 'settings':
      return loadSettingsAppScreen();
    case 'monitor':
      return loadMonitorApp();
    case 'customization':
      return loadCustomizationApp();
    case 'couple-space':
      return loadCoupleSpaceApp();
    case 'perception':
      return loadPerceptionView();
    case 'music':
      return loadMusicApp();
    case 'forum':
      return loadForumApp();
    case 'wallet':
      return loadWalletApp();
    case 'mall':
      return loadMallApp();
    default:
      return null;
  }
}

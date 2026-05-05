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

export const loadMusicApp = () => loadWithChunkRecovery(() => import('../../components/media/MusicApp'));
export const loadForumApp = () => loadWithChunkRecovery(() => import('../../components/social/ForumApp/Page'));
export const loadWalletApp = () => loadWithChunkRecovery(() => import('../../components/wallet/WalletApp/Page'));

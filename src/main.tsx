import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

type BootWindow = Window & {
  __BLOOM_BOOTED__?: boolean;
  __BLOOM_BOOT_ENTRY_STARTED__?: boolean;
  __BLOOM_BOOT_ERROR_TIMEOUT__?: number;
  __BLOOM_SHOW_BOOT_FALLBACK__?: (reason?: string) => void;
  __BLOOM_HIDE_BOOT_FALLBACK__?: () => void;
};

const bootWindow = window as BootWindow;
const BOOT_RECOVERY_QUERY_PARAM = 'bloom_boot_retry';
const BOOT_RECOVERY_STORAGE_KEY_PREFIX = 'bloom-boot-recovery:';

bootWindow.__BLOOM_BOOT_ENTRY_STARTED__ = true;

const rootElement = document.getElementById('root');

if (!rootElement) {
  bootWindow.__BLOOM_SHOW_BOOT_FALLBACK__?.('应用入口节点缺失');
  throw new Error('Root element #root was not found.');
}

const clearBootRecoveryState = () => {
  try {
    window.sessionStorage.removeItem(BOOT_RECOVERY_STORAGE_KEY_PREFIX + window.location.pathname);
  } catch (_error) {}

  try {
    const nextUrl = new URL(window.location.href);
    if (!nextUrl.searchParams.has(BOOT_RECOVERY_QUERY_PARAM)) {
      return;
    }

    nextUrl.searchParams.delete(BOOT_RECOVERY_QUERY_PARAM);
    window.history.replaceState(
      window.history.state,
      document.title,
      nextUrl.pathname + nextUrl.search + nextUrl.hash,
    );
  } catch (_error) {}
};

const markBooted = () => {
  bootWindow.__BLOOM_BOOTED__ = true;
  if (typeof bootWindow.__BLOOM_BOOT_ERROR_TIMEOUT__ === 'number') {
    window.clearTimeout(bootWindow.__BLOOM_BOOT_ERROR_TIMEOUT__);
  }

  clearBootRecoveryState();
  bootWindow.__BLOOM_HIDE_BOOT_FALLBACK__?.();
};

function BootReadySignal() {
  useEffect(() => {
    markBooted();
  }, []);

  return null;
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <BootReadySignal />
      <App />
    </StrictMode>,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  bootWindow.__BLOOM_SHOW_BOOT_FALLBACK__?.(message);
  throw error;
}

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
bootWindow.__BLOOM_BOOT_ENTRY_STARTED__ = true;

const rootElement = document.getElementById('root');

if (!rootElement) {
  bootWindow.__BLOOM_SHOW_BOOT_FALLBACK__?.('应用入口节点缺失');
  throw new Error('Root element #root was not found.');
}

const markBooted = () => {
  bootWindow.__BLOOM_BOOTED__ = true;
  if (typeof bootWindow.__BLOOM_BOOT_ERROR_TIMEOUT__ === 'number') {
    window.clearTimeout(bootWindow.__BLOOM_BOOT_ERROR_TIMEOUT__);
  }

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

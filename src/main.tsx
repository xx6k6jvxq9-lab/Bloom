import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

type BootWindow = Window & {
  __BLOOM_BOOTED__?: boolean;
  __BLOOM_BOOT_ERROR_TIMEOUT__?: number;
  __BLOOM_SHOW_BOOT_FALLBACK__?: (reason?: string) => void;
};

const bootWindow = window as BootWindow;
const rootElement = document.getElementById('root');

if (!rootElement) {
  bootWindow.__BLOOM_SHOW_BOOT_FALLBACK__?.('应用入口节点缺失');
  throw new Error('Root element #root was not found.');
}

const hideBootFallback = () => {
  bootWindow.__BLOOM_BOOTED__ = true;
  if (typeof bootWindow.__BLOOM_BOOT_ERROR_TIMEOUT__ === 'number') {
    window.clearTimeout(bootWindow.__BLOOM_BOOT_ERROR_TIMEOUT__);
  }

  document.getElementById('boot-fallback')?.setAttribute('hidden', '');
};

const scheduleBootCheck = () => {
  if (rootElement.childNodes.length > 0) {
    hideBootFallback();
    return;
  }

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(scheduleBootCheck);
    return;
  }

  window.setTimeout(scheduleBootCheck, 16);
};

try {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  scheduleBootCheck();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  bootWindow.__BLOOM_SHOW_BOOT_FALLBACK__?.(message);
  throw error;
}

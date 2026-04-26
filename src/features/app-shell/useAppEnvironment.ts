import { useEffect, useRef, useState } from 'react';
import type { IdleWindow } from './appShellTypes';
import { PANEL_PRELOAD_LOADERS } from './lazyPanels';

const DESKTOP_STAGE_MEDIA_QUERY = '(min-width: 768px) and (hover: hover) and (pointer: fine)';

type UseAppEnvironmentResult = {
  time: string;
  useDesktopStageLayout: boolean;
};

export function useAppEnvironment(): UseAppEnvironmentResult {
  const [time, setTime] = useState('');
  const hasPrefetchedPanelChunksRef = useRef(false);
  const [useDesktopStageLayout, setUseDesktopStageLayout] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(DESKTOP_STAGE_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    const isAndroid = /Android/i.test(window.navigator.userAgent || '');
    if (isAndroid) {
      root.setAttribute('data-android', 'true');
    } else {
      root.removeAttribute('data-android');
    }

    const updateViewportHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty('--app-viewport-height', `${Math.round(viewportHeight)}px`);
    };

    updateViewportHeight();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', updateViewportHeight);
    viewport?.addEventListener('scroll', updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);

    return () => {
      viewport?.removeEventListener('resize', updateViewportHeight);
      viewport?.removeEventListener('scroll', updateViewportHeight);
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      root.style.removeProperty('--app-viewport-height');
      root.removeAttribute('data-android');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || hasPrefetchedPanelChunksRef.current) {
      return undefined;
    }

    const idleWindow = window as IdleWindow;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isIosLike = /iphone|ipad|ipod/.test(userAgent);
    const preloadDelayMs = isIosLike && isStandalone ? 3200 : 900;
    const idleTimeoutMs = isIosLike && isStandalone ? 4000 : 1800;

    if (!isStandalone && !isIosLike) {
      return undefined;
    }

    hasPrefetchedPanelChunksRef.current = true;
    let cancelled = false;
    let fallbackHandle: number | null = null;

    const preloadHighTrafficPanels = async () => {
      for (const loadPanel of PANEL_PRELOAD_LOADERS) {
        if (cancelled) {
          return;
        }

        try {
          await loadPanel();
        } catch (error) {
          console.warn('Panel preload failed', error);
        }
      }
    };

    const schedulePreload = () => {
      fallbackHandle = window.setTimeout(() => {
        if (!cancelled) {
          void preloadHighTrafficPanels();
        }
      }, preloadDelayMs);
    };

    let idleHandle: number | null = null;
    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleHandle = idleWindow.requestIdleCallback(schedulePreload, { timeout: idleTimeoutMs });
    } else {
      schedulePreload();
    }

    return () => {
      cancelled = true;
      if (fallbackHandle !== null) {
        window.clearTimeout(fallbackHandle);
      }
      if (idleHandle !== null && typeof idleWindow.cancelIdleCallback === 'function') {
        idleWindow.cancelIdleCallback(idleHandle);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(DESKTOP_STAGE_MEDIA_QUERY);
    const updateDesktopStageLayout = () => setUseDesktopStageLayout(media.matches);
    updateDesktopStageLayout();
    media.addEventListener?.('change', updateDesktopStageLayout);
    window.addEventListener('resize', updateDesktopStageLayout);

    return () => {
      media.removeEventListener?.('change', updateDesktopStageLayout);
      window.removeEventListener('resize', updateDesktopStageLayout);
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    time,
    useDesktopStageLayout,
  };
}

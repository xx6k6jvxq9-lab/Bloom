import { useEffect, useRef, useState } from 'react';
import type { IdleWindow } from './appShellTypes';
import { setAppKeyboardState } from './AppKeyboardContext';
import { PANEL_PRELOAD_LOADERS } from './lazyPanels';

const DESKTOP_STAGE_MEDIA_QUERY = '(min-width: 768px) and (hover: hover) and (pointer: fine)';

type UseAppEnvironmentResult = {
  isStandalone: boolean;
  keyboardInset: number;
  keyboardVisible: boolean;
  layoutViewportHeight: number;
  manualKeyboardAvoidanceEnabled: boolean;
  time: string;
  useDesktopStageLayout: boolean;
  visualViewportHeight: number;
};

export function useAppEnvironment(): UseAppEnvironmentResult {
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [layoutViewportHeight, setLayoutViewportHeight] = useState(0);
  const [manualKeyboardAvoidanceEnabled, setManualKeyboardAvoidanceEnabled] = useState(false);
  const [time, setTime] = useState('');
  const [isStandalone, setIsStandalone] = useState(false);
  const hasPrefetchedPanelChunksRef = useRef(false);
  const [useDesktopStageLayout, setUseDesktopStageLayout] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(DESKTOP_STAGE_MEDIA_QUERY).matches;
  });
  const [visualViewportHeight, setVisualViewportHeight] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAndroid = /Android/i.test(window.navigator.userAgent || '');
    const isIosLike = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const manualKeyboardAvoidanceEnabled = isStandalone;
    setIsStandalone(isStandalone);
    setManualKeyboardAvoidanceEnabled(manualKeyboardAvoidanceEnabled);
    if (isAndroid) {
      root.setAttribute('data-android', 'true');
    } else {
      root.removeAttribute('data-android');
    }
    if (isStandalone) {
      root.setAttribute('data-standalone', 'true');
    } else {
      root.removeAttribute('data-standalone');
    }

    const updateViewportHeight = () => {
      const layoutViewportHeight = window.innerHeight;
      const viewport = window.visualViewport;
      const visualViewportHeight = viewport?.height ?? layoutViewportHeight;
      const keyboardInset = Math.max(0, Math.round(layoutViewportHeight - visualViewportHeight - (viewport?.offsetTop ?? 0)));
      const keyboardVisible = keyboardInset > 120;
      setLayoutViewportHeight(Math.round(layoutViewportHeight));
      setVisualViewportHeight(Math.round(visualViewportHeight));
      setKeyboardInset(keyboardInset);
      setKeyboardVisible(keyboardVisible);
      setAppKeyboardState({
        keyboardInset,
        keyboardVisible,
        layoutViewportHeight: Math.round(layoutViewportHeight),
        manualKeyboardAvoidanceEnabled,
        visualViewportHeight: Math.round(visualViewportHeight),
      });

      // The shell itself should keep the stable layout viewport height. The
      // visible viewport and keyboard inset are published separately so input
      // bars can move without collapsing the whole page into half-height.
      root.style.setProperty('--app-layout-viewport-height', `${Math.round(layoutViewportHeight)}px`);
      root.style.setProperty('--app-viewport-height', `${Math.round(layoutViewportHeight)}px`);
      root.style.setProperty('--app-visible-viewport-height', `${Math.round(visualViewportHeight)}px`);
      root.style.setProperty('--app-keyboard-inset', `${keyboardInset}px`);
      if (keyboardVisible) {
        root.setAttribute('data-keyboard-open', 'true');
      } else {
        root.removeAttribute('data-keyboard-open');
      }
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
      root.style.removeProperty('--app-layout-viewport-height');
      root.style.removeProperty('--app-viewport-height');
      root.style.removeProperty('--app-visible-viewport-height');
      root.style.removeProperty('--app-keyboard-inset');
      root.removeAttribute('data-android');
      root.removeAttribute('data-keyboard-open');
      root.removeAttribute('data-standalone');
      setAppKeyboardState({
        keyboardInset: 0,
        keyboardVisible: false,
        layoutViewportHeight: 0,
        manualKeyboardAvoidanceEnabled: false,
        visualViewportHeight: 0,
      });
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
    isStandalone,
    keyboardInset,
    keyboardVisible,
    layoutViewportHeight,
    manualKeyboardAvoidanceEnabled,
    time,
    useDesktopStageLayout,
    visualViewportHeight,
  };
}

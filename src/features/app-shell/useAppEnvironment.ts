import { useEffect, useRef, useState } from 'react';
import type { IdleWindow } from './appShellTypes';
import { setAppKeyboardState } from './AppKeyboardContext';
import { isTextEntryElement } from './keyboardUtils';
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
    const hasTouchMacUa = userAgent.includes('macintosh') && (window.navigator.maxTouchPoints || 0) > 1;
    const isAndroid = /Android/i.test(window.navigator.userAgent || '');
    const isIosLike = /iphone|ipad|ipod/.test(userAgent) || hasTouchMacUa;
    let stableLayoutViewportHeight = 0;
    let lastInnerWidth = window.innerWidth;
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    // Match the last known-good split:
    // - iOS browser mode follows the browser-driven viewport on its own.
    // - iOS standalone and Android browsers (for example Via) still need the
    //   manual composer lift path.
    const manualKeyboardAvoidanceEnabled = isStandalone || isAndroid;
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
      const viewport = window.visualViewport;
      const currentInnerHeight = Math.round(window.innerHeight);
      const currentInnerWidth = window.innerWidth;
      const visualViewportHeight = Math.round(viewport?.height ?? currentInnerHeight);
      const viewportOffsetTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const activeElement = document.activeElement;
      const hasTextEntryFocus = isTextEntryElement(activeElement);

      let resolvedLayoutViewportHeight = currentInnerHeight;
      let resolvedKeyboardInset = 0;
      let resolvedKeyboardVisible = false;

      if (isAndroid) {
        let nextStableLayoutViewportHeight = stableLayoutViewportHeight;

        if (
          nextStableLayoutViewportHeight === 0
          || currentInnerWidth !== lastInnerWidth
          || currentInnerHeight > nextStableLayoutViewportHeight
        ) {
          nextStableLayoutViewportHeight = currentInnerHeight;
        }

        const viewportHeightDelta = Math.max(0, nextStableLayoutViewportHeight - visualViewportHeight);
        const innerHeightInset = Math.max(0, nextStableLayoutViewportHeight - currentInnerHeight);
        const viewportSettled = viewportHeightDelta <= 24 && viewportOffsetTop === 0;
        resolvedKeyboardInset = Math.max(
          0,
          Math.round(
            Math.max(
              nextStableLayoutViewportHeight - visualViewportHeight - viewportOffsetTop,
              innerHeightInset,
            ),
          ),
        );
        resolvedKeyboardVisible = hasTextEntryFocus && (
          resolvedKeyboardInset > 120
          || viewportHeightDelta > 120
          || innerHeightInset > 120
        );

        if (!resolvedKeyboardVisible && viewportSettled) {
          nextStableLayoutViewportHeight = currentInnerHeight;
        }

        stableLayoutViewportHeight = nextStableLayoutViewportHeight;
        resolvedLayoutViewportHeight = nextStableLayoutViewportHeight;
      } else {
        // iOS should follow the browser-driven viewport like yesterday's
        // working behavior instead of keeping a synthetic stable layout height.
        resolvedKeyboardInset = Math.max(
          0,
          Math.round(currentInnerHeight - visualViewportHeight - viewportOffsetTop),
        );
        resolvedKeyboardVisible = hasTextEntryFocus && (
          resolvedKeyboardInset > 120
          || currentInnerHeight - visualViewportHeight > 120
          || (isIosLike && viewportOffsetTop > 0)
        );
        stableLayoutViewportHeight = 0;
        resolvedLayoutViewportHeight = currentInnerHeight;
      }

      lastInnerWidth = currentInnerWidth;

      setLayoutViewportHeight(resolvedLayoutViewportHeight);
      setVisualViewportHeight(visualViewportHeight);
      setKeyboardInset(resolvedKeyboardInset);
      setKeyboardVisible(resolvedKeyboardVisible);
      setAppKeyboardState({
        keyboardInset: resolvedKeyboardInset,
        keyboardVisible: resolvedKeyboardVisible,
        layoutViewportHeight: resolvedLayoutViewportHeight,
        manualKeyboardAvoidanceEnabled,
        visualViewportHeight,
      });

      root.style.setProperty('--app-layout-viewport-height', `${resolvedLayoutViewportHeight}px`);
      root.style.setProperty('--app-viewport-height', `${resolvedLayoutViewportHeight}px`);
      root.style.setProperty('--app-visible-viewport-height', `${visualViewportHeight}px`);
      root.style.setProperty('--app-keyboard-inset', `${resolvedKeyboardInset}px`);
      if (resolvedKeyboardVisible) {
        root.setAttribute('data-keyboard-open', 'true');
      } else {
        root.removeAttribute('data-keyboard-open');
      }
    };
    const scheduleViewportHeightUpdate = () => {
      window.requestAnimationFrame(updateViewportHeight);
    };

    updateViewportHeight();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', updateViewportHeight);
    viewport?.addEventListener('scroll', updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);
    document.addEventListener('focusin', scheduleViewportHeightUpdate, true);
    document.addEventListener('focusout', scheduleViewportHeightUpdate, true);

    return () => {
      viewport?.removeEventListener('resize', updateViewportHeight);
      viewport?.removeEventListener('scroll', updateViewportHeight);
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      document.removeEventListener('focusin', scheduleViewportHeightUpdate, true);
      document.removeEventListener('focusout', scheduleViewportHeightUpdate, true);
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
    if (
      typeof window === 'undefined'
      || hasPrefetchedPanelChunksRef.current
      || PANEL_PRELOAD_LOADERS.length === 0
    ) {
      return undefined;
    }

    const idleWindow = window as IdleWindow;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isIosLike = /iphone|ipad|ipod/.test(userAgent);
    const preloadDelayMs = isIosLike && isStandalone ? 3200 : isStandalone ? 900 : 1200;
    const idleTimeoutMs = isIosLike && isStandalone ? 4000 : isStandalone ? 1800 : 2200;

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

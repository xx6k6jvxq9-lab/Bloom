import { useEffect, useRef, useState } from 'react';
import type { IdleWindow } from './appShellTypes';
import { setAppKeyboardState } from './AppKeyboardContext';
import { isTextEntryElement } from './keyboardUtils';
import { PANEL_PRELOAD_LOADERS } from './lazyPanels';

const DESKTOP_STAGE_MEDIA_QUERY = '(min-width: 768px) and (hover: hover) and (pointer: fine)';

function getMediaQueryList(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  try {
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

function matchesMediaQuery(query: string): boolean {
  return getMediaQueryList(query)?.matches ?? false;
}

function addMediaQueryChangeListener(media: MediaQueryList, listener: () => void): () => void {
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }

  if (typeof media.addListener === 'function') {
    media.addListener(listener);
    return () => media.removeListener(listener);
  }

  return () => undefined;
}

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
    return matchesMediaQuery(DESKTOP_STAGE_MEDIA_QUERY);
  });
  const [visualViewportHeight, setVisualViewportHeight] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    type ViewportSnapshot = {
      activeViewportHeight: number;
      keyboardInset: number;
      keyboardVisible: boolean;
      layoutViewportHeight: number;
      visualViewportHeight: number;
    };

    const root = document.documentElement;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const hasTouchMacUa = userAgent.includes('macintosh') && (window.navigator.maxTouchPoints || 0) > 1;
    const isAndroid = /Android/i.test(window.navigator.userAgent || '');
    const isIosLike = /iphone|ipad|ipod/.test(userAgent) || hasTouchMacUa;
    let stableLayoutViewportHeight = 0;
    let lastInnerWidth = window.innerWidth;
    let lastAppliedSnapshot: ViewportSnapshot | null = null;
    let scheduledViewportUpdateHandle: number | null = null;
    let scheduledWithAnimationFrame = false;
    let disposed = false;
    const standaloneMedia = getMediaQueryList('(display-mode: standalone)');
    const isStandalone =
      (standaloneMedia?.matches ?? false) ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    // The app now lets the browser / standalone shell own keyboard viewport
    // changes on every platform. The old manual lift path was creating the
    // repeated white gaps, header drift, and duplicated bottom spacing.
    const manualKeyboardAvoidanceEnabled = false;
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

    const applyViewportSnapshot = (nextSnapshot: ViewportSnapshot) => {
      const previousSnapshot = lastAppliedSnapshot;

      if (!previousSnapshot || previousSnapshot.layoutViewportHeight !== nextSnapshot.layoutViewportHeight) {
        setLayoutViewportHeight(nextSnapshot.layoutViewportHeight);
        root.style.setProperty('--app-layout-viewport-height', `${nextSnapshot.layoutViewportHeight}px`);
        root.style.setProperty('--app-viewport-height', `${nextSnapshot.layoutViewportHeight}px`);
      }

      if (!previousSnapshot || previousSnapshot.activeViewportHeight !== nextSnapshot.activeViewportHeight) {
        root.style.setProperty('--app-active-viewport-height', `${nextSnapshot.activeViewportHeight}px`);
      }

      if (!previousSnapshot || previousSnapshot.visualViewportHeight !== nextSnapshot.visualViewportHeight) {
        setVisualViewportHeight(nextSnapshot.visualViewportHeight);
        root.style.setProperty('--app-visible-viewport-height', `${nextSnapshot.visualViewportHeight}px`);
      }

      if (!previousSnapshot || previousSnapshot.keyboardInset !== nextSnapshot.keyboardInset) {
        setKeyboardInset(nextSnapshot.keyboardInset);
        root.style.setProperty('--app-keyboard-inset', `${nextSnapshot.keyboardInset}px`);
      }

      if (!previousSnapshot || previousSnapshot.keyboardVisible !== nextSnapshot.keyboardVisible) {
        setKeyboardVisible(nextSnapshot.keyboardVisible);
        if (nextSnapshot.keyboardVisible) {
          root.setAttribute('data-keyboard-open', 'true');
        } else {
          root.removeAttribute('data-keyboard-open');
        }
      }

      if (
        !previousSnapshot
        || previousSnapshot.keyboardInset !== nextSnapshot.keyboardInset
        || previousSnapshot.keyboardVisible !== nextSnapshot.keyboardVisible
        || previousSnapshot.layoutViewportHeight !== nextSnapshot.layoutViewportHeight
        || previousSnapshot.visualViewportHeight !== nextSnapshot.visualViewportHeight
      ) {
        setAppKeyboardState({
          keyboardInset: nextSnapshot.keyboardInset,
          keyboardVisible: nextSnapshot.keyboardVisible,
          layoutViewportHeight: nextSnapshot.layoutViewportHeight,
          manualKeyboardAvoidanceEnabled,
          visualViewportHeight: nextSnapshot.visualViewportHeight,
        });
      }

      lastAppliedSnapshot = nextSnapshot;
    };

    const readViewportSnapshot = (): ViewportSnapshot => {
      const viewport = window.visualViewport;
      const currentInnerHeight = Math.round(window.innerHeight);
      const currentInnerWidth = window.innerWidth;
      const visualViewportHeight = Math.round(viewport?.height ?? currentInnerHeight);
      const viewportOffsetTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const rawViewportBottomInset = Math.max(
        0,
        Math.round(currentInnerHeight - visualViewportHeight - viewportOffsetTop),
      );
      const activeElement = document.activeElement;
      const hasTextEntryFocus = isTextEntryElement(activeElement);
      if (
        stableLayoutViewportHeight === 0
        || currentInnerWidth !== lastInnerWidth
        || currentInnerHeight > stableLayoutViewportHeight
      ) {
        stableLayoutViewportHeight = currentInnerHeight;
      }

      const resolvedLayoutViewportHeight = stableLayoutViewportHeight || currentInnerHeight;
      const viewportHeightDelta = Math.max(0, resolvedLayoutViewportHeight - visualViewportHeight);
      const detectedKeyboardInset = hasTextEntryFocus
        ? Math.max(rawViewportBottomInset, viewportHeightDelta)
        : 0;
      const resolvedKeyboardVisible = hasTextEntryFocus && (
        detectedKeyboardInset > 120
        || viewportHeightDelta > 120
        || (isIosLike && viewportOffsetTop > 0)
      );
      const resolvedKeyboardInset = resolvedKeyboardVisible ? detectedKeyboardInset : 0;

      lastInnerWidth = currentInnerWidth;

      // On iOS standalone, window.innerHeight can stay larger than the
      // actually visible viewport, which makes bottom-anchored UI float up.
      // Use the visual viewport bottom edge there so docks/tab bars align to
      // the real screen bottom.
      const activeViewportHeight = isStandalone
        ? Math.max(0, Math.round(visualViewportHeight + viewportOffsetTop))
        : resolvedLayoutViewportHeight;

      return {
        activeViewportHeight,
        keyboardInset: resolvedKeyboardInset,
        keyboardVisible: resolvedKeyboardVisible,
        layoutViewportHeight: resolvedLayoutViewportHeight,
        visualViewportHeight,
      };
    };

    const updateViewportHeight = () => {
      if (disposed) {
        return;
      }

      applyViewportSnapshot(readViewportSnapshot());
    };

    const cancelScheduledViewportHeightUpdate = () => {
      if (scheduledViewportUpdateHandle === null) {
        return;
      }

      if (scheduledWithAnimationFrame && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(scheduledViewportUpdateHandle);
      } else {
        window.clearTimeout(scheduledViewportUpdateHandle);
      }

      scheduledViewportUpdateHandle = null;
      scheduledWithAnimationFrame = false;
    };

    const scheduleViewportHeightUpdate = () => {
      if (disposed || scheduledViewportUpdateHandle !== null) {
        return;
      }

      // Keyboard animations can emit a burst of viewport events. Coalescing
      // them to one measurement per frame keeps the global keyboard state
      // stable without touching the text input event flow itself.
      if (typeof window.requestAnimationFrame === 'function') {
        scheduledWithAnimationFrame = true;
        scheduledViewportUpdateHandle = window.requestAnimationFrame(() => {
          scheduledViewportUpdateHandle = null;
          scheduledWithAnimationFrame = false;
          updateViewportHeight();
        });
        return;
      }

      scheduledWithAnimationFrame = false;
      scheduledViewportUpdateHandle = window.setTimeout(() => {
        scheduledViewportUpdateHandle = null;
        updateViewportHeight();
      }, 16);
    };

    updateViewportHeight();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', scheduleViewportHeightUpdate);
    viewport?.addEventListener('scroll', scheduleViewportHeightUpdate);
    window.addEventListener('resize', scheduleViewportHeightUpdate);
    window.addEventListener('orientationchange', scheduleViewportHeightUpdate);
    document.addEventListener('focusin', scheduleViewportHeightUpdate, true);
    document.addEventListener('focusout', scheduleViewportHeightUpdate, true);

    return () => {
      disposed = true;
      cancelScheduledViewportHeightUpdate();
      viewport?.removeEventListener('resize', scheduleViewportHeightUpdate);
      viewport?.removeEventListener('scroll', scheduleViewportHeightUpdate);
      window.removeEventListener('resize', scheduleViewportHeightUpdate);
      window.removeEventListener('orientationchange', scheduleViewportHeightUpdate);
      document.removeEventListener('focusin', scheduleViewportHeightUpdate, true);
      document.removeEventListener('focusout', scheduleViewportHeightUpdate, true);
      root.style.removeProperty('--app-layout-viewport-height');
      root.style.removeProperty('--app-active-viewport-height');
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
    const standaloneMedia = getMediaQueryList('(display-mode: standalone)');
    const isStandalone =
      (standaloneMedia?.matches ?? false) ||
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

    const media = getMediaQueryList(DESKTOP_STAGE_MEDIA_QUERY);
    const updateDesktopStageLayout = () => setUseDesktopStageLayout(media?.matches ?? false);
    updateDesktopStageLayout();
    const removeMediaListener = media ? addMediaQueryChangeListener(media, updateDesktopStageLayout) : () => undefined;
    window.addEventListener('resize', updateDesktopStageLayout);

    return () => {
      removeMediaListener();
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

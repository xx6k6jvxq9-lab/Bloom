import { useEffect, useRef, useState } from 'react';
import type { IdleWindow } from './appShellTypes';
import { PANEL_PRELOAD_LOADERS } from './lazyPanels';

const DESKTOP_STAGE_MEDIA_QUERY = '(min-width: 768px) and (hover: hover) and (pointer: fine)';

type UseAppEnvironmentResult = {
  isStandalone: boolean;
  time: string;
  useDesktopStageLayout: boolean;
};

export function useAppEnvironment(): UseAppEnvironmentResult {
  const [time, setTime] = useState('');
  const [isStandalone, setIsStandalone] = useState(false);
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
    const isTextEntryElement = (element: Element | null): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      if (element.isContentEditable) {
        return true;
      }

      if (element instanceof HTMLTextAreaElement) {
        return !element.readOnly && !element.disabled;
      }

      if (element instanceof HTMLInputElement) {
        if (element.readOnly || element.disabled) {
          return false;
        }

        return ![
          'button',
          'checkbox',
          'color',
          'file',
          'hidden',
          'image',
          'radio',
          'range',
          'reset',
          'submit',
        ].includes(element.type);
      }

      return false;
    };
    const userAgent = window.navigator.userAgent.toLowerCase();
    const hasTouchMacUa = userAgent.includes('macintosh') && (window.navigator.maxTouchPoints || 0) > 1;
    const isAndroid = /Android/i.test(window.navigator.userAgent || '');
    const isIosLike = /iphone|ipad|ipod/.test(userAgent) || hasTouchMacUa;
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandalone);
    if (isAndroid) {
      root.setAttribute('data-android', 'true');
    } else {
      root.removeAttribute('data-android');
    }
    if (isIosLike) {
      root.setAttribute('data-ios-like', 'true');
    } else {
      root.removeAttribute('data-ios-like');
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
      const viewportOffsetTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const keyboardInset = Math.max(0, Math.round(layoutViewportHeight - visualViewportHeight - viewportOffsetTop));
      const activeElement = document.activeElement;
      const hasTextEntryFocus = isTextEntryElement(activeElement);
      const viewportHeightDelta = Math.max(0, Math.round(layoutViewportHeight - visualViewportHeight));
      const iosKeyboardVisible = isIosLike && hasTextEntryFocus && (
        keyboardInset > 12
        || viewportHeightDelta > 12
        || viewportOffsetTop > 0
      );
      const keyboardVisible = iosKeyboardVisible || (!isIosLike && keyboardInset > 120);
      const activeViewportHeight = isIosLike && keyboardVisible
        ? Math.round(visualViewportHeight)
        : Math.round(layoutViewportHeight);

      // Keep the app itself sized to the real fullscreen layout viewport so
      // iOS standalone safe-area space stays painted. The visual viewport is
      // still tracked separately for keyboard-aware screens.
      root.style.setProperty('--app-viewport-height', `${Math.round(layoutViewportHeight)}px`);
      root.style.setProperty('--app-visible-viewport-height', `${Math.round(visualViewportHeight)}px`);
      root.style.setProperty('--app-active-viewport-height', `${activeViewportHeight}px`);
      root.style.setProperty('--app-keyboard-inset', `${keyboardInset}px`);
      if (keyboardVisible) {
        root.setAttribute('data-keyboard-open', 'true');
      } else {
        root.removeAttribute('data-keyboard-open');
      }
    };
    const scheduleViewportUpdate = () => {
      window.requestAnimationFrame(updateViewportHeight);
    };

    updateViewportHeight();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', updateViewportHeight);
    viewport?.addEventListener('scroll', updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);
    document.addEventListener('focusin', scheduleViewportUpdate, true);
    document.addEventListener('focusout', scheduleViewportUpdate, true);

    return () => {
      viewport?.removeEventListener('resize', updateViewportHeight);
      viewport?.removeEventListener('scroll', updateViewportHeight);
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      document.removeEventListener('focusin', scheduleViewportUpdate, true);
      document.removeEventListener('focusout', scheduleViewportUpdate, true);
      root.style.removeProperty('--app-viewport-height');
      root.style.removeProperty('--app-visible-viewport-height');
      root.style.removeProperty('--app-active-viewport-height');
      root.style.removeProperty('--app-keyboard-inset');
      root.removeAttribute('data-android');
      root.removeAttribute('data-ios-like');
      root.removeAttribute('data-keyboard-open');
      root.removeAttribute('data-standalone');
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
    time,
    useDesktopStageLayout,
  };
}

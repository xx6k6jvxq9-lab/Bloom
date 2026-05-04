import { useEffect, useMemo, useState, type RefObject } from 'react';

function isTextEntryElement(element: Element | null): element is HTMLElement {
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
}

type UseKeyboardSafeViewportOptions = {
  containerRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
  thresholdPx?: number;
};

export function useKeyboardSafeViewport({
  containerRef,
  enabled = true,
  thresholdPx = 12,
}: UseKeyboardSafeViewportOptions) {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosLike = /iphone|ipad|ipod/.test(userAgent)
      || (userAgent.includes('macintosh') && (window.navigator.maxTouchPoints || 0) > 1);

    if (!isIosLike) {
      setViewportHeight(null);
      setKeyboardVisible(false);
      return undefined;
    }

    const updateViewport = () => {
      const viewport = window.visualViewport;
      if (!viewport) {
        setViewportHeight(null);
        setKeyboardVisible(false);
        return;
      }

      const container = containerRef.current;
      const activeElement = document.activeElement;
      const ownsFocusedField = !!container
        && container.contains(activeElement)
        && isTextEntryElement(activeElement);
      const layoutHeight = window.innerHeight;
      const viewportHeightDelta = Math.max(0, Math.round(layoutHeight - viewport.height));
      const viewportOffsetTop = Math.max(0, Math.round(viewport.offsetTop));
      const keyboardInset = Math.max(0, Math.round(layoutHeight - viewport.height - viewport.offsetTop));
      const shouldUseVisibleViewport = ownsFocusedField && (
        keyboardInset > thresholdPx
        || viewportHeightDelta > thresholdPx
        || viewportOffsetTop > 0
      );

      setKeyboardVisible(shouldUseVisibleViewport);
      setViewportHeight(shouldUseVisibleViewport ? Math.round(viewport.height) : null);

      if (shouldUseVisibleViewport && activeElement instanceof HTMLElement) {
        window.requestAnimationFrame(() => {
          activeElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
      }
    };

    const scheduleViewportUpdate = () => {
      window.requestAnimationFrame(updateViewport);
    };

    updateViewport();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    document.addEventListener('focusin', scheduleViewportUpdate, true);
    document.addEventListener('focusout', scheduleViewportUpdate, true);

    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      document.removeEventListener('focusin', scheduleViewportUpdate, true);
      document.removeEventListener('focusout', scheduleViewportUpdate, true);
    };
  }, [containerRef, enabled, thresholdPx]);

  const viewportStyle = useMemo(
    () => (viewportHeight
      ? { height: `${viewportHeight}px`, minHeight: `${viewportHeight}px` }
      : undefined),
    [viewportHeight],
  );

  return {
    keyboardVisible,
    viewportStyle,
  };
}

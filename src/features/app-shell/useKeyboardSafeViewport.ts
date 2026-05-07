import { useEffect, useState, type RefObject } from 'react';
import { useAppKeyboard } from './AppKeyboardContext';
import { containerOwnsFocusedTextEntry } from './keyboardUtils';

type UseKeyboardSafeViewportOptions = {
  containerRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
  scrollFocusedIntoView?: boolean;
  clampViewportHeight?: boolean;
};

function findNearestScrollableAncestor(
  element: HTMLElement | null,
  boundary: HTMLElement | null,
) {
  if (!element) {
    return null;
  }

  let current = element.parentElement;
  while (current && current !== boundary) {
    const styles = window.getComputedStyle(current);
    const overflowY = styles.overflowY || styles.overflow;
    const canScroll = /(auto|scroll|overlay)/.test(overflowY) && current.scrollHeight > current.clientHeight + 2;
    if (canScroll) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

export function useKeyboardSafeViewport({
  containerRef,
  enabled = true,
  scrollFocusedIntoView = true,
  clampViewportHeight = false,
}: UseKeyboardSafeViewportOptions) {
  const {
    keyboardVisible: appKeyboardVisible,
    manualKeyboardAvoidanceEnabled,
    visualViewportHeight,
  } = useAppKeyboard();
  const [ownsFocusedKeyboard, setOwnsFocusedKeyboard] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') {
      setOwnsFocusedKeyboard(false);
      return undefined;
    }

    const updateFocusedOwnership = () => {
      setOwnsFocusedKeyboard(
        containerOwnsFocusedTextEntry(containerRef.current, document.activeElement),
      );
    };

    const scheduleFocusOwnershipUpdate = () => {
      window.requestAnimationFrame(updateFocusedOwnership);
    };

    updateFocusedOwnership();
    window.addEventListener('resize', updateFocusedOwnership);
    window.addEventListener('orientationchange', updateFocusedOwnership);
    document.addEventListener('focusin', scheduleFocusOwnershipUpdate, true);
    document.addEventListener('focusout', scheduleFocusOwnershipUpdate, true);

    return () => {
      window.removeEventListener('resize', updateFocusedOwnership);
      window.removeEventListener('orientationchange', updateFocusedOwnership);
      document.removeEventListener('focusin', scheduleFocusOwnershipUpdate, true);
      document.removeEventListener('focusout', scheduleFocusOwnershipUpdate, true);
    };
  }, [containerRef, enabled]);

  const keyboardVisible = ownsFocusedKeyboard && appKeyboardVisible;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const shouldTrackVisibleViewport =
      !manualKeyboardAvoidanceEnabled
      && ownsFocusedKeyboard
      && keyboardVisible
      && visualViewportHeight > 0;

    if (!shouldTrackVisibleViewport) {
      container.style.removeProperty('height');
      container.style.removeProperty('min-height');
      return undefined;
    }

    if (clampViewportHeight) {
      container.style.height = `${visualViewportHeight}px`;
      container.style.minHeight = `${visualViewportHeight}px`;
    } else {
      container.style.removeProperty('height');
      container.style.removeProperty('min-height');
    }

    if (!scrollFocusedIntoView) {
      return () => {
        container.style.removeProperty('height');
        container.style.removeProperty('min-height');
      };
    }

    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement) || !container.contains(activeElement)) {
      return () => {
        container.style.removeProperty('height');
        container.style.removeProperty('min-height');
      };
    }

    const scrollContainer = findNearestScrollableAncestor(activeElement, container);
    if (!scrollContainer) {
      return () => {
        container.style.removeProperty('height');
        container.style.removeProperty('min-height');
      };
    }

    let frameOne = 0;
    let frameTwo = 0;
    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        const inputRect = activeElement.getBoundingClientRect();
        const scrollRect = scrollContainer.getBoundingClientRect();
        const topOverflow = inputRect.top - scrollRect.top - 12;
        const bottomOverflow = inputRect.bottom - scrollRect.bottom + 12;

        if (topOverflow < 0) {
          scrollContainer.scrollTop += topOverflow;
        } else if (bottomOverflow > 0) {
          scrollContainer.scrollTop += bottomOverflow;
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
      container.style.removeProperty('height');
      container.style.removeProperty('min-height');
    };
  }, [
    containerRef,
    enabled,
    keyboardVisible,
    manualKeyboardAvoidanceEnabled,
    ownsFocusedKeyboard,
    scrollFocusedIntoView,
    clampViewportHeight,
    visualViewportHeight,
  ]);

  return {
    keyboardVisible,
  };
}

import { useEffect, useState, type RefObject } from 'react';
import { useAppKeyboard } from './AppKeyboardContext';
import { containerOwnsFocusedTextEntry } from './keyboardUtils';

type UseKeyboardSafeViewportOptions = {
  containerRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
};

export function useKeyboardSafeViewport({
  containerRef,
  enabled = true,
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

    const shouldClampToVisibleViewport =
      !manualKeyboardAvoidanceEnabled
      && ownsFocusedKeyboard
      && keyboardVisible
      && visualViewportHeight > 0;

    if (!shouldClampToVisibleViewport) {
      container.style.removeProperty('height');
      container.style.removeProperty('min-height');
      return undefined;
    }

    container.style.height = `${visualViewportHeight}px`;
    container.style.minHeight = `${visualViewportHeight}px`;

    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement) || !container.contains(activeElement)) {
      return () => {
        container.style.removeProperty('height');
        container.style.removeProperty('min-height');
      };
    }

    let frameOne = 0;
    let frameTwo = 0;
    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        activeElement.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
        });
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
    visualViewportHeight,
  ]);

  return {
    keyboardVisible,
  };
}

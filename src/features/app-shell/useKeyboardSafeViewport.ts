import { useEffect, useMemo, useState, type RefObject } from 'react';
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

  const viewportStyle = useMemo(
    () => (manualKeyboardAvoidanceEnabled && keyboardVisible && visualViewportHeight > 0
      ? { height: `${visualViewportHeight}px`, minHeight: `${visualViewportHeight}px` }
      : undefined),
    [keyboardVisible, manualKeyboardAvoidanceEnabled, visualViewportHeight],
  );

  return {
    keyboardVisible,
    viewportStyle,
  };
}

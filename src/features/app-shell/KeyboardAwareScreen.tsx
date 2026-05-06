import { useEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { useAppKeyboard } from './AppKeyboardContext';
import { useKeyboardSafeViewport } from './useKeyboardSafeViewport';

type KeyboardAwareScreenProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  header?: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  bodyProps?: HTMLAttributes<HTMLDivElement>;
  hideFooterWhenKeyboardOpen?: boolean;
  footerClassName?: string;
  footerStyle?: CSSProperties;
};

export function KeyboardAwareScreen({
  children,
  className = 'absolute inset-0 flex flex-col',
  style,
  header,
  footer,
  bodyClassName = 'flex-1 min-h-0 overflow-hidden flex flex-col',
  bodyProps,
  hideFooterWhenKeyboardOpen = false,
  footerClassName,
  footerStyle,
}: KeyboardAwareScreenProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const {
    usesVisualViewportKeyboardLayout,
    keyboardVisible: appKeyboardVisible,
    keyboardInset,
    manualKeyboardAvoidanceEnabled,
  } = useAppKeyboard();
  const { keyboardVisible: ownsFocusedKeyboard, viewportStyle } = useKeyboardSafeViewport({
    containerRef: shellRef,
    enabled: true,
  });
  const keyboardVisible = ownsFocusedKeyboard && (appKeyboardVisible || keyboardInset > 120);

  useEffect(() => {
    if (
      typeof window === 'undefined'
      || typeof document === 'undefined'
      || manualKeyboardAvoidanceEnabled
      || usesVisualViewportKeyboardLayout
      || !keyboardVisible
    ) {
      return undefined;
    }

    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement) || !shellRef.current?.contains(activeElement)) {
      return undefined;
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
    };
  }, [keyboardVisible, manualKeyboardAvoidanceEnabled, usesVisualViewportKeyboardLayout, viewportStyle]);

  const resolvedFooterStyle: CSSProperties | undefined = footer
    ? {
        ...(footerStyle || {}),
        ...(hideFooterWhenKeyboardOpen
          ? {
              opacity: keyboardVisible ? 0 : 1,
              transform: keyboardVisible ? 'translateY(100%)' : 'translateY(0)',
              pointerEvents: keyboardVisible ? 'none' as const : 'auto' as const,
              transition: 'opacity 180ms ease, transform 180ms ease',
            }
          : {}),
      }
    : undefined;

  const resolvedBodyStyle: CSSProperties | undefined = {
    ...(bodyProps?.style || {}),
    ...(manualKeyboardAvoidanceEnabled && keyboardVisible && keyboardInset > 0
      ? { paddingBottom: `${keyboardInset}px` }
      : {}),
    transition: 'padding-bottom 180ms ease',
  };

  return (
    <div
      ref={shellRef}
      className={className}
      style={{
        ...(style || {}),
        ...(viewportStyle || {}),
      }}
    >
      {header}
      <div {...bodyProps} ref={bodyRef} className={bodyClassName} style={resolvedBodyStyle}>
        {children}
      </div>
      {footer ? (
        <div className={footerClassName} style={resolvedFooterStyle}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

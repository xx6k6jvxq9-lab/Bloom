import React, { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { useAppKeyboard } from './AppKeyboardContext';

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
  const { keyboardVisible: appKeyboardVisible, keyboardInset, manualKeyboardAvoidanceEnabled } = useAppKeyboard();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!hideFooterWhenKeyboardOpen || typeof document === 'undefined') {
      setKeyboardVisible(false);
      return undefined;
    }

    const updateKeyboardVisibility = () => {
      const shell = shellRef.current;
      const activeElement = document.activeElement;
      const ownsFocusedField = !!shell
        && activeElement instanceof HTMLElement
        && shell.contains(activeElement)
        && (
          activeElement.isContentEditable
          || (activeElement instanceof HTMLInputElement && !activeElement.readOnly && !activeElement.disabled)
          || (activeElement instanceof HTMLTextAreaElement && !activeElement.readOnly && !activeElement.disabled)
        );

      setKeyboardVisible(manualKeyboardAvoidanceEnabled && ownsFocusedField && (appKeyboardVisible || keyboardInset > 120));
    };

    const scheduleUpdate = () => {
      window.requestAnimationFrame(updateKeyboardVisibility);
    };

    updateKeyboardVisibility();
    document.addEventListener('focusin', scheduleUpdate, true);
    document.addEventListener('focusout', scheduleUpdate, true);

    return () => {
      document.removeEventListener('focusin', scheduleUpdate, true);
      document.removeEventListener('focusout', scheduleUpdate, true);
    };
  }, [appKeyboardVisible, hideFooterWhenKeyboardOpen, keyboardInset, manualKeyboardAvoidanceEnabled]);

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
      style={style}
    >
      {header}
      <div {...bodyProps} className={bodyClassName} style={resolvedBodyStyle}>
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

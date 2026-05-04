import React, { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

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
    return !element.readOnly && !element.disabled;
  }

  return false;
}

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
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!hideFooterWhenKeyboardOpen || typeof window === 'undefined' || typeof document === 'undefined') {
      setKeyboardVisible(false);
      return undefined;
    }

    const updateKeyboardVisibility = () => {
      const shell = shellRef.current;
      const activeElement = document.activeElement;
      const ownsFocusedField = !!shell
        && shell.contains(activeElement)
        && isTextEntryElement(activeElement);
      const viewport = window.visualViewport;
      const keyboardInset = viewport
        ? Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
        : 0;
      const rootKeyboardVisible = document.documentElement.getAttribute('data-keyboard-open') === 'true';

      setKeyboardVisible(ownsFocusedField && (rootKeyboardVisible || keyboardInset > 120));
    };

    const scheduleUpdate = () => {
      window.requestAnimationFrame(updateKeyboardVisibility);
    };

    updateKeyboardVisibility();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', updateKeyboardVisibility);
    viewport?.addEventListener('scroll', updateKeyboardVisibility);
    document.addEventListener('focusin', scheduleUpdate, true);
    document.addEventListener('focusout', scheduleUpdate, true);

    return () => {
      viewport?.removeEventListener('resize', updateKeyboardVisibility);
      viewport?.removeEventListener('scroll', updateKeyboardVisibility);
      document.removeEventListener('focusin', scheduleUpdate, true);
      document.removeEventListener('focusout', scheduleUpdate, true);
    };
  }, [hideFooterWhenKeyboardOpen]);

  const resolvedFooterStyle = footer
    ? {
        ...(footerStyle || {}),
        ...(hideFooterWhenKeyboardOpen
          ? {
              opacity: keyboardVisible ? 0 : 1,
              transform: keyboardVisible ? 'translateY(100%)' : 'translateY(0)',
              pointerEvents: keyboardVisible ? 'none' : 'auto',
              transition: 'opacity 180ms ease, transform 180ms ease',
            }
          : {}),
      }
    : undefined;

  return (
    <div
      ref={shellRef}
      className={className}
      style={style}
    >
      {header}
      <div {...bodyProps} className={bodyClassName}>
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

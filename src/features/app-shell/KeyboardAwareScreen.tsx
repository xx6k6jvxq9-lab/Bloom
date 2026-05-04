import React, { useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
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
  const { keyboardVisible, viewportStyle } = useKeyboardSafeViewport({ containerRef: shellRef });

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
      style={{
        ...(style || {}),
        ...(viewportStyle || {}),
      }}
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

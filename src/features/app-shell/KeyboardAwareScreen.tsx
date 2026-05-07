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
  const { keyboardVisible: appKeyboardVisible } = useAppKeyboard();
  const { keyboardVisible: ownsFocusedKeyboard } = useKeyboardSafeViewport({
    containerRef: shellRef,
    enabled: hideFooterWhenKeyboardOpen,
  });
  const keyboardVisible = ownsFocusedKeyboard && appKeyboardVisible;

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
    transition: 'padding-bottom 180ms ease',
  };

  return (
    <div
      ref={shellRef}
      className={className}
      style={style}
    >
      {header}
      <div {...bodyProps} className={`min-h-0 ${bodyClassName}`} style={resolvedBodyStyle}>
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

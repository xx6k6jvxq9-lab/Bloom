import { useEffect } from 'react';

export function useAutoDismissToast<T>(
  value: T | null,
  clear: React.Dispatch<React.SetStateAction<T | null>>,
  delayMs: number,
) {
  useEffect(() => {
    if (!value) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clear(null);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [clear, delayMs, value]);
}

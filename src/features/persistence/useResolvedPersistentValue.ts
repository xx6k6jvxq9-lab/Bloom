import { useEffect, useState } from 'react';
import { resolveValueToDisplayUrl } from './persistentAssetService';

type ResolvedPersistentValueState = {
  resolvedUrl: string | null;
  loading: boolean;
  error: Error | null;
};

export function useResolvedPersistentValue(value: string | null | undefined): ResolvedPersistentValueState {
  const [state, setState] = useState<ResolvedPersistentValueState>({
    resolvedUrl: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (!value || !value.trim()) {
      setState({ resolvedUrl: null, loading: false, error: null });
      return undefined;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    resolveValueToDisplayUrl(value)
      .then((resolvedUrl) => {
        if (cancelled) return;
        setState({
          resolvedUrl,
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          resolvedUrl: null,
          loading: false,
          error: error instanceof Error ? error : new Error('资源解析失败'),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return state;
}

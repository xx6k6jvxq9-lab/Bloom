import { useCallback, useRef, useState } from 'react';

import type { SessionGenerationTaskContext, SessionRuntimeCoreApi } from './types';

export function useSessionRuntimeCore(): SessionRuntimeCoreApi {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const activeGenerationIdRef = useRef(0);

  const setError = useCallback((value: string | null) => {
    setErrorState(value);
  }, []);

  const runGeneration = useCallback(async <T,>(task: (context: SessionGenerationTaskContext) => Promise<T>): Promise<T> => {
    const generationId = activeGenerationIdRef.current + 1;
    activeGenerationIdRef.current = generationId;
    setIsLoading(true);
    setErrorState(null);

    const isCurrent = () => activeGenerationIdRef.current === generationId;
    const setRuntimeError = (value: string | null) => {
      if (isCurrent()) {
        setErrorState(value);
      }
    };

    try {
      return await task({ generationId, isCurrent, setRuntimeError });
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
      }
    }
  }, []);

  return {
    isLoading,
    error,
    setError,
    activeGenerationIdRef,
    runGeneration,
  };
}

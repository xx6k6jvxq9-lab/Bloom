import { useCallback, useRef, useState } from 'react';

import type { SessionGenerationTaskContext, SessionRuntimeCoreApi } from './types';

const CHAT_RUNTIME_BUSY_COUNT_KEY = '__bloomChatRuntimeBusyCount';
const CHAT_RUNTIME_LAST_ACTIVE_AT_KEY = '__bloomChatRuntimeLastActiveAt';

function getGlobalScope() {
  return globalThis as typeof globalThis & Record<string, unknown>;
}

function markChatRuntimeBusy(delta: 1 | -1) {
  const scope = getGlobalScope();
  const currentCount = typeof scope[CHAT_RUNTIME_BUSY_COUNT_KEY] === 'number'
    ? Math.max(0, scope[CHAT_RUNTIME_BUSY_COUNT_KEY] as number)
    : 0;
  const nextCount = Math.max(0, currentCount + delta);
  scope[CHAT_RUNTIME_BUSY_COUNT_KEY] = nextCount;
  scope[CHAT_RUNTIME_LAST_ACTIVE_AT_KEY] = Date.now();
}

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
    markChatRuntimeBusy(1);

    const isCurrent = () => activeGenerationIdRef.current === generationId;
    const setRuntimeError = (value: string | null) => {
      if (isCurrent()) {
        setErrorState(value);
      }
    };

    try {
      return await task({ generationId, isCurrent, setRuntimeError });
    } finally {
      markChatRuntimeBusy(-1);
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

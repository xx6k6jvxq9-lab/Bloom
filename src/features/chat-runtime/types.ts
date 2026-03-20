export type SessionGenerationTaskContext = {
  generationId: number;
  isCurrent: () => boolean;
  setRuntimeError: (value: string | null) => void;
};

export type BaseSessionRuntimeState = {
  isLoading: boolean;
  error: string | null;
};

export type SessionRuntimeCoreApi = BaseSessionRuntimeState & {
  setError: (value: string | null) => void;
  activeGenerationIdRef: React.MutableRefObject<number>;
  runGeneration: <T>(task: (context: SessionGenerationTaskContext) => Promise<T>) => Promise<T>;
};

export type SendCapableSessionRuntime = BaseSessionRuntimeState & {
  sendText: () => Promise<void>;
};

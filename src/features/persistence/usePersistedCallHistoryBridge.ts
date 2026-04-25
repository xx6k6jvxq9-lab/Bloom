import { useEffect, useRef } from 'react';
import type { CallRecord } from '../../types';
import { loadPreferredCallHistory, saveCallHistory } from './callHistoryStore';

function serializeCallHistory(callHistory: CallRecord[]): string {
  return JSON.stringify(callHistory);
}

export function usePersistedCallHistoryBridge(
  callHistory: CallRecord[],
  setCallHistory: (callHistory: CallRecord[]) => void,
): void {
  const setCallHistoryRef = useRef(setCallHistory);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialDataRef = useRef(callHistory);
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setCallHistoryRef.current = setCallHistory;
  }, [setCallHistory]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const hydrated = await loadPreferredCallHistory(initialDataRef.current);
      const currentSerialized = serializeCallHistory(initialDataRef.current);
      const hydratedSerialized = serializeCallHistory(hydrated);

      if (cancelled) {
        return;
      }

      hydrationTargetRef.current = hydratedSerialized;
      lastPersistedRef.current = currentSerialized;

      if (currentSerialized !== hydratedSerialized) {
        skipUntilHydratedRef.current = true;
        setCallHistoryRef.current(hydrated);
        return;
      }

      hasHydratedRef.current = true;
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const serialized = serializeCallHistory(callHistory);

    if (skipUntilHydratedRef.current) {
      if (serialized === hydrationTargetRef.current) {
        skipUntilHydratedRef.current = false;
        hasHydratedRef.current = true;
        lastPersistedRef.current = serialized;
      }
      return;
    }

    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
    }

    if (lastPersistedRef.current === serialized) {
      return;
    }

    void saveCallHistory(callHistory);
    lastPersistedRef.current = serialized;
  }, [callHistory]);
}

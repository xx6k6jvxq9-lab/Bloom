import { useEffect, useRef } from 'react';
import type { DateSession } from '../../types';
import { loadDatingRecords, saveDatingRecords, type DatingRecordsData } from './datingRecordsStore';

function serializeDatingRecords(data: DatingRecordsData): string {
  return JSON.stringify(data);
}

export function usePersistedDatingRecordsBridge(
  savedDates: DateSession[],
  collectedDates: DateSession[],
  setDatingRecords: (data: DatingRecordsData) => void,
): void {
  const setDatingRecordsRef = useRef(setDatingRecords);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialDataRef = useRef<DatingRecordsData>({ savedDates, collectedDates });
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setDatingRecordsRef.current = setDatingRecords;
  }, [setDatingRecords]);

  useEffect(() => {
    const hydrated = loadDatingRecords(initialDataRef.current);
    const currentSerialized = serializeDatingRecords(initialDataRef.current);
    const hydratedSerialized = serializeDatingRecords(hydrated);

    hydrationTargetRef.current = hydratedSerialized;
    lastPersistedRef.current = currentSerialized;

    if (currentSerialized !== hydratedSerialized) {
      skipUntilHydratedRef.current = true;
      setDatingRecordsRef.current(hydrated);
      return;
    }

    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    const currentData = { savedDates, collectedDates };
    const serialized = serializeDatingRecords(currentData);

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

    saveDatingRecords(currentData);
    lastPersistedRef.current = serialized;
  }, [savedDates, collectedDates]);
}

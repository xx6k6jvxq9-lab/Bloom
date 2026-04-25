import { useEffect, useRef } from 'react';
import { loadPreferredMoments, persistMoments, type PersistedMoment } from './momentsStore';

function serializeMoments(moments: PersistedMoment[]): string {
  return JSON.stringify(moments);
}

function getLatestMomentTimestamp(moments: PersistedMoment[]): number {
  return moments.reduce((latest, moment) => {
    const timestamp = typeof moment?.timestamp === 'number' ? moment.timestamp : 0;
    return Math.max(latest, timestamp);
  }, 0);
}

export function usePersistedMomentsBridge(
  moments: PersistedMoment[],
  setMoments: (moments: PersistedMoment[]) => void,
): void {
  const setMomentsRef = useRef(setMoments);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialMomentsRef = useRef(moments);
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setMomentsRef.current = setMoments;
  }, [setMoments]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const hydrated = await loadPreferredMoments(initialMomentsRef.current);
      const currentSerialized = serializeMoments(initialMomentsRef.current);
      const hydratedSerialized = serializeMoments(hydrated);
      const currentLatestTimestamp = getLatestMomentTimestamp(initialMomentsRef.current);
      const hydratedLatestTimestamp = getLatestMomentTimestamp(hydrated);

      if (cancelled) {
        return;
      }

      hydrationTargetRef.current = hydratedSerialized;
      lastPersistedRef.current = currentSerialized;

      if (currentSerialized !== hydratedSerialized) {
        // When MainApp remounts after a chat-triggered publish, in-memory moments can be
        // newer than the last persisted snapshot. In that case keep the in-memory state
        // and persist it, instead of hydrating older localStorage data back over it.
        if (currentLatestTimestamp > hydratedLatestTimestamp) {
          void persistMoments(initialMomentsRef.current);
          lastPersistedRef.current = currentSerialized;
          hasHydratedRef.current = true;
          return;
        }

        skipUntilHydratedRef.current = true;
        setMomentsRef.current(hydrated);
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
    const serialized = serializeMoments(moments);

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

    void persistMoments(moments);
    lastPersistedRef.current = serialized;
  }, [moments]);
}

import { useEffect, useRef } from 'react';
import type { CoupleSpaceData } from '../../types';
import { loadPersistedCoupleSpace, persistCoupleSpace } from './coupleSpaceStore';

function serializeCoupleSpace(data: CoupleSpaceData): string {
  return JSON.stringify(data);
}

export function usePersistedCoupleSpaceBridge(
  coupleSpace: CoupleSpaceData,
  setCoupleSpace: (coupleSpace: CoupleSpaceData) => void,
): void {
  const setCoupleSpaceRef = useRef(setCoupleSpace);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialDataRef = useRef(coupleSpace);
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setCoupleSpaceRef.current = setCoupleSpace;
  }, [setCoupleSpace]);

  useEffect(() => {
    const hydrated = loadPersistedCoupleSpace(initialDataRef.current);
    const currentSerialized = serializeCoupleSpace(initialDataRef.current);
    const hydratedSerialized = serializeCoupleSpace(hydrated);

    hydrationTargetRef.current = hydratedSerialized;
    lastPersistedRef.current = currentSerialized;

    if (currentSerialized !== hydratedSerialized) {
      skipUntilHydratedRef.current = true;
      setCoupleSpaceRef.current(hydrated);
      return;
    }

    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    const serialized = serializeCoupleSpace(coupleSpace);

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

    persistCoupleSpace(coupleSpace);
    lastPersistedRef.current = serialized;
  }, [coupleSpace]);
}

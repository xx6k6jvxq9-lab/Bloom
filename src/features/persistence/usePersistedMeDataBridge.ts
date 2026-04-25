import { useEffect, useRef } from 'react';
import type { FavoriteMessage, Mask, WorldBookEntry } from '../../types';
import { loadPreferredMeData, persistMeData, type MeData } from './meDataStore';

function serializeMeData(data: MeData): string {
  return JSON.stringify(data);
}

export function usePersistedMeDataBridge(
  masks: Mask[],
  favorites: FavoriteMessage[],
  worldBooks: WorldBookEntry[],
  setMeData: (data: MeData) => void,
): void {
  const setMeDataRef = useRef(setMeData);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialDataRef = useRef<MeData>({ masks, favorites, worldBooks });
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setMeDataRef.current = setMeData;
  }, [setMeData]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const hydrated = await loadPreferredMeData(initialDataRef.current);
      const currentSerialized = serializeMeData(initialDataRef.current);
      const hydratedSerialized = serializeMeData(hydrated);

      if (cancelled) {
        return;
      }

      hydrationTargetRef.current = hydratedSerialized;
      lastPersistedRef.current = currentSerialized;

      if (currentSerialized !== hydratedSerialized) {
        skipUntilHydratedRef.current = true;
        setMeDataRef.current(hydrated);
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
    const currentData = { masks, favorites, worldBooks };
    const serialized = serializeMeData(currentData);

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

    void persistMeData(currentData);
    lastPersistedRef.current = serialized;
  }, [masks, favorites, worldBooks]);
}

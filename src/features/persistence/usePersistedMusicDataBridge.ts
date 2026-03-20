import { useEffect, useRef } from 'react';
import type { MusicData } from '../../types';
import { loadPersistedMusicData, persistMusicData } from './musicDataStore';

function serializeMusicData(data: MusicData): string {
  return JSON.stringify(data);
}

export function usePersistedMusicDataBridge(
  musicData: MusicData,
  setMusicData: (data: MusicData) => void,
): void {
  const setMusicDataRef = useRef(setMusicData);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialDataRef = useRef(musicData);
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setMusicDataRef.current = setMusicData;
  }, [setMusicData]);

  useEffect(() => {
    const hydrated = loadPersistedMusicData(initialDataRef.current);
    const currentSerialized = serializeMusicData(initialDataRef.current);
    const hydratedSerialized = serializeMusicData(hydrated);

    hydrationTargetRef.current = hydratedSerialized;
    lastPersistedRef.current = currentSerialized;

    if (currentSerialized !== hydratedSerialized) {
      skipUntilHydratedRef.current = true;
      setMusicDataRef.current(hydrated);
      return;
    }

    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    const serialized = serializeMusicData(musicData);

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

    persistMusicData(musicData);
    lastPersistedRef.current = serialized;
  }, [musicData]);
}

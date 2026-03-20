import { useEffect, useRef } from 'react';
import type { ForumData } from '../../types';
import { loadPersistedForumData, persistForumData } from './forumDataStore';

function serializeForumData(data: ForumData): string {
  return JSON.stringify(data);
}

export function usePersistedForumDataBridge(
  forumData: ForumData,
  setForumData: (forumData: ForumData) => void,
): void {
  const setForumDataRef = useRef(setForumData);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialDataRef = useRef(forumData);
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setForumDataRef.current = setForumData;
  }, [setForumData]);

  useEffect(() => {
    const hydrated = loadPersistedForumData(initialDataRef.current);
    const currentSerialized = serializeForumData(initialDataRef.current);
    const hydratedSerialized = serializeForumData(hydrated);

    hydrationTargetRef.current = hydratedSerialized;
    lastPersistedRef.current = currentSerialized;

    if (currentSerialized !== hydratedSerialized) {
      skipUntilHydratedRef.current = true;
      setForumDataRef.current(hydrated);
      return;
    }

    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    const serialized = serializeForumData(forumData);

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

    persistForumData(forumData);
    lastPersistedRef.current = serialized;
  }, [forumData]);
}

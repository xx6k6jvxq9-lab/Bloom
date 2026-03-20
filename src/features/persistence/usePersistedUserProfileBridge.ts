import { useEffect, useRef } from 'react';
import type { UserProfileExtended } from '../../types';
import { loadPersistedUserProfile, persistUserProfile } from './userProfileStore';

function serializeUserProfile(profile: UserProfileExtended): string {
  return JSON.stringify(profile);
}

export function usePersistedUserProfileBridge(
  userProfile: UserProfileExtended,
  setUserProfile: (profile: UserProfileExtended) => void,
): void {
  const setUserProfileRef = useRef(setUserProfile);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialProfileRef = useRef(userProfile);
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setUserProfileRef.current = setUserProfile;
  }, [setUserProfile]);

  useEffect(() => {
    const hydrated = loadPersistedUserProfile(initialProfileRef.current);
    const currentSerialized = serializeUserProfile(initialProfileRef.current);
    const hydratedSerialized = serializeUserProfile(hydrated);

    hydrationTargetRef.current = hydratedSerialized;
    lastPersistedRef.current = currentSerialized;

    if (currentSerialized !== hydratedSerialized) {
      skipUntilHydratedRef.current = true;
      setUserProfileRef.current(hydrated);
      return;
    }

    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    const serialized = serializeUserProfile(userProfile);

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

    persistUserProfile(userProfile);
    lastPersistedRef.current = serialized;
  }, [userProfile]);
}

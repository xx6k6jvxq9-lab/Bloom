import { useEffect, useRef } from 'react';
import type { FriendRequest } from '../../types';
import { loadPersistedFriendRequests, persistFriendRequests } from './friendRequestsStore';

function serializeFriendRequests(data: FriendRequest[]): string {
  return JSON.stringify(data);
}

export function usePersistedFriendRequestsBridge(
  friendRequests: FriendRequest[],
  setFriendRequests: (data: FriendRequest[]) => void,
): void {
  const setFriendRequestsRef = useRef(setFriendRequests);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialDataRef = useRef(friendRequests);
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setFriendRequestsRef.current = setFriendRequests;
  }, [setFriendRequests]);

  useEffect(() => {
    const hydrated = loadPersistedFriendRequests(initialDataRef.current);
    const currentSerialized = serializeFriendRequests(initialDataRef.current);
    const hydratedSerialized = serializeFriendRequests(hydrated);

    hydrationTargetRef.current = hydratedSerialized;
    lastPersistedRef.current = currentSerialized;

    if (currentSerialized !== hydratedSerialized) {
      skipUntilHydratedRef.current = true;
      setFriendRequestsRef.current(hydrated);
      return;
    }

    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    const serialized = serializeFriendRequests(friendRequests);

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

    persistFriendRequests(friendRequests);
    lastPersistedRef.current = serialized;
  }, [friendRequests]);
}

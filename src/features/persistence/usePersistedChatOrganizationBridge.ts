import { useEffect, useRef } from 'react';
import type { ChatGroup } from '../../types';
import { loadPreferredChatOrganization, persistChatOrganization, type ChatOrganizationData } from './chatOrganizationStore';

function serializeChatOrganization(data: ChatOrganizationData): string {
  return JSON.stringify(data);
}

export function usePersistedChatOrganizationBridge(
  groups: string[],
  chatGroups: ChatGroup[],
  setChatOrganization: (data: ChatOrganizationData) => void,
): void {
  const setChatOrganizationRef = useRef(setChatOrganization);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialDataRef = useRef<ChatOrganizationData>({ groups, chatGroups });
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setChatOrganizationRef.current = setChatOrganization;
  }, [setChatOrganization]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const hydrated = await loadPreferredChatOrganization(initialDataRef.current);
      const currentSerialized = serializeChatOrganization(initialDataRef.current);
      const hydratedSerialized = serializeChatOrganization(hydrated);

      if (cancelled) {
        return;
      }

      hydrationTargetRef.current = hydratedSerialized;
      lastPersistedRef.current = currentSerialized;

      if (currentSerialized !== hydratedSerialized) {
        skipUntilHydratedRef.current = true;
        setChatOrganizationRef.current(hydrated);
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
    const currentData = { groups, chatGroups };
    const serialized = serializeChatOrganization(currentData);

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

    void persistChatOrganization(currentData);
    lastPersistedRef.current = serialized;
  }, [groups, chatGroups]);
}

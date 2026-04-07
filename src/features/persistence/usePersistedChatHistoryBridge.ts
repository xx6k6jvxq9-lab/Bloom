import { useEffect, useRef } from 'react';
import type { ChatGroup, ChatHistory } from '../../types';
import {
  extractDirectFactTraces,
  extractDirectRelationshipWaves,
  extractGroupSessions,
  saveChatHistoryRecords,
  type PersistedChatHistoryData,
} from './chatHistoryStore';

function serializeChatHistoryRecords(data: PersistedChatHistoryData): string {
  return JSON.stringify(data);
}

export function usePersistedChatHistoryBridge(
  directHistory: ChatHistory,
  chatGroups: ChatGroup[],
  setChatData: (data: { directHistory: ChatHistory; chatGroups: ChatGroup[] }) => void,
): void {
  const setChatDataRef = useRef(setChatData);
  const hydrationTargetRef = useRef<string | null>(null);
  const skipUntilHydratedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const initialDataRef = useRef<PersistedChatHistoryData>({
    directHistory,
    directRelationshipWaves: extractDirectRelationshipWaves(directHistory),
    directFactTraces: extractDirectFactTraces(directHistory),
    groupSessions: extractGroupSessions(chatGroups),
  });
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setChatDataRef.current = setChatData;
  }, [setChatData]);

  useEffect(() => {
    const currentSerialized = serializeChatHistoryRecords(initialDataRef.current);
    hydrationTargetRef.current = currentSerialized;
    lastPersistedRef.current = currentSerialized;
    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    const currentData = {
      directHistory,
      directRelationshipWaves: extractDirectRelationshipWaves(directHistory),
      directFactTraces: extractDirectFactTraces(directHistory),
      groupSessions: extractGroupSessions(chatGroups),
    };
    const serialized = serializeChatHistoryRecords(currentData);

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

    saveChatHistoryRecords(currentData);
    lastPersistedRef.current = serialized;
  }, [directHistory, chatGroups]);
}

import { useEffect, useRef } from 'react';
import type { ChatGroup, ChatHistory } from '../../types';
import {
  extractGroupHistories,
  loadChatHistoryRecords,
  mergeGroupHistoriesIntoChatGroups,
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
    groupHistories: extractGroupHistories(chatGroups),
  });
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setChatDataRef.current = setChatData;
  }, [setChatData]);

  useEffect(() => {
    const hydrated = loadChatHistoryRecords(initialDataRef.current);
    const currentSerialized = serializeChatHistoryRecords(initialDataRef.current);
    const mergedData = {
      directHistory: hydrated.directHistory,
      chatGroups: mergeGroupHistoriesIntoChatGroups(chatGroups, hydrated.groupHistories),
    };
    const mergedSerialized = serializeChatHistoryRecords({
      directHistory: mergedData.directHistory,
      groupHistories: extractGroupHistories(mergedData.chatGroups),
    });

    hydrationTargetRef.current = mergedSerialized;
    lastPersistedRef.current = currentSerialized;

    if (currentSerialized !== mergedSerialized) {
      skipUntilHydratedRef.current = true;
      setChatDataRef.current(mergedData);
      return;
    }

    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    const currentData = {
      directHistory,
      groupHistories: extractGroupHistories(chatGroups),
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

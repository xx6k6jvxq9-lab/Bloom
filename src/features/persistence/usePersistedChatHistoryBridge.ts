import { useEffect, useRef } from 'react';
import type { ChatGroup, ChatHistory, ChatMessage } from '../../types';
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

function serializeGroupHistories(groupHistories: Record<string, ChatMessage[]>): string {
  return JSON.stringify(groupHistories);
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
    const persisted = loadChatHistoryRecords({
      directHistory: {},
      groupHistories: {},
    });
    const currentGroupHistories = extractGroupHistories(chatGroups);
    const mergedChatGroups = mergeGroupHistoriesIntoChatGroups(chatGroups, persisted.groupHistories);
    const mergedGroupHistories = extractGroupHistories(mergedChatGroups);

    if (
      serializeGroupHistories(currentGroupHistories)
      === serializeGroupHistories(mergedGroupHistories)
    ) {
      return;
    }

    setChatDataRef.current({
      directHistory,
      chatGroups: mergedChatGroups,
    });
  }, [chatGroups, directHistory]);

  useEffect(() => {
    const currentData = {
      directHistory,
      groupHistories: extractGroupHistories(chatGroups),
    };
    const serialized = serializeChatHistoryRecords(currentData);
    const persistedData = loadChatHistoryRecords({
      directHistory: {},
      groupHistories: {},
    });
    const hasPersistedGroupHistories = Object.keys(persistedData.groupHistories).length > 0;
    const hasCurrentGroupHistories = Object.keys(currentData.groupHistories).length > 0;

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

    // On refresh, group organization may hydrate slightly later than chat history.
    // Avoid overwriting persisted group histories with an empty boot snapshot.
    if (chatGroups.length === 0 && !hasCurrentGroupHistories && hasPersistedGroupHistories) {
      return;
    }

    if (lastPersistedRef.current === serialized) {
      return;
    }

    saveChatHistoryRecords(currentData);
    lastPersistedRef.current = serialized;
  }, [directHistory, chatGroups]);
}

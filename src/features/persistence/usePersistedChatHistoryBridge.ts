import { useEffect, useRef } from 'react';
import type { ChatGroup, ChatHistory } from '../../types';
import {
  extractDirectFactTraces,
  extractDirectRelationshipWaves,
  extractGroupSessions,
  loadChatHistoryRecords,
  loadPreferredChatHistoryRecords,
  saveChatHistoryRecords,
  type PersistedChatHistoryData,
} from './chatHistoryStore';
import type { FactTraceRecord } from '../../services/relationship-context/factTypes';
import type { RelationshipWaveRecord } from '../../services/relationship-context/types';

function mergeDirectWaveRecords(
  extracted: Record<string, RelationshipWaveRecord[]>,
): Record<string, RelationshipWaveRecord[]> {
  const persisted = loadChatHistoryRecords().directRelationshipWaves || {};
  const keys = new Set([...Object.keys(persisted), ...Object.keys(extracted)]);
  const result: Record<string, RelationshipWaveRecord[]> = {};

  for (const key of keys) {
    const preserved = (persisted[key] || []).filter((record) => record.sourceScene !== 'direct_chat');
    result[key] = [...preserved, ...(extracted[key] || [])].filter((record, index, array) => (
      array.findIndex((candidate) => (
        candidate.sourceScene === record.sourceScene
        && candidate.summary === record.summary
        && candidate.timestamp === record.timestamp
      )) === index
    )).slice(-12);
  }

  return result;
}

function mergeDirectFactTraceRecords(
  extracted: Record<string, FactTraceRecord[]>,
): Record<string, FactTraceRecord[]> {
  const persisted = loadChatHistoryRecords().directFactTraces || {};
  const keys = new Set([...Object.keys(persisted), ...Object.keys(extracted)]);
  const result: Record<string, FactTraceRecord[]> = {};

  for (const key of keys) {
    const preserved = (persisted[key] || []).filter((record) => record.sourceScene !== 'direct_chat');
    result[key] = [...preserved, ...(extracted[key] || [])].filter((record, index, array) => (
      array.findIndex((candidate) => (
        candidate.sourceScene === record.sourceScene
        && candidate.summary === record.summary
        && candidate.timestamp === record.timestamp
      )) === index
    )).slice(-12);
  }

  return result;
}

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
    directRelationshipWaves: mergeDirectWaveRecords(extractDirectRelationshipWaves(directHistory)),
    directFactTraces: mergeDirectFactTraceRecords(extractDirectFactTraces(directHistory)),
    groupSessions: extractGroupSessions(chatGroups),
  });
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    setChatDataRef.current = setChatData;
  }, [setChatData]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const hydrated = await loadPreferredChatHistoryRecords(initialDataRef.current);
      const currentSerialized = serializeChatHistoryRecords(initialDataRef.current);
      const hydratedSerialized = serializeChatHistoryRecords(hydrated);

      if (cancelled) {
        return;
      }

      hydrationTargetRef.current = hydratedSerialized;
      lastPersistedRef.current = currentSerialized;

      if (currentSerialized !== hydratedSerialized) {
        skipUntilHydratedRef.current = true;
        setChatDataRef.current({
          directHistory: hydrated.directHistory,
          chatGroups,
        });
        return;
      }

      hasHydratedRef.current = true;
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [chatGroups]);

  useEffect(() => {
    const currentData = {
      directHistory,
      directRelationshipWaves: mergeDirectWaveRecords(extractDirectRelationshipWaves(directHistory)),
      directFactTraces: mergeDirectFactTraceRecords(extractDirectFactTraces(directHistory)),
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

    void saveChatHistoryRecords(currentData);
    lastPersistedRef.current = serialized;
  }, [directHistory, chatGroups]);
}

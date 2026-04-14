import type { FactTraceRecord } from "../../services/relationship-context/factTypes";
import type { RelationshipWaveRecord } from "../../services/relationship-context/types";
import { patchChatHistoryRecords } from "../persistence/chatHistoryStore";

function mergeWaveRecords(
  existing: RelationshipWaveRecord[],
  incoming: RelationshipWaveRecord[],
): RelationshipWaveRecord[] {
  return [...existing, ...incoming].filter((record, index, array) => (
    array.findIndex((candidate) => (
      candidate.sourceScene === record.sourceScene
      && candidate.summary === record.summary
      && candidate.timestamp === record.timestamp
    )) === index
  )).slice(-12);
}

function mergeFactRecords(
  existing: FactTraceRecord[],
  incoming: FactTraceRecord[],
): FactTraceRecord[] {
  return [...existing, ...incoming].filter((record, index, array) => (
    array.findIndex((candidate) => (
      candidate.sourceScene === record.sourceScene
      && candidate.summary === record.summary
      && candidate.timestamp === record.timestamp
    )) === index
  )).slice(-12);
}

export function persistMusicTogetherEvidence(params: {
  characterId: string;
  relationshipWaves?: RelationshipWaveRecord[];
  factTraces?: FactTraceRecord[];
}) {
  const relationshipWaves = params.relationshipWaves || [];
  const factTraces = params.factTraces || [];

  if (relationshipWaves.length === 0 && factTraces.length === 0) {
    return;
  }

  patchChatHistoryRecords((current) => ({
    ...current,
    directRelationshipWaves: {
      ...current.directRelationshipWaves,
      [params.characterId]: mergeWaveRecords(
        current.directRelationshipWaves?.[params.characterId] || [],
        relationshipWaves,
      ),
    },
    directFactTraces: {
      ...current.directFactTraces,
      [params.characterId]: mergeFactRecords(
        current.directFactTraces?.[params.characterId] || [],
        factTraces,
      ),
    },
  }));
}

import type { ChatMessage } from '../../types';
import { decideRelationshipWaveWrite } from './buildRelationshipWaveWriteRules';
import { extractDirectRelationshipWaves } from './extractDirectRelationshipWaves';
import type { RelationshipWaveRecord } from './types';

type BuildDirectRelationshipWaveRecordsInput = {
  characterId: string;
  messages: ChatMessage[];
};

export function buildDirectRelationshipWaveRecords(
  input: BuildDirectRelationshipWaveRecordsInput,
): RelationshipWaveRecord[] {
  return extractDirectRelationshipWaves(input)
    .map((candidate) => decideRelationshipWaveWrite(candidate))
    .flatMap((decision) => (decision.shouldWrite ? [decision.record] : []));
}

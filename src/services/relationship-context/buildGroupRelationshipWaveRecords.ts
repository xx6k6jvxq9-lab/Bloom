import type { ChatMessage } from '../../types';
import { decideRelationshipWaveWrite } from './buildRelationshipWaveWriteRules';
import { extractGroupRelationshipWaves } from './extractGroupRelationshipWaves';
import type { RelationshipWaveRecord } from './types';

type BuildGroupRelationshipWaveRecordsInput = {
  groupId: string;
  messages: ChatMessage[];
  memberIds: string[];
};

export function buildGroupRelationshipWaveRecords(
  input: BuildGroupRelationshipWaveRecordsInput,
): RelationshipWaveRecord[] {
  return extractGroupRelationshipWaves(input)
    .map((candidate) => decideRelationshipWaveWrite(candidate))
    .flatMap((decision) => (decision.shouldWrite ? [decision.record] : []));
}

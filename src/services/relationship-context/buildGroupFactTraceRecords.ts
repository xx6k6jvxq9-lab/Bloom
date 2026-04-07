import type { ChatMessage } from '../../types';
import { decideFactTraceWrite } from './buildFactTraceWriteRules';
import { extractGroupFactTraces } from './extractGroupFactTraces';
import type { FactTraceRecord } from './factTypes';

type BuildGroupFactTraceRecordsInput = {
  groupId: string;
  messages: ChatMessage[];
  memberIds: string[];
};

export function buildGroupFactTraceRecords(
  input: BuildGroupFactTraceRecordsInput,
): FactTraceRecord[] {
  return extractGroupFactTraces(input)
    .map((candidate) => decideFactTraceWrite(candidate))
    .flatMap((decision) => (decision.shouldWrite ? [decision.record] : []));
}

import type { ChatMessage } from '../../types';
import { decideFactTraceWrite } from './buildFactTraceWriteRules';
import { extractDirectFactTraces } from './extractDirectFactTraces';
import type { FactTraceRecord } from './factTypes';

type BuildDirectFactTraceRecordsInput = {
  characterId: string;
  messages: ChatMessage[];
};

export function buildDirectFactTraceRecords(
  input: BuildDirectFactTraceRecordsInput,
): FactTraceRecord[] {
  return extractDirectFactTraces(input)
    .map((candidate) => decideFactTraceWrite(candidate))
    .flatMap((decision) => (decision.shouldWrite ? [decision.record] : []));
}

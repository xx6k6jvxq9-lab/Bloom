import type {
  CoupleSpaceInitiativeCandidate,
  CoupleSpaceInitiativeRuntimeRecord,
  CoupleSpaceInitiativeRuntimeState,
  CoupleSpaceInitiativeSettings,
} from '../../../../types';
import type { CoupleSpaceInitiativeDecisionTrace } from './coupleSpaceInitiativeDecisionTrace';
import type { CoupleSpaceInitiativeNormalizedContext } from './coupleSpaceInitiativeSignalCollector';
import {
  collectCoupleSpaceInitiativeCandidates,
} from './coupleSpaceInitiativeRunner';
import { buildCoupleSpaceInitiativeDecisionTrace } from './coupleSpaceInitiativeDecisionTrace';
import {
  pickBestCoupleSpaceInitiativeCandidate,
  sortCoupleSpaceInitiativeCandidates,
} from './coupleSpaceInitiativeScorer';

export type CoupleSpaceInitiativeSelectionResult = {
  checkedAt: number;
  runtimeState: CoupleSpaceInitiativeRuntimeState;
  rawCandidates: CoupleSpaceInitiativeCandidate[];
  sortedCandidates: CoupleSpaceInitiativeCandidate[];
  bestCandidate: CoupleSpaceInitiativeCandidate | null;
  trace?: CoupleSpaceInitiativeDecisionTrace;
};

function createEmptyNormalizedContext(): CoupleSpaceInitiativeNormalizedContext {
  return {
    replyOpportunities: {},
  };
}

export function selectCoupleSpaceInitiative(
  settings: CoupleSpaceInitiativeSettings | null | undefined,
  context: CoupleSpaceInitiativeNormalizedContext = createEmptyNormalizedContext(),
  runtimeRecords?: Partial<
    Record<CoupleSpaceInitiativeCandidate['actionType'], CoupleSpaceInitiativeRuntimeRecord>
  > | null,
  now = Date.now(),
): CoupleSpaceInitiativeSelectionResult {
  const runnerResult = collectCoupleSpaceInitiativeCandidates(settings, context, runtimeRecords, now);
  const sortedCandidates = sortCoupleSpaceInitiativeCandidates(runnerResult.candidates);
  const bestCandidate = pickBestCoupleSpaceInitiativeCandidate(sortedCandidates);

  const result: CoupleSpaceInitiativeSelectionResult = {
    checkedAt: runnerResult.checkedAt,
    runtimeState: runnerResult.runtimeState,
    rawCandidates: runnerResult.candidates,
    sortedCandidates,
    bestCandidate,
  };

  result.trace = buildCoupleSpaceInitiativeDecisionTrace(result);

  return result;
}

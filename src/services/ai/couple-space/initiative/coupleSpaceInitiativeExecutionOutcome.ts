import type { SharedCommitChannel } from '../../../execution/commitRouteTypes';
import type { RunCoupleSpaceInitiativeCandidateResult } from './runCoupleSpaceInitiativeCandidate';

type OutcomeSinkStatus = 'applied' | 'created' | 'rejected' | 'unsupported';

export function hasExecutionBoundaryChannel(
  runResult: RunCoupleSpaceInitiativeCandidateResult | null,
  channel: SharedCommitChannel,
): boolean {
  return !!runResult && 'executionBoundary' in runResult && runResult.executionBoundary.channel === channel;
}

export function matchesExecutionBoundaryOutcome(
  runResult: RunCoupleSpaceInitiativeCandidateResult | null,
  channel: SharedCommitChannel,
  sinkStatus: OutcomeSinkStatus,
): boolean {
  return (
    !!runResult &&
    runResult.executorStatus === 'accepted' &&
    hasExecutionBoundaryChannel(runResult, channel) &&
    'sinkStatus' in runResult &&
    runResult.sinkStatus === sinkStatus
  );
}

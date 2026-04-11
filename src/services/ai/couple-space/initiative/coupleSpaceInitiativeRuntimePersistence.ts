import type {
  CoupleSpaceData,
  CoupleSpaceInitiativeActionType,
  CoupleSpaceInitiativeRuntimeRecord,
} from '../../../../types';
import type { RunCoupleSpaceInitiativeCandidateResult } from './runCoupleSpaceInitiativeCandidate';
import { matchesExecutionBoundaryOutcome } from './coupleSpaceInitiativeExecutionOutcome';

function mergeRuntimeRecord(
  previous: CoupleSpaceInitiativeRuntimeRecord | undefined,
  patch: Partial<CoupleSpaceInitiativeRuntimeRecord>,
): CoupleSpaceInitiativeRuntimeRecord {
  return {
    lastTriggeredAt: patch.lastTriggeredAt ?? previous?.lastTriggeredAt ?? null,
    lastDraftedAt: patch.lastDraftedAt ?? previous?.lastDraftedAt ?? null,
    lastCommittedAt: patch.lastCommittedAt ?? previous?.lastCommittedAt ?? null,
  };
}

function getRuntimePatch(
  runResult: RunCoupleSpaceInitiativeCandidateResult | null,
  now: number,
): {
  actionType: CoupleSpaceInitiativeActionType;
  patch: Partial<CoupleSpaceInitiativeRuntimeRecord>;
} | null {
  if (!runResult || runResult.executorStatus !== 'accepted') {
    return null;
  }

  if (matchesExecutionBoundaryOutcome(runResult, 'direct_write', 'applied')) {
    return {
      actionType: runResult.actionType,
      patch: {
        lastTriggeredAt: now,
        lastCommittedAt: now,
      },
    };
  }

  if (matchesExecutionBoundaryOutcome(runResult, 'draft_buffer', 'created')) {
    return {
      actionType: runResult.actionType,
      patch: {
        lastTriggeredAt: now,
        lastDraftedAt: now,
      },
    };
  }

  if (matchesExecutionBoundaryOutcome(runResult, 'confirmation_queue', 'created')) {
    return {
      actionType: runResult.actionType,
      patch: {
        lastTriggeredAt: now,
      },
    };
  }

  return null;
}

export function applyCoupleSpaceInitiativeRuntimeResult(
  coupleSpace: CoupleSpaceData,
  runResult: RunCoupleSpaceInitiativeCandidateResult | null,
  now: number,
): CoupleSpaceData {
  const runtimeUpdate = getRuntimePatch(runResult, now);
  if (!runtimeUpdate) {
    return coupleSpace;
  }

  const previousRuntime = coupleSpace.initiativeRuntime ?? {};
  const previousRecord = previousRuntime[runtimeUpdate.actionType];

  return {
    ...coupleSpace,
    initiativeRuntime: {
      ...previousRuntime,
      [runtimeUpdate.actionType]: mergeRuntimeRecord(previousRecord, runtimeUpdate.patch),
    },
  };
}

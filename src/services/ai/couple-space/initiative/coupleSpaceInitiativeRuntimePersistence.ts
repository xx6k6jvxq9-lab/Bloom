import type {
  CoupleSpaceData,
  CoupleSpaceInitiativeActionType,
  CoupleSpaceInitiativeRuntimeRecord,
} from '../../../../types';
import type { RunCoupleSpaceInitiativeCandidateResult } from './runCoupleSpaceInitiativeCandidate';

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

  if (!('executionBoundary' in runResult)) {
    return null;
  }

  if (runResult.executionBoundary.channel === 'direct_write' && 'sinkStatus' in runResult && runResult.sinkStatus === 'applied') {
    return {
      actionType: runResult.actionType,
      patch: {
        lastTriggeredAt: now,
        lastCommittedAt: now,
      },
    };
  }

  if (runResult.executionBoundary.channel === 'draft_buffer' && 'sinkStatus' in runResult && runResult.sinkStatus === 'created') {
    return {
      actionType: runResult.actionType,
      patch: {
        lastTriggeredAt: now,
        lastDraftedAt: now,
      },
    };
  }

  if (
    runResult.executionBoundary.channel === 'confirmation_queue' &&
    'sinkStatus' in runResult &&
    runResult.sinkStatus === 'created'
  ) {
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

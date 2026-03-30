import type { CoupleSpaceData, CoupleSpaceInitiativeSettings } from '../../../../types';
import {
  collectCoupleSpaceInitiativeSignals,
  type CoupleSpaceInitiativeNormalizedContext,
  type CoupleSpaceInitiativeSignalCollectorInput,
  type CoupleSpaceInitiativeSignalCollectorResult,
} from './coupleSpaceInitiativeSignalCollector';
import {
  selectCoupleSpaceInitiative,
  type CoupleSpaceInitiativeSelectionResult,
} from './coupleSpaceInitiativeSelector';
import {
  serializeCoupleSpaceInitiativeDecisionTrace,
  type CoupleSpaceInitiativeDecisionSnapshot,
} from './coupleSpaceInitiativeTraceSerializer';
import {
  buildCoupleSpaceInitiativeExecutionPlan,
  type CoupleSpaceInitiativeExecutionPlan,
} from '../execution/coupleSpaceInitiativeExecutionPlan';
import {
  buildCoupleSpaceInitiativeCommitRoute,
  type CoupleSpaceInitiativeCommitRoute,
} from './coupleSpaceInitiativeCommitRoute';
import {
  buildCoupleSpaceInitiativeExecutionBridge,
  type CoupleSpaceInitiativeExecutionBridgeDescriptor,
} from '../execution/coupleSpaceInitiativeExecutionBridge';
import {
  evaluateCoupleSpaceInitiativeExecutionReadiness,
  type CoupleSpaceInitiativeExecutionReadinessReport,
} from '../execution/coupleSpaceInitiativeExecutionReadiness';
import {
  buildCoupleSpaceInitiativeExecutionRequest,
  type CoupleSpaceInitiativeExecutionRequest,
} from '../execution/coupleSpaceInitiativeExecutionRequest';
import {
  getCoupleSpaceInitiativeExecutorCapability,
  type CoupleSpaceInitiativeExecutorCapability,
} from '../execution/coupleSpaceInitiativeExecutorCapabilities';
import type { CoupleSpaceInitiativeExecutionContext } from '../execution/coupleSpaceInitiativeExecutor';
import {
  runCoupleSpaceInitiativeCandidate,
  type RunCoupleSpaceInitiativeCandidateResult,
} from './runCoupleSpaceInitiativeCandidate';

export type RunCoupleSpaceInitiativeHarnessInput = {
  settings: CoupleSpaceInitiativeSettings | null | undefined;
  signalInput: CoupleSpaceInitiativeSignalCollectorInput;
  executionContext?: CoupleSpaceInitiativeExecutionContext;
  coupleSpace: CoupleSpaceData;
  authorId: string;
  now?: number;
};

export type RunCoupleSpaceInitiativeHarnessResult = {
  checkedAt: number;
  signalResult: CoupleSpaceInitiativeSignalCollectorResult;
  normalizedContext: CoupleSpaceInitiativeNormalizedContext;
  selection: CoupleSpaceInitiativeSelectionResult;
  decisionSnapshot: CoupleSpaceInitiativeDecisionSnapshot | null;
  executionPlan: CoupleSpaceInitiativeExecutionPlan | null;
  commitRoute: CoupleSpaceInitiativeCommitRoute | null;
  executionBridge: CoupleSpaceInitiativeExecutionBridgeDescriptor | null;
  readiness: CoupleSpaceInitiativeExecutionReadinessReport | null;
  executionRequest: CoupleSpaceInitiativeExecutionRequest | null;
  executorCapability: CoupleSpaceInitiativeExecutorCapability | null;
  runResult: RunCoupleSpaceInitiativeCandidateResult | null;
};

/**
 * Development/test harness for one explicit couple-space initiative pass.
 *
 * Purpose:
 * - let us feed one prepared state/context bundle through the whole pipeline
 * - inspect selection, static execution descriptors, and concrete helper output
 *
 * Non-goals:
 * - not a product orchestrator
 * - not automatic scheduling
 * - no UI coupling
 */
export async function runCoupleSpaceInitiativeHarness(
  input: RunCoupleSpaceInitiativeHarnessInput,
): Promise<RunCoupleSpaceInitiativeHarnessResult> {
  const checkedAt = input.now ?? Date.now();

  const signalResult = collectCoupleSpaceInitiativeSignals({
    ...input.signalInput,
    now: checkedAt,
  });
  const normalizedContext = signalResult.normalizedContext;

  const selection = selectCoupleSpaceInitiative(input.settings, normalizedContext, checkedAt);
  const decisionSnapshot = selection.trace
    ? serializeCoupleSpaceInitiativeDecisionTrace(selection.trace)
    : null;

  const executionPlan = buildCoupleSpaceInitiativeExecutionPlan(selection.bestCandidate);
  const commitRoute = buildCoupleSpaceInitiativeCommitRoute(executionPlan);
  const executionBridge = buildCoupleSpaceInitiativeExecutionBridge(executionPlan, commitRoute);
  const readiness = evaluateCoupleSpaceInitiativeExecutionReadiness(executionBridge);
  const executionRequest = buildCoupleSpaceInitiativeExecutionRequest(executionBridge, readiness);
  const executorCapability = getCoupleSpaceInitiativeExecutorCapability(executionRequest);

  const runResult = executionRequest
    ? await runCoupleSpaceInitiativeCandidate({
        request: executionRequest,
        context: input.executionContext,
        coupleSpace: input.coupleSpace,
        authorId: input.authorId,
        now: checkedAt,
      })
    : null;

  return {
    checkedAt,
    signalResult,
    normalizedContext,
    selection,
    decisionSnapshot,
    executionPlan,
    commitRoute,
    executionBridge,
    readiness,
    executionRequest,
    executorCapability,
    runResult,
  };
}

import type {
  CoupleSpaceData,
  CoupleSpaceInitiativeSource,
} from '../../../../types';
import {
  appendFallbackStatusNote,
  buildNoCandidateStatusText,
  runPreparedCoupleSpaceInitiativeCandidates,
  type CoupleSpaceInitiativeCheckCommonContext,
} from './runCoupleSpaceInitiativeManualCheck';
import {
  buildExecutionBoundaryAwareArtifactPreview,
  buildExecutionBoundaryAwareStatusText,
} from './coupleSpaceInitiativeExecutionFeedback';
import { hasEnabledCoupleSpaceInitiatives } from './coupleSpaceTriggerPolicy';
import {
  runCoupleSpaceInitiativeDevCheck,
  type RunCoupleSpaceInitiativeDevCheckResult,
} from './runCoupleSpaceInitiativeDevCheck';
import { runCoupleSpaceInitiativeCandidate } from './runCoupleSpaceInitiativeCandidate';

export type RunCoupleSpaceInitiativeAutoCheckInput = CoupleSpaceInitiativeCheckCommonContext & {
  now?: number;
  triggerSource?: Exclude<CoupleSpaceInitiativeSource, 'manual_check'>;
};

export type RunCoupleSpaceInitiativeAutoCheckResult = {
  devCheck: RunCoupleSpaceInitiativeDevCheckResult;
  runResult: Awaited<ReturnType<typeof runCoupleSpaceInitiativeCandidate>> | null;
  nextCoupleSpace: CoupleSpaceData;
  statusText: string;
  artifactPreview: {
    kind: 'draft' | 'confirmation';
    title: string;
    content: string;
    note?: string;
  } | null;
};

/**
 * Auto-check and manual-check now intentionally share the same prepared
 * execution path, so both entrypoints consume the same unified common context.
 *
 * We keep the wrapper local to auto-check to make that dependency explicit
 * without widening this phase into a larger refactor.
 */
async function runPreparedAutoCandidates(
  input: CoupleSpaceInitiativeCheckCommonContext & {
    devCheck: RunCoupleSpaceInitiativeDevCheckResult;
    now?: number;
  },
) {
  return runPreparedCoupleSpaceInitiativeCandidates(input);
}

/**
 * Product-side auto-check service.
 *
 * Purpose:
 * - reuse the full initiative decision/execution bridge without UI coupling
 * - let higher layers trigger one proactive pass without forcing manual-check semantics
 *
 * Non-goals:
 * - no scheduling loop
 * - no UI updates
 * - no direct orchestration across multiple retries
 */
export async function runCoupleSpaceInitiativeAutoCheck(
  input: RunCoupleSpaceInitiativeAutoCheckInput,
): Promise<RunCoupleSpaceInitiativeAutoCheckResult> {
  if (!hasEnabledCoupleSpaceInitiatives(input.coupleSpace.initiativeSettings)) {
    const devCheck = await runCoupleSpaceInitiativeDevCheck({
      appSettings: input.appSettings,
      coupleSpace: input.coupleSpace,
      chatHistory: input.chatHistory,
      userId: input.user.id,
      partnerId: input.partner.id,
      authorId: input.partner.id,
      triggerSource: input.triggerSource,
      now: input.now,
    });

    return {
      devCheck,
      runResult: null,
      nextCoupleSpace: input.coupleSpace,
      statusText: buildNoCandidateStatusText(devCheck),
      artifactPreview: null,
    };
  }

  const devCheck = await runCoupleSpaceInitiativeDevCheck({
    appSettings: input.appSettings,
    coupleSpace: input.coupleSpace,
    chatHistory: input.chatHistory,
    userId: input.user.id,
    partnerId: input.partner.id,
    authorId: input.partner.id,
    triggerSource: input.triggerSource,
    now: input.now,
  });

  if (!devCheck.harnessResult.selection.sortedCandidates.length) {
    return {
      devCheck,
      runResult: null,
      nextCoupleSpace: input.coupleSpace,
      statusText: buildNoCandidateStatusText(devCheck),
      artifactPreview: null,
    };
  }

  const attemptResult = await runPreparedAutoCandidates({
    ...input,
    devCheck,
  });
  const candidate = attemptResult.candidate;
  const runResult = attemptResult.runResult;

  if (!candidate || !runResult) {
    return {
      devCheck,
      runResult: null,
      nextCoupleSpace: input.coupleSpace,
      statusText: buildNoCandidateStatusText(devCheck),
      artifactPreview: null,
    };
  }

  return {
    devCheck,
    runResult,
    nextCoupleSpace: attemptResult.nextCoupleSpace,
    statusText: appendFallbackStatusNote(
      buildExecutionBoundaryAwareStatusText(candidate, runResult),
      attemptResult.attemptedCount,
      attemptResult.usedFallbackCandidate,
    ),
    artifactPreview: buildExecutionBoundaryAwareArtifactPreview(candidate, runResult),
  };
}

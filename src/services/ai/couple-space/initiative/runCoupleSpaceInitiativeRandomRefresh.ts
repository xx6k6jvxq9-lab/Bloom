import type {
  CoupleSpaceData,
  CoupleSpaceInitiativeCandidate,
  CoupleSpaceInitiativeSource,
} from '../../../../types';
import {
  buildPreparedExecutionRequestForCandidate,
  buildCoupleSpaceInitiativeExecutionContext,
  type CoupleSpaceInitiativeCheckCommonContext,
} from './runCoupleSpaceInitiativeManualCheck';
import {
  buildCoupleSpaceInitiativeExecutionFeedback,
  type CoupleSpaceInitiativeArtifactPreview,
} from './coupleSpaceInitiativeExecutionFeedback';
import {
  runCoupleSpaceInitiativeDevCheck,
  type RunCoupleSpaceInitiativeDevCheckResult,
} from './runCoupleSpaceInitiativeDevCheck';
import {
  runCoupleSpaceInitiativeCandidate,
  type RunCoupleSpaceInitiativeCandidateResult,
} from './runCoupleSpaceInitiativeCandidate';

export type RunCoupleSpaceInitiativeRandomRefreshInput = CoupleSpaceInitiativeCheckCommonContext & {
  triggerSource?: CoupleSpaceInitiativeSource;
};

export type RunCoupleSpaceInitiativeRandomRefreshResult = {
  devCheck: RunCoupleSpaceInitiativeDevCheckResult;
  candidate: CoupleSpaceInitiativeCandidate | null;
  runResult: RunCoupleSpaceInitiativeCandidateResult | null;
  nextCoupleSpace: CoupleSpaceData;
  statusText: string;
  artifactPreview: CoupleSpaceInitiativeArtifactPreview;
};

function pickRandomCandidate(candidates: CoupleSpaceInitiativeCandidate[]) {
  if (!candidates.length) {
    return null;
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index] ?? null;
}

export async function runCoupleSpaceInitiativeRandomRefresh(
  input: RunCoupleSpaceInitiativeRandomRefreshInput,
): Promise<RunCoupleSpaceInitiativeRandomRefreshResult> {
  const devCheck = await runCoupleSpaceInitiativeDevCheck({
    appSettings: input.appSettings,
    coupleSpace: input.coupleSpace,
    chatHistory: input.chatHistory,
    userId: input.user.id,
    partnerId: input.partner.id,
    authorId: input.partner.id,
    triggerSource: input.triggerSource ?? 'manual_check',
    now: input.now,
  });

  const candidate = pickRandomCandidate(devCheck.harnessResult.selection.sortedCandidates);
  if (!candidate) {
    return {
      devCheck,
      candidate: null,
      runResult: null,
      nextCoupleSpace: input.coupleSpace,
      statusText: '当前没有可刷新的主动内容候选。',
      artifactPreview: null,
    };
  }

  const request = buildPreparedExecutionRequestForCandidate(candidate);
  if (!request) {
    return {
      devCheck,
      candidate,
      runResult: null,
      nextCoupleSpace: input.coupleSpace,
      statusText: '这次随机刷新命中了候选，但还没有准备好可执行请求。',
      artifactPreview: null,
    };
  }

  const context = buildCoupleSpaceInitiativeExecutionContext(input, candidate, devCheck);
  const runResult = await runCoupleSpaceInitiativeCandidate({
    request,
    context,
    coupleSpace: input.coupleSpace,
    authorId: input.partner.id,
    now: input.now,
  });

  return {
    devCheck,
    candidate,
    runResult,
    nextCoupleSpace:
      runResult && 'nextCoupleSpace' in runResult ? runResult.nextCoupleSpace : input.coupleSpace,
    ...buildCoupleSpaceInitiativeExecutionFeedback(candidate, runResult),
  };
}

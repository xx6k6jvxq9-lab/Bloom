import type {
  AppSettings,
  Character,
  ChatHistory,
  CoupleSpaceData,
  CoupleSpaceInitiativeCandidate,
  CoupleSpaceInitiativeSource,
  UserProfileExtended,
} from '../../../../types';
import { buildCoupleSpaceInitiativeExecutionBridge } from '../execution/coupleSpaceInitiativeExecutionBridge';
import { buildCoupleSpaceInitiativeExecutionPlan } from '../execution/coupleSpaceInitiativeExecutionPlan';
import { buildCoupleSpaceInitiativeExecutionRequest } from '../execution/coupleSpaceInitiativeExecutionRequest';
import type { CoupleSpaceInitiativeExecutionReadinessStatus } from '../execution/coupleSpaceInitiativeExecutionReadiness';
import { evaluateCoupleSpaceInitiativeExecutionReadiness } from '../execution/coupleSpaceInitiativeExecutionReadiness';
import { buildCoupleSpaceInitiativeCommitRoute } from './coupleSpaceInitiativeCommitRoute';
import {
  buildCoupleSpaceInitiativeExecutionContext,
  type CoupleSpaceInitiativeCheckCommonContext,
} from './runCoupleSpaceInitiativeManualCheck';
import {
  buildExecutionBoundaryAwareArtifactPreview,
  buildExecutionBoundaryAwareStatusText,
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
  artifactPreview: {
    kind: 'draft' | 'confirmation';
    title: string;
    content: string;
    note?: string;
  } | null;
};

function buildPreparedRequest(candidate: CoupleSpaceInitiativeCandidate) {
  const plan = buildCoupleSpaceInitiativeExecutionPlan(candidate);
  const route = buildCoupleSpaceInitiativeCommitRoute(plan);
  const bridge = buildCoupleSpaceInitiativeExecutionBridge(plan, route);
  const readiness = evaluateCoupleSpaceInitiativeExecutionReadiness(bridge);
  const request = buildCoupleSpaceInitiativeExecutionRequest(bridge, readiness);

  if (!request) {
    return null;
  }

  return {
    ...request,
    envelope: {
      ...request.envelope,
      readinessStatus:
        (request.envelope.commitMode === 'confirm' ? 'partial' : 'ready') as CoupleSpaceInitiativeExecutionReadinessStatus,
    },
    unresolvedInputs: [],
    readinessSummary:
      request.envelope.commitMode === 'confirm'
        ? 'Random refresh assembled the required execution context; this action can continue into a confirmation path.'
        : 'Random refresh assembled the required execution context and this request is ready for execution.',
    readyForExecutionBridge: true,
  };
}

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

  const request = buildPreparedRequest(candidate);
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
    statusText: buildExecutionBoundaryAwareStatusText(candidate, runResult),
    artifactPreview: buildExecutionBoundaryAwareArtifactPreview(candidate, runResult),
  };
}

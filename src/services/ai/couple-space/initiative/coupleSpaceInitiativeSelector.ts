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
  scoreCoupleSpaceInitiativeCandidate,
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

function getRuleLastActivityAt(
  runtimeState: CoupleSpaceInitiativeRuntimeState,
  actionType: CoupleSpaceInitiativeCandidate['actionType'],
): number | null {
  const rule = runtimeState.rules[actionType];
  return Math.max(
    rule.lastTriggeredAt ?? 0,
    rule.lastDraftedAt ?? 0,
    rule.lastCommittedAt ?? 0,
  ) || null;
}

function getMostRecentActionType(
  runtimeState: CoupleSpaceInitiativeRuntimeState,
): CoupleSpaceInitiativeCandidate['actionType'] | null {
  let latestActionType: CoupleSpaceInitiativeCandidate['actionType'] | null = null;
  let latestTimestamp = 0;

  for (const actionType of Object.keys(runtimeState.rules) as CoupleSpaceInitiativeCandidate['actionType'][]) {
    const lastActivityAt = getRuleLastActivityAt(runtimeState, actionType) ?? 0;
    if (lastActivityAt > latestTimestamp) {
      latestTimestamp = lastActivityAt;
      latestActionType = actionType;
    }
  }

  return latestActionType;
}

function getRecentRepeatPenalty(
  candidate: CoupleSpaceInitiativeCandidate,
  runtimeState: CoupleSpaceInitiativeRuntimeState,
  now: number,
): number {
  const lastActivityAt = getRuleLastActivityAt(runtimeState, candidate.actionType);
  if (!lastActivityAt) {
    return 0;
  }

  const elapsedHours = (now - lastActivityAt) / (1000 * 60 * 60);
  if (elapsedHours < 6) {
    return -220;
  }
  if (elapsedHours < 24) {
    return -120;
  }
  if (elapsedHours < 72) {
    return -60;
  }

  return 0;
}

function getRecentGroupPenalty(
  candidate: CoupleSpaceInitiativeCandidate,
  runtimeState: CoupleSpaceInitiativeRuntimeState,
): number {
  const mostRecentActionType = getMostRecentActionType(runtimeState);
  if (!mostRecentActionType) {
    return 0;
  }

  const mostRecentRule = runtimeState.rules[mostRecentActionType];
  if (mostRecentRule.group !== candidate.group) {
    return 0;
  }

  if (candidate.group === 'memo') {
    return -90;
  }

  return -45;
}

function getPublishingVarietyBonus(
  candidate: CoupleSpaceInitiativeCandidate,
  runtimeState: CoupleSpaceInitiativeRuntimeState,
): number {
  if (candidate.group !== 'publishing') {
    return 0;
  }

  const mostRecentActionType = getMostRecentActionType(runtimeState);
  if (!mostRecentActionType) {
    return 0;
  }

  return runtimeState.rules[mostRecentActionType].group === 'memo' ? 70 : 0;
}

function getCandidateSelectionScore(
  candidate: CoupleSpaceInitiativeCandidate,
  runtimeState: CoupleSpaceInitiativeRuntimeState,
  now: number,
): number {
  return (
    scoreCoupleSpaceInitiativeCandidate(candidate) +
    getRecentRepeatPenalty(candidate, runtimeState, now) +
    getRecentGroupPenalty(candidate, runtimeState) +
    getPublishingVarietyBonus(candidate, runtimeState)
  );
}

function sortCandidatesForSelection(
  candidates: CoupleSpaceInitiativeCandidate[],
  runtimeState: CoupleSpaceInitiativeRuntimeState,
  now: number,
): CoupleSpaceInitiativeCandidate[] {
  return [...candidates].sort((a, b) => {
    const scoreDiff =
      getCandidateSelectionScore(b, runtimeState, now) -
      getCandidateSelectionScore(a, runtimeState, now);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const baseScoreDiff =
      scoreCoupleSpaceInitiativeCandidate(b) - scoreCoupleSpaceInitiativeCandidate(a);

    if (baseScoreDiff !== 0) {
      return baseScoreDiff;
    }

    return a.actionType.localeCompare(b.actionType);
  });
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
  const baseSortedCandidates = sortCoupleSpaceInitiativeCandidates(runnerResult.candidates);
  const sortedCandidates = sortCandidatesForSelection(
    baseSortedCandidates,
    runnerResult.runtimeState,
    now,
  );
  const bestCandidate = sortedCandidates[0] ?? pickBestCoupleSpaceInitiativeCandidate(baseSortedCandidates);

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

import type { CoupleSpaceInitiativeCandidate } from '../../../../types';
import type { CoupleSpaceInitiativeSelectionResult } from './coupleSpaceInitiativeSelector';
import {
  getCoupleSpaceInitiativeCandidateScoreFactors,
  scoreCoupleSpaceInitiativeCandidate,
  type CoupleSpaceInitiativeScoreFactor,
} from './coupleSpaceInitiativeScorer';

export type CoupleSpaceInitiativeRankingFactor = CoupleSpaceInitiativeScoreFactor;

export type CoupleSpaceInitiativeCandidateTrace = {
  candidate: CoupleSpaceInitiativeCandidate;
  rawIndex: number;
  sortedIndex: number;
  score: number;
  rankingFactors: CoupleSpaceInitiativeRankingFactor[];
  enteredDecisionChainBecause: string;
  selected: boolean;
};

export type CoupleSpaceInitiativeSelectionExplanation = {
  bestCandidateActionType: CoupleSpaceInitiativeCandidate['actionType'] | null;
  bestCandidateReason: string | null;
  tieBreakNote?: string;
  summary: string;
};

export type CoupleSpaceInitiativeDecisionTrace = {
  checkedAt: number;
  rawCandidateCount: number;
  sortedCandidateCount: number;
  candidates: CoupleSpaceInitiativeCandidateTrace[];
  selection: CoupleSpaceInitiativeSelectionExplanation;
};

function buildCandidateTrace(
  candidate: CoupleSpaceInitiativeCandidate,
  rawCandidates: CoupleSpaceInitiativeCandidate[],
  sortedCandidates: CoupleSpaceInitiativeCandidate[],
  bestCandidate: CoupleSpaceInitiativeCandidate | null,
): CoupleSpaceInitiativeCandidateTrace {
  return {
    candidate,
    rawIndex: rawCandidates.findIndex((item) => item === candidate),
    sortedIndex: sortedCandidates.findIndex((item) => item === candidate),
    score: scoreCoupleSpaceInitiativeCandidate(candidate),
    rankingFactors: getCoupleSpaceInitiativeCandidateScoreFactors(candidate),
    enteredDecisionChainBecause: candidate.reason ?? 'Candidate entered the decision chain without an explicit reason string.',
    selected: bestCandidate === candidate,
  };
}

export function buildCoupleSpaceInitiativeDecisionTrace(
  result: Omit<CoupleSpaceInitiativeSelectionResult, 'trace'>,
): CoupleSpaceInitiativeDecisionTrace {
  const candidateTraces = result.sortedCandidates.map((candidate) =>
    buildCandidateTrace(candidate, result.rawCandidates, result.sortedCandidates, result.bestCandidate),
  );

  const bestCandidateTrace = candidateTraces.find((item) => item.selected);
  const secondCandidateTrace = candidateTraces[1];

  const selection: CoupleSpaceInitiativeSelectionExplanation = result.bestCandidate
    ? {
        bestCandidateActionType: result.bestCandidate.actionType,
        bestCandidateReason: result.bestCandidate.reason ?? null,
        tieBreakNote:
          bestCandidateTrace && secondCandidateTrace && bestCandidateTrace.score === secondCandidateTrace.score
            ? 'Top candidates share the same score, so stable fallback ordering applies.'
            : undefined,
        summary: `Selected ${result.bestCandidate.actionType} as the current best candidate with score ${
          bestCandidateTrace?.score ?? scoreCoupleSpaceInitiativeCandidate(result.bestCandidate)
        }.`,
      }
    : {
        bestCandidateActionType: null,
        bestCandidateReason: null,
        summary: 'No initiative candidate qualified for selection in this decision pass.',
      };

  return {
    checkedAt: result.checkedAt,
    rawCandidateCount: result.rawCandidates.length,
    sortedCandidateCount: result.sortedCandidates.length,
    candidates: candidateTraces,
    selection,
  };
}

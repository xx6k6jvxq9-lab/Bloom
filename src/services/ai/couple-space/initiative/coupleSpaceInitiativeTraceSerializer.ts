import type {
  CoupleSpaceInitiativeActionType,
  CoupleSpaceCommitMode,
  CoupleSpaceInitiativeGroup,
  CoupleSpaceInitiativeSource,
} from '../../../../types';
import type {
  CoupleSpaceInitiativeDecisionTrace,
  CoupleSpaceInitiativeRankingFactor,
} from './coupleSpaceInitiativeDecisionTrace';

export type CoupleSpaceInitiativeRankingFactorSnapshot = {
  kind: CoupleSpaceInitiativeRankingFactor['kind'];
  label: string;
  value: string;
  score: number;
};

export type CoupleSpaceInitiativeCandidateSnapshot = {
  actionType: CoupleSpaceInitiativeActionType;
  group: CoupleSpaceInitiativeGroup;
  commitMode: CoupleSpaceCommitMode;
  source: CoupleSpaceInitiativeSource;
  selected: boolean;
  rawIndex: number;
  sortedIndex: number;
  score: number;
  reason?: string;
  evidenceSummary?: string;
  rankingFactorSummaries: CoupleSpaceInitiativeRankingFactorSnapshot[];
};

export type CoupleSpaceInitiativeSelectionSnapshot = {
  actionType: CoupleSpaceInitiativeActionType | null;
  group: CoupleSpaceInitiativeGroup | null;
  commitMode: CoupleSpaceCommitMode | null;
  source: CoupleSpaceInitiativeSource | null;
  reason: string | null;
  summary: string;
  tieBreakNote?: string;
};

export type CoupleSpaceInitiativeDecisionSnapshot = {
  checkedAt: number;
  rawCandidateCount: number;
  sortedCandidateCount: number;
  selectedActionType: CoupleSpaceInitiativeActionType | null;
  selectedGroup: CoupleSpaceInitiativeGroup | null;
  selectedCommitMode: CoupleSpaceCommitMode | null;
  selectedReason: string | null;
  selection: CoupleSpaceInitiativeSelectionSnapshot;
  candidateSummaries: CoupleSpaceInitiativeCandidateSnapshot[];
};

function serializeRankingFactor(
  factor: CoupleSpaceInitiativeRankingFactor,
): CoupleSpaceInitiativeRankingFactorSnapshot {
  return {
    kind: factor.kind,
    label: factor.label,
    value: factor.value,
    score: factor.score,
  };
}

export function serializeCoupleSpaceInitiativeDecisionTrace(
  trace: CoupleSpaceInitiativeDecisionTrace,
): CoupleSpaceInitiativeDecisionSnapshot {
  const selectedCandidate = trace.candidates.find((candidate) => candidate.selected);

  return {
    checkedAt: trace.checkedAt,
    rawCandidateCount: trace.rawCandidateCount,
    sortedCandidateCount: trace.sortedCandidateCount,
    selectedActionType: selectedCandidate?.candidate.actionType ?? null,
    selectedGroup: selectedCandidate?.candidate.group ?? null,
    selectedCommitMode: selectedCandidate?.candidate.commitMode ?? null,
    selectedReason: trace.selection.bestCandidateReason,
    selection: {
      actionType: selectedCandidate?.candidate.actionType ?? null,
      group: selectedCandidate?.candidate.group ?? null,
      commitMode: selectedCandidate?.candidate.commitMode ?? null,
      source: selectedCandidate?.candidate.source ?? null,
      reason: trace.selection.bestCandidateReason,
      summary: trace.selection.summary,
      tieBreakNote: trace.selection.tieBreakNote,
    },
    candidateSummaries: trace.candidates.map((candidateTrace) => ({
      actionType: candidateTrace.candidate.actionType,
      group: candidateTrace.candidate.group,
      commitMode: candidateTrace.candidate.commitMode,
      source: candidateTrace.candidate.source,
      selected: candidateTrace.selected,
      rawIndex: candidateTrace.rawIndex,
      sortedIndex: candidateTrace.sortedIndex,
      score: candidateTrace.score,
      reason: candidateTrace.candidate.reason,
      evidenceSummary: candidateTrace.candidate.evidenceSummary,
      rankingFactorSummaries: candidateTrace.rankingFactors.map(serializeRankingFactor),
    })),
  };
}

export function formatCoupleSpaceInitiativeDecisionTrace(
  trace: CoupleSpaceInitiativeDecisionTrace,
): string {
  const snapshot = serializeCoupleSpaceInitiativeDecisionTrace(trace);
  const candidateLines = snapshot.candidateSummaries.map((candidate, index) => {
    const factorSummary = candidate.rankingFactorSummaries
      .map((factor) => `${factor.kind}:${factor.score}`)
      .join(', ');

    return `${index + 1}. ${candidate.actionType} [${candidate.group}] score=${candidate.score} source=${candidate.source} commit=${candidate.commitMode}${candidate.selected ? ' selected' : ''}${candidate.reason ? ` reason=${candidate.reason}` : ''}${candidate.evidenceSummary ? ` evidence=${candidate.evidenceSummary}` : ''}${factorSummary ? ` factors=${factorSummary}` : ''}`;
  });

  const lines = [
    `checkedAt=${snapshot.checkedAt}`,
    `candidates=${snapshot.sortedCandidateCount}/${snapshot.rawCandidateCount}`,
    `selected=${snapshot.selectedActionType ?? 'none'}`,
    `selectionSummary=${snapshot.selection.summary}`,
    ...candidateLines,
  ];

  if (snapshot.selection.tieBreakNote) {
    lines.splice(4, 0, `tieBreak=${snapshot.selection.tieBreakNote}`);
  }

  return lines.join('\n');
}

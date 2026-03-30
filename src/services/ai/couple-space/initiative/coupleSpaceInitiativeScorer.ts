import type {
  CoupleSpaceInitiativeCandidate,
  CoupleSpaceInitiativeGroup,
  CoupleSpaceInitiativeSource,
} from '../../../../types';

export type CoupleSpaceInitiativeScoreFactor = {
  kind:
    | 'group'
    | 'source'
    | 'actionType'
    | 'commitMode'
    | 'reason'
    | 'evidenceSummary';
  label: string;
  value: string;
  score: number;
};

const GROUP_PRIORITY: Record<CoupleSpaceInitiativeGroup, number> = {
  interaction: 400,
  memo: 300,
  publishing: 200,
  recording: 100,
};

const SOURCE_PRIORITY: Record<CoupleSpaceInitiativeSource, number> = {
  reply_opportunity: 120,
  explicit_evidence: 100,
  light_evidence: 90,
  recent_interaction: 80,
  manual_check: 60,
  cadence_window: 40,
};

const ACTION_PRIORITY: Record<CoupleSpaceInitiativeCandidate['actionType'], number> = {
  reply_love_letter: 90,
  reply_message_board: 80,
  reply_daily_comment: 70,
  react_to_existing_post: 60,
  write_co_note: 70,
  post_couple_daily: 60,
  post_message_board_entry: 50,
  write_love_letter: 40,
  create_ledger_entry: 10,
};

const COMMIT_MODE_ADJUSTMENT: Record<CoupleSpaceInitiativeCandidate['commitMode'], number> = {
  auto: 20,
  draft: 10,
  confirm: -80,
};

function getMetadataCompletenessBonus(candidate: CoupleSpaceInitiativeCandidate): number {
  let score = 0;

  if (candidate.reason?.trim()) {
    score += 8;
  }

  if (candidate.evidenceSummary?.trim()) {
    score += 12;
  }

  return score;
}

export function getCoupleSpaceInitiativeCandidateScoreFactors(
  candidate: CoupleSpaceInitiativeCandidate,
): CoupleSpaceInitiativeScoreFactor[] {
  const factors: CoupleSpaceInitiativeScoreFactor[] = [
    {
      kind: 'group',
      label: 'Group priority',
      value: candidate.group,
      score: GROUP_PRIORITY[candidate.group],
    },
    {
      kind: 'source',
      label: 'Source priority',
      value: candidate.source,
      score: SOURCE_PRIORITY[candidate.source],
    },
    {
      kind: 'actionType',
      label: 'Action priority',
      value: candidate.actionType,
      score: ACTION_PRIORITY[candidate.actionType],
    },
    {
      kind: 'commitMode',
      label: 'Commit mode adjustment',
      value: candidate.commitMode,
      score: COMMIT_MODE_ADJUSTMENT[candidate.commitMode],
    },
  ];

  if (candidate.reason?.trim()) {
    factors.push({
      kind: 'reason',
      label: 'Reason completeness bonus',
      value: 'present',
      score: 8,
    });
  }

  if (candidate.evidenceSummary?.trim()) {
    factors.push({
      kind: 'evidenceSummary',
      label: 'Evidence summary bonus',
      value: 'present',
      score: 12,
    });
  }

  return factors;
}

export function scoreCoupleSpaceInitiativeCandidate(
  candidate: CoupleSpaceInitiativeCandidate,
): number {
  return getCoupleSpaceInitiativeCandidateScoreFactors(candidate).reduce(
    (total, factor) => total + factor.score,
    0,
  );
}

export function sortCoupleSpaceInitiativeCandidates(
  candidates: CoupleSpaceInitiativeCandidate[],
): CoupleSpaceInitiativeCandidate[] {
  return [...candidates].sort((a, b) => {
    const scoreDiff =
      scoreCoupleSpaceInitiativeCandidate(b) - scoreCoupleSpaceInitiativeCandidate(a);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return a.actionType.localeCompare(b.actionType);
  });
}

export function pickBestCoupleSpaceInitiativeCandidate(
  candidates: CoupleSpaceInitiativeCandidate[],
): CoupleSpaceInitiativeCandidate | null {
  return sortCoupleSpaceInitiativeCandidates(candidates)[0] ?? null;
}

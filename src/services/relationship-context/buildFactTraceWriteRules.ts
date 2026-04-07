import type {
  FactTraceConfidence,
  FactTraceDecayHint,
  FactTraceRecord,
  FactTraceStability,
  FactTraceType,
  FactTraceVisibility,
  FactTraceSourceScene,
  FactTraceSubjectType,
} from './factTypes';

export type FactTraceWriteCandidate = {
  sourceScene: FactTraceSourceScene;
  factType: FactTraceType;
  subjectType: FactTraceSubjectType;
  subjectId: string;
  relatedCharacterIds?: string[];
  groupId?: string;
  visibility: FactTraceVisibility;
  stability: FactTraceStability;
  confidence: FactTraceConfidence;
  summary: string;
  timestamp?: number;
  decayHint?: FactTraceDecayHint;
  isExplicit?: boolean;
  isPublic?: boolean;
};

export type FactTraceWriteDecision =
  | {
      shouldWrite: true;
      record: FactTraceRecord;
    }
  | {
      shouldWrite: false;
      reason:
        | 'missing-summary'
        | 'noise'
        | 'non-public-group-fact'
        | 'low-signal-inferred'
        | 'missing-group-id'
        | 'unsupported-fact-type';
    };

const NOISE_PATTERNS = [/^ok$/i, /^好的$/, /^嗯+$/, /^哈哈+$/, /^test$/i, /^[0-9+\-*/\s]+$/];

function isNoisySummary(summary: string) {
  const normalized = summary.trim();
  if (!normalized) return true;
  if (normalized.length <= 4) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getDefaultDecayHint(
  factType: FactTraceType,
  stability: FactTraceStability,
): FactTraceDecayHint {
  if (factType === 'background' || stability === 'stable') {
    return 'stable';
  }

  if (factType === 'experience' || stability === 'situational') {
    return 'medium';
  }

  return 'short';
}

export function decideFactTraceWrite(
  candidate: FactTraceWriteCandidate,
): FactTraceWriteDecision {
  const summary = candidate.summary.trim();

  if (!summary) {
    return { shouldWrite: false, reason: 'missing-summary' };
  }

  if (
    candidate.factType !== 'preference' &&
    candidate.factType !== 'plan' &&
    candidate.factType !== 'status' &&
    candidate.factType !== 'experience' &&
    candidate.factType !== 'background'
  ) {
    return { shouldWrite: false, reason: 'unsupported-fact-type' };
  }

  if (isNoisySummary(summary)) {
    return { shouldWrite: false, reason: 'noise' };
  }

  if (candidate.visibility === 'group_public' && !candidate.groupId) {
    return { shouldWrite: false, reason: 'missing-group-id' };
  }

  if (candidate.visibility === 'group_public' && !candidate.isPublic) {
    return { shouldWrite: false, reason: 'non-public-group-fact' };
  }

  if (!candidate.isExplicit && candidate.confidence === 'inferred' && candidate.stability !== 'stable') {
    return { shouldWrite: false, reason: 'low-signal-inferred' };
  }

  return {
    shouldWrite: true,
    record: {
      sourceScene: candidate.sourceScene,
      factType: candidate.factType,
      subjectType: candidate.subjectType,
      subjectId: candidate.subjectId,
      relatedCharacterIds: candidate.relatedCharacterIds,
      groupId: candidate.groupId,
      visibility: candidate.visibility,
      stability: candidate.stability,
      confidence: candidate.confidence,
      summary,
      timestamp: candidate.timestamp ?? Date.now(),
      decayHint: candidate.decayHint ?? getDefaultDecayHint(candidate.factType, candidate.stability),
    },
  };
}

import type {
  RelationshipWaveDecayHint,
  RelationshipWaveEventKind,
  RelationshipWaveIntensity,
  RelationshipWaveRecord,
  RelationshipWaveRelationType,
  RelationshipWaveScope,
  RelationshipWaveSourceScene,
  RelationshipWaveValence,
} from './types';

export type RelationshipWaveWriteCandidate = {
  sourceScene: RelationshipWaveSourceScene;
  relationType: RelationshipWaveRelationType;
  sourceCharacterId: string;
  targetCharacterId?: string;
  targetUser?: boolean;
  groupId?: string;
  eventKind: RelationshipWaveEventKind;
  valence: RelationshipWaveValence;
  intensity: RelationshipWaveIntensity;
  scope: RelationshipWaveScope;
  summary: string;
  timestamp?: number;
  decayHint?: RelationshipWaveDecayHint;
  isExplicit?: boolean;
  isPublic?: boolean;
};

export type RelationshipWaveWriteDecision =
  | {
      shouldWrite: true;
      record: RelationshipWaveRecord;
    }
  | {
      shouldWrite: false;
      reason:
        | 'missing-summary'
        | 'noise'
        | 'low-signal-private'
        | 'non-public-group-event'
        | 'unsupported-relation';
    };

const NOISE_PATTERNS = [
  /哈哈|呵呵|嘿嘿/,
  /在吗|干嘛|好的|行吧/,
  /测试|test/i,
  /1+|2+|3+/,
];

function isNoisySummary(summary: string) {
  const normalized = summary.trim();
  if (!normalized) return true;
  if (normalized.length <= 4) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getDefaultDecayHint(
  eventKind: RelationshipWaveEventKind,
  intensity: RelationshipWaveIntensity,
): RelationshipWaveDecayHint {
  if (eventKind === 'bonding' || eventKind === 'shared_experience') {
    return intensity === 'high' ? 'stable' : 'medium';
  }

  if (eventKind === 'conflict' || eventKind === 'reconcile' || eventKind === 'jealousy') {
    return intensity === 'low' ? 'short' : 'medium';
  }

  return intensity === 'high' ? 'medium' : 'short';
}

export function decideRelationshipWaveWrite(
  candidate: RelationshipWaveWriteCandidate,
): RelationshipWaveWriteDecision {
  const summary = candidate.summary.trim();

  if (!summary) {
    return { shouldWrite: false, reason: 'missing-summary' };
  }

  if (candidate.relationType === 'public_group_event' && !candidate.isPublic) {
    return { shouldWrite: false, reason: 'non-public-group-event' };
  }

  if (
    candidate.relationType !== 'character_user' &&
    candidate.relationType !== 'character_character' &&
    candidate.relationType !== 'public_group_event'
  ) {
    return { shouldWrite: false, reason: 'unsupported-relation' };
  }

  if (isNoisySummary(summary)) {
    return { shouldWrite: false, reason: 'noise' };
  }

  if (
    !candidate.isExplicit &&
    candidate.intensity === 'low' &&
    candidate.scope === 'private' &&
    candidate.relationType !== 'character_user'
  ) {
    return { shouldWrite: false, reason: 'low-signal-private' };
  }

  return {
    shouldWrite: true,
    record: {
      sourceScene: candidate.sourceScene,
      relationType: candidate.relationType,
      sourceCharacterId: candidate.sourceCharacterId,
      targetCharacterId: candidate.targetCharacterId,
      targetUser: candidate.targetUser,
      groupId: candidate.groupId,
      eventKind: candidate.eventKind,
      valence: candidate.valence,
      intensity: candidate.intensity,
      scope: candidate.scope,
      summary,
      timestamp: candidate.timestamp ?? Date.now(),
      decayHint: candidate.decayHint ?? getDefaultDecayHint(candidate.eventKind, candidate.intensity),
    },
  };
}

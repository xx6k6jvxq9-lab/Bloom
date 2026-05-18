import type {
  Character,
  GroupOfflineRecruitDecision,
  GroupOfflineRecruitDraft,
  GroupOfflineRecruitResponseRecord,
} from '../../types';

function dedupeIds(value: string[] | undefined): string[] {
  return Array.from(new Set((value || []).filter((item) => typeof item === 'string' && item.trim().length > 0)));
}

export function normalizeGroupOfflineRecruitResponses(
  value: GroupOfflineRecruitResponseRecord[] | undefined,
): GroupOfflineRecruitResponseRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const responseByCharacterId = new Map<string, GroupOfflineRecruitResponseRecord>();
  value.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const characterId = typeof item.characterId === 'string' ? item.characterId.trim() : '';
    const decision = item.decision === 'join' || item.decision === 'decline'
      ? item.decision
      : null;
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    const respondedAt = typeof item.respondedAt === 'number' && Number.isFinite(item.respondedAt)
      ? item.respondedAt
      : null;
    if (!characterId || !decision || !text || respondedAt === null) {
      return;
    }

    const previous = responseByCharacterId.get(characterId);
    if (!previous || previous.respondedAt <= respondedAt) {
      responseByCharacterId.set(characterId, {
        characterId,
        decision,
        text,
        respondedAt,
      });
    }
  });

  return Array.from(responseByCharacterId.values())
    .sort((left, right) => left.respondedAt - right.respondedAt);
}

export function mergeGroupOfflineRecruitResponses(
  existing: GroupOfflineRecruitResponseRecord[] | undefined,
  incoming: GroupOfflineRecruitResponseRecord[] | undefined,
): GroupOfflineRecruitResponseRecord[] {
  return normalizeGroupOfflineRecruitResponses([
    ...normalizeGroupOfflineRecruitResponses(existing),
    ...normalizeGroupOfflineRecruitResponses(incoming),
  ]);
}

export function getGroupOfflineRecruitCandidateIds(
  draft: Pick<GroupOfflineRecruitDraft, 'selectedParticipantIds'>,
  fallbackCandidateIds?: string[],
): string[] {
  const selectedIds = dedupeIds(draft.selectedParticipantIds);
  return selectedIds.length > 0
    ? selectedIds
    : dedupeIds(fallbackCandidateIds);
}

export function getGroupOfflineRecruitJoinedIds(
  draft: Pick<GroupOfflineRecruitDraft, 'signedUpParticipantIds' | 'confirmedParticipantIds' | 'recruitResponses'>,
): string[] {
  const normalizedResponses = normalizeGroupOfflineRecruitResponses(draft.recruitResponses);
  if (normalizedResponses.length > 0) {
    return normalizedResponses
      .filter((item) => item.decision === 'join')
      .map((item) => item.characterId);
  }

  const signedUpIds = dedupeIds(draft.signedUpParticipantIds);
  if (signedUpIds.length > 0) {
    return signedUpIds;
  }

  return dedupeIds(draft.confirmedParticipantIds);
}

export function getGroupOfflineRecruitDeclinedIds(
  draft: Pick<GroupOfflineRecruitDraft, 'recruitResponses'>,
): string[] {
  return normalizeGroupOfflineRecruitResponses(draft.recruitResponses)
    .filter((item) => item.decision === 'decline')
    .map((item) => item.characterId);
}

export function getGroupOfflineRecruitPendingIds(params: {
  draft: Pick<GroupOfflineRecruitDraft, 'selectedParticipantIds' | 'signedUpParticipantIds' | 'confirmedParticipantIds' | 'recruitResponses'>;
  fallbackCandidateIds?: string[];
}): string[] {
  const candidateIds = getGroupOfflineRecruitCandidateIds(params.draft, params.fallbackCandidateIds);
  const joinedIds = new Set(getGroupOfflineRecruitJoinedIds(params.draft));
  const declinedIds = new Set(getGroupOfflineRecruitDeclinedIds(params.draft));

  return candidateIds.filter((characterId) => !joinedIds.has(characterId) && !declinedIds.has(characterId));
}

export function getGroupOfflineRecruitJoinedLabels(
  joinedIds: string[],
  members: Array<Pick<Character, 'id' | 'name' | 'remarkName'>>,
): string[] {
  return members
    .filter((member) => joinedIds.includes(member.id))
    .map((member) => member.remarkName?.trim() || member.name);
}

export function buildGroupOfflineRecruitStatusSummary(params: {
  draft: Pick<GroupOfflineRecruitDraft, 'selectedParticipantIds' | 'signedUpParticipantIds' | 'confirmedParticipantIds' | 'recruitResponses'>;
  fallbackCandidateIds?: string[];
  members?: Array<Pick<Character, 'id' | 'name' | 'remarkName'>>;
}) {
  const candidateIds = getGroupOfflineRecruitCandidateIds(params.draft, params.fallbackCandidateIds);
  const joinedIds = getGroupOfflineRecruitJoinedIds(params.draft);
  const declinedIds = getGroupOfflineRecruitDeclinedIds(params.draft);
  const pendingIds = getGroupOfflineRecruitPendingIds({
    draft: params.draft,
    fallbackCandidateIds: params.fallbackCandidateIds,
  });
  const joinedLabels = params.members
    ? getGroupOfflineRecruitJoinedLabels(joinedIds, params.members)
    : [];

  return {
    candidateIds,
    joinedIds,
    declinedIds,
    pendingIds,
    joinedLabels,
    invitedCount: candidateIds.length,
    joinedCount: joinedIds.length,
    declinedCount: declinedIds.length,
    pendingCount: pendingIds.length,
    respondedCount: joinedIds.length + declinedIds.length,
  };
}

export function applyGroupOfflineRecruitResponsesToDraft(params: {
  draft: GroupOfflineRecruitDraft;
  incomingResponses: Array<{
    characterId: string;
    decision: GroupOfflineRecruitDecision;
    text: string;
    respondedAt: number;
  }>;
  fallbackCandidateIds?: string[];
  members?: Array<Pick<Character, 'id' | 'name' | 'remarkName'>>;
}): GroupOfflineRecruitDraft {
  const recruitResponses = mergeGroupOfflineRecruitResponses(
    params.draft.recruitResponses,
    params.incomingResponses,
  );
  const summary = buildGroupOfflineRecruitStatusSummary({
    draft: {
      ...params.draft,
      recruitResponses,
    },
    fallbackCandidateIds: params.fallbackCandidateIds,
    members: params.members,
  });

  return {
    ...params.draft,
    recruitResponses,
    signedUpParticipantIds: summary.joinedIds,
    participantLabels: summary.joinedLabels,
  };
}

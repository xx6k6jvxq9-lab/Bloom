export type GroupOfflineRecruitDecision = 'join' | 'decline';

export type GroupOfflineRecruitResponse = {
  characterId: string;
  decision: GroupOfflineRecruitDecision;
  text: string;
};

function extractCandidateJsonObjects(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const candidates: string[] = [];
  const seen = new Set<string>();
  const pushCandidate = (value: string | undefined) => {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    pushCandidate(trimmed);
  }

  const fencedBlocks = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const block of fencedBlocks) {
    pushCandidate(block[1]);
  }

  return candidates;
}

function normalizeDecision(value: string | undefined): GroupOfflineRecruitDecision | null {
  const normalized = (value || '').trim().toLowerCase();
  if (
    normalized === 'join'
    || normalized === 'accept'
    || normalized === 'signup'
    || normalized === 'attend'
    || normalized === 'yes'
    || normalized === '参加'
    || normalized === '报名'
  ) {
    return 'join';
  }
  if (
    normalized === 'decline'
    || normalized === 'reject'
    || normalized === 'pass'
    || normalized === 'no'
    || normalized === '不参加'
    || normalized === '婉拒'
  ) {
    return 'decline';
  }
  return null;
}

function dedupeResponses(responses: GroupOfflineRecruitResponse[]): GroupOfflineRecruitResponse[] {
  const seen = new Set<string>();
  return responses.filter((response) => {
    const key = response.characterId.trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function parseStructuredReactions(candidate: string): GroupOfflineRecruitResponse[] {
  const parsed = JSON.parse(candidate) as {
    reactions?: Array<{ characterId?: string; decision?: string; text?: string }>;
    signups?: Array<{ characterId?: string; text?: string }>;
    declines?: Array<{ characterId?: string; text?: string }>;
  };

  const reactions = Array.isArray(parsed.reactions)
    ? parsed.reactions
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const characterId = typeof item.characterId === 'string' ? item.characterId.trim() : '';
          const decision = normalizeDecision(typeof item.decision === 'string' ? item.decision : undefined);
          const text = typeof item.text === 'string' ? item.text.trim() : '';
          if (!characterId || !decision || !text) return null;
          return {
            characterId,
            decision,
            text,
          } satisfies GroupOfflineRecruitResponse;
        })
        .filter((item): item is GroupOfflineRecruitResponse => !!item)
    : [];

  if (reactions.length > 0) {
    return dedupeResponses(reactions);
  }

  const legacyJoinResponses = Array.isArray(parsed.signups)
    ? parsed.signups
        .map((item): GroupOfflineRecruitResponse | null => {
          if (!item || typeof item !== 'object') return null;
          const characterId = typeof item.characterId === 'string' ? item.characterId.trim() : '';
          const text = typeof item.text === 'string' ? item.text.trim() : '';
          if (!characterId || !text) return null;
          return {
            characterId,
            decision: 'join' as const,
            text,
          };
        })
        .filter((item): item is GroupOfflineRecruitResponse => !!item)
    : [];

  const legacyDeclineResponses = Array.isArray(parsed.declines)
    ? parsed.declines
        .map((item): GroupOfflineRecruitResponse | null => {
          if (!item || typeof item !== 'object') return null;
          const characterId = typeof item.characterId === 'string' ? item.characterId.trim() : '';
          const text = typeof item.text === 'string' ? item.text.trim() : '';
          if (!characterId || !text) return null;
          return {
            characterId,
            decision: 'decline' as const,
            text,
          };
        })
        .filter((item): item is GroupOfflineRecruitResponse => !!item)
    : [];

  return dedupeResponses([...legacyJoinResponses, ...legacyDeclineResponses]);
}

export function parseGroupOfflineRecruitResponses(rawText: string): GroupOfflineRecruitResponse[] {
  const candidates = extractCandidateJsonObjects(rawText);
  for (const candidate of candidates) {
    try {
      const responses = parseStructuredReactions(candidate);
      if (responses.length > 0) {
        return responses;
      }
    } catch {
      continue;
    }
  }

  return [];
}

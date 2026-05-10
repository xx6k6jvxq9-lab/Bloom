import type { ChatMessage, CoupleSpaceData } from '../../types';

const COUPLE_SPACE_INVITE_ACCEPTED_TOKEN = '[COUPLE_SPACE_INVITE_ACCEPTED]';

function normalizePartnerId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function collectPartnerIds(coupleSpace?: CoupleSpaceData | null): string[] {
  const seen = new Set<string>();
  const partnerIds: string[] = [];

  const append = (value: unknown) => {
    const partnerId = normalizePartnerId(value);
    if (!partnerId || seen.has(partnerId)) {
      return;
    }
    seen.add(partnerId);
    partnerIds.push(partnerId);
  };

  append(coupleSpace?.partnerId);
  for (const partnerId of coupleSpace?.addedPartnerIds ?? []) {
    append(partnerId);
  }

  return partnerIds;
}

export function hasAcceptedCoupleSpaceInviteInHistory(
  history: ChatMessage[] | null | undefined,
): boolean {
  return (history ?? []).some((message) => (
    !message?.isSystem
    && !message?.isRecalled
    && (
      message.contentType === 'couple-space-invite-accepted'
      || (message.text || '').trim() === COUPLE_SPACE_INVITE_ACCEPTED_TOKEN
    )
  ));
}

export function hasOpenedCoupleSpaceForCharacter(params: {
  characterId: string;
  coupleSpace?: CoupleSpaceData | null;
  history?: ChatMessage[] | null;
  isDismissed?: boolean;
}): boolean {
  if (params.isDismissed) {
    return false;
  }

  const partnerIds = collectPartnerIds(params.coupleSpace);
  if (partnerIds.includes(params.characterId)) {
    return true;
  }

  return hasAcceptedCoupleSpaceInviteInHistory(params.history);
}

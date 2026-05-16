import type { ChatGroup } from '../../types';

export const GROUP_ADMIN_NOMINATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type GroupAdminNominationCooldownEntry = NonNullable<ChatGroup['adminNominationCooldowns']>[number];

type GroupGovernanceCooldownSanitizeOptions = {
  memberIds: string[];
};

function getAdminNominationCooldownEntries(
  group: Pick<ChatGroup, 'adminNominationCooldowns'>,
): GroupAdminNominationCooldownEntry[] {
  return Array.isArray(group.adminNominationCooldowns) ? group.adminNominationCooldowns : [];
}

export function sanitizeAdminNominationCooldowns(
  entries: unknown,
  options: GroupGovernanceCooldownSanitizeOptions,
): GroupAdminNominationCooldownEntry[] | undefined {
  if (!Array.isArray(entries)) {
    return undefined;
  }

  const validMemberIds = new Set(options.memberIds);
  const seen = new Set<string>();

  const sanitizedEntries = entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const memberId = typeof (entry as { memberId?: unknown }).memberId === 'string'
        ? (entry as { memberId: string }).memberId.trim()
        : '';
      const cooldownUntil = (entry as { cooldownUntil?: unknown }).cooldownUntil;
      const updatedAt = (entry as { updatedAt?: unknown }).updatedAt;

      if (
        !memberId
        || seen.has(memberId)
        || !validMemberIds.has(memberId)
        || typeof cooldownUntil !== 'number'
        || !Number.isFinite(cooldownUntil)
        || cooldownUntil <= 0
        || typeof updatedAt !== 'number'
        || !Number.isFinite(updatedAt)
        || updatedAt <= 0
      ) {
        return null;
      }

      seen.add(memberId);
      return {
        memberId,
        cooldownUntil,
        updatedAt,
      } satisfies GroupAdminNominationCooldownEntry;
    })
    .filter((entry): entry is GroupAdminNominationCooldownEntry => !!entry);

  return sanitizedEntries.length > 0 ? sanitizedEntries : undefined;
}

export function getAdminNominationCooldownEntry(
  group: Pick<ChatGroup, 'adminNominationCooldowns'>,
  memberId: string,
): GroupAdminNominationCooldownEntry | undefined {
  return getAdminNominationCooldownEntries(group).find((entry) => entry.memberId === memberId);
}

export function canNominateMember(
  group: Pick<ChatGroup, 'adminNominationCooldowns'>,
  memberId: string,
  now = Date.now(),
): boolean {
  const entry = getAdminNominationCooldownEntry(group, memberId);
  return !entry || entry.cooldownUntil <= now;
}

export function buildAdminNominationCooldownPatch(
  group: Pick<ChatGroup, 'adminNominationCooldowns'>,
  memberId: string,
  now = Date.now(),
  durationMs = GROUP_ADMIN_NOMINATION_COOLDOWN_MS,
): Pick<Partial<ChatGroup>, 'adminNominationCooldowns'> {
  const currentEntries = getAdminNominationCooldownEntries(group);
  const nextEntry: GroupAdminNominationCooldownEntry = {
    memberId,
    cooldownUntil: now + durationMs,
    updatedAt: now,
  };

  return {
    adminNominationCooldowns: [
      ...currentEntries.filter((entry) => entry.memberId !== memberId),
      nextEntry,
    ],
  };
}

export function cleanupAdminNominationCooldowns(
  group: Pick<ChatGroup, 'adminNominationCooldowns'>,
  now = Date.now(),
): Pick<Partial<ChatGroup>, 'adminNominationCooldowns'> | null {
  const currentEntries = getAdminNominationCooldownEntries(group);
  const activeEntries = currentEntries.filter((entry) => entry.cooldownUntil > now);

  if (activeEntries.length === currentEntries.length) {
    return null;
  }

  return {
    adminNominationCooldowns: activeEntries.length > 0 ? activeEntries : undefined,
  };
}

export function getNearestAdminNominationCooldownExpiryAt(
  group: Pick<ChatGroup, 'adminNominationCooldowns'>,
): number | undefined {
  const candidateTimestamps = getAdminNominationCooldownEntries(group)
    .map((entry) => entry.cooldownUntil)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);

  if (candidateTimestamps.length === 0) {
    return undefined;
  }

  return Math.min(...candidateTimestamps);
}

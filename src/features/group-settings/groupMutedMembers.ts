import type { ChatGroup } from '../../types';

export type GroupMutedMemberEntry = NonNullable<ChatGroup['mutedMemberEntries']>[number];

type GroupMutedMemberSanitizeOptions = {
  memberIds: string[];
  creatorId: string;
};

export function sanitizeMutedMemberEntries(
  entries: unknown,
  options: GroupMutedMemberSanitizeOptions,
): GroupMutedMemberEntry[] | undefined {
  if (!Array.isArray(entries)) {
    return undefined;
  }

  const validMemberIds = new Set(options.memberIds);
  const seenMemberIds = new Set<string>();

  const sanitizedEntries = entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const memberId = typeof (entry as { memberId?: unknown }).memberId === 'string'
        ? (entry as { memberId: string }).memberId.trim()
        : '';
      const mutedById = typeof (entry as { mutedById?: unknown }).mutedById === 'string'
        ? (entry as { mutedById: string }).mutedById.trim()
        : options.creatorId;
      const mutedAt = (entry as { mutedAt?: unknown }).mutedAt;
      const expiresAt = (entry as { expiresAt?: unknown }).expiresAt;

      if (
        !memberId
        || seenMemberIds.has(memberId)
        || memberId === options.creatorId
        || !validMemberIds.has(memberId)
        || !mutedById
        || typeof mutedAt !== 'number'
        || !Number.isFinite(mutedAt)
        || mutedAt <= 0
      ) {
        return null;
      }

      if (
        expiresAt !== undefined
        && (
          typeof expiresAt !== 'number'
          || !Number.isFinite(expiresAt)
          || expiresAt <= mutedAt
        )
      ) {
        return null;
      }

      seenMemberIds.add(memberId);
      return {
        memberId,
        mutedById,
        mutedAt,
        ...(typeof expiresAt === 'number' ? { expiresAt } : {}),
      } satisfies GroupMutedMemberEntry;
    })
    .filter((entry): entry is GroupMutedMemberEntry => !!entry);

  return sanitizedEntries.length > 0 ? sanitizedEntries : undefined;
}

export function getActiveMutedMemberEntries(
  group: Pick<ChatGroup, 'mutedMemberEntries'>,
  now = Date.now(),
): GroupMutedMemberEntry[] {
  return (group.mutedMemberEntries || []).filter((entry) => !entry.expiresAt || entry.expiresAt > now);
}

export function getMutedMemberEntry(
  group: Pick<ChatGroup, 'mutedMemberEntries'>,
  memberId: string,
  now = Date.now(),
): GroupMutedMemberEntry | undefined {
  return getActiveMutedMemberEntries(group, now).find((entry) => entry.memberId === memberId);
}

export function isGroupMemberMuted(
  group: Pick<ChatGroup, 'mutedMemberEntries'>,
  memberId: string,
  now = Date.now(),
): boolean {
  return !!getMutedMemberEntry(group, memberId, now);
}

export function upsertMutedMemberEntry(
  group: Pick<ChatGroup, 'mutedMemberEntries'>,
  entry: GroupMutedMemberEntry,
): Pick<Partial<ChatGroup>, 'mutedMemberEntries'> {
  const currentEntries = group.mutedMemberEntries || [];

  return {
    mutedMemberEntries: [
      ...currentEntries.filter((item) => item.memberId !== entry.memberId),
      entry,
    ],
  };
}

export function removeMutedMemberEntry(
  group: Pick<ChatGroup, 'mutedMemberEntries'>,
  memberId: string,
): Pick<Partial<ChatGroup>, 'mutedMemberEntries'> {
  const currentEntries = group.mutedMemberEntries || [];
  const nextEntries = currentEntries.filter((entry) => entry.memberId !== memberId);

  return {
    mutedMemberEntries: nextEntries.length > 0 ? nextEntries : undefined,
  };
}

export function cleanupExpiredMutedMemberEntries(
  group: Pick<ChatGroup, 'mutedMemberEntries'>,
  now = Date.now(),
): {
  patch: Pick<Partial<ChatGroup>, 'mutedMemberEntries'>;
  expiredEntries: GroupMutedMemberEntry[];
} | null {
  const currentEntries = group.mutedMemberEntries || [];
  const expiredEntries = currentEntries.filter((entry) => !!entry.expiresAt && entry.expiresAt <= now);

  if (expiredEntries.length === 0) {
    return null;
  }

  const activeEntries = getActiveMutedMemberEntries(group, now);

  return {
    patch: {
      mutedMemberEntries: activeEntries.length > 0 ? activeEntries : undefined,
    },
    expiredEntries,
  };
}

export function getNearestMutedMemberExpiryAt(
  group: Pick<ChatGroup, 'mutedMemberEntries'>,
): number | undefined {
  const candidateTimestamps = (group.mutedMemberEntries || [])
    .map((entry) => entry.expiresAt)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);

  if (candidateTimestamps.length === 0) {
    return undefined;
  }

  return Math.min(...candidateTimestamps);
}

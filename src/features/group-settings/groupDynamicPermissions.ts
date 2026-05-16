import type { ChatGroup } from '../../types';

export const GROUP_DUTY_ADMIN_DURATION_MS = 24 * 60 * 60 * 1000;
export const GROUP_TEMPORARY_PERMISSION_DURATION_MS = 60 * 60 * 1000;

export type GroupDutyAdminAssignment = NonNullable<ChatGroup['dutyAdminAssignment']>;
export type GroupTemporaryPermissionGrant = NonNullable<ChatGroup['temporaryPermissionGrants']>[number];

type DynamicPermissionMemberOptions = {
  memberIds: string[];
  creatorId: string;
};

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function getDutyAdminAssignment(group: Pick<ChatGroup, 'dutyAdminAssignment'>): GroupDutyAdminAssignment | undefined {
  const assignment = group.dutyAdminAssignment;
  if (!assignment || typeof assignment !== 'object') {
    return undefined;
  }

  const memberId = typeof (assignment as { memberId?: unknown }).memberId === 'string'
    ? (assignment as { memberId: string }).memberId
    : '';
  const grantedById = typeof (assignment as { grantedById?: unknown }).grantedById === 'string'
    ? (assignment as { grantedById: string }).grantedById
    : '';
  const grantedAt = (assignment as { grantedAt?: unknown }).grantedAt;
  const expiresAt = (assignment as { expiresAt?: unknown }).expiresAt;

  if (!memberId || !grantedById || !isValidTimestamp(grantedAt) || !isValidTimestamp(expiresAt) || expiresAt <= grantedAt) {
    return undefined;
  }

  return {
    memberId,
    grantedById,
    grantedAt,
    expiresAt,
  };
}

function getTemporaryPermissionGrants(
  group: Pick<ChatGroup, 'temporaryPermissionGrants'>,
): GroupTemporaryPermissionGrant[] {
  return Array.isArray(group.temporaryPermissionGrants)
    ? group.temporaryPermissionGrants.filter((grant): grant is GroupTemporaryPermissionGrant => !!grant && typeof grant === 'object')
    : [];
}

function isEligibleManagedPermissionTarget(memberId: string, options: DynamicPermissionMemberOptions): boolean {
  return memberId !== options.creatorId && options.memberIds.includes(memberId);
}

export function buildDutyAdminAssignment(params: {
  memberId: string;
  grantedById: string;
  grantedAt?: number;
  durationMs?: number;
}): GroupDutyAdminAssignment {
  const grantedAt = params.grantedAt ?? Date.now();

  return {
    memberId: params.memberId,
    grantedById: params.grantedById,
    grantedAt,
    expiresAt: grantedAt + (params.durationMs ?? GROUP_DUTY_ADMIN_DURATION_MS),
  };
}

export function buildTemporaryManagedFeatureGrant(params: {
  memberId: string;
  grantedById: string;
  grantedAt?: number;
  durationMs?: number;
  remainingUses?: number;
}): GroupTemporaryPermissionGrant {
  const grantedAt = params.grantedAt ?? Date.now();

  return {
    id: `temp-grant-${grantedAt}-${Math.random().toString(36).slice(2, 8)}`,
    memberId: params.memberId,
    grantedById: params.grantedById,
    permission: 'managed_group_feature',
    grantedAt,
    expiresAt: grantedAt + (params.durationMs ?? GROUP_TEMPORARY_PERMISSION_DURATION_MS),
    remainingUses: Math.max(1, params.remainingUses ?? 1),
  };
}

export function sanitizeDutyAdminAssignment(
  assignment: unknown,
  options: DynamicPermissionMemberOptions,
): GroupDutyAdminAssignment | undefined {
  if (!assignment || typeof assignment !== 'object') {
    return undefined;
  }

  const memberId = typeof (assignment as { memberId?: unknown }).memberId === 'string'
    ? (assignment as { memberId: string }).memberId
    : '';
  const grantedById = typeof (assignment as { grantedById?: unknown }).grantedById === 'string'
    ? (assignment as { grantedById: string }).grantedById
    : options.creatorId;
  const grantedAt = (assignment as { grantedAt?: unknown }).grantedAt;
  const expiresAt = (assignment as { expiresAt?: unknown }).expiresAt;

  if (
    !memberId
    || !isEligibleManagedPermissionTarget(memberId, options)
    || !grantedById
    || !isValidTimestamp(grantedAt)
    || !isValidTimestamp(expiresAt)
    || expiresAt <= grantedAt
  ) {
    return undefined;
  }

  return {
    memberId,
    grantedById,
    grantedAt,
    expiresAt,
  };
}

export function sanitizeTemporaryPermissionGrants(
  grants: unknown,
  options: DynamicPermissionMemberOptions,
): GroupTemporaryPermissionGrant[] | undefined {
  if (!Array.isArray(grants)) {
    return undefined;
  }

  const sanitizedGrants = grants
    .map((grant) => {
      if (!grant || typeof grant !== 'object') {
        return null;
      }

      const id = typeof (grant as { id?: unknown }).id === 'string'
        ? (grant as { id: string }).id.trim()
        : '';
      const memberId = typeof (grant as { memberId?: unknown }).memberId === 'string'
        ? (grant as { memberId: string }).memberId
        : '';
      const grantedById = typeof (grant as { grantedById?: unknown }).grantedById === 'string'
        ? (grant as { grantedById: string }).grantedById
        : options.creatorId;
      const permission = (grant as { permission?: unknown }).permission;
      const grantedAt = (grant as { grantedAt?: unknown }).grantedAt;
      const expiresAt = (grant as { expiresAt?: unknown }).expiresAt;
      const remainingUses = (grant as { remainingUses?: unknown }).remainingUses;

      if (
        !id
        || !memberId
        || !isEligibleManagedPermissionTarget(memberId, options)
        || !grantedById
        || permission !== 'managed_group_feature'
        || !isValidTimestamp(grantedAt)
        || !isValidTimestamp(expiresAt)
        || expiresAt <= grantedAt
        || typeof remainingUses !== 'number'
        || !Number.isFinite(remainingUses)
        || remainingUses < 1
      ) {
        return null;
      }

      return {
        id,
        memberId,
        grantedById,
        permission,
        grantedAt,
        expiresAt,
        remainingUses: Math.max(1, Math.floor(remainingUses)),
      } satisfies GroupTemporaryPermissionGrant;
    })
    .filter((grant): grant is GroupTemporaryPermissionGrant => !!grant);

  if (sanitizedGrants.length === 0) {
    return undefined;
  }

  const seenIds = new Set<string>();
  const seenMembers = new Set<string>();

  return sanitizedGrants.filter((grant) => {
    if (seenIds.has(grant.id) || seenMembers.has(grant.memberId)) {
      return false;
    }

    seenIds.add(grant.id);
    seenMembers.add(grant.memberId);
    return true;
  });
}

export function getActiveDutyAdminAssignment(
  group: Pick<ChatGroup, 'dutyAdminAssignment'>,
  now = Date.now(),
): GroupDutyAdminAssignment | undefined {
  const assignment = getDutyAdminAssignment(group);
  if (!assignment || assignment.expiresAt <= now) {
    return undefined;
  }

  return assignment;
}

export function getActiveTemporaryPermissionGrants(
  group: Pick<ChatGroup, 'temporaryPermissionGrants'>,
  now = Date.now(),
): GroupTemporaryPermissionGrant[] {
  return getTemporaryPermissionGrants(group).filter((grant) => grant.expiresAt > now && grant.remainingUses > 0);
}

export function getNearestDynamicPermissionExpiryAt(
  group: Pick<ChatGroup, 'dutyAdminAssignment' | 'temporaryPermissionGrants'>,
): number | undefined {
  const assignment = getDutyAdminAssignment(group);
  const candidateTimestamps = [
    assignment?.expiresAt,
    ...getTemporaryPermissionGrants(group).map((grant) => grant.expiresAt),
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);

  if (candidateTimestamps.length === 0) {
    return undefined;
  }

  return Math.min(...candidateTimestamps);
}

export function getTemporaryManagedFeatureGrant(
  group: Pick<ChatGroup, 'temporaryPermissionGrants'>,
  memberId: string,
  now = Date.now(),
): GroupTemporaryPermissionGrant | undefined {
  return getActiveTemporaryPermissionGrants(group, now).find((grant) => grant.memberId === memberId);
}

export function hasActiveDutyAdminAccess(
  group: Pick<ChatGroup, 'dutyAdminAssignment'>,
  memberId: string,
  now = Date.now(),
): boolean {
  return getActiveDutyAdminAssignment(group, now)?.memberId === memberId;
}

export function hasActiveTemporaryManagedFeatureGrant(
  group: Pick<ChatGroup, 'temporaryPermissionGrants'>,
  memberId: string,
  now = Date.now(),
): boolean {
  return !!getTemporaryManagedFeatureGrant(group, memberId, now);
}

export function consumeTemporaryManagedFeatureGrant(
  group: Pick<ChatGroup, 'temporaryPermissionGrants'>,
  memberId: string,
  now = Date.now(),
): {
  patch: Pick<Partial<ChatGroup>, 'temporaryPermissionGrants'>;
  consumedGrant: GroupTemporaryPermissionGrant;
} | null {
  const activeGrant = getTemporaryManagedFeatureGrant(group, memberId, now);
  if (!activeGrant) {
    return null;
  }

  const nextGrants = getTemporaryPermissionGrants(group)
    .map((grant) => {
      if (grant.id !== activeGrant.id) {
        return grant;
      }

      return {
        ...grant,
        remainingUses: grant.remainingUses - 1,
      };
    })
    .filter((grant) => grant.remainingUses > 0 && grant.expiresAt > now);

  return {
    patch: {
      temporaryPermissionGrants: nextGrants.length > 0 ? nextGrants : undefined,
    },
    consumedGrant: activeGrant,
  };
}

export function getDynamicPermissionExpiryCleanup(
  group: Pick<ChatGroup, 'dutyAdminAssignment' | 'temporaryPermissionGrants'>,
  now = Date.now(),
): {
  patch: Pick<Partial<ChatGroup>, 'dutyAdminAssignment' | 'temporaryPermissionGrants'>;
  expiredDutyAdminAssignment?: GroupDutyAdminAssignment;
  expiredTemporaryPermissionGrants: GroupTemporaryPermissionGrant[];
} | null {
  const assignment = getDutyAdminAssignment(group);
  const grants = getTemporaryPermissionGrants(group);
  const expiredDutyAdminAssignment = assignment && assignment.expiresAt <= now
    ? assignment
    : undefined;
  const expiredTemporaryPermissionGrants = grants.filter((grant) => grant.expiresAt <= now || grant.remainingUses <= 0);

  if (!expiredDutyAdminAssignment && expiredTemporaryPermissionGrants.length === 0) {
    return null;
  }

  const activeTemporaryPermissionGrants = grants.filter((grant) => grant.expiresAt > now && grant.remainingUses > 0);

  return {
    patch: {
      dutyAdminAssignment: expiredDutyAdminAssignment ? undefined : assignment,
      temporaryPermissionGrants: activeTemporaryPermissionGrants.length > 0 ? activeTemporaryPermissionGrants : undefined,
    },
    expiredDutyAdminAssignment,
    expiredTemporaryPermissionGrants,
  };
}

import type { ChatGroup } from '../../types';

export const GROUP_BADGE_COLOR_PRESETS = [
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#f59e0b',
  '#ef4444',
] as const;

export const DEFAULT_GROUP_BADGE_COLOR = GROUP_BADGE_COLOR_PRESETS[0];

export type GroupMemberBadge = {
  memberId: string;
  label: string;
  color: string;
};

function normalizeBadgeColor(color?: string): string {
  const trimmed = color?.trim();
  return trimmed || DEFAULT_GROUP_BADGE_COLOR;
}

function getMemberBadges(group: Pick<ChatGroup, 'memberBadges'>): NonNullable<ChatGroup['memberBadges']> {
  return Array.isArray(group.memberBadges) ? group.memberBadges : [];
}

export function sanitizeGroupMemberBadges(group: Pick<ChatGroup, 'memberBadges' | 'memberIds' | 'creatorId'>): GroupMemberBadge[] {
  const allowedIds = new Set([group.creatorId, ...(group.memberIds || [])]);

  return getMemberBadges(group)
    .filter((badge): badge is NonNullable<ChatGroup['memberBadges']>[number] => !!badge)
    .map((badge) => ({
      memberId: typeof badge.memberId === 'string' ? badge.memberId : '',
      label: typeof badge.label === 'string' ? badge.label.trim() : '',
      color: normalizeBadgeColor(badge.color),
    }))
    .filter((badge) => badge.memberId && badge.label && allowedIds.has(badge.memberId));
}

export function getGroupMemberBadge(group: Pick<ChatGroup, 'memberBadges'>, memberId: string): GroupMemberBadge | null {
  const badge = getMemberBadges(group).find((item) => item.memberId === memberId);
  if (!badge || !badge.label?.trim()) {
    return null;
  }

  return {
    memberId,
    label: badge.label.trim(),
    color: normalizeBadgeColor(badge.color),
  };
}

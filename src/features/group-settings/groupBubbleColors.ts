import type { ChatGroup } from '../../types';

export type GroupMemberBubbleColor = {
  memberId: string;
  color: string;
};

const DEFAULT_BUBBLE_COLOR = '#ffffff';

function normalizeBubbleColor(color?: string): string {
  const trimmed = color?.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed || '') ? trimmed! : DEFAULT_BUBBLE_COLOR;
}

export function sanitizeGroupMemberBubbleColors(
  group: Pick<ChatGroup, 'memberIds' | 'creatorId'> & { memberBubbleColors?: ChatGroup['memberBubbleColors'] },
): GroupMemberBubbleColor[] {
  const allowedIds = new Set([group.creatorId, ...(group.memberIds || [])]);

  return (group.memberBubbleColors || [])
    .filter((item): item is NonNullable<ChatGroup['memberBubbleColors']>[number] => !!item)
    .map((item) => ({
      memberId: typeof item.memberId === 'string' ? item.memberId : '',
      color: normalizeBubbleColor(item.color),
    }))
    .filter((item) => item.memberId && allowedIds.has(item.memberId));
}

export function getGroupMemberBubbleColor(
  group: { memberBubbleColors?: ChatGroup['memberBubbleColors'] },
  memberId: string,
): string | null {
  const item = (group.memberBubbleColors || []).find((entry) => entry.memberId === memberId);
  if (!item) {
    return null;
  }

  return normalizeBubbleColor(item.color);
}

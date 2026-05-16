import type { ChatGroup } from '../../types';

export type GroupMemberRole = 'owner' | 'admin' | 'member';

export function resolveGroupMemberRole(group: ChatGroup, memberId: string): GroupMemberRole {
  if (group.creatorId === memberId) {
    return 'owner';
  }

  if ((group.adminIds || []).includes(memberId)) {
    return 'admin';
  }

  return 'member';
}

export function getGroupRoleLabel(role: GroupMemberRole): string {
  switch (role) {
    case 'owner':
      return '群主';
    case 'admin':
      return '管理员';
    default:
      return '普通成员';
  }
}

export function getGroupRoleCapabilitySummary(role: GroupMemberRole): string {
  switch (role) {
    case 'owner':
      return '可邀请成员、设管理员、禁言成员、移出成员、管理动态权限';
    case 'admin':
      return '可邀请成员、禁言成员、移出成员';
    default:
      return '当前仅可查看成员身份';
  }
}

export function canManageGroupMembers(group: ChatGroup, actorId: string): boolean {
  const role = resolveGroupMemberRole(group, actorId);
  return role === 'owner' || role === 'admin';
}

export function canManageGroupAdmins(group: ChatGroup, actorId: string): boolean {
  return resolveGroupMemberRole(group, actorId) === 'owner';
}

export function isProtectedGroupMember(group: ChatGroup, memberId: string): boolean {
  return group.creatorId === memberId;
}

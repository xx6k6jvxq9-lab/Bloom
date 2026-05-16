import type { ChatGroup } from '../../types';
import {
  hasActiveDutyAdminAccess,
  hasActiveTemporaryManagedFeatureGrant,
} from './groupDynamicPermissions';
import type { GroupMemberRole } from './groupRoles';
import { resolveGroupMemberRole } from './groupRoles';
import type { GroupSettingsPatch } from './types';

export type ManagedGroupFeatureKind = 'poll' | 'relay' | 'task';

const LOCAL_GROUP_SETTING_KEYS = [
  'groupBackground',
  'headerStyle',
  'headerOpacity',
  'footerStyle',
  'footerOpacity',
  'groupNickname',
  'groupRemark',
  'muteNotifications',
  'pinChat',
  'manualReplyEnabled',
  'voiceRepliesEnabled',
  'voiceReplyMemberIds',
] as const satisfies ReadonlyArray<keyof GroupSettingsPatch>;

const ADMIN_EDITABLE_GROUP_SETTING_KEYS = [
  'groupNotice',
] as const satisfies ReadonlyArray<keyof GroupSettingsPatch>;

const OWNER_ONLY_GROUP_SETTING_KEYS = [
  'name',
  'avatar',
  'backgroundSummary',
  'memberRelationshipState',
  'memberRelationshipNote',
  'currentScene',
  'publicFacts',
  'awarenessMode',
  'activeWorldBookIds',
  'allowDirectMemoryInterop',
  'allowDirectMemoryInteropConfigured',
] as const satisfies ReadonlyArray<keyof GroupSettingsPatch>;

function copyPatchKey<K extends keyof GroupSettingsPatch>(
  target: Partial<GroupSettingsPatch>,
  source: Partial<GroupSettingsPatch>,
  key: K,
) {
  if (key in source) {
    target[key] = source[key];
  }
}

export function hasGroupModeratorRole(role: GroupMemberRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageDynamicGroupPermissionsByRole(role: GroupMemberRole): boolean {
  return role === 'owner';
}

export function canEditGroupNoticeByRole(role: GroupMemberRole): boolean {
  return hasGroupModeratorRole(role);
}

export function canLaunchManagedGroupFeatureByRole(role: GroupMemberRole): boolean {
  return hasGroupModeratorRole(role);
}

export function canEditGroupNotice(group: ChatGroup, actorId: string): boolean {
  return canEditGroupNoticeByRole(resolveGroupMemberRole(group, actorId))
    || hasActiveDutyAdminAccess(group, actorId);
}

export function canLaunchManagedGroupFeature(group: ChatGroup, actorId: string): boolean {
  return canLaunchManagedGroupFeatureByRole(resolveGroupMemberRole(group, actorId))
    || hasActiveDutyAdminAccess(group, actorId)
    || hasActiveTemporaryManagedFeatureGrant(group, actorId);
}

export function canManageDynamicGroupPermissions(group: ChatGroup, actorId: string): boolean {
  return canManageDynamicGroupPermissionsByRole(resolveGroupMemberRole(group, actorId));
}

export function getManagedGroupFeatureLabel(kind: ManagedGroupFeatureKind): string {
  switch (kind) {
    case 'poll':
      return '群投票';
    case 'relay':
      return '群接龙';
    case 'task':
      return '群任务';
    default:
      return '群事件';
  }
}

export function getManagedGroupFeaturePermissionHint(role: GroupMemberRole): string {
  return canLaunchManagedGroupFeatureByRole(role)
    ? ''
    : '群投票、群接龙和群任务需要管理员、值日管理员或临时授权。';
}

export function getManagedGroupFeaturePermissionHintForActor(group: ChatGroup, actorId: string): string {
  if (canLaunchManagedGroupFeature(group, actorId)) {
    const role = resolveGroupMemberRole(group, actorId);
    return role === 'member' ? '当前值日管理员或临时授权可以发起群事件。' : '';
  }

  return '群投票、群接龙和群任务需要管理员、值日管理员或临时授权。';
}

export function getGroupNoticePermissionHint(role: GroupMemberRole): string {
  return canEditGroupNoticeByRole(role)
    ? '当前身份可以编辑群公告。'
    : '只有群主、管理员或当前值日管理员可以编辑群公告。';
}

export function getGroupNoticePermissionHintForActor(group: ChatGroup, actorId: string): string {
  if (canEditGroupNotice(group, actorId)) {
    const role = resolveGroupMemberRole(group, actorId);
    return role === 'member' ? '当前值日管理员可以编辑群公告。' : '当前身份可以编辑群公告。';
  }

  return '只有群主、管理员或当前值日管理员可以编辑群公告。';
}

export function filterGroupSettingsPatchForRole(
  role: GroupMemberRole,
  patch: Partial<GroupSettingsPatch>,
): Partial<GroupSettingsPatch> {
  const nextPatch: Partial<GroupSettingsPatch> = {};

  LOCAL_GROUP_SETTING_KEYS.forEach((key) => {
    copyPatchKey(nextPatch, patch, key);
  });

  if (canEditGroupNoticeByRole(role)) {
    ADMIN_EDITABLE_GROUP_SETTING_KEYS.forEach((key) => {
      copyPatchKey(nextPatch, patch, key);
    });
  }

  if (role === 'owner') {
    OWNER_ONLY_GROUP_SETTING_KEYS.forEach((key) => {
      copyPatchKey(nextPatch, patch, key);
    });
  }

  return nextPatch;
}

export function filterGroupSettingsPatchForActor(
  group: ChatGroup,
  actorId: string,
  patch: Partial<GroupSettingsPatch>,
): Partial<GroupSettingsPatch> {
  const role = resolveGroupMemberRole(group, actorId);
  const nextPatch = filterGroupSettingsPatchForRole(role, patch);

  if (canEditGroupNotice(group, actorId)) {
    ADMIN_EDITABLE_GROUP_SETTING_KEYS.forEach((key) => {
      copyPatchKey(nextPatch, patch, key);
    });
  }

  return nextPatch;
}

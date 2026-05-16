import type { ChatGroup, ChatMessage } from '../../types';
import type { GroupSettingsPatch } from './types';

function createGroupNoticeMessage(text: string, timestamp: number): ChatMessage {
  return {
    role: 'model',
    text: `[notice] ${text}`,
    timestamp,
    isSystem: true,
  };
}

function formatActorLabel(actorName: string | undefined, isSelf: boolean | undefined): string {
  return isSelf ? '你' : (actorName?.trim() || '管理员');
}

export function createInviteMemberSystemMessage(invitedName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你邀请了 ${invitedName} 进群`, timestamp);
}

export function createRevealGroupAwarenessSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你让 ${memberName} 知道了这个群`, timestamp);
}

export function createApproveJoinRequestSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你通过了 ${memberName} 的入群申请`, timestamp);
}

export function createRejectJoinRequestSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你拒绝了 ${memberName} 的入群申请`, timestamp);
}

export function createExpireJoinRequestSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`${memberName} 的入群申请已过期`, timestamp);
}

export function createRemoveMemberSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你将 ${memberName} 移出了群聊`, timestamp);
}

export function createActorRemoveMemberSystemMessage(params: {
  actorName?: string;
  memberName: string;
  isSelf?: boolean;
  timestamp: number;
}): ChatMessage {
  return createGroupNoticeMessage(
    `${formatActorLabel(params.actorName, params.isSelf)}将 ${params.memberName} 移出了群聊`,
    params.timestamp,
  );
}

export function createMuteMemberSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你将 ${memberName} 禁言了`, timestamp);
}

export function createActorMuteMemberSystemMessage(params: {
  actorName?: string;
  memberName: string;
  isSelf?: boolean;
  timestamp: number;
}): ChatMessage {
  return createGroupNoticeMessage(
    `${formatActorLabel(params.actorName, params.isSelf)}将 ${params.memberName} 禁言了`,
    params.timestamp,
  );
}

export function createUnmuteMemberSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你解除了 ${memberName} 的禁言`, timestamp);
}

export function createExpireMuteMemberSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`${memberName} 的禁言已到期`, timestamp);
}

export function createActorUnmuteMemberSystemMessage(params: {
  actorName?: string;
  memberName: string;
  isSelf?: boolean;
  timestamp: number;
}): ChatMessage {
  return createGroupNoticeMessage(
    `${formatActorLabel(params.actorName, params.isSelf)}解除了 ${params.memberName} 的禁言`,
    params.timestamp,
  );
}

export function createSetAdminSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你将 ${memberName} 设为了管理员`, timestamp);
}

export function createApproveAdminNominationSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你通过了 ${memberName} 的管理员提名`, timestamp);
}

export function createRejectAdminNominationSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你驳回了 ${memberName} 的管理员提名`, timestamp);
}

export function createExpireAdminNominationSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`${memberName} 的管理员提名已过期`, timestamp);
}

export function createCancelAdminSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你取消了 ${memberName} 的管理员身份`, timestamp);
}

export function createSetMemberBadgeSystemMessage(memberName: string, badgeLabel: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你给 ${memberName} 设置了群头衔“${badgeLabel}”`, timestamp);
}

export function createClearMemberBadgeSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你清除了 ${memberName} 的群头衔`, timestamp);
}

export function createLeaveGroupSystemMessage(timestamp: number): ChatMessage {
  return createGroupNoticeMessage('你退出了群聊', timestamp);
}

export function createAssignDutyAdminSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你指定了 ${memberName} 为今日值日管理员`, timestamp);
}

export function createClearDutyAdminSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你结束了 ${memberName} 的值日`, timestamp);
}

export function createExpireDutyAdminSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`${memberName} 的值日已到期`, timestamp);
}

export function createGrantTemporaryPermissionSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你给 ${memberName} 发了一次临时群事件权限`, timestamp);
}

export function createRevokeTemporaryPermissionSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你撤销了 ${memberName} 的临时群事件权限`, timestamp);
}

export function createConsumeTemporaryPermissionSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`${memberName} 的临时群事件权限已用完`, timestamp);
}

export function createExpireTemporaryPermissionSystemMessage(memberName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`${memberName} 的临时群事件权限已到期`, timestamp);
}

export function createLaunchGroupFeatureSystemMessage(params: {
  kind: 'poll' | 'relay' | 'task';
  title: string;
  initiatorName: string;
  isSelf: boolean;
  timestamp: number;
}): ChatMessage {
  const subject = formatActorLabel(params.initiatorName, params.isSelf);

  if (params.kind === 'poll') {
    return createGroupNoticeMessage(`${subject}发起了群投票《${params.title}》`, params.timestamp);
  }

  if (params.kind === 'relay') {
    return createGroupNoticeMessage(`${subject}发起了群接龙《${params.title}》`, params.timestamp);
  }

  return createGroupNoticeMessage(`${subject}发起了群任务《${params.title}》`, params.timestamp);
}

export function buildGroupSettingsSystemMessages(
  group: ChatGroup,
  patch: Partial<GroupSettingsPatch>,
  timestamp: number,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const nextName = typeof patch.name === 'string' ? patch.name.trim() : group.name;
  const nextAvatar = 'avatar' in patch ? (patch.avatar || '') : (group.avatar || '');
  const previousAvatar = group.avatar || '';
  const nextNotice = 'groupNotice' in patch ? (patch.groupNotice?.trim() || '') : (group.groupNotice?.trim() || '');
  const previousNotice = group.groupNotice?.trim() || '';

  if ('name' in patch && nextName && nextName !== group.name) {
    messages.push(createGroupNoticeMessage(`你将群名改为“${nextName}”`, timestamp + messages.length));
  }

  if ('avatar' in patch && nextAvatar !== previousAvatar) {
    messages.push(createGroupNoticeMessage('你更新了群头像', timestamp + messages.length));
  }

  if ('groupNotice' in patch && nextNotice !== previousNotice) {
    if (nextNotice) {
      messages.push(createGroupNoticeMessage('你修改了群公告', timestamp + messages.length));
    } else if (previousNotice) {
      messages.push(createGroupNoticeMessage('你清空了群公告', timestamp + messages.length));
    }
  }

  return messages;
}

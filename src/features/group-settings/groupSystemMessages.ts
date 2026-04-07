import type { ChatMessage, ChatGroup } from '../../types';
import type { GroupSettingsFormState } from './types';

function createGroupNoticeMessage(text: string, timestamp: number): ChatMessage {
  return {
    role: 'model',
    text: `[notice] ${text}`,
    timestamp,
    isSystem: true,
  };
}

export function createInviteMemberSystemMessage(invitedName: string, timestamp: number): ChatMessage {
  return createGroupNoticeMessage(`你邀请了${invitedName}进群`, timestamp);
}

export function buildGroupSettingsSystemMessages(
  group: ChatGroup,
  state: GroupSettingsFormState,
  timestamp: number,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const nextName = state.name.trim();
  const nextNotice = state.groupNotice.trim();
  const previousNotice = group.groupNotice?.trim() || '';

  if (nextName && nextName !== group.name) {
    messages.push(createGroupNoticeMessage(`你将群名改为“${nextName}”`, timestamp + messages.length));
  }

  if (nextNotice !== previousNotice) {
    if (nextNotice) {
      messages.push(createGroupNoticeMessage('你修改了群公告', timestamp + messages.length));
    } else if (previousNotice) {
      messages.push(createGroupNoticeMessage('你清空了群公告', timestamp + messages.length));
    }
  }

  return messages;
}

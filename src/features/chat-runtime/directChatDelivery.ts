import type { ChatMessage } from '../../types';
import type { CharacterBlockState } from '../contacts/contactRelationship';

export function isDirectChatBlockedByUser(blockState: CharacterBlockState) {
  return blockState === 'user' || blockState === 'mutual';
}

export function isDirectChatBlockedByCharacter(blockState: CharacterBlockState) {
  return blockState === 'character' || blockState === 'mutual';
}

export function getDirectChatBlockedComposerError(blockState: CharacterBlockState) {
  if (isDirectChatBlockedByUser(blockState)) {
    return '你已经把对方拉黑了，普通聊天已暂停。想恢复关系，请先解除拉黑。';
  }

  return null;
}

export function getDirectChatBlockedManualReplyError(blockState: CharacterBlockState) {
  if (blockState === 'character') {
    return '对方当前拒收你的普通消息，不会继续回复。';
  }

  if (isDirectChatBlockedByUser(blockState)) {
    return '你已经把对方拉黑了，普通聊天已暂停。';
  }

  return null;
}

export function getDirectChatRelationshipBlockNotice(blockState: CharacterBlockState) {
  if (isDirectChatBlockedByUser(blockState)) {
    return '你已经把对方拉黑了，普通聊天已暂停。想恢复关系，请先解除拉黑或走好友申请。';
  }

  if (isDirectChatBlockedByCharacter(blockState)) {
    return '对方当前拒收你的普通消息。你发出去的内容会留在本地，并显示红色感叹号。';
  }

  return '';
}

export function createBlockedDeliveryMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    deliveryStatus: 'failed_blocked',
    deliveryErrorText: '对方拒收了你的消息',
    deliveryFailureReason: 'blocked_by_character',
  };
}

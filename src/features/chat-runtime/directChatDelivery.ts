import type { Character, ChatMessage } from '../../types';
import {
  getCharacterBlockState,
  getCharacterFriendshipStatus,
  type CharacterBlockState,
} from '../contacts/contactRelationship';

type DirectChatAvailabilityInput = Pick<Character, 'friendshipStatus' | 'blockedByUser' | 'blockedByCharacter'>;

export function isDirectChatBlockedByUser(blockState: CharacterBlockState) {
  return blockState === 'user' || blockState === 'mutual';
}

export function isDirectChatBlockedByCharacter(blockState: CharacterBlockState) {
  return blockState === 'character' || blockState === 'mutual';
}

export function isDirectChatRelationshipPendingRepair(input: DirectChatAvailabilityInput) {
  return getCharacterFriendshipStatus(input) !== 'friends' && getCharacterBlockState(input) === 'none';
}

export function shouldPauseDirectChatComposerForCharacter(input: DirectChatAvailabilityInput) {
  const blockState = getCharacterBlockState(input);
  return isDirectChatBlockedByUser(blockState) || isDirectChatRelationshipPendingRepair(input);
}

export function getDirectChatBlockedComposerError(input: DirectChatAvailabilityInput) {
  const blockState = getCharacterBlockState(input);

  if (isDirectChatBlockedByUser(blockState)) {
    return '你已经把对方拉黑了，普通聊天已暂停。想恢复关系，请先解除拉黑。';
  }

  if (isDirectChatRelationshipPendingRepair(input)) {
    return '你们现在还不是好友，普通聊天暂时不可用。请先去关系页重新添加并通过。';
  }

  return null;
}

export function getDirectChatBlockedManualReplyError(input: DirectChatAvailabilityInput) {
  const blockState = getCharacterBlockState(input);

  if (blockState === 'character') {
    return '对方当前拒收你的普通消息，不会继续回复。';
  }

  if (isDirectChatBlockedByUser(blockState)) {
    return '你已经把对方拉黑了，普通聊天已暂停。';
  }

  if (isDirectChatRelationshipPendingRepair(input)) {
    return '你们现在还没有恢复好友关系，不能继续普通聊天。请先去关系页处理。';
  }

  return null;
}

export function getDirectChatRelationshipBlockNotice(input: DirectChatAvailabilityInput) {
  const blockState = getCharacterBlockState(input);

  if (isDirectChatBlockedByUser(blockState)) {
    return '你已经把对方拉黑了，普通聊天已暂停。想恢复关系，请先解除拉黑或走好友申请。';
  }

  if (isDirectChatBlockedByCharacter(blockState)) {
    return '对方当前拒收你的普通消息。你发出去的内容会留在本地，并显示红色感叹号。';
  }

  if (isDirectChatRelationshipPendingRepair(input)) {
    return '你们现在还没有恢复好友关系。想继续普通聊天，请先去关系页重新添加并通过。';
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

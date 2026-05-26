export type TransferSettlementDirection = 'user_to_character' | 'character_to_user';
export type TransferSettlementStatus = 'received' | 'rejected';

export type TransferSettlementEvent = {
  direction: TransferSettlementDirection;
  status: TransferSettlementStatus;
  amount: number;
  userName: string;
  characterName: string;
};

export type TransferInitiationDirection = 'user_to_character' | 'character_to_user';

const RECEIVED_CONTRADICTION_REGEX = /(?:你(?:(?:自己)?的)?钱(?:自己)?留着|你自己留着|别(?:再)?给我(?:转|钱)|不用(?:再)?(?:给我|转给我)|我(?:不收|不能收|不会收)|这(?:笔|钱)我(?:不收|不能收|不会收)|退给你|退回(?:去)?|还给你|拿回去|收回去|来回转账)/u;
const CHARACTER_ACCEPTED_USER_TRANSFER_REGEX = /(?:我(?:已经|刚刚|就|先|还是)?(?:收下|收了|收到了|领了|领取了)|这(?:笔|钱)我(?:收下|收了)|(?:已|已经)收款|到(?:账|卡)了)/u;
const USER_ACCEPTED_CHARACTER_TRANSFER_REGEX = /(?:你(?:已经|刚刚|就|先|还是)?(?:收下|收了|收到了|领了|领取了)|你(?:已|已经)收款|你那边到(?:账|卡)了|你都收着了)/u;
const CHARACTER_TO_USER_INITIATION_REFUSE_REGEX = /(?:不给你|不转|不给|没门|休想|想得美|自己买|不报销|先别想|不能给|这次不行|不借|借不了|你自己留着|钱你自己留着|自己的钱留着|留着自己花|别想了)/u;
const USER_TO_CHARACTER_INITIATION_REFUSE_REGEX = /(?:我不收|不会收|不能收|你自己留着|留着自己花|退给你|退回去|拿回去|收回去)/u;

function formatTransferAmountLabel(amount: number): string {
  return Number.isFinite(amount) ? `${amount.toFixed(2)} 元` : '这笔转账';
}

function normalizeTransferReplyText(text: string | null | undefined): string {
  return typeof text === 'string' ? text.trim() : '';
}

export function buildTransferSettlementEventLine(event: TransferSettlementEvent): string {
  const amountLabel = formatTransferAmountLabel(event.amount);
  if (event.direction === 'user_to_character') {
    return event.status === 'received'
      ? `${event.characterName}刚刚收下了${event.userName}转来的 ${amountLabel}。`
      : `${event.characterName}刚刚退回了${event.userName}转来的 ${amountLabel}。`;
  }

  return event.status === 'received'
    ? `${event.userName}刚刚收下了${event.characterName}转来的 ${amountLabel}。`
    : `${event.userName}刚刚退回了${event.characterName}转来的 ${amountLabel}。`;
}

export function buildTransferReactionFactPrompt(event: TransferSettlementEvent): string {
  const amountLabel = formatTransferAmountLabel(event.amount);
  if (event.direction === 'user_to_character') {
    return event.status === 'received'
      ? [
          `已发生事实：你已经收下了 ${event.userName} 转来的 ${amountLabel}。`,
          '你的回复只能顺着这个已发生事实做即时反应，不要再说自己不收、退回、让对方把钱留着，或把事情说成对方又在给你转账。',
        ].join('\n')
      : [
          `已发生事实：你已经退回了 ${event.userName} 转来的 ${amountLabel}。`,
          '你的回复只能顺着这个已发生事实做即时反应，不要再说你已经收下、已经到账，或把这笔钱说成还留在你这边。',
        ].join('\n');
  }

  return event.status === 'received'
    ? [
        `已发生事实：${event.userName}已经收下了你转出的 ${amountLabel}。`,
        '你的回复只能顺着“对方已经收下”这个事实做即时反应，不要把事情说成对方在给你转钱、这是对方自己的钱该留着，或像是你拒收了对方的钱。',
      ].join('\n')
    : [
        `已发生事实：${event.userName}已经退回了你转出的 ${amountLabel}。`,
        '你的回复只能顺着“对方已经退回”这个事实做即时反应，不要把事情说成对方已经收下、已经到账，或把当前结果说反。',
      ].join('\n');
}

export function findTransferReplyContradiction(
  event: TransferSettlementEvent,
  replyText: string | null | undefined,
): string | null {
  const normalizedReply = normalizeTransferReplyText(replyText);
  if (!normalizedReply) {
    return 'empty_reply';
  }

  if (event.status === 'received') {
    return RECEIVED_CONTRADICTION_REGEX.test(normalizedReply) ? 'received_fact_conflict' : null;
  }

  if (event.direction === 'user_to_character') {
    return CHARACTER_ACCEPTED_USER_TRANSFER_REGEX.test(normalizedReply) ? 'rejected_fact_conflict' : null;
  }

  return USER_ACCEPTED_CHARACTER_TRANSFER_REGEX.test(normalizedReply) ? 'rejected_fact_conflict' : null;
}

export function isTransferReplyConsistentWithEvent(
  event: TransferSettlementEvent,
  replyText: string | null | undefined,
): boolean {
  return findTransferReplyContradiction(event, replyText) == null;
}

export function findTransferInitiationReplyContradiction(
  direction: TransferInitiationDirection,
  replyText: string | null | undefined,
): string | null {
  const normalizedReply = normalizeTransferReplyText(replyText);
  if (!normalizedReply) {
    return 'empty_reply';
  }

  if (direction === 'character_to_user') {
    return CHARACTER_TO_USER_INITIATION_REFUSE_REGEX.test(normalizedReply)
      ? 'character_to_user_initiation_conflict'
      : null;
  }

  return USER_TO_CHARACTER_INITIATION_REFUSE_REGEX.test(normalizedReply)
    ? 'user_to_character_initiation_conflict'
    : null;
}

export function isTransferInitiationReplyConsistent(
  direction: TransferInitiationDirection,
  replyText: string | null | undefined,
): boolean {
  return findTransferInitiationReplyContradiction(direction, replyText) == null;
}

export function resolveTransferReplyTextForEvent(
  event: TransferSettlementEvent,
  replyText: string | null | undefined,
): string {
  const normalizedReply = normalizeTransferReplyText(replyText);
  if (normalizedReply && isTransferReplyConsistentWithEvent(event, normalizedReply)) {
    return normalizedReply;
  }

  return '';
}

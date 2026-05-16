import type { ChatMessage, GroupGovernanceCard } from '../../types';

export const GROUP_GOVERNANCE_CARD_EXPIRY_MS = 24 * 60 * 60 * 1000;

function createGovernanceCardId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createGroupJoinRequestMessage(params: {
  targetMemberId: string;
  targetMemberName: string;
  proposedById: string;
  proposedByName: string;
  timestamp?: number;
}): ChatMessage {
  const createdAt = params.timestamp ?? Date.now();
  const governanceCard: GroupGovernanceCard = {
    kind: 'join-request',
    requestId: createGovernanceCardId('join-request'),
    targetMemberId: params.targetMemberId,
    targetMemberName: params.targetMemberName,
    proposedById: params.proposedById,
    proposedByName: params.proposedByName,
    createdAt,
    expiresAt: createdAt + GROUP_GOVERNANCE_CARD_EXPIRY_MS,
    status: 'pending',
  };

  return {
    role: 'model',
    text: `[group-join-request] ${params.targetMemberName}`,
    timestamp: createdAt,
    isSystem: true,
    groupGovernanceCard: governanceCard,
  };
}

export function createGroupAdminNominationMessage(params: {
  nomineeId: string;
  nomineeName: string;
  proposedById: string;
  proposedByName: string;
  timestamp?: number;
}): ChatMessage {
  const createdAt = params.timestamp ?? Date.now();
  const governanceCard: GroupGovernanceCard = {
    kind: 'admin-nomination',
    nominationId: createGovernanceCardId('admin-nomination'),
    nomineeId: params.nomineeId,
    nomineeName: params.nomineeName,
    proposedById: params.proposedById,
    proposedByName: params.proposedByName,
    createdAt,
    expiresAt: createdAt + GROUP_GOVERNANCE_CARD_EXPIRY_MS,
    status: 'pending',
  };

  return {
    role: 'model',
    text: `[group-admin-nomination] ${params.nomineeName}`,
    timestamp: createdAt,
    isSystem: true,
    groupGovernanceCard: governanceCard,
  };
}

export function resolveGroupGovernanceMessage(params: {
  message: ChatMessage;
  status: 'approved' | 'rejected' | 'expired';
  resolvedById: string;
  resolvedByName: string;
  resolvedAt?: number;
}): ChatMessage {
  if (!params.message.groupGovernanceCard) {
    return params.message;
  }

  return {
    ...params.message,
    groupGovernanceCard: {
      ...params.message.groupGovernanceCard,
      status: params.status,
      resolvedAt: params.resolvedAt ?? Date.now(),
      resolvedById: params.resolvedById,
      resolvedByName: params.resolvedByName,
    },
  };
}

export function isPendingJoinRequestForMember(message: ChatMessage, memberId: string): boolean {
  return message.groupGovernanceCard?.kind === 'join-request'
    && message.groupGovernanceCard.targetMemberId === memberId
    && message.groupGovernanceCard.status === 'pending';
}

export function isPendingAdminNominationForMember(message: ChatMessage, memberId: string): boolean {
  return message.groupGovernanceCard?.kind === 'admin-nomination'
    && message.groupGovernanceCard.nomineeId === memberId
    && message.groupGovernanceCard.status === 'pending';
}

export function hasGovernanceCardExpired(card: GroupGovernanceCard, now = Date.now()): boolean {
  return card.status === 'pending' && card.expiresAt <= now;
}

export function expireGroupGovernanceMessage(message: ChatMessage, expiredAt = Date.now()): ChatMessage {
  if (!message.groupGovernanceCard || !hasGovernanceCardExpired(message.groupGovernanceCard, expiredAt)) {
    return message;
  }

  return resolveGroupGovernanceMessage({
    message,
    status: 'expired',
    resolvedById: 'system',
    resolvedByName: '系统',
    resolvedAt: expiredAt,
  });
}

export function getNearestPendingGovernanceExpiryAt(history: ChatMessage[]): number | undefined {
  const candidateTimestamps = history
    .map((message) => message.groupGovernanceCard)
    .filter((card): card is GroupGovernanceCard => !!card && card.status === 'pending')
    .map((card) => card.expiresAt)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);

  if (candidateTimestamps.length === 0) {
    return undefined;
  }

  return Math.min(...candidateTimestamps);
}

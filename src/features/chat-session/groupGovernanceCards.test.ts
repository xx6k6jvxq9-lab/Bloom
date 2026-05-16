import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGroupAdminNominationMessage,
  createGroupJoinRequestMessage,
  expireGroupGovernanceMessage,
  GROUP_GOVERNANCE_CARD_EXPIRY_MS,
  hasGovernanceCardExpired,
  isPendingAdminNominationForMember,
  isPendingJoinRequestForMember,
  resolveGroupGovernanceMessage,
} from './groupGovernanceCards';

test('createGroupJoinRequestMessage creates pending join request card', () => {
  const message = createGroupJoinRequestMessage({
    targetMemberId: 'beta',
    targetMemberName: 'Beta',
    proposedById: 'user',
    proposedByName: 'User',
    timestamp: 1,
  });

  assert.equal(message.groupGovernanceCard?.kind, 'join-request');
  assert.equal(message.groupGovernanceCard?.status, 'pending');
  assert.equal(message.groupGovernanceCard?.expiresAt, 1 + GROUP_GOVERNANCE_CARD_EXPIRY_MS);
  assert.equal(isPendingJoinRequestForMember(message, 'beta'), true);
});

test('createGroupAdminNominationMessage creates pending nomination card', () => {
  const message = createGroupAdminNominationMessage({
    nomineeId: 'beta',
    nomineeName: 'Beta',
    proposedById: 'user',
    proposedByName: 'User',
    timestamp: 1,
  });

  assert.equal(message.groupGovernanceCard?.kind, 'admin-nomination');
  assert.equal(message.groupGovernanceCard?.status, 'pending');
  assert.equal(isPendingAdminNominationForMember(message, 'beta'), true);
});

test('resolveGroupGovernanceMessage updates status and resolver metadata', () => {
  const message = createGroupJoinRequestMessage({
    targetMemberId: 'beta',
    targetMemberName: 'Beta',
    proposedById: 'user',
    proposedByName: 'User',
    timestamp: 1,
  });

  const resolvedMessage = resolveGroupGovernanceMessage({
    message,
    status: 'approved',
    resolvedById: 'user',
    resolvedByName: 'User',
    resolvedAt: 2,
  });

  assert.equal(resolvedMessage.groupGovernanceCard?.status, 'approved');
  assert.equal(resolvedMessage.groupGovernanceCard?.resolvedByName, 'User');
  assert.equal(resolvedMessage.groupGovernanceCard?.resolvedAt, 2);
});

test('expireGroupGovernanceMessage marks pending governance card as expired', () => {
  const message = createGroupAdminNominationMessage({
    nomineeId: 'beta',
    nomineeName: 'Beta',
    proposedById: 'alpha',
    proposedByName: 'Alpha',
    timestamp: 10,
  });

  assert.equal(hasGovernanceCardExpired(message.groupGovernanceCard!, 10 + GROUP_GOVERNANCE_CARD_EXPIRY_MS), true);

  const expiredMessage = expireGroupGovernanceMessage(message, 10 + GROUP_GOVERNANCE_CARD_EXPIRY_MS);
  assert.equal(expiredMessage.groupGovernanceCard?.status, 'expired');
  assert.equal(expiredMessage.groupGovernanceCard?.resolvedByName, '系统');
});

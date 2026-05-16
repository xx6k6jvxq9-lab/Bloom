import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatGroup } from '../../types';
import {
  buildAdminNominationCooldownPatch,
  canNominateMember,
  cleanupAdminNominationCooldowns,
  getAdminNominationCooldownEntry,
  getNearestAdminNominationCooldownExpiryAt,
  sanitizeAdminNominationCooldowns,
} from './groupGovernanceState';

test('buildAdminNominationCooldownPatch writes cooldown entry and blocks nomination until expiry', () => {
  const patch = buildAdminNominationCooldownPatch({}, 'beta', 100);

  assert.equal(patch.adminNominationCooldowns?.length, 1);
  assert.equal(getAdminNominationCooldownEntry(patch, 'beta')?.cooldownUntil, 100 + 24 * 60 * 60 * 1000);
  assert.equal(canNominateMember(patch, 'beta', 200), false);
});

test('cleanupAdminNominationCooldowns removes expired entries', () => {
  const group = {
    adminNominationCooldowns: [
      { memberId: 'beta', cooldownUntil: 100, updatedAt: 10 },
      { memberId: 'gamma', cooldownUntil: 500, updatedAt: 20 },
    ],
  };

  const cleanup = cleanupAdminNominationCooldowns(group, 200);

  assert.ok(cleanup);
  assert.deepEqual(cleanup?.adminNominationCooldowns, [
    { memberId: 'gamma', cooldownUntil: 500, updatedAt: 20 },
  ]);
});

test('sanitizeAdminNominationCooldowns drops invalid or duplicate entries', () => {
  const entries = sanitizeAdminNominationCooldowns([
    { memberId: 'beta', cooldownUntil: 200, updatedAt: 100 },
    { memberId: 'beta', cooldownUntil: 300, updatedAt: 200 },
    { memberId: 'ghost', cooldownUntil: 400, updatedAt: 300 },
  ], {
    memberIds: ['beta', 'gamma'],
  });

  assert.deepEqual(entries, [
    { memberId: 'beta', cooldownUntil: 200, updatedAt: 100 },
  ]);
});

test('getNearestAdminNominationCooldownExpiryAt returns earliest cooldown end', () => {
  assert.equal(getNearestAdminNominationCooldownExpiryAt({
    adminNominationCooldowns: [
      { memberId: 'beta', cooldownUntil: 500, updatedAt: 100 },
      { memberId: 'gamma', cooldownUntil: 300, updatedAt: 100 },
    ],
  }), 300);
});

test('governance cooldown helpers tolerate malformed runtime payloads', () => {
  const group = {
    adminNominationCooldowns: { beta: { cooldownUntil: 100 } } as unknown as ChatGroup['adminNominationCooldowns'],
  };

  assert.equal(getAdminNominationCooldownEntry(group, 'beta'), undefined);
  assert.equal(canNominateMember(group, 'beta', 200), true);
  assert.equal(getNearestAdminNominationCooldownExpiryAt(group), undefined);
  assert.deepEqual(buildAdminNominationCooldownPatch(group, 'beta', 100).adminNominationCooldowns, [
    {
      memberId: 'beta',
      cooldownUntil: 100 + 24 * 60 * 60 * 1000,
      updatedAt: 100,
    },
  ]);
});

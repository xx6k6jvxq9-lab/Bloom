import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatGroup } from '../../types';
import {
  buildDutyAdminAssignment,
  buildTemporaryManagedFeatureGrant,
  consumeTemporaryManagedFeatureGrant,
  getDynamicPermissionExpiryCleanup,
  getNearestDynamicPermissionExpiryAt,
  getTemporaryManagedFeatureGrant,
  sanitizeDutyAdminAssignment,
  sanitizeTemporaryPermissionGrants,
} from './groupDynamicPermissions';

function createGroup(overrides: Partial<ChatGroup> = {}): ChatGroup {
  return {
    id: overrides.id ?? 'group-1',
    name: overrides.name ?? '测试群',
    memberIds: overrides.memberIds ?? ['alpha', 'beta'],
    creatorId: overrides.creatorId ?? 'user',
    createdAt: overrides.createdAt ?? 1,
    adminIds: overrides.adminIds ?? [],
    ...overrides,
  };
}

test('consumeTemporaryManagedFeatureGrant removes single-use grant after launch', () => {
  const grantedAt = 1_000;
  const group = createGroup({
    temporaryPermissionGrants: [
      buildTemporaryManagedFeatureGrant({
        memberId: 'beta',
        grantedById: 'user',
        grantedAt,
        remainingUses: 1,
      }),
    ],
  });

  const result = consumeTemporaryManagedFeatureGrant(group, 'beta', grantedAt + 10);

  assert.ok(result);
  assert.equal(result?.consumedGrant.memberId, 'beta');
  assert.equal(result?.patch.temporaryPermissionGrants, undefined);
});

test('getDynamicPermissionExpiryCleanup collects expired duty and temporary grants', () => {
  const group = createGroup({
    dutyAdminAssignment: buildDutyAdminAssignment({
      memberId: 'alpha',
      grantedById: 'user',
      grantedAt: 100,
      durationMs: 10,
    }),
    temporaryPermissionGrants: [
      buildTemporaryManagedFeatureGrant({
        memberId: 'beta',
        grantedById: 'user',
        grantedAt: 100,
        durationMs: 10,
      }),
    ],
  });

  const cleanup = getDynamicPermissionExpiryCleanup(group, 200);

  assert.ok(cleanup);
  assert.equal(cleanup?.expiredDutyAdminAssignment?.memberId, 'alpha');
  assert.equal(cleanup?.expiredTemporaryPermissionGrants.length, 1);
  assert.equal(cleanup?.patch.dutyAdminAssignment, undefined);
  assert.equal(cleanup?.patch.temporaryPermissionGrants, undefined);
});

test('sanitize helpers drop invalid dynamic permission payloads', () => {
  const dutyAssignment = sanitizeDutyAdminAssignment({
    memberId: 'user',
    grantedById: 'user',
    grantedAt: 1,
    expiresAt: 2,
  }, {
    memberIds: ['alpha', 'beta'],
    creatorId: 'user',
  });

  const temporaryGrants = sanitizeTemporaryPermissionGrants([
    {
      id: 'bad-1',
      memberId: 'user',
      grantedById: 'user',
      permission: 'managed_group_feature',
      grantedAt: 1,
      expiresAt: 2,
      remainingUses: 1,
    },
  ], {
    memberIds: ['alpha', 'beta'],
    creatorId: 'user',
  });

  assert.equal(dutyAssignment, undefined);
  assert.equal(temporaryGrants, undefined);
});

test('getNearestDynamicPermissionExpiryAt returns the earliest active expiry', () => {
  const group = createGroup({
    dutyAdminAssignment: buildDutyAdminAssignment({
      memberId: 'alpha',
      grantedById: 'user',
      grantedAt: 100,
      durationMs: 300,
    }),
    temporaryPermissionGrants: [
      buildTemporaryManagedFeatureGrant({
        memberId: 'beta',
        grantedById: 'user',
        grantedAt: 100,
        durationMs: 120,
      }),
    ],
  });

  assert.equal(getNearestDynamicPermissionExpiryAt(group), 220);
});

test('dynamic permission helpers tolerate malformed runtime payloads', () => {
  const group = createGroup({
    dutyAdminAssignment: { memberId: 'beta' } as unknown as ChatGroup['dutyAdminAssignment'],
    temporaryPermissionGrants: { beta: { expiresAt: 100 } } as unknown as ChatGroup['temporaryPermissionGrants'],
  });

  assert.equal(getTemporaryManagedFeatureGrant(group, 'beta'), undefined);
  assert.equal(getNearestDynamicPermissionExpiryAt(group), undefined);
  assert.equal(getDynamicPermissionExpiryCleanup(group, 200), null);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatGroup } from '../../types';
import { buildDutyAdminAssignment, buildTemporaryManagedFeatureGrant } from './groupDynamicPermissions';
import type { GroupSettingsPatch } from './types';
import {
  canEditGroupNotice,
  canLaunchManagedGroupFeature,
  filterGroupSettingsPatchForActor,
} from './groupPermissionRules';

function createGroup(overrides: Partial<ChatGroup> = {}): ChatGroup {
  return {
    id: overrides.id ?? 'group-1',
    name: overrides.name ?? '测试群',
    memberIds: overrides.memberIds ?? ['alpha', 'beta'],
    creatorId: overrides.creatorId ?? 'user',
    createdAt: overrides.createdAt ?? 1,
    adminIds: overrides.adminIds ?? ['alpha'],
    ...overrides,
  };
}

test('admins can edit group notice and launch managed features, members cannot', () => {
  const group = createGroup();

  assert.equal(canEditGroupNotice(group, 'alpha'), true);
  assert.equal(canLaunchManagedGroupFeature(group, 'alpha'), true);
  assert.equal(canEditGroupNotice(group, 'beta'), false);
  assert.equal(canLaunchManagedGroupFeature(group, 'beta'), false);
});

test('duty admin can edit notice and temporary grant can launch managed features', () => {
  const timestamp = Date.now();
  const group = createGroup({
    adminIds: [],
    dutyAdminAssignment: buildDutyAdminAssignment({
      memberId: 'beta',
      grantedById: 'user',
      grantedAt: timestamp,
    }),
    temporaryPermissionGrants: [
      buildTemporaryManagedFeatureGrant({
        memberId: 'beta',
        grantedById: 'user',
        grantedAt: timestamp,
      }),
    ],
  });

  assert.equal(canEditGroupNotice(group, 'beta'), true);
  assert.equal(canLaunchManagedGroupFeature(group, 'beta'), true);
});

test('filterGroupSettingsPatchForActor keeps only allowed fields for admin', () => {
  const group = createGroup();
  const patch: Partial<GroupSettingsPatch> = {
    name: '新群名',
    groupNotice: '今晚八点集合',
    pinChat: true,
    backgroundSummary: '只有群主能改',
  };

  const filteredPatch = filterGroupSettingsPatchForActor(group, 'alpha', patch);

  assert.deepEqual(filteredPatch, {
    groupNotice: '今晚八点集合',
    pinChat: true,
  });
});

test('filterGroupSettingsPatchForActor strips managed fields for ordinary member but keeps local preferences', () => {
  const group = createGroup();
  const patch: Partial<GroupSettingsPatch> = {
    groupNotice: '普通成员不能改',
    muteNotifications: true,
    manualReplyEnabled: false,
  };

  const filteredPatch = filterGroupSettingsPatchForActor(group, 'beta', patch);

  assert.deepEqual(filteredPatch, {
    muteNotifications: true,
    manualReplyEnabled: false,
  });
});

test('filterGroupSettingsPatchForActor allows duty admin to edit notice only', () => {
  const group = createGroup({
    adminIds: [],
    dutyAdminAssignment: buildDutyAdminAssignment({
      memberId: 'beta',
      grantedById: 'user',
      grantedAt: Date.now(),
    }),
  });
  const patch: Partial<GroupSettingsPatch> = {
    groupNotice: '值日可以改',
    name: '值日不能改群名',
    pinChat: true,
  };

  const filteredPatch = filterGroupSettingsPatchForActor(group, 'beta', patch);

  assert.deepEqual(filteredPatch, {
    groupNotice: '值日可以改',
    pinChat: true,
  });
});
